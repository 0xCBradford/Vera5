import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { createInvestigationSession } from "./investigationSession";
import {
  archiveInvestigationSession,
  createEmptyInvestigationSessionsStore,
  deleteStoredInvestigationSession,
  getActiveInvestigationSession,
  getInvestigationSessionsStore,
  getStoredInvestigationSession,
  hydrateInvestigationSessionsStore,
  INVESTIGATION_SESSIONS_SCHEMA_VERSION,
  listRecentInvestigationSessions,
  listStoredInvestigationSessions,
  normalizeInvestigationSessionsStore,
  persistInvestigationSessionsStore,
  recordActiveInvestigationSessionEnrichmentEvent,
  recordActiveInvestigationSessionExportEvent,
  renameActiveInvestigationSession,
  renameInvestigationSession,
  reopenInvestigationSession,
  saveStoredInvestigationSession,
  startNewInvestigationSession,
  STORAGE_KEY_INVESTIGATION_SESSIONS,
  syncActiveInvestigationSessionFromScan,
  toggleActiveInvestigationSessionIocPin,
} from "./investigationSessionStorage";

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

function buildSession(input: {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pageUrl?: string;
  notes?: string;
  totalIocCount?: number;
  iocCountByType?: Record<string, number>;
}) {
  return createInvestigationSession({
    id: input.id,
    title: input.title,
    pageUrl: input.pageUrl ?? "https://example.com/alert",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    notes: input.notes,
    totalIocCount: input.totalIocCount,
    iocCountByType: input.iocCountByType,
  });
}

