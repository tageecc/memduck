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
  return [`Saved to memduck`, ``, title, summary].filter(Boolean).join("\n");
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

function formatReviewReply(sections: {
  staleHighValue: Array<{ summary: string; title: string }>;
  themeMomentum: Array<{ summary: string; title: string }>;
  today: Array<{ summary: string; title: string }>;
}): string {
  if (
    sections.today.length === 0 &&
    sections.staleHighValue.length === 0 &&
    sections.themeMomentum.length === 0
  ) {
    return "Nothing is ready for review yet. Save a few links or notes first.";
  }

  return [
    "Review queue",
    "",
    "Today",
    ...sections.today.map(
      (card, index) => `${index + 1}. ${card.title}\n${card.summary}`,
    ),
    "",
    "High value",
    ...sections.staleHighValue.map(
      (card, index) => `${index + 1}. ${card.title}\n${card.summary}`,
    ),
    "",
    "Theme momentum",
    ...sections.themeMomentum.map(
      (card, index) => `${index + 1}. ${card.title}\n${card.summary}`,
    ),
  ].join("\n");
}

function formatRecentReply(
  cards: Array<{ status: string; summary: string; title: string }>,
): string {
  if (cards.length === 0) {
    return "No memory cards are stored yet.";
  }

  return [
    "Recent memory cards",
    "",
    ...cards.map(
      (card, index) =>
        `${index + 1}. ${card.title} · ${card.status}\n${card.summary || "Saved to inbox, not digested yet."}`,
    ),
  ].join("\n");
}

function formatSearchReply(
  items: Array<{
    card: { summary: string; title: string };
    rerankScore: number;
    semanticScore: number;
  }>,
): string {
  if (items.length === 0) {
    return "No matching saved memory cards were found.";
  }

  return [
    "Search results",
    "",
    ...items.map(
      (item, index) =>
        `${index + 1}. ${item.card.title}\n${item.card.summary}\nrerank ${item.rerankScore.toFixed(2)} · semantic ${item.semanticScore.toFixed(2)}`,
    ),
  ].join("\n\n");
}

function rememberCard(chatId: string, cardId: string) {
  service.saveTelegramChatState(chatId, {
    lastCardId: cardId,
  });
}

function rememberConversation(chatId: string, conversationId: string) {
  service.saveTelegramChatState(chatId, {
    lastConversationId: conversationId,
  });
}

bot.command("start", async (ctx) => {
  await heartbeat();
  await ctx.reply(
    [
      "memduck is ready.",
      "Send me a link, text, or screenshot and I will push it through the same local API used by the web app.",
      "Use /search <query>, /recent, /ask <question>, /follow <question>, or /review.",
    ].join("\n"),
  );
});

bot.on("message:text", async (ctx) => {
  await heartbeat();
  const action = parseTelegramMessage({ text: ctx.message.text });
  const chatId = String(ctx.chat.id);

  if (action.kind === "review") {
    const sections = await client.review();
    await ctx.reply(formatReviewReply(sections));
    return;
  }

  if (action.kind === "recent") {
    const cards = await client.listMemoryCards();
    await ctx.reply(formatRecentReply(cards.slice(0, 5)));
    return;
  }

  if (action.kind === "search") {
    if (!action.query) {
      await ctx.reply("Use /search followed by the phrase you want to find.");
      return;
    }

    const retrieval = await client.search({
      limit: 5,
      query: action.query,
    });
    await ctx.reply(formatSearchReply(retrieval.items));
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
    rememberConversation(chatId, answer.conversationId);
    await ctx.reply(
      formatAskReply(
        answer.answer,
        answer.citations.map((citation) => citation.title),
      ),
    );
    return;
  }

  if (action.kind === "follow_up") {
    if (!action.question) {
      await ctx.reply(
        "Use /follow followed by the next question for the same thread.",
      );
      return;
    }

    const conversationId =
      service.getTelegramChatState(chatId)?.lastConversationId;

    if (!conversationId) {
      await ctx.reply(
        "There is no active Ask thread in this chat yet. Start with /ask first.",
      );
      return;
    }

    const answer = await client.ask({
      conversationId,
      question: action.question,
    });
    rememberConversation(chatId, answer.conversationId);
    await ctx.reply(
      formatAskReply(
        answer.answer,
        answer.citations.map((citation) => citation.title),
      ),
    );
    return;
  }

  if (action.kind === "analyze_last") {
    const cardId = service.getTelegramChatState(chatId)?.lastCardId;

    if (!cardId) {
      await ctx.reply(
        "There is no recent card in this chat yet. Save something here first.",
      );
      return;
    }

    const result = await client.analyzeMemoryCard(
      cardId,
      action.requestedDepth,
    );
    rememberCard(chatId, result.memoryCard.id);
    await ctx.reply(
      formatMemoryReply(
        result.memoryCard.title,
        result.memoryCard.summary ||
          `Card upgraded to ${result.memoryCard.status}.`,
      ),
    );
    return;
  }

  const result = await client.ingest(action.envelope);
  rememberCard(chatId, result.memoryCard.id);
  await ctx.reply(
    formatMemoryReply(
      result.memoryCard.title,
      result.memoryCard.summary ||
        "Saved to inbox. Use /quick or /deep to turn it into retrievable memory.",
    ),
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

  const action = parseTelegramMessage({
    caption: ctx.message.caption,
    photoFileId: photo.file_id,
    photoMimeType: downloaded.mimeType,
  });

  if (action.kind !== "ingest" || action.envelope.kind !== "image") {
    await ctx.reply(
      "This photo command could not be turned into an image capture.",
    );
    return;
  }

  const result = await client.ingest({
    ...action.envelope,
    payload: {
      fileName: downloaded.fileName,
      mimeType: downloaded.mimeType,
      objectKey: downloaded.objectKey,
    },
  });
  rememberCard(String(ctx.chat.id), result.memoryCard.id);
  await ctx.reply(
    formatMemoryReply(
      result.memoryCard.title,
      result.memoryCard.summary ||
        "Saved to inbox. Use /deep to run a deeper analysis on the last card.",
    ),
  );
});

bot.catch((error) => {
  console.error("Telegram bot error", error.error);
});

void heartbeat();
bot.start();
console.log(`memduck Telegram bot is running against ${baseUrl}`);
