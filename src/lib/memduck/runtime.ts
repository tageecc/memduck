import {
  createMemduckService,
  type InputEnvelope,
  type MemduckService,
} from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __memduckService: MemduckService | undefined;
}

function createSeedEnvelopes(): InputEnvelope[] {
  return [
    {
      kind: "url",
      payload: { url: "https://example.com/personal-memory-engine" },
      requestedDepth: "quick",
      sourceChannel: "web",
      sourceContext: {
        pageTitle:
          "Why personal memory systems need digestion, not just storage",
        tags: ["memory", "research", "systems"],
      },
    },
    {
      kind: "text",
      payload: {
        text: "Creators save references quickly, but those references only become useful when they are compressed, linked, and easy to reopen with context.",
      },
      requestedDepth: "deep",
      sourceChannel: "extension",
      sourceContext: {
        caption: "Creator workflow note",
      },
    },
    {
      kind: "image",
      payload: {
        fileName: "topic-cluster.png",
        mimeType: "image/png",
        objectKey: "uploads/topic-cluster.png",
      },
      requestedDepth: "deep",
      sourceChannel: "telegram",
      sourceContext: {
        caption: "Screenshot of a topic cluster board for retrieval practice",
      },
    },
  ];
}

async function seed(service: MemduckService) {
  if (service.listMemoryCards().length > 0) {
    return service;
  }

  for (const envelope of createSeedEnvelopes()) {
    await service.ingest(envelope);
  }

  return service;
}

export async function getMemduckService(): Promise<MemduckService> {
  if (!globalThis.__memduckService) {
    globalThis.__memduckService = createMemduckService({
      runtimeDir:
        process.env.MEMDUCK_RUNTIME_DIR ?? `${process.cwd()}/.memduck/runtime`,
    });
    await seed(globalThis.__memduckService);
  }

  return globalThis.__memduckService;
}
