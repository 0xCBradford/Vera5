import {
  buildIocCoOccurrenceMemberKey,
  dedupeTabScanSnapshotEntriesForCoOccurrence,
  type IocCoOccurrenceMemberKey,
  type PageIocCoOccurrenceIndex,
} from "./iocCoOccurrence";
import type { SessionIocCoOccurrenceRecord } from "./iocCoOccurrenceStorage";
import { getIocCoOccurrenceStore } from "./iocCoOccurrenceStorage";
import {
  isIocLabelExcludedFromCorrelationClusterPromotion,
  type IocLabelId,
} from "./iocLabel";
import {
  getIocLabelsRecord,
  normalizeIocLabelKey,
  type IocLabelsRecord,
} from "./iocLabelStorage";
import {
  listInvestigationSessionIocMembers,
  type InvestigationSession,
} from "./investigationSession";
import {
  getInvestigationSessionsStore,
  type InvestigationSessionsStore,
} from "./investigationSessionStorage";
import { IOC_TYPE, type IocType } from "./iocRegex";
import type { TabScanSnapshot, TabScanSnapshotPayload } from "./tabScanSnapshot";

/**
 * Local cross-session correlation cluster: IOC sets that appeared together
 * across investigation sessions. List/adjacency data only — not a graph engine
 * and not a detection verdict.
 */
export const CORRELATION_CLUSTER_SCHEMA_VERSION = 1;

export const CORRELATION_CLUSTER_ID_PREFIX = "cc-";

/** Minimum distinct IOC members required to treat a scan set as clusterable. */
export const DEFAULT_CORRELATION_CLUSTER_MIN_MEMBER_COUNT = 2;

/** Minimum distinct sessions sharing an exact IOC set for a cross-session cluster. */
export const DEFAULT_CORRELATION_CLUSTER_MIN_SESSION_COUNT = 2;

/** Default overlap rule: Jaccard index on member IOC key sets. */
export const DEFAULT_CORRELATION_CLUSTER_OVERLAP_MODE = "jaccard" as const;

/** Default Jaccard threshold (inclusive) for merging clusters. */
export const DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD = 0.5;

/** Default minimum shared member IOC count when using fixed min-shared overlap. */
export const DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT = 2;

/** Default maximum retained correlation clusters after ranking (performance cap). */
export const DEFAULT_CORRELATION_CLUSTER_MAX_CLUSTERS = 64;

/** Default maximum IOC members allowed in a single correlation cluster. */
export const DEFAULT_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER = 64;

export const MIN_CORRELATION_CLUSTER_JACCARD_THRESHOLD = 0;
export const MAX_CORRELATION_CLUSTER_JACCARD_THRESHOLD = 1;
export const MIN_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT = 1;
export const MAX_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT = 512;
export const MIN_CORRELATION_CLUSTER_MAX_CLUSTERS = 1;
export const MAX_CORRELATION_CLUSTER_MAX_CLUSTERS = 256;
export const MIN_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER = 2;
export const MAX_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER = 512;

/** Default retention window: prune clusters whose lastSeenAt is older than this many days. */
export const DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS = 90;

export const MIN_CORRELATION_CLUSTER_RETENTION_DAYS = 1;
export const MAX_CORRELATION_CLUSTER_RETENTION_DAYS = 3650;

export const CORRELATION_CLUSTER_MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CorrelationClusterId = string;

export type CorrelationClusterMemberIocKey = IocCoOccurrenceMemberKey;

export type CorrelationCluster = {
  schemaVersion: typeof CORRELATION_CLUSTER_SCHEMA_VERSION;
  clusterId: CorrelationClusterId;
  memberIocKeys: CorrelationClusterMemberIocKey[];
  sessionIds: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  coOccurrenceCount: number;
};

export type CreateCorrelationClusterInput = {
  memberIocKeys: readonly string[];
  sessionIds: readonly string[];
  firstSeenAt?: number;
  lastSeenAt?: number;
  coOccurrenceCount?: number;
  clusterId?: string;
};

/**
 * Per-session IOC set derived from scan snapshot memory (or session rollup fallback).
 */
export type SessionScanIocSet = {
  sessionId: string;
  memberIocKeys: CorrelationClusterMemberIocKey[];
  firstSeenAt: number;
  lastSeenAt: number;
};

export type CorrelationClusterOverlapMode = "jaccard" | "minShared";

/**
 * Configured local overlap rule for merging clusters whose member IOC sets
 * share enough indicators. Not ML and not a detection verdict.
 */
export type CorrelationClusterOverlapMergeConfig = {
  mode: CorrelationClusterOverlapMode;
  /** Inclusive Jaccard index threshold in [0, 1] when mode is `jaccard`. */
  jaccardThreshold?: number;
  /** Inclusive minimum shared member count when mode is `minShared`. */
  minSharedIocCount?: number;
};

export type CorrelationClusterMemberOverlap = {
  sharedCount: number;
  unionCount: number;
  jaccard: number;
};

/**
 * Performance caps for local cross-session cluster promotion and tray/export
 * surfaces. Oversized sets are skipped; ranked clusters are truncated.
 */
export type CorrelationClusterPerformanceLimits = {
  maxClusters: number;
  maxMembersPerCluster: number;
};

export type BuildCorrelationClustersFromSessionScanIocSetsOptions = {
  minMemberCount?: number;
  minSessionCount?: number;
  /**
   * When set, provisional clusters (including single-session) are merged when
   * member-set overlap meets the configured Jaccard or min-shared threshold,
   * then filtered by `minSessionCount`.
   */
  overlapMerge?: CorrelationClusterOverlapMergeConfig | null;
  /**
   * Local watchlist labels. When provided (and exclusion is enabled), members
   * labeled internal or suppress-false-positive are omitted from promotion.
   */
  iocLabels?: IocLabelsRecord | null;
  /**
   * Defaults to true. When false, `iocLabels` are ignored for promotion filtering.
   */
  excludeLabeledMembersFromPromotion?: boolean;
  /** Caps cluster count and max IOCs per cluster (defaults apply when omitted). */
  performanceLimits?: Partial<CorrelationClusterPerformanceLimits> | null;
};

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }
  if (value < 1) {
    return fallback;
  }
  return value;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function createDefaultCorrelationClusterOverlapMergeConfig(): CorrelationClusterOverlapMergeConfig {
  return {
    mode: DEFAULT_CORRELATION_CLUSTER_OVERLAP_MODE,
    jaccardThreshold: DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
    minSharedIocCount: DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
  };
}

