import { requestTabScanSummary } from "../lib/tabScanSummaryClient";
import { buildTabScanSummary, type TabScanSummary } from "../lib/tabScanSummary";
import { isTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import { safeStorageSessionGet } from "../lib/extensionContext";
export function normalizePageUrlForScanMatch(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export async function readTabScanSummaryFromSession(
  pageUrl: string = window.location.href
): Promise<TabScanSummary | null> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return null;
  }

  const normalizedPageUrl = normalizePageUrlForScanMatch(pageUrl);
  const stored = await safeStorageSessionGet(null);
  let urlMatch: TabScanSummary | null = null;
  let latest: TabScanSummary | null = null;

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith("tabScanSnapshot:")) {
      continue;
    }
    if (!isTabScanSnapshotPayload(value)) {
      continue;
    }

    const tabId = Number.parseInt(key.slice("tabScanSnapshot:".length), 10);
    if (!Number.isFinite(tabId)) {
      continue;
    }

    const summary = buildTabScanSummary({ ...value, tabId });
    if (normalizePageUrlForScanMatch(value.pageUrl) === normalizedPageUrl) {
      if (!urlMatch || summary.scannedAt >= urlMatch.scannedAt) {
        urlMatch = summary;
      }
    }
    if (!latest || summary.scannedAt >= latest.scannedAt) {
      latest = summary;
    }
  }

  return urlMatch ?? latest;
}

export async function getTabScanSummaryForCurrentTab(): Promise<TabScanSummary | null> {
  return requestTabScanSummary();
}
