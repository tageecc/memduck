import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function fetchUrlContent(
  fetcher: typeof fetch,
  url: string,
): Promise<{
  extractedText: string;
  finalUrl: string;
  html: string;
  pageTitle?: string;
}> {
  const response = await fetcher(url, {
    headers: {
      "user-agent": "memduck/0.1 (+https://github.com/tageecc/memduck)",
    },
  });

  if (!response.ok) {
    throw new Error(`URL fetch failed with ${response.status}`);
  }

  const html = await response.text();
  const finalUrl = response.url || url;
  const dom = new JSDOM(html, { url: finalUrl });
  const readability = new Readability(dom.window.document);
  const article = readability.parse();
  const extractedText = collapseWhitespace(article?.textContent ?? "");

  if (!article || !extractedText) {
    throw new Error("URL readability extraction failed.");
  }

  return {
    extractedText,
    finalUrl,
    html,
    pageTitle: article?.title ?? dom.window.document.title ?? undefined,
  };
}