export function createDefaultCorrelationClusterPerformanceLimits(): CorrelationClusterPerformanceLimits {
  return {
    maxClusters: DEFAULT_CORRELATION_CLUSTER_MAX_CLUSTERS,
    maxMembersPerCluster: DEFAULT_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
  };
}

export function normalizeCorrelationClusterPerformanceLimits(
  value?: Partial<CorrelationClusterPerformanceLimits> | null
): CorrelationClusterPerformanceLimits {
  const defaults = createDefaultCorrelationClusterPerformanceLimits();
  if (!value) {
    return defaults;
  }
  const clampLimit = (raw: unknown, fallback: number, min: number, max: number): number => {
    if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, raw));
  };
  return {
    maxClusters: clampLimit(
      value.maxClusters,
      defaults.maxClusters,
      MIN_CORRELATION_CLUSTER_MAX_CLUSTERS,
      MAX_CORRELATION_CLUSTER_MAX_CLUSTERS
    ),
    maxMembersPerCluster: clampLimit(
      value.maxMembersPerCluster,
      defaults.maxMembersPerCluster,
      MIN_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
      MAX_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER
    ),
  };
}

/**
 * Drops clusters over the member cap, then keeps the top-ranked clusters up to
 * `maxClusters` (by co-occurrence count, then last seen).
 */
export function applyCorrelationClusterPerformanceLimits(
  clusters: readonly CorrelationCluster[],
  limits?: Partial<CorrelationClusterPerformanceLimits> | null
): CorrelationCluster[] {
  const normalized = normalizeCorrelationClusterPerformanceLimits(limits);
  const withinMemberCap = clusters.filter(
    (cluster) => cluster.memberIocKeys.length <= normalized.maxMembersPerCluster
  );
  return sortCorrelationClusters(withinMemberCap).slice(0, normalized.maxClusters);
}

export function normalizeCorrelationClusterRetentionDays(
  value?: unknown
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS;
  }
  return Math.min(
    MAX_CORRELATION_CLUSTER_RETENTION_DAYS,
    Math.max(MIN_CORRELATION_CLUSTER_RETENTION_DAYS, value)
  );
}

export function resolveCorrelationClusterRetentionCutoffMs(
  retentionDays: number = DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
  nowMs: number = Date.now()
): number {
  const days = normalizeCorrelationClusterRetentionDays(retentionDays);
  return nowMs - days * CORRELATION_CLUSTER_MS_PER_DAY;
}

/**
 * Keeps clusters whose lastSeenAt is within the retention window (inclusive of
 * the cutoff). Older clusters are pruned. Retention days are configurable;
 * default is DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS.
 */
export function pruneCorrelationClustersOlderThan(
  clusters: readonly CorrelationCluster[],
  options?: {
    retentionDays?: number | null;
    nowMs?: number;
  }
): CorrelationCluster[] {
  const retentionDays = normalizeCorrelationClusterRetentionDays(options?.retentionDays);
  const nowMs =
    typeof options?.nowMs === "number" && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();
  const cutoffMs = resolveCorrelationClusterRetentionCutoffMs(retentionDays, nowMs);
  return clusters.filter((cluster) => cluster.lastSeenAt >= cutoffMs);
}

export function normalizeCorrelationClusterOverlapMergeConfig(
  value?: Partial<CorrelationClusterOverlapMergeConfig> | null
): CorrelationClusterOverlapMergeConfig {
  const defaults = createDefaultCorrelationClusterOverlapMergeConfig();
  if (!value) {
    return defaults;
  }
  const mode: CorrelationClusterOverlapMode =
    value.mode === "minShared" || value.mode === "jaccard" ? value.mode : defaults.mode;
  return {
    mode,
    jaccardThreshold: clampNumber(
      value.jaccardThreshold,
      defaults.jaccardThreshold ?? DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
      MIN_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
      MAX_CORRELATION_CLUSTER_JACCARD_THRESHOLD
    ),
    minSharedIocCount: Math.min(
      MAX_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
      clampPositiveInteger(
        value.minSharedIocCount,
        defaults.minSharedIocCount ?? DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT
      )
    ),
  };
}

export function computeCorrelationClusterMemberOverlap(
  memberIocKeysA: readonly string[],
  memberIocKeysB: readonly string[]
): CorrelationClusterMemberOverlap | null {
  const left = normalizeCorrelationClusterIdList(memberIocKeysA);
  const right = normalizeCorrelationClusterIdList(memberIocKeysB);
  if (!left || !right) {
    return null;
  }

  const rightSet = new Set(right);
  let sharedCount = 0;
  for (const key of left) {
    if (rightSet.has(key)) {
      sharedCount += 1;
    }
  }
  const unionCount = left.length + right.length - sharedCount;
  const jaccard = unionCount === 0 ? 0 : sharedCount / unionCount;
  return { sharedCount, unionCount, jaccard };
}

export function shouldMergeCorrelationClustersByOverlap(
  left: Pick<CorrelationCluster, "memberIocKeys">,
  right: Pick<CorrelationCluster, "memberIocKeys">,
  config?: Partial<CorrelationClusterOverlapMergeConfig> | null
): boolean {
  const normalized = normalizeCorrelationClusterOverlapMergeConfig(config);
  const overlap = computeCorrelationClusterMemberOverlap(
    left.memberIocKeys,
    right.memberIocKeys
  );
  if (!overlap) {
    return false;
  }
  if (normalized.mode === "minShared") {
    return (
      overlap.sharedCount >=
      (normalized.minSharedIocCount ?? DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT)
    );
  }
  return (
    overlap.jaccard >=
    (normalized.jaccardThreshold ?? DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD)
  );
}

/**
 * Unions member keys and session ids from two clusters into one durable cluster.
 */
