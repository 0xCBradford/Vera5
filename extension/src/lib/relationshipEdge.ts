import {
  buildIocCoOccurrenceMemberKey,
  type IocCoOccurrenceMemberKey,
} from "./iocCoOccurrence";
import { normalizeIocCollectionMemberValue } from "./iocCollection";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  createDefaultKnownGoodCategoryEnabled,
  findMatchingKnownGoodEntry,
  type KnownGoodCategoryEnabledRecord,
  type KnownGoodEntry,
} from "./knownGood";

/**
 * Local entity-level relationship edge across investigation sessions.
 * List/adjacency memory only — not a global graph database, not ML entity
 * resolution, and not a detection or attribution verdict.
 */
export const RELATIONSHIP_EDGE_SCHEMA_VERSION = 1;

export const RELATIONSHIP_EDGE_ID_PREFIX = "re-";

export const RELATIONSHIP_TYPE = {
  CO_SEEN: "co_seen",
  RESOLVED_FROM: "resolved_from",
} as const;

export type RelationshipType =
  (typeof RELATIONSHIP_TYPE)[keyof typeof RELATIONSHIP_TYPE];

export const RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  RELATIONSHIP_TYPE.CO_SEEN,
  RELATIONSHIP_TYPE.RESOLVED_FROM,
];

/** Default edge weight when callers omit an explicit weight. */
export const DEFAULT_RELATIONSHIP_EDGE_WEIGHT = 1;

export const MIN_RELATIONSHIP_EDGE_WEIGHT = 0;
export const MAX_RELATIONSHIP_EDGE_WEIGHT = 1_000_000;

/**
 * IOC types that may appear as relationship edge endpoints (IP / domain / hash).
 */
export const RELATIONSHIP_EDGE_ELIGIBLE_IOC_TYPES: readonly IocType[] = [
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
];

/** Cap pairwise co_seen edges built from one session scan (performance). */
export const DEFAULT_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION = 4096;

export const MIN_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION = 0;
export const MAX_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION = 65536;

/**
 * Default minimum distinct investigation sessions required for a merged edge
 * to be retained (cross-session rollup gate).
 */
export const DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT = 2;

export const MIN_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT = 1;
export const MAX_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT = 1024;

/**
 * Default max related entities returned per focus IOC in list/adjacency views
 * (hover card and tray). Ranked by session count then last seen; lower-ranked
 * partners beyond the cap are omitted.
 */
export const DEFAULT_MAX_RELATED_ENTITIES_PER_IOC = 64;

export const MIN_MAX_RELATED_ENTITIES_PER_IOC = 1;
export const MAX_MAX_RELATED_ENTITIES_PER_IOC = 256;

/**
 * Default retention window for persisted relationship edges (days).
 * Edges whose lastSeen is older than the window are pruned on store read.
 */
export const DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS = 90;

export const MIN_RELATIONSHIP_EDGE_RETENTION_DAYS = 1;
export const MAX_RELATIONSHIP_EDGE_RETENTION_DAYS = 3650;

export const RELATIONSHIP_EDGE_MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Known-good edge policy (default off). When enabled, edges that involve a
 * known-good list match on either endpoint are excluded or sorted after
 * non-matching edges. Informational only — not a silent safe verdict.
 */
export const RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY = {
  OFF: "off",
  EXCLUDE: "exclude",
  DOWN_RANK: "down_rank",
} as const;

export type RelationshipEdgeKnownGoodPolicy =
  (typeof RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY)[keyof typeof RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY];

export const RELATIONSHIP_EDGE_KNOWN_GOOD_POLICIES: readonly RelationshipEdgeKnownGoodPolicy[] =
  [
    RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF,
    RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
    RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK,
  ];

export const DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY =
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF;

export type RelationshipEntityKey = IocCoOccurrenceMemberKey;

export type RelationshipEdgeId = string;

/**
 * Allowlisted fields for a persisted relationship edge.
 * Entity keys use the same `type:normalizedValue` shape as same-page
 * co-occurrence / correlation cluster member keys.
 */
