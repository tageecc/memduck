import type { ProviderSettings } from "../../src/lib/memduck/service";

function toPrompt(init?: RequestInit): string {
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    messages?: Array<{
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>;
    }>;
  };
  const content = body.messages?.at(-1)?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => entry.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function isVisionRequest(init?: RequestInit): boolean {
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    messages?: Array<{
      content?:
        | string
        | Array<{
            image_url?: unknown;
            type?: string;
          }>;
    }>;
  };
  const content = body.messages?.at(-1)?.content;

  return Array.isArray(content)
    ? content.some(
        (entry) => entry.type === "image_url" || Boolean(entry.image_url),
      )
    : false;
}

function createEmbedding(input: string): number[] {
  const normalized = input.toLowerCase();
  return [
    normalized.includes("retrieval") ? 0.96 : 0.08,
    normalized.includes("spaced") ? 0.94 : 0.06,
    normalized.includes("memory") ? 0.92 : 0.04,
  ];
}

function parseCandidateIds(prompt: string): string[] {
  return prompt
    .split("\n")
    .filter((line) => /^card-\d+:/.test(line.trim()))
    .map((line) => line.split(":")[0]?.trim() ?? "")
    .filter(Boolean);
}

export function defaultProviderSettings(
  overrides: Partial<ProviderSettings> = {},
): ProviderSettings {
  return {
    answerModel: "gpt-answer",
    apiKey: "sk-test",
    baseUrl: "https://api.example.com/v1",
    embeddingModel: "text-embedding-3-small",
    kind: "openai-compatible",
    rerankModel: "gpt-rerank",
    summarizeModel: "gpt-summary",
    visionModel: "gpt-vision",
    ...overrides,
  };
}

export function createOpenAICompatibleFetcher(
  input: {
    answer?: string | ((prompt: string) => string);
    reviewCompilation?:
      | { staleHighValue: string[]; themeMomentum: string[]; today: string[] }
      | ((prompt: string) => {
          staleHighValue: string[];
          themeMomentum: string[];
          today: string[];
        });
    summary?: string | ((prompt: string) => string);
    topicCompilation?:
      | {
          conflictPoints: string[];
          nextQuestions: string[];
          repeatedPoints: string[];
          summary: string;
        }
      | ((prompt: string) => {
          conflictPoints: string[];
          nextQuestions: string[];
          repeatedPoints: string[];
          summary: string;
        });
    vision?:
      | { extractedText: string; keyPoints: string[]; summary: string }
      | ((prompt: string) => {
          extractedText: string;
          keyPoints: string[];
          summary: string;
        });
  } = {},
): typeof fetch {
  return async (request, init) => {
    const url = String(request);

    if (url.endsWith("/embeddings")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { input?: string };
      return new Response(
        JSON.stringify({
          data: [{ embedding: createEmbedding(body.input ?? "") }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    const prompt = toPrompt(init);

    if (prompt.includes("Compile a topic summary")) {
      const payload =
        typeof input.topicCompilation === "function"
          ? input.topicCompilation(prompt)
          : (input.topicCompilation ?? {
              conflictPoints: ["daily vs weekly review"],
              nextQuestions: ["Which cadence best fits this topic?"],
              repeatedPoints: ["retrieval practice matters"],
              summary: "Compiled topic summary",
            });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(payload) } }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    if (prompt.includes("Compile review buckets")) {
      const payload =
        typeof input.reviewCompilation === "function"
          ? input.reviewCompilation(prompt)
          : (input.reviewCompilation ?? {
              staleHighValue: ["card-1"],
              themeMomentum: ["card-1"],
              today: ["card-1"],
            });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(payload) } }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    if (prompt.includes("Return JSON with rankedIds")) {
      const rankedIds = parseCandidateIds(prompt);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ rankedIds }),
              },
            },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    if (
      prompt.includes("Describe the image") ||
      prompt.includes("Analyze the image") ||
      isVisionRequest(init)
    ) {
      const payload =
        typeof input.vision === "function"
          ? input.vision(prompt)
          : (input.vision ?? {
              extractedText: "OCR text",
              keyPoints: ["visual note", "captured insight"],
              summary: "Image digest summary",
            });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(payload) } }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    if (prompt.includes("Answer the question")) {
      const answer =
        typeof input.answer === "function"
          ? input.answer(prompt)
          : (input.answer ?? "Grounded answer from saved memory.");

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: answer } }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    }

    const summary =
      typeof input.summary === "function"
        ? input.summary(prompt)
        : (input.summary ?? "Structured summary from provider.");

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: summary } }],
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  };
}
