import { describe, expect, it } from "vitest";

import {
  errorMessageFromJson,
  readErrorMessage,
  readJsonObject,
  readJsonValue,
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

  it("can read JSON arrays for collection endpoints", async () => {
    await expect(
      readJsonValue(new Response(JSON.stringify(["card-1"]))),
    ).resolves.toEqual(["card-1"]);
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
