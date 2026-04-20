import type { ProviderFailures } from "../memduck/types";
import type { ProviderRuntime } from "./provider-runtime";

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
): ProviderRuntime {
  return {
    answer(question, context) {
      return maybeReject(failures.answer, () => {
        return `memory-grounded answer: ${question} :: ${context.join(" | ")}`;
      });
    },
    embed(input) {
      return maybeReject(failures.answer, () => {
        const normalized = input.toLowerCase();
        const retrievalScore = normalized.includes("retrieval") ? 0.98 : 0.12;
        const spacingScore = normalized.includes("spaced") ? 0.96 : 0.08;
        const designScore = normalized.includes("design") ? 0.94 : 0.06;
        return [retrievalScore, spacingScore, designScore];
      });
    },
    rerank(question, candidates) {
      return maybeReject(failures.answer, () => {
        const tokens = question.toLowerCase().split(/\W+/).filter(Boolean);
        return candidates
          .map((candidate) => ({
            id: candidate.id,
            score: tokens.reduce((score, token) => {
              return candidate.text.toLowerCase().includes(token)
                ? score + 1
                : score;
            }, 0),
          }))
          .sort((left, right) => right.score - left.score);
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
