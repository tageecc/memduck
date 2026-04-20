import { buildExtensionEnvelope } from "../../src/lib/channels/extension";

type StatusTone = "error" | "idle" | "success";

const baseUrlInput = document.querySelector<HTMLInputElement>("#baseUrl");
const depthSelect = document.querySelector<HTMLSelectElement>("#depth");
const useSelectionInput =
  document.querySelector<HTMLInputElement>("#useSelection");
const noteInput = document.querySelector<HTMLTextAreaElement>("#note");
const submitButton = document.querySelector<HTMLButtonElement>("#submit");
const statusNode = document.querySelector<HTMLParagraphElement>("#status");

function setStatus(message: string, tone: StatusTone = "idle") {
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getSelectionText(tabId?: number): Promise<string> {
  if (!tabId) {
    return "";
  }

  const results = await chrome.scripting.executeScript({
    func: () => globalThis.getSelection?.()?.toString() ?? "",
    target: { tabId },
  });

  return typeof results[0]?.result === "string" ? results[0].result : "";
}

async function restoreBaseUrl() {
  if (!baseUrlInput) {
    return;
  }

  const stored = await chrome.storage.local.get("memduckBaseUrl");
  const baseUrl =
    typeof stored.memduckBaseUrl === "string" ? stored.memduckBaseUrl : "";
  if (baseUrl) {
    baseUrlInput.value = baseUrl;
  }
}

async function heartbeat(baseUrl: string) {
  await fetch(new URL("/api/channels/heartbeat", baseUrl), {
    body: JSON.stringify({
      channel: "extension",
      metadata: {
        baseUrl,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function syncWithMemduck() {
  if (!baseUrlInput) {
    return;
  }

  const baseUrl = baseUrlInput.value.trim() || "http://127.0.0.1:3000";

  try {
    const settingsResponse = await fetch(
      new URL("/api/settings/channels", baseUrl),
    );
    if (settingsResponse.ok) {
      const payload = (await settingsResponse.json()) as {
        settings?: {
          extension?: { captureBaseUrl?: string };
        };
      };

      const configuredBaseUrl =
        payload.settings?.extension?.captureBaseUrl?.trim();
      if (configuredBaseUrl) {
        baseUrlInput.value = configuredBaseUrl;
      }
    }

    const setupResponse = await fetch(new URL("/api/setup-state", baseUrl));
    if (setupResponse.ok) {
      const setupState = (await setupResponse.json()) as {
        needsOnboarding?: boolean;
        providerConfigured?: boolean;
      };

      await heartbeat(baseUrlInput.value.trim() || baseUrl);
      await chrome.storage.local.set({
        memduckBaseUrl: baseUrlInput.value.trim() || baseUrl,
      });

      if (setupState.needsOnboarding) {
        setStatus("memduck is reachable. Finish setup in the web UI first.");
        return;
      }

      if (setupState.providerConfigured) {
        setStatus("Connected to memduck.", "success");
        return;
      }
    }

    setStatus("Connected, but setup is incomplete.");
  } catch {
    setStatus("Unable to reach memduck. Check the local URL.", "error");
  }
}

async function submitCapture() {
  if (
    !baseUrlInput ||
    !depthSelect ||
    !useSelectionInput ||
    !noteInput ||
    !submitButton
  ) {
    return;
  }

  submitButton.disabled = true;
  setStatus("Collecting page context...");

  try {
    const tab = await getActiveTab();
    if (!tab?.url) {
      throw new Error("Unable to read the current tab URL.");
    }

    const selectionText = await getSelectionText(tab.id);
    const baseUrl = baseUrlInput.value.trim() || "http://127.0.0.1:3000";
    const envelope = buildExtensionEnvelope({
      mode: depthSelect.value as "deep" | "quick" | "save",
      note: noteInput.value,
      pageTitle: tab.title ?? "",
      pageUrl: tab.url,
      selectionText,
      useSelectionAsText: useSelectionInput.checked,
    });

    const response = await fetch(new URL("/api/ingest", baseUrl), {
      body: JSON.stringify(envelope),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "memduck ingestion failed.");
    }

    const payload = (await response.json()) as {
      memoryCard: { title: string };
    };

    await chrome.storage.local.set({ memduckBaseUrl: baseUrl });
    await heartbeat(baseUrl);
    setStatus(`Saved: ${payload.memoryCard.title}`, "success");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown memduck error.";
    setStatus(message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

void restoreBaseUrl();
void syncWithMemduck();
baseUrlInput?.addEventListener("change", () => {
  void syncWithMemduck();
});
submitButton?.addEventListener("click", () => {
  void submitCapture();
});
