import type { ProviderSettings } from "../../src/lib/memduck/service";

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

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

function extractSourceText(prompt: string): string {
  const marker = "Source text:";
  const index = prompt.indexOf(marker);

  if (index < 0) {
    return cleanText(prompt);
  }

  return cleanText(prompt.slice(index + marker.length));
}

function buildDefaultMemoryDigest(prompt: string) {
  const sourceText = extractSourceText(prompt);
  const sentences = sourceText
    .split(/[.!?]/)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
  const summary = sentences[0] ?? sourceText.slice(0, 160);
  const deepSummary = cleanText(
    sentences.slice(0, 2).join(". ") || sourceText.slice(0, 320),
  );
  const keyPoints = (sentences.length > 0 ? sentences : [sourceText]).slice(
    0,
    3,
  );
  const evidence = keyPoints.slice(0, 2);

  return {
    deepSummary,
    evidence,
    keyPoints,
    summary,
    worthSaving: !prompt.includes("Requested depth: save"),
  };
}

function parseExistingTopics(
  prompt: string,
): Array<{ id: string; name: string }> {
  return prompt
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => /^topic-\d+:/.test(line))
    .map((line) => {
      const [idPart, rest = ""] = line.split(":", 2);
      const name = cleanText(rest.split("[")[0] ?? "");

      return {
        id: cleanText(idPart ?? ""),
        name,
      };
    })
    .filter((topic) => topic.id && topic.name);
}

function buildDefaultTopicResolution(prompt: string) {
  const normalized = prompt.toLowerCase();
  const existingTopics = parseExistingTopics(prompt);
  const retrievalTopic = existingTopics.find((topic) =>
    topic.name.toLowerCase().includes("retrieval"),
  );
  const memoryTopic = existingTopics.find((topic) =>
    topic.name.toLowerCase().includes("memory"),
  );

  if (normalized.includes("retrieval") && retrievalTopic) {
    return {
      matches: [
        {
          confidence: 0.94,
          reason: "The card centers on retrieval practice and review cadence.",
          topicId: retrievalTopic.id,
        },
      ],
      newTopics: [],
    };
  }

  if (normalized.includes("memory") && memoryTopic) {
    return {
      matches: [
        {
          confidence: 0.9,
          reason: "The card focuses on memory systems and recall behavior.",
          topicId: memoryTopic.id,
        },
      ],
      newTopics: [],
    };
  }

  if (normalized.includes("retrieval")) {
    return {
      matches: [],
      newTopics: [
        {
          confidence: 0.94,
          keywords: ["retrieval practice", "review cadence", "memory recall"],
          name: "Retrieval Practice",
          reason: "The card repeatedly discusses retrieval practice.",
        },
      ],
    };
  }

  if (normalized.includes("memory")) {
    return {
      matches: [],
      newTopics: [
        {
          confidence: 0.9,
          keywords: ["memory systems", "recall", "knowledge reuse"],
          name: "Memory Systems",
          reason:
            "The card is about how memory systems retain and recall information.",
        },
      ],
    };
  }

  return {
    matches: [],
    newTopics: [
      {
        confidence: 0.82,
        keywords: ["captured insight"],
        name: "Captured Insight",
        reason: "The card introduces a new standalone idea.",
      },
    ],
  };
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
    memoryDigest?:
      | {
          deepSummary: string;
          evidence: string[];
          keyPoints: string[];
          summary: string;
          worthSaving: boolean;
        }
      | ((prompt: string) => {
          deepSummary: string;
          evidence: string[];
          keyPoints: string[];
          summary: string;
          worthSaving: boolean;
        });
    reviewCompilation?:
      | { staleHighValue: string[]; themeMomentum: string[]; today: string[] }
      | ((prompt: string) => {
          staleHighValue: string[];
          themeMomentum: string[];
          today: string[];
        });
    summary?: string | ((prompt: string) => string);
    topicResolution?:
      | {
          matches: Array<{
            confidence: number;
            reason: string;
            topicId: string;
          }>;
          newTopics: Array<{
            confidence: number;
            keywords: string[];
            name: string;
            reason: string;
          }>;
        }
      | ((prompt: string) => {
          matches: Array<{
            confidence: number;
            reason: string;
            topicId: string;
          }>;
          newTopics: Array<{
            confidence: number;
            keywords: string[];
            name: string;
            reason: string;
          }>;
        });
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

    if (prompt.includes("Compile a memory card")) {
      const payload =
        typeof input.memoryDigest === "function"
          ? input.memoryDigest(prompt)
          : (input.memoryDigest ?? buildDefaultMemoryDigest(prompt));

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

    if (prompt.includes("Resolve topic links")) {
      const payload =
        typeof input.topicResolution === "function"
          ? input.topicResolution(prompt)
          : (input.topicResolution ?? buildDefaultTopicResolution(prompt));

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
