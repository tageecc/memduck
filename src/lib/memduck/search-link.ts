type SearchLinkInput = {
  query?: string;
};

export function buildSearchHref(input: SearchLinkInput = {}): string {
  const searchParams = new URLSearchParams();

  if (input.query?.trim()) {
    searchParams.set("q", input.query.trim());
  }

  const query = searchParams.toString();
  return query ? `/search?${query}` : "/search";
}
