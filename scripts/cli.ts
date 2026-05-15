#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Database from "better-sqlite3";

import { getChannelRuntimeReadiness } from "../src/lib/channels/runtime-registry";
import { getMemduckHome, getRuntimeDir } from "../src/lib/memduck/runtime-path";
import type { ChannelSettings } from "../src/lib/memduck/types";

type CliCommand = "dev" | "doctor" | "help" | "launch";
const supportedCommands = new Set<CliCommand>(["dev", "doctor", "help"]);
const supportedFlags = new Set(["--with-telegram"]);
const defaultBaseUrl = "http://127.0.0.1:3000";
const homeConfigFileName = "memduck.env";

export function parseCliArgs(argv: string[]) {
  const firstArg = argv[0];
  const rawCommand =
    firstArg && !firstArg.startsWith("--") ? firstArg : "launch";
  const rest = rawCommand === "launch" ? argv : argv.slice(1);
  const command =
    rawCommand === "launch"
      ? "launch"
      : supportedCommands.has(rawCommand as CliCommand)
        ? (rawCommand as CliCommand)
        : "help";
  const invalidCommand =
    command === "help" && rawCommand !== "help" ? rawCommand : null;
  const canUseRuntimeFlags = command === "launch" || command === "dev";
  const invalidFlag =
    invalidCommand === null
      ? (rest.find((arg) => !supportedFlags.has(arg) || !canUseRuntimeFlags) ??
        null)
      : null;
  const flags: Record<string, boolean> = {};

  if (!invalidFlag) {
    for (const arg of rest) {
      if (arg === "--with-telegram") {
        flags.withTelegram = true;
      }
    }
  }

  return {
    command,
    flags,
    invalidFlag,
    invalidCommand,
  };
}

export function buildUsageText(input?: {
  invalidCommand?: string | null;
  invalidFlag?: string | null;
}) {
  return [
    input?.invalidCommand
      ? `Unknown command: ${input.invalidCommand}`
      : input?.invalidFlag
        ? `Unknown flag: ${input.invalidFlag}`
        : "memduck CLI",
    "Usage:",
    "  memduck",
    "  memduck --with-telegram",
    "  memduck doctor",
    "  memduck dev",
    "  memduck dev --with-telegram",
  ].join("\n");
}

export function buildDoctorReport(input: {
  hasHomeConfig: boolean;
  hasRuntimeDir: boolean;
  homeDir: string;
  providerConfigured: boolean;
  telegramConfigured: boolean;
}) {
  return [
    "memduck doctor",
    `- home: ${input.homeDir}`,
    `- config: ${input.hasHomeConfig ? "present" : "missing"}`,
    `- runtime dir: ${input.hasRuntimeDir ? "present" : "missing"}`,
    `- Provider: ${input.providerConfigured ? "configured" : "not configured"}`,
    `- Telegram: ${input.telegramConfigured ? "configured" : "not configured"}`,
  ].join("\n");
}

