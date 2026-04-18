import { Bot } from "grammy";

import { createMemduckHttpClient } from "../src/lib/channels/http-client";
import { parseTelegramMessage } from "../src/lib/channels/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required to run the Telegram bot.");
}

const baseUrl = process.env.MEMDUCK_BASE_URL ?? "http://127.0.0.1:3000";
const client = createMemduckHttpClient(baseUrl);
const bot = new Bot(token);

function formatMemoryReply(title: string, summary: string): string {
  return [`Saved to memduck`, ``, title, summary].join("\n");
}

function formatAskReply(answer: string, citations: string[]): string {
  const blocks = [answer];

  if (citations.length > 0) {
    blocks.push(
      "",
      "Sources:",
      ...citations.map((citation) => `- ${citation}`),
    );
  }

  return blocks.join("\n");
}

function formatReviewReply(
  cards: Array<{ summary: string; title: string }>,
): string {
  if (cards.length === 0) {
    return "Nothing is ready for review yet. Save a few links or notes first.";
  }

  return [
    "Review queue",
    "",
    ...cards.map(
      (card, index) => `${index + 1}. ${card.title}\n${card.summary}`,
    ),
  ].join("\n");
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    [
      "memduck is ready.",
      "Send me a link, text, or screenshot and I will push it through the same local API used by the web app.",
      "Use /ask <question> for grounded Q&A, or /review for your current review queue.",
    ].join("\n"),
  );
});

bot.on("message:text", async (ctx) => {
  const action = parseTelegramMessage({ text: ctx.message.text });

  if (action.kind === "review") {
    const cards = await client.review();
    await ctx.reply(formatReviewReply(cards.slice(0, 5)));
    return;
  }

  if (action.kind === "ask") {
    if (!action.question) {
      await ctx.reply(
        "Use /ask followed by the question you want memduck to answer.",
      );
      return;
    }

    const answer = await client.ask({ question: action.question });
    await ctx.reply(
      formatAskReply(
        answer.answer,
        answer.citations.map((citation) => citation.title),
      ),
    );
    return;
  }

  const result = await client.ingest(action.envelope);
  await ctx.reply(
    formatMemoryReply(result.memoryCard.title, result.memoryCard.summary),
  );
});

bot.on("message:photo", async (ctx) => {
  const photo = ctx.message.photo.at(-1);
  if (!photo) {
    await ctx.reply("I could not read that image. Try sending it again.");
    return;
  }

  const action = parseTelegramMessage({
    caption: ctx.message.caption,
    photoFileId: photo.file_id,
  });

  if (action.kind !== "ingest") {
    await ctx.reply("That image could not be turned into a memduck capture.");
    return;
  }

  const result = await client.ingest(action.envelope);
  await ctx.reply(
    formatMemoryReply(result.memoryCard.title, result.memoryCard.summary),
  );
});

bot.catch((error) => {
  console.error("Telegram bot error", error.error);
});

bot.start();
console.log(`memduck Telegram bot is running against ${baseUrl}`);
