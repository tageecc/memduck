import type { ProviderFailures } from "../memduck/types";

export interface MockProviderRegistry {
  answer(question: string, context: string[]): Promise<string>;
  summarize(input: string): Promise<string>;
  visionAnalyze(input: { mimeType: string; objectKey: string }): Promise<{
    extractedText: string;
    keyPoints: string[];
    summary: string;
  }>;
}

function maybeReject<T>(
  failure: string | undefined,
  factory: () => T,
): Promise<T> {
  if (failure) {
    return Promise.reject(new Error(failure));
  }

  return Promise.resolve(factory());
}

export function createMockProviderRegistry(
  failures: ProviderFailures = {},
): MockProviderRegistry {
  return {
    answer(question, context) {
      return maybeReject(failures.answer, () => {
        return `memory-grounded answer: ${question} :: ${context.join(" | ")}`;
      });
    },
    summarize(input) {
      return maybeReject(failures.summarize, () => {
        return `digest summary: ${input}`;
      });
    },
    visionAnalyze(input) {
      return maybeReject(failures.visionAnalyze, () => {
        return {
          extractedText: `OCR from ${input.objectKey}`,
          keyPoints: ["image digest", "visual evidence", "stored screenshot"],
          summary: `visual summary for ${input.objectKey}`,
        };
      });
    },
  };
}
