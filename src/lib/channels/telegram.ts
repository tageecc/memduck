import type { InputEnvelope, RequestedDepth } from "../memduck/service";
import { cleanText } from "../memduck/utils";

const urlPattern = /^https?:\/\/\S+$/i;

interface TelegramMessageInput {
  caption?: string;
  photoFileId?: string;
  photoMimeType?: string;
  requestedDepth?: RequestedDepth;
  text?: string;
}

type TelegramIngestAction = {
  envelope: InputEnvelope;
  kind: "ingest";
};

type TelegramAskAction = {
  kind: "ask";
  question: string;
};

type TelegramReviewAction = {
  kind: "review";
};

export type TelegramAction =
  | TelegramAskAction
  | TelegramIngestAction
  | TelegramReviewAction;

export function parseTelegramMessage(
  input: TelegramMessageInput,
): TelegramAction {
  const requestedDepth = input.requestedDepth ?? "quick";
  const text = cleanText(input.text ?? "");
  const caption = cleanText(input.caption ?? "");

  if (input.photoFileId) {
    const extension = input.photoMimeType === "image/png" ? "png" : "jpg";
    return {
      envelope: {
        kind: "image",
        payload: {
          fileName: `telegram-${input.photoFileId}.${extension}`,
          mimeType: input.photoMimeType ?? "image/jpeg",
          objectKey: `telegram/${input.photoFileId}.${extension}`,
        },
        requestedDepth,
        sourceChannel: "telegram",
        sourceContext: {
          caption: caption || undefined,
        },
      },
      kind: "ingest",
    };
  }

  if (text.startsWith("/review")) {
    return { kind: "review" };
  }

  if (text.startsWith("/ask")) {
    const question = cleanText(text.replace(/^\/ask\s*/i, ""));
    return {
      kind: "ask",
      question,
    };
  }

  if (urlPattern.test(text)) {
    return {
      envelope: {
        kind: "url",
        payload: { url: text },
        requestedDepth,
        sourceChannel: "telegram",
      },
      kind: "ingest",
    };
  }

  return {
    envelope: {
      kind: "text",
      payload: { text },
      requestedDepth,
      sourceChannel: "telegram",
      sourceContext: {
        caption: caption || undefined,
      },
    },
    kind: "ingest",
  };
}
