import { describe, expect, it } from "vitest";

import {
  errorMessageFromJson,
  readErrorMessage,
  readJsonObject,
} from "../src/lib/http/response";

describe("response helpers", () => {
  it("reads JSON objects without accepting arrays or primitives", async () => {
    await expect(
      readJsonObject(
        new Response(JSON.stringify({ error: "Bad response" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    ).resolves.toEqual({ error: "Bad response" });

    await expect(
      readJsonObject(new Response(JSON.stringify(["bad"]))),
    ).resolves.toBeNull();

    await expect(readJsonObject(new Response("not json"))).resolves.toBeNull();
  });

  it("returns stable fallback errors for malformed response bodies", async () => {
    await expect(
      readErrorMessage(new Response("upstream html"), "Provider 保存失败。"),
    ).resolves.toBe("Provider 保存失败。");

    expect(
      errorMessageFromJson({ error: "Provider timed out." }, "fallback"),
    ).toBe("Provider timed out.");
  });
});
