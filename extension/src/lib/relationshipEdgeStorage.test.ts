import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
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

  function sampleEdge(sessionIds: string[] = ["vera5-inv-a", "vera5-inv-b"]) {
    return createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds,
      firstSeen: 100,
      lastSeen: 200,
      weight: sessionIds.length,
    });
  }

  beforeEach(() => {
    localStore = {};
    stubChromeStorage(localStore);
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

    const second = createRelationshipEdge({
      entityA: "domain:example.com",
      entityB: "ipv4:8.8.8.8",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-b"],
      firstSeen: 50,
      lastSeen: 250,
      weight: 1,
    });
    await upsertStoredRelationshipEdge(second, { updatedAt: 2 });

    const listed = await listStoredRelationshipEdges();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.sessionIds).toEqual(["vera5-inv-a", "vera5-inv-b"]);
    expect(listed[0]?.firstSeen).toBe(50);
    expect(listed[0]?.lastSeen).toBe(250);
    expect(listed[0]?.weight).toBe(2);

    const cleared = await clearStoredRelationshipEdges({ updatedAt: 3 });
    expect(cleared.edges).toEqual([]);
    expect(cleared.minCoOccurrenceCount).toBe(3);
    expect(cleared.knownGoodPolicy).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE
    );
    expect(localStore[STORAGE_KEY_RELATIONSHIP_EDGES]).toEqual(
      expect.objectContaining({
        schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
        edges: [],
        minCoOccurrenceCount: 3,
        knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
      })
    );
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
    expect(localStore[STORAGE_KEY_RELATIONSHIP_EDGES]).toEqual(
      expect.objectContaining({
        schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
        edges: [edge],
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
    });
    expect(current.migrated).toBe(false);
    expect(current.fromSchemaVersion).toBe(1);

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

  it("does not call network APIs while persisting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    await replaceStoredRelationshipEdges([sampleEdge()]);
    await upsertStoredRelationshipEdge(sampleEdge(["vera5-inv-c"]));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
