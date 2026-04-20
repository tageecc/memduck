export interface ProviderRuntime {
  answer(question: string, context: string[]): Promise<string>;
  summarize(input: string): Promise<string>;
  visionAnalyze(input: { mimeType: string; objectKey: string }): Promise<{
    extractedText: string;
    keyPoints: string[];
    summary: string;
  }>;
}
