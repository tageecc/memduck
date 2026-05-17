import type { ProviderKind, ProviderSettings } from "../memduck/types";

export const providerCatalogIds = [
  "alibaba-model-studio",
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "arcee",
  "azure-speech",
  "byteplus",
  "byteplus-plan",
  "cerebras",
  "chutes",
  "cloudflare-ai-gateway",
  "claude-max-api-proxy",
  "comfyui",
  "copilot-proxy",
  "deepgram",
  "deepinfra",
  "deepseek",
  "ds4",
  "elevenlabs",
  "fal",
  "fireworks",
  "gemini",
  "github-copilot",
  "glm",
  "google",
  "google-gemini-cli",
  "google-vertex",
  "gradium",
  "groq",
  "huggingface",
  "inferrs",
  "inworld",
  "kilocode",
  "kimi",
  "litellm",
  "lmstudio",
  "minimax",
  "minimax-portal",
  "mistral",
  "moonshot",
  "nvidia",
  "ollama",
  "opencode",
  "opencode-go",
  "openai",
  "openai-codex",
  "openai-compatible",
  "openrouter",
  "perplexity",
  "qianfan",
  "qwen",
  "runway",
  "senseaudio",
  "sglang",
  "stepfun",
  "stepfun-plan",
  "synthetic",
  "tencent-tokenhub",
  "together",
  "venice",
  "vercel-ai-gateway",
  "vllm",
  "volcengine",
  "volcengine-plan",
  "vydra",
  "xai",
  "xiaomi",
  "zai",
  "custom",
] as const;

export type ProviderCatalogId = (typeof providerCatalogIds)[number];

export function isProviderCatalogId(
  value: string | undefined,
): value is ProviderCatalogId {
  return providerCatalogIds.includes(value as ProviderCatalogId);
}

export interface ProviderModelPreset {
  id: string;
  label: string;
}

export interface ProviderCapabilities {
  chat: boolean;
  embedding: boolean;
  rerank: boolean;
  vision: boolean;
}

export interface ProviderCatalogEntry {
  baseUrl: string;
  capabilities?: ProviderCapabilities;
  configurableBaseUrl: boolean;
  defaultModel: string;
  embeddingModel: string;
  id: ProviderCatalogId;
  label: string;
  models: ProviderModelPreset[];
  requiresApiKey: boolean;
  transportKind: ProviderKind;
}

export type CompleteProviderCatalogEntry = ProviderCatalogEntry & {
  capabilities: ProviderCapabilities;
};

export interface ProviderDraft {
  baseUrl: string;
  model: string;
  name: string;
  providerId: ProviderCatalogId;
}

export interface ProviderSettingsInput {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  providerId: ProviderCatalogId;
}

const openAIEmbeddingModel = "text-embedding-3-small";
const fullProviderCapabilities: ProviderCapabilities = {
  chat: true,
  embedding: true,
  rerank: true,
  vision: true,
};
const audioProviderCapabilities: ProviderCapabilities = {
  chat: false,
  embedding: false,
  rerank: false,
  vision: false,
};
const mediaProviderCapabilities: ProviderCapabilities = {
  chat: false,
  embedding: false,
  rerank: false,
  vision: true,
};

function openAICompatible(input: {
  baseUrl: string;
  capabilities?: ProviderCapabilities;
  defaultModel: string;
  embeddingModel?: string;
  id: ProviderCatalogId;
  label: string;
  models?: ProviderModelPreset[];
  requiresApiKey?: boolean;
}): ProviderCatalogEntry {
  const models = input.models ?? [
    { id: input.defaultModel, label: input.defaultModel },
    ...(input.defaultModel === "your-model-id"
      ? []
      : [{ id: "your-model-id", label: "Custom model id" }]),
  ];

  return {
    baseUrl: input.baseUrl,
    capabilities: input.capabilities ?? fullProviderCapabilities,
    configurableBaseUrl: input.id === "custom" || !input.baseUrl,
    defaultModel: input.defaultModel,
    embeddingModel: input.embeddingModel ?? openAIEmbeddingModel,
    id: input.id,
    label: input.label,
    models,
    requiresApiKey: input.requiresApiKey ?? true,
    transportKind: "openai-compatible",
  };
}

