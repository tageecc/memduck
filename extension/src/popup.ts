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
submitButton?.addEventListener("click", () => {
  void submitCapture();
});
