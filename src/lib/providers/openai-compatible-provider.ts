import { readFile } from "node:fs/promises";

import type { ProviderSettings } from "../memduck/types";
import type { ProviderRuntime } from "./provider-runtime";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>;
    };
  }>;
}

interface EmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

type UserMessageContent =
  | string
  | Array<
      | {
          text: string;
          type: "text";
        }
      | {
          image_url: {
            url: string;
          };
          type: "image_url";
        }
    >;

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function requireJsonObjectContent(content: string): string {
  const trimmed = content.trim();

  // Extract JSON from content that may contain thinking blocks or preamble text
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }

  throw new Error("Provider returned non-JSON content.");
}

function parseRankedResult(
  content: string,
  candidateIds: string[],
): Array<{ id: string; score: number }> {
  const parsed = JSON.parse(requireJsonObjectContent(content)) as {
    rankedIds?: string[];
    scores?: Array<{ id?: string; score?: number }>;
  };
  const validIds = new Set(candidateIds);

  if (parsed.scores?.length) {
    const validScores = parsed.scores.filter(
      (entry) =>
        entry.id && validIds.has(entry.id) && typeof entry.score === "number",
    );

    if (validScores.length > 0) {
      return validScores
        .map((entry) => ({
          id: entry.id as string,
          score: entry.score as number,
        }))
        .sort((left, right) => right.score - left.score);
    }
    // Fall through to rankedIds if scores have invalid entries
  }

  if (!parsed.rankedIds?.length) {
    throw new Error("Provider returned an empty rerank payload.");
  }

  // Filter out any unknown IDs the model might have hallucinated
  const rankedIds = parsed.rankedIds.filter((id) => validIds.has(id));
  if (rankedIds.length === 0) {
    throw new Error("Provider returned no valid rerank ids.");
  }

  return rankedIds.map((id, index, array) => ({
    id,
    score: array.length - index,
  }));
}

function parseVisionResult(content: string): {
  extractedText: string;
  keyPoints: string[];
  summary: string;
} {
  const parsed = JSON.parse(requireJsonObjectContent(content)) as {
    extractedText?: string;
    keyPoints?: unknown;
    summary?: string;
  };

  if (
    typeof parsed.summary !== "string" ||
    !parsed.summary.trim() ||
    !Array.isArray(parsed.keyPoints) ||
    parsed.keyPoints.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error("Provider returned an invalid vision payload.");
  }

  return {
    extractedText:
      typeof parsed.extractedText === "string" ? parsed.extractedText : "",
    keyPoints: parsed.keyPoints,
    summary: parsed.summary,
  };
}

function readAssistantText(payload: ChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  throw new Error("Provider returned an empty completion payload.");
}

async function* createChatCompletionStream(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  systemPrompt: string,
  userPrompt: UserMessageContent,
): AsyncIterable<string> {
  if (!settings.baseUrl || !model) {
    throw new Error("Provider settings are incomplete.");
  }

  if (settings.kind !== "ollama" && !settings.apiKey) {
    throw new Error("Provider API key is missing.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (settings.apiKey) {
    headers.authorization = `Bearer ${settings.apiKey}`;
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      body: JSON.stringify({
        messages: [
          { content: systemPrompt, role: "system" },
          { content: userPrompt, role: "user" },
        ],
        model,
        stream: true,
        temperature: 0.2,
      }),
      headers,
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // skip malformed chunk
      }
    }
  }
}

