import { getRuntimeDir } from "./runtime-path";
import {
  createMemduckService,
  MEMDUCK_SERVICE_RUNTIME_VERSION,
  type MemduckService,
} from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __memduckService: MemduckService | undefined;
  // eslint-disable-next-line no-var
  var __memduckServiceRuntimeVersion: number | undefined;
}

export async function getMemduckService(): Promise<MemduckService> {
  if (
    !globalThis.__memduckService ||
    globalThis.__memduckServiceRuntimeVersion !==
      MEMDUCK_SERVICE_RUNTIME_VERSION
  ) {
    globalThis.__memduckService = createMemduckService({
      runtimeDir: getRuntimeDir(),
    });
    globalThis.__memduckServiceRuntimeVersion = MEMDUCK_SERVICE_RUNTIME_VERSION;
  }

  return globalThis.__memduckService;
}
