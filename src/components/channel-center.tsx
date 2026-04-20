"use client";

import { startTransition, useEffect, useState } from "react";

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/channels")
      .then((response) => {
        if (!response.ok) {
          return null;
        }

        return response.json() as Promise<{
          connectionStatus: {
            extension: ChannelConnectionStatus;
            telegram: ChannelConnectionStatus;
          };
          settings: PublicChannelSettings;
        }>;
      })
      .then((payload) => {
        if (payload?.settings) {
          setSettings(payload.settings);
          setConnectionStatus(payload.connectionStatus);
        }
      });
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
