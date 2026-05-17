import type { ChannelRuntimeReadiness } from "./runtime-types";

type ChannelSaveReadiness = Pick<
  ChannelRuntimeReadiness,
  "missingFields" | "ready" | "status"
>;

export function channelSaveStatusMessage(readiness?: ChannelSaveReadiness) {
  if (!readiness) {
    return "已保存。";
  }

  if (readiness.status !== "native" && readiness.status !== "webhook-adapter") {
    return "已保存；该渠道运行时仍在接入中。";
  }

  if (!readiness.ready && readiness.missingFields.length > 0) {
    return `已保存草稿；补全 ${readiness.missingFields.join(", ")} 后即可测试接入。`;
  }

  if (!readiness.ready) {
    return "已保存草稿；补全必填字段后即可测试接入。";
  }

  return "已保存。";
}
