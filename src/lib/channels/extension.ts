import type { InputEnvelope, RequestedDepth } from "../memduck/service";
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
