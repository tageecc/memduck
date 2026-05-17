export function shouldDigestText(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 280 ||
    /^(保存|记住|消化)/u.test(trimmed) ||
    /^(digest|save|remember)\b/i.test(trimmed)
  );
}
