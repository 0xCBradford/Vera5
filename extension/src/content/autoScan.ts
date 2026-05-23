import {
  CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED,
  getAutoScanEnabledForContent,
} from "./autoScanStorage";
import {
  setupDebouncedMutationRescan,
  teardownDebouncedMutationRescan,
} from "./mutationRescan";

let stopAutoScan: (() => void) | null = null;

export function applyAutoScanEnabled(enabled: boolean): void {
  if (stopAutoScan) {
    stopAutoScan();
    stopAutoScan = null;
  }

  if (!enabled) {
    teardownDebouncedMutationRescan();
    return;
  }

  stopAutoScan = setupDebouncedMutationRescan({ enabled: true });
}

export async function syncAutoScanWithStorage(): Promise<void> {
  const enabled = await getAutoScanEnabledForContent();
  applyAutoScanEnabled(enabled);
}

export function setupAutoScanStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (!(CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED in changes)) {
      return;
    }

    const newValue = changes[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED]?.newValue;
    applyAutoScanEnabled(Boolean(newValue));
  });
}
