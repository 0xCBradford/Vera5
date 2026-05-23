import type { MessageResponse } from "../lib/messages";
import {
  CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED,
  getHighlightEnabledForContent,
} from "./highlightStorage";
import { CONTENT_MESSAGE } from "./constants";
import { logIocDetectionCount } from "./devLog";
import { scanTextNodesForIocs, type DetectedIocInTextNode } from "./detector";
import { clearIocHighlights, highlightDetectedIocs } from "./highlighter";

export function isScanPageMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.SCAN_PAGE } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.SCAN_PAGE
  );
}

export function applyHighlightForScan(
  matches: ReadonlyArray<DetectedIocInTextNode>,
  root: Node,
  highlightEnabled: boolean
): void {
  if (highlightEnabled) {
    highlightDetectedIocs(matches, { root, clearExisting: true });
    return;
  }

  clearIocHighlights(root);
}

export async function handleScanPageRequest(
  root: Node = document.body
): Promise<MessageResponse> {
  const matches = scanTextNodesForIocs(root);
  const highlightEnabled = await getHighlightEnabledForContent();
  applyHighlightForScan(matches, root, highlightEnabled);
  logIocDetectionCount(matches.length);
  return { ok: true, payload: { count: matches.length } };
}

export function setupScanPageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isScanPageMessage(message)) {
      return false;
    }
    void handleScanPageRequest().then(sendResponse);
    return true;
  });
}

export function setupHighlightStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]?.newValue === false) {
      clearIocHighlights(document.body);
    }
  });
}
