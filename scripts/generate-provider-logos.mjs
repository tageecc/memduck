import fs from "node:fs/promises";
import path from "node:path";

import logos from "@iconify-json/logos/icons.json" with { type: "json" };
import {
  siAnthropic,
  siBaidu,
  siBytedance,
  siCloudflare,
  siDeepseek,
  siElevenlabs,
  siGithubcopilot,
  siGooglegemini,
  siHuggingface,
  siMinimax,
  siMistralai,
  siMoonshotai,
  siNvidia,
  siOllama,
  siOpenrouter,
  siPerplexity,
  siQwen,
  siVercel,
  siVllm,
  siXiaomi,
} from "simple-icons";

const outDir = path.resolve("public/provider-logos");

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

const marks = {
  arc: '<path d="M21 35c0-9.389 7.611-17 17-17 3.913 0 7.517 1.322 10.389 3.544" stroke="#fff" stroke-linecap="round" stroke-width="4"/><path d="M17 45c5.263-1.263 9.343-5.343 10.606-10.606" stroke="#fff" stroke-linecap="round" stroke-width="4"/><circle cx="18" cy="45" r="3" fill="#fff"/><circle cx="48" cy="21" r="3" fill="#fff"/>',
  burst:
    '<path d="M32 16v10M32 38v10M16 32h10M38 32h10M21.373 21.373l7.071 7.071M35.556 35.556l7.071 7.071M42.627 21.373l-7.071 7.071M28.444 35.556l-7.071 7.071" stroke="#fff" stroke-linecap="round" stroke-width="4"/><circle cx="32" cy="32" r="5" fill="#fff"/>',
  gate: '<path d="M18 46V20h12l16 12v14H34V28h-6v18z" fill="#fff"/>',
  layers:
    '<path d="m32 16 14 8-14 8-14-8zM18 31l14 8 14-8M18 38l14 8 14-8" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>',
  node: '<circle cx="20" cy="22" r="4" fill="#fff"/><circle cx="44" cy="22" r="4" fill="#fff"/><circle cx="32" cy="42" r="4" fill="#fff"/><path d="M24 24h16M22.5 25.5 30 38M41.5 25.5 34 38" stroke="#fff" stroke-linecap="round" stroke-width="4"/>',
  orbit:
    '<circle cx="32" cy="32" r="6" fill="#fff"/><path d="M19 26c2.833-4.667 7.5-8 13-8 8.837 0 16 7.163 16 16 0 5.5-2.333 10.167-7 13" stroke="#fff" stroke-linecap="round" stroke-width="4"/><path d="M18 39c0 3.333 1.333 6.333 3.5 8.5" stroke="#fff" stroke-linecap="round" stroke-width="4"/>',
  route:
    '<path d="M18 20h16a6 6 0 0 1 6 6v2a6 6 0 0 0 6 6h2" stroke="#fff" stroke-linecap="round" stroke-width="4"/><path d="m38 18 10 10-10 10" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/><path d="M18 44h12" stroke="#fff" stroke-linecap="round" stroke-width="4"/><circle cx="18" cy="44" r="3" fill="#fff"/>',
  spark:
    '<path d="m32 16 3.5 10.5L46 30l-10.5 3.5L32 44l-3.5-10.5L18 30l10.5-3.5z" fill="#fff"/>',
  swirl:
    '<path d="M43.5 24.5C40.9 20.9 36.7 18.5 32 18.5c-7.456 0-13.5 6.044-13.5 13.5S24.544 45.5 32 45.5c4.7 0 8.9-2.4 11.5-6" stroke="#fff" stroke-linecap="round" stroke-width="4"/><path d="M40 22h6v6" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/><path d="M24 42h-6v-6" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>',
  terminal:
    '<path d="m20 24 8 8-8 8" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/><path d="M34 40h10" stroke="#fff" stroke-linecap="round" stroke-width="4"/>',
  wave: '<path d="M16 38c4-10 8-10 12 0s8 10 12 0 8-10 12 0" stroke="#fff" stroke-linecap="round" stroke-width="4"/>',
};

