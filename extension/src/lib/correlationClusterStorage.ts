import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  buildCorrelationClustersFromStoredInvestigationMemory,
  normalizeCorrelationCluster,
  normalizeCorrelationClusterOverlapMergeConfig,
  normalizeCorrelationClusterRetentionDays,
  pruneCorrelationClustersOlderThan,
  DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
  type BuildCorrelationClustersFromSessionScanIocSetsOptions,
  type CorrelationCluster,
  type CorrelationClusterOverlapMergeConfig,
} from "./correlationCluster";

/** Store envelope version for persisted correlation cluster packs. */
export const CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION = 1;

export const STORAGE_KEY_CORRELATION_CLUSTERS = "correlationClusters";

export type CorrelationClustersStore = {
  schemaVersion: typeof CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION;
  updatedAt: number;
  clusters: CorrelationCluster[];
  /** Configurable retention window in days (default documented). */
  retentionDays: number;
  /**
   * Optional overlap-merge rule for cluster promotion. `null` keeps exact-set
   * clustering only (no Jaccard / min-shared merge).
   */
  overlapMerge: CorrelationClusterOverlapMergeConfig | null;
};

export type CorrelationClustersMigrationResult = {
  store: CorrelationClustersStore;
  /** True when the raw payload was rewritten to the current store schema. */
  migrated: boolean;
  /** Detected inbound schema version, or null when missing/unversioned. */
  fromSchemaVersion: number | null;
};

function canUseCorrelationClusterStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function readStoredSchemaVersion(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

/**
 * Persisted overlap setting: missing/null/invalid → exact-set only (`null`).
 * Valid objects normalize to a full overlap-merge config.
 */
export function normalizeStoredCorrelationClusterOverlapMerge(
  value: unknown
): CorrelationClusterOverlapMergeConfig | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return normalizeCorrelationClusterOverlapMergeConfig(
    value as Partial<CorrelationClusterOverlapMergeConfig>
  );
}

function normalizeClusterList(value: unknown): CorrelationCluster[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const clusters: CorrelationCluster[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeCorrelationCluster(entry);
    if (!normalized || seenIds.has(normalized.clusterId)) {
      continue;
    }
    seenIds.add(normalized.clusterId);
    clusters.push(normalized);
  }
  return clusters.sort((left, right) => {
    if (right.coOccurrenceCount !== left.coOccurrenceCount) {
      return right.coOccurrenceCount - left.coOccurrenceCount;
    }
    if (right.lastSeenAt !== left.lastSeenAt) {
      return right.lastSeenAt - left.lastSeenAt;
    }
    return left.clusterId < right.clusterId
      ? -1
      : left.clusterId > right.clusterId
        ? 1
        : 0;
  });
}

export function createEmptyCorrelationClustersStore(
  updatedAt: number = Date.now(),
  retentionDays: number = DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
  overlapMerge: CorrelationClusterOverlapMergeConfig | null = null
): CorrelationClustersStore {
  return {
    schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
    updatedAt,
    clusters: [],
    retentionDays: normalizeCorrelationClusterRetentionDays(retentionDays),
    overlapMerge: normalizeStoredCorrelationClusterOverlapMerge(overlapMerge),
  };
}

export function buildCorrelationClustersStorePayload(input: {
  clusters: readonly CorrelationCluster[];
  updatedAt?: number;
  retentionDays?: number | null;
  overlapMerge?: CorrelationClusterOverlapMergeConfig | null;
}): CorrelationClustersStore {
  return {
    schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
    updatedAt: input.updatedAt ?? Date.now(),
    clusters: normalizeClusterList(input.clusters),
    retentionDays: normalizeCorrelationClusterRetentionDays(input.retentionDays),
    overlapMerge:
      input.overlapMerge === undefined
        ? null
        : normalizeStoredCorrelationClusterOverlapMerge(input.overlapMerge),
  };
}

/**
 * Normalizes a current-schema store payload. Invalid shapes become empty.
 */
export function normalizeCorrelationClustersStore(
  value: unknown
): CorrelationClustersStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyCorrelationClustersStore();
  }

  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION
  ) {
    return createEmptyCorrelationClustersStore();
  }

  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return buildCorrelationClustersStorePayload({
    clusters: record.clusters as CorrelationCluster[],
    updatedAt,
    retentionDays: record.retentionDays,
    overlapMerge: normalizeStoredCorrelationClusterOverlapMerge(record.overlapMerge),
  });
}