export type RelationshipEdge = {
  schemaVersion: typeof RELATIONSHIP_EDGE_SCHEMA_VERSION;
  edgeId: RelationshipEdgeId;
  entityA: RelationshipEntityKey;
  entityB: RelationshipEntityKey;
  relationship: RelationshipType;
  sessionIds: string[];
  firstSeen: number;
  lastSeen: number;
  weight: number;
};

export const RELATIONSHIP_EDGE_FIELD_KEYS = [
  "schemaVersion",
  "edgeId",
  "entityA",
  "entityB",
  "relationship",
  "sessionIds",
  "firstSeen",
  "lastSeen",
  "weight",
] as const;

export type CreateRelationshipEdgeInput = {
  entityA: string;
  entityB: string;
  relationship: RelationshipType | string;
  sessionIds: readonly string[];
  firstSeen?: number;
  lastSeen?: number;
  weight?: number;
  edgeId?: string;
};

/**
 * One investigation session scan snapshot used to build local relationship edges.
 * `memberIocKeys` may include URL keys for host pivots; only IP/domain/hash become
 * edge endpoints.
 */
export type RelationshipSessionScanInput = {
  sessionId: string;
  memberIocKeys: readonly string[];
  firstSeen?: number;
  lastSeen?: number;
};

/**
 * Enrichment-derived pivot hint: related entity keys linked to an enriched subject
 * (for example DNS names from an IPv4 enrich). Builds `resolved_from` edges only.
 */
export type RelationshipEnrichPivotHint = {
  sessionId: string;
  subjectEntityKey: string;
  relatedEntityKeys: readonly string[];
  seenAt?: number;
};

export type BuildRelationshipEdgesFromSessionScanOptions = {
  maxCoSeenPairsPerSession?: number;
};

export type MergeRelationshipEdgesAcrossSessionsOptions = {
  /** Inclusive minimum distinct session count after merge (default 2). */
  minCoOccurrenceCount?: number;
};

export type ApplyRelationshipEdgeKnownGoodPolicyInput = {
  policy?: RelationshipEdgeKnownGoodPolicy | string | null;
  knownGoodEntries?: readonly KnownGoodEntry[];
  categoryEnabled?: KnownGoodCategoryEnabledRecord;
};

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isRelationshipType(value: unknown): value is RelationshipType {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_TYPES as readonly string[]).includes(value)
  );
}

export function isRelationshipEdgeEligibleIocType(
  value: unknown
): value is IocType {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_EDGE_ELIGIBLE_IOC_TYPES as readonly string[]).includes(value)
  );
}

export function relationshipEdgeHasOnlyAllowlistedFields(
  value: unknown
): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.every((key) =>
    (RELATIONSHIP_EDGE_FIELD_KEYS as readonly string[]).includes(key)
  );
}

/**
 * Normalizes a non-empty unique session id list (trimmed, deduped, sorted).
 */
export function normalizeRelationshipEdgeSessionIds(
  sessionIds: unknown
): string[] | null {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return null;
  }
  const unique = new Set<string>();
  for (const entry of sessionIds) {
    const id = readNonEmptyTrimmedString(entry);
    if (!id) {
      return null;
    }
    unique.add(id);
  }
  if (unique.size === 0) {
    return null;
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
}

/**
 * Normalizes an entity key (`type:value` style). Rejects empty or whitespace-only.
 */
export function normalizeRelationshipEntityKey(
  value: unknown
): RelationshipEntityKey | null {
  const trimmed = readNonEmptyTrimmedString(value);
  return trimmed;
}

/**
 * Parses `type:value` member keys. Returns null when the key is malformed.
 */
export function parseRelationshipEntityKey(
  memberKey: string
): { iocType: IocType; value: string } | null {
  const trimmed = memberKey.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator >= trimmed.length - 1) {
    return null;
  }
  const iocType = trimmed.slice(0, separator);
  const value = normalizeIocCollectionMemberValue(trimmed.slice(separator + 1));
  if (!value) {
    return null;
  }
  if (
    !(Object.values(IOC_TYPE) as readonly string[]).includes(iocType)
  ) {
    return null;
  }
  return { iocType: iocType as IocType, value };
}

