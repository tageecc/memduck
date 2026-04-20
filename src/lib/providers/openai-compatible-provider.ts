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

function extractJsonBlock(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }

  return content;
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

async function createChatCompletion(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  systemPrompt: string,
  userPrompt: UserMessageContent,
): Promise<string> {
  if (!settings.baseUrl || !settings.apiKey || !model) {
    throw new Error("Provider settings are incomplete.");
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
      headers: {
        authorization: `Bearer ${settings.apiKey}`,
        "content-type": "application/json",
      },
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
  if (!settings.baseUrl || !settings.apiKey || !settings.embeddingModel) {
    throw new Error("Embedding settings are incomplete.");
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/embeddings`,
    {
      body: JSON.stringify({
        input,
        model: settings.embeddingModel,
      }),
      headers: {
        authorization: `Bearer ${settings.apiKey}`,
        "content-type": "application/json",
      },
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

    async embed(input) {
      return createEmbedding(fetcher, settings, input);
    },

    async rerank(question, candidates) {
      const content = await createChatCompletion(
        fetcher,
        settings,
        settings.rerankModel || settings.answerModel,
        "Return only JSON. Rank the candidate ids from most relevant to least relevant for the question.",
        [
          `Return JSON with rankedIds and optional scores for the most relevant candidate ids.`,
          "",
          `Question: ${question}`,
          "",
          "Candidates:",
          ...candidates.map(
            (candidate) => `${candidate.id}: ${candidate.text.slice(0, 500)}`,
          ),
        ].join("\n"),
      );

      try {
        const parsed = JSON.parse(extractJsonBlock(content)) as {
          rankedIds?: string[];
          scores?: Array<{ id: string; score: number }>;
        };

        if (parsed.scores?.length) {
          return parsed.scores.sort((left, right) => right.score - left.score);
        }

        if (parsed.rankedIds?.length) {
          return parsed.rankedIds.map((id, index) => ({
            id,
            score: parsed.rankedIds ? parsed.rankedIds.length - index : 0,
          }));
        }
      } catch {}

      return candidates.map((candidate, index) => ({
        id: candidate.id,
        score: candidates.length - index,
      }));
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
        settings.visionModel || settings.answerModel,
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

      try {
        const parsed = JSON.parse(extractJsonBlock(content)) as {
          extractedText?: string;
          keyPoints?: string[];
          summary?: string;
        };

        return {
          extractedText: parsed.extractedText ?? "",
          keyPoints: parsed.keyPoints ?? [],
          summary: parsed.summary ?? content,
        };
      } catch {
        return {
          extractedText: content,
          keyPoints: content
            .split(/[.!?]/)
            .map((part) => part.trim())
            .filter(Boolean)
            .slice(0, 3),
          summary: content,
        };
      }
    },
  };
}
