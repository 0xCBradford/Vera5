import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvestigationSession } from "./investigationSession";
import {
  getActiveInvestigationSession,
  hydrateInvestigationSessionsStore,
  INVESTIGATION_SESSIONS_SCHEMA_VERSION,
} from "./investigationSessionStorage";
import {
  buildPageIocCoOccurrenceIndexFromSnapshot,
  IOC_CO_OCCURRENCE_SCHEMA_VERSION,
} from "./iocCoOccurrence";
import {
  clearSessionIocCoOccurrenceRecord,
  getIocCoOccurrenceStore,
  getPageIocCoOccurrenceIndexForSession,
  getSessionIocCoOccurrenceRecord,
  IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION,
  saveSessionPageIocCoOccurrenceFromSnapshot,
  STORAGE_KEY_IOC_CO_OCCURRENCE,
  syncSessionIocCoOccurrenceFromSnapshot,
} from "./iocCoOccurrenceStorage";
import { setIocCoOccurrenceLimits } from "./iocCoOccurrenceSettings";
import { IOC_RULE_ID } from "./iocRegex";
import {
  buildTabScanSnapshotPayload,
  type TabScanSnapshot,
} from "./tabScanSnapshot";

function stubChromeStorage(localStore: Record<string, unknown>): void {
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
}

