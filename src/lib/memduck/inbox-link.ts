type InboxLinkInput = {
  query?: string;
  status?: string;
  topicId?: string;
};

export function buildInboxHref(input: InboxLinkInput = {}): string {
  const searchParams = new URLSearchParams();

  if (input.query?.trim()) {
    searchParams.set("q", input.query.trim());
  }

  if (input.status?.trim()) {
    searchParams.set("status", input.status.trim());
  }

  if (input.topicId?.trim()) {
    searchParams.set("topicId", input.topicId.trim());
  }

  const query = searchParams.toString();
  return query ? `/inbox?${query}` : "/inbox";
}
