import { safeStorageLocalGet } from "../lib/extensionContext";
import { STORAGE_KEY_LOCAL_BACKEND_ENABLED } from "../lib/storage";

let cachedLocalBackendEnabled = false;

export function getCachedLocalBackendEnabled(): boolean {
  return cachedLocalBackendEnabled;
}

export function setCachedLocalBackendEnabledForTests(enabled: boolean): void {
  cachedLocalBackendEnabled = enabled;
}

export async function syncLocalBackendWithStorage(): Promise<void> {
  const result = await safeStorageLocalGet(STORAGE_KEY_LOCAL_BACKEND_ENABLED);
  const value = result[STORAGE_KEY_LOCAL_BACKEND_ENABLED];
  cachedLocalBackendEnabled = value === undefined ? false : Boolean(value);
}

export function setupLocalBackendStorageListener(): void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY_LOCAL_BACKEND_ENABLED];
    if (!change) {
      return;
    }
    cachedLocalBackendEnabled = Boolean(change.newValue);
  });
}
