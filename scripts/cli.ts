#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";

type CliCommand = "dev" | "doctor" | "help" | "init";
const supportedCommands = new Set<CliCommand>([
  "dev",
  "doctor",
  "help",
  "init",
]);

export function parseCliArgs(argv: string[]) {
  const [rawCommand = "dev", ...rest] = argv;
  const flags: Record<string, boolean> = {};

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
    invalidCommand:
      command === "help" && rawCommand !== "help" ? rawCommand : null,
  };
}

export function buildUsageText(invalidCommand?: string | null) {
  return [
    invalidCommand ? `Unknown command: ${invalidCommand}` : "memduck CLI",
    "Usage:",
    "  memduck init",
    "  memduck doctor",
    "  memduck dev",
    "  memduck dev --with-telegram",
  ].join("\n");
}

export function buildDoctorReport(input: {
  hasEnvLocal: boolean;
  hasRuntimeDir: boolean;
  providerConfigured: boolean;
  telegramConfigured: boolean;
}) {
  return [
    "memduck doctor",
    `- .env.local: ${input.hasEnvLocal ? "present" : "missing"}`,
    `- runtime dir: ${input.hasRuntimeDir ? "present" : "missing"}`,
    `- Provider: ${input.providerConfigured ? "configured" : "not configured"}`,
    `- Telegram: ${input.telegramConfigured ? "configured" : "not configured"}`,
  ].join("\n");
}

export async function scaffoldInitFiles({
  cwd,
  runtimeDir,
}: {
  cwd: string;
  runtimeDir: string;
}) {
  await mkdir(runtimeDir, { recursive: true });

  const envPath = path.join(cwd, ".env.local");
  const envExamplePath = path.join(cwd, ".env.example");

  let hasEnvLocal = false;
  try {
    hasEnvLocal = (await stat(envPath)).isFile();
  } catch {
    hasEnvLocal = false;
  }

  if (!hasEnvLocal) {
    let template = "";
    try {
      template = await readFile(envExamplePath, "utf8");
    } catch {
      const repoEnvPath = path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        "../.env.example",
      );
      try {
        template = await readFile(repoEnvPath, "utf8");
      } catch {
        template = [
          `MEMDUCK_RUNTIME_DIR=${runtimeDir}`,
          "MEMDUCK_BASE_URL=http://127.0.0.1:3000",
          "TELEGRAM_BOT_TOKEN=",
          "",
        ].join("\n");
      }
    }
    await writeFile(envPath, template, "utf8");
  }
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
  const cwd = process.cwd();
  const runtimeDir = process.env.MEMDUCK_RUNTIME_DIR ?? ".memduck/runtime";

  await scaffoldInitFiles({
    cwd,
    runtimeDir: path.join(cwd, runtimeDir),
  });

  const children = [
    spawnProcess("pnpm", ["dev"], cwd),
    spawnProcess("pnpm", ["worker:dev"], cwd),
  ];

  if (flags.withTelegram || process.env.TELEGRAM_BOT_TOKEN) {
    children.push(spawnProcess("pnpm", ["telegram:dev"], cwd));
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
  const cwd = process.cwd();
  const runtimeDir = process.env.MEMDUCK_RUNTIME_DIR ?? ".memduck/runtime";
  await scaffoldInitFiles({
    cwd,
    runtimeDir: path.join(cwd, runtimeDir),
  });
  process.stdout.write(
    `memduck initialized.\n- .env.local is ready\n- runtime dir: ${runtimeDir}\n`,
  );
}

async function runDoctor() {
  const cwd = process.cwd();
  const runtimeDir = path.join(
    cwd,
    process.env.MEMDUCK_RUNTIME_DIR ?? ".memduck/runtime",
  );
  const envPath = path.join(cwd, ".env.local");

  const hasEnvLocal = await stat(envPath)
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

  process.stdout.write(
    `${buildDoctorReport({
      hasEnvLocal,
      hasRuntimeDir,
      providerConfigured,
      telegramConfigured,
    })}\n`,
  );
}

async function main() {
  const { command, flags, invalidCommand } = parseCliArgs(
    process.argv.slice(2),
  );

  if (command === "init") {
    await runInit();
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "help") {
    const usage = `${buildUsageText(invalidCommand)}\n`;
    if (invalidCommand) {
      process.stderr.write(usage);
      process.exitCode = 1;
    } else {
      process.stdout.write(usage);
    }
    return;
  }

  await runDev(flags);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
