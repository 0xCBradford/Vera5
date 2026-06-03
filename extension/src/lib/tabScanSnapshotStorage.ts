import type { MessageResponse } from "./messages";
import {
  buildTabScanSummary,
  type IocTypeFilter,
} from "./tabScanSummary";
import { IOC_TYPE } from "./iocRegex";
import {
  isTabScanSnapshotPayload,
  tabScanSnapshotStorageKey,
  type TabScanSnapshot,
  type TabScanSnapshotPayload,
} from "./tabScanSnapshot";

import {
  safeStorageSessionGet,
  safeStorageSessionRemove,
  safeStorageSessionSet,
} from "./extensionContext";

export async function saveTabScanSnapshot(
  tabId: number,
  snapshot: TabScanSnapshot
): Promise<void> {
  await safeStorageSessionSet({
    [tabScanSnapshotStorageKey(tabId)]: snapshot,
  });
}

export async function getTabScanSnapshot(
  tabId: number
): Promise<TabScanSnapshot | null> {
  const key = tabScanSnapshotStorageKey(tabId);
  const result = await safeStorageSessionGet(key);
  const value = result[key];
  if (!isTabScanSnapshotPayload(value)) {
    return null;
  }
  return { ...value, tabId };
}

export async function clearTabScanSnapshot(tabId: number): Promise<void> {
  await safeStorageSessionRemove(tabScanSnapshotStorageKey(tabId));
}

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

export function tabScanTrayFilterStorageKey(tabId: number): string {
  return `tabScanTrayFilter:${tabId}`;
}

function isIocTypeFilter(value: unknown): value is IocTypeFilter {
  return value === "all" || (typeof value === "string" && IOC_TYPES.has(value));
}

export async function saveTabScanTrayFilter(
  tabId: number,
  filter: IocTypeFilter
): Promise<void> {
  await safeStorageSessionSet({
    [tabScanTrayFilterStorageKey(tabId)]: filter,
  });
}

export async function getTabScanTrayFilter(
  tabId: number
): Promise<IocTypeFilter> {
  const key = tabScanTrayFilterStorageKey(tabId);
  const result = await safeStorageSessionGet(key);
  const value = result[key];
  return isIocTypeFilter(value) ? value : "all";
}

export async function clearTabScanTrayFilter(tabId: number): Promise<void> {
  await safeStorageSessionRemove(tabScanTrayFilterStorageKey(tabId));
}

export async function handleTabScanSnapshotMessage(
  snapshot: TabScanSnapshotPayload,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const tabId = sender?.tab?.id;
  if (tabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }
  if (!isTabScanSnapshotPayload(snapshot)) {
    return { ok: false, error: "invalid tab scan snapshot" };
  }

  await saveTabScanSnapshot(tabId, { ...snapshot, tabId });
  return { ok: true, payload: { tabId } };
}

export async function handleGetTabScanSummaryMessage(
  tabId: number | undefined,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const resolvedTabId = tabId ?? sender?.tab?.id;
  if (resolvedTabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }

  const snapshot = await getTabScanSnapshot(resolvedTabId);
  const summary = snapshot ? buildTabScanSummary(snapshot) : null;
  return { ok: true, payload: { summary } };
}
