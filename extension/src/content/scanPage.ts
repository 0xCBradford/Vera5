import type { MessageResponse } from "../lib/messages";
import { tabScanSnapshotMessage } from "../lib/messages";
import {
  logUnlessBenignExtensionError,
  runWithExtensionContext,
  safeRuntimeSendMessage,
} from "../lib/extensionContext";
import {
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
  type TabScanSnapshotEntry,
  type TabScanSnapshotPayload,
} from "../lib/tabScanSnapshot";
import {
  mergeVisibleTextAndAttributeIocMatches,
  pageIocScanMatchesToHighlightInput,
  scanAllowlistedAttributesForIocsWithProfile,
  type DetectedIocInAttribute,
  type PageIocScanMatch,
} from "./attributeHrefExtractor";
import { isAttributeHrefExtractionEnabledForCurrentPage } from "./attributeHrefExtractionStorage";
import {
  CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED,
  getHighlightEnabledForContent,
} from "./highlightStorage";
import { getIncludePrivateIpv4ForContent } from "./includePrivateIpv4Storage";
import { getIocTypeEnabledForContent } from "./iocTypeEnabledStorage";
import { CONTENT_MESSAGE } from "./constants";
import { logIocDetectionCount, logIocScanProfile } from "./devLog";
import {
  resolveMaxIocsPerScan,
  scanTextNodesForIocsInRangeWithProfile,
  scanTextNodesForIocsWithProfile,
  type DetectedIocInTextNode,
  type IocDetectorScanOptions,
  type IocScanProfile,
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

export function isScanSelectionMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.SCAN_SELECTION } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.SCAN_SELECTION
  );
}

export function resolveActiveSelectionRange(doc: Document = document): Range | null {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  return selection.getRangeAt(0).cloneRange();
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
  snapshotMatches: ReadonlyArray<PageIocScanMatch>,
  anchorLinks: ReadonlyArray<HighlightAnchorLink>
): TabScanSnapshotEntry[] {
  if (anchorLinks.length > 0) {
    const linkedKeys = new Set(
      anchorLinks.map((entry) => `${entry.type}:${entry.value}`)
    );
    const entries = anchorLinks.map(
      ({
        type,
        value,
        anchorId,
        ruleId,
        sourceTextHint,
        displayValue,
        ignoredOverlaps,
      }) => ({
        type,
        value,
        anchorId,
        ruleId,
        sourceTextHint,
        ...(displayValue ? { displayValue } : {}),
        ...(ignoredOverlaps && ignoredOverlaps.length > 0
          ? { ignoredOverlaps: [...ignoredOverlaps] }
          : {}),
      })
    );

    const attributeOnlyMatches = snapshotMatches.filter(
      (match) => !linkedKeys.has(`${match.type}:${match.value}`)
    );
    if (attributeOnlyMatches.length > 0) {
      entries.push(
        ...buildTabScanSnapshotEntriesFromMatches(attributeOnlyMatches)
      );
    }

    return entries;
  }

  return buildTabScanSnapshotEntriesFromMatches(snapshotMatches);
}

export type ScanPageResultPayload = {
  count: number;
  tabId: number | null;
  snapshot: TabScanSnapshotPayload;
  profile: IocScanProfile;
};

export async function publishTabScanSnapshot(
  entries: ReadonlyArray<TabScanSnapshotEntry>
): Promise<{ tabId: number | null; snapshot: TabScanSnapshotPayload }> {
  const snapshot = buildTabScanSnapshotPayload({
    pageUrl: window.location.href,
    entries: [...entries],
  });
  const response = await safeRuntimeSendMessage(tabScanSnapshotMessage(snapshot));
  if (!response || typeof response !== "object" || !("ok" in response)) {
    return { tabId: null, snapshot };
  }
  if (response.ok !== true) {
    return { tabId: null, snapshot };
  }
  const payload = (response as { payload?: unknown }).payload;
  const tabId =
    payload !== null &&
    typeof payload === "object" &&
    "tabId" in payload &&
    typeof (payload as { tabId: unknown }).tabId === "number"
      ? (payload as { tabId: number }).tabId
      : null;
  return { tabId, snapshot };
}

