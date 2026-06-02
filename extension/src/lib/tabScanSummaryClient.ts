import { safeRuntimeSendMessage } from "./extensionContext";
import { getTabScanSummaryMessage, type MessageResponse } from "./messages";
import { isTabScanSummary, type TabScanSummary } from "./tabScanSummary";

function parseTabScanSummaryResponse(
  response: MessageResponse | null
): TabScanSummary | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const summary = (response.payload as { summary?: unknown }).summary;
  if (summary === null) {
    return null;
  }
  if (!isTabScanSummary(summary)) {
    return null;
  }
  return summary;
}

export async function requestTabScanSummary(
  tabId?: number
): Promise<TabScanSummary | null> {
  const response = (await safeRuntimeSendMessage(
    getTabScanSummaryMessage(tabId)
  )) as MessageResponse | null;
  return parseTabScanSummaryResponse(response);
}

export async function requestTabScanSummaryForActiveTab(): Promise<TabScanSummary | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return null;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return null;
  }

  return requestTabScanSummary(tab.id);
}
