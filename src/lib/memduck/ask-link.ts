interface AskLinkInput {
  cardId?: string;
  question?: string;
  topicId?: string;
}

export function buildAskHref(input: AskLinkInput): string {
  const searchParams = new URLSearchParams();

  if (input.question?.trim()) {
    searchParams.set("q", input.question.trim());
  }

  if (input.topicId?.trim()) {
    searchParams.set("topicId", input.topicId.trim());
  }

  if (input.cardId?.trim()) {
    searchParams.set("cardId", input.cardId.trim());
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/ask?${query}` : "/ask";
}
