const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(value: string): string {
  return cleanText(value)
    .split(" ")
    .map((part) =>
      part
        ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`
        : part,
    )
    .join(" ");
}

export function tokenize(...inputs: string[]): string[] {
  return inputs
    .flatMap((input) =>
      cleanText(input)
        .toLowerCase()
        .replace(/-/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/),
    )
    .filter((token) => token && !STOP_WORDS.has(token));
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function takeTop<T>(values: T[], count: number): T[] {
  return values.slice(0, Math.max(0, count));
}

export function chunkText(
  value: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): Array<{
  endOffset: number;
  startOffset: number;
  text: string;
}> {
  const normalized = cleanText(value);

  if (!normalized) {
    return [];
  }

  const maxChars = options.maxChars ?? 520;
  const overlapChars = options.overlapChars ?? 80;
  const chunks: Array<{
    endOffset: number;
    startOffset: number;
    text: string;
  }> = [];
  let startOffset = 0;

  while (startOffset < normalized.length) {
    let endOffset = Math.min(normalized.length, startOffset + maxChars);

    if (endOffset < normalized.length) {
      const lastWhitespace = normalized.lastIndexOf(" ", endOffset);
      if (lastWhitespace > startOffset + Math.floor(maxChars * 0.6)) {
        endOffset = lastWhitespace;
      }
    }

    const text = cleanText(normalized.slice(startOffset, endOffset));
    if (text) {
      const leadingWhitespace =
        normalized.slice(startOffset, endOffset).search(/\S/) || 0;
      const effectiveStart = startOffset + Math.max(0, leadingWhitespace);
      const effectiveEnd = effectiveStart + text.length;

      chunks.push({
        endOffset: effectiveEnd,
        startOffset: effectiveStart,
        text,
      });
    }

    if (endOffset >= normalized.length) {
      break;
    }

    startOffset = Math.max(endOffset - overlapChars, startOffset + 1);
  }

  return chunks;
}
