import { safeStorageLocalGet } from "../lib/extensionContext";
import { STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED } from "../lib/storage";

let cachedLocalLlmSummaryEnabled = false;

export function getCachedLocalLlmSummaryEnabled(): boolean {
  return cachedLocalLlmSummaryEnabled;
}

export function setCachedLocalLlmSummaryEnabledForTests(enabled: boolean): void {
  cachedLocalLlmSummaryEnabled = enabled;
}

export async function syncLocalLlmSummaryWithStorage(): Promise<void> {
  const result = await safeStorageLocalGet(STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED);
  const value = result[STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED];
  cachedLocalLlmSummaryEnabled = value === undefined ? false : Boolean(value);
}

export function setupLocalLlmSummaryStorageListener(): void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED];
    if (!change) {
      return;
    }
    cachedLocalLlmSummaryEnabled = Boolean(change.newValue);
  });
}