async function finalizeScanResponse(
  highlightMatches: ReadonlyArray<DetectedIocInTextNode>,
  highlightRoot: Node,
  profile: IocScanProfile,
  snapshotMatches: ReadonlyArray<PageIocScanMatch>
): Promise<MessageResponse> {
  const highlightEnabled = await getHighlightEnabledForContent();
  const anchorLinks = applyHighlightForScan(
    highlightMatches,
    highlightRoot,
    highlightEnabled
  );
  const snapshotEntries = buildScanSnapshotEntries(snapshotMatches, anchorLinks);
  const { tabId, snapshot } = await publishTabScanSnapshot(snapshotEntries);
  logIocDetectionCount(snapshotMatches.length);
  logIocScanProfile(profile);
  const payload: ScanPageResultPayload = {
    count: snapshotMatches.length,
    tabId,
    snapshot,
    profile,
  };
  return { ok: true, payload };
}

async function runMergedPageScan(
  root: Node,
  scanOptions: IocDetectorScanOptions
): Promise<{
  highlightMatches: DetectedIocInTextNode[];
  snapshotMatches: PageIocScanMatch[];
  profile: IocScanProfile;
}> {
  const maxIocs = resolveMaxIocsPerScan(scanOptions);
  const textResult = scanTextNodesForIocsWithProfile(root, scanOptions);
  let attributeMatches: DetectedIocInAttribute[] = [];
  let attributeIocCapReached = false;
  let attributeNodesScanned: number | undefined;
  let attributeNodeCap: number | undefined;
  let attributeCapReached: boolean | undefined;

  if (await isAttributeHrefExtractionEnabledForCurrentPage()) {
    const attributeResult = scanAllowlistedAttributesForIocsWithProfile(
      root,
      scanOptions
    );
    attributeMatches = attributeResult.matches;
    attributeIocCapReached = attributeResult.profile.iocCapReached;
    attributeNodesScanned = attributeResult.profile.attributeNodesScanned;
    attributeNodeCap = attributeResult.profile.attributeNodeCap;
    attributeCapReached = attributeResult.profile.capReached;
  }

  const snapshotMatches = mergeVisibleTextAndAttributeIocMatches(
    textResult.matches,
    attributeMatches,
    maxIocs
  );
  const highlightMatches = pageIocScanMatchesToHighlightInput(snapshotMatches);
  const profile: IocScanProfile = {
    ...textResult.profile,
    ...(attributeNodesScanned !== undefined
      ? {
          attributeNodesScanned,
          attributeNodeCap,
          attributeCapReached,
        }
      : {}),
    iocCount: snapshotMatches.length,
    iocCapReached:
      snapshotMatches.length >= maxIocs ||
      textResult.profile.iocCapReached ||
      attributeIocCapReached,
  };

  return { highlightMatches, snapshotMatches, profile };
}

export async function handleScanPageRequest(
  root: Node = document.body
): Promise<MessageResponse> {
  const scanOptions = await resolveIocDetectorScanOptions();
  const { highlightMatches, snapshotMatches, profile } = await runMergedPageScan(
    root,
    scanOptions
  );
  return finalizeScanResponse(highlightMatches, root, profile, snapshotMatches);
}

export async function handleScanSelectionRequest(
  root: Node = document.body
): Promise<MessageResponse> {
  const range = resolveActiveSelectionRange(document);
  if (!range) {
    return { ok: false, error: "No text selected." };
  }

  const scanOptions = await resolveIocDetectorScanOptions();
  const { matches, profile } = scanTextNodesForIocsInRangeWithProfile(
    range,
    root,
    scanOptions
  );
  let highlightRoot: Node = range.commonAncestorContainer;
  if (highlightRoot.nodeType === Node.TEXT_NODE) {
    highlightRoot = highlightRoot.parentNode ?? root;
  }
  return finalizeScanResponse(matches, highlightRoot, profile, matches);
}

export function setupScanPageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isScanPageMessage(message)) {
      void handleScanPageRequest()
        .then(sendResponse)
        .catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      return true;
    }

    if (isScanSelectionMessage(message)) {
      void handleScanSelectionRequest()
        .then(sendResponse)
        .catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      return true;
    }

    return false;
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
