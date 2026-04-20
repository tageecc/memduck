import { readFile } from "node:fs/promises";

import type { ProviderSettings } from "../memduck/types";
import type { ProviderRuntime } from "./provider-runtime";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractText(payload: GeminiResponse): string {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty completion payload.");
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

async function generateContent(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  parts: Array<Record<string, unknown>>,
): Promise<string> {
  if (!settings.apiKey || !settings.baseUrl || !model) {
    throw new Error("Gemini provider settings are incomplete.");
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/models/${encodeURIComponent(model)}:generateContent`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts,
            role: "user",
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": settings.apiKey,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return extractText((await response.json()) as GeminiResponse);
}

async function embedContent(
  fetcher: typeof fetch,
  settings: ProviderSettings,
  model: string | undefined,
  text: string,
): Promise<number[]> {
  if (!settings.apiKey || !settings.baseUrl || !model) {
    throw new Error("Gemini embedding settings are incomplete.");
  }

  const response = await fetcher(
    `${trimBaseUrl(settings.baseUrl)}/models/${encodeURIComponent(model)}:embedContent`,
    {
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": settings.apiKey,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const values = ((await response.json()) as GeminiEmbeddingResponse).embedding
    ?.values;

  if (!values?.length) {
    throw new Error("Gemini embedding response was empty.");
  }

  return values;
}

export function createGeminiProvider(
  settings: ProviderSettings,
  fetcher: typeof fetch,
  resolveObjectPath?: (objectKey: string) => string,
): ProviderRuntime {
  return {
    async answer(question, context) {
      return generateContent(fetcher, settings, settings.answerModel, [
        {
          text: [
            "Answer the question using only the provided memory context. Be concise and grounded.",
            "",
            `Question: ${question}`,
            "",
            "Memory context:",
            ...context,
          ].join("\n"),
        },
      ]);
    },

    async embed(input) {
      return embedContent(
        fetcher,
        settings,
        settings.embeddingModel || "text-embedding-004",
        input,
      );
    },

    async rerank(question, candidates) {
      const content = await generateContent(
        fetcher,
        settings,
        settings.rerankModel || settings.answerModel,
        [
          {
            text: [
              "Return only JSON with rankedIds and optional scores.",
              "",
              `Question: ${question}`,
              "",
              "Candidates:",
              ...candidates.map(
                (candidate) =>
                  `${candidate.id}: ${candidate.text.slice(0, 500)}`,
              ),
            ].join("\n"),
          },
        ],
      );

      const parsed = JSON.parse(extractJsonBlock(content)) as {
        rankedIds?: string[];
        scores?: Array<{ id: string; score: number }>;
      };

      if (parsed.scores?.length) {
        return parsed.scores.sort((left, right) => right.score - left.score);
      }

      return (parsed.rankedIds ?? []).map((id, index, array) => ({
        id,
        score: array.length - index,
      }));
    },

    async summarize(input) {
      return generateContent(fetcher, settings, settings.summarizeModel, [
        {
          text: [
            "Summarize saved content into a compact personal memory card summary.",
            "",
            input,
          ].join("\n"),
        },
      ]);
    },

    async visionAnalyze(input) {
      if (!resolveObjectPath) {
        throw new Error("Local asset resolution is not configured.");
      }

      const absolutePath = resolveObjectPath(input.objectKey);
      const bytes = await readFile(absolutePath);
      const content = await generateContent(
        fetcher,
        settings,
        settings.visionModel || settings.answerModel,
        [
          {
            text: "Describe the image, pull out readable text, and return JSON with summary, extractedText, and keyPoints.",
          },
          {
            inline_data: {
              data: bytes.toString("base64"),
              mime_type: input.mimeType,
            },
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