/**
 * For undirected `co_seen` edges, returns entities in lexicographic order so
 * the same pair collapses to one canonical orientation. `resolved_from` keeps
 * caller order (directed).
 */
export function canonicalizeRelationshipEdgeEntities(input: {
  entityA: string;
  entityB: string;
  relationship: RelationshipType;
}): { entityA: RelationshipEntityKey; entityB: RelationshipEntityKey } | null {
  const entityA = normalizeRelationshipEntityKey(input.entityA);
  const entityB = normalizeRelationshipEntityKey(input.entityB);
  if (!entityA || !entityB) {
    return null;
  }
  if (entityA === entityB) {
    return null;
  }
  if (input.relationship === RELATIONSHIP_TYPE.CO_SEEN) {
    if (entityA.localeCompare(entityB) <= 0) {
      return { entityA, entityB };
    }
    return { entityA: entityB, entityB: entityA };
  }
  return { entityA, entityB };
}

export function normalizeRelationshipEdgeWeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (
    value < MIN_RELATIONSHIP_EDGE_WEIGHT ||
    value > MAX_RELATIONSHIP_EDGE_WEIGHT
  ) {
    return null;
  }
  return value;
}

export function buildRelationshipEdgeId(input: {
  entityA: string;
  entityB: string;
  relationship: RelationshipType;
}): RelationshipEdgeId | null {
  if (!isRelationshipType(input.relationship)) {
    return null;
  }
  const canonical = canonicalizeRelationshipEdgeEntities({
    entityA: input.entityA,
    entityB: input.entityB,
    relationship: input.relationship,
  });
  if (!canonical) {
    return null;
  }
  const fingerprint = `${input.relationship}|${canonical.entityA}|${canonical.entityB}`;
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${RELATIONSHIP_EDGE_ID_PREFIX}${hash.toString(16)}-${input.relationship}`;
}

export function createRelationshipEdge(
  input: CreateRelationshipEdgeInput
): RelationshipEdge {
  if (!isRelationshipType(input.relationship)) {
    throw new Error(
      `Relationship edge type must be one of: ${RELATIONSHIP_TYPES.join(", ")}.`
    );
  }

  const canonical = canonicalizeRelationshipEdgeEntities({
    entityA: input.entityA,
    entityB: input.entityB,
    relationship: input.relationship,
  });
  if (!canonical) {
    throw new Error(
      "Relationship edge requires two distinct non-empty entity keys."
    );
  }

  const sessionIds = normalizeRelationshipEdgeSessionIds(input.sessionIds);
  if (!sessionIds) {
    throw new Error("Relationship edge requires a non-empty sessionIds list.");
  }

  const now = Date.now();
  const firstSeen = input.firstSeen ?? now;
  const lastSeen = input.lastSeen ?? firstSeen;
  if (
    typeof firstSeen !== "number" ||
    !Number.isFinite(firstSeen) ||
    typeof lastSeen !== "number" ||
    !Number.isFinite(lastSeen)
  ) {
    throw new Error("Relationship edge firstSeen/lastSeen must be finite timestamps.");
  }
  if (lastSeen < firstSeen) {
    throw new Error("Relationship edge lastSeen must be >= firstSeen.");
  }

  const weight =
    input.weight !== undefined
      ? normalizeRelationshipEdgeWeight(input.weight)
      : DEFAULT_RELATIONSHIP_EDGE_WEIGHT;
  if (weight === null) {
    throw new Error(
      `Relationship edge weight must be a finite number in [${MIN_RELATIONSHIP_EDGE_WEIGHT}, ${MAX_RELATIONSHIP_EDGE_WEIGHT}].`
    );
  }

  const edgeId =
    readNonEmptyTrimmedString(input.edgeId) ??
    buildRelationshipEdgeId({
      entityA: canonical.entityA,
      entityB: canonical.entityB,
      relationship: input.relationship,
    });
  if (!edgeId) {
    throw new Error("Relationship edge id could not be allocated.");
  }

  return {
    schemaVersion: RELATIONSHIP_EDGE_SCHEMA_VERSION,
    edgeId,
    entityA: canonical.entityA,
    entityB: canonical.entityB,
    relationship: input.relationship,
    sessionIds,
    firstSeen,
    lastSeen,
    weight,
  };
}

export function normalizeRelationshipEdge(
  value: unknown
): RelationshipEdge | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (!relationshipEdgeHasOnlyAllowlistedFields(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== RELATIONSHIP_EDGE_SCHEMA_VERSION) {
    return null;
  }

  if (!isRelationshipType(record.relationship)) {
    return null;
  }

  const edgeId = readNonEmptyTrimmedString(record.edgeId);
  if (!edgeId) {
    return null;
  }

  const canonical = canonicalizeRelationshipEdgeEntities({
    entityA: String(record.entityA ?? ""),
    entityB: String(record.entityB ?? ""),
    relationship: record.relationship,
  });
  if (!canonical) {
    return null;
  }

  const sessionIds = normalizeRelationshipEdgeSessionIds(record.sessionIds);
  if (!sessionIds) {
    return null;
  }

  const firstSeen = record.firstSeen;
  const lastSeen = record.lastSeen;
  if (
    typeof firstSeen !== "number" ||
    !Number.isFinite(firstSeen) ||
    typeof lastSeen !== "number" ||
    !Number.isFinite(lastSeen) ||
    lastSeen < firstSeen
  ) {
    return null;
  }

  const weight = normalizeRelationshipEdgeWeight(record.weight);
  if (weight === null) {
    return null;
  }

  return {
    schemaVersion: RELATIONSHIP_EDGE_SCHEMA_VERSION,
    edgeId,
    entityA: canonical.entityA,
    entityB: canonical.entityB,
    relationship: record.relationship,
    sessionIds,
    firstSeen,
    lastSeen,
    weight,
  };
}

export function normalizeRelationshipEdgeMaxCoSeenPairsPerSession(
  value: unknown
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION;
  }
  return Math.min(
    MAX_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION,
    Math.max(MIN_RELATIONSHIP_EDGE_MAX_CO_SEEN_PAIRS_PER_SESSION, value)
  );
}

/**
 * Inclusive minimum distinct session count used when merging edges across
 * sessions. Invalid values fall back to the default (2).
 */
export function normalizeRelationshipEdgeMinCoOccurrenceCount(
  value: unknown
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT;
  }
  return Math.min(
    MAX_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
    Math.max(MIN_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT, value)
  );
}

/**
 * Max related entities per focus IOC for list/adjacency consumers.
 * Invalid values fall back to the default (64). Clamped to 1–256.
 */
export function normalizeMaxRelatedEntitiesPerIoc(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_MAX_RELATED_ENTITIES_PER_IOC;
  }
  return Math.min(
    MAX_MAX_RELATED_ENTITIES_PER_IOC,
    Math.max(MIN_MAX_RELATED_ENTITIES_PER_IOC, value)
  );
}

/**
 * Truncate a ranked related-entity list to the per-IOC cap (keeps leading items).
 */
export function capRelatedEntitiesPerIoc<T>(
  entries: readonly T[],
  maxRelatedEntitiesPerIoc?: unknown
): T[] {
  const limit = normalizeMaxRelatedEntitiesPerIoc(maxRelatedEntitiesPerIoc);
  if (entries.length <= limit) {
    return [...entries];
  }
  return entries.slice(0, limit);
}

/**
 * Retention window in days for persisted relationship edges.
 * Invalid values fall back to the default (90). Clamped to 1–3650.
 */
export function normalizeRelationshipEdgeRetentionDays(value?: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS;
  }
  return Math.min(
    MAX_RELATIONSHIP_EDGE_RETENTION_DAYS,
    Math.max(MIN_RELATIONSHIP_EDGE_RETENTION_DAYS, value)
  );
}

export function resolveRelationshipEdgeRetentionCutoffMs(
  retentionDays: number = DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
  nowMs: number = Date.now()
): number {
  const days = normalizeRelationshipEdgeRetentionDays(retentionDays);
  return nowMs - days * RELATIONSHIP_EDGE_MS_PER_DAY;
}

/**
 * Keeps edges whose lastSeen is within the retention window (inclusive of the
 * cutoff). Older edges are pruned. Retention days are configurable; default is
 * DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS.
 */
export function pruneRelationshipEdgesOlderThan(
  edges: readonly RelationshipEdge[],
  options?: {
    retentionDays?: number | null;
    nowMs?: number;
  }
): RelationshipEdge[] {
  const retentionDays = normalizeRelationshipEdgeRetentionDays(options?.retentionDays);
  const nowMs =
    typeof options?.nowMs === "number" && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();
  const cutoffMs = resolveRelationshipEdgeRetentionCutoffMs(retentionDays, nowMs);
  return edges.filter((edge) => edge.lastSeen >= cutoffMs);
}

/**
 * Co-occurrence count for a relationship edge = distinct session ids.
 */
export function relationshipEdgeCoOccurrenceCount(
  edge: RelationshipEdge
): number {
  return edge.sessionIds.length;
}

function buildRelationshipEdgeMergeIdentityKey(edge: RelationshipEdge): string {
  return `${edge.relationship}|${edge.entityA}|${edge.entityB}`;
}

function sortMergedRelationshipEdges(
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

/**
 * Merges two edges that share the same relationship + entity pair. Unions
 * session ids, expands first/last seen, and sets weight to the merged
 * co-occurrence count (session count).
 */
export function mergeRelationshipEdgePair(
  left: RelationshipEdge,
  right: RelationshipEdge
): RelationshipEdge {
  const leftNormalized = normalizeRelationshipEdge(left);
  const rightNormalized = normalizeRelationshipEdge(right);
  if (!leftNormalized || !rightNormalized) {
    throw new Error("Merged relationship edge requires two valid edges.");
  }
  if (
    leftNormalized.relationship !== rightNormalized.relationship ||
    leftNormalized.entityA !== rightNormalized.entityA ||
    leftNormalized.entityB !== rightNormalized.entityB
  ) {
    throw new Error(
      "Merged relationship edge requires matching relationship and entity pair."
    );
  }

  const sessionIds = normalizeRelationshipEdgeSessionIds([
    ...leftNormalized.sessionIds,
    ...rightNormalized.sessionIds,
  ]);
  if (!sessionIds) {
    throw new Error("Merged relationship edge requires a non-empty sessionIds list.");
  }

  const firstSeen = Math.min(leftNormalized.firstSeen, rightNormalized.firstSeen);
  const lastSeen = Math.max(leftNormalized.lastSeen, rightNormalized.lastSeen);
  const weight =
    normalizeRelationshipEdgeWeight(sessionIds.length) ??
    MAX_RELATIONSHIP_EDGE_WEIGHT;

  return createRelationshipEdge({
    entityA: leftNormalized.entityA,
    entityB: leftNormalized.entityB,
    relationship: leftNormalized.relationship,
    sessionIds,
    firstSeen,
    lastSeen,
    weight,
    edgeId:
      buildRelationshipEdgeId({
        entityA: leftNormalized.entityA,
        entityB: leftNormalized.entityB,
        relationship: leftNormalized.relationship,
      }) ?? leftNormalized.edgeId,
  });
}

/**
 * Rolls up edges that share the same entity pair + relationship across
 * investigation sessions, then keeps only edges whose distinct session count
 * meets `minCoOccurrenceCount` (default 2).
 */
export function mergeRelationshipEdgesAcrossSessions(
  edges: readonly RelationshipEdge[],
  options?: MergeRelationshipEdgesAcrossSessionsOptions
): RelationshipEdge[] {
  const minCoOccurrenceCount = normalizeRelationshipEdgeMinCoOccurrenceCount(
    options?.minCoOccurrenceCount
  );
  const groups = new Map<string, RelationshipEdge>();

  for (const raw of edges) {
    const edge = normalizeRelationshipEdge(raw);
    if (!edge) {
      continue;
    }
    const key = buildRelationshipEdgeMergeIdentityKey(edge);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, edge);
      continue;
    }
    groups.set(key, mergeRelationshipEdgePair(existing, edge));
  }

  const merged = [...groups.values()].filter(
    (edge) => relationshipEdgeCoOccurrenceCount(edge) >= minCoOccurrenceCount
  );
  return sortMergedRelationshipEdges(merged);
}

export function isRelationshipEdgeKnownGoodPolicy(
  value: unknown
): value is RelationshipEdgeKnownGoodPolicy {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_EDGE_KNOWN_GOOD_POLICIES as readonly string[]).includes(value)
  );
}

/**
 * Normalizes known-good edge policy. Invalid values fall back to `off`.
 */
export function normalizeRelationshipEdgeKnownGoodPolicy(
  value: unknown
): RelationshipEdgeKnownGoodPolicy {
  return isRelationshipEdgeKnownGoodPolicy(value)
    ? value
    : DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY;
}

/**
 * True when the entity key's IOC value matches a known-good list entry.
 */
export function relationshipEntityKeyMatchesKnownGood(
  entityKey: string,
  knownGoodEntries: readonly KnownGoodEntry[],
  options: {
    categoryEnabled?: KnownGoodCategoryEnabledRecord;
  } = {}
): boolean {
  const parsed = parseRelationshipEntityKey(entityKey);
  if (!parsed || !isRelationshipEdgeEligibleIocType(parsed.iocType)) {
    return false;
  }
  return (
    findMatchingKnownGoodEntry(knownGoodEntries, parsed.value, {
      categoryEnabled:
        options.categoryEnabled ?? createDefaultKnownGoodCategoryEnabled(),
    }) !== null
  );
}

/**
 * True when either edge endpoint matches a known-good list entry.
 */
export function relationshipEdgeInvolvesKnownGoodEntity(
  edge: RelationshipEdge,
  knownGoodEntries: readonly KnownGoodEntry[],
  options: {
    categoryEnabled?: KnownGoodCategoryEnabledRecord;
  } = {}
): boolean {
  return (
    relationshipEntityKeyMatchesKnownGood(edge.entityA, knownGoodEntries, options) ||
    relationshipEntityKeyMatchesKnownGood(edge.entityB, knownGoodEntries, options)
  );
}

/**
 * Applies known-good edge policy when enabled:
 * - `off` — unchanged order (after co-occurrence sort helpers if already applied)
 * - `exclude` — drop edges involving a known-good endpoint
 * - `down_rank` — keep all edges; known-good-involving edges sort after others
 *
 * Does not change composite scoring and is not a silent safe verdict.
 */
export function applyRelationshipEdgeKnownGoodPolicy(
  edges: readonly RelationshipEdge[],
  input: ApplyRelationshipEdgeKnownGoodPolicyInput = {}
): RelationshipEdge[] {
  const policy = normalizeRelationshipEdgeKnownGoodPolicy(input.policy);
  const knownGoodEntries = input.knownGoodEntries ?? [];
  const categoryEnabled =
    input.categoryEnabled ?? createDefaultKnownGoodCategoryEnabled();
  const matchOptions = { categoryEnabled };

  if (policy === RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF) {
    return [...edges];
  }

  if (knownGoodEntries.length === 0) {
    return [...edges];
  }

  if (policy === RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE) {
    return edges.filter(
      (edge) =>
        !relationshipEdgeInvolvesKnownGoodEntity(
          edge,
          knownGoodEntries,
          matchOptions
        )
    );
  }

  const primary: RelationshipEdge[] = [];
  const downRanked: RelationshipEdge[] = [];
  for (const edge of edges) {
    if (
      relationshipEdgeInvolvesKnownGoodEntity(
        edge,
        knownGoodEntries,
        matchOptions
      )
    ) {
      downRanked.push(edge);
    } else {
      primary.push(edge);
    }
  }
  return [...primary, ...downRanked];
}

/**
 * Returns member keys whose IOC type is IP, domain, or hash.
 */
export function filterRelationshipEligibleEntityKeys(
  memberIocKeys: readonly string[]
): RelationshipEntityKey[] {
  const unique = new Set<string>();
  for (const key of memberIocKeys) {
    const parsed = parseRelationshipEntityKey(key);
    if (!parsed || !isRelationshipEdgeEligibleIocType(parsed.iocType)) {
      continue;
    }
    unique.add(buildIocCoOccurrenceMemberKey(parsed.iocType, parsed.value));
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
}

function refangUrlCandidateForRelationshipHost(value: string): string {
  return value
    .trim()
    .replace(/^hxxps?:\/\//i, (match) =>
      match.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
    )
    .replace(/\[\.\]/g, ".")
    .replace(/\[:\/\/\]/g, "://")
    .replace(/http\[:\]\/\//gi, "http://")
    .replace(/https\[:\]\/\//gi, "https://");
}

/**
 * Extracts a domain or IPv4 entity key from a URL IOC value (structural pivot).
 */
export function extractRelationshipHostEntityKeyFromUrlValue(
  urlValue: string
): RelationshipEntityKey | null {
  const trimmed = urlValue.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const refanged = refangUrlCandidateForRelationshipHost(trimmed);
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(refanged)
      ? refanged
      : `https://${refanged}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    if (!host) {
      return null;
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      return buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, host);
    }
    return buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, host);
  } catch {
    return null;
  }
}

