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

type TelegramFollowUpAction = {
  kind: "follow_up";
  question: string;
};

type TelegramSearchAction = {
  kind: "search";
  query: string;
};

type TelegramRecentAction = {
  kind: "recent";
};

type TelegramReviewAction = {
  kind: "review";
};

type TelegramAnalyzeLastAction = {
  kind: "analyze_last";
  requestedDepth: "deep" | "quick";
};

export type TelegramAction =
  | TelegramAskAction
  | TelegramAnalyzeLastAction
  | TelegramFollowUpAction
  | TelegramIngestAction
  | TelegramRecentAction
  | TelegramReviewAction
  | TelegramSearchAction;

function buildIngestFromText(
  text: string,
  requestedDepth: RequestedDepth,
): TelegramIngestAction {
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
    },
    kind: "ingest",
  };
}

function parseDepthCommand(text: string): {
  remainder: string;
  requestedDepth: RequestedDepth;
} | null {
  const match = text.match(/^\/(save|quick|deep)\s*(.*)$/i);

  if (!match) {
    return null;
  }

  const command = match[1];

  if (!command) {
    return null;
  }

  return {
    remainder: cleanText(match[2] ?? ""),
    requestedDepth: command.toLowerCase() as RequestedDepth,
  };
}

export function parseTelegramMessage(
  input: TelegramMessageInput,
): TelegramAction {
  const requestedDepth = input.requestedDepth ?? "quick";
  const text = cleanText(input.text ?? "");
  const caption = cleanText(input.caption ?? "");
  const captionDepth = parseDepthCommand(caption);

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
        requestedDepth: captionDepth?.requestedDepth ?? requestedDepth,
        sourceChannel: "telegram",
        sourceContext: {
          caption: captionDepth?.remainder || caption || undefined,
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

  if (text.startsWith("/follow")) {
    return {
      kind: "follow_up",
      question: cleanText(text.replace(/^\/follow\s*/i, "")),
    };
  }

  if (text.startsWith("/search")) {
    return {
      kind: "search",
      query: cleanText(text.replace(/^\/search\s*/i, "")),
    };
  }

  if (text.startsWith("/recent")) {
    return { kind: "recent" };
  }

  const depthCommand = parseDepthCommand(text);

  if (depthCommand) {
    if (
      !depthCommand.remainder &&
      (depthCommand.requestedDepth === "quick" ||
        depthCommand.requestedDepth === "deep")
    ) {
      return {
        kind: "analyze_last",
        requestedDepth: depthCommand.requestedDepth,
      };
    }

    return buildIngestFromText(
      depthCommand.remainder,
      depthCommand.requestedDepth,
    );
  }

  return {
    envelope: {
      ...buildIngestFromText(text, requestedDepth).envelope,
      sourceContext: {
        caption: caption || undefined,
      },
    },
    kind: "ingest",
  };
}
