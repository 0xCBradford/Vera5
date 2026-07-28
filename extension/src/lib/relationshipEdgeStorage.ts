import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
  mergeRelationshipEdgePair,
  normalizeRelationshipEdge,
  normalizeRelationshipEdgeKnownGoodPolicy,
  normalizeRelationshipEdgeMinCoOccurrenceCount,
  relationshipEdgeCoOccurrenceCount,
  type RelationshipEdge,
  type RelationshipEdgeKnownGoodPolicy,
} from "./relationshipEdge";

/** Store envelope version for persisted relationship edges. */
export const RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION = 1;

export const STORAGE_KEY_RELATIONSHIP_EDGES = "relationshipEdges";

/** Soft cap for persisted edges (normalize truncates after co-occurrence sort). */
export const MAX_STORED_RELATIONSHIP_EDGES = 4096;

export type RelationshipEdgesStore = {
  schemaVersion: typeof RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION;
  updatedAt: number;
  edges: RelationshipEdge[];
  /** Inclusive min distinct sessions for cross-session rollup consumers. */
  minCoOccurrenceCount: number;
  /** Known-good edge policy (`off` / `exclude` / `down_rank`). */
  knownGoodPolicy: RelationshipEdgeKnownGoodPolicy;
};

export type RelationshipEdgesMigrationResult = {
  store: RelationshipEdgesStore;
  /** True when the raw payload was rewritten to the current store schema. */
  migrated: boolean;
  /** Detected inbound schema version, or null when missing/unversioned. */
  fromSchemaVersion: number | null;
};

function canUseRelationshipEdgeStorage(): boolean {
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

function sortStoredRelationshipEdges(
  edges: readonly RelationshipEdge[]
): RelationshipEdge[] {
  return [...edges].sort((left, right) => {
    const leftCount = relationshipEdgeCoOccurrenceCount(left);
    const rightCount = relationshipEdgeCoOccurrenceCount(right);
    if (rightCount !== leftCount) {
      return rightCount - leftCount;
    }
    if (right.lastSeen !== left.lastSeen) {
      return right.lastSeen - left.lastSeen;
    }
    return left.edgeId.localeCompare(right.edgeId);
  });
}

function normalizeEdgeList(value: unknown): RelationshipEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const byIdentity = new Map<string, RelationshipEdge>();
  for (const entry of value) {
    const normalized = normalizeRelationshipEdge(entry);
    if (!normalized) {
      continue;
    }
    const identity = `${normalized.relationship}|${normalized.entityA}|${normalized.entityB}`;
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, normalized);
      continue;
    }
    byIdentity.set(identity, mergeRelationshipEdgePair(existing, normalized));
  }
  const edges = sortStoredRelationshipEdges([...byIdentity.values()]);
  if (edges.length > MAX_STORED_RELATIONSHIP_EDGES) {
    return edges.slice(0, MAX_STORED_RELATIONSHIP_EDGES);
  }
  return edges;
}

export function createEmptyRelationshipEdgesStore(
  updatedAt: number = Date.now(),
  minCoOccurrenceCount: number = DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
  knownGoodPolicy: RelationshipEdgeKnownGoodPolicy = DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY
): RelationshipEdgesStore {
  return {
    schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
    updatedAt,
    edges: [],
    minCoOccurrenceCount: normalizeRelationshipEdgeMinCoOccurrenceCount(
      minCoOccurrenceCount
    ),
    knownGoodPolicy: normalizeRelationshipEdgeKnownGoodPolicy(knownGoodPolicy),
  };
}

export function buildRelationshipEdgesStorePayload(input: {
  edges: readonly RelationshipEdge[];
  updatedAt?: number;
  minCoOccurrenceCount?: number | null;
  knownGoodPolicy?: RelationshipEdgeKnownGoodPolicy | string | null;
}): RelationshipEdgesStore {
  return {
    schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
    updatedAt: input.updatedAt ?? Date.now(),
    edges: normalizeEdgeList(input.edges),
    minCoOccurrenceCount: normalizeRelationshipEdgeMinCoOccurrenceCount(
      input.minCoOccurrenceCount
    ),
    knownGoodPolicy: normalizeRelationshipEdgeKnownGoodPolicy(input.knownGoodPolicy),
  };
}

/**
 * Normalizes a current-schema store payload. Invalid shapes become empty.
 */
