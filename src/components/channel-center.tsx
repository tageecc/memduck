"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { RuntimeDiagnostics } from "@/lib/memduck/service";

type PublicChannelSettings = {
  extension: {
    captureBaseUrl: string;
    enabled: boolean;
  };
  telegram: {
    baseUrl: string;
    botToken: string;
    botUsername?: string;
    enabled: boolean;
    hasBotToken: boolean;
  };
  web: {
    enabled: boolean;
  };
};

type ChannelConnectionStatus = {
  lastHeartbeatAt: string;
  metadata: Record<string, string>;
} | null;

export function ChannelCenter() {
  const [settings, setSettings] = useState<PublicChannelSettings | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    extension: ChannelConnectionStatus;
    telegram: ChannelConnectionStatus;
  } | null>(null);
  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadChannelCenter = useEffectEvent(async () => {
    const response = await fetch("/api/settings/channels");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      connectionStatus: {
        extension: ChannelConnectionStatus;
        telegram: ChannelConnectionStatus;
      };
      diagnostics: RuntimeDiagnostics;
      settings: PublicChannelSettings;
    };

    setSettings(payload.settings);
    setConnectionStatus(payload.connectionStatus);
    setDiagnostics(payload.diagnostics);
  });

  useEffect(() => {
    void loadChannelCenter();
  }, []);

  function updateTelegram(
    field: "baseUrl" | "botToken" | "botUsername",
    value: string,
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            telegram: {
              ...current.telegram,
              [field]: value,
            },
          }
        : current,
    );
  }

  function updateExtensionBaseUrl(value: string) {
    setSettings((current) =>
      current
        ? {
            ...current,
            extension: {
              ...current.extension,
              captureBaseUrl: value,
            },
          }
        : current,
    );
  }

  function toggleChannel(channel: "extension" | "telegram" | "web") {
    setSettings((current) =>
      current
        ? {
            ...current,
            [channel]: {
              ...current[channel],
              enabled: !current[channel].enabled,
            },
          }
        : current,
    );
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/settings/channels", {
        body: JSON.stringify(settings),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            connectionStatus?: {
              extension: ChannelConnectionStatus;
              telegram: ChannelConnectionStatus;
            };
            diagnostics?: RuntimeDiagnostics;
            error?: string;
            settings?: PublicChannelSettings;
          };

          if (!response.ok) {
            throw new Error(
              payload.error ?? "Unable to save channel settings.",
            );
          }

          if (payload.settings) {
            setSettings(payload.settings);
          }
          if ("connectionStatus" in payload && payload.connectionStatus) {
            setConnectionStatus(payload.connectionStatus);
          }
          if ("diagnostics" in payload && payload.diagnostics) {
            setDiagnostics(payload.diagnostics);
          }

          setStatusMessage("Channel center saved.");
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  if (!settings) {
    return (
      <section className="panel">
        <p className="muted-copy">Loading channel settings...</p>
      </section>
    );
  }

  return (
    <div className="setup-layout">
      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Channel Center</p>
            <h2>Configure where memduck listens and replies</h2>
          </div>
          <p className="panel-copy">
            Keep channels lightweight in dev, but make their runtime settings
            visible and editable in the UI.
          </p>
        </div>

        <div className="topic-list">
          <div className="topic-card">
            <strong>Web UI</strong>
            <span>{settings.web.enabled ? "Enabled" : "Disabled"}</span>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() => toggleChannel("web")}
                type="button"
              >
                Toggle
              </button>
            </div>
          </div>
          <div className="topic-card">
            <strong>Browser extension</strong>
            <span>
              {settings.extension.enabled ? "Enabled" : "Disabled"}
              {connectionStatus?.extension
                ? ` · last seen ${new Date(connectionStatus.extension.lastHeartbeatAt).toLocaleTimeString()}`
                : " · no heartbeat yet"}
            </span>
            <label className="field">
              <span>Capture base URL</span>
              <input
                onChange={(event) => updateExtensionBaseUrl(event.target.value)}
                value={settings.extension.captureBaseUrl}
              />
            </label>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() => toggleChannel("extension")}
                type="button"
              >
                Toggle
              </button>
            </div>
          </div>
          <div className="topic-card">
            <strong>Telegram bot</strong>
            <span>
              {settings.telegram.enabled ? "Enabled" : "Disabled"}
              {settings.telegram.hasBotToken ? " · token saved" : " · no token"}
              {connectionStatus?.telegram
                ? ` · last seen ${new Date(connectionStatus.telegram.lastHeartbeatAt).toLocaleTimeString()}`
                : ""}
            </span>
            <label className="field">
              <span>Bot token</span>
              <input
                onChange={(event) =>
                  updateTelegram("botToken", event.target.value)
                }
                placeholder={
                  settings.telegram.hasBotToken
                    ? "Saved token is masked on the server"
                    : "123456:ABC..."
                }
                type="password"
                value={settings.telegram.botToken}
              />
            </label>
            <label className="field">
              <span>Bot username</span>
              <input
                onChange={(event) =>
                  updateTelegram("botUsername", event.target.value)
                }
                placeholder="@memduck_bot"
                value={settings.telegram.botUsername ?? ""}
              />
            </label>
            <label className="field">
              <span>memduck base URL</span>
              <input
                onChange={(event) =>
                  updateTelegram("baseUrl", event.target.value)
                }
                value={settings.telegram.baseUrl}
              />
            </label>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() => toggleChannel("telegram")}
                type="button"
              >
                Toggle
              </button>
            </div>
          </div>
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            disabled={pending}
            onClick={saveSettings}
            type="button"
          >
            {pending ? "Saving..." : "Save channel center"}
          </button>
        </div>
        {statusMessage ? (
          <p className="action-result">{statusMessage}</p>
        ) : null}
      </section>

      {diagnostics ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Runtime Doctor</p>
              <h2>See whether memduck is actually ready</h2>
            </div>
            <p className="panel-copy">
              This mirrors the local runtime state so you can diagnose provider,
              channel, and compilation readiness without leaving the browser.
            </p>
          </div>
          <div className="detail-grid">
            <div className="topic-list">
              <div className="topic-card">
                <strong>
                  {diagnostics.provider
                    ? diagnostics.provider.name
                    : "No active provider"}
                </strong>
                <span>
                  {diagnostics.provider
                    ? `${diagnostics.provider.kind} · provider active`
                    : "Complete setup to activate a provider"}
                </span>
              </div>
              <div className="topic-card">
                <strong>Capabilities</strong>
                <span>
                  embeddings {diagnostics.features.embeddings ? "on" : "off"} ·
                  rerank {diagnostics.features.rerank ? "on" : "off"} · vision{" "}
                  {diagnostics.features.vision ? "on" : "off"}
                </span>
              </div>
              <div className="topic-card">
                <strong>Knowledge state</strong>
                <span>
                  {diagnostics.stats.memoryCards} cards ·{" "}
                  {diagnostics.stats.topics} topics ·{" "}
                  {diagnostics.stats.compiledTopics} compiled topics
                </span>
              </div>
            </div>

            <div className="topic-list">
              <div className="topic-card">
                <strong>Extension</strong>
                <span>{diagnostics.channels.extension.label}</span>
              </div>
              <div className="topic-card">
                <strong>Telegram</strong>
                <span>{diagnostics.channels.telegram.label}</span>
              </div>
              <div className="topic-card">
                <strong>Web runtime</strong>
                <span>{diagnostics.channels.web.label}</span>
              </div>
            </div>
          </div>

          <div className="action-row">
            <button
              className="secondary-button"
              onClick={() => void loadChannelCenter()}
              type="button"
            >
              Refresh runtime doctor
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Runtime notes</p>
            <h2>What to run next</h2>
          </div>
        </div>
        <div className="topic-list">
          <div className="topic-card">
            <strong>Extension</strong>
            <span>
              `pnpm extension:build` then load the unpacked extension. The popup
              now pings memduck and reports connection state here.
            </span>
          </div>
          <div className="topic-card">
            <strong>Telegram</strong>
            <span>
              With the token saved here, `pnpm telegram:dev` can boot without
              requiring `TELEGRAM_BOT_TOKEN`.
            </span>
          </div>
          <div className="topic-card">
            <strong>One command dev</strong>
            <span>
              `pnpm memduck init` once, then `pnpm memduck dev --with-telegram`
              for the full local stack.
            </span>
          </div>
          <div className="topic-card">
            <strong>Web</strong>
            <span>
              The web UI remains the system of record for inbox, ask, review,
              and topic inspection.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
