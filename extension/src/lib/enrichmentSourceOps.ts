import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  type EnrichmentErrorCode,
  type EnrichmentSourceResult,
  type EnrichmentSourceStatus,
} from "./enrichment";
import {
  countEnrichmentCacheEntries,
  countEnrichmentCacheEntriesBySource,
  getEnrichmentCache,
  readEnrichmentCacheClearedAt,
  type EnrichmentCacheRecord,
} from "./cache";
import { getEnrichmentSourceQuotaSummary } from "./connectorProfileExport";
import {
  ENRICHMENT_SOURCE_DEFINITIONS,
  ENRICHMENT_SOURCE_ORDER,
  isEnrichmentSourceId,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";

export const ENRICHMENT_SOURCE_OPS_SECTION_TITLE = "Source operations";

export const ENRICHMENT_SOURCE_OPS_POPUP_GUIDANCE =
  "Source health and vendor quota hints (last status, last error, cache counts, scoped clear cache, rate-limit cooldown, and last cache clear) live in the extension popup under Source operations—not on this page.";

export const STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS =
  "enrichmentSourceLastStatus";

export type EnrichmentSourceLastStatusEntry = {
  status: EnrichmentSourceStatus;
  at: string;
  errorCode?: EnrichmentErrorCode;
  fromCache?: boolean;
};

export type EnrichmentSourceLastStatusRecord = Partial<
  Record<EnrichmentSourceId, EnrichmentSourceLastStatusEntry>
>;

export type EnrichmentSourceOpsRow = {
  sourceId: EnrichmentSourceId;
  displayName: string;
  lastStatus: EnrichmentSourceLastStatusEntry | null;
  cacheEntryCount: number;
  quotaHint: string;
};

export type EnrichmentSourceOpsSnapshot = {
  globalCooldownRemainingSeconds: number;
  globalCooldownActive: boolean;
  lastCacheClearAt: string | null;
  totalCacheEntryCount: number;
  sources: EnrichmentSourceOpsRow[];
};

const ENRICHMENT_SOURCE_STATUS_SET = new Set<string>(
  Object.values(ENRICHMENT_SOURCE_STATUS)
);

const ENRICHMENT_ERROR_CODE_SET = new Set<string>(
  Object.values(ENRICHMENT_ERROR_CODE)
);

function isEnrichmentSourceLastStatusEntry(
  value: unknown
): value is EnrichmentSourceLastStatusEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    !ENRICHMENT_SOURCE_STATUS_SET.has(record.status)
  ) {
    return false;
  }
  if (typeof record.at !== "string" || record.at.trim().length === 0) {
    return false;
  }
  if (
    record.errorCode !== undefined &&
    (typeof record.errorCode !== "string" ||
      !ENRICHMENT_ERROR_CODE_SET.has(record.errorCode))
  ) {
    return false;
  }
  if (record.fromCache !== undefined && record.fromCache !== true) {
    return false;
  }
  return true;
}

export function normalizeEnrichmentSourceLastStatusRecord(
  value: unknown
): EnrichmentSourceLastStatusRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: EnrichmentSourceLastStatusRecord = {};
  for (const [sourceId, entry] of Object.entries(value)) {
    if (!isEnrichmentSourceId(sourceId) || !isEnrichmentSourceLastStatusEntry(entry)) {
      continue;
    }
    normalized[sourceId] = entry;
  }
  return normalized;
}

export function isEnrichmentSourceOpsSnapshot(
  value: unknown
): value is EnrichmentSourceOpsSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.globalCooldownRemainingSeconds !== "number" ||
    !Number.isFinite(record.globalCooldownRemainingSeconds) ||
    typeof record.globalCooldownActive !== "boolean" ||
    (record.lastCacheClearAt !== null &&
      (typeof record.lastCacheClearAt !== "string" ||
        record.lastCacheClearAt.trim().length === 0)) ||
    typeof record.totalCacheEntryCount !== "number" ||
    !Number.isFinite(record.totalCacheEntryCount) ||
    !Array.isArray(record.sources)
  ) {
    return false;
  }

  return record.sources.every((row) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return false;
    }
    const sourceRow = row as Record<string, unknown>;
    if (
      typeof sourceRow.sourceId !== "string" ||
      !isEnrichmentSourceId(sourceRow.sourceId) ||
      typeof sourceRow.displayName !== "string" ||
      typeof sourceRow.quotaHint !== "string" ||
      typeof sourceRow.cacheEntryCount !== "number" ||
      !Number.isFinite(sourceRow.cacheEntryCount)
    ) {
      return false;
    }
    if (sourceRow.lastStatus === null) {
      return true;
    }
    return isEnrichmentSourceLastStatusEntry(sourceRow.lastStatus);
  });
}

async function readEnrichmentSourceLastStatusRecord(): Promise<EnrichmentSourceLastStatusRecord> {
  const result = await chrome.storage.local.get(
    STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS
  );
  return normalizeEnrichmentSourceLastStatusRecord(
    result[STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS]
  );
}

async function persistEnrichmentSourceLastStatusRecord(
  record: EnrichmentSourceLastStatusRecord
): Promise<void> {
  if (Object.keys(record).length === 0) {
    await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS);
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS]: record,
  });
}

export async function recordEnrichmentSourceLastStatuses(
  sources: readonly EnrichmentSourceResult[]
): Promise<void> {
  if (sources.length === 0) {
    return;
  }

  const record = await readEnrichmentSourceLastStatusRecord();
  const fallbackAt = new Date().toISOString();

  for (const result of sources) {
    if (!isEnrichmentSourceId(result.sourceId)) {
      continue;
    }
    record[result.sourceId] = {
      status: result.status,
      at: result.fetchedAt ?? fallbackAt,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      ...(result.fromCache === true ? { fromCache: true } : {}),
    };
  }

  await persistEnrichmentSourceLastStatusRecord(record);
}

