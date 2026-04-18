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
