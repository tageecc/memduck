#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Database from "better-sqlite3";

import { getMemduckHome, getRuntimeDir } from "../src/lib/memduck/runtime-path";

type CliCommand = "dashboard" | "dev" | "doctor" | "help" | "init" | "start";
const supportedCommands = new Set<CliCommand>([
  "dashboard",
  "dev",
  "doctor",
  "help",
  "init",
  "start",
]);
const supportedFlags = new Set(["--with-telegram"]);
const defaultBaseUrl = "http://127.0.0.1:3000";
const homeConfigFileName = "memduck.env";

export function parseCliArgs(argv: string[]) {
  const [rawCommand = "help", ...rest] = argv;
  const flags: Record<string, boolean> = {};
  const invalidFlag = rest.find((arg) => !supportedFlags.has(arg)) ?? null;

  for (const arg of rest) {
    if (arg === "--with-telegram") {
      flags.withTelegram = true;
    }
  }

  const command = supportedCommands.has(rawCommand as CliCommand)
    ? (rawCommand as CliCommand)
    : "help";

  return {
    command,
    flags,
    invalidFlag,
    invalidCommand:
      command === "help" && rawCommand !== "help" ? rawCommand : null,
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
    "  memduck init",
    "  memduck doctor",
    "  memduck dashboard",
    "  memduck start",
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
      "memduck start requires a production build. Published npm packages include it; source checkouts should run `pnpm build` or use `pnpm memduck dev`.",
    );
  }
}

function assertInitialized(runtimeEnv: Record<string, string>): void {
  const homeDir = runtimeEnv.MEMDUCK_HOME;
  if (!homeDir || !existsSync(getHomeConfigPath(homeDir))) {
    throw new Error("memduck is not initialized. Run `memduck init` first.");
  }
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
  const runtimeEnv = await buildRuntimeEnv();
  assertInitialized(runtimeEnv);

  const children = [
    spawnProcess(
      process.execPath,
      [resolveNextBin(packageRoot), "dev"],
      packageRoot,
      runtimeEnv,
    ),
    spawnProcess(
      resolveRuntimeEntry(packageRoot, "worker").command,
      resolveRuntimeEntry(packageRoot, "worker").args,
      packageRoot,
      runtimeEnv,
    ),
  ];

  if (flags.withTelegram) {
    const telegram = resolveRuntimeEntry(packageRoot, "telegram");
    children.push(
      spawnProcess(telegram.command, telegram.args, packageRoot, runtimeEnv),
    );
  }

  const shutdown = () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.race(
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

async function runStart(flags: Record<string, boolean>) {
  const packageRoot = getPackageRoot();
  const runtimeEnv = await buildRuntimeEnv();
  assertInitialized(runtimeEnv);
  ensurePackageBuild(packageRoot);

  const children = [
    spawnProcess(
      process.execPath,
      [resolveNextBin(packageRoot), "start"],
      packageRoot,
      runtimeEnv,
    ),
    spawnProcess(
      resolveRuntimeEntry(packageRoot, "worker").command,
      resolveRuntimeEntry(packageRoot, "worker").args,
      packageRoot,
      runtimeEnv,
    ),
  ];

  if (flags.withTelegram) {
    const telegram = resolveRuntimeEntry(packageRoot, "telegram");
    children.push(
      spawnProcess(telegram.command, telegram.args, packageRoot, runtimeEnv),
    );
  }

  const shutdown = () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.race(
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

async function runInit() {
  const homeDir = getMemduckHome();
  const runtimeDir = getRuntimeDir({ MEMDUCK_HOME: homeDir });

  await scaffoldInitFiles({
    homeDir,
    runtimeDir,
  });
  process.stdout.write(
    `memduck initialized.\n- home: ${homeDir}\n- config: ${getHomeConfigPath(homeDir)}\n- runtime dir: ${runtimeDir}\n`,
  );
}

async function runDashboard() {
  const runtimeEnv = await buildRuntimeEnv();
  assertInitialized(runtimeEnv);
  const url = runtimeEnv.MEMDUCK_BASE_URL || defaultBaseUrl;
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
            activeProfile.answerModel &&
            activeProfile.embeddingModel &&
            activeProfile.rerankModel &&
            activeProfile.summarizeModel &&
            activeProfile.visionModel &&
            (activeProfile.kind === "ollama" || activeProfile.apiKey),
        );
        telegramConfigured = Boolean(
          (JSON.parse(channelSettings) as { telegram?: { botToken?: string } })
            .telegram?.botToken,
        );
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

  if (command === "init") {
    await runInit();
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "dashboard") {
    await runDashboard();
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

  if (command === "start") {
    await runStart(flags);
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
