import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const removePaths = [
  ".next/cache",
  ".next/dev",
  ".next/trace",
  ".next/trace-build",
  ".next/turbopack",
  ".next/types",
];

for (const target of removePaths) {
  await rm(target, { force: true, recursive: true });
}

async function removeSourceMaps(root) {
  const entries = await readdir(root, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        await removeSourceMaps(fullPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith(".map")) {
        await rm(fullPath);
      }
    }),
  );
}

await removeSourceMaps(".next");