function migrateLegacyUnversionedCorrelationClustersStore(
  record: Record<string, unknown>
): CorrelationClustersMigrationResult | null {
  if (!Array.isArray(record.clusters)) {
    return null;
  }
  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return {
    store: buildCorrelationClustersStorePayload({
      clusters: record.clusters,
      updatedAt,
      retentionDays: record.retentionDays,
      overlapMerge: normalizeStoredCorrelationClusterOverlapMerge(record.overlapMerge),
    }),
    migrated: true,
    fromSchemaVersion: null,
  };
}

/**
 * Migration hook for the correlation clusters storage envelope.
 * Current target schema is v1. Future store versions should chain here.
 */
export function migrateCorrelationClustersStore(
  value: unknown
): CorrelationClustersMigrationResult {
  if (value === undefined || value === null) {
    return {
      store: createEmptyCorrelationClustersStore(),
      migrated: false,
      fromSchemaVersion: null,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      store: createEmptyCorrelationClustersStore(),
      migrated: true,
      fromSchemaVersion: null,
    };
  }

  const record = value as Record<string, unknown>;
  const fromSchemaVersion = readStoredSchemaVersion(record.schemaVersion);

  if (fromSchemaVersion === null) {
    const legacy = migrateLegacyUnversionedCorrelationClustersStore(record);
    if (legacy) {
      return legacy;
    }
    return {
      store: createEmptyCorrelationClustersStore(),
      migrated: true,
      fromSchemaVersion: null,
    };
  }

  if (fromSchemaVersion === CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION) {
    return {
      store: normalizeCorrelationClustersStore(record),
      migrated: false,
      fromSchemaVersion,
    };
  }

  if (fromSchemaVersion < CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION) {
    // No pre-v1 numbered schemas yet; treat as rebuild-to-current.
    const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
    return {
      store: buildCorrelationClustersStorePayload({
        clusters: Array.isArray(record.clusters) ? record.clusters : [],
        updatedAt,
        retentionDays: record.retentionDays,
        overlapMerge: normalizeStoredCorrelationClusterOverlapMerge(record.overlapMerge),
      }),
      migrated: true,
      fromSchemaVersion,
    };
  }

  // Newer-than-supported envelope: do not invent a downgrade path.
  return {
    store: createEmptyCorrelationClustersStore(),
    migrated: true,
    fromSchemaVersion,
  };
}

export function isCorrelationClustersStore(
  value: unknown
): value is CorrelationClustersStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION
  ) {
    return false;
  }
  if (readFiniteTimestamp(record.updatedAt) === null || !Array.isArray(record.clusters)) {
    return false;
  }
  const normalized = normalizeCorrelationClustersStore(record);
  return (
    normalized.schemaVersion === CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION &&
    normalized.clusters.length ===
      record.clusters.filter((entry) => normalizeCorrelationCluster(entry) !== null).length
  );
}

/**
 * Applies the store retention window to drop clusters older than the cutoff.
 * Returns a new store when any clusters were removed.
 */
export function applyCorrelationClustersStoreRetention(
  store: CorrelationClustersStore,
  nowMs: number = Date.now()
): { store: CorrelationClustersStore; pruned: boolean } {
  const retentionDays = normalizeCorrelationClusterRetentionDays(store.retentionDays);
  const overlapMerge = normalizeStoredCorrelationClusterOverlapMerge(store.overlapMerge);
  const clusters = pruneCorrelationClustersOlderThan(store.clusters, {
    retentionDays,
    nowMs,
  });
  if (clusters.length === store.clusters.length) {
    return {
      store: {
        ...store,
        retentionDays,
        overlapMerge,
      },
      pruned: false,
    };
  }
  return {
    store: buildCorrelationClustersStorePayload({
      clusters,
      updatedAt: nowMs,
      retentionDays,
      overlapMerge,
    }),
    pruned: true,
  };
}

export async function getCorrelationClustersStore(): Promise<CorrelationClustersStore> {
  if (!canUseCorrelationClusterStorage()) {
    return createEmptyCorrelationClustersStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_CORRELATION_CLUSTERS);
  const migration = migrateCorrelationClustersStore(
    result[STORAGE_KEY_CORRELATION_CLUSTERS]
  );
  const retention = applyCorrelationClustersStoreRetention(migration.store);

  if (migration.migrated || retention.pruned) {
    await persistCorrelationClustersStore(retention.store);
  }

  return retention.store;
}