function makeBadge({ bgFrom, bgTo, mark }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="provider-a" x1="14" x2="50" y1="12" y2="52" gradientUnits="userSpaceOnUse">
          <stop stop-color="${bgFrom}"/>
          <stop offset="1" stop-color="${bgTo}"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#provider-a)"/>
      ${marks[mark]}
    </svg>
  `;
}

const customSvgs = {
  arcee: makeBadge({ bgFrom: "#8B5CF6", bgTo: "#5B21B6", mark: "arc" }),
  "azure-speech": makeBadge({
    bgFrom: "#0078D4",
    bgTo: "#004E8C",
    mark: "wave",
  }),
  cerebras: makeBadge({ bgFrom: "#DC2626", bgTo: "#7F1D1D", mark: "burst" }),
  chutes: makeBadge({ bgFrom: "#111827", bgTo: "#334155", mark: "route" }),
  comfyui: makeBadge({ bgFrom: "#14B8A6", bgTo: "#0F766E", mark: "node" }),
  custom: makeBadge({ bgFrom: "#94A3B8", bgTo: "#475569", mark: "layers" }),
  deepgram: makeBadge({ bgFrom: "#13EF93", bgTo: "#0F766E", mark: "wave" }),
  deepinfra: makeBadge({ bgFrom: "#111827", bgTo: "#2563EB", mark: "layers" }),
  ds4: makeBadge({ bgFrom: "#1F2937", bgTo: "#0F172A", mark: "terminal" }),
  fal: makeBadge({ bgFrom: "#0F172A", bgTo: "#475569", mark: "spark" }),
  fireworks: makeBadge({ bgFrom: "#F97316", bgTo: "#DC2626", mark: "burst" }),
  glm: makeBadge({ bgFrom: "#2563EB", bgTo: "#1D4ED8", mark: "node" }),
  gradium: makeBadge({ bgFrom: "#7C3AED", bgTo: "#2563EB", mark: "orbit" }),
  groq: makeBadge({ bgFrom: "#111111", bgTo: "#3F3F46", mark: "wave" }),
  inferrs: makeBadge({ bgFrom: "#059669", bgTo: "#065F46", mark: "arc" }),
  inworld: makeBadge({ bgFrom: "#111827", bgTo: "#9333EA", mark: "swirl" }),
  kilocode: makeBadge({ bgFrom: "#2563EB", bgTo: "#7C3AED", mark: "terminal" }),
  litellm: makeBadge({ bgFrom: "#0EA5E9", bgTo: "#0369A1", mark: "spark" }),
  lmstudio: makeBadge({ bgFrom: "#64748B", bgTo: "#1E293B", mark: "layers" }),
  opencode: makeBadge({ bgFrom: "#111827", bgTo: "#1D4ED8", mark: "terminal" }),
  "opencode-go": makeBadge({
    bgFrom: "#0F172A",
    bgTo: "#0EA5E9",
    mark: "terminal",
  }),
  runway: makeBadge({ bgFrom: "#111827", bgTo: "#4B5563", mark: "gate" }),
  senseaudio: makeBadge({ bgFrom: "#2563EB", bgTo: "#14B8A6", mark: "wave" }),
  sglang: makeBadge({ bgFrom: "#1D4ED8", bgTo: "#7C3AED", mark: "wave" }),
  stepfun: makeBadge({ bgFrom: "#8B5CF6", bgTo: "#EC4899", mark: "spark" }),
  synthetic: makeBadge({
    bgFrom: "#0F766E",
    bgTo: "#155E75",
    mark: "orbit",
  }),
  "tencent-tokenhub": makeBadge({
    bgFrom: "#0284C7",
    bgTo: "#1D4ED8",
    mark: "gate",
  }),
  together: makeBadge({ bgFrom: "#7C3AED", bgTo: "#4C1D95", mark: "layers" }),
  venice: makeBadge({ bgFrom: "#0F172A", bgTo: "#155E75", mark: "wave" }),
  vydra: makeBadge({ bgFrom: "#1F2937", bgTo: "#4B5563", mark: "swirl" }),
  zai: makeBadge({ bgFrom: "#111827", bgTo: "#6D28D9", mark: "orbit" }),
};

const svgByProviderId = {
  "alibaba-model-studio": wrapSimpleIcon(siQwen),
  "amazon-bedrock": wrapIconifyIcon("aws"),
  "amazon-bedrock-mantle": wrapIconifyIcon("aws"),
  anthropic: wrapSimpleIcon(siAnthropic),
  "anthropic-vertex": wrapSimpleIcon(siAnthropic),
  arcee: customSvgs.arcee,
  "azure-speech": customSvgs["azure-speech"],
  byteplus: wrapSimpleIcon(siBytedance),
  "byteplus-plan": wrapSimpleIcon(siBytedance),
  cerebras: customSvgs.cerebras,
  chutes: customSvgs.chutes,
  "cloudflare-ai-gateway": wrapSimpleIcon(siCloudflare),
  "claude-max-api-proxy": wrapSimpleIcon(siAnthropic),
  comfyui: customSvgs.comfyui,
  "copilot-proxy": wrapSimpleIcon(siGithubcopilot),
  custom: customSvgs.custom,
  deepgram: customSvgs.deepgram,
  deepinfra: customSvgs.deepinfra,
  deepseek: wrapSimpleIcon(siDeepseek),
  ds4: customSvgs.ds4,
  elevenlabs: wrapSimpleIcon(siElevenlabs),
  fal: customSvgs.fal,
  fireworks: customSvgs.fireworks,
  gemini: wrapSimpleIcon(siGooglegemini),
  "github-copilot": wrapSimpleIcon(siGithubcopilot),
  glm: customSvgs.glm,
  google: wrapSimpleIcon(siGooglegemini),
  "google-gemini-cli": wrapSimpleIcon(siGooglegemini),
  "google-vertex": wrapSimpleIcon(siGooglegemini),
  gradium: customSvgs.gradium,
  groq: customSvgs.groq,
  huggingface: wrapSimpleIcon(siHuggingface),
  inferrs: customSvgs.inferrs,
  inworld: customSvgs.inworld,
  kilocode: customSvgs.kilocode,
  kimi: wrapSimpleIcon(siMoonshotai),
  litellm: customSvgs.litellm,
  lmstudio: customSvgs.lmstudio,
  minimax: wrapSimpleIcon(siMinimax),
  "minimax-portal": wrapSimpleIcon(siMinimax),
  mistral: wrapSimpleIcon(siMistralai),
  moonshot: wrapSimpleIcon(siMoonshotai),
  nvidia: wrapSimpleIcon(siNvidia),
  ollama: wrapSimpleIcon(siOllama),
  opencode: customSvgs.opencode,
  "opencode-go": customSvgs["opencode-go"],
  openai: wrapIconifyIcon("openai-icon"),
  "openai-codex": wrapIconifyIcon("openai-icon"),
  "openai-compatible": wrapIconifyIcon("openai-icon"),
  openrouter: wrapSimpleIcon(siOpenrouter),
  perplexity: wrapSimpleIcon(siPerplexity),
  qianfan: wrapSimpleIcon(siBaidu),
  qwen: wrapSimpleIcon(siQwen),
  runway: customSvgs.runway,
  senseaudio: customSvgs.senseaudio,
  sglang: customSvgs.sglang,
  stepfun: customSvgs.stepfun,
  "stepfun-plan": customSvgs.stepfun,
  synthetic: customSvgs.synthetic,
  "tencent-tokenhub": customSvgs["tencent-tokenhub"],
  together: customSvgs.together,
  venice: customSvgs.venice,
  "vercel-ai-gateway": wrapSimpleIcon(siVercel),
  vllm: wrapSimpleIcon(siVllm),
  volcengine: wrapSimpleIcon(siBytedance),
  "volcengine-plan": wrapSimpleIcon(siBytedance),
  vydra: customSvgs.vydra,
  xai: wrapIconifyIcon("grok-icon"),
  xiaomi: wrapSimpleIcon(siXiaomi),
  zai: customSvgs.zai,
};

await fs.mkdir(outDir, { recursive: true });

for (const [providerId, svg] of Object.entries(svgByProviderId)) {
  await fs.writeFile(path.join(outDir, `${providerId}.svg`), `${svg.trim()}\n`);
}

console.log(
  `Generated ${Object.keys(svgByProviderId).length} provider logos in ${outDir}`,
);