function tryCreateRelationshipEdge(
  input: CreateRelationshipEdgeInput
): RelationshipEdge | null {
  try {
    return createRelationshipEdge(input);
  } catch {
    return null;
  }
}

function dedupeRelationshipEdgesById(
  edges: readonly RelationshipEdge[]
): RelationshipEdge[] {
  const byId = new Map<string, RelationshipEdge>();
  for (const edge of edges) {
    if (!byId.has(edge.edgeId)) {
      byId.set(edge.edgeId, edge);
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.edgeId.localeCompare(right.edgeId)
  );
}

/**
 * Builds undirected `co_seen` edges among IP / domain / hash entities that were
 * co-detected on one investigation session scan.
 */
export function buildCoSeenRelationshipEdgesFromSessionScan(
  input: RelationshipSessionScanInput,
  options?: BuildRelationshipEdgesFromSessionScanOptions
): RelationshipEdge[] {
  const sessionId = readNonEmptyTrimmedString(input.sessionId);
  if (!sessionId) {
    return [];
  }

  const eligible = filterRelationshipEligibleEntityKeys(input.memberIocKeys);
  if (eligible.length < 2) {
    return [];
  }

  const firstSeen =
    typeof input.firstSeen === "number" && Number.isFinite(input.firstSeen)
      ? input.firstSeen
      : Date.now();
  const lastSeen =
    typeof input.lastSeen === "number" && Number.isFinite(input.lastSeen)
      ? Math.max(input.lastSeen, firstSeen)
      : firstSeen;

  const maxPairs = normalizeRelationshipEdgeMaxCoSeenPairsPerSession(
    options?.maxCoSeenPairsPerSession
  );
  const edges: RelationshipEdge[] = [];

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      if (edges.length >= maxPairs) {
        return dedupeRelationshipEdgesById(edges);
      }
      const edge = tryCreateRelationshipEdge({
        entityA: eligible[i]!,
        entityB: eligible[j]!,
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: [sessionId],
        firstSeen,
        lastSeen,
        weight: DEFAULT_RELATIONSHIP_EDGE_WEIGHT,
      });
      if (edge) {
        edges.push(edge);
      }
    }
  }

  return dedupeRelationshipEdgesById(edges);
}

