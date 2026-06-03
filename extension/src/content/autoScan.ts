import {
  DOMAIN_POLICY_CONTENT_STORAGE_KEYS,
  isAutoScanAllowedForCurrentPage,
} from "./domainPolicyStorage";
import { runWithExtensionContext } from "../lib/extensionContext";
import {
  setupDebouncedMutationRescan,
  teardownDebouncedMutationRescan,
} from "./mutationRescan";

let stopAutoScan: (() => void) | null = null;
let trackedHostname = "";

function readCurrentHostname(doc: Document = document): string {
  return doc.location.hostname.trim().toLowerCase();
}

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

export async function refreshAutoScanState(doc: Document = document): Promise<void> {
  const hostname = readCurrentHostname(doc);
  if (hostname !== trackedHostname) {
    trackedHostname = hostname;
  }

  const allowed = await isAutoScanAllowedForCurrentPage(doc);
  applyAutoScanEnabled(allowed);
}

export async function syncAutoScanWithStorage(
  doc: Document = document
): Promise<void> {
  trackedHostname = readCurrentHostname(doc);
  await refreshAutoScanState(doc);
}

export function setupAutoScanStorageListener(doc: Document = document): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    runWithExtensionContext(() => {
      if (areaName !== "local") {
        return;
      }

      const relevantChange = DOMAIN_POLICY_CONTENT_STORAGE_KEYS.some(
        (key) => key in changes
      );
      if (!relevantChange) {
        return;
      }

      void refreshAutoScanState(doc);
    });
  });
}

export { isAutoScanAllowedForCurrentPage };
