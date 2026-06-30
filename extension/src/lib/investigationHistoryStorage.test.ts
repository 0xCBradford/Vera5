import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvestigationSession } from "./investigationSession";
import { INVESTIGATION_SESSIONS_SCHEMA_VERSION } from "./investigationSessionStorage";
import { IOC_TYPE } from "./iocRegex";
import {
  INVESTIGATION_HISTORY_ID_PREFIX,
  INVESTIGATION_HISTORY_SCHEMA_VERSION,
} from "./investigationHistory";
import {
  listInvestigationHistoryEntries,
  listInvestigationHistoryEntriesForSession,
  clearInvestigationHistory,
  recordInvestigationHistoryEntry,
  STORAGE_KEY_INVESTIGATION_HISTORY,
} from "./investigationHistoryStorage";
import { STORAGE_KEY_INVESTIGATION_SESSIONS } from "./investigationSessionStorage";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
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
    },
  });
}

describe("investigationHistoryStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records and lists recent IOC history entries", async () => {
    const recorded = await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 1_700_000_000_000,
    });

    expect(recorded).toMatchObject({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageOrigin: "https://example.com",
      pageUrl: "https://example.com/alert",
      enrichedAt: 1_700_000_000_000,
    });

    const entries = await listInvestigationHistoryEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.ioc).toBe("8.8.8.8");
  });

  it("moves duplicate IOC entries to the front with a new timestamp", async () => {
    await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/first",
      enrichedAt: 100,
    });
    await recordInvestigationHistoryEntry({
      ioc: "1.1.1.1",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/second",
      enrichedAt: 200,
    });
    await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/third",
      enrichedAt: 300,
    });

    const entries = await listInvestigationHistoryEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      ioc: "8.8.8.8",
      pageUrl: "https://example.com/third",
      enrichedAt: 300,
    });
    expect(entries[1]?.ioc).toBe("1.1.1.1");
  });

  it("persists under the investigation history storage key", async () => {
    await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 100,
    });

    const persisted = store[STORAGE_KEY_INVESTIGATION_HISTORY] as {
      schemaVersion: number;
      entries: Array<{ id: string }>;
    };
    expect(persisted.schemaVersion).toBe(INVESTIGATION_HISTORY_SCHEMA_VERSION);
    expect(persisted.entries[0]?.id.startsWith(INVESTIGATION_HISTORY_ID_PREFIX)).toBe(
      true
    );
  });

  it("links history entries to the active investigation session", async () => {
    const session = createInvestigationSession({
      id: "vera5-inv-active",
      title: "Active case",
      pageUrl: "https://example.com/alert",
      createdAt: 100,
      updatedAt: 100,
    })!;

    store[STORAGE_KEY_INVESTIGATION_SESSIONS] = {
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [session],
      activeSessionId: session.id,
    };

    const recorded = await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 200,
    });

    expect(recorded?.sessionId).toBe(session.id);
    expect(await listInvestigationHistoryEntriesForSession(session.id)).toEqual([
      recorded,
    ]);
  });

  it("does not link history entries when no session is active", async () => {
    store[STORAGE_KEY_INVESTIGATION_SESSIONS] = {
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [],
    };

    const recorded = await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 200,
    });

    expect(recorded?.sessionId).toBeUndefined();
  });

  it("clears all investigation history entries", async () => {
    await recordInvestigationHistoryEntry({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 100,
    });
    await recordInvestigationHistoryEntry({
      ioc: "1.1.1.1",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 200,
    });

    expect(await clearInvestigationHistory()).toBe(true);
    expect(await listInvestigationHistoryEntries()).toEqual([]);
  });
});
