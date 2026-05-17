import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROVIDER_TEST_TIMEOUT_MESSAGE,
  PROVIDER_TEST_TIMEOUT_MS,
  testProviderSettings,
} from "../src/lib/http/provider-test";

const payload = {
  apiKey: "sk-test",
  model: "gpt-4.1",
  providerId: "openai",
};

describe("provider test client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("posts provider settings to the test API", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await testProviderSettings(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/provider/test",
      expect.objectContaining({
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
  });

  it("localizes client-side provider test timeouts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const result = expect(testProviderSettings(payload)).rejects.toThrow(
      PROVIDER_TEST_TIMEOUT_MESSAGE,
    );

    await vi.advanceTimersByTimeAsync(PROVIDER_TEST_TIMEOUT_MS);
    await result;
  });
});
