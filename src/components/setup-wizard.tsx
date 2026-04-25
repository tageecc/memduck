"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import type { Dictionary } from "@/lib/i18n";
import type { ProviderKind, SetupState } from "@/lib/memduck/service";
import {
  createProviderDraft,
  defaultsForProviderKind,
  labelForProviderKind,
} from "@/lib/providers/provider-presets";

import { IngestComposer } from "./ingest-composer";

type PublicProviderProfile = {
  answerModel: string;
  apiKey: string;
  apiKeyMasked: string;
  baseUrl: string;
  createdAt: string;
  embeddingModel: string;
  hasApiKey: boolean;
  id: string;
  kind: ProviderKind;
  name: string;
  rerankModel: string;
  summarizeModel: string;
  updatedAt: string;
  visionModel: string;
};

export function SetupWizard({
  copy,
  initialSetupState,
}: {
  copy: Dictionary["setup"];
  initialSetupState: SetupState;
}) {
  const initialDraft = createProviderDraft("openai");
  const [setupState, setSetupState] = useState(initialSetupState);
  const [profiles, setProfiles] = useState<PublicProviderProfile[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState(initialDraft.name);
  const [providerKind, setProviderKind] = useState<ProviderKind>("openai");
  const [baseUrl, setBaseUrl] = useState(initialDraft.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [answerModel, setAnswerModel] = useState(initialDraft.answerModel);
  const [embeddingModel, setEmbeddingModel] = useState(
    initialDraft.embeddingModel,
  );
  const [rerankModel, setRerankModel] = useState(initialDraft.rerankModel);
  const [summarizeModel, setSummarizeModel] = useState(
    initialDraft.summarizeModel,
  );
  const [visionModel, setVisionModel] = useState(initialDraft.visionModel);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const providerDraftReady = Boolean(
    providerName.trim() &&
      baseUrl.trim() &&
      answerModel.trim() &&
      embeddingModel.trim() &&
      rerankModel.trim() &&
      summarizeModel.trim() &&
      visionModel.trim() &&
      (providerKind === "ollama" || apiKey.trim()),
  );
  const milestones = [
    {
      detail: setupState.providerConfigured ? copy.ready : copy.providerDetail,
      ready: setupState.providerConfigured,
      title: copy.providerTitle,
    },
    {
      detail: setupState.hasAnyMemories ? copy.ready : copy.firstMemoryDetail,
      ready: setupState.hasAnyMemories,
      title: copy.firstMemoryTitle,
    },
    {
      detail: setupState.hasAnyMemories
        ? copy.channelHint
        : copy.channelsDetail,
      ready: false,
      title: copy.channels,
    },
  ];
  const recommendedNextAction = !setupState.providerConfigured
    ? {
        ctaHref: "/get-started",
        ctaLabel: copy.openQuickstart,
        summary: copy.recommendedProvider,
        title: copy.recommended,
      }
    : !setupState.hasAnyMemories
      ? {
          ctaHref: "#first-memory",
          ctaLabel: copy.jumpFirstMemory,
          summary: copy.recommendedMemory,
          title: copy.recommended,
        }
      : {
          ctaHref: "/channels",
          ctaLabel: copy.openChannels,
          summary: copy.recommendedChannels,
          title: copy.recommended,
        };

  function applyProfile(profile: PublicProviderProfile) {
    setEditingProfileId(profile.id);
    setProviderKind(profile.kind);
    setProviderName(profile.name);
    setBaseUrl(
      profile.baseUrl || defaultsForProviderKind(profile.kind).baseUrl,
    );
    setApiKey("");
    setApiKeyMasked(profile.apiKeyMasked);
    setAnswerModel(profile.answerModel);
    setEmbeddingModel(profile.embeddingModel);
    setRerankModel(profile.rerankModel);
    setSummarizeModel(profile.summarizeModel);
    setVisionModel(profile.visionModel);
  }

  function resetDraft(kind: ProviderKind = "openai") {
    const defaults = createProviderDraft(kind);
    setEditingProfileId(null);
    setProviderKind(kind);
    setProviderName(defaults.name);
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
      <section
        className="panel panel-emphasis"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">{copy.introEyebrow}</p>
            <h2>{copy.introTitle}</h2>
          </div>
          <p className="panel-copy">{copy.introBody}</p>
        </div>
        <div className="overview-grid">
          {milestones.map((milestone) => (
            <div className="topic-card" key={milestone.title}>
              <div className="memory-card-header">
                <strong>{milestone.title}</strong>
                <span
                  className={
                    milestone.ready
                      ? "status-pill status-ready"
                      : "status-pill status-waiting"
                  }
                >
                  {milestone.ready ? copy.ready : copy.pending}
                </span>
              </div>
              <span>{milestone.detail}</span>
            </div>
          ))}
        </div>
        <div className="topic-card">
          <strong>{recommendedNextAction.title}</strong>
          <span>{recommendedNextAction.summary}</span>
          <div className="action-row">
            <Link
              className="primary-button"
              href={recommendedNextAction.ctaHref}
            >
              {recommendedNextAction.ctaLabel}
            </Link>
            <Link className="secondary-button" href="/channels">
              {copy.openChannels}
            </Link>
            {!setupState.needsOnboarding ? (
              <Link className="secondary-button" href="/">
                {copy.openWorkspace}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{copy.step1}</p>
            <h2>{copy.providerTitle}</h2>
          </div>
          <p className="panel-copy">{copy.providerDetail}</p>
        </div>

        <div className="choice-row">
          {(
            [
              "openai",
              "anthropic",
              "gemini",
              "ollama",
              "openai-compatible",
            ] as const
          ).map((kind) => (
            <button
              className={providerKind === kind ? "chip chip-active" : "chip"}
              key={kind}
              onClick={() => {
                setProviderKind(kind);
                if (!editingProfileId) {
                  const defaults = createProviderDraft(kind);
                  setProviderName(defaults.name);
                  setBaseUrl(defaults.baseUrl);
                  setAnswerModel(defaults.answerModel);
                  setEmbeddingModel(defaults.embeddingModel);
                  setRerankModel(defaults.rerankModel);
                  setSummarizeModel(defaults.summarizeModel);
                  setVisionModel(defaults.visionModel);
                }
              }}
              type="button"
            >
              {labelForProviderKind(kind)}
            </button>
          ))}
        </div>

        <div className="setup-fields">
          <label className="field">
            <span>{copy.profileName}</span>
            <input
              onChange={(event) => setProviderName(event.target.value)}
              placeholder="My provider"
              value={providerName}
            />
          </label>
          <label className="field">
            <span>{copy.baseUrl}</span>
            <input
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).baseUrl}
              value={baseUrl}
            />
          </label>
          <label className="field">
            <span>
              {providerKind === "ollama" ? copy.apiKeyOptional : copy.apiKey}
            </span>
            <input
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                apiKeyMasked
                  ? `Re-enter saved key (${apiKeyMasked})`
                  : providerKind === "ollama"
                    ? "Leave blank for local Ollama"
                    : "Paste a key"
              }
              type="password"
              value={apiKey}
            />
          </label>
          {editingProfileId && providerKind !== "ollama" ? (
            <p className="muted-copy">
              Provider updates are strict and self-contained. Re-enter the full
              API key before testing or saving this profile.
            </p>
          ) : null}
          <label className="field">
            <span>Summarize model</span>
            <input
              onChange={(event) => setSummarizeModel(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).summarizeModel}
              value={summarizeModel}
            />
          </label>
          <label className="field">
            <span>Embedding model</span>
            <input
              onChange={(event) => setEmbeddingModel(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).embeddingModel}
              value={embeddingModel}
            />
          </label>
          <label className="field">
            <span>Rerank model</span>
            <input
              onChange={(event) => setRerankModel(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).rerankModel}
              value={rerankModel}
            />
          </label>
          <label className="field">
            <span>Answer model</span>
            <input
              onChange={(event) => setAnswerModel(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).answerModel}
              value={answerModel}
            />
          </label>
          <label className="field">
            <span>Vision model</span>
            <input
              onChange={(event) => setVisionModel(event.target.value)}
              placeholder={defaultsForProviderKind(providerKind).visionModel}
              value={visionModel}
            />
          </label>
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            disabled={pending || !providerDraftReady}
            onClick={runProviderTest}
            type="button"
          >
            {pending ? copy.testing : copy.testDraft}
          </button>
          <button
            className="secondary-button"
            disabled={pending || !providerDraftReady}
            onClick={saveProviderProfile}
            type="button"
          >
            {editingProfileId ? copy.updateActivate : copy.saveActivate}
          </button>
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => resetDraft(providerKind)}
            type="button"
          >
            {copy.newDraft}
          </button>
        </div>
        {statusMessage ? (
          <p className="action-result">{statusMessage}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{copy.provider}</p>
            <h2>{copy.providerLibrary}</h2>
          </div>
        </div>
        {profiles.length > 0 ? (
          <div className="topic-list">
            {profiles.map((profile) => (
              <div className="topic-card" key={profile.id}>
                <strong>
                  {profile.name}
                  {profile.id === activeProviderId ? ` · ${copy.active}` : ""}
                </strong>
                <span>
                  {labelForProviderKind(profile.kind)}
                  {` · ${profile.baseUrl}`}
                </span>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    onClick={() => applyProfile(profile)}
                    type="button"
                  >
                    {copy.editDraft}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={profile.id === activeProviderId}
                    onClick={() => activateProfile(profile.id)}
                    type="button"
                  >
                    {copy.activate}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={profiles.length === 1}
                    onClick={() => deleteProfile(profile.id)}
                    type="button"
                  >
                    {copy.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">{copy.noProviders}</p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">{copy.setupState}</p>
        <div className="topic-list">
          <div className="topic-card">
            <strong>{copy.providerConnected}</strong>
            <span>
              {setupState.providerConfigured ? copy.ready : copy.pending}
            </span>
          </div>
          <div className="topic-card">
            <strong>{copy.firstMemory}</strong>
            <span>{setupState.hasAnyMemories ? copy.ready : copy.pending}</span>
          </div>
          <div className="topic-card">
            <strong>{copy.currentRuntime}</strong>
            <span>{setupState.providerKind ?? copy.noActiveProvider}</span>
          </div>
        </div>
      </section>

      {setupState.providerConfigured ? (
        <section className="panel" id="first-memory">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{copy.step2}</p>
              <h2>{copy.firstMemoryTitle}</h2>
            </div>
            <p className="panel-copy">{copy.firstMemoryDetail}</p>
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
            <p className="eyebrow">{copy.step3}</p>
            <h2>{copy.channelCenter}</h2>
          </div>
          <p className="panel-copy">{copy.channelHint}</p>
        </div>
        <div className="topic-list">
          <div className="topic-card">
            <strong>{copy.channelCenter}</strong>
            <span>{copy.channelsDetail}</span>
          </div>
          <div className="topic-card">
            <strong>Browser extension</strong>
            <span>pnpm extension:build</span>
          </div>
          <div className="topic-card">
            <strong>Telegram bot</strong>
            <span>memduck --with-telegram</span>
          </div>
        </div>
        <div className="action-row">
          <Link className="secondary-button" href="/channels">
            {copy.openChannels}
          </Link>
          {!setupState.needsOnboarding ? (
            <Link className="primary-button" href="/">
              {copy.openWorkspace}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
