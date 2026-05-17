import { describe, expect, it } from "vitest";

import { channelSaveStatusMessage } from "../src/lib/channels/readiness-copy";

describe("channel readiness copy", () => {
  it("labels incomplete native channel saves as drafts", () => {
    expect(
      channelSaveStatusMessage({
        missingFields: ["appKey", "appSecret", "robotCode"],
        ready: false,
        status: "webhook-adapter",
      }),
    ).toBe("已保存草稿；补全 appKey, appSecret, robotCode 后即可测试接入。");
  });

  it("keeps ready channel saves concise", () => {
    expect(
      channelSaveStatusMessage({
        missingFields: [],
        ready: true,
        status: "native",
      }),
    ).toBe("已保存。");
  });
});
