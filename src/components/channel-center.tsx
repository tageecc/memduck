"use client";

import Link from "next/link";
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

  const extensionRuntime = diagnostics?.channels.extension;
  const telegramRuntime = diagnostics?.channels.telegram;
  const webRuntime = diagnostics?.channels.web;
  const connectedChannelCount = [
    extensionRuntime?.connected,
    telegramRuntime?.connected,
    webRuntime?.connected,
  ].filter(Boolean).length;
  const configuredChannelCount = [
    Boolean(settings.extension.captureBaseUrl),
    settings.telegram.hasBotToken,
    true,
  ].filter(Boolean).length;
  const providerLabel = diagnostics?.provider
    ? `${diagnostics.provider.name} · ${diagnostics.provider.kind}`
    : "No active provider";

  return (
    <div className="setup-layout">
      <section
        className="panel panel-emphasis"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Channel Health</p>
            <h2>See which surfaces are actually online right now</h2>
          </div>
          <p className="panel-copy">
            The channel center is where memduck&apos;s local entrypoints stop
            being implied and become inspectable: web, extension, Telegram, and
            the runtime state behind them.
          </p>
        </div>

        <div className="overview-grid">
          <div className="topic-card">
            <strong>Connected channels</strong>
            <span>{connectedChannelCount} live surfaces reporting in</span>
          </div>
          <div className="topic-card">
            <strong>Configured channels</strong>
            <span>{configuredChannelCount} surfaces have saved settings</span>
          </div>
          <div className="topic-card">
            <strong>Active provider</strong>
            <span>{providerLabel}</span>
          </div>
          <div className="topic-card">
            <strong>Knowledge state</strong>
            <span>
              {diagnostics
                ? `${diagnostics.stats.memoryCards} cards · ${diagnostics.stats.topics} topics`
                : "Waiting for runtime diagnostics"}
            </span>
          </div>
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            onClick={() => void loadChannelCenter()}
            type="button"
          >
            Refresh runtime doctor
          </button>
          <Link className="secondary-button" href="/get-started">
            Open quickstart
          </Link>
          <Link className="secondary-button" href="/setup">
            Revisit setup
          </Link>
        </div>
      </section>

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
          <div className="memory-card">
            <div className="memory-card-header">
              <strong>Web UI</strong>
              <span
                className={
                  settings.web.enabled
                    ? "status-pill status-ready"
                    : "status-pill status-waiting"
                }
              >
                {settings.web.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <span>
              {webRuntime?.label ??
                "The web UI is the system of record for inbox, ask, review, and topic inspection."}
            </span>
            <span>
              Keep this enabled unless you are intentionally disabling the main
              local UI.
            </span>
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
          <div className="memory-card">
            <div className="memory-card-header">
              <strong>Browser extension</strong>
              <span
                className={
                  extensionRuntime?.connected
                    ? "status-pill status-ready"
                    : "status-pill status-waiting"
                }
              >
                {extensionRuntime?.connected
                  ? "Connected"
                  : settings.extension.enabled
                    ? "Waiting"
                    : "Disabled"}
              </span>
            </div>
            <span>
              {extensionRuntime?.label ?? "Waiting for extension state."}
            </span>
            <span>
              Build the extension with <code>pnpm extension:build</code>, load
              it unpacked, then open the popup once so it can send a heartbeat.
            </span>
            <label className="field">
              <span>Capture base URL</span>
              <input
                onChange={(event) => updateExtensionBaseUrl(event.target.value)}
                value={settings.extension.captureBaseUrl}
              />
            </label>
            {connectionStatus?.extension?.metadata.version ? (
              <div className="topic-card">
                <strong>Reported metadata</strong>
                <span>
                  version {connectionStatus.extension.metadata.version}
                </span>
              </div>
            ) : null}
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
          <div className="memory-card">
            <div className="memory-card-header">
              <strong>Telegram bot</strong>
              <span
                className={
                  telegramRuntime?.connected
                    ? "status-pill status-ready"
                    : "status-pill status-waiting"
                }
              >
                {telegramRuntime?.connected
                  ? "Connected"
                  : settings.telegram.enabled
                    ? "Waiting"
                    : "Disabled"}
              </span>
            </div>
            <span>
              {telegramRuntime?.label ?? "Waiting for Telegram state."}
            </span>
            <span>
              Save the bot token here, then run <code>pnpm telegram:dev</code>{" "}
              or <code>pnpm memduck dev --with-telegram</code>. After that, send
              the bot a message so the runtime heartbeat shows up here.
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
            <p className="muted-copy">
              Channel saves are strict now: leaving this blank clears the stored
              Telegram token.
            </p>
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
              <div className="memory-card">
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
              <div className="memory-card">
                <strong>Capabilities</strong>
                <span>
                  embeddings {diagnostics.features.embeddings ? "on" : "off"} ·
                  rerank {diagnostics.features.rerank ? "on" : "off"} · vision{" "}
                  {diagnostics.features.vision ? "on" : "off"}
                </span>
              </div>
              <div className="memory-card">
                <strong>Knowledge state</strong>
                <span>
                  {diagnostics.stats.memoryCards} cards ·{" "}
                  {diagnostics.stats.topics} topics ·{" "}
                  {diagnostics.stats.compiledTopics} compiled topics
                </span>
              </div>
            </div>

            <div className="topic-list">
              <div className="memory-card">
                <strong>Extension</strong>
                <span>{diagnostics.channels.extension.label}</span>
              </div>
              <div className="memory-card">
                <strong>Telegram</strong>
                <span>{diagnostics.channels.telegram.label}</span>
              </div>
              <div className="memory-card">
                <strong>Web runtime</strong>
                <span>{diagnostics.channels.web.label}</span>
              </div>
            </div>
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
              <code>pnpm extension:build</code> then load the unpacked
              extension. The popup pings memduck and reports connection state
              here.
            </span>
          </div>
          <div className="topic-card">
            <strong>Telegram</strong>
            <span>
              With the token saved here, <code>pnpm telegram:dev</code> can boot
              without requiring <code>TELEGRAM_BOT_TOKEN</code>.
            </span>
          </div>
          <div className="topic-card">
            <strong>One command dev</strong>
            <span>
              <code>pnpm memduck init</code> once, then{" "}
              <code>pnpm memduck dev --with-telegram</code> for the full local
              stack.
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
