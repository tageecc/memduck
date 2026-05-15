import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET(request: Request) {
  const service = await getMemduckService();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  const cards = service.listMemoryCards();
  const topics = service.listTopics();
  const compiled = service.listCompiledTopics();

  if (format === "markdown") {
    const topicsById = new Map(topics.map((t) => [t.id, t]));
    const compiledById = new Map(compiled.map((c) => [c.topicId, c]));

    const lines: string[] = [
      "# memduck Memory Export",
      "",
      `> Exported ${new Date().toISOString()} · ${cards.length} cards · ${topics.length} topics`,
      "",
      "---",
      "",
    ];

    for (const card of cards) {
      lines.push(`## ${card.title}`);
      lines.push("");
      lines.push(
        `**Status:** ${card.status}  |  **Channel:** ${card.sourceChannel}  |  **Created:** ${card.createdAt}`,
      );
      lines.push("");

      if (card.summary) {
        lines.push("### Summary");
        lines.push(card.summary);
        lines.push("");
      }

      if (card.deepSummary) {
        lines.push("### Deep Summary");
        lines.push(card.deepSummary);
        lines.push("");
      }

      if (card.keyPoints.length > 0) {
        lines.push("### Key Points");
        for (const point of card.keyPoints) {
          lines.push(`- ${point}`);
        }
        lines.push("");
      }

      if (card.topicIds.length > 0) {
        const topicNames = card.topicIds
          .map((id) => topicsById.get(id)?.name)
          .filter(Boolean);
        if (topicNames.length > 0) {
          lines.push(`**Topics:** ${topicNames.join(", ")}`);
          lines.push("");
        }
      }

      lines.push("---");
      lines.push("");
    }

    if (topics.length > 0) {
      lines.push("# Topics");
      lines.push("");
      for (const topic of topics) {
        lines.push(`## ${topic.name}`);
        if (topic.keywords.length > 0) {
          lines.push(`*Keywords:* ${topic.keywords.join(", ")}`);
        }
        const ct = compiledById.get(topic.id);
        if (ct?.summary) {
          lines.push("");
          lines.push(ct.summary);
        }
        lines.push("");
      }
    }

    const content = lines.join("\n");
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(content, {
      headers: {
        "content-disposition": `attachment; filename="memduck-export-${date}.md"`,
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    cards,
    topics,
    compiledTopics: compiled,
    version: "1",
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="memduck-export-${date}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
