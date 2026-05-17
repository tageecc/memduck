import { NextResponse } from "next/server";

import { getRuntimeDir } from "@/lib/memduck/runtime-path";
import { createAssetStore } from "@/lib/storage/assets";

function contentTypeForObjectKey(objectKey: string): string {
  const extension = objectKey.split(".").at(-1)?.toLowerCase();

  switch (extension) {
    case "apng":
      return "image/apng";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function buildObjectKey(segments: string[]): string | null {
  if (segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      return null;
    }
  }

  return segments.join("/");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ objectKey: string[] }> },
) {
  const { objectKey: segments } = await params;
  const objectKey = buildObjectKey(segments);

  if (!objectKey) {
    return NextResponse.json(
      { error: "Invalid asset object key." },
      { status: 400 },
    );
  }

  try {
    const assetStore = createAssetStore(getRuntimeDir());
    const bytes = assetStore.readAsBuffer(objectKey);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": contentTypeForObjectKey(objectKey),
      },
      status: 200,
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}
