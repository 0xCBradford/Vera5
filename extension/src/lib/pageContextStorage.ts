import type { MessageResponse } from "./messages";
import {
  isPageContextClassification,
  parsePageContextOrigin,
  resolvePageContextAnalystPresetApplication,
  tabPageContextStorageKey,
  type PageContextClassification,
  type TabPageContextRecord,
} from "./pageContext";
import {
  safeStorageSessionGet,
  safeStorageSessionRemove,
  safeStorageSessionSet,
} from "./extensionContext";
import {
  applyAnalystModePreset,
  getPageContextSiteModeOverrides,
} from "./storage";

export async function saveTabPageContext(
  tabId: number,
  classification: PageContextClassification
): Promise<void> {
  const record: TabPageContextRecord = {
    ...classification,
    tabId,
  };
  await safeStorageSessionSet({
    [tabPageContextStorageKey(tabId)]: record,
  });
}

export async function getTabPageContext(
  tabId: number
): Promise<TabPageContextRecord | null> {
  const key = tabPageContextStorageKey(tabId);
  const result = await safeStorageSessionGet(key);
  const value = result[key];
  if (!isPageContextClassification(value)) {
    return null;
  }
  return { ...value, tabId };
}

export async function clearTabPageContext(tabId: number): Promise<void> {
  await safeStorageSessionRemove(tabPageContextStorageKey(tabId));
}

export async function maybeApplyAnalystPresetForPageContextChange(
  previous: TabPageContextRecord | null,
  classification: PageContextClassification
): Promise<void> {
  const siteModeOverrides = await getPageContextSiteModeOverrides();
  const presetId = resolvePageContextAnalystPresetApplication({
    previousPageContextType: previous?.pageContextType,
    nextPageContextType: classification.pageContextType,
    pageOrigin: parsePageContextOrigin(classification.pageUrl),
    siteModeOverrides,
  });
  if (presetId === null) {
    return;
  }
  await applyAnalystModePreset(presetId);
}

export async function handleTabPageContextMessage(
  classification: PageContextClassification,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const tabId = sender?.tab?.id;
  if (tabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }
  if (!isPageContextClassification(classification)) {
    return { ok: false, error: "invalid tab page context" };
  }

  const previous = await getTabPageContext(tabId);
  await saveTabPageContext(tabId, classification);
  await maybeApplyAnalystPresetForPageContextChange(previous, classification);
  return { ok: true, payload: { tabId } };
}

export async function handleGetTabPageContextMessage(
  tabId: number | undefined,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const resolvedTabId = tabId ?? sender?.tab?.id;
  if (resolvedTabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }

  const context = await getTabPageContext(resolvedTabId);
  return { ok: true, payload: { context } };
}
