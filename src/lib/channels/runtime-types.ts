import type { ChannelCatalogId } from "./catalog";

export type ChannelRuntimeMode =
  | "bot-token"
  | "cli"
  | "gateway-webhook"
  | "local"
  | "oauth"
  | "qr"
  | "webhook";

export type ChannelRuntimeStatus = "adapter-planned" | "native" | "unsupported";

export interface ChannelRuntimeDescriptor {
  docsUrl: string;
  id: ChannelCatalogId;
  mode: ChannelRuntimeMode;
  requiredFields: string[];
  status: ChannelRuntimeStatus;
}

export interface ChannelRuntimeReadiness extends ChannelRuntimeDescriptor {
  enabled: boolean;
  missingFields: string[];
  ready: boolean;
}
