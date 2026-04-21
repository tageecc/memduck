import { readFile } from "node:fs/promises";

import type { ProviderSettings } from "../memduck/types";
import type { ProviderRuntime } from "./provider-runtime";

interface AnthropicResponse {
  content?: Array<{
    text?: string;
    type?: string;
  }>;
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractText(payload: AnthropicResponse): string {
  const text = payload.content
    ?.filter((item) => item.type === "text" || item.text)
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned an empty completion payload.");
  }

  return text;
}

function extractJsonBlock(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }

  return content;
}

function parseRankedResult(
  content: string,
  candidateIds: string[],
): Array<{ id: string; score: number }> {
  const parsed = JSON.parse(extractJsonBlock(content)) as {
    rankedIds?: string[];
    scores?: Array<{ id?: string; score?: number }>;
  };
  const validIds = new Set(candidateIds);

  if (parsed.scores?.length) {
    const invalid = parsed.scores.find(
      (entry) =>
        !entry.id || !validIds.has(entry.id) || typeof entry.score !== "number",
    );

    if (invalid) {
      throw new Error("Anthropic returned an invalid rerank score payload.");
    }

    return parsed.scores
      .map((entry) => ({
        id: entry.id as string,
        score: entry.score as number,
      }))
      .sort((left, right) => right.score - left.score);
  }

  if (!parsed.rankedIds?.length) {
    throw new Error("Anthropic returned an empty rerank payload.");
  }

  const unknownId = parsed.rankedIds.find((id) => !validIds.has(id));
  if (unknownId) {
    throw new Error(`Anthropic returned an unknown rerank id: ${unknownId}`);
  }

  return parsed.rankedIds.map((id, index, array) => ({
    id,
    score: array.length - index,
  }));
}

function parseVisionResult(content: string): {
  extractedText: string;
  keyPoints: string[];
  summary: string;
} {
  const parsed = JSON.parse(extractJsonBlock(content)) as {
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
    throw new Error("Anthropic returned an invalid vision payload.");
  }

  return {
    extractedText:
      typeof parsed.extractedText === "string" ? parsed.extractedText : "",
    keyPoints: parsed.keyPoints,
    summary: parsed.summary,
  };
}

async function createMessage(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  systemPrompt: string,
  content:
    | string
    | Array<
        | {
            text: string;
            type: "text";
          }
        | {
            source: {
              data: string;
              media_type: string;
              type: "base64";
            };
            type: "image";
          }
      >,
): Promise<string> {
  if (!settings.apiKey || !settings.baseUrl || !model) {
    throw new Error("Anthropic provider settings are incomplete.");
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/v1/messages`,
    {
      body: JSON.stringify({
        max_tokens: 1024,
        messages: [
          {
            content:
              typeof content === "string"
                ? [{ text: content, type: "text" }]
                : content,
            role: "user",
          },
        ],
        model,
        system: systemPrompt,
      }),
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return extractText((await response.json()) as AnthropicResponse);
}

export function createAnthropicProvider(
  settings: ProviderSettings,
  fetcher: typeof fetch,
  resolveObjectPath?: (objectKey: string) => string,
): ProviderRuntime {
  return {
    async answer(question, context) {
      return createMessage(
        fetcher,
        settings,
        settings.answerModel,
        "Answer the question using only the provided memory context. Be concise and grounded.",
        ["Question:", question, "", "Memory context:", ...context].join("\n"),
      );
    },

    async complete(instruction, context, options) {
      return createMessage(
        fetcher,
        settings,
        options?.capability === "summarize"
          ? settings.summarizeModel || settings.answerModel
          : settings.answerModel,
        "Follow the instruction exactly. Use only the provided context. Return exactly the requested output format.",
        ["Instruction:", instruction, "", "Context:", ...context].join("\n"),
      );
    },

    async embed(input) {
      const content = await createMessage(
        fetcher,
        settings,
        settings.embeddingModel || settings.answerModel,
        "Return only JSON. Project the text into a semantic vector under the key embedding.",
        `Return JSON with an embedding array for this text:\n\n${input}`,
      );

      const parsed = JSON.parse(extractJsonBlock(content)) as {
        embedding?: number[];
      };

      if (!parsed.embedding?.length) {
        throw new Error("Anthropic embedding response was empty.");
      }

      return parsed.embedding;
    },

    async rerank(question, candidates) {
      const content = await createMessage(
        fetcher,
        settings,
        settings.rerankModel || settings.answerModel,
        "Return only JSON. Rank the candidate ids from most relevant to least relevant for the question.",
        [
          "Return JSON with rankedIds and optional scores.",
          "",
          `Question: ${question}`,
          "",
          "Candidates:",
          ...candidates.map(
            (candidate) => `${candidate.id}: ${candidate.text.slice(0, 500)}`,
          ),
        ].join("\n"),
      );

      return parseRankedResult(
        content,
        candidates.map((candidate) => candidate.id),
      );
    },

    async summarize(input) {
      return createMessage(
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
      const content = await createMessage(
        fetcher,
        settings,
        settings.visionModel || settings.answerModel,
        "Analyze the image and reply with JSON containing summary, extractedText, and keyPoints.",
        [
          {
            source: {
              data: bytes.toString("base64"),
              media_type: input.mimeType,
              type: "base64",
            },
            type: "image",
          },
          {
            text: "Describe the image, pull out readable text, and return JSON with summary, extractedText, and keyPoints.",
            type: "text",
          },
        ],
      );

      return parseVisionResult(content);
    },
  };
}
