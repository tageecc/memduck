import fs from "node:fs/promises";
import path from "node:path";

import logos from "@iconify-json/logos/icons.json" with { type: "json" };
import {
  siDiscord,
  siGooglechat,
  siImessage,
  siLine,
  siMatrix,
  siNextcloud,
  siQq,
  siSignal,
  siSynology,
  siTelegram,
  siTwitch,
  siWechat,
  siWhatsapp,
  siZalo,
} from "simple-icons";

const outDir = path.resolve("public/channel-logos");

function wrapSimpleIcon(icon) {
  return icon.svg;
}

function wrapIconifyIcon(name) {
  const icon = logos.icons[name];
  if (!icon) {
    throw new Error(`Missing Iconify logo: ${name}`);
  }

  const width = icon.width ?? logos.width ?? 24;
  const height = icon.height ?? logos.height ?? 24;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">`,
    icon.body,
    "</svg>",
  ].join("");
}

const customSvgs = {
  bluebubbles: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="bluebubbles-a" x1="12" x2="52" y1="10" y2="54" gradientUnits="userSpaceOnUse">
          <stop stop-color="#63A9FF"/>
          <stop offset="1" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
      <path fill="url(#bluebubbles-a)" d="M21 13c-8.837 0-16 6.268-16 14c0 4.48 2.406 8.467 6.154 11.03L10 49l10.404-5.2c.198.012.396.02.596.02c8.837 0 16-6.268 16-14s-7.163-14-16-14"/>
      <path fill="#8EC5FF" d="M41 19c-7.732 0-14 5.82-14 13c0 4.16 2.1 7.862 5.371 10.24L31 52l8.993-4.663c.332.022.667.033 1.007.033c7.732 0 14-5.82 14-13s-6.268-13-14-13"/>
      <circle cx="18" cy="29" r="2.5" fill="#fff"/>
      <circle cx="27" cy="29" r="2.5" fill="#fff"/>
      <circle cx="36" cy="34" r="2.5" fill="#fff"/>
      <circle cx="44" cy="34" r="2.5" fill="#fff"/>
    </svg>
  `,
  dingtalk: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="#1677FF"/>
      <path fill="#fff" d="M18.5 17.5h28.2c2.1 0 3.3 2.4 2 4.05L36.8 36.7l4.35 1.88c1.43.62 1.53 2.6.17 3.36L24.5 51.3c-1.1.61-2.36-.48-1.93-1.67l4.8-13.14-9.88-4.25c-1.45-.62-1.55-2.63-.16-3.38l13.72-7.36H18.5a2 2 0 1 1 0-4Z"/>
      <path fill="#BFD8FF" d="m33.3 24.2-9.1 4.9 8.1 3.5-2.6 7.1 7.7-4.28-6.35-2.75 6.65-8.47z"/>
    </svg>
  `,
  extension: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="#F3F4F6"/>
      <path fill="#111827" d="M29 10a8 8 0 0 0-1.312 15.892V31h-6.14A5.55 5.55 0 0 0 16 36.548v4.14h-5.108A8 8 0 1 0 26.784 42H32v-6.14a5.55 5.55 0 0 1 5.548-5.548h4.14v-4.42A8 8 0 1 0 29 10m0 4a4 4 0 0 1 0 8h-5.312v9h8.28A4.03 4.03 0 0 1 36 35.032v8.28h-9v-5.108a4 4 0 1 0-4 4H20v4a4 4 0 1 1-8 0v-9.516h8v-4.14A9.55 9.55 0 0 1 29.548 23h8.14v-1.108a4 4 0 1 1 4 0V27h-4.14A9.55 9.55 0 0 0 28 36.548V39h-1.216A8 8 0 0 0 29 14"/>
    </svg>
  `,
  feishu: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <path fill="#3370FF" d="M14 24.56c0-6.47 5.244-11.714 11.714-11.714h17.425L29.487 26.5l-12.848 4.275A2.06 2.06 0 0 1 14 28.82z"/>
      <path fill="#00C2A8" d="M49.986 39.44c0 6.47-5.243 11.714-11.714 11.714H20.847L34.5 37.5l12.848-4.275a2.06 2.06 0 0 1 2.638 1.954z"/>
      <path fill="#89A7FF" d="m29.488 26.5 13.651-13.654h6.693a2.168 2.168 0 0 1 2.168 2.168v17.613z"/>
      <path fill="#76E6D5" d="M34.512 37.5 20.86 51.154h-6.693A2.168 2.168 0 0 1 12 48.986V31.373z"/>
    </svg>
  `,
  irc: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="#F3F4F6"/>
      <path fill="#111827" d="M21.5 14A5.5 5.5 0 0 0 16 19.5v11a5.5 5.5 0 0 0 5.5 5.5H24v8.121a1 1 0 0 0 1.707.707L34.535 36H42.5A5.5 5.5 0 0 0 48 30.5v-11A5.5 5.5 0 0 0 42.5 14z"/>
      <circle cx="24" cy="25" r="2.5" fill="#fff"/>
      <circle cx="32" cy="25" r="2.5" fill="#fff"/>
      <circle cx="40" cy="25" r="2.5" fill="#fff"/>
    </svg>
  `,
  nostr: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="nostr-a" x1="32" x2="32" y1="10" y2="54" gradientUnits="userSpaceOnUse">
          <stop stop-color="#8B5CF6"/>
          <stop offset="1" stop-color="#4C1D95"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#nostr-a)"/>
      <path fill="#fff" d="m32 14.5 4.21 9.53 10.37-2.54-5.54 9.09 8.96 5.82-10.51 1.66 1.68 10.5L32 42.74l-9.17 5.82 1.68-10.5L14 36.4l8.96-5.82-5.54-9.09 10.37 2.54z"/>
    </svg>
  `,
  slack: wrapIconifyIcon("slack-icon"),
  msteams: wrapIconifyIcon("microsoft-teams"),
  tlon: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="#111111"/>
      <circle cx="32" cy="32" r="18" stroke="#fff" stroke-width="4"/>
      <circle cx="42.5" cy="21.5" r="4.5" fill="#fff"/>
      <path stroke="#fff" stroke-linecap="round" stroke-width="4" d="M17 36c4.5-5.333 9.833-8 16-8"/>
    </svg>
  `,
  "voice-call": `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="24" fill="#0F766E"/>
      <path fill="#fff" d="M23.674 17h6.363c1.13 0 2.115.77 2.39 1.866l1.736 6.945a2.5 2.5 0 0 1-.72 2.42l-3.322 3.055a28.9 28.9 0 0 0 8.593 8.593l3.055-3.322a2.5 2.5 0 0 1 2.42-.72l6.945 1.736A2.46 2.46 0 0 1 53 39.963v6.363A2.67 2.67 0 0 1 50.326 49C32.474 49 15 31.526 15 13.674A2.67 2.67 0 0 1 17.674 11"/>
    </svg>
  `,
  webchat: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="#E6F7F3"/>
      <circle cx="30" cy="28" r="12" stroke="#0F766E" stroke-width="4"/>
      <path stroke="#0F766E" stroke-linecap="round" stroke-width="4" d="M24 28h12M30 22v12"/>
      <path fill="#0F766E" d="M42.5 36A9.5 9.5 0 0 1 52 45.5a9.5 9.5 0 0 1-9.5 9.5H30l4.56-4.56a9.47 9.47 0 0 1 7.94-14.44"/>
    </svg>
  `,
  yuanbao: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="yuanbao-a" x1="15" x2="49" y1="13" y2="51" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5AA2FF"/>
          <stop offset="1" stop-color="#245DFF"/>
        </linearGradient>
      </defs>
      <path fill="url(#yuanbao-a)" d="m32 8 16.5 9.5V31c0 11.046-7.074 20.88-17.547 24.39L32 56l1.047-.61C43.426 51.88 50.5 42.046 50.5 31V17.5z"/>
      <path fill="#A7C5FF" d="M32 8 15.5 17.5V31c0 11.046 7.074 20.88 17.547 24.39L32 56l-1.047-.61C20.574 51.88 13.5 42.046 13.5 31V17.5z"/>
      <path fill="#fff" d="m32 17 9 5.2v10.6L32 38l-9-5.2V22.2z"/>
    </svg>
  `,
};

const svgByChannelId = {
  bluebubbles: customSvgs.bluebubbles,
  discord: wrapSimpleIcon(siDiscord),
  dingtalk: customSvgs.dingtalk,
  extension: customSvgs.extension,
  feishu: customSvgs.feishu,
  googlechat: wrapSimpleIcon(siGooglechat),
  imessage: wrapSimpleIcon(siImessage),
  irc: customSvgs.irc,
  line: wrapSimpleIcon(siLine),
  matrix: wrapSimpleIcon(siMatrix),
  mattermost: wrapIconifyIcon("mattermost-icon"),
  msteams: customSvgs.msteams,
  "nextcloud-talk": wrapSimpleIcon(siNextcloud),
  nostr: customSvgs.nostr,
  qqbot: wrapSimpleIcon(siQq),
  signal: wrapSimpleIcon(siSignal),
  slack: customSvgs.slack,
  "synology-chat": wrapSimpleIcon(siSynology),
  telegram: wrapSimpleIcon(siTelegram),
  tlon: customSvgs.tlon,
  twitch: wrapSimpleIcon(siTwitch),
  "voice-call": customSvgs["voice-call"],
  webchat: customSvgs.webchat,
  wechat: wrapSimpleIcon(siWechat),
  whatsapp: wrapSimpleIcon(siWhatsapp),
  yuanbao: customSvgs.yuanbao,
  zalo: wrapSimpleIcon(siZalo),
  zalouser: wrapSimpleIcon(siZalo),
};

await fs.mkdir(outDir, { recursive: true });

for (const [channelId, svg] of Object.entries(svgByChannelId)) {
  await fs.writeFile(path.join(outDir, `${channelId}.svg`), `${svg.trim()}\n`);
}

console.log(
  `Generated ${Object.keys(svgByChannelId).length} channel logos in ${outDir}`,
);
