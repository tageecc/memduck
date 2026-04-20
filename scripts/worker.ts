#!/usr/bin/env tsx

import { getRuntimeDir } from "../src/lib/memduck/runtime-path";
import { createMemduckService } from "../src/lib/memduck/service";

async function main() {
  const service = createMemduckService({
    runtimeDir: getRuntimeDir(),
  });

  process.stdout.write("memduck worker is watching for compilation cycles.\n");

  const run = async () => {
    if (service.listMemoryCards().length > 0) {
      await service.compileKnowledge();
    }
  };

  await run();
  setInterval(() => {
    void run();
  }, 20_000);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
