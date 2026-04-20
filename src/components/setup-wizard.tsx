"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import type { SetupState } from "@/lib/memduck/service";

import { IngestComposer } from "./ingest-composer";

type ProviderKind =
  | "anthropic"
  | "gemini"
  | "mock"
  | "ollama"
  | "openai"
  | "openai-compatible";

type PublicProviderProfile =
  | {
      createdAt: string;
      id: string;
      kind: "mock";
      name: string;
      updatedAt: string;
    }
  | {
      answerModel: string;
      apiKey: string;
      apiKeyMasked: string;
      baseUrl: string;
      createdAt: string;
      embeddingModel: string;
      hasApiKey: boolean;
      id: string;
      kind: Exclude<ProviderKind, "mock">;
      name: string;
      rerankModel: string;
      summarizeModel: string;
      updatedAt: string;
      visionModel: string;
    };

function defaultsForKind(kind: ProviderKind) {
  if (kind === "openai") {
    return {
      answerModel: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      rerankModel: "gpt-4.1-mini",
      summarizeModel: "gpt-4.1-mini",
      visionModel: "gpt-4.1-mini",
    };
  }

  if (kind === "anthropic") {
    return {
      answerModel: "claude-sonnet-4-20250514",
      baseUrl: "https://api.anthropic.com",
      embeddingModel: "claude-sonnet-4-20250514",
      rerankModel: "claude-sonnet-4-20250514",
      summarizeModel: "claude-sonnet-4-20250514",
      visionModel: "claude-sonnet-4-20250514",
    };
  }

  if (kind === "gemini") {
    return {
      answerModel: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      embeddingModel: "text-embedding-004",
      rerankModel: "gemini-2.5-flash",
      summarizeModel: "gemini-2.5-flash",
      visionModel: "gemini-2.5-flash",
    };
  }

  if (kind === "ollama") {
    return {
      answerModel: "qwen2.5:7b-instruct",
      baseUrl: "http://127.0.0.1:11434/v1",
      embeddingModel: "nomic-embed-text",
      rerankModel: "qwen2.5:7b-instruct",
      summarizeModel: "qwen2.5:7b-instruct",
      visionModel: "llava:7b",
    };
  }

  return {
    answerModel: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    embeddingModel: "text-embedding-3-small",
    rerankModel: "gpt-4.1-mini",
    summarizeModel: "gpt-4.1-mini",
    visionModel: "gpt-4.1-mini",
  };
}

function labelForKind(kind: ProviderKind) {
  switch (kind) {
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    case "ollama":
      return "Ollama";
    case "openai":
      return "OpenAI";
    case "openai-compatible":
      return "OpenAI-compatible";
    default:
      return "Mock / Demo";
  }
}