export async function scaffoldInitFiles({
  homeDir,
  runtimeDir,
}: {
  homeDir: string;
  runtimeDir: string;
}) {
  const envPath = path.join(homeDir, homeConfigFileName);

  let hasHomeConfig = false;
  try {
    hasHomeConfig = (await stat(envPath)).isFile();
  } catch {
    hasHomeConfig = false;
  }

  await mkdir(homeDir, { recursive: true });
  await mkdir(runtimeDir, { recursive: true });

  if (!hasHomeConfig) {
    await writeFile(
      envPath,
      [
        `MEMDUCK_HOME=${homeDir}`,
        `MEMDUCK_RUNTIME_DIR=${runtimeDir}`,
        `MEMDUCK_BASE_URL=${defaultBaseUrl}`,
        "TELEGRAM_BOT_TOKEN=",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

function getPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function getHomeConfigPath(homeDir: string): string {
  return path.join(homeDir, homeConfigFileName);
}

function parseHomeConfig(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!match) {
      throw new Error(
        `Invalid ${homeConfigFileName} line ${index + 1}: ${line}`,
      );
    }

    const [, key, value = ""] = match;
    if (!key) {
      throw new Error(
        `Invalid ${homeConfigFileName} line ${index + 1}: ${line}`,
      );
    }
    env[key] = value;
  }

  return env;
}

async function buildRuntimeEnv(
  inputEnv: Record<string, string | undefined> = process.env,
): Promise<Record<string, string>> {
  const homeDir = getMemduckHome(inputEnv);
  const configPath = getHomeConfigPath(homeDir);
  const fileEnv = await readFile(configPath, "utf8").then(parseHomeConfig);
  const mergedEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(inputEnv)) {
    if (typeof value === "string") {
      mergedEnv[key] = value;
    }
  }

  return {
    ...mergedEnv,
    ...fileEnv,
    MEMDUCK_HOME: fileEnv.MEMDUCK_HOME || homeDir,
    MEMDUCK_RUNTIME_DIR:
      fileEnv.MEMDUCK_RUNTIME_DIR || getRuntimeDir({ MEMDUCK_HOME: homeDir }),
    MEMDUCK_BASE_URL: fileEnv.MEMDUCK_BASE_URL || defaultBaseUrl,
  };
}

function resolveRuntimeEntry(packageRoot: string, name: "telegram" | "worker") {
  const compiledEntry = path.join(packageRoot, "dist", `${name}.mjs`);
  if (existsSync(compiledEntry)) {
    return {
      args: [compiledEntry],
      command: process.execPath,
    };
  }

  return {
    args: ["--import", "tsx", path.join(packageRoot, "scripts", `${name}.ts`)],
    command: process.execPath,
  };
}

function resolveNextBin(packageRoot: string): string {
  return path.join(packageRoot, "node_modules", "next", "dist", "bin", "next");
}

function ensurePackageBuild(packageRoot: string): void {
  const buildIdPath = path.join(packageRoot, ".next", "BUILD_ID");
  if (!existsSync(buildIdPath)) {
    throw new Error(
      "memduck requires a production build. Published npm packages include it; source checkouts should use `pnpm memduck dev`.",
    );
  }
}

async function prepareRuntimeEnv(
  inputEnv: Record<string, string | undefined> = process.env,
): Promise<Record<string, string>> {
  const homeDir = getMemduckHome(inputEnv);
  const runtimeDir = getRuntimeDir(
    inputEnv.MEMDUCK_RUNTIME_DIR ? inputEnv : { MEMDUCK_HOME: homeDir },
  );

  await scaffoldInitFiles({ homeDir, runtimeDir });
  return buildRuntimeEnv(inputEnv);
}

export function isCliEntrypoint(
  importMetaUrl: string,
  argvPath: string | undefined,
): boolean {
  if (!argvPath) {
    return false;
  }

  return importMetaUrl === pathToFileURL(realpathSync(argvPath)).href;
}

function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string | undefined> = {},
) {
  return spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
  });
}

async function runDev(flags: Record<string, boolean>) {
  const packageRoot = getPackageRoot();
  const runtimeEnv = await prepareRuntimeEnv();
  const children = buildRuntimeChildren({
    command: "dev",
    flags,
    packageRoot,
    runtimeEnv,
  });

  await waitForChildren(children);
}

function buildRuntimeChildren({
  command,
  flags,
  packageRoot,
  runtimeEnv,
}: {
  command: "dev" | "start";
  flags: Record<string, boolean>;
  packageRoot: string;
  runtimeEnv: Record<string, string>;
}) {
  const worker = resolveRuntimeEntry(packageRoot, "worker");
  const children = [
    spawnProcess(
      process.execPath,
      [resolveNextBin(packageRoot), command],
      packageRoot,
      runtimeEnv,
    ),
    spawnProcess(worker.command, worker.args, packageRoot, runtimeEnv),
  ];

  if (flags.withTelegram) {
    const telegram = resolveRuntimeEntry(packageRoot, "telegram");
    children.push(
      spawnProcess(telegram.command, telegram.args, packageRoot, runtimeEnv),
    );
  }

  return children;
}

function waitForChildren(children: ReturnType<typeof spawnProcess>[]) {
  const shutdown = () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return Promise.race(
    children.map(
      (child) =>
        new Promise<void>((resolve, reject) => {
          child.on("exit", (code) => {
            if (code && code !== 0) {
              reject(new Error(`Child process exited with code ${code}`));
              return;
            }
            resolve();
          });
        }),
    ),
  );
}

async function openDashboard(url: string) {
  const opener =
    process.platform === "darwin"
      ? { args: [url], command: "open" }
      : process.platform === "win32"
        ? { args: ["/c", "start", "", url], command: "cmd" }
        : { args: [url], command: "xdg-open" };

  const child = spawnProcess(opener.command, opener.args, process.cwd());
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Dashboard opener exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function runLaunch(flags: Record<string, boolean>) {
  const packageRoot = getPackageRoot();
  const runtimeEnv = await prepareRuntimeEnv();
  ensurePackageBuild(packageRoot);
  const children = buildRuntimeChildren({
    command: "start",
    flags,
    packageRoot,
    runtimeEnv,
  });
  const url = runtimeEnv.MEMDUCK_BASE_URL || defaultBaseUrl;

  process.stdout.write(
    `memduck is running.\n- dashboard: ${url}\n- home: ${runtimeEnv.MEMDUCK_HOME}\n`,
  );

  setTimeout(() => {
    void openDashboard(url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
    });
  }, 1200);

  await waitForChildren(children);
}