/**
 * Builds directed `resolved_from` edges from URL host pivots on a session scan:
 * each IP / domain / hash endpoint is linked as resolved_from the URL host entity
 * when that host is itself an IP or domain key.
 */
export function buildResolvedFromRelationshipEdgesFromSessionScanUrls(
  input: RelationshipSessionScanInput
): RelationshipEdge[] {
  const sessionId = readNonEmptyTrimmedString(input.sessionId);
  if (!sessionId) {
    return [];
  }

  const eligible = filterRelationshipEligibleEntityKeys(input.memberIocKeys);
  if (eligible.length === 0) {
    return [];
  }

  const firstSeen =
    typeof input.firstSeen === "number" && Number.isFinite(input.firstSeen)
      ? input.firstSeen
      : Date.now();
  const lastSeen =
    typeof input.lastSeen === "number" && Number.isFinite(input.lastSeen)
      ? Math.max(input.lastSeen, firstSeen)
      : firstSeen;

  const hostKeys = new Set<string>();
  for (const key of input.memberIocKeys) {
    const parsed = parseRelationshipEntityKey(key);
    if (!parsed || parsed.iocType !== IOC_TYPE.URL) {
      continue;
    }
    const hostKey = extractRelationshipHostEntityKeyFromUrlValue(parsed.value);
    if (hostKey) {
      hostKeys.add(hostKey);
    }
  }

  if (hostKeys.size === 0) {
    return [];
  }

  const edges: RelationshipEdge[] = [];
  for (const hostKey of hostKeys) {
    for (const entityKey of eligible) {
      if (entityKey === hostKey) {
        continue;
      }
      const edge = tryCreateRelationshipEdge({
        entityA: entityKey,
        entityB: hostKey,
        relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
        sessionIds: [sessionId],
        firstSeen,
        lastSeen,
        weight: DEFAULT_RELATIONSHIP_EDGE_WEIGHT,
      });
      if (edge) {
        edges.push(edge);
      }
    }
  }

  return dedupeRelationshipEdgesById(edges);
}

