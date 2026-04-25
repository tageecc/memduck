import { readFile, rm, writeFile } from "node:fs/promises";

import { build } from "esbuild";

const entries = {
  cli: "scripts/cli.ts",
  telegram: "scripts/telegram.ts",
  worker: "scripts/worker.ts",
};

await rm("dist", { force: true, recursive: true });

await Promise.all(
  Object.entries(entries).map(([name, entryPoint]) =>
    build({
      bundle: true,
      entryPoints: [entryPoint],
      external: ["better-sqlite3"],
      format: "esm",
      outfile: `dist/${name}.mjs`,
      packages: "external",
      platform: "node",
      target: "node24",
    }),
  ),
);

const cliPath = "dist/cli.mjs";
const cli = await readFile(cliPath, "utf8");
await writeFile(
  cliPath,
  cli.replace(/^#!.*\n/, "#!/usr/bin/env node\n"),
  "utf8",
);
