#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type CliCommand = "dev" | "init";

export function parseCliArgs(argv: string[]) {
  const [command = "dev", ...rest] = argv;
  const flags: Record<string, boolean> = {};

  for (const arg of rest) {
    if (arg === "--with-telegram") {
      flags.withTelegram = true;
    }
  }

  return {
    command: command as CliCommand,
    flags,
  };
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
          "MEMDUCK_SEED_DEMO=false",
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

async function main() {
  const { command, flags } = parseCliArgs(process.argv.slice(2));

  if (command === "init") {
    await runInit();
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
