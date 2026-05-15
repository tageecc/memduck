import type { ChannelSettings, InputEnvelope } from "../memduck/types";
import type { ChannelCatalogId } from "./catalog";
import type {
  ChannelRuntimeDescriptor,
  ChannelRuntimeReadiness,
} from "./runtime-types";

export interface ChannelRuntimeAdapter<TConfig = unknown> {
  descriptor: ChannelRuntimeDescriptor;
  id: ChannelCatalogId;
  parseWebhook?(payload: unknown): InputEnvelope | null;
  readiness(settings: ChannelSettings): ChannelRuntimeReadiness;
  resolveConfig(
    settings: ChannelSettings,
    env: Record<string, string | undefined>,
  ): TConfig;
}
