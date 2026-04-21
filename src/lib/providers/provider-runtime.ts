export interface ProviderRuntime {
  answer(question: string, context: string[]): Promise<string>;
  complete(
    instruction: string,
    context: string[],
    options?: {
      capability?: "answer" | "summarize";
    },
  ): Promise<string>;
  embed(input: string): Promise<number[]>;
  rerank(
    question: string,
    candidates: Array<{ id: string; text: string }>,
  ): Promise<Array<{ id: string; score: number }>>;
  summarize(input: string): Promise<string>;
  visionAnalyze(input: { mimeType: string; objectKey: string }): Promise<{
    extractedText: string;
    keyPoints: string[];
    summary: string;
  }>;
}
