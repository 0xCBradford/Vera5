import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRELATION_CLUSTER_SCHEMA_VERSION,
  createCorrelationCluster,
  createDefaultCorrelationClusterOverlapMergeConfig,
  DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
} from "./correlationCluster";
import {
  CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
  STORAGE_KEY_CORRELATION_CLUSTERS,
  buildStoredCorrelationClustersFromInvestigationMemory,
  clearStoredCorrelationClusters,
  createEmptyCorrelationClustersStore,
  getCorrelationClustersStore,
  getStoredCorrelationCluster,
  listStoredCorrelationClusters,
  migrateCorrelationClustersStore,
  normalizeCorrelationClustersStore,
  persistCorrelationClustersStore,
  replaceStoredCorrelationClusters,
  setCorrelationClusterOverlapMerge,
  setCorrelationClusterRetentionDays,
  upsertStoredCorrelationCluster,
} from "./correlationClusterStorage";
import {
  buildIocCoOccurrenceMemberKey,
  buildPageIocCoOccurrenceIndexFromSnapshot,
} from "./iocCoOccurrence";
import * as iocCoOccurrenceStorage from "./iocCoOccurrenceStorage";
import { createInvestigationSession } from "./investigationSession";
import * as investigationSessionStorage from "./investigationSessionStorage";
import { IOC_TYPE } from "./iocRegex";
import * as iocLabelStorage from "./iocLabelStorage";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";

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

