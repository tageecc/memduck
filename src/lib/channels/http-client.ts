import type {
  AskRequest,
  AskResponse,
  IngestResult,
  InputEnvelope,
  MemoryCard,
  RetrievalResult,
  ReviewSections,
  SearchRequest,
} from "../memduck/service";

function joinApiUrl(baseUrl: string, pathname: string): string {
  return new URL(
    pathname,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `memduck request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function createMemduckHttpClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
) {
  return {
    async ask(request: AskRequest): Promise<AskResponse> {
      const response = await fetcher(joinApiUrl(baseUrl, "/api/ask"), {
        body: JSON.stringify(request),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return readJson<AskResponse>(response);
    },

    async analyzeMemoryCard(
      cardId: string,
      requestedDepth: "deep" | "quick",
    ): Promise<{ memoryCard: MemoryCard }> {
      const response = await fetcher(
        joinApiUrl(baseUrl, `/api/memory-cards/${cardId}/analyze`),
        {
          body: JSON.stringify({ requestedDepth }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );

      return readJson<{ memoryCard: MemoryCard }>(response);
    },

    async ingest(envelope: InputEnvelope): Promise<IngestResult> {
      const response = await fetcher(joinApiUrl(baseUrl, "/api/ingest"), {
        body: JSON.stringify(envelope),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return readJson<IngestResult>(response);
    },

    async listMemoryCards(): Promise<MemoryCard[]> {
      const response = await fetcher(joinApiUrl(baseUrl, "/api/memory-cards"));
      return readJson<MemoryCard[]>(response);
    },

    async review(): Promise<ReviewSections> {
      const response = await fetcher(joinApiUrl(baseUrl, "/api/review"));
      return readJson<ReviewSections>(response);
    },

    async search(request: SearchRequest): Promise<RetrievalResult> {
      const response = await fetcher(joinApiUrl(baseUrl, "/api/search"), {
        body: JSON.stringify(request),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return readJson<RetrievalResult>(response);
    },
  };
}
