import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
  DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  RELATIONSHIP_EDGE_MS_PER_DAY,
  RELATIONSHIP_TYPE,
  createRelationshipEdge,
} from "./relationshipEdge";
import {
  MAX_STORED_RELATIONSHIP_EDGES,
  RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
  STORAGE_KEY_RELATIONSHIP_EDGES,
  clearStoredRelationshipEdges,
  createEmptyRelationshipEdgesStore,
  getRelationshipEdgesStore,
  getStoredRelationshipEdge,
  listStoredRelationshipEdges,
  migrateRelationshipEdgesStore,
  normalizeRelationshipEdgesStore,
  persistRelationshipEdgesStore,
  replaceStoredRelationshipEdges,
  setRelationshipEdgeKnownGoodPolicy,
  setRelationshipEdgeMinCoOccurrenceCount,
  setRelationshipEdgeRetentionDays,
  upsertStoredRelationshipEdge,
} from "./relationshipEdgeStorage";

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

describe("relationshipEdgeStorage", () => {
  let localStore: Record<string, unknown>;
  const nowMs = Date.UTC(2026, 6, 22);

  function sampleEdge(sessionIds: string[] = ["vera5-inv-a", "vera5-inv-b"]) {
    return createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds,
      firstSeen: nowMs - 1_000,
      lastSeen: nowMs - 500,
      weight: sessionIds.length,
    });
  }

  beforeEach(() => {
    localStore = {};
    stubChromeStorage(localStore);
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates an empty versioned store", () => {
    const empty = createEmptyRelationshipEdgesStore(1_234);
    expect(empty).toEqual({
      schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
      updatedAt: 1_234,
      edges: [],
      minCoOccurrenceCount: DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
      knownGoodPolicy: DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
      retentionDays: DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
    });
  });

  it("persists and lists edges under chrome.storage.local", async () => {
    const edge = sampleEdge();
    const store = await replaceStoredRelationshipEdges([edge], {
      updatedAt: 999,
    });

    expect(store.schemaVersion).toBe(RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION);
    expect(store.updatedAt).toBe(999);
    expect(store.edges).toEqual([edge]);
    expect(store.retentionDays).toBe(DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS);
    expect(localStore[STORAGE_KEY_RELATIONSHIP_EDGES]).toEqual(store);
    expect(await listStoredRelationshipEdges()).toEqual([edge]);
    expect(await getStoredRelationshipEdge(edge.edgeId)).toEqual(edge);
  });

  it("upserts by entity pair identity (merges sessions) and clears while preserving settings", async () => {
    const first = sampleEdge(["vera5-inv-a"]);
    await replaceStoredRelationshipEdges([first], { updatedAt: 1 });
    await setRelationshipEdgeMinCoOccurrenceCount(3);
    await setRelationshipEdgeKnownGoodPolicy(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE
    );
    await setRelationshipEdgeRetentionDays(45);

    const second = createRelationshipEdge({
      entityA: "domain:example.com",
      entityB: "ipv4:8.8.8.8",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-b"],
      firstSeen: nowMs - 2_000,
      lastSeen: nowMs - 100,
      weight: 1,
    });
    await upsertStoredRelationshipEdge(second, { updatedAt: 2 });

    const listed = await listStoredRelationshipEdges();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.sessionIds).toEqual(["vera5-inv-a", "vera5-inv-b"]);
    expect(listed[0]?.firstSeen).toBe(nowMs - 2_000);
    expect(listed[0]?.lastSeen).toBe(nowMs - 100);
    expect(listed[0]?.weight).toBe(2);

    const cleared = await clearStoredRelationshipEdges({ updatedAt: 3 });
    expect(cleared.edges).toEqual([]);
    expect(cleared.minCoOccurrenceCount).toBe(3);
    expect(cleared.knownGoodPolicy).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE
    );
    expect(cleared.retentionDays).toBe(45);
    expect(localStore[STORAGE_KEY_RELATIONSHIP_EDGES]).toEqual(
      expect.objectContaining({
        schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
        edges: [],
        minCoOccurrenceCount: 3,
        knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
        retentionDays: 45,
      })
    );
  });

  it("clear-all does not delete investigation sessions storage", async () => {
    const { STORAGE_KEY_INVESTIGATION_SESSIONS } = await import(
      "./investigationSessionStorage"
    );
    const sessionEnvelope = {
      schemaVersion: 1,
      updatedAt: nowMs,
      sessions: [{ id: "vera5-inv-keep", title: "Keep me" }],
      activeSessionId: "vera5-inv-keep",
    };
    localStore[STORAGE_KEY_INVESTIGATION_SESSIONS] = sessionEnvelope;
    await replaceStoredRelationshipEdges([sampleEdge()], {
      updatedAt: nowMs,
      retentionDays: 90,
    });

    await clearStoredRelationshipEdges({ updatedAt: nowMs + 1 });

    expect(localStore[STORAGE_KEY_INVESTIGATION_SESSIONS]).toEqual(sessionEnvelope);
    expect(
      (localStore[STORAGE_KEY_RELATIONSHIP_EDGES] as { edges: unknown[] }).edges
    ).toEqual([]);
  });

  it("migrates unversioned legacy envelopes on read and rewrites storage", async () => {
    const edge = sampleEdge();
    localStore[STORAGE_KEY_RELATIONSHIP_EDGES] = {
      updatedAt: 42,
      edges: [edge],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: "off",
    };

    const store = await getRelationshipEdgesStore();
    expect(store.schemaVersion).toBe(RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION);
    expect(store.updatedAt).toBe(42);
    expect(store.edges).toEqual([edge]);
    expect(store.retentionDays).toBe(DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS);
    expect(localStore[STORAGE_KEY_RELATIONSHIP_EDGES]).toEqual(
      expect.objectContaining({
        schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
        edges: [edge],
        retentionDays: DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
      })
    );
  });

  it("migrateRelationshipEdgesStore handles null, unversioned, v1, and unsupported newer", () => {
    const empty = migrateRelationshipEdgesStore(null);
    expect(empty.migrated).toBe(false);
    expect(empty.fromSchemaVersion).toBeNull();
    expect(empty.store).toMatchObject({
      schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
      edges: [],
      minCoOccurrenceCount: DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
      knownGoodPolicy: DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
      retentionDays: DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
    });

    const edge = sampleEdge();
    const legacy = migrateRelationshipEdgesStore({
      edges: [edge],
      updatedAt: 7,
    });
    expect(legacy.migrated).toBe(true);
    expect(legacy.fromSchemaVersion).toBeNull();
    expect(legacy.store.edges).toEqual([edge]);

    const current = migrateRelationshipEdgesStore({
      schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
      updatedAt: 8,
      edges: [edge],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: "off",
      retentionDays: 30,
    });
    expect(current.migrated).toBe(false);
    expect(current.fromSchemaVersion).toBe(1);
    expect(current.store.retentionDays).toBe(30);

    const newer = migrateRelationshipEdgesStore({
      schemaVersion: 99,
      updatedAt: 9,
      edges: [edge],
    });
    expect(newer.migrated).toBe(true);
    expect(newer.fromSchemaVersion).toBe(99);
    expect(newer.store.edges).toEqual([]);
  });

  it("normalize drops invalid edges and unknown store versions", () => {
    const edge = sampleEdge();
    expect(
      normalizeRelationshipEdgesStore({
        schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
        updatedAt: 1,
        edges: [edge, { bad: true }, null],
        minCoOccurrenceCount: 2,
        knownGoodPolicy: "off",
      }).edges
    ).toEqual([edge]);

    expect(
      normalizeRelationshipEdgesStore({
        schemaVersion: 99,
        updatedAt: 1,
        edges: [edge],
      }).edges
    ).toEqual([]);
  });

  it("persists settings setters and respects max stored edge cap constant", async () => {
    expect(MAX_STORED_RELATIONSHIP_EDGES).toBe(4096);
    await replaceStoredRelationshipEdges([sampleEdge()]);
    const withMin = await setRelationshipEdgeMinCoOccurrenceCount(4);
    expect(withMin.minCoOccurrenceCount).toBe(4);
    const withPolicy = await setRelationshipEdgeKnownGoodPolicy("down_rank");
    expect(withPolicy.knownGoodPolicy).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK
    );
    expect(await persistRelationshipEdgesStore(withPolicy)).toBe(true);
  });

  it("truncates edge list to MAX_STORED_RELATIONSHIP_EDGES after co-occurrence sort", () => {
    const edges = Array.from(
      { length: MAX_STORED_RELATIONSHIP_EDGES + 8 },
      (_, index) =>
        createRelationshipEdge({
          entityA: "ipv4:1.1.1.1",
          entityB: `domain:host-${index}.example`,
          relationship: RELATIONSHIP_TYPE.CO_SEEN,
          sessionIds: ["vera5-inv-a", "vera5-inv-b"],
          firstSeen: nowMs - index,
          lastSeen: nowMs - index,
          weight: 2,
        })
    );
    const normalized = normalizeRelationshipEdgesStore({
      schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      edges,
      minCoOccurrenceCount: DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
      knownGoodPolicy: DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
    });
    expect(normalized.edges).toHaveLength(MAX_STORED_RELATIONSHIP_EDGES);
    expect(normalized.retentionDays).toBe(DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS);
  });

  it("prunes edges older than the retention window on read", async () => {
    const fresh = sampleEdge();
    const stale = createRelationshipEdge({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:old.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-c", "vera5-inv-d"],
      firstSeen: nowMs - 120 * RELATIONSHIP_EDGE_MS_PER_DAY,
      lastSeen: nowMs - 100 * RELATIONSHIP_EDGE_MS_PER_DAY,
      weight: 2,
    });

    await replaceStoredRelationshipEdges([fresh, stale], {
      updatedAt: nowMs,
      retentionDays: 90,
    });

    const loaded = await getRelationshipEdgesStore();
    expect(loaded.edges.map((edge) => edge.edgeId)).toEqual([fresh.edgeId]);
    expect(loaded.retentionDays).toBe(90);
    expect(
      (localStore[STORAGE_KEY_RELATIONSHIP_EDGES] as { edges: unknown[] }).edges
    ).toHaveLength(1);
  });

  it("setRelationshipEdgeRetentionDays updates the window and prunes", async () => {
    const mid = createRelationshipEdge({
      entityA: "ipv4:9.9.9.9",
      entityB: "domain:mid.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-e", "vera5-inv-f"],
      firstSeen: nowMs - 20 * RELATIONSHIP_EDGE_MS_PER_DAY,
      lastSeen: nowMs - 10 * RELATIONSHIP_EDGE_MS_PER_DAY,
      weight: 2,
    });
    await replaceStoredRelationshipEdges([mid], {
      updatedAt: nowMs,
      retentionDays: 90,
    });

    const shortened = await setRelationshipEdgeRetentionDays(5);
    expect(shortened.retentionDays).toBe(5);
    expect(shortened.edges).toEqual([]);
  });

  it("does not call network APIs while persisting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    await replaceStoredRelationshipEdges([sampleEdge()]);
    await upsertStoredRelationshipEdge(sampleEdge(["vera5-inv-c"]));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
