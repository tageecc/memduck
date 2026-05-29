import { getMemduckService } from "@/lib/memduck/runtime";

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireMobileSession(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return null;
  }

  const service = await getMemduckService();
  return service.getMobileSession(token);
}
