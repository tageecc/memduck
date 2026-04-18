import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const rootDir = process.cwd();
const extensionDir = path.join(rootDir, "extension");
const outDir = path.join(extensionDir, "dist");

await rm(outDir, { force: true, recursive: true });
await mkdir(outDir, { recursive: true });

await build({
  bundle: true,
  entryPoints: [path.join(extensionDir, "src/popup.ts")],
  format: "iife",
  outfile: path.join(outDir, "popup.js"),
  platform: "browser",
  sourcemap: true,
  target: "chrome120",
});

await Promise.all([
  cp(
    path.join(extensionDir, "manifest.json"),
    path.join(outDir, "manifest.json"),
  ),
  cp(path.join(extensionDir, "popup.html"), path.join(outDir, "popup.html")),
  cp(path.join(extensionDir, "popup.css"), path.join(outDir, "popup.css")),
]);

console.log(`Built memduck extension into ${outDir}`);
