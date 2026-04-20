import type {
  ChannelConnectionStatus,
  InputEnvelope,
  RequestedDepth,
} from "../memduck/service";
import { cleanText } from "../memduck/utils";

interface BuildExtensionEnvelopeOptions {
  mode: RequestedDepth;
  note?: string;
  pageTitle?: string;
  pageUrl: string;
  selectionText?: string;
  useSelectionAsText?: boolean;
}

export function buildExtensionEnvelope(
  options: BuildExtensionEnvelopeOptions,
): InputEnvelope {
  const note = cleanText(options.note ?? "");
  const pageTitle = cleanText(options.pageTitle ?? "");
  const selectionText = cleanText(options.selectionText ?? "");

  if (options.useSelectionAsText && selectionText) {
    return {
      kind: "text",
      payload: { text: selectionText },
      requestedDepth: options.mode,
      sourceChannel: "extension",
      sourceContext: {
        caption: note || undefined,
        pageTitle: pageTitle || undefined,
      },
    };
  }

  return {
    kind: "url",
    payload: { url: cleanText(options.pageUrl) },
    requestedDepth: options.mode,
    sourceChannel: "extension",
    sourceContext: {
      caption: note || undefined,
      pageTitle: pageTitle || undefined,
    },
  };
}

export function getExtensionConnectionStatus(
  status: ChannelConnectionStatus | null,
  now: Date,
) {
  if (!status) {
    return {
      connected: false,
      label: "Not connected yet",
      staleMinutes: null,
    };
  }

  const staleMinutes = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(status.lastHeartbeatAt).getTime()) / 60000,
    ),
  );

  if (staleMinutes <= 5) {
    return {
      connected: true,
      label: `Connected ${staleMinutes}m ago`,
      staleMinutes,
    };
  }

  return {
    connected: false,
    label: `Last seen ${staleMinutes}m ago`,
    staleMinutes,
  };
}
