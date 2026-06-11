import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_RULE_ID } from "./iocRegex";
import {
  buildTabScanSnapshotPayload,
  tabScanSnapshotStorageKey,
} from "./tabScanSnapshot";
import {
  clearTabScanSnapshot,
  getTabScanSnapshot,
  handleGetTabScanSummaryMessage,
  handleTabScanSnapshotMessage,
  saveTabScanSnapshot,
} from "./tabScanSnapshotStorage";
import { buildTabScanSummary } from "./tabScanSummary";
import {
  getActiveInvestigationSession,
  STORAGE_KEY_INVESTIGATION_SESSIONS,
} from "./investigationSessionStorage";

describe("tabScanSnapshotStorage", () => {
  let store: Record<string, unknown>;
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    localStore = {};
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(store, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete store[key];
            }
            return Promise.resolve();
          },
        },
        local: {
          get: (keys: string | string[] | Record<string, unknown>) => {
            const keyList = Array.isArray(keys)
              ? keys
              : typeof keys === "string"
                ? [keys]
                : Object.keys(keys);
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete localStore[key];
            }
            return Promise.resolve();
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and reads snapshots keyed by tab id", async () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: "8.8.8.8",
        },
      ],
    });

    await saveTabScanSnapshot(42, { ...payload, tabId: 42 });
    expect(store[tabScanSnapshotStorageKey(42)]).toEqual({
      ...payload,
      tabId: 42,
    });

    const snapshot = await getTabScanSnapshot(42);
    expect(snapshot).toEqual({ ...payload, tabId: 42 });
  });

  it("clears snapshots for closed tabs", async () => {
    await saveTabScanSnapshot(7, {
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com",
        entries: [],
      }),
      tabId: 7,
    });
    await clearTabScanSnapshot(7);
    expect(await getTabScanSnapshot(7)).toBeNull();
  });

  it("handles background snapshot messages with sender tab id", async () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com",
      entries: [
        {
          type: "domain",
          value: "example.com",
          anchorId: "vera5-hl-2",
          ruleId: IOC_RULE_ID.DOMAIN,
          sourceTextHint: "example.com",
        },
      ],
    });

    const response = await handleTabScanSnapshotMessage(payload, {
      tab: { id: 99 },
    } as chrome.runtime.MessageSender);

    expect(response).toEqual({ ok: true, payload: { tabId: 99 } });
    expect(await getTabScanSnapshot(99)).toEqual({ ...payload, tabId: 99 });
    const activeSession = await getActiveInvestigationSession();
    expect(activeSession).toEqual(
      expect.objectContaining({
        title: "Investigation — example.com",
        pageUrl: "https://example.com",
        totalIocCount: 1,
      })
    );
    expect(localStore[STORAGE_KEY_INVESTIGATION_SESSIONS]).toBeTruthy();
  });

  it("rejects snapshot messages without sender tab id", async () => {
    const response = await handleTabScanSnapshotMessage(
      buildTabScanSnapshotPayload({
        pageUrl: "https://example.com",
        entries: [],
      }),
      undefined
    );
    expect(response).toEqual({ ok: false, error: "missing tab id" });
  });

  it("returns a stable summary for stored snapshots", async () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: "8.8.8.8",
        },
      ],
    });
    await saveTabScanSnapshot(15, { ...payload, tabId: 15 });

    const response = await handleGetTabScanSummaryMessage(15, undefined);
    expect(response).toEqual({
      ok: true,
      payload: {
        summary: buildTabScanSummary({ ...payload, tabId: 15 }),
      },
    });
  });

  it("resolves tab id from sender when omitted", async () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com",
      entries: [],
    });
    await saveTabScanSnapshot(3, { ...payload, tabId: 3 });

    const response = await handleGetTabScanSummaryMessage(undefined, {
      tab: { id: 3 },
    } as chrome.runtime.MessageSender);

    expect(response).toEqual({
      ok: true,
      payload: {
        summary: buildTabScanSummary({ ...payload, tabId: 3 }),
      },
    });
  });
});