export async function runDoctor(
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    write?: (message: string) => void;
  } = {},
) {
  const env = options.env ?? process.env;
  const homeDir = getMemduckHome(env);
  const runtimeDir = getRuntimeDir(
    env.MEMDUCK_RUNTIME_DIR ? env : { MEMDUCK_HOME: homeDir },
  );
  const envPath = getHomeConfigPath(homeDir);

  const hasHomeConfig = await stat(envPath)
    .then((entry) => entry.isFile())
    .catch(() => false);
  const hasRuntimeDir = await stat(runtimeDir)
    .then((entry) => entry.isDirectory())
    .catch(() => false);
  let providerConfigured = false;
  let telegramConfigured = false;

  if (hasRuntimeDir) {
    const databasePath = path.join(runtimeDir, "memduck.sqlite");
    const hasDatabase = await stat(databasePath)
      .then((entry) => entry.isFile())
      .catch(() => false);

    if (hasDatabase) {
      const database = new Database(databasePath, {
        fileMustExist: true,
        readonly: true,
      });

      try {
        const activeProviderId =
          (
            database
              .prepare(
                "SELECT value_json FROM app_settings WHERE key = 'active_provider_profile_id'",
              )
              .get() as { value_json?: string } | undefined
          )?.value_json ?? null;
        const providerProfiles =
          (
            database
              .prepare(
                "SELECT value_json FROM app_settings WHERE key = 'provider_profiles'",
              )
              .get() as { value_json?: string } | undefined
          )?.value_json ?? "[]";
        const channelSettings =
          (
            database
              .prepare(
                "SELECT value_json FROM app_settings WHERE key = 'channel_settings'",
              )
              .get() as { value_json?: string } | undefined
          )?.value_json ?? "{}";

        const profiles = JSON.parse(providerProfiles) as Array<{
          answerModel?: string;
          apiKey?: string;
          baseUrl?: string;
          embeddingModel?: string;
          id?: string;
          kind?: string;
          model?: string;
          rerankModel?: string;
          summarizeModel?: string;
          visionModel?: string;
        }>;
        const activeId = activeProviderId
          ? (JSON.parse(activeProviderId) as string)
          : null;
        const activeProfile = profiles.find(
          (profile) => profile.id === activeId,
        );
        providerConfigured = Boolean(
          activeProfile?.baseUrl &&
            activeProfile.model &&
            activeProfile.answerModel &&
            activeProfile.embeddingModel &&
            activeProfile.rerankModel &&
            activeProfile.summarizeModel &&
            activeProfile.visionModel &&
            (activeProfile.kind === "ollama" || activeProfile.apiKey),
        );
        const parsedChannelSettings = JSON.parse(
          channelSettings,
        ) as Partial<ChannelSettings> & { telegram?: { botToken?: string } };
        telegramConfigured = parsedChannelSettings.channels
          ? Boolean(
              getChannelRuntimeReadiness(
                parsedChannelSettings as ChannelSettings,
              ).telegram?.ready,
            )
          : Boolean(parsedChannelSettings.telegram?.botToken);
      } finally {
        database.close();
      }
    }
  }

  const write =
    options.write ?? ((message: string) => process.stdout.write(message));
  write(
    `${buildDoctorReport({
      hasHomeConfig,
      hasRuntimeDir,
      homeDir,
      providerConfigured,
      telegramConfigured,
    })}\n`,
  );
}

async function main() {
  const { command, flags, invalidCommand, invalidFlag } = parseCliArgs(
    process.argv.slice(2),
  );

  if (invalidFlag) {
    process.stderr.write(`${buildUsageText({ invalidFlag })}\n`);
    process.exitCode = 1;
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "help") {
    const usage = `${buildUsageText({ invalidCommand })}\n`;
    if (invalidCommand) {
      process.stderr.write(usage);
      process.exitCode = 1;
    } else {
      process.stdout.write(usage);
    }
    return;
  }

  if (command === "launch") {
    await runLaunch(flags);
    return;
  }

  await runDev(flags);
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