export function buildEnrichmentSourceOpsRows(input: {
  lastStatus: EnrichmentSourceLastStatusRecord;
  cache: EnrichmentCacheRecord;
}): EnrichmentSourceOpsRow[] {
  const cacheCounts = countEnrichmentCacheEntriesBySource(input.cache);

  return ENRICHMENT_SOURCE_ORDER.map((sourceId) => ({
    sourceId,
    displayName: ENRICHMENT_SOURCE_DEFINITIONS[sourceId].displayName,
    lastStatus: input.lastStatus[sourceId] ?? null,
    cacheEntryCount: cacheCounts[sourceId] ?? 0,
    quotaHint: getEnrichmentSourceQuotaSummary(sourceId),
  }));
}

export async function buildEnrichmentSourceOpsSnapshot(input: {
  globalCooldownRemainingSeconds: number;
  globalCooldownActive: boolean;
}): Promise<EnrichmentSourceOpsSnapshot> {
  const [cache, lastStatus, lastCacheClearAt] = await Promise.all([
    getEnrichmentCache(),
    readEnrichmentSourceLastStatusRecord(),
    readEnrichmentCacheClearedAt(),
  ]);

  return {
    globalCooldownRemainingSeconds: input.globalCooldownRemainingSeconds,
    globalCooldownActive: input.globalCooldownActive,
    lastCacheClearAt,
    totalCacheEntryCount: countEnrichmentCacheEntries(cache),
    sources: buildEnrichmentSourceOpsRows({ lastStatus, cache }),
  };
}

export function formatEnrichmentSourceLastStatusLabel(
  entry: EnrichmentSourceLastStatusEntry | null
): string {
  if (!entry) {
    return "No recent activity";
  }

  if (entry.status === ENRICHMENT_SOURCE_STATUS.OK) {
    return entry.fromCache === true ? "Cached" : "OK";
  }

  if (entry.status === ENRICHMENT_SOURCE_STATUS.SKIPPED) {
    if (entry.errorCode === ENRICHMENT_ERROR_CODE.DISABLED) {
      return "Disabled";
    }
    return "Skipped";
  }

  if (entry.errorCode === ENRICHMENT_ERROR_CODE.RATE_LIMITED) {
    return "Rate limited";
  }
  if (entry.errorCode === ENRICHMENT_ERROR_CODE.MISSING_KEY) {
    return "No API key";
  }
  if (entry.errorCode === ENRICHMENT_ERROR_CODE.UNAUTHORIZED) {
    return "Unauthorized";
  }
  if (entry.errorCode === ENRICHMENT_ERROR_CODE.TIMEOUT) {
    return "Timed out";
  }
  if (entry.errorCode === ENRICHMENT_ERROR_CODE.NETWORK) {
    return "Network error";
  }

  return "Error";
}

export function formatEnrichmentSourceLastErrorLabel(
  entry: EnrichmentSourceLastStatusEntry | null
): string | null {
  if (!entry?.errorCode) {
    return null;
  }

  switch (entry.errorCode) {
    case ENRICHMENT_ERROR_CODE.RATE_LIMITED:
      return "HTTP 429 rate limited";
    case ENRICHMENT_ERROR_CODE.MISSING_KEY:
      return "Missing API key";
    case ENRICHMENT_ERROR_CODE.UNAUTHORIZED:
      return "Unauthorized";
    case ENRICHMENT_ERROR_CODE.TIMEOUT:
      return "Request timed out";
    case ENRICHMENT_ERROR_CODE.NETWORK:
      return "Network error";
    case ENRICHMENT_ERROR_CODE.DISABLED:
      return "Source disabled";
    case ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE:
      return "Unsupported indicator type";
    case ENRICHMENT_ERROR_CODE.DOMAIN_POLICY:
      return "Blocked by domain policy";
    case ENRICHMENT_ERROR_CODE.INTERNAL_ASSET:
      return "Blocked by internal asset policy";
    case ENRICHMENT_ERROR_CODE.VENDOR:
      return "Vendor error";
    default:
      return entry.errorCode.replace(/_/g, " ");
  }
}

export function formatEnrichmentCacheClearedAtLabel(
  clearedAt: string | null
): string {
  if (!clearedAt) {
    return "Never";
  }

  const parsed = new Date(clearedAt);
  if (Number.isNaN(parsed.getTime())) {
    return clearedAt;
  }
  return parsed.toLocaleString();
}

export function formatEnrichmentSourceOpsCooldownLabel(
  snapshot: EnrichmentSourceOpsSnapshot
): string {
  if (!snapshot.globalCooldownActive) {
    return "No active HTTP 429 cooldown";
  }
  return `HTTP 429 cooldown: ${snapshot.globalCooldownRemainingSeconds}s remaining`;
}

export function formatEnrichmentSourceCacheEntryCountLabel(count: number): string {
  if (count <= 0) {
    return "No cache entries";
  }
  return count === 1 ? "1 cache entry" : `${count} cache entries`;
}

export function resolveEnrichmentSourceClearCacheFeedback(input: {
  sourceDisplayName: string;
  removedCount: number;
}): string {
  if (input.removedCount <= 0) {
    return `No cache entries cleared for ${input.sourceDisplayName}.`;
  }
  return input.removedCount === 1
    ? `Cleared 1 cache entry for ${input.sourceDisplayName}.`
    : `Cleared ${input.removedCount} cache entries for ${input.sourceDisplayName}.`;
}
