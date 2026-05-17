import type { Citation } from "./types";

export function buildCitationHref(
  citation: Pick<Citation, "cardId" | "chunkId">,
) {
  return `/memory/${encodeURIComponent(citation.cardId)}#${encodeURIComponent(
    citation.chunkId,
  )}`;
}
