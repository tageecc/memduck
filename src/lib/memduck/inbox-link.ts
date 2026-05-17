type InboxLinkInput = {
  topicId?: string;
};

export function buildInboxHref(input: InboxLinkInput = {}): string {
  const searchParams = new URLSearchParams();

  if (input.topicId?.trim()) {
    searchParams.set("topicId", input.topicId.trim());
  }

  const query = searchParams.toString();
  return query ? `/inbox?${query}` : "/inbox";
}
