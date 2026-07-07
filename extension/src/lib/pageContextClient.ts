import { safeRuntimeSendMessage } from "./extensionContext";
import { getTabPageContextMessage, type MessageResponse } from "./messages";
import type { TabPageContextRecord } from "./pageContext";

function parseTabPageContextResponse(
  response: MessageResponse | null
): TabPageContextRecord | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const context = (response.payload as { context?: unknown }).context;
  if (context === null || context === undefined) {
    return null;
  }
  if (
    typeof context !== "object" ||
    typeof (context as TabPageContextRecord).pageContextType !== "string"
  ) {
    return null;
  }
  return context as TabPageContextRecord;
}

export async function requestTabPageContext(
  tabId?: number
): Promise<TabPageContextRecord | null> {
  const response = (await safeRuntimeSendMessage(
    getTabPageContextMessage(tabId)
  )) as MessageResponse | null;
  return parseTabPageContextResponse(response);
}

export async function requestTabPageContextForActiveTab(): Promise<TabPageContextRecord | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return null;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return null;
  }

  return requestTabPageContext(tab.id);
}