export function normalizeRelationshipEdgesStore(
  value: unknown
): RelationshipEdgesStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyRelationshipEdgesStore();
  }

  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION
  ) {
    return createEmptyRelationshipEdgesStore();
  }

  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return buildRelationshipEdgesStorePayload({
    edges: record.edges as RelationshipEdge[],
    updatedAt,
    minCoOccurrenceCount: record.minCoOccurrenceCount,
    knownGoodPolicy: record.knownGoodPolicy as RelationshipEdgeKnownGoodPolicy,
  });
}

function migrateLegacyUnversionedRelationshipEdgesStore(
  record: Record<string, unknown>
): RelationshipEdgesMigrationResult | null {
  if (!Array.isArray(record.edges)) {
    return null;
  }
  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return {
    store: buildRelationshipEdgesStorePayload({
      edges: record.edges,
      updatedAt,
      minCoOccurrenceCount: record.minCoOccurrenceCount,
      knownGoodPolicy: record.knownGoodPolicy as RelationshipEdgeKnownGoodPolicy,
    }),
    migrated: true,
    fromSchemaVersion: null,
  };
}

/**
 * Migration hook for the relationship edges storage envelope.
 * Current target schema is v1. Future store versions should chain here.
 */
export function migrateRelationshipEdgesStore(
  value: unknown
): RelationshipEdgesMigrationResult {
  if (value === undefined || value === null) {
    return {
      store: createEmptyRelationshipEdgesStore(),
      migrated: false,
      fromSchemaVersion: null,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      store: createEmptyRelationshipEdgesStore(),
      migrated: true,
      fromSchemaVersion: null,
    };
  }

  const record = value as Record<string, unknown>;
  const fromSchemaVersion = readStoredSchemaVersion(record.schemaVersion);

  if (fromSchemaVersion === null) {
    const legacy = migrateLegacyUnversionedRelationshipEdgesStore(record);
    if (legacy) {
      return legacy;
    }
    return {
      store: createEmptyRelationshipEdgesStore(),
      migrated: true,
      fromSchemaVersion: null,
    };
  }

  if (fromSchemaVersion === RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION) {
    return {
      store: normalizeRelationshipEdgesStore(record),
      migrated: false,
      fromSchemaVersion,
    };
  }

  if (fromSchemaVersion < RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION) {
    const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
    return {
      store: buildRelationshipEdgesStorePayload({
        edges: Array.isArray(record.edges) ? record.edges : [],
        updatedAt,
        minCoOccurrenceCount: record.minCoOccurrenceCount,
        knownGoodPolicy: record.knownGoodPolicy as RelationshipEdgeKnownGoodPolicy,
      }),
      migrated: true,
      fromSchemaVersion,
    };
  }

  // Newer-than-supported envelope: do not invent a downgrade path.
  return {
    store: createEmptyRelationshipEdgesStore(),
    migrated: true,
    fromSchemaVersion,
  };
}

export function isRelationshipEdgesStore(
  value: unknown
): value is RelationshipEdgesStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION
  ) {
    return false;
  }
  if (readFiniteTimestamp(record.updatedAt) === null || !Array.isArray(record.edges)) {
    return false;
  }
  const normalized = normalizeRelationshipEdgesStore(record);
  return (
    normalized.schemaVersion === RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION &&
    normalized.edges.length ===
      record.edges.filter((entry) => normalizeRelationshipEdge(entry) !== null).length
  );
}

export async function getRelationshipEdgesStore(): Promise<RelationshipEdgesStore> {
  if (!canUseRelationshipEdgeStorage()) {
    return createEmptyRelationshipEdgesStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_RELATIONSHIP_EDGES);
  const migration = migrateRelationshipEdgesStore(
    result[STORAGE_KEY_RELATIONSHIP_EDGES]
  );

  if (migration.migrated) {
    await persistRelationshipEdgesStore(migration.store);
  }

  return migration.store;
}

export async function persistRelationshipEdgesStore(
  store: RelationshipEdgesStore
): Promise<boolean> {
  if (!canUseRelationshipEdgeStorage()) {
    return false;
  }

  const normalized = normalizeRelationshipEdgesStore(store);
  return safeStorageLocalSet({
    [STORAGE_KEY_RELATIONSHIP_EDGES]: {
      schemaVersion: RELATIONSHIP_EDGES_STORE_SCHEMA_VERSION,
      updatedAt: normalized.updatedAt,
      edges: normalized.edges,
      minCoOccurrenceCount: normalized.minCoOccurrenceCount,
      knownGoodPolicy: normalized.knownGoodPolicy,
    },
  });
}

