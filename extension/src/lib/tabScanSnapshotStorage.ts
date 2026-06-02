import type { MessageResponse } from "./messages";
import { buildTabScanSummary } from "./tabScanSummary";
import {
  isTabScanSnapshotPayload,
  tabScanSnapshotStorageKey,
  type TabScanSnapshot,
  type TabScanSnapshotPayload,
} from "./tabScanSnapshot";

async function sessionGet(
  keys: string | string[]
): Promise<Record<string, unknown>> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return {};
  }
  return chrome.storage.session.get(keys);
}

async function sessionSet(items: Record<string, unknown>): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return;
  }
  await chrome.storage.session.set(items);
}

async function sessionRemove(keys: string | string[]): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return;
  }
  await chrome.storage.session.remove(keys);
}

export async function saveTabScanSnapshot(
  tabId: number,
  snapshot: TabScanSnapshot
): Promise<void> {
  await sessionSet({
    [tabScanSnapshotStorageKey(tabId)]: snapshot,
  });
}

export async function getTabScanSnapshot(
  tabId: number
): Promise<TabScanSnapshot | null> {
  const key = tabScanSnapshotStorageKey(tabId);
  const result = await sessionGet(key);
  const value = result[key];
  if (!isTabScanSnapshotPayload(value)) {
    return null;
  }
  return { ...value, tabId };
}

export async function clearTabScanSnapshot(tabId: number): Promise<void> {
  await sessionRemove(tabScanSnapshotStorageKey(tabId));
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
  return { ok: true };
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
