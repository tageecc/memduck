import {
  errorMessageFromJson,
  type JsonObject,
  readJsonObject,
} from "@/lib/http/response";

export const PROVIDER_TEST_TIMEOUT_MS = 30_000;
export const PROVIDER_TEST_TIMEOUT_MESSAGE =
  "Provider 连接测试超时，请稍后重试或检查模型配置。";

type ProviderTestPayload = {
  apiKey?: string;
  baseUrl?: string;
  id?: string;
  model: string;
  providerId: string;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function testProviderSettings(
  payload: ProviderTestPayload,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PROVIDER_TEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/api/settings/provider/test", {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    const responsePayload = (await readJsonObject(
      response,
    )) as JsonObject | null;

    if (!response.ok) {
      throw new Error(
        errorMessageFromJson(responsePayload, "Provider 连接测试失败。"),
      );
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(PROVIDER_TEST_TIMEOUT_MESSAGE);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
