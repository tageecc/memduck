import { getRuntimeDir } from "./runtime-path";
import { createMemduckService, type MemduckService } from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __memduckService: MemduckService | undefined;
}

export async function getMemduckService(): Promise<MemduckService> {
  if (!globalThis.__memduckService) {
    globalThis.__memduckService = createMemduckService({
      runtimeDir: getRuntimeDir(),
    });
  }

  return globalThis.__memduckService;
}