export async function persistCorrelationClustersStore(
  store: CorrelationClustersStore
): Promise<boolean> {
  if (!canUseCorrelationClusterStorage()) {
    return false;
  }

  const normalized = normalizeCorrelationClustersStore(store);
  if (normalized.clusters.length === 0) {
    // Preserve retention and overlap preferences even when the cluster list is empty.
    await safeStorageLocalSet({
      [STORAGE_KEY_CORRELATION_CLUSTERS]: {
        schemaVersion: CORRELATION_CLUSTERS_STORE_SCHEMA_VERSION,
        updatedAt: normalized.updatedAt,
        clusters: [],
        retentionDays: normalized.retentionDays,
        overlapMerge: normalized.overlapMerge,
      },
    });
    return true;
  }

  return safeStorageLocalSet({
    [STORAGE_KEY_CORRELATION_CLUSTERS]: normalized,
  });
}

export async function listStoredCorrelationClusters(): Promise<CorrelationCluster[]> {
  const store = await getCorrelationClustersStore();
  return [...store.clusters];
}

export async function getStoredCorrelationCluster(
  clusterId: string
): Promise<CorrelationCluster | null> {
  const id = clusterId.trim();
  if (id.length === 0) {
    return null;
  }
  const store = await getCorrelationClustersStore();
  return store.clusters.find((cluster) => cluster.clusterId === id) ?? null;
}

export async function replaceStoredCorrelationClusters(
  clusters: readonly CorrelationCluster[],
  options?: {
    updatedAt?: number;
    retentionDays?: number | null;
    overlapMerge?: CorrelationClusterOverlapMergeConfig | null;
  }
): Promise<CorrelationClustersStore> {
  const current = await getCorrelationClustersStore();
  const store = buildCorrelationClustersStorePayload({
    clusters,
    updatedAt: options?.updatedAt,
    retentionDays:
      options?.retentionDays !== undefined
        ? options.retentionDays
        : current.retentionDays,
    overlapMerge:
      options?.overlapMerge !== undefined ? options.overlapMerge : current.overlapMerge,
  });
  await persistCorrelationClustersStore(store);
  return store;
}

export async function setCorrelationClusterRetentionDays(
  retentionDays: number
): Promise<CorrelationClustersStore> {
  const store = await getCorrelationClustersStore();
  const next = buildCorrelationClustersStorePayload({
    clusters: store.clusters,
    updatedAt: Date.now(),
    retentionDays,
    overlapMerge: store.overlapMerge,
  });
  const retained = applyCorrelationClustersStoreRetention(next);
  await persistCorrelationClustersStore(retained.store);
  return retained.store;
}

export async function setCorrelationClusterOverlapMerge(
  overlapMerge: CorrelationClusterOverlapMergeConfig | null
): Promise<CorrelationClustersStore> {
  const store = await getCorrelationClustersStore();
  const next = buildCorrelationClustersStorePayload({
    clusters: store.clusters,
    updatedAt: Date.now(),
    retentionDays: store.retentionDays,
    overlapMerge,
  });
  await persistCorrelationClustersStore(next);
  return next;
}

export async function upsertStoredCorrelationCluster(
  cluster: CorrelationCluster,
  options?: { updatedAt?: number }
): Promise<CorrelationClustersStore> {
  const normalized = normalizeCorrelationCluster(cluster);
  if (!normalized) {
    return getCorrelationClustersStore();
  }

  const store = await getCorrelationClustersStore();
  const nextClusters = store.clusters.filter(
    (entry) => entry.clusterId !== normalized.clusterId
  );
  nextClusters.push(normalized);
  return replaceStoredCorrelationClusters(nextClusters, {
    updatedAt: options?.updatedAt ?? Date.now(),
    retentionDays: store.retentionDays,
    overlapMerge: store.overlapMerge,
  });
}

export async function clearStoredCorrelationClusters(): Promise<boolean> {
  if (!canUseCorrelationClusterStorage()) {
    return false;
  }
  const store = await getCorrelationClustersStore();
  await persistCorrelationClustersStore(
    createEmptyCorrelationClustersStore(
      Date.now(),
      store.retentionDays,
      store.overlapMerge
    )
  );
  return true;
}

/**
 * Builds cross-session clusters from investigation memory using the stored
 * overlap-merge preference unless the caller overrides `overlapMerge`.
 */
export async function buildStoredCorrelationClustersFromInvestigationMemory(
  options?: BuildCorrelationClustersFromSessionScanIocSetsOptions
): Promise<CorrelationCluster[]> {
  const store = await getCorrelationClustersStore();
  return buildCorrelationClustersFromStoredInvestigationMemory({
    ...options,
    overlapMerge:
      options?.overlapMerge !== undefined ? options.overlapMerge : store.overlapMerge,
  });
}
