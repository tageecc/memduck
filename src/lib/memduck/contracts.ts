import { z } from "zod";

export const inputKindSchema = z.enum(["image", "text", "url"]);
export const sourceChannelSchema = z.enum(["extension", "telegram", "web"]);
export const requestedDepthSchema = z.enum(["deep", "quick", "save"]);
export const providerKindSchema = z.enum([
  "anthropic",
  "gemini",
  "mock",
  "ollama",
  "openai",
  "openai-compatible",
]);

const sourceContextSchema = z
  .object({
    caption: z.string().trim().min(1).optional(),
    pageTitle: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  .optional();

const urlEnvelopeSchema = z.object({
  kind: z.literal("url"),
  payload: z.object({
    url: z.string().trim().url(),
  }),
  requestedDepth: requestedDepthSchema,
  sourceChannel: sourceChannelSchema,
  sourceContext: sourceContextSchema,
});

const textEnvelopeSchema = z.object({
  kind: z.literal("text"),
  payload: z.object({
    text: z.string().trim().min(1),
  }),
  requestedDepth: requestedDepthSchema,
  sourceChannel: sourceChannelSchema,
  sourceContext: sourceContextSchema,
});

const imageEnvelopeSchema = z.object({
  kind: z.literal("image"),
  payload: z.object({
    fileName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    objectKey: z.string().trim().min(1),
  }),
  requestedDepth: requestedDepthSchema,
  sourceChannel: sourceChannelSchema,
  sourceContext: sourceContextSchema,
});

export const inputEnvelopeSchema = z.discriminatedUnion("kind", [
  urlEnvelopeSchema,
  textEnvelopeSchema,
  imageEnvelopeSchema,
]);

export const askRequestSchema = z.object({
  conversationId: z.string().trim().min(1).optional(),
  filters: z
    .object({
      sourceChannels: z.array(sourceChannelSchema).min(1).optional(),
      topicIds: z.array(z.string().trim().min(1)).min(1).optional(),
    })
    .optional(),
  question: z.string().trim().min(1),
});

export const signalRequestSchema = z.object({
  cardId: z.string().trim().min(1),
  topicId: z.string().trim().min(1).optional(),
  type: z.enum([
    "ask",
    "follow_up",
    "highlight",
    "review_request",
    "save",
    "star",
    "view",
  ]),
});

const mockProviderSettingsSchema = z.object({
  kind: z.literal("mock"),
});

const providerModelFieldsSchema = z.object({
  answerModel: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
  summarizeModel: z.string().trim().min(1),
  visionModel: z.string().trim().optional(),
});

const openAIProviderSettingsSchema = providerModelFieldsSchema.extend({
  baseUrl: z.string().trim().url().optional(),
  kind: z.literal("openai"),
});

const openAICompatibleProviderSettingsSchema = providerModelFieldsSchema.extend(
  {
    baseUrl: z.string().trim().url(),
    kind: z.literal("openai-compatible"),
  },
);

const anthropicProviderSettingsSchema = providerModelFieldsSchema.extend({
  baseUrl: z.string().trim().url().optional(),
  kind: z.literal("anthropic"),
});

const geminiProviderSettingsSchema = providerModelFieldsSchema.extend({
  baseUrl: z.string().trim().url().optional(),
  kind: z.literal("gemini"),
});

const ollamaProviderSettingsSchema = providerModelFieldsSchema.extend({
  baseUrl: z.string().trim().url().optional(),
  kind: z.literal("ollama"),
});

export const providerSettingsSchema = z.discriminatedUnion("kind", [
  anthropicProviderSettingsSchema,
  geminiProviderSettingsSchema,
  mockProviderSettingsSchema,
  ollamaProviderSettingsSchema,
  openAIProviderSettingsSchema,
  openAICompatibleProviderSettingsSchema,
]);

export const providerProfileSchema = providerSettingsSchema.and(
  z.object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
  }),
);

export const channelSettingsSchema = z.object({
  extension: z.object({
    captureBaseUrl: z.string().trim().url(),
    enabled: z.boolean(),
  }),
  telegram: z.object({
    baseUrl: z.string().trim().url(),
    botToken: z.string().trim().optional(),
    botUsername: z.string().trim().optional(),
    enabled: z.boolean(),
  }),
  web: z.object({
    enabled: z.boolean(),
  }),
});

export type SignalRequest = z.infer<typeof signalRequestSchema>;