export function SetupWizard({
  initialSetupState,
}: {
  initialSetupState: SetupState;
}) {
  const [setupState, setSetupState] = useState(initialSetupState);
  const [profiles, setProfiles] = useState<PublicProviderProfile[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState("Primary Provider");
  const [providerKind, setProviderKind] = useState<ProviderKind>("openai");
  const [baseUrl, setBaseUrl] = useState(defaultsForKind("openai").baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [answerModel, setAnswerModel] = useState(
    defaultsForKind("openai").answerModel,
  );
  const [embeddingModel, setEmbeddingModel] = useState(
    defaultsForKind("openai").embeddingModel,
  );
  const [rerankModel, setRerankModel] = useState(
    defaultsForKind("openai").rerankModel,
  );
  const [summarizeModel, setSummarizeModel] = useState(
    defaultsForKind("openai").summarizeModel,
  );
  const [visionModel, setVisionModel] = useState(
    defaultsForKind("openai").visionModel,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function applyProfile(profile: PublicProviderProfile) {
    setEditingProfileId(profile.id);
    setProviderKind(profile.kind);
    setProviderName(profile.name);

    if (profile.kind === "mock") {
      const defaults = defaultsForKind("openai");
      setBaseUrl(defaults.baseUrl);
      setApiKey("");
      setApiKeyMasked("");
      setAnswerModel(defaults.answerModel);
      setEmbeddingModel(defaults.embeddingModel);
      setRerankModel(defaults.rerankModel);
      setSummarizeModel(defaults.summarizeModel);
      setVisionModel(defaults.visionModel);
      return;
    }

    setBaseUrl(profile.baseUrl || defaultsForKind(profile.kind).baseUrl);
    setApiKey("");
    setApiKeyMasked(profile.apiKeyMasked);
    setAnswerModel(profile.answerModel);
    setEmbeddingModel(profile.embeddingModel);
    setRerankModel(profile.rerankModel);
    setSummarizeModel(profile.summarizeModel);
    setVisionModel(profile.visionModel);
  }

  function resetDraft(kind: ProviderKind = "openai") {
    const defaults = defaultsForKind(kind);
    setEditingProfileId(null);
    setProviderKind(kind);
    setProviderName(`${labelForKind(kind)} Provider`);
    setBaseUrl(defaults.baseUrl);
    setApiKey("");
    setApiKeyMasked("");
    setAnswerModel(defaults.answerModel);
    setEmbeddingModel(defaults.embeddingModel);
    setRerankModel(defaults.rerankModel);
    setSummarizeModel(defaults.summarizeModel);
    setVisionModel(defaults.visionModel);
  }

  async function refreshSetupState() {
    const response = await fetch("/api/setup-state");
    if (!response.ok) {
      return;
    }

    setSetupState((await response.json()) as SetupState);
  }

  const refreshProviders = useEffectEvent(async () => {
    const response = await fetch("/api/settings/providers");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      activeProviderId: string | null;
      profiles: PublicProviderProfile[];
    };

    setProfiles(payload.profiles);
    setActiveProviderId(payload.activeProviderId);

    if (payload.profiles.length === 0) {
      resetDraft("openai");
      return;
    }

    const active =
      payload.profiles.find(
        (profile) => profile.id === payload.activeProviderId,
      ) ?? payload.profiles[0];

    if (active) {
      applyProfile(active);
    }
  });

  useEffect(() => {
    void refreshProviders();
  }, []);

  function buildSettingsPayload() {
    if (providerKind === "mock") {
      return { kind: "mock" as const };
    }

    return {
      answerModel,
      apiKey,
      baseUrl,
      embeddingModel,
      kind: providerKind,
      rerankModel,
      summarizeModel,
      visionModel,
    };
  }

  async function runProviderTest() {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/settings/provider/test", {
        body: JSON.stringify(buildSettingsPayload()),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Provider test failed.");
          }

          setStatusMessage(
            payload.message ?? "Provider test succeeded. The draft is usable.",
          );
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  async function saveProviderProfile() {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({
          ...buildSettingsPayload(),
          id: editingProfileId ?? undefined,
          makeActive: true,
          name: providerName,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Provider save failed.");
          }

          await refreshProviders();
          await refreshSetupState();
          setStatusMessage("Provider profile saved and activated.");
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  async function activateProfile(profileId: string) {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/settings/providers/activate", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to activate provider.");
          }

          await refreshProviders();
          await refreshSetupState();
          setStatusMessage("Active provider switched.");
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  async function deleteProfile(profileId: string) {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to delete provider.");
          }

          await refreshProviders();
          await refreshSetupState();
          setStatusMessage("Provider profile removed.");
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  return (
    <div className="setup-layout">
      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Connect and manage model providers</h2>
          </div>
          <p className="panel-copy">
            memduck can keep several providers on hand and switch the active one
            without redoing setup from scratch.
          </p>
        </div>

        <div className="choice-row">
          {(
            [
              "openai",
              "anthropic",
              "gemini",
              "ollama",
              "openai-compatible",
              "mock",
            ] as const
          ).map((kind) => (
            <button
              className={providerKind === kind ? "chip chip-active" : "chip"}
              key={kind}
              onClick={() => {
                setProviderKind(kind);
                if (!editingProfileId) {
                  const defaults = defaultsForKind(kind);
                  setProviderName(`${labelForKind(kind)} Provider`);
                  setBaseUrl(defaults.baseUrl);
                  setAnswerModel(defaults.answerModel);
                  setSummarizeModel(defaults.summarizeModel);
                  setVisionModel(defaults.visionModel);
                }
              }}
              type="button"
            >
              {labelForKind(kind)}
            </button>
          ))}
        </div>

        <div className="setup-fields">
          <label className="field">
            <span>Profile name</span>
            <input
              onChange={(event) => setProviderName(event.target.value)}
              placeholder="My provider"
              value={providerName}
            />
          </label>

          {providerKind !== "mock" ? (
            <>
              <label className="field">
                <span>Base URL</span>
                <input
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder={defaultsForKind(providerKind).baseUrl}
                  value={baseUrl}
                />
              </label>
              <label className="field">
                <span>API key</span>
                <input
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    apiKeyMasked ? `Saved key: ${apiKeyMasked}` : "Paste a key"
                  }
                  type="password"
                  value={apiKey}
                />
              </label>
              <label className="field">
                <span>Summarize model</span>
                <input
                  onChange={(event) => setSummarizeModel(event.target.value)}
                  placeholder={defaultsForKind(providerKind).summarizeModel}
                  value={summarizeModel}
                />
              </label>
              <label className="field">
                <span>Embedding model</span>
                <input
                  onChange={(event) => setEmbeddingModel(event.target.value)}
                  placeholder={defaultsForKind(providerKind).embeddingModel}
                  value={embeddingModel}
                />
              </label>
              <label className="field">
                <span>Rerank model</span>
                <input
                  onChange={(event) => setRerankModel(event.target.value)}
                  placeholder={defaultsForKind(providerKind).rerankModel}
                  value={rerankModel}
                />
              </label>
              <label className="field">
                <span>Answer model</span>
                <input
                  onChange={(event) => setAnswerModel(event.target.value)}
                  placeholder={defaultsForKind(providerKind).answerModel}
                  value={answerModel}
                />
              </label>
              <label className="field">
                <span>Vision model</span>
                <input
                  onChange={(event) => setVisionModel(event.target.value)}
                  placeholder={defaultsForKind(providerKind).visionModel}
                  value={visionModel}
                />
              </label>
            </>
          ) : (
            <p className="muted-copy">
              Mock mode is useful for demos, screenshots, or open source
              contributors who want to inspect the full flow before wiring a
              real provider.
            </p>
          )}
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            disabled={pending}
            onClick={runProviderTest}
            type="button"
          >
            {pending ? "Testing..." : "Test draft"}
          </button>
          <button
            className="secondary-button"
            disabled={pending || !providerName.trim()}
            onClick={saveProviderProfile}
            type="button"
          >
            {editingProfileId ? "Update + activate" : "Save + activate"}
          </button>
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => resetDraft(providerKind)}
            type="button"
          >
            New draft
          </button>
        </div>
        {statusMessage ? (
          <p className="action-result">{statusMessage}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Provider library</p>
            <h2>Saved providers and active runtime</h2>
          </div>
        </div>
        {profiles.length > 0 ? (
          <div className="topic-list">
            {profiles.map((profile) => (
              <div className="topic-card" key={profile.id}>
                <strong>
                  {profile.name}
                  {profile.id === activeProviderId ? " · active" : ""}
                </strong>
                <span>
                  {labelForKind(profile.kind)}
                  {profile.kind !== "mock" && "baseUrl" in profile
                    ? ` · ${profile.baseUrl || "default endpoint"}`
                    : ""}
                </span>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    onClick={() => applyProfile(profile)}
                    type="button"
                  >
                    Edit draft
                  </button>
                  <button
                    className="secondary-button"
                    disabled={profile.id === activeProviderId}
                    onClick={() => activateProfile(profile.id)}
                    type="button"
                  >
                    Activate
                  </button>
                  <button
                    className="secondary-button"
                    disabled={profiles.length === 1}
                    onClick={() => deleteProfile(profile.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            No provider profiles yet. Save one working provider and memduck can
            start producing real memory cards.
          </p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Setup state</p>
        <div className="topic-list">
          <div className="topic-card">
            <strong>Provider connected</strong>
            <span>{setupState.providerConfigured ? "Yes" : "Not yet"}</span>
          </div>
          <div className="topic-card">
            <strong>First real memory</strong>
            <span>{setupState.hasAnyMemories ? "Created" : "Not yet"}</span>
          </div>
          <div className="topic-card">
            <strong>Current runtime</strong>
            <span>{setupState.providerKind ?? "No active provider"}</span>
          </div>
        </div>
      </section>

      {setupState.providerConfigured ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Create the first real memory card</h2>
            </div>
            <p className="panel-copy">
              Paste one link, note, or screenshot here. The product should feel
              real after the first genuine memory card appears.
            </p>
          </div>
          <IngestComposer
            onSubmitted={() => {
              void refreshSetupState();
            }}
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Open the channel center and keep going</h2>
          </div>
          <p className="panel-copy">
            memduck stays simple in development, but the web UI should still
            expose where Telegram and the extension hook in.
          </p>
        </div>
        <div className="topic-list">
          <div className="topic-card">
            <strong>Channel center</strong>
            <span>Configure Telegram and extension defaults visually.</span>
          </div>
          <div className="topic-card">
            <strong>Browser extension</strong>
            <span>Build with `pnpm extension:build` and load unpacked.</span>
          </div>
          <div className="topic-card">
            <strong>Telegram bot</strong>
            <span>
              Store the bot token in Channels, then run `pnpm telegram:dev`.
            </span>
          </div>
        </div>
        <div className="action-row">
          <Link className="secondary-button" href="/channels">
            Open channels
          </Link>
          {!setupState.needsOnboarding ? (
            <Link className="primary-button" href="/">
              Open memduck
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