const providerCatalog = [
  openAICompatible({
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    embeddingModel: "text-embedding-v4",
    id: "alibaba-model-studio",
    label: "Alibaba Model Studio",
    models: [
      { id: "qwen-plus", label: "Qwen Plus" },
      { id: "qwen-max", label: "Qwen Max" },
    ],
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
    id: "amazon-bedrock",
    label: "Amazon Bedrock",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
    id: "amazon-bedrock-mantle",
    label: "Amazon Bedrock Mantle",
  }),
  {
    baseUrl: "https://api.anthropic.com",
    configurableBaseUrl: false,
    defaultModel: "claude-sonnet-4-20250514",
    embeddingModel: "claude-sonnet-4-20250514",
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
    ],
    requiresApiKey: true,
    transportKind: "anthropic",
  },
  {
    baseUrl: "https://api.anthropic.com",
    configurableBaseUrl: true,
    defaultModel: "claude-sonnet-4-20250514",
    embeddingModel: "claude-sonnet-4-20250514",
    id: "anthropic-vertex",
    label: "Anthropic Vertex",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
    ],
    requiresApiKey: true,
    transportKind: "anthropic",
  },
  openAICompatible({
    baseUrl: "https://conductor.arcee.ai/v1",
    defaultModel: "auto",
    id: "arcee",
    label: "Arcee AI",
  }),
  openAICompatible({
    baseUrl: "",
    capabilities: audioProviderCapabilities,
    defaultModel: "azure-speech",
    embeddingModel: "",
    id: "azure-speech",
    label: "Azure Speech",
  }),
  openAICompatible({
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    defaultModel: "seed-1-6",
    id: "byteplus",
    label: "BytePlus ModelArk",
  }),
  openAICompatible({
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    defaultModel: "ark-code-latest",
    id: "byteplus-plan",
    label: "BytePlus Coding Plan",
    models: [
      { id: "ark-code-latest", label: "ARK Code Latest" },
      { id: "doubao-seed-code", label: "Doubao Seed Code" },
      { id: "kimi-k2.5", label: "Kimi K2.5" },
      { id: "kimi-k2-thinking", label: "Kimi K2 Thinking" },
      { id: "glm-4.7", label: "GLM 4.7" },
    ],
  }),
  openAICompatible({
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "zai-glm-4.7",
    id: "cerebras",
    label: "Cerebras",
    models: [
      { id: "zai-glm-4.7", label: "ZAI GLM 4.7" },
      { id: "zai-glm-4.6", label: "ZAI GLM 4.6" },
    ],
  }),
  openAICompatible({
    baseUrl: "https://llm.chutes.ai/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3.1",
    id: "chutes",
    label: "Chutes",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
    id: "cloudflare-ai-gateway",
    label: "Cloudflare AI Gateway",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "claude-sonnet-4-20250514",
    id: "claude-max-api-proxy",
    label: "Claude Max API Proxy",
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:8188/v1",
    defaultModel: "comfyui",
    id: "comfyui",
    label: "ComfyUI",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "gpt-4.1",
    id: "copilot-proxy",
    label: "GitHub Copilot Proxy",
  }),
  openAICompatible({
    baseUrl: "https://api.deepgram.com/v1",
    capabilities: audioProviderCapabilities,
    defaultModel: "nova-3",
    embeddingModel: "",
    id: "deepgram",
    label: "Deepgram",
  }),
  openAICompatible({
    baseUrl: "https://api.deepinfra.com/v1/openai",
    defaultModel: "deepseek-ai/DeepSeek-V3.2",
    embeddingModel: "BAAI/bge-m3",
    id: "deepinfra",
    label: "DeepInfra",
    models: [
      { id: "deepseek-ai/DeepSeek-V3.2", label: "DeepSeek V3.2" },
      { id: "MiniMaxAI/MiniMax-M2.5", label: "MiniMax M2.5" },
      { id: "moonshotai/Kimi-K2.5", label: "Kimi K2.5" },
      { id: "zai-org/GLM-5.1", label: "GLM 5.1" },
    ],
  }),
  openAICompatible({
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    id: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:11435/v1",
    defaultModel: "deepseek-v4",
    id: "ds4",
    label: "ds4",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "https://api.elevenlabs.io/v1",
    capabilities: audioProviderCapabilities,
    defaultModel: "eleven_turbo_v2_5",
    embeddingModel: "",
    id: "elevenlabs",
    label: "ElevenLabs",
  }),
  openAICompatible({
    baseUrl: "https://fal.run/v1",
    capabilities: mediaProviderCapabilities,
    defaultModel: "fal-ai/flux/dev",
    embeddingModel: "",
    id: "fal",
    label: "Fal",
  }),
  openAICompatible({
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/deepseek-v3",
    id: "fireworks",
    label: "Fireworks",
  }),
  {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    configurableBaseUrl: false,
    defaultModel: "gemini-2.5-flash",
    embeddingModel: "text-embedding-004",
    id: "gemini",
    label: "Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    requiresApiKey: true,
    transportKind: "gemini",
  },
  openAICompatible({
    baseUrl: "",
    defaultModel: "gpt-4.1",
    id: "github-copilot",
    label: "GitHub Copilot",
  }),
  openAICompatible({
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.5",
    id: "glm",
    label: "GLM",
  }),
  {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    configurableBaseUrl: false,
    defaultModel: "gemini-3-flash-preview",
    embeddingModel: "text-embedding-004",
    id: "google",
    label: "Google Gemini",
    models: [
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    requiresApiKey: true,
    transportKind: "gemini",
  },
  {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    configurableBaseUrl: true,
    defaultModel: "gemini-2.5-flash",
    embeddingModel: "text-embedding-004",
    id: "google-gemini-cli",
    label: "Google Gemini CLI",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    requiresApiKey: true,
    transportKind: "gemini",
  },
  {
    baseUrl: "https://aiplatform.googleapis.com/v1",
    configurableBaseUrl: true,
    defaultModel: "gemini-3-flash-preview",
    embeddingModel: "text-embedding-004",
    id: "google-vertex",
    label: "Google Vertex",
    models: [
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    requiresApiKey: true,
    transportKind: "gemini",
  },
  openAICompatible({
    baseUrl: "",
    defaultModel: "gradium/default",
    id: "gradium",
    label: "Gradium",
  }),
  openAICompatible({
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    id: "groq",
    label: "Groq",
  }),
  openAICompatible({
    baseUrl: "https://router.huggingface.co/v1",
    defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
    id: "huggingface",
    label: "Hugging Face",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "inferrs/model",
    id: "inferrs",
    label: "Inferrs",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "inworld/default",
    id: "inworld",
    label: "Inworld",
  }),
  openAICompatible({
    baseUrl: "https://api.kilo.ai/api/gateway",
    defaultModel: "kilocode/default",
    id: "kilocode",
    label: "Kilo Code",
  }),
  openAICompatible({
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2-0711-preview",
    id: "kimi",
    label: "Kimi",
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:4000/v1",
    defaultModel: "gpt-4.1-mini",
    id: "litellm",
    label: "LiteLLM",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:1234/v1",
    defaultModel: "local-model",
    id: "lmstudio",
    label: "LM Studio",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M1",
    id: "minimax",
    label: "MiniMax",
  }),
  openAICompatible({
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M2.7",
    id: "minimax-portal",
    label: "MiniMax Portal",
    models: [
      { id: "MiniMax-M2.7", label: "MiniMax M2.7" },
      { id: "MiniMax-M2.7-highspeed", label: "MiniMax M2.7 Highspeed" },
    ],
  }),
  openAICompatible({
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    id: "mistral",
    label: "Mistral",
  }),
  openAICompatible({
    baseUrl: "https://api.moonshot.ai/v1",
    defaultModel: "moonshot-v1-8k",
    id: "moonshot",
    label: "Moonshot",
  }),
  openAICompatible({
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    id: "nvidia",
    label: "NVIDIA",
  }),
  {
    baseUrl: "http://127.0.0.1:11434/v1",
    configurableBaseUrl: true,
    defaultModel: "qwen2.5:7b-instruct",
    embeddingModel: "nomic-embed-text",
    id: "ollama",
    label: "Ollama",
    models: [
      { id: "qwen2.5:7b-instruct", label: "Qwen 2.5 7B" },
      { id: "llama3.3", label: "Llama 3.3" },
    ],
    requiresApiKey: false,
    transportKind: "ollama",
  },
  openAICompatible({
    baseUrl: "http://127.0.0.1:4096/v1",
    defaultModel: "opencode/default",
    id: "opencode",
    label: "OpenCode",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:4097/v1",
    defaultModel: "opencode-go/default",
    id: "opencode-go",
    label: "OpenCode Go",
    requiresApiKey: false,
  }),
  {
    baseUrl: "https://api.openai.com/v1",
    configurableBaseUrl: false,
    defaultModel: "gpt-4.1-mini",
    embeddingModel: openAIEmbeddingModel,
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
    ],
    requiresApiKey: true,
    transportKind: "openai",
  },
  {
    baseUrl: "https://chatgpt.com/backend-api",
    configurableBaseUrl: false,
    defaultModel: "gpt-5.4",
    embeddingModel: openAIEmbeddingModel,
    id: "openai-codex",
    label: "OpenAI Codex",
    models: [
      { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gpt-5.4-pro", label: "GPT-5.4 Pro" },
      { id: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" },
    ],
    requiresApiKey: true,
    transportKind: "openai",
  },
  openAICompatible({
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    id: "openai-compatible",
    label: "OpenAI-compatible",
    models: [
      { id: "gpt-4.1-mini", label: "GPT-compatible" },
      { id: "qwen-plus", label: "Qwen Plus" },
      { id: "deepseek-chat", label: "DeepSeek Chat" },
    ],
  }),
  openAICompatible({
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4.1-mini",
    id: "openrouter",
    label: "OpenRouter",
  }),
  openAICompatible({
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    id: "perplexity",
    label: "Perplexity",
  }),
  openAICompatible({
    baseUrl: "https://qianfan.baidubce.com/v2",
    defaultModel: "ernie-4.5-turbo-128k",
    id: "qianfan",
    label: "Qianfan",
  }),
  openAICompatible({
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    embeddingModel: "text-embedding-v4",
    id: "qwen",
    label: "Qwen",
  }),
  openAICompatible({
    baseUrl: "https://api.dev.runwayml.com/v1",
    capabilities: mediaProviderCapabilities,
    defaultModel: "gen4_turbo",
    embeddingModel: "",
    id: "runway",
    label: "Runway",
  }),
  openAICompatible({
    baseUrl: "https://api.senseaudio.cn/v1",
    capabilities: audioProviderCapabilities,
    defaultModel: "senseaudio-asr-pro-1.5-260319",
    embeddingModel: "",
    id: "senseaudio",
    label: "SenseAudio",
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:30000/v1",
    defaultModel: "local-model",
    id: "sglang",
    label: "SGLang",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-2-mini",
    id: "stepfun",
    label: "StepFun",
  }),
  openAICompatible({
    baseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-3.5-flash-2603",
    id: "stepfun-plan",
    label: "StepFun Plan",
    models: [
      { id: "step-3.5-flash-2603", label: "Step 3.5 Flash 2603" },
      { id: "step-3.5-flash", label: "Step 3.5 Flash" },
    ],
  }),
  {
    baseUrl: "",
    configurableBaseUrl: true,
    defaultModel: "claude-sonnet-4-20250514",
    embeddingModel: "claude-sonnet-4-20250514",
    id: "synthetic",
    label: "Synthetic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
    ],
    requiresApiKey: true,
    transportKind: "anthropic",
  },
  openAICompatible({
    baseUrl: "",
    defaultModel: "hunyuan-turbos-latest",
    id: "tencent-tokenhub",
    label: "Tencent TokenHub",
  }),
  openAICompatible({
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    id: "together",
    label: "Together",
  }),
  openAICompatible({
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "llama-3.3-70b",
    id: "venice",
    label: "Venice",
  }),
  openAICompatible({
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    defaultModel: "openai/gpt-4.1-mini",
    id: "vercel-ai-gateway",
    label: "Vercel AI Gateway",
  }),
  openAICompatible({
    baseUrl: "http://127.0.0.1:8000/v1",
    defaultModel: "local-model",
    id: "vllm",
    label: "vLLM",
    requiresApiKey: false,
  }),
  openAICompatible({
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6",
    id: "volcengine",
    label: "Volcengine",
  }),
  openAICompatible({
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "ark-code-latest",
    id: "volcengine-plan",
    label: "Volcengine Coding Plan",
    models: [
      { id: "ark-code-latest", label: "ARK Code Latest" },
      { id: "doubao-seed-code", label: "Doubao Seed Code" },
      { id: "kimi-k2.5", label: "Kimi K2.5" },
      { id: "kimi-k2-thinking", label: "Kimi K2 Thinking" },
      { id: "glm-4.7", label: "GLM 4.7" },
    ],
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "vydra/default",
    id: "vydra",
    label: "Vydra",
  }),
  openAICompatible({
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4",
    id: "xai",
    label: "xAI",
  }),
  openAICompatible({
    baseUrl: "https://api.xiaomi.com/v1",
    defaultModel: "mi-llm",
    id: "xiaomi",
    label: "Xiaomi",
  }),
  openAICompatible({
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.5",
    id: "zai",
    label: "Z.ai",
  }),
  openAICompatible({
    baseUrl: "",
    defaultModel: "your-model-id",
    id: "custom",
    label: "Custom",
  }),
] satisfies ProviderCatalogEntry[];

function completeProviderCatalogEntry(
  entry: ProviderCatalogEntry,
): CompleteProviderCatalogEntry {
  return {
    ...entry,
    capabilities: entry.capabilities ?? fullProviderCapabilities,
    models: entry.models.map((model) => ({ ...model })),
  };
}

export function listProviderCatalog(): CompleteProviderCatalogEntry[] {
  return providerCatalog.map((entry) => ({
    ...completeProviderCatalogEntry(entry),
  }));
}

export function getProviderCatalogEntry(
  providerId: ProviderCatalogId,
): CompleteProviderCatalogEntry {
  const entry = providerCatalog.find((provider) => provider.id === providerId);

  if (!entry) {
    throw new Error(`Unsupported provider id: ${providerId}`);
  }

  return completeProviderCatalogEntry(entry);
}

export function defaultsForProvider(
  providerId: ProviderCatalogId,
  model?: string,
): Omit<ProviderSettings, "apiKey"> {
  const entry = getProviderCatalogEntry(providerId);
  const primaryModel = model?.trim() || entry.defaultModel;
  return {
    answerModel: primaryModel,
    baseUrl: entry.baseUrl,
    embeddingModel: entry.embeddingModel,
    kind: entry.transportKind,
    model: primaryModel,
    providerId: entry.id,
    rerankModel: primaryModel,
    summarizeModel: primaryModel,
    visionModel: primaryModel,
  };
}

export function labelForProvider(providerId: ProviderCatalogId) {
  return getProviderCatalogEntry(providerId).label;
}

export function buildProviderSettings(
  input: ProviderSettingsInput,
): ProviderSettings {
  const defaults = defaultsForProvider(input.providerId, input.model);
  const entry = getProviderCatalogEntry(input.providerId);

  if (!entry.capabilities.embedding || !defaults.embeddingModel.trim()) {
    throw new Error(
      `Provider ${input.providerId} does not provide an embedding model for memduck retrieval.`,
    );
  }

  return {
    ...defaults,
    apiKey: input.apiKey?.trim() ?? "",
    baseUrl: input.baseUrl?.trim() || defaults.baseUrl,
  };
}

export function createProviderDraft(
  providerId: ProviderCatalogId,
): ProviderDraft {
  const defaults = defaultsForProvider(providerId);
  return {
    baseUrl: defaults.baseUrl,
    model: defaults.model,
    name: `${labelForProvider(providerId)} Provider`,
    providerId,
  };
}
