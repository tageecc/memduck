interface AskLinkInput {
  cardId?: string;
  cardIds?: string[];
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

  for (const cardId of input.cardIds ?? []) {
    const normalizedCardId = cardId.trim();
    if (normalizedCardId) {
      searchParams.append("cardId", normalizedCardId);
    }
  }

  if (input.cardId?.trim()) {
    searchParams.set("cardId", input.cardId.trim());
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/ask?${query}` : "/ask";
}