async function createChatCompletion(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  systemPrompt: string,
  userPrompt: UserMessageContent,
): Promise<string> {
  if (!settings.baseUrl || !model) {
    throw new Error("Provider settings are incomplete.");
  }

  if (settings.kind !== "ollama" && !settings.apiKey) {
    throw new Error("Provider API key is missing.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (settings.apiKey) {
    headers.authorization = `Bearer ${settings.apiKey}`;
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      body: JSON.stringify({
        messages: [
          { content: systemPrompt, role: "system" },
          { content: userPrompt, role: "user" },
        ],
        model,
        temperature: 0.2,
      }),
      headers,
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return readAssistantText((await response.json()) as ChatCompletionResponse);
}

async function createEmbedding(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  input: string,
): Promise<number[]> {
  if (!settings.baseUrl || !settings.embeddingModel) {
    throw new Error("Embedding settings are incomplete.");
  }

  if (settings.kind !== "ollama" && !settings.apiKey) {
    throw new Error("Embedding API key is missing.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (settings.apiKey) {
    headers.authorization = `Bearer ${settings.apiKey}`;
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/embeddings`,
    {
      body: JSON.stringify({
        input,
        model: settings.embeddingModel,
      }),
      headers,
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const embedding = ((await response.json()) as EmbeddingResponse).data?.[0]
    ?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding response was empty.");
  }

  return embedding;
}

export function createOpenAICompatibleProvider(
  settings: ProviderSettings,
  fetcher: typeof fetch,
  resolveObjectPath?: (objectKey: string) => string,
): ProviderRuntime {
  return {
    async answer(question, context) {
      return createChatCompletion(
        fetcher,
        settings,
        settings.answerModel,
        "Answer the question using only the provided memory context. Be concise and grounded.",
        [
          "Answer the question with the saved memory context below.",
          "",
          `Question: ${question}`,
          "",
          "Context:",
          ...context,
        ].join("\n"),
      );
    },

    answerStream(question, context) {
      return createChatCompletionStream(
        fetcher,
        settings,
        settings.answerModel,
        "Answer the question using only the provided memory context. Be concise and grounded.",
        [
          "Answer the question with the saved memory context below.",
          "",
          `Question: ${question}`,
          "",
          "Context:",
          ...context,
        ].join("\n"),
      );
    },

    async complete(instruction, context, options) {
      return createChatCompletion(
        fetcher,
        settings,
        options?.capability === "summarize"
          ? settings.summarizeModel
          : settings.answerModel,
        "Follow the instruction exactly. Use only the provided context. Return exactly the requested output format.",
        ["Instruction:", instruction, "", "Context:", ...context].join("\n"),
      );
    },

    async embed(input) {
      return createEmbedding(fetcher, settings, input);
    },

    async rerank(question, candidates) {
      const candidateList = candidates
        .map((candidate) => `${candidate.id}: ${candidate.text.slice(0, 500)}`)
        .join("\n");
      const content = await createChatCompletion(
        fetcher,
        settings,
        settings.rerankModel,
        "You are a relevance ranking assistant. Respond ONLY with valid JSON, no explanation.",
        [
          `Rank these candidates by relevance to the question. Use the exact IDs provided.`,
          `Return JSON with rankedIds: {"rankedIds": ["<most_relevant_id>", "<second_id>", ...]}`,
          ``,
          `Question: ${question}`,
          ``,
          `Candidates:`,
          candidateList,
        ].join("\n"),
      );

      return parseRankedResult(
        content,
        candidates.map((candidate) => candidate.id),
      );
    },

    async summarize(input) {
      return createChatCompletion(
        fetcher,
        settings,
        settings.summarizeModel,
        "Summarize saved content into a compact personal memory card summary.",
        input,
      );
    },

    async visionAnalyze(input) {
      if (!resolveObjectPath) {
        throw new Error("Local asset resolution is not configured.");
      }

      const absolutePath = resolveObjectPath(input.objectKey);
      const bytes = await readFile(absolutePath);
      const dataUrl = `data:${input.mimeType};base64,${bytes.toString("base64")}`;

      const content = await createChatCompletion(
        fetcher,
        settings,
        settings.visionModel,
        "Analyze the image and reply with JSON containing summary, extractedText, and keyPoints.",
        [
          {
            text: "Describe the image, pull out readable text, and return JSON with summary, extractedText, and keyPoints.",
            type: "text",
          },
          {
            image_url: {
              url: dataUrl,
            },
            type: "image_url",
          },
        ],
      );

      return parseVisionResult(content);
    },
  };
}