export function mergeCorrelationClusterPair(
  left: CorrelationCluster,
  right: CorrelationCluster
): CorrelationCluster {
  const memberIocKeys = normalizeCorrelationClusterIdList([
    ...left.memberIocKeys,
    ...right.memberIocKeys,
  ]);
  const sessionIds = normalizeCorrelationClusterIdList([
    ...left.sessionIds,
    ...right.sessionIds,
  ]);
  if (!memberIocKeys || !sessionIds) {
    throw new Error("Merged correlation cluster requires member IOC keys and session ids.");
  }
  const firstSeenAt = Math.min(left.firstSeenAt, right.firstSeenAt);
  const lastSeenAt = Math.max(left.lastSeenAt, right.lastSeenAt);
  return createCorrelationCluster({
    memberIocKeys,
    sessionIds,
    firstSeenAt,
    lastSeenAt,
    coOccurrenceCount: sessionIds.length,
    clusterId: buildCorrelationClusterIdFromMemberIocKeys(memberIocKeys),
  });
}

function sortCorrelationClusters(clusters: readonly CorrelationCluster[]): CorrelationCluster[] {
  return [...clusters].sort((left, right) => {
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

function findCorrelationClusterMergeRoot(parent: number[], index: number): number {
  let current = index;
  while (parent[current] !== current) {
    const next = parent[current]!;
    parent[current] = parent[next]!;
    current = next;
  }
  return current;
}

/**
 * Merges clusters whose member IOC sets exceed the configured overlap threshold
 * (Jaccard index or fixed minimum shared IOC count). Transitive merges use union-find.
 */
export function mergeCorrelationClustersByOverlapThreshold(
  clusters: readonly CorrelationCluster[],
  config?: Partial<CorrelationClusterOverlapMergeConfig> | null
): CorrelationCluster[] {
  const normalizedConfig = normalizeCorrelationClusterOverlapMergeConfig(config);
  const normalizedClusters: CorrelationCluster[] = [];
  for (const cluster of clusters) {
    const normalized = normalizeCorrelationCluster(cluster);
    if (normalized) {
      normalizedClusters.push(normalized);
    }
  }
  if (normalizedClusters.length <= 1) {
    return sortCorrelationClusters(normalizedClusters);
  }

  const parent = normalizedClusters.map((_, index) => index);
  for (let left = 0; left < normalizedClusters.length; left += 1) {
    for (let right = left + 1; right < normalizedClusters.length; right += 1) {
      if (
        shouldMergeCorrelationClustersByOverlap(
          normalizedClusters[left]!,
          normalizedClusters[right]!,
          normalizedConfig
        )
      ) {
        const rootLeft = findCorrelationClusterMergeRoot(parent, left);
        const rootRight = findCorrelationClusterMergeRoot(parent, right);
        if (rootLeft !== rootRight) {
          parent[rootRight] = rootLeft;
        }
      }
    }
  }

  const groups = new Map<number, CorrelationCluster>();
  for (let index = 0; index < normalizedClusters.length; index += 1) {
    const root = findCorrelationClusterMergeRoot(parent, index);
    const cluster = normalizedClusters[index]!;
    const existing = groups.get(root);
    groups.set(root, existing ? mergeCorrelationClusterPair(existing, cluster) : cluster);
  }

  return sortCorrelationClusters([...groups.values()]);
}

/**
 * Dedupes, trims, and stably sorts string ids (member IOC keys or session ids).
 */
export function normalizeCorrelationClusterIdList(
  values: readonly unknown[]
): string[] | null {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = readNonEmptyTrimmedString(value);
    if (!trimmed) {
      return null;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  if (normalized.length === 0) {
    return null;
  }
  return normalized.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildCorrelationClusterMemberSetFingerprint(
  memberIocKeys: readonly string[]
): string | null {
  const normalized = normalizeCorrelationClusterIdList(memberIocKeys);
  if (!normalized) {
    return null;
  }
  return normalized.join("|");
}

export function buildCorrelationClusterIdFromMemberIocKeys(
  memberIocKeys: readonly string[]
): CorrelationClusterId {
  const normalized = normalizeCorrelationClusterIdList(memberIocKeys);
  if (!normalized) {
    throw new Error("Correlation cluster id requires member IOC keys.");
  }
  const fingerprint = normalized.join("|");
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${CORRELATION_CLUSTER_ID_PREFIX}${hash.toString(16)}-${normalized.length}m`;
}

export function buildCorrelationClusterId(input: {
  memberIocKeys: readonly string[];
  sessionIds: readonly string[];
}): CorrelationClusterId {
  const memberIocKeys = normalizeCorrelationClusterIdList(input.memberIocKeys);
  const sessionIds = normalizeCorrelationClusterIdList(input.sessionIds);
  if (!memberIocKeys || !sessionIds) {
    throw new Error("Correlation cluster id requires member IOC keys and session ids.");
  }
  const fingerprint = `${memberIocKeys.join("|")}#${sessionIds.join("|")}`;
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${CORRELATION_CLUSTER_ID_PREFIX}${hash.toString(16)}-${memberIocKeys.length}m-${sessionIds.length}s`;
}

export function createCorrelationCluster(
  input: CreateCorrelationClusterInput
): CorrelationCluster {
  const memberIocKeys = normalizeCorrelationClusterIdList(input.memberIocKeys);
  const sessionIds = normalizeCorrelationClusterIdList(input.sessionIds);
  if (!memberIocKeys || !sessionIds) {
    throw new Error(
      "Correlation cluster requires non-empty member IOC keys and session ids."
    );
  }

  const now = Date.now();
  const firstSeenAt = input.firstSeenAt ?? now;
  const lastSeenAt = input.lastSeenAt ?? firstSeenAt;
  if (
    typeof firstSeenAt !== "number" ||
    !Number.isFinite(firstSeenAt) ||
    typeof lastSeenAt !== "number" ||
    !Number.isFinite(lastSeenAt)
  ) {
    throw new Error("Correlation cluster first/last seen must be finite timestamps.");
  }
  if (lastSeenAt < firstSeenAt) {
    throw new Error("Correlation cluster lastSeenAt must be >= firstSeenAt.");
  }

  const coOccurrenceCount =
    input.coOccurrenceCount !== undefined
      ? input.coOccurrenceCount
      : sessionIds.length;
  if (
    typeof coOccurrenceCount !== "number" ||
    !Number.isFinite(coOccurrenceCount) ||
    !Number.isInteger(coOccurrenceCount) ||
    coOccurrenceCount < 0
  ) {
    throw new Error("Correlation cluster coOccurrenceCount must be a non-negative integer.");
  }

  const clusterId =
    readNonEmptyTrimmedString(input.clusterId) ??
    buildCorrelationClusterIdFromMemberIocKeys(memberIocKeys);

  return {
    schemaVersion: CORRELATION_CLUSTER_SCHEMA_VERSION,
    clusterId,
    memberIocKeys,
    sessionIds,
    firstSeenAt,
    lastSeenAt,
    coOccurrenceCount,
  };
}

export function normalizeCorrelationCluster(
  value: unknown
): CorrelationCluster | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== CORRELATION_CLUSTER_SCHEMA_VERSION) {
    return null;
  }

  const clusterId = readNonEmptyTrimmedString(record.clusterId);
  if (!clusterId || !Array.isArray(record.memberIocKeys) || !Array.isArray(record.sessionIds)) {
    return null;
  }

  const memberIocKeys = normalizeCorrelationClusterIdList(record.memberIocKeys);
  const sessionIds = normalizeCorrelationClusterIdList(record.sessionIds);
  if (!memberIocKeys || !sessionIds) {
    return null;
  }

  const firstSeenAt = readFiniteTimestamp(record.firstSeenAt);
  const lastSeenAt = readFiniteTimestamp(record.lastSeenAt);
  const coOccurrenceCount = readNonNegativeInteger(record.coOccurrenceCount);
  if (firstSeenAt === null || lastSeenAt === null || coOccurrenceCount === null) {
    return null;
  }
  if (lastSeenAt < firstSeenAt) {
    return null;
  }

  return {
    schemaVersion: CORRELATION_CLUSTER_SCHEMA_VERSION,
    clusterId,
    memberIocKeys,
    sessionIds,
    firstSeenAt,
    lastSeenAt,
    coOccurrenceCount,
  };
}

export function isCorrelationCluster(value: unknown): value is CorrelationCluster {
  return normalizeCorrelationCluster(value) !== null;
}

function buildSessionScanIocSet(input: {
  sessionId: string;
  memberIocKeys: readonly string[];
  firstSeenAt: number;
  lastSeenAt: number;
}): SessionScanIocSet | null {
  const sessionId = readNonEmptyTrimmedString(input.sessionId);
  const memberIocKeys = normalizeCorrelationClusterIdList(input.memberIocKeys);
  if (!sessionId || !memberIocKeys) {
    return null;
  }
  if (
    !Number.isFinite(input.firstSeenAt) ||
    !Number.isFinite(input.lastSeenAt) ||
    input.lastSeenAt < input.firstSeenAt
  ) {
    return null;
  }
  return {
    sessionId,
    memberIocKeys,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
  };
}

const IOC_TYPES_FOR_MEMBER_KEY = new Set<string>(Object.values(IOC_TYPE));

/**
 * Extracts the indicator value from a co-occurrence-style member key (`type:value`)
 * for watchlist label lookup.
 */
export function resolveIocLabelLookupValueFromMemberIocKey(
  memberIocKey: string
): string | null {
  const trimmed = memberIocKey.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const separator = trimmed.indexOf(":");
  if (separator <= 0) {
    const fallback = normalizeIocLabelKey(trimmed);
    return fallback.length > 0 ? fallback : null;
  }
  const typePart = trimmed.slice(0, separator);
  const valuePart = trimmed.slice(separator + 1).trim();
  if (!IOC_TYPES_FOR_MEMBER_KEY.has(typePart) || valuePart.length === 0) {
    const fallback = normalizeIocLabelKey(trimmed);
    return fallback.length > 0 ? fallback : null;
  }
  return normalizeIocLabelKey(valuePart);
}

export function resolveIocLabelForCorrelationClusterMemberKey(
  memberIocKey: string,
  iocLabels: IocLabelsRecord | null | undefined
): IocLabelId | null {
  if (!iocLabels) {
    return null;
  }
  const direct = iocLabels[memberIocKey.trim()];
  if (direct) {
    return direct;
  }
  const lookupValue = resolveIocLabelLookupValueFromMemberIocKey(memberIocKey);
  if (!lookupValue) {
    return null;
  }
  return iocLabels[lookupValue] ?? null;
}

export function shouldExcludeMemberIocKeyFromCorrelationClusterPromotion(
  memberIocKey: string,
  iocLabels: IocLabelsRecord | null | undefined
): boolean {
  return isIocLabelExcludedFromCorrelationClusterPromotion(
    resolveIocLabelForCorrelationClusterMemberKey(memberIocKey, iocLabels)
  );
}

/**
 * Drops members labeled internal or suppress-false-positive before cluster promotion.
 */
export function filterMemberIocKeysForCorrelationClusterPromotion(
  memberIocKeys: readonly string[],
  iocLabels: IocLabelsRecord | null | undefined
): string[] {
  if (!iocLabels) {
    return [...memberIocKeys];
  }
  return memberIocKeys.filter(
    (memberIocKey) =>
      !shouldExcludeMemberIocKeyFromCorrelationClusterPromotion(memberIocKey, iocLabels)
  );
}

export function filterSessionScanIocSetForCorrelationClusterPromotion(
  set: SessionScanIocSet,
  iocLabels: IocLabelsRecord | null | undefined
): SessionScanIocSet | null {
  if (!iocLabels) {
    return buildSessionScanIocSet(set);
  }
  return buildSessionScanIocSet({
    ...set,
    memberIocKeys: filterMemberIocKeysForCorrelationClusterPromotion(
      set.memberIocKeys,
      iocLabels
    ),
  });
}

/**
 * Builds a per-session IOC set from a tab scan snapshot payload.
 */
export function buildSessionScanIocSetFromSnapshot(input: {
  sessionId: string;
  snapshot: TabScanSnapshot | TabScanSnapshotPayload;
}): SessionScanIocSet | null {
  const members = dedupeTabScanSnapshotEntriesForCoOccurrence(input.snapshot.entries);
  return buildSessionScanIocSet({
    sessionId: input.sessionId,
    memberIocKeys: members.map((member) => member.memberKey),
    firstSeenAt: input.snapshot.scannedAt,
    lastSeenAt: input.snapshot.scannedAt,
  });
}

function collectMemberKeysFromPageIndexes(
  pages: readonly PageIocCoOccurrenceIndex[]
): { memberIocKeys: string[]; firstSeenAt: number; lastSeenAt: number } | null {
  if (pages.length === 0) {
    return null;
  }
  const keys: string[] = [];
  let firstSeenAt = Number.POSITIVE_INFINITY;
  let lastSeenAt = Number.NEGATIVE_INFINITY;
  for (const page of pages) {
    for (const member of page.members) {
      keys.push(member.memberKey);
    }
    if (page.scannedAt < firstSeenAt) {
      firstSeenAt = page.scannedAt;
    }
    if (page.scannedAt > lastSeenAt) {
      lastSeenAt = page.scannedAt;
    }
  }
  if (!Number.isFinite(firstSeenAt) || !Number.isFinite(lastSeenAt)) {
    return null;
  }
  return { memberIocKeys: keys, firstSeenAt, lastSeenAt };
}

/**
 * Builds a per-session IOC set by unioning members from stored scan-derived page indexes.
 */
export function buildSessionScanIocSetFromCoOccurrenceRecord(
  record: SessionIocCoOccurrenceRecord
): SessionScanIocSet | null {
  const collected = collectMemberKeysFromPageIndexes(record.pages);
  if (!collected) {
    return null;
  }
  return buildSessionScanIocSet({
    sessionId: record.sessionId,
    memberIocKeys: collected.memberIocKeys,
    firstSeenAt: collected.firstSeenAt,
    lastSeenAt: collected.lastSeenAt,
  });
}

/**
 * Fallback IOC set from investigation session memory (timelines / pins) when
 * scan snapshot page indexes are unavailable for that session.
 */
export function buildSessionScanIocSetFromInvestigationSession(
  session: InvestigationSession
): SessionScanIocSet | null {
  const members = listInvestigationSessionIocMembers(session);
  const memberIocKeys = members.map((member) =>
    buildIocCoOccurrenceMemberKey(member.iocType, member.value)
  );
  return buildSessionScanIocSet({
    sessionId: session.id,
    memberIocKeys,
    firstSeenAt: session.createdAt,
    lastSeenAt: session.updatedAt,
  });
}

/**
 * Groups exact-matching session IOC sets into cross-session correlation clusters.
 * Optional `overlapMerge` merges provisional clusters when member-set overlap
 * exceeds a configured Jaccard or minimum shared IOC count threshold.
 */
export function buildCorrelationClustersFromSessionScanIocSets(
  sets: readonly SessionScanIocSet[],
  options?: BuildCorrelationClustersFromSessionScanIocSetsOptions
): CorrelationCluster[] {
  const minMemberCount = clampPositiveInteger(
    options?.minMemberCount,
    DEFAULT_CORRELATION_CLUSTER_MIN_MEMBER_COUNT
  );
  const minSessionCount = clampPositiveInteger(
    options?.minSessionCount,
    DEFAULT_CORRELATION_CLUSTER_MIN_SESSION_COUNT
  );
  const performanceLimits = normalizeCorrelationClusterPerformanceLimits(
    options?.performanceLimits
  );
  const overlapMerge =
    options?.overlapMerge === undefined || options.overlapMerge === null
      ? null
      : normalizeCorrelationClusterOverlapMergeConfig(options.overlapMerge);
  const emitMinSessionCount = overlapMerge ? 1 : minSessionCount;
  const excludeLabeledMembersFromPromotion =
    options?.excludeLabeledMembersFromPromotion !== false;
  const iocLabels =
    excludeLabeledMembersFromPromotion && options?.iocLabels
      ? options.iocLabels
      : null;

  type Bucket = {
    memberIocKeys: string[];
    sessionIds: string[];
    firstSeenAt: number;
    lastSeenAt: number;
  };

  const buckets = new Map<string, Bucket>();

  for (const set of sets) {
    const filtered = iocLabels
      ? filterSessionScanIocSetForCorrelationClusterPromotion(set, iocLabels)
      : buildSessionScanIocSet(set);
    const normalized = filtered;
    if (!normalized || normalized.memberIocKeys.length < minMemberCount) {
      continue;
    }
    if (normalized.memberIocKeys.length > performanceLimits.maxMembersPerCluster) {
      continue;
    }
    const fingerprint = buildCorrelationClusterMemberSetFingerprint(
      normalized.memberIocKeys
    );
    if (!fingerprint) {
      continue;
    }

    const existing = buckets.get(fingerprint);
    if (!existing) {
      buckets.set(fingerprint, {
        memberIocKeys: normalized.memberIocKeys,
        sessionIds: [normalized.sessionId],
        firstSeenAt: normalized.firstSeenAt,
        lastSeenAt: normalized.lastSeenAt,
      });
      continue;
    }

    if (!existing.sessionIds.includes(normalized.sessionId)) {
      existing.sessionIds.push(normalized.sessionId);
    }
    if (normalized.firstSeenAt < existing.firstSeenAt) {
      existing.firstSeenAt = normalized.firstSeenAt;
    }
    if (normalized.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = normalized.lastSeenAt;
    }
  }

  let clusters: CorrelationCluster[] = [];
  for (const bucket of buckets.values()) {
    const sessionIds = normalizeCorrelationClusterIdList(bucket.sessionIds);
    if (!sessionIds || sessionIds.length < emitMinSessionCount) {
      continue;
    }
    if (bucket.memberIocKeys.length > performanceLimits.maxMembersPerCluster) {
      continue;
    }
    clusters.push(
      createCorrelationCluster({
        memberIocKeys: bucket.memberIocKeys,
        sessionIds,
        firstSeenAt: bucket.firstSeenAt,
        lastSeenAt: bucket.lastSeenAt,
        coOccurrenceCount: sessionIds.length,
        clusterId: buildCorrelationClusterIdFromMemberIocKeys(bucket.memberIocKeys),
      })
    );
  }

  if (overlapMerge) {
    clusters = mergeCorrelationClustersByOverlapThreshold(clusters, overlapMerge).filter(
      (cluster) => cluster.sessionIds.length >= minSessionCount
    );
  }

  return applyCorrelationClusterPerformanceLimits(clusters, performanceLimits);
}

/**
 * Resolves one IOC set per investigation session: prefer scan-snapshot page
 * indexes from co-occurrence memory; fall back to session timeline/pin members.
 */
export function resolveSessionScanIocSetsFromInvestigationMemory(input: {
  sessions: readonly InvestigationSession[];
  coOccurrenceRecords?: readonly SessionIocCoOccurrenceRecord[];
}): SessionScanIocSet[] {
  const recordsBySessionId = new Map<string, SessionIocCoOccurrenceRecord>();
  for (const record of input.coOccurrenceRecords ?? []) {
    const existing = recordsBySessionId.get(record.sessionId);
    if (!existing || record.updatedAt >= existing.updatedAt) {
      recordsBySessionId.set(record.sessionId, record);
    }
  }

  const sets: SessionScanIocSet[] = [];
  const seenSessionIds = new Set<string>();

  for (const session of input.sessions) {
    const sessionId = session.id.trim();
    if (sessionId.length === 0 || seenSessionIds.has(sessionId)) {
      continue;
    }
    seenSessionIds.add(sessionId);

    const record = recordsBySessionId.get(sessionId);
    const fromScan = record
      ? buildSessionScanIocSetFromCoOccurrenceRecord(record)
      : null;
    const resolved = fromScan ?? buildSessionScanIocSetFromInvestigationSession(session);
    if (resolved) {
      sets.push(resolved);
    }
  }

  for (const record of recordsBySessionId.values()) {
    if (seenSessionIds.has(record.sessionId)) {
      continue;
    }
    const fromScan = buildSessionScanIocSetFromCoOccurrenceRecord(record);
    if (fromScan) {
      sets.push(fromScan);
    }
  }

  return sets;
}

export function buildCorrelationClustersFromInvestigationMemory(input: {
  sessions: readonly InvestigationSession[];
  coOccurrenceRecords?: readonly SessionIocCoOccurrenceRecord[];
  options?: BuildCorrelationClustersFromSessionScanIocSetsOptions;
}): CorrelationCluster[] {
  const sets = resolveSessionScanIocSetsFromInvestigationMemory({
    sessions: input.sessions,
    coOccurrenceRecords: input.coOccurrenceRecords,
  });
  return buildCorrelationClustersFromSessionScanIocSets(sets, input.options);
}

/**
 * Loads investigation sessions, scan-derived co-occurrence page indexes, and
 * watchlist labels from extension local storage, then builds cross-session
 * clusters (excluding suppressed/internal labeled members by default).
 */
export async function buildCorrelationClustersFromStoredInvestigationMemory(
  options?: BuildCorrelationClustersFromSessionScanIocSetsOptions
): Promise<CorrelationCluster[]> {
  const [sessionsStore, coOccurrenceStore, iocLabels]: [
    InvestigationSessionsStore,
    Awaited<ReturnType<typeof getIocCoOccurrenceStore>>,
    IocLabelsRecord,
  ] = await Promise.all([
    getInvestigationSessionsStore(),
    getIocCoOccurrenceStore(),
    getIocLabelsRecord(),
  ]);

  return buildCorrelationClustersFromInvestigationMemory({
    sessions: sessionsStore.sessions,
    coOccurrenceRecords: coOccurrenceStore.sessions,
    options: {
      ...options,
      iocLabels: options?.iocLabels ?? iocLabels,
    },
  });
}

/** Tray / popup label for cross-session correlation clusters (list view only). */
export const CORRELATION_CLUSTER_TRAY_LABEL = "Appeared across sessions";

export const CORRELATION_CLUSTER_TRAY_OTHER_SESSIONS_LABEL = "Other sessions";

/**
 * Shown when the active indicator has no other investigation sessions sharing
 * a clustered IOC set yet.
 */
export const CORRELATION_CLUSTER_TRAY_EMPTY_STATE_TEXT =
  "Not enough cross-session data yet. Open this indicator set in another investigation session to see clusters here.";

/** Operator notice: shared indicators do not imply cause. */
export const CORRELATION_CLUSTER_DISCLAIMER_CORRELATION_NE_CAUSATION =
  "Correlation ≠ causation.";

/**
 * Operator notice: same-page co-occurrence and cross-session clusters are
 * advisory adjacency signals only—not an automated detection verdict.
 */
export const CORRELATION_CLUSTER_DISCLAIMER_NOT_DETECTION_VERDICT =
  "Co-occurrence and cross-session clusters are advisory only—they are not a detection verdict.";

export const CORRELATION_CLUSTER_DISCLAIMER_LINES = [
  CORRELATION_CLUSTER_DISCLAIMER_CORRELATION_NE_CAUSATION,
  CORRELATION_CLUSTER_DISCLAIMER_NOT_DETECTION_VERDICT,
] as const;

/** Combined in-product / pack-export disclaimer text. */
export const CORRELATION_CLUSTER_DISCLAIMER_TEXT =
  CORRELATION_CLUSTER_DISCLAIMER_LINES.join(" ");

/**
 * Same-page co-occurrence surface label. Keep aligned with
 * HOVER_CARD_CO_OCCURRENCE_LABEL ("Appeared alongside") without importing the
 * hover enrichment module into this cluster helper.
 */
export const CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LABEL = "Appeared alongside";

/** CSS class on the tray same-page co-occurrence `<details>` sibling. */
export const CORRELATION_CLUSTER_TRAY_CO_OCCURRENCE_DETAILS_CLASS =
  "vera5-tray-co-occurrence";

/** Link from cross-session clusters to the existing same-page co-occurrence panel. */
export const CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LINK_LABEL = `See ${CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LABEL} for this page`;

export function formatCorrelationClusterSamePageCoOccurrenceLinkAriaLabel(): string {
  return `Open ${CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LABEL} for this page scan`;
}

/**
 * Show a link to same-page co-occurrence only while viewing the current tab
 * scan and when that panel has related indicators — never duplicate its list.
 */
export function shouldShowCorrelationClusterSamePageCoOccurrenceLink(input: {
  viewingCurrentTabScan: boolean;
  hasSamePageCoOccurrence: boolean;
}): boolean {
  return input.viewingCurrentTabScan === true && input.hasSamePageCoOccurrence === true;
}

export function buildTrayCoOccurrenceDetailsElementId(anchorId: string): string {
  const trimmed = anchorId.trim();
  return trimmed.length > 0
    ? `vera5-tray-co-occurrence-${trimmed}`
    : "vera5-tray-co-occurrence";
}

/**
 * Opens the sibling same-page co-occurrence `<details>` in the same tray row.
 * Returns false when the panel is not present (caller should hide the link).
 */
export function openTraySamePageCoOccurrenceDetails(fromElement: HTMLElement): boolean {
  const row = fromElement.closest("li");
  if (!row) {
    return false;
  }
  const details = row.querySelector(
    `details.${CORRELATION_CLUSTER_TRAY_CO_OCCURRENCE_DETAILS_CLASS}`
  );
  if (!(details instanceof HTMLDetailsElement)) {
    return false;
  }
  details.open = true;
  const summary = details.querySelector("summary");
  if (summary instanceof HTMLElement) {
    summary.focus();
  }
  return true;
}

/** CSS class on the tray cross-session correlation `<details>` element. */
export const CORRELATION_CLUSTER_TRAY_DETAILS_CLASS =
  "vera5-tray-correlation-clusters";

export function buildTrayCorrelationClusterDetailsElementId(
  anchorId: string
): string {
  const trimmed = anchorId.trim();
  return trimmed.length > 0
    ? `vera5-tray-correlation-clusters-${trimmed}`
    : "vera5-tray-correlation-clusters";
}

/**
 * Opens the sibling cross-session correlation `<details>` in the same tray row.
 * Returns false when the panel is not present.
 */
export function openTrayCorrelationClusterDetails(
  fromElement: HTMLElement
): boolean {
  const row = fromElement.closest("li");
  if (!row) {
    return false;
  }
  const details = row.querySelector(
    `details.${CORRELATION_CLUSTER_TRAY_DETAILS_CLASS}`
  );
  if (!(details instanceof HTMLDetailsElement)) {
    return false;
  }
  details.open = true;
  const summary = details.querySelector("summary");
  if (summary instanceof HTMLElement) {
    summary.focus();
  }
  return true;
}

/** Only supported correlation UI layout: ordered list / adjacency rows. */
export const CORRELATION_CLUSTER_UI_LAYOUT = "list" as const;

export type CorrelationClusterUiLayout = typeof CORRELATION_CLUSTER_UI_LAYOUT;

/**
 * Graph and global map surfaces that cross-session correlation must never render.
 * Correlation packs stay a local list of co-appeared sessions — not a TI map.
 */
export const CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES = [
  "force-directed-graph",
  "global-ti-map",
  "canvas-graph",
  "svg-force-layout",
] as const;

export type CorrelationClusterForbiddenUiSurface =
  (typeof CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES)[number];

export const CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACE_SET = new Set<string>(
  CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES
);

/** Call-site / markup patterns that must not appear in correlation UI modules. */
export const CORRELATION_CLUSTER_FORBIDDEN_UI_CALL_PATTERNS: readonly RegExp[] = [
  /\bforceDirected\s*\(/i,
  /\bd3\.force(?:Simulation|Link|ManyBody|Center)?\s*\(/,
  /\bcytoscape\s*\(/i,
  /\bnew\s+vis\.Network\b/,
  /createElement\(\s*["']canvas["']\s*\)/,
  /<\s*canvas\b/i,
  /\brenderGlobalThreatMap\s*\(/i,
  /\bglobalThreatMap\s*\(/i,
  /\bForceGraph\s*\(/,
];

export class CorrelationClusterGraphUiForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrelationClusterGraphUiForbiddenError";
  }
}

export function isCorrelationClusterForbiddenUiSurface(
  surface: string
): surface is CorrelationClusterForbiddenUiSurface {
  return CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACE_SET.has(surface.trim());
}

export function assertCorrelationClusterUiIsListOnly(
  layout: string = CORRELATION_CLUSTER_UI_LAYOUT
): void {
  if (layout.trim() !== CORRELATION_CLUSTER_UI_LAYOUT) {
    throw new CorrelationClusterGraphUiForbiddenError(
      `Correlation cluster UI requires list layout; received: ${layout}`
    );
  }
}

export function assertCorrelationClusterGraphUiForbidden(surface: string): void {
  const trimmed = surface.trim();
  if (
    isCorrelationClusterForbiddenUiSurface(trimmed) ||
    CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES.some(
      (forbidden) =>
        trimmed === forbidden ||
        trimmed.includes(forbidden) ||
        trimmed.toLowerCase().includes(forbidden.replace(/-/g, " "))
    )
  ) {
    throw new CorrelationClusterGraphUiForbiddenError(
      `Correlation cluster UI forbids graph/map surface: ${trimmed}`
    );
  }
}

/**
 * Returns the first forbidden graph/map call-site pattern found in source text,
 * or null when none match.
 */
export function findCorrelationClusterForbiddenUiCallInSource(
  source: string
): string | null {
  for (const pattern of CORRELATION_CLUSTER_FORBIDDEN_UI_CALL_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

export function assertCorrelationClusterSourceForbidsGraphUi(source: string): void {
  const hit = findCorrelationClusterForbiddenUiCallInSource(source);
  if (hit) {
    throw new CorrelationClusterGraphUiForbiddenError(
      `Correlation cluster UI source forbids graph/map call site: ${hit}`
    );
  }
}

export type CorrelationClusterTrayClusterRow = {
  clusterId: string;
  otherSessionIds: string[];
  otherSessions: CorrelationClusterTraySessionDrilldown[];
  coOccurrenceCount: number;
  memberCount: number;
  memberIocKeys: string[];
};

export type CorrelationClusterTrayPanelView = {
  layout: CorrelationClusterUiLayout;
  focusMemberKey: string;
  clusters: CorrelationClusterTrayClusterRow[];
};

/** Session fields used to render correlation tray drill-down rows. */
export type CorrelationClusterSessionLookup = Pick<
  InvestigationSession,
  "id" | "title" | "pageUrl" | "createdAt" | "updatedAt"
>;

export type CorrelationClusterTraySessionDrilldown = {
  sessionId: string;
  title: string;
  pageUrl: string;
  pageUrlDisplay: string;
  dateAt: number;
  dateLabel: string;
  clusterMemberCount: number;
};

export const MAX_CORRELATION_CLUSTER_PAGE_URL_DISPLAY_LENGTH = 48;

export const CORRELATION_CLUSTER_UNKNOWN_SESSION_TITLE = "Unknown session";
export const CORRELATION_CLUSTER_UNKNOWN_PAGE_URL_LABEL = "Unknown page";
export const CORRELATION_CLUSTER_UNKNOWN_DATE_LABEL = "Unknown date";

export function truncateCorrelationClusterPageUrl(
  pageUrl: string,
  maxLength: number = MAX_CORRELATION_CLUSTER_PAGE_URL_DISPLAY_LENGTH
): string {
  const trimmed = pageUrl.trim();
  if (trimmed.length === 0) {
    return CORRELATION_CLUSTER_UNKNOWN_PAGE_URL_LABEL;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatCorrelationClusterSessionDate(at: number): string {
  if (!Number.isFinite(at)) {
    return CORRELATION_CLUSTER_UNKNOWN_DATE_LABEL;
  }
  return new Date(at).toLocaleDateString();
}

export function formatCorrelationClusterTrayClusterIocCount(memberCount: number): string {
  const count = Number.isFinite(memberCount) && memberCount > 0 ? memberCount : 0;
  return count === 1 ? "1 indicator in cluster" : `${count} indicators in cluster`;
}

export function buildCorrelationClusterTraySessionDrilldown(input: {
  sessionId: string;
  clusterMemberCount: number;
  session?: CorrelationClusterSessionLookup | null;
}): CorrelationClusterTraySessionDrilldown {
  const sessionId = input.sessionId.trim();
  const session = input.session;
  const pageUrl = session?.pageUrl?.trim() ?? "";
  const dateAt = session
    ? Number.isFinite(session.updatedAt)
      ? session.updatedAt
      : session.createdAt
    : Number.NaN;
  const title = session?.title?.trim() || CORRELATION_CLUSTER_UNKNOWN_SESSION_TITLE;

  return {
    sessionId,
    title: session ? title : sessionId || CORRELATION_CLUSTER_UNKNOWN_SESSION_TITLE,
    pageUrl,
    pageUrlDisplay: truncateCorrelationClusterPageUrl(pageUrl),
    dateAt: Number.isFinite(dateAt) ? dateAt : Number.NaN,
    dateLabel: formatCorrelationClusterSessionDate(dateAt),
    clusterMemberCount: input.clusterMemberCount,
  };
}

export function formatCorrelationClusterTraySessionDrilldownLine(
  drilldown: CorrelationClusterTraySessionDrilldown
): string {
  return `${drilldown.pageUrlDisplay} · ${drilldown.dateLabel} · ${formatCorrelationClusterTrayClusterIocCount(drilldown.clusterMemberCount)}`;
}

export function formatCorrelationClusterTraySessionDrilldownAriaLabel(
  drilldown: CorrelationClusterTraySessionDrilldown
): string {
  return `${drilldown.title}. ${formatCorrelationClusterTraySessionDrilldownLine(drilldown)}`;
}

export function listCorrelationClustersForMemberIocKey(
  clusters: readonly CorrelationCluster[],
  memberIocKey: string
): CorrelationCluster[] {
  const focusKey = memberIocKey.trim();
  if (focusKey.length === 0) {
    return [];
  }
  return clusters.filter((cluster) => cluster.memberIocKeys.includes(focusKey));
}

function resolveCorrelationClusterSessionLookup(
  sessionsById: ReadonlyMap<string, CorrelationClusterSessionLookup> | undefined,
  sessionId: string
): CorrelationClusterSessionLookup | null {
  if (!sessionsById) {
    return null;
  }
  return sessionsById.get(sessionId) ?? null;
}

export function buildCorrelationClusterTrayPanelView(input: {
  iocType: IocType;
  value: string;
  clusters: readonly CorrelationCluster[];
  activeSessionId?: string | null;
  sessionsById?: ReadonlyMap<string, CorrelationClusterSessionLookup>;
}): CorrelationClusterTrayPanelView {
  const focusMemberKey = buildIocCoOccurrenceMemberKey(input.iocType, input.value);
  const activeSessionId = input.activeSessionId?.trim() ?? "";
  const matching = listCorrelationClustersForMemberIocKey(
    input.clusters,
    focusMemberKey
  );

  const rows: CorrelationClusterTrayClusterRow[] = [];
  for (const cluster of matching) {
    const otherSessionIds = cluster.sessionIds.filter(
      (sessionId) => sessionId !== activeSessionId
    );
    if (otherSessionIds.length === 0) {
      continue;
    }
    const otherSessions = otherSessionIds.map((sessionId) =>
      buildCorrelationClusterTraySessionDrilldown({
        sessionId,
        clusterMemberCount: cluster.memberIocKeys.length,
        session: resolveCorrelationClusterSessionLookup(input.sessionsById, sessionId),
      })
    );
    rows.push({
      clusterId: cluster.clusterId,
      otherSessionIds,
      otherSessions,
      coOccurrenceCount: cluster.coOccurrenceCount,
      memberCount: cluster.memberIocKeys.length,
      memberIocKeys: [...cluster.memberIocKeys],
    });
  }

  return {
    layout: CORRELATION_CLUSTER_UI_LAYOUT,
    focusMemberKey,
    clusters: rows,
  };
}

export function isCorrelationClusterTrayPanelEmpty(
  view: CorrelationClusterTrayPanelView
): boolean {
  return view.clusters.length === 0;
}

/**
 * Correlation tray surface is always available once cluster memory has been
 * evaluated for the current scan (list rows or empty state).
 */
export function shouldShowTrayCorrelationClusterExpander(
  view: CorrelationClusterTrayPanelView,
  options?: { ready?: boolean }
): boolean {
  assertCorrelationClusterUiIsListOnly(view.layout);
  if (options?.ready === false) {
    return false;
  }
  return true;
}

export function formatCorrelationClusterTrayClusterLine(
  row: CorrelationClusterTrayClusterRow
): string {
  const sessionCount = row.otherSessionIds.length;
  const sessionLabel = sessionCount === 1 ? "session" : "sessions";
  const memberLabel = row.memberCount === 1 ? "indicator" : "indicators";
  return `${sessionCount} other ${sessionLabel} · ${row.memberCount} ${memberLabel}`;
}

export function formatCorrelationClusterTrayOtherSessionsLine(
  row: CorrelationClusterTrayClusterRow
): string {
  if (row.otherSessions.length > 0) {
    return row.otherSessions
      .map(
        (session) =>
          `${session.title} · ${formatCorrelationClusterTraySessionDrilldownLine(session)}`
      )
      .join("; ");
  }
  return `${CORRELATION_CLUSTER_TRAY_OTHER_SESSIONS_LABEL}: ${row.otherSessionIds.join(", ")}`;
}

export function formatCorrelationClusterTrayClusterAriaLabel(
  row: CorrelationClusterTrayClusterRow
): string {
  return `${formatCorrelationClusterTrayClusterLine(row)}. ${formatCorrelationClusterTrayOtherSessionsLine(row)}`;
}