describe("correlationClusterStorage", () => {
  let localStore: Record<string, unknown>;

  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");

  function sampleCluster(clusterId = "cc-sample") {
    const nowMs = Date.now();
    return createCorrelationCluster({
      clusterId,
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a", "session-b"],
      firstSeenAt: nowMs - 1_000,
      lastSeenAt: nowMs,
      coOccurrenceCount: 2,
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
    const empty = createEmptyCorrelationClustersStore(1_234);
    expect(empty).toEqual({
      schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
      updatedAt: 1_234,
      clusters: [],
      retentionDays: DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
      overlapMerge: null,
    });
  });

  it("persists and lists clusters under chrome.storage.local", async () => {
    const cluster = sampleCluster();
    const store = await replaceStoredCorrelationClusters([cluster], {
      updatedAt: 999,
    });

    expect(store.schemaVersion).toBe(CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION);
    expect(store.updatedAt).toBe(999);
    expect(store.clusters).toEqual([cluster]);
    expect(localStore[STORAGE_KEY_CORRELATION_CLUSTERS]).toEqual(store);
    expect(await listStoredCorrelationClusters()).toEqual([cluster]);
    expect(await getStoredCorrelationCluster(cluster.clusterId)).toEqual(cluster);
  });

  it("upserts by cluster id and clears storage", async () => {
    const first = sampleCluster("cc-1");
    await replaceStoredCorrelationClusters([first], { updatedAt: 1 });

    const updated = createCorrelationCluster({
      ...first,
      lastSeenAt: first.lastSeenAt + 500,
      coOccurrenceCount: 3,
      sessionIds: ["session-a", "session-b", "session-c"],
    });
    await upsertStoredCorrelationCluster(updated, { updatedAt: 2 });

    const listed = await listStoredCorrelationClusters();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.sessionIds).toEqual(["session-a", "session-b", "session-c"]);
    expect(listed[0]?.lastSeenAt).toBe(first.lastSeenAt + 500);

    await clearStoredCorrelationClusters();
    expect(localStore[STORAGE_KEY_CORRELATION_CLUSTERS]).toEqual(
      expect.objectContaining({
        schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
        clusters: [],
        retentionDays: DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
        overlapMerge: null,
      })
    );
    expect(await getCorrelationClustersStore()).toEqual(
      expect.objectContaining({
        schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
        clusters: [],
        retentionDays: DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
        overlapMerge: null,
      })
    );
  });

  it("migration hook upgrades unversioned legacy payloads and rewrites storage on get", async () => {
    const cluster = sampleCluster();
    localStore[STORAGE_KEY_CORRELATION_CLUSTERS] = {
      clusters: [cluster],
      updatedAt: 42,
    };

    const migration = migrateCorrelationClustersStore(
      localStore[STORAGE_KEY_CORRELATION_CLUSTERS]
    );
    expect(migration.migrated).toBe(true);
    expect(migration.fromSchemaVersion).toBeNull();
    expect(migration.store.schemaVersion).toBe(CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION);
    expect(migration.store.clusters).toEqual([cluster]);

    const loaded = await getCorrelationClustersStore();
    expect(loaded.clusters).toEqual([cluster]);
    expect(localStore[STORAGE_KEY_CORRELATION_CLUSTERS]).toEqual(
      expect.objectContaining({
        schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
        updatedAt: 42,
        clusters: [cluster],
      })
    );
  });

  it("migration hook leaves current-schema stores unchanged", () => {
    const cluster = sampleCluster();
    const current = {
      schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
      updatedAt: 10,
      clusters: [cluster],
      retentionDays: DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
      overlapMerge: null,
    };
    const migration = migrateCorrelationClustersStore(current);
    expect(migration.migrated).toBe(false);
    expect(migration.fromSchemaVersion).toBe(CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION);
    expect(migration.store).toEqual(current);
  });

  it("migration hook resets unsupported newer schema versions", () => {
    const migration = migrateCorrelationClustersStore({
      schemaVersion: 99,
      updatedAt: 1,
      clusters: [sampleCluster()],
    });
    expect(migration.migrated).toBe(true);
    expect(migration.fromSchemaVersion).toBe(99);
    expect(migration.store.clusters).toEqual([]);
    expect(migration.store.retentionDays).toBe(DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS);
  });

  it("normalize drops invalid clusters and requires store schema version", () => {
    const cluster = sampleCluster();
    expect(
      normalizeCorrelationClustersStore({
        schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
        updatedAt: 5,
        clusters: [
          cluster,
          { ...cluster, schemaVersion: CORRELATION_CLUSTER_SCHEMA_VERSION + 1 },
          { not: "a cluster" },
        ],
      }).clusters
    ).toEqual([cluster]);

    expect(
      normalizeCorrelationClustersStore({
        schemaVersion: 0,
        updatedAt: 5,
        clusters: [cluster],
      }).clusters
    ).toEqual([]);
  });

  it("persist keeps an empty envelope so retention days survive clearing", async () => {
    await replaceStoredCorrelationClusters([sampleCluster()], { updatedAt: 1 });
    expect(localStore[STORAGE_KEY_CORRELATION_CLUSTERS]).toBeDefined();

    await persistCorrelationClustersStore(createEmptyCorrelationClustersStore(2));
    expect(localStore[STORAGE_KEY_CORRELATION_CLUSTERS]).toEqual({
      schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
      updatedAt: 2,
      clusters: [],
      retentionDays: DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
      overlapMerge: null,
    });
  });

  it("prunes clusters older than the retention window on read", async () => {
    const nowMs = Date.UTC(2026, 6, 22);
    const fresh = createCorrelationCluster({
      clusterId: "cc-fresh",
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a", "session-b"],
      firstSeenAt: nowMs - 1_000,
      lastSeenAt: nowMs - 1_000,
      coOccurrenceCount: 2,
    });
    const stale = createCorrelationCluster({
      clusterId: "cc-stale",
      memberIocKeys: [
        buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "old.example"),
      ],
      sessionIds: ["session-c", "session-d"],
      firstSeenAt: nowMs - 120 * 24 * 60 * 60 * 1000,
      lastSeenAt: nowMs - 100 * 24 * 60 * 60 * 1000,
      coOccurrenceCount: 2,
    });

    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    await replaceStoredCorrelationClusters([fresh, stale], {
      updatedAt: nowMs,
      retentionDays: 90,
    });

    const loaded = await getCorrelationClustersStore();
    expect(loaded.clusters.map((cluster) => cluster.clusterId)).toEqual(["cc-fresh"]);
    expect(loaded.retentionDays).toBe(90);
    expect(
      (localStore[STORAGE_KEY_CORRELATION_CLUSTERS] as { clusters: unknown[] }).clusters
    ).toHaveLength(1);
  });

  it("setCorrelationClusterRetentionDays updates the window and prunes", async () => {
    const nowMs = Date.UTC(2026, 6, 22);
    const cluster = createCorrelationCluster({
      clusterId: "cc-mid",
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a", "session-b"],
      firstSeenAt: nowMs - 20 * 24 * 60 * 60 * 1000,
      lastSeenAt: nowMs - 10 * 24 * 60 * 60 * 1000,
      coOccurrenceCount: 2,
    });
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    await replaceStoredCorrelationClusters([cluster], {
      updatedAt: nowMs,
      retentionDays: 90,
    });

    const shortened = await setCorrelationClusterRetentionDays(5);
    expect(shortened.retentionDays).toBe(5);
    expect(shortened.clusters).toEqual([]);
  });

  it("setCorrelationClusterOverlapMerge persists the threshold and clear keeps it", async () => {
    const cluster = sampleCluster();
    await replaceStoredCorrelationClusters([cluster], { updatedAt: 1 });
    const withOverlap = await setCorrelationClusterOverlapMerge({
      mode: "jaccard",
      jaccardThreshold: 0.75,
    });
    expect(withOverlap.overlapMerge).toEqual({
      ...createDefaultCorrelationClusterOverlapMergeConfig(),
      mode: "jaccard",
      jaccardThreshold: 0.75,
    });

    await clearStoredCorrelationClusters();
    const cleared = await getCorrelationClustersStore();
    expect(cleared.clusters).toEqual([]);
    expect(cleared.overlapMerge?.jaccardThreshold).toBe(0.75);
    expect(cleared.retentionDays).toBe(DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS);

    const disabled = await setCorrelationClusterOverlapMerge(null);
    expect(disabled.overlapMerge).toBeNull();
  });

  it("buildStoredCorrelationClustersFromInvestigationMemory applies stored overlap threshold", async () => {
    const ipv4 = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
    const domain = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");
    const cve = buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228");

    const sessionA = createInvestigationSession({
      id: "overlap-a",
      title: "A",
      pageUrl: "http://localhost:8080/a",
      createdAt: 1,
      updatedAt: 2,
    });
    const sessionB = createInvestigationSession({
      id: "overlap-b",
      title: "B",
      pageUrl: "http://localhost:8080/b",
      createdAt: 3,
      updatedAt: 4,
    });

    const pageA = buildPageIocCoOccurrenceIndexFromSnapshot(
      buildTabScanSnapshotPayload({
        pageUrl: sessionA.pageUrl ?? "http://localhost:8080/a",
        scannedAt: 10,
        entries: [
          {
            type: IOC_TYPE.IPV4,
            value: "8.8.8.8",
            anchorId: "a1",
            ruleId: "test-rule",
            sourceTextHint: "8.8.8.8",
          },
          {
            type: IOC_TYPE.DOMAIN,
            value: "evil.example",
            anchorId: "a2",
            ruleId: "test-rule",
            sourceTextHint: "evil.example",
          },
        ],
      })
    );
    const pageB = buildPageIocCoOccurrenceIndexFromSnapshot(
      buildTabScanSnapshotPayload({
        pageUrl: sessionB.pageUrl ?? "http://localhost:8080/b",
        scannedAt: 11,
        entries: [
          {
            type: IOC_TYPE.DOMAIN,
            value: "evil.example",
            anchorId: "b1",
            ruleId: "test-rule",
            sourceTextHint: "evil.example",
          },
          {
            type: IOC_TYPE.CVE,
            value: "CVE-2021-44228",
            anchorId: "b2",
            ruleId: "test-rule",
            sourceTextHint: "CVE-2021-44228",
          },
        ],
      })
    );

    vi.spyOn(investigationSessionStorage, "getInvestigationSessionsStore").mockResolvedValue({
      schemaVersion: 1,
      activeSessionId: sessionA.id,
      sessions: [sessionA, sessionB],
    });
    vi.spyOn(iocCoOccurrenceStorage, "getIocCoOccurrenceStore").mockResolvedValue({
      schemaVersion: 1,
      sessions: [
        { sessionId: sessionA.id, updatedAt: 10, pages: [pageA] },
        { sessionId: sessionB.id, updatedAt: 11, pages: [pageB] },
      ],
    });
    vi.spyOn(iocLabelStorage, "getIocLabelsRecord").mockResolvedValue({});

    await setCorrelationClusterOverlapMerge({
      mode: "jaccard",
      jaccardThreshold: 0.3,
    });

    const withoutOverride = await buildStoredCorrelationClustersFromInvestigationMemory();
    expect(withoutOverride).toHaveLength(1);
    expect(withoutOverride[0]?.sessionIds.sort()).toEqual(["overlap-a", "overlap-b"]);
    expect(withoutOverride[0]?.memberIocKeys.sort()).toEqual([cve, domain, ipv4].sort());

    const withDisabledOverride = await buildStoredCorrelationClustersFromInvestigationMemory({
      overlapMerge: null,
    });
    expect(withDisabledOverride).toEqual([]);
  });
});
