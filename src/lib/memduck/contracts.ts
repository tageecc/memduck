import { z } from "zod";

export const inputKindSchema = z.enum(["image", "text", "url"]);
export const sourceChannelSchema = z.enum(["extension", "telegram", "web"]);
export const requestedDepthSchema = z.enum(["deep", "quick", "save"]);

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

export type SignalRequest = z.infer<typeof signalRequestSchema>;
