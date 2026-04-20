import { Bot } from "grammy";

import { createMemduckHttpClient } from "../src/lib/channels/http-client";
import { parseTelegramMessage } from "../src/lib/channels/telegram";
import { resolveTelegramRuntimeConfig } from "../src/lib/channels/telegram-runtime";
import { getRuntimeDir } from "../src/lib/memduck/runtime-path";
import { createMemduckService } from "../src/lib/memduck/service";
import {
  createAssetStore,
  downloadTelegramPhotoToAssetStore,
} from "../src/lib/storage/assets";

const runtimeDir = getRuntimeDir();
const service = createMemduckService({ runtimeDir });
const channelSettings = service.getChannelSettings();
const { baseUrl, token } = resolveTelegramRuntimeConfig({
  env: process.env,
  settings: channelSettings,
});

if (!token) {
  throw new Error(
    "Telegram bot token is missing. Save it in Channels or set TELEGRAM_BOT_TOKEN.",
  );
}

const client = createMemduckHttpClient(baseUrl);
const bot = new Bot(token);
const assetStore = createAssetStore(runtimeDir);

async function heartbeat() {
  await fetch(new URL("/api/channels/heartbeat", baseUrl), {
    body: JSON.stringify({
      channel: "telegram",
      metadata: {
        baseUrl,
        botUsername: channelSettings.telegram.botUsername ?? "",
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

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
  await heartbeat();
  await ctx.reply(
    [
      "memduck is ready.",
      "Send me a link, text, or screenshot and I will push it through the same local API used by the web app.",
      "Use /ask <question> for grounded Q&A, or /review for your current review queue.",
    ].join("\n"),
  );
});

bot.on("message:text", async (ctx) => {
  await heartbeat();
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
  await heartbeat();
  const photo = ctx.message.photo.at(-1);
  if (!photo) {
    await ctx.reply("I could not read that image. Try sending it again.");
    return;
  }

  const telegramFile = await ctx.api.getFile(photo.file_id);
  if (!telegramFile.file_path) {
    await ctx.reply("Telegram did not return a downloadable file path.");
    return;
  }

  const downloaded = await downloadTelegramPhotoToAssetStore({
    assetStore,
    photoUrl: `https://api.telegram.org/file/bot${token}/${telegramFile.file_path}`,
  });

  const result = await client.ingest({
    kind: "image",
    payload: {
      fileName: downloaded.fileName,
      mimeType: downloaded.mimeType,
      objectKey: downloaded.objectKey,
    },
    requestedDepth: "quick",
    sourceChannel: "telegram",
    sourceContext: ctx.message.caption
      ? { caption: ctx.message.caption }
      : undefined,
  });
  await ctx.reply(
    formatMemoryReply(result.memoryCard.title, result.memoryCard.summary),
  );
});

bot.catch((error) => {
  console.error("Telegram bot error", error.error);
});

void heartbeat();
bot.start();
console.log(`memduck Telegram bot is running against ${baseUrl}`);