export async function listStoredRelationshipEdges(): Promise<RelationshipEdge[]> {
  const store = await getRelationshipEdgesStore();
  return [...store.edges];
}

export async function getStoredRelationshipEdge(
  edgeId: string
): Promise<RelationshipEdge | null> {
  const id = edgeId.trim();
  if (id.length === 0) {
    return null;
  }
  const store = await getRelationshipEdgesStore();
  return store.edges.find((edge) => edge.edgeId === id) ?? null;
}

export async function replaceStoredRelationshipEdges(
  edges: readonly RelationshipEdge[],
  options?: {
    updatedAt?: number;
    minCoOccurrenceCount?: number | null;
    knownGoodPolicy?: RelationshipEdgeKnownGoodPolicy | string | null;
  }
): Promise<RelationshipEdgesStore> {
  const current = await getRelationshipEdgesStore();
  const store = buildRelationshipEdgesStorePayload({
    edges,
    updatedAt: options?.updatedAt,
    minCoOccurrenceCount:
      options?.minCoOccurrenceCount === undefined
        ? current.minCoOccurrenceCount
        : options.minCoOccurrenceCount,
    knownGoodPolicy:
      options?.knownGoodPolicy === undefined
        ? current.knownGoodPolicy
        : options.knownGoodPolicy,
  });
  await persistRelationshipEdgesStore(store);
  return store;
}

export async function upsertStoredRelationshipEdge(
  edge: RelationshipEdge,
  options?: { updatedAt?: number }
): Promise<RelationshipEdgesStore> {
  const normalized = normalizeRelationshipEdge(edge);
  if (!normalized) {
    return getRelationshipEdgesStore();
  }

  const current = await getRelationshipEdgesStore();
  const identity = `${normalized.relationship}|${normalized.entityA}|${normalized.entityB}`;
  let found = false;
  const nextEdges = current.edges.map((existing) => {
    const existingIdentity = `${existing.relationship}|${existing.entityA}|${existing.entityB}`;
    if (existingIdentity !== identity) {
      return existing;
    }
    found = true;
    return mergeRelationshipEdgePair(existing, normalized);
  });
  if (!found) {
    nextEdges.push(normalized);
  }

  const store = buildRelationshipEdgesStorePayload({
    edges: nextEdges,
    updatedAt: options?.updatedAt ?? Date.now(),
    minCoOccurrenceCount: current.minCoOccurrenceCount,
    knownGoodPolicy: current.knownGoodPolicy,
  });
  await persistRelationshipEdgesStore(store);
  return store;
}

/**
 * Clears stored edges while preserving min co-occurrence and known-good policy.
 */
export async function clearStoredRelationshipEdges(
  options?: { updatedAt?: number }
): Promise<RelationshipEdgesStore> {
  const current = await getRelationshipEdgesStore();
  const store = createEmptyRelationshipEdgesStore(
    options?.updatedAt ?? Date.now(),
    current.minCoOccurrenceCount,
    current.knownGoodPolicy
  );
  await persistRelationshipEdgesStore(store);
  return store;
}

export async function setRelationshipEdgeMinCoOccurrenceCount(
  minCoOccurrenceCount: number
): Promise<RelationshipEdgesStore> {
  const current = await getRelationshipEdgesStore();
  const store = buildRelationshipEdgesStorePayload({
    edges: current.edges,
    updatedAt: Date.now(),
    minCoOccurrenceCount,
    knownGoodPolicy: current.knownGoodPolicy,
  });
  await persistRelationshipEdgesStore(store);
  return store;
}

export async function setRelationshipEdgeKnownGoodPolicy(
  knownGoodPolicy: RelationshipEdgeKnownGoodPolicy | string
): Promise<RelationshipEdgesStore> {
  const current = await getRelationshipEdgesStore();
  const store = buildRelationshipEdgesStorePayload({
    edges: current.edges,
    updatedAt: Date.now(),
    minCoOccurrenceCount: current.minCoOccurrenceCount,
    knownGoodPolicy,
  });
  await persistRelationshipEdgesStore(store);
  return store;
}
