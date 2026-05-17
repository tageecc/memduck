import { describe, expect, it } from "vitest";

import { shouldDigestText } from "../src/lib/ask-routing";

describe("ask text routing", () => {
  it("keeps short summary questions on the ask path", () => {
    expect(shouldDigestText("总结一下最近保存的内容")).toBe(false);
    expect(shouldDigestText("summarize my latest AI notes")).toBe(false);
  });

  it("routes explicit save commands and long pasted text to digest", () => {
    expect(shouldDigestText("记住今天用户希望 ask 可以取消请求")).toBe(true);
    expect(shouldDigestText("save this product decision for later")).toBe(true);
    expect(shouldDigestText("长期记忆系统需要".repeat(40))).toBe(true);
  });
});