describe("iocCoOccurrenceStorage", () => {
  let localStore: Record<string, unknown>;

  const snapshot: TabScanSnapshot = {
    ...buildTabScanSnapshotPayload({
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
        {
          type: "domain",
          value: "example.com",
          anchorId: "vera5-hl-2",
          ruleId: IOC_RULE_ID.DOMAIN,
          sourceTextHint: "example.com",
        },
      ],
    }),
    tabId: 4,
  };

  beforeEach(() => {
    localStore = {};
    stubChromeStorage(localStore);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function seedActiveSession(sessionId: string): Promise<void> {
    const session = createInvestigationSession({
      title: "Investigation — example.com",
      pageUrl: snapshot.pageUrl,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      id: sessionId,
    });
    expect(session).not.toBeNull();
    await hydrateInvestigationSessionsStore({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [session!],
      activeSessionId: sessionId,
    });
  }

  it("persists a page co-occurrence index keyed by session id", async () => {
    const sessionId = "session-co-occur-1";
    await seedActiveSession(sessionId);

    const saved = await saveSessionPageIocCoOccurrenceFromSnapshot({
      sessionId,
      snapshot,
    });

    expect(saved).toMatchObject({
      sessionId,
      pages: [
        expect.objectContaining({
          schemaVersion: IOC_CO_OCCURRENCE_SCHEMA_VERSION,
          pageUrl: snapshot.pageUrl,
          pairs: expect.arrayContaining([
            expect.objectContaining({
              pairKey: "domain:example.com|ipv4:8.8.8.8",
            }),
          ]),
        }),
      ],
    });

    const stored = localStore[STORAGE_KEY_IOC_CO_OCCURRENCE] as {
      schemaVersion: number;
      sessions: Array<{ sessionId: string }>;
    };
    expect(stored.schemaVersion).toBe(IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION);
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0]?.sessionId).toBe(sessionId);

    const record = await getSessionIocCoOccurrenceRecord(sessionId);
    expect(record?.pages).toHaveLength(1);
    expect(record?.pages[0]?.pairs).toHaveLength(1);
  });

  it("reads a stored page index for a session and page url", async () => {
    const sessionId = "session-co-occur-2";
    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });

    const pageIndex = await getPageIocCoOccurrenceIndexForSession({
      sessionId,
      pageUrl: snapshot.pageUrl,
    });

    expect(pageIndex).toEqual(buildPageIocCoOccurrenceIndexFromSnapshot(snapshot));
  });

  it("replaces the page index for the same page url within a session", async () => {
    const sessionId = "session-co-occur-3";
    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });

    const rescanned = {
      ...snapshot,
      scannedAt: snapshot.scannedAt + 1_000,
      entries: [
        ...snapshot.entries,
        {
          type: "cve" as const,
          value: "CVE-2021-44228",
          anchorId: "vera5-hl-3",
          ruleId: IOC_RULE_ID.CVE,
          sourceTextHint: "CVE-2021-44228",
        },
      ],
    };

    await saveSessionPageIocCoOccurrenceFromSnapshot({
      sessionId,
      snapshot: rescanned,
    });

    const record = await getSessionIocCoOccurrenceRecord(sessionId);
    expect(record?.pages).toHaveLength(1);
    expect(record?.pages[0]?.scannedAt).toBe(rescanned.scannedAt);
    expect(record?.pages[0]?.members).toHaveLength(3);
  });

  it("keeps separate page indexes for different page urls in one session", async () => {
    const sessionId = "session-co-occur-4";
    const otherPageSnapshot: TabScanSnapshot = {
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/other",
        scannedAt: 1_700_000_001_000,
        entries: snapshot.entries,
      }),
      tabId: 5,
    };

    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });
    await saveSessionPageIocCoOccurrenceFromSnapshot({
      sessionId,
      snapshot: otherPageSnapshot,
    });

    const record = await getSessionIocCoOccurrenceRecord(sessionId);
    expect(record?.pages).toHaveLength(2);
    expect(record?.pages.map((page) => page.pageUrl)).toEqual([
      otherPageSnapshot.pageUrl,
      snapshot.pageUrl,
    ]);
  });

  it("syncs from snapshot using the active investigation session id", async () => {
    const sessionId = "session-co-occur-active";
    await seedActiveSession(sessionId);

    const saved = await syncSessionIocCoOccurrenceFromSnapshot(snapshot);
    expect(saved?.sessionId).toBe(sessionId);

    const activeSession = await getActiveInvestigationSession();
    expect(activeSession?.id).toBe(sessionId);
    expect(await getSessionIocCoOccurrenceRecord(sessionId)).not.toBeNull();
  });

  it("clears a session record and removes empty storage", async () => {
    const sessionId = "session-co-occur-clear";
    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });
    expect(await getIocCoOccurrenceStore()).toMatchObject({
      sessions: [expect.objectContaining({ sessionId })],
    });

    const cleared = await clearSessionIocCoOccurrenceRecord(sessionId);
    expect(cleared).toBe(true);
    expect(await getSessionIocCoOccurrenceRecord(sessionId)).toBeNull();
    expect(localStore[STORAGE_KEY_IOC_CO_OCCURRENCE]).toBeUndefined();
  });

  it("applies stored limits when persisting from a snapshot", async () => {
    const sessionId = "session-co-occur-limits";
    await setIocCoOccurrenceLimits({ minGroupSize: 3, maxGroupsPerPage: 1 });

    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });

    const pageIndex = await getPageIocCoOccurrenceIndexForSession({
      sessionId,
      pageUrl: snapshot.pageUrl,
    });
    expect(pageIndex).toEqual(
      buildPageIocCoOccurrenceIndexFromSnapshot(snapshot, {
        minGroupSize: 3,
        maxGroupsPerPage: 1,
      })
    );
    expect(pageIndex?.groups).toEqual([]);
  });

  it("skips co-occurrence recompute when the page IOC count exceeds the threshold", async () => {
    const sessionId = "session-co-occur-skip";
    await saveSessionPageIocCoOccurrenceFromSnapshot({ sessionId, snapshot });

    const largeSnapshot: TabScanSnapshot = {
      ...snapshot,
      scannedAt: snapshot.scannedAt + 5_000,
      entries: Array.from({ length: 260 }, (_, index) => ({
        type: "ipv4" as const,
        value: `10.0.${Math.floor(index / 256)}.${index % 256}`,
        anchorId: `vera5-hl-large-${index}`,
        ruleId: IOC_RULE_ID.IPV4,
        sourceTextHint: `10.0.${Math.floor(index / 256)}.${index % 256}`,
      })),
    };

    await saveSessionPageIocCoOccurrenceFromSnapshot({
      sessionId,
      snapshot: largeSnapshot,
      limits: {
        minGroupSize: 2,
        maxGroupsPerPage: 1,
        maxMembersForComputation: 128,
        maxPairsPerPage: 4096,
        skipRecomputePageIocCountThreshold: 256,
      },
    });

    const pageIndex = await getPageIocCoOccurrenceIndexForSession({
      sessionId,
      pageUrl: snapshot.pageUrl,
    });
    expect(pageIndex).toEqual(buildPageIocCoOccurrenceIndexFromSnapshot(snapshot));
    expect(pageIndex?.members).toHaveLength(2);
    expect(pageIndex?.scannedAt).toBe(snapshot.scannedAt);
  });

  it("does not store a co-occurrence index on first scan when the page exceeds the skip threshold", async () => {
    const sessionId = "session-co-occur-skip-first";
    const largeSnapshot: TabScanSnapshot = {
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/huge",
        scannedAt: 1_700_000_010_000,
        entries: Array.from({ length: 260 }, (_, index) => ({
          type: "ipv4" as const,
          value: `10.0.${Math.floor(index / 256)}.${index % 256}`,
          anchorId: `vera5-hl-huge-${index}`,
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: `10.0.${Math.floor(index / 256)}.${index % 256}`,
        })),
      }),
      tabId: 9,
    };

    const saved = await saveSessionPageIocCoOccurrenceFromSnapshot({
      sessionId,
      snapshot: largeSnapshot,
      limits: {
        minGroupSize: 2,
        maxGroupsPerPage: 1,
        maxMembersForComputation: 128,
        maxPairsPerPage: 4096,
        skipRecomputePageIocCountThreshold: 256,
      },
    });

    expect(saved).toBeNull();
    expect(
      await getPageIocCoOccurrenceIndexForSession({
        sessionId,
        pageUrl: largeSnapshot.pageUrl,
      })
    ).toBeNull();
  });
});
