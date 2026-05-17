export type JsonObject = Record<string, unknown>;

export async function readJsonValue(response: Response): Promise<unknown> {
  return response.json().catch(() => null) as Promise<unknown>;
}

export async function readJsonObject(
  response: Response,
): Promise<JsonObject | null> {
  const payload = await readJsonValue(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as JsonObject;
}

export function errorMessageFromJson(
  payload: JsonObject | null,
  fallback: string,
) {
  return typeof payload?.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
}

export async function readErrorMessage(response: Response, fallback: string) {
  return errorMessageFromJson(await readJsonObject(response), fallback);
}
