import type { MessageResponse } from "../lib/messages";
import { tabScanSnapshotMessage } from "../lib/messages";
import {
  rethrowUnlessStaleExtensionError,
  runWithExtensionContext,
  safeRuntimeSendMessage,
} from "../lib/extensionContext";
import {
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
  type TabScanSnapshotEntry,
} from "../lib/tabScanSnapshot";
import {
  CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED,
  getHighlightEnabledForContent,
} from "./highlightStorage";
import { getIncludePrivateIpv4ForContent } from "./includePrivateIpv4Storage";
import { getIocTypeEnabledForContent } from "./iocTypeEnabledStorage";
import { CONTENT_MESSAGE } from "./constants";
import { logIocDetectionCount } from "./devLog";
import {
  scanTextNodesForIocs,
  type DetectedIocInTextNode,
  type IocDetectorScanOptions,
} from "./detector";
import {
  clearIocHighlights,
  highlightDetectedIocs,
  type HighlightAnchorLink,
} from "./highlighter";

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
): HighlightAnchorLink[] {
  if (highlightEnabled) {
    return highlightDetectedIocs(matches, { root, clearExisting: true }).anchorLinks;
  }

  clearIocHighlights(root);
  return [];
}

export async function resolveIocDetectorScanOptions(): Promise<IocDetectorScanOptions> {
  const [includePrivateIpv4, enabledTypes] = await Promise.all([
    getIncludePrivateIpv4ForContent(),
    getIocTypeEnabledForContent(),
  ]);
  return { ioc: { includePrivateIpv4, enabledTypes } };
}

function buildScanSnapshotEntries(
  matches: ReadonlyArray<DetectedIocInTextNode>,
  anchorLinks: ReadonlyArray<HighlightAnchorLink>
): TabScanSnapshotEntry[] {
  if (anchorLinks.length > 0) {
    return anchorLinks.map(({ type, value, anchorId }) => ({
      type,
      value,
      anchorId,
    }));
  }

  return buildTabScanSnapshotEntriesFromMatches(matches);
}

export async function publishTabScanSnapshot(
  entries: ReadonlyArray<TabScanSnapshotEntry>
): Promise<void> {
  const snapshot = buildTabScanSnapshotPayload({
    pageUrl: window.location.href,
    entries: [...entries],
  });
  await safeRuntimeSendMessage(tabScanSnapshotMessage(snapshot));
}

export async function handleScanPageRequest(
  root: Node = document.body
): Promise<MessageResponse> {
  const scanOptions = await resolveIocDetectorScanOptions();
  const matches = scanTextNodesForIocs(root, scanOptions);
  const highlightEnabled = await getHighlightEnabledForContent();
  const anchorLinks = applyHighlightForScan(matches, root, highlightEnabled);
  const snapshotEntries = buildScanSnapshotEntries(matches, anchorLinks);
  await publishTabScanSnapshot(snapshotEntries);
  logIocDetectionCount(matches.length);
  return { ok: true, payload: { count: matches.length } };
}

export function setupScanPageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isScanPageMessage(message)) {
      return false;
    }
    void handleScanPageRequest()
      .then(sendResponse)
      .catch((error) => {
        rethrowUnlessStaleExtensionError(error);
      });
    return true;
  });
}

export function setupHighlightStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    runWithExtensionContext(() => {
      if (areaName !== "local") {
        return;
      }
      if (changes[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]?.newValue === false) {
        clearIocHighlights(document.body);
      }
    });
  });
}