describe("investigationSessionStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes stored payloads with schemaVersion and valid sessions", () => {
    const session = buildSession({
      id: "vera5-inv-1",
      title: "Phishing case",
      createdAt: 100,
      updatedAt: 200,
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 1,
        [IOC_TYPE.URL]: 1,
      },
    });

    expect(
      normalizeInvestigationSessionsStore({
        schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
        sessions: [session, { id: "bad", title: "" }],
      })
    ).toEqual({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [session],
    });
  });

  it("returns an empty versioned store for unknown schema versions", () => {
    expect(
      normalizeInvestigationSessionsStore({
        schemaVersion: 99,
        sessions: [],
      })
    ).toEqual(createEmptyInvestigationSessionsStore());
  });

  it("persists sessions in chrome.storage.local with schemaVersion", async () => {
    const first = buildSession({
      id: "vera5-inv-a",
      title: "Case A",
      createdAt: 100,
      updatedAt: 300,
    });
    const second = buildSession({
      id: "vera5-inv-b",
      title: "Case B",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(await saveStoredInvestigationSession(first!)).toBe(true);
    expect(await saveStoredInvestigationSession(second!)).toBe(true);

    expect(store[STORAGE_KEY_INVESTIGATION_SESSIONS]).toEqual({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [first, second],
    });
    expect(await listStoredInvestigationSessions()).toEqual([first, second]);
  });

  it("reads, upserts, and deletes stored sessions", async () => {
    const original = buildSession({
      id: "vera5-inv-upsert",
      title: "Original",
      createdAt: 100,
      updatedAt: 100,
      notes: "Initial note",
    });
    await saveStoredInvestigationSession(original!);

    const updated = buildSession({
      id: "vera5-inv-upsert",
      title: "Renamed",
      createdAt: 100,
      updatedAt: 500,
      notes: "Updated note",
      totalIocCount: 1,
      iocCountByType: {
        [IOC_TYPE.IPV4]: 1,
      },
    });
    expect(await saveStoredInvestigationSession(updated!)).toBe(true);
    expect(await getStoredInvestigationSession("vera5-inv-upsert")).toEqual(updated);

    expect(await deleteStoredInvestigationSession("vera5-inv-upsert")).toBe(true);
    expect(store[STORAGE_KEY_INVESTIGATION_SESSIONS]).toBeUndefined();
    expect(await getInvestigationSessionsStore()).toEqual(
      createEmptyInvestigationSessionsStore()
    );
  });

  it("rejects invalid sessions and clears storage when the store becomes empty", async () => {
    const valid = buildSession({
      id: "vera5-inv-valid",
      title: "Valid",
      createdAt: 100,
      updatedAt: 100,
    });
    await hydrateInvestigationSessionsStore({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [valid!],
    });

    expect(await saveStoredInvestigationSession({} as never)).toBe(false);
    expect(await deleteStoredInvestigationSession("missing-id")).toBe(false);

    await persistInvestigationSessionsStore(createEmptyInvestigationSessionsStore());
    expect(store[STORAGE_KEY_INVESTIGATION_SESSIONS]).toBeUndefined();
  });

  it("deduplicates sessions by id when normalizing stored payloads", () => {
    const first = buildSession({
      id: "vera5-inv-dup",
      title: "First",
      createdAt: 100,
      updatedAt: 100,
    });
    const second = buildSession({
      id: "vera5-inv-dup",
      title: "Second",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(
      normalizeInvestigationSessionsStore({
        schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
        sessions: [first, second],
      }).sessions
    ).toEqual([second]);
  });

  it("auto-creates an active session on first scan sync", async () => {
    const session = await syncActiveInvestigationSessionFromScan({
      pageUrl: "https://mail.example.com/alert",
      entries: [
        { type: IOC_TYPE.DOMAIN },
        { type: IOC_TYPE.URL },
      ],
      now: 500,
    });

    expect(session).toEqual(
      expect.objectContaining({
        title: "Investigation — mail.example.com",
        pageUrl: "https://mail.example.com/alert",
        totalIocCount: 2,
        updatedAt: 500,
      })
    );
    expect(await getActiveInvestigationSession()).toEqual(session);
    expect(store[STORAGE_KEY_INVESTIGATION_SESSIONS]).toEqual(
      expect.objectContaining({
        schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
        activeSessionId: session?.id,
      })
    );
  });

  it("updates the active session rollups on subsequent scans", async () => {
    await syncActiveInvestigationSessionFromScan({
      pageUrl: "https://example.com/first",
      entries: [{ type: IOC_TYPE.IPV4 }],
      now: 100,
    });

    const updated = await syncActiveInvestigationSessionFromScan({
      pageUrl: "https://example.com/second",
      entries: [{ type: IOC_TYPE.IPV4 }, { type: IOC_TYPE.CVE }],
      now: 200,
    });

    expect(updated).toEqual(
      expect.objectContaining({
        pageUrl: "https://example.com/second",
        totalIocCount: 2,
        updatedAt: 200,
      })
    );
    expect(await listStoredInvestigationSessions()).toHaveLength(1);
  });

  it("creates explicit new sessions with editable titles and active id", async () => {
    const session = await startNewInvestigationSession({
      title: "  Phishing Investigation  ",
      pageUrl: "https://example.com/inbox",
      now: 300,
    });

    expect(session).toEqual(
      expect.objectContaining({
        title: "Phishing Investigation",
        pageUrl: "https://example.com/inbox",
        updatedAt: 300,
      })
    );
    expect(await getActiveInvestigationSession()).toEqual(session);

    const renamed = await renameActiveInvestigationSession({
      title: "Renamed case",
      now: 400,
    });
    expect(renamed?.title).toBe("Renamed case");
  });

  it("clears active session id when the active session is deleted", async () => {
    const session = await startNewInvestigationSession({
      title: "Temporary",
      pageUrl: "https://example.com",
      now: 100,
    });
    expect(session?.id).toBeTruthy();

    expect(await deleteStoredInvestigationSession(session!.id)).toBe(true);
    expect(await getActiveInvestigationSession()).toBeNull();
  });

  it("lists recent non-archived sessions and supports reopen, rename, and archive", async () => {
    const first = buildSession({
      id: "vera5-inv-recent-1",
      title: "Case A",
      createdAt: 100,
      updatedAt: 300,
    });
    const second = buildSession({
      id: "vera5-inv-recent-2",
      title: "Case B",
      createdAt: 100,
      updatedAt: 200,
    });
    await hydrateInvestigationSessionsStore({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [first!, second!],
      activeSessionId: first!.id,
    });

    expect(await listRecentInvestigationSessions()).toEqual([first, second]);

    const reopened = await reopenInvestigationSession(second!.id);
    expect(reopened?.id).toBe(second!.id);
    expect((await getActiveInvestigationSession())?.id).toBe(second!.id);

    const renamed = await renameInvestigationSession({
      sessionId: second!.id,
      title: "Renamed case",
      now: 400,
    });
    expect(renamed?.title).toBe("Renamed case");

    expect(await archiveInvestigationSession(first!.id)).toBe(true);
    expect(await listRecentInvestigationSessions()).toEqual([renamed]);
    expect((await getActiveInvestigationSession())?.id).toBe(second!.id);

    expect(await archiveInvestigationSession(second!.id)).toBe(true);
    expect(await getActiveInvestigationSession()).toBeNull();
  });

  it("preserves archived session ids when saving other sessions", async () => {
    const archived = buildSession({
      id: "vera5-inv-archived",
      title: "Archived",
      createdAt: 100,
      updatedAt: 100,
    });
    const active = buildSession({
      id: "vera5-inv-active",
      title: "Active",
      createdAt: 100,
      updatedAt: 200,
    });
    await hydrateInvestigationSessionsStore({
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [archived!, active!],
      archivedSessionIds: [archived!.id],
      activeSessionId: active!.id,
    });

    const updated = buildSession({
      id: "vera5-inv-active",
      title: "Active updated",
      createdAt: 100,
      updatedAt: 300,
    });
    await saveStoredInvestigationSession(updated!, { setActive: true });

    expect(store[STORAGE_KEY_INVESTIGATION_SESSIONS]).toEqual(
      expect.objectContaining({
        archivedSessionIds: [archived!.id],
        activeSessionId: active!.id,
      })
    );
  });

  it("records enrichment and export events on the active session", async () => {
    const session = await startNewInvestigationSession({
      title: "Active case",
      pageUrl: "https://example.com",
      now: 100,
    });
    expect(session?.enrichmentCount).toBe(0);
    expect(session?.exportCount).toBe(0);

    const afterEnrichment = await recordActiveInvestigationSessionEnrichmentEvent({
      now: 200,
    });
    expect(afterEnrichment).toEqual(
      expect.objectContaining({
        enrichmentCount: 1,
        exportCount: 0,
        updatedAt: 200,
      })
    );

    const afterExport = await recordActiveInvestigationSessionExportEvent({ now: 300 });
    expect(afterExport).toEqual(
      expect.objectContaining({
        enrichmentCount: 1,
        exportCount: 1,
        updatedAt: 300,
      })
    );
    expect(await getActiveInvestigationSession()).toEqual(afterExport);
  });

  it("preserves activity counts when syncing tray scan rollups", async () => {
    await startNewInvestigationSession({
      title: "Tray linked",
      pageUrl: "https://example.com/first",
      now: 100,
    });
    await recordActiveInvestigationSessionEnrichmentEvent({ now: 150 });
    await recordActiveInvestigationSessionExportEvent({ now: 160 });

    const synced = await syncActiveInvestigationSessionFromScan({
      pageUrl: "https://example.com/second",
      entries: [{ type: IOC_TYPE.DOMAIN }, { type: IOC_TYPE.URL }],
      now: 200,
    });

    expect(synced).toEqual(
      expect.objectContaining({
        pageUrl: "https://example.com/second",
        totalIocCount: 2,
        enrichmentCount: 1,
        exportCount: 1,
        updatedAt: 200,
      })
    );
  });

  it("ignores activity events when no active session exists", async () => {
    expect(await recordActiveInvestigationSessionEnrichmentEvent()).toBeNull();
    expect(await recordActiveInvestigationSessionExportEvent()).toBeNull();
  });

  it("records first-seen timeline entries when scan sync includes IOC values", async () => {
    const session = await syncActiveInvestigationSessionFromScan({
      pageUrl: "https://example.com/alert",
      entries: [
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
      ],
      now: 500,
    });

    expect(session?.iocTimelines).toEqual({
      "evil.example": {
        firstSeenAt: 500,
        enrichEvents: [],
        exportEvents: [],
        iocType: IOC_TYPE.DOMAIN,
      },
      "8.8.8.8": {
        firstSeenAt: 500,
        enrichEvents: [],
        exportEvents: [],
        iocType: IOC_TYPE.IPV4,
      },
    });
  });

  it("records per-IOC enrich and export events on the active session", async () => {
    await startNewInvestigationSession({
      title: "Timeline case",
      pageUrl: "https://example.com",
      now: 100,
    });

    await recordActiveInvestigationSessionEnrichmentEvent({
      iocValue: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      now: 200,
    });
    await recordActiveInvestigationSessionExportEvent({
      iocValue: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      now: 300,
    });

    const active = await getActiveInvestigationSession();
    expect(active?.iocTimelines?.["8.8.8.8"]).toEqual({
      firstSeenAt: 200,
      enrichEvents: [200],
      exportEvents: [300],
      iocType: IOC_TYPE.IPV4,
    });
  });

  it("pins and unpins IOCs on the active session", async () => {
    await startNewInvestigationSession({
      title: "Pin case",
      pageUrl: "https://example.com",
      now: 100,
    });

    const pinned = await toggleActiveInvestigationSessionIocPin({
      iocValue: "evil.example",
      iocType: IOC_TYPE.DOMAIN,
      pinned: true,
      now: 200,
    });
    expect(pinned?.pinnedIocs?.["evil.example"]).toEqual({
      pinnedAt: 200,
      iocType: IOC_TYPE.DOMAIN,
    });

    const unpinned = await toggleActiveInvestigationSessionIocPin({
      iocValue: "evil.example",
      pinned: false,
      now: 300,
    });
    expect(unpinned?.pinnedIocs).toBeUndefined();
    expect(await getActiveInvestigationSession()).toEqual(unpinned);
  });
});
