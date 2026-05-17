import { z } from "zod";
import { channelCatalogIds, isChannelCatalogId } from "../channels/catalog";
import {
  getProviderCatalogEntry,
  providerCatalogIds,
} from "../providers/provider-presets";

export const inputKindSchema = z.enum(["image", "text", "url"]);
export const sourceChannelSchema = z.enum(channelCatalogIds);
export const requestedDepthSchema = z.enum(["deep", "quick", "save"]);
export const localePreferenceSchema = z.enum(["auto", "en", "ja", "zh"]);
export const themePreferenceSchema = z.enum(["warm", "clean", "dark"]);
export const providerKindSchema = z.enum([
  "anthropic",
  "gemini",
  "ollama",
  "openai",
  "openai-compatible",
]);

export const sourceContextSchema = z
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

const citationSchema = z.object({
  cardId: z.string().trim().min(1),
  chunkId: z.string().trim().min(1),
  endOffset: z.number().int().nonnegative(),
  quote: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  startOffset: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
});

export const conversationTurnSchema = z.object({
  assistant: z.object({
    citations: z.array(citationSchema).optional(),
    content: z.string().trim().min(1),
  }),
  conversationId: z.string().trim().min(1).optional(),
  user: z.object({
    content: z.string().trim().min(1),
  }),
});

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

function validateProviderSettings(
  value: { apiKey?: string; baseUrl?: string; providerId: string },
  context: z.RefinementCtx,
) {
  const entry = getProviderCatalogEntry(
    value.providerId as (typeof providerCatalogIds)[number],
  );

  if (entry.requiresApiKey && !value.apiKey?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "apiKey is required for this provider.",
      path: ["apiKey"],
    });
  }

  if (entry.configurableBaseUrl && !entry.baseUrl && !value.baseUrl?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "baseUrl is required for this provider.",
      path: ["baseUrl"],
    });
  }
}

const providerSettingsBaseFields = {
  apiKey: z.string().trim().optional(),
  baseUrl: z.string().trim().url().optional(),
  model: z.string().trim().min(1),
  providerId: z.enum(providerCatalogIds),
};

const providerSettingsBaseSchema = z
  .object(providerSettingsBaseFields)
  .strict()
  .superRefine((value, context) => {
    validateProviderSettings(value, context);
  });

export const providerSettingsSchema = providerSettingsBaseSchema;

const providerProfileFieldsSchema = {
  id: z.string().trim().min(1).optional(),
  makeActive: z.boolean().optional(),
  name: z.string().trim().min(1),
};

export const providerProfileSchema = z
  .object({
    ...providerSettingsBaseFields,
    ...providerProfileFieldsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateProviderSettings(value, context);
  });

export const providerProfileRequestSchema = providerProfileSchema;

export const channelSettingsEntrySchema = z
  .object({
    enabled: z.boolean(),
    values: z.record(z.string().trim().min(1), z.string()),
  })
  .strict();

const channelSettingsRecordSchema = z
  .record(z.string().trim().min(1), channelSettingsEntrySchema)
  .superRefine((value, context) => {
    for (const channelId of Object.keys(value)) {
      if (!isChannelCatalogId(channelId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported channel id: ${channelId}.`,
          path: [channelId],
        });
      }
    }
  });

export const channelSettingsSchema = z
  .object({
    channels: channelSettingsRecordSchema.optional(),
    extension: z
      .object({
        captureBaseUrl: z.string().trim().url(),
        enabled: z.boolean(),
      })
      .optional(),
    telegram: z
      .object({
        baseUrl: z.string().trim().url(),
        botToken: z.string().trim(),
        botUsername: z.string().trim().optional(),
        enabled: z.boolean(),
      })
      .optional(),
    web: z
      .object({
        enabled: z.boolean(),
      })
      .optional(),
  })
  .strict();

export const channelHeartbeatSchema = z
  .object({
    channel: z.enum(channelCatalogIds),
    metadata: z.record(z.string().trim().min(1), z.string()).default({}),
  })
  .refine((value) => value.channel !== "web", {
    message: "web is a local UI surface and does not accept channel heartbeat.",
    path: ["channel"],
  });

export const uiSettingsSchema = z
  .object({
    localePreference: localePreferenceSchema.optional(),
    themePreference: themePreferenceSchema.optional(),
  })
  .refine((value) => value.localePreference || value.themePreference, {
    message: "At least one UI setting is required.",
  });

export type SignalRequest = z.infer<typeof signalRequestSchema>;
