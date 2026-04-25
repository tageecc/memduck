import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  askRequestSchema,
  providerProfileSchema,
} from "../src/lib/memduck/contracts";
import { createMemduckService } from "../src/lib/memduck/service";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

const testRuntimeDir = path.join(
  process.cwd(),
  ".memduck/strict-runtime-contracts",
);

function extractPrompt(init?: RequestInit): string {
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

describe("strict runtime contracts", () => {
  beforeEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  it("fails ingest without an active provider instead of using a mock runtime", async () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });

    await expect(
      service.ingest({
        kind: "text",
        payload: { text: "This must not be digested by a hidden mock." },
        requestedDepth: "quick",
        sourceChannel: "web",
      }),
    ).rejects.toThrow("No active provider profile is configured.");

    expect(service.listMemoryCards()).toHaveLength(0);
  });

  it("fails URL ingest when fetching or readability extraction fails", async () => {
    const service = createMemduckService({
      contentFetch: async () => new Response("not found", { status: 404 }),
      providerFetch: createOpenAICompatibleFetcher(),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await expect(
      service.ingest({
        kind: "url",
        payload: { url: "https://example.com/missing" },
        requestedDepth: "quick",
        sourceChannel: "web",
      }),
    ).rejects.toThrow("URL fetch failed with 404");

    expect(service.listMemoryCards()).toHaveLength(0);
  });

  it("fails ingest when structured memory compilation is malformed", async () => {
    const baseFetcher = createOpenAICompatibleFetcher();
    const providerFetch: typeof fetch = async (request, init) => {
      const prompt = extractPrompt(init);

      if (
        prompt.includes("Compile a quick memory card") ||
        prompt.includes("Compile a deep memory card") ||
        prompt.includes("Compile a memory card")
      ) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-json" } }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await expect(
      service.ingest({
        kind: "text",
        payload: { text: "Malformed compiler output must fail the capture." },
        requestedDepth: "deep",
        sourceChannel: "web",
      }),
    ).rejects.toThrow();

    expect(service.listMemoryCards()).toHaveLength(0);
  });

  it("rejects structured memory JSON wrapped in explanatory text", async () => {
    const baseFetcher = createOpenAICompatibleFetcher();
    const providerFetch: typeof fetch = async (request, init) => {
      const prompt = extractPrompt(init);

      if (
        prompt.includes("Compile a quick memory card") ||
        prompt.includes("Compile a deep memory card") ||
        prompt.includes("Compile a memory card")
      ) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    'Here is the JSON: {"summary":"Wrapped","deepSummary":"Wrapped output","keyPoints":["one"],"evidence":["two"],"worthSaving":true}',
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

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await expect(
      service.ingest({
        kind: "text",
        payload: { text: "Wrapped JSON must be rejected by the runtime." },
        requestedDepth: "quick",
        sourceChannel: "web",
      }),
    ).rejects.toThrow("Provider returned non-JSON content.");

    expect(service.listMemoryCards()).toHaveLength(0);
  });

  it("fails knowledge compilation when topic compiler output is malformed", async () => {
    const service = createMemduckService({
      providerFetch: createOpenAICompatibleFetcher({
        topicCompilation: {
          conflictPoints: [],
          nextQuestions: [],
          repeatedPoints: [],
          summary: "",
        },
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice should compile into an authoritative topic.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await expect(service.compileKnowledge()).rejects.toThrow(
      "Compiled topic payload is invalid",
    );
    expect(service.listCompiledTopics()).toHaveLength(0);
    expect(service.getCompiledReviewBuckets()).toBeNull();
  });

  it("fails retrieval when rerank output is malformed", async () => {
    const baseFetcher = createOpenAICompatibleFetcher();
    const providerFetch: typeof fetch = async (request, init) => {
      const prompt = extractPrompt(init);

      if (prompt.includes("Return JSON with rankedIds")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-json" } }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Semantic memory depends on provider reranking being truthful.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    await expect(
      service.retrieveCards({
        limit: 1,
        query: "semantic memory",
      }),
    ).rejects.toThrow();
  });

  it("fails retrieval when embedding dimensions differ", async () => {
    const baseFetcher = createOpenAICompatibleFetcher();
    const providerFetch: typeof fetch = async (request, init) => {
      const url = String(request);

      if (url.endsWith("/embeddings")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          input?: string;
        };
        return new Response(
          JSON.stringify({
            data: [
              {
                embedding: body.input?.includes("dimension query")
                  ? [1, 0]
                  : [1, 0, 0],
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Embedding dimension checks must fail explicitly.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    await expect(
      service.retrieveCards({
        limit: 1,
        query: "dimension query",
      }),
    ).rejects.toThrow("Embedding vector dimensions differ");
  });

  it("rejects provider updates without a complete secret-bearing payload", () => {
    const parsed = providerProfileSchema.safeParse({
      answerModel: "gpt-answer",
      baseUrl: "https://api.example.com/v1",
      embeddingModel: "text-embedding-3-small",
      kind: "openai",
      name: "OpenAI Main",
      rerankModel: "gpt-rerank",
      summarizeModel: "gpt-summary",
      visionModel: "gpt-vision",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid ask date ranges at the request contract boundary", () => {
    const parsed = askRequestSchema.safeParse({
      filters: {
        dateFrom: "2026-04-20T00:00:00.000Z",
        dateTo: "2026-04-10T00:00:00.000Z",
      },
      question: "What did I save?",
    });

    expect(parsed.success).toBe(false);
  });

  it("keeps memduck doctor read-only when runtime files do not exist", async () => {
    const { runDoctor } = await import("../scripts/cli");
    const doctorCwd = path.join(testRuntimeDir, "doctor-empty");
    let output = "";

    await mkdir(doctorCwd, { recursive: true });
    await runDoctor({
      cwd: doctorCwd,
      env: {},
      write: (message) => {
        output += message;
      },
    });

    await expect(stat(path.join(doctorCwd, ".env.local"))).rejects.toThrow();
    await expect(stat(path.join(doctorCwd, ".memduck"))).rejects.toThrow();
    expect(output).toContain(".env.local: missing");
    expect(output).toContain("runtime dir: missing");
  });
});
