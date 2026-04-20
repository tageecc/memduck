import type { ProviderKind } from "../memduck/types";

export interface ProviderDraft {
  answerModel: string;
  baseUrl: string;
  embeddingModel: string;
  name: string;
  rerankModel: string;
  summarizeModel: string;
  visionModel: string;
}

export function defaultsForProviderKind(
  kind: ProviderKind,
): Omit<ProviderDraft, "name"> {
  if (kind === "openai") {
    return {
      answerModel: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      rerankModel: "gpt-4.1-mini",
      summarizeModel: "gpt-4.1-mini",
      visionModel: "gpt-4.1-mini",
    };
  }

  if (kind === "anthropic") {
    return {
      answerModel: "claude-sonnet-4-20250514",
      baseUrl: "https://api.anthropic.com",
      embeddingModel: "claude-sonnet-4-20250514",
      rerankModel: "claude-sonnet-4-20250514",
      summarizeModel: "claude-sonnet-4-20250514",
      visionModel: "claude-sonnet-4-20250514",
    };
  }

  if (kind === "gemini") {
    return {
      answerModel: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      embeddingModel: "text-embedding-004",
      rerankModel: "gemini-2.5-flash",
      summarizeModel: "gemini-2.5-flash",
      visionModel: "gemini-2.5-flash",
    };
  }

  if (kind === "ollama") {
    return {
      answerModel: "qwen2.5:7b-instruct",
      baseUrl: "http://127.0.0.1:11434/v1",
      embeddingModel: "nomic-embed-text",
      rerankModel: "qwen2.5:7b-instruct",
      summarizeModel: "qwen2.5:7b-instruct",
      visionModel: "llava:7b",
    };
  }

  return {
    answerModel: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    embeddingModel: "text-embedding-3-small",
    rerankModel: "gpt-4.1-mini",
    summarizeModel: "gpt-4.1-mini",
    visionModel: "gpt-4.1-mini",
  };
}

export function labelForProviderKind(kind: ProviderKind) {
  switch (kind) {
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    case "ollama":
      return "Ollama";
    case "openai":
      return "OpenAI";
    case "openai-compatible":
      return "OpenAI-compatible";
    default:
      return "Mock / Demo";
  }
}

export function createProviderDraft(kind: ProviderKind): ProviderDraft {
  const defaults = defaultsForProviderKind(kind === "mock" ? "openai" : kind);
  return {
    ...defaults,
    name: `${labelForProviderKind(kind)} Provider`,
  };
}