/**
 * Builds `resolved_from` edges from enrichment pivot hints (subject linked to
 * related IP / domain / hash keys). Subject is entityA (resolved from related).
 */
export function buildResolvedFromRelationshipEdgesFromEnrichPivots(
  hints: readonly RelationshipEnrichPivotHint[]
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];

  for (const hint of hints) {
    const sessionId = readNonEmptyTrimmedString(hint.sessionId);
    if (!sessionId) {
      continue;
    }
    const subjectParsed = parseRelationshipEntityKey(hint.subjectEntityKey);
    if (
      !subjectParsed ||
      !isRelationshipEdgeEligibleIocType(subjectParsed.iocType)
    ) {
      continue;
    }
    const subjectKey = buildIocCoOccurrenceMemberKey(
      subjectParsed.iocType,
      subjectParsed.value
    );
    const seenAt =
      typeof hint.seenAt === "number" && Number.isFinite(hint.seenAt)
        ? hint.seenAt
        : Date.now();

    for (const relatedRaw of hint.relatedEntityKeys) {
      const relatedParsed = parseRelationshipEntityKey(relatedRaw);
      if (
        !relatedParsed ||
        !isRelationshipEdgeEligibleIocType(relatedParsed.iocType)
      ) {
        continue;
      }
      const relatedKey = buildIocCoOccurrenceMemberKey(
        relatedParsed.iocType,
        relatedParsed.value
      );
      if (relatedKey === subjectKey) {
        continue;
      }
      const edge = tryCreateRelationshipEdge({
        entityA: subjectKey,
        entityB: relatedKey,
        relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
        sessionIds: [sessionId],
        firstSeen: seenAt,
        lastSeen: seenAt,
        weight: DEFAULT_RELATIONSHIP_EDGE_WEIGHT,
      });
      if (edge) {
        edges.push(edge);
      }
    }
  }

  return dedupeRelationshipEdgesById(edges);
}

/**
 * Builds relationship edges from one session scan: `co_seen` for co-detected
 * IP / domain / hash pairs, plus `resolved_from` URL-host pivots.
 */
export function buildRelationshipEdgesFromSessionScan(
  input: RelationshipSessionScanInput,
  options?: BuildRelationshipEdgesFromSessionScanOptions
): RelationshipEdge[] {
  return dedupeRelationshipEdgesById([
    ...buildCoSeenRelationshipEdgesFromSessionScan(input, options),
    ...buildResolvedFromRelationshipEdgesFromSessionScanUrls(input),
  ]);
}

/**
 * Combines session-scan edges with enrichment pivot `resolved_from` edges.
 */
export function buildRelationshipEdgesFromSessionScanAndEnrichEvents(input: {
  scan: RelationshipSessionScanInput;
  enrichPivots?: readonly RelationshipEnrichPivotHint[];
  options?: BuildRelationshipEdgesFromSessionScanOptions;
}): RelationshipEdge[] {
  return dedupeRelationshipEdgesById([
    ...buildRelationshipEdgesFromSessionScan(input.scan, input.options),
    ...buildResolvedFromRelationshipEdgesFromEnrichPivots(
      input.enrichPivots ?? []
    ),
  ]);
}
