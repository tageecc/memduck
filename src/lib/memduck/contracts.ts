import { z } from "zod";

export const inputKindSchema = z.enum(["image", "text", "url"]);
export const sourceChannelSchema = z.enum(["extension", "telegram", "web"]);
export const requestedDepthSchema = z.enum(["deep", "quick", "save"]);
export const localePreferenceSchema = z.enum(["auto", "en", "ja", "zh"]);
export const providerKindSchema = z.enum([
  "anthropic",
  "gemini",
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

const retrievalFiltersSchema = z
  .object({
    cardIds: z.array(z.string().trim().min(1)).min(1).optional(),
    dateFrom: z.string().trim().datetime().optional(),
    dateTo: z.string().trim().datetime().optional(),
    sourceChannels: z.array(sourceChannelSchema).min(1).optional(),
    topicIds: z.array(z.string().trim().min(1)).min(1).optional(),
  })
  .optional();

function validateDateRange(
  value: { filters?: { dateFrom?: string; dateTo?: string } },
  context: z.RefinementCtx,
) {
  if (!value.filters?.dateFrom || !value.filters.dateTo) {
    return;
  }

  const dateFrom = new Date(value.filters.dateFrom).getTime();
  const dateTo = new Date(value.filters.dateTo).getTime();

  if (dateFrom > dateTo) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom must be earlier than or equal to dateTo.",
      path: ["filters", "dateFrom"],
    });
  }
}

export const askRequestSchema = z
  .object({
    conversationId: z.string().trim().min(1).optional(),
    filters: retrievalFiltersSchema,
    question: z.string().trim().min(1),
  })
  .superRefine(validateDateRange);

export const searchRequestSchema = z
  .object({
    filters: retrievalFiltersSchema,
    limit: z.number().int().min(1).max(10).optional(),
    query: z.string().trim().min(1),
  })
  .superRefine(validateDateRange);

export const topicUpdateSchema = z.object({
  keywords: z.array(z.string().trim().min(1)).min(1),
  name: z.string().trim().min(1),
});

export const topicMergeSchema = z.object({
  targetTopicId: z.string().trim().min(1),
});

export const topicLinkRemoveSchema = z.object({
  cardId: z.string().trim().min(1),
});

export const providerProfileIdSchema = z.object({
  id: z.string().trim().min(1),
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

const providerModelFieldsSchema = z.object({
  answerModel: z.string().trim().min(1),
  embeddingModel: z.string().trim().min(1),
  rerankModel: z.string().trim().min(1),
  summarizeModel: z.string().trim().min(1),
  visionModel: z.string().trim().min(1),
});

const openAIProviderSettingsSchema = providerModelFieldsSchema.extend({
  apiKey: z.string().trim().min(1),
  baseUrl: z.string().trim().url(),
  kind: z.literal("openai"),
});

const openAICompatibleProviderSettingsSchema = providerModelFieldsSchema.extend(
  {
    apiKey: z.string().trim().min(1),
    baseUrl: z.string().trim().url(),
    kind: z.literal("openai-compatible"),
  },
);

const anthropicProviderSettingsSchema = providerModelFieldsSchema.extend({
  apiKey: z.string().trim().min(1),
  baseUrl: z.string().trim().url(),
  kind: z.literal("anthropic"),
});

const geminiProviderSettingsSchema = providerModelFieldsSchema.extend({
  apiKey: z.string().trim().min(1),
  baseUrl: z.string().trim().url(),
  kind: z.literal("gemini"),
});

const ollamaProviderSettingsSchema = providerModelFieldsSchema.extend({
  apiKey: z.string().trim().optional(),
  baseUrl: z.string().trim().url(),
  kind: z.literal("ollama"),
});

export const providerSettingsSchema = z.discriminatedUnion("kind", [
  anthropicProviderSettingsSchema,
  geminiProviderSettingsSchema,
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

export const channelHeartbeatSchema = z.object({
  channel: z.enum(["extension", "telegram"]),
  metadata: z.record(z.string().trim().min(1), z.string()).default({}),
});

export const uiSettingsSchema = z.object({
  localePreference: localePreferenceSchema,
});

export type SignalRequest = z.infer<typeof signalRequestSchema>;
