import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface SaveBufferInput {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  prefix: string;
}

interface SaveTextInput {
  fileName: string;
  prefix: string;
  text: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createAssetStore(runtimeDir: string) {
  const rootDir = path.join(runtimeDir, "assets");
  mkdirSync(rootDir, { recursive: true });

  function ensurePrefix(prefix: string) {
    mkdirSync(path.join(rootDir, prefix), { recursive: true });
  }

  function resolveObjectPath(objectKey: string): string {
    const absolutePath = path.resolve(rootDir, objectKey);
    const relativePath = path.relative(rootDir, absolutePath);

    if (
      !objectKey.trim() ||
      relativePath === "" ||
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error("Asset object key escapes the runtime asset directory.");
    }

    return absolutePath;
  }

  return {
    readAsBuffer(objectKey: string): Buffer {
      return readFileSync(resolveObjectPath(objectKey));
    },

    resolveObjectPath,

    saveBuffer(input: SaveBufferInput) {
      ensurePrefix(input.prefix);
      const fileName = sanitizeFileName(input.fileName);
      const objectKey = `${input.prefix}/${Date.now()}-${fileName}`;
      const absolutePath = resolveObjectPath(objectKey);

      writeFileSync(absolutePath, input.bytes);

      return {
        absolutePath,
        fileName,
        mimeType: input.mimeType,
        objectKey,
      };
    },

    saveText(input: SaveTextInput) {
      ensurePrefix(input.prefix);
      const fileName = sanitizeFileName(input.fileName);
      const objectKey = `${input.prefix}/${Date.now()}-${fileName}`;
      const absolutePath = resolveObjectPath(objectKey);

      writeFileSync(absolutePath, input.text, "utf8");

      return {
        absolutePath,
        objectKey,
      };
    },
  };
}

export async function downloadTelegramPhotoToAssetStore({
  assetStore,
  fetcher = fetch,
  photoUrl,
}: {
  assetStore: ReturnType<typeof createAssetStore>;
  fetcher?: typeof fetch;
  photoUrl: string;
}) {
  const response = await fetcher(photoUrl);
  if (!response.ok) {
    throw new Error(`Telegram photo download failed with ${response.status}`);
  }

  const mimeType = response.headers.get("content-type")?.trim() ?? "";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Telegram photo download did not return an image.");
  }

  const fileName = photoUrl.split("/").at(-1) ?? "telegram-photo.jpg";
  const bytes = Buffer.from(await response.arrayBuffer());

  return assetStore.saveBuffer({
    bytes,
    fileName,
    mimeType,
    prefix: "telegram",
  });
}
