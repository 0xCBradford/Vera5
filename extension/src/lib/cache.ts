import {
  ENRICHMENT_SOURCE_STATUS,
  normalizeEnrichmentSourceResult,
  type EnrichmentSourceResult,
} from "./enrichment";
import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import { isEnrichmentSourceId } from "./enrichmentSourceRegistry";
import {
  getVera5Settings,
  SETTINGS_SCHEMA_VERSION,
  type EnrichmentSourceCacheTtlRecord,
} from "./storage";

export const STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT =
  "enrichmentCacheClearedAt";

export const STORAGE_KEY_ENRICHMENT_CACHE = "enrichmentCache";

export const STORAGE_KEY_ENRICHMENT_CACHE_INDEX = "enrichmentCacheIndex";

export const ENRICHMENT_CACHE_INDEX_SCHEMA_VERSION = 1;

export const DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES = 500;

export const ENRICHMENT_CACHE_KEY_SEPARATOR = "|";

export type EnrichmentCacheEntry = {
  fetchedAt: number;
  payload: unknown;
};

export type EnrichmentCacheRecord = Record<string, EnrichmentCacheEntry>;

export function createEmptyEnrichmentCache(): EnrichmentCacheRecord {
  return {};
}

export function isEnrichmentCacheRecord(value: unknown): value is EnrichmentCacheRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const record = entry as Record<string, unknown>;
    return (
      typeof record.fetchedAt === "number" &&
      Number.isFinite(record.fetchedAt) &&
      "payload" in record
    );
  });
}

export function normalizeEnrichmentCache(value: unknown): EnrichmentCacheRecord {
  if (!isEnrichmentCacheRecord(value)) {
    return createEmptyEnrichmentCache();
  }
  return { ...value };
}

export function countEnrichmentCacheEntries(
  cache: EnrichmentCacheRecord
): number {
  return Object.keys(cache).length;
}

export function countEnrichmentCacheEntriesBySource(
  cache: EnrichmentCacheRecord
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cacheKey of Object.keys(cache)) {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    if (!parsed) {
      continue;
    }
    counts[parsed.sourceId] = (counts[parsed.sourceId] ?? 0) + 1;
  }
  return counts;
}

export function getMaxEnrichmentCacheEntries(): number {
  return DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES;
}

export function sortEnrichmentCacheKeysByAge(
  cache: EnrichmentCacheRecord,
  order: "oldest" | "newest" = "oldest"
): string[] {
  const keys = Object.keys(cache);
  keys.sort((left, right) => {
    const leftFetchedAt = cache[left]?.fetchedAt ?? 0;
    const rightFetchedAt = cache[right]?.fetchedAt ?? 0;
    return order === "oldest"
      ? leftFetchedAt - rightFetchedAt
      : rightFetchedAt - leftFetchedAt;
  });
  return keys;
}

export function enforceEnrichmentCacheSizeLimit(
  cache: EnrichmentCacheRecord,
  maxEntries: number = DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES,
  protectedCacheKeys: ReadonlySet<string> = new Set()
): EnrichmentCacheRecord {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
    return createEmptyEnrichmentCache();
  }

  const next = { ...cache };
  const evictUntilWithinLimit = (preferUnprotected: boolean): void => {
    while (countEnrichmentCacheEntries(next) > maxEntries) {
      const candidates = sortEnrichmentCacheKeysByAge(next, "oldest").filter(
        (cacheKey) => !preferUnprotected || !protectedCacheKeys.has(cacheKey)
      );
      if (candidates.length === 0) {
        break;
      }
      delete next[candidates[0]!];
    }
  };

  evictUntilWithinLimit(true);
  evictUntilWithinLimit(false);
  return next;
}

export function enrichmentCacheKeysForIoc(
  cache: EnrichmentCacheRecord,
  iocValue: string
): string[] {
  const normalizedValue = iocValue.trim();
  if (normalizedValue.length === 0) {
    return [];
  }

  return Object.keys(cache).filter((cacheKey) => {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    return parsed?.iocValue === normalizedValue;
  });
}

export function removeEnrichmentCacheEntriesForIoc(
  cache: EnrichmentCacheRecord,
  iocValue: string
): { cache: EnrichmentCacheRecord; removedKeys: readonly string[] } {
  const removedKeys = enrichmentCacheKeysForIoc(cache, iocValue);
  if (removedKeys.length === 0) {
    return { cache, removedKeys };
  }

  const next = { ...cache };
  for (const cacheKey of removedKeys) {
    delete next[cacheKey];
  }
  return { cache: next, removedKeys };
}

export function enrichmentCacheKeysForSource(
  cache: EnrichmentCacheRecord,
  sourceId: EnrichmentSourceId
): string[] {
  return Object.keys(cache).filter((cacheKey) => {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    return parsed?.sourceId === sourceId;
  });
}

export function removeEnrichmentCacheEntriesForSource(
  cache: EnrichmentCacheRecord,
  sourceId: EnrichmentSourceId
): { cache: EnrichmentCacheRecord; removedKeys: readonly string[] } {
  const removedKeys = enrichmentCacheKeysForSource(cache, sourceId);
  if (removedKeys.length === 0) {
    return { cache, removedKeys };
  }

  const next = { ...cache };
  for (const cacheKey of removedKeys) {
    delete next[cacheKey];
  }
  return { cache: next, removedKeys };
}

export function buildEnrichmentCacheKey(
  iocValue: string,
  sourceId: EnrichmentSourceId
): string | null {
  const normalizedValue = iocValue.trim();
  if (normalizedValue.length === 0) {
    return null;
  }
  return `${normalizedValue}${ENRICHMENT_CACHE_KEY_SEPARATOR}${sourceId}`;
}

export function parseEnrichmentCacheKey(
  cacheKey: string
): { iocValue: string; sourceId: string } | null {
  const separatorIndex = cacheKey.lastIndexOf(ENRICHMENT_CACHE_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === cacheKey.length - 1) {
    return null;
  }
  const iocValue = cacheKey.slice(0, separatorIndex).trim();
  const sourceId = cacheKey.slice(separatorIndex + 1).trim();
  if (iocValue.length === 0 || sourceId.length === 0) {
    return null;
  }
  return { iocValue, sourceId };
}

export type EnrichmentCacheIndexRecord = Partial<
  Record<EnrichmentSourceId, readonly string[]>
>;

export type EnrichmentCacheIndexDocument = {
  indexSchemaVersion: number;
  bySourceId: EnrichmentCacheIndexRecord;
};

export function buildEnrichmentCacheIndex(
  cache: EnrichmentCacheRecord
): EnrichmentCacheIndexRecord {
  const index: Partial<Record<EnrichmentSourceId, string[]>> = {};
  for (const cacheKey of Object.keys(cache)) {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    if (!parsed || !isEnrichmentSourceId(parsed.sourceId)) {
      continue;
    }
    const sourceId = parsed.sourceId;
    const bucket = index[sourceId] ?? [];
    bucket.push(cacheKey);
    index[sourceId] = bucket;
  }
  return Object.fromEntries(
    Object.entries(index).map(([sourceId, cacheKeys]) => [
      sourceId,
      Object.freeze([...cacheKeys]),
    ])
  );
}

export function buildEnrichmentCacheIndexDocument(
  cache: EnrichmentCacheRecord
): EnrichmentCacheIndexDocument {
  return {
    indexSchemaVersion: ENRICHMENT_CACHE_INDEX_SCHEMA_VERSION,
    bySourceId: buildEnrichmentCacheIndex(cache),
  };
}

export function isEnrichmentCacheIndexDocument(
  value: unknown
): value is EnrichmentCacheIndexDocument {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.indexSchemaVersion !== "number" ||
    !Number.isFinite(record.indexSchemaVersion)
  ) {
    return false;
  }
  if (
    record.bySourceId === null ||
    typeof record.bySourceId !== "object" ||
    Array.isArray(record.bySourceId)
  ) {
    return false;
  }
  return true;
}

export function migrateEnrichmentCacheRecord(cache: EnrichmentCacheRecord): {
  cache: EnrichmentCacheRecord;
  index: EnrichmentCacheIndexDocument;
} {
  const next = createEmptyEnrichmentCache();
  for (const [cacheKey, entry] of Object.entries(cache)) {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    if (!parsed || !isEnrichmentSourceId(parsed.sourceId)) {
      continue;
    }
    if (
      typeof entry.fetchedAt !== "number" ||
      !Number.isFinite(entry.fetchedAt) ||
      !("payload" in entry)
    ) {
      continue;
    }
    next[cacheKey] = entry;
  }
  return {
    cache: next,
    index: buildEnrichmentCacheIndexDocument(next),
  };
}

export async function needsEnrichmentCacheIndexMigration(
  storageSchemaVersion: number
): Promise<boolean> {
  if (storageSchemaVersion < SETTINGS_SCHEMA_VERSION) {
    return true;
  }
  const result = await chrome.storage.local.get(
    STORAGE_KEY_ENRICHMENT_CACHE_INDEX
  );
  return !isEnrichmentCacheIndexDocument(
    result[STORAGE_KEY_ENRICHMENT_CACHE_INDEX]
  );
}

export async function migrateEnrichmentCacheIndexStorage(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ENRICHMENT_CACHE);
  const { cache, index } = migrateEnrichmentCacheRecord(
    normalizeEnrichmentCache(result[STORAGE_KEY_ENRICHMENT_CACHE])
  );
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_CACHE_INDEX]: index,
  });
  if (countEnrichmentCacheEntries(cache) === 0) {
    if (typeof chrome.storage.local.remove === "function") {
      await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_CACHE);
    }
    return true;
  }
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_CACHE]: cache,
  });
  return true;
}

export function enrichmentCacheEntryAgeMs(
  entry: EnrichmentCacheEntry,
  nowMs: number = Date.now()
): number {
  return Math.max(0, nowMs - entry.fetchedAt);
}

export function isEnrichmentCacheEntryExpired(
  entry: EnrichmentCacheEntry,
  ttlSeconds: number,
  nowMs: number = Date.now()
): boolean {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return true;
  }
  const ttlMs = ttlSeconds * 1000;
  return enrichmentCacheEntryAgeMs(entry, nowMs) >= ttlMs;
}

export function resolveEnrichmentCacheTtlSeconds(
  sourceId: EnrichmentSourceId,
  globalTtlSeconds: number,
  sourceOverrides: EnrichmentSourceCacheTtlRecord = {}
): number {
  if (Object.prototype.hasOwnProperty.call(sourceOverrides, sourceId)) {
    const override = sourceOverrides[sourceId];
    if (override !== undefined) {
      return override;
    }
  }
  return globalTtlSeconds;
}

export function getValidEnrichmentCacheEntry(
  cache: EnrichmentCacheRecord,
  cacheKey: string,
  ttlSeconds: number,
  nowMs: number = Date.now()
): EnrichmentCacheEntry | null {
  const entry = cache[cacheKey];
  if (!entry) {
    return null;
  }
  if (isEnrichmentCacheEntryExpired(entry, ttlSeconds, nowMs)) {
    return null;
  }
  return entry;
}

export function pruneExpiredEnrichmentCacheEntries(
  cache: EnrichmentCacheRecord,
  ttlSeconds: number,
  nowMs: number = Date.now()
): EnrichmentCacheRecord {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return createEmptyEnrichmentCache();
  }

  const pruned = createEmptyEnrichmentCache();
  for (const [cacheKey, entry] of Object.entries(cache)) {
    if (!isEnrichmentCacheEntryExpired(entry, ttlSeconds, nowMs)) {
      pruned[cacheKey] = entry;
    }
  }
  return pruned;
}

export function pruneExpiredEnrichmentCacheEntriesForSources(
  cache: EnrichmentCacheRecord,
  globalTtlSeconds: number,
  sourceOverrides: EnrichmentSourceCacheTtlRecord = {},
  nowMs: number = Date.now()
): EnrichmentCacheRecord {
  const pruned = createEmptyEnrichmentCache();

  for (const [cacheKey, entry] of Object.entries(cache)) {
    const parsed = parseEnrichmentCacheKey(cacheKey);
    const ttlSeconds = parsed
      ? resolveEnrichmentCacheTtlSeconds(
          parsed.sourceId as EnrichmentSourceId,
          globalTtlSeconds,
          sourceOverrides
        )
      : globalTtlSeconds;

    if (!isEnrichmentCacheEntryExpired(entry, ttlSeconds, nowMs)) {
      pruned[cacheKey] = entry;
    }
  }

  return pruned;
}

export async function getEnrichmentCacheTtlSeconds(): Promise<number> {
  const settings = await getVera5Settings();
  return settings.enrichmentCacheTtlSeconds;
}

export async function getEnrichmentCacheTtlSecondsForSource(
  sourceId: EnrichmentSourceId
): Promise<number> {
  const settings = await getVera5Settings();
  return resolveEnrichmentCacheTtlSeconds(
    sourceId,
    settings.enrichmentCacheTtlSeconds,
    settings.enrichmentSourceCacheTtlSeconds
  );
}

export async function getEnrichmentCache(): Promise<EnrichmentCacheRecord> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ENRICHMENT_CACHE);
  const cache = normalizeEnrichmentCache(result[STORAGE_KEY_ENRICHMENT_CACHE]);
  const bounded = enforceEnrichmentCacheSizeLimit(cache);
  if (countEnrichmentCacheEntries(bounded) !== countEnrichmentCacheEntries(cache)) {
    await persistEnrichmentCacheRecord(bounded);
  }
  return bounded;
}

async function persistEnrichmentCacheRecord(
  cache: EnrichmentCacheRecord
): Promise<void> {
  if (countEnrichmentCacheEntries(cache) === 0) {
    await clearEnrichmentCache();
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_CACHE]: cache,
  });
}

export async function setEnrichmentCache(
  cache: EnrichmentCacheRecord
): Promise<void> {
  await persistEnrichmentCacheRecord(
    enforceEnrichmentCacheSizeLimit(cache)
  );
}

export async function upsertEnrichmentCacheEntry(
  cacheKey: string,
  payload: unknown,
  fetchedAt: number = Date.now()
): Promise<void> {
  const cache = await getEnrichmentCache();
  cache[cacheKey] = { fetchedAt, payload };
  const bounded = enforceEnrichmentCacheSizeLimit(
    cache,
    DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES,
    new Set([cacheKey])
  );
  await persistEnrichmentCacheRecord(bounded);
}

export async function readValidEnrichmentCacheEntry(
  iocValue: string,
  sourceId: EnrichmentSourceId,
  nowMs: number = Date.now()
): Promise<EnrichmentCacheEntry | null> {
  const cacheKey = buildEnrichmentCacheKey(iocValue, sourceId);
  if (!cacheKey) {
    return null;
  }

  const ttlSeconds = await getEnrichmentCacheTtlSecondsForSource(sourceId);
  const cache = await getEnrichmentCache();
  return getValidEnrichmentCacheEntry(cache, cacheKey, ttlSeconds, nowMs);
}

export async function writeEnrichmentCacheEntry(
  iocValue: string,
  sourceId: EnrichmentSourceId,
  payload: unknown,
  fetchedAt: number = Date.now()
): Promise<void> {
  const cacheKey = buildEnrichmentCacheKey(iocValue, sourceId);
  if (!cacheKey) {
    return;
  }
  await upsertEnrichmentCacheEntry(cacheKey, payload, fetchedAt);
}

export type ClearEnrichmentCacheOptions = {
  recordClearTimestamp?: boolean;
};

export async function readEnrichmentCacheClearedAt(): Promise<string | null> {
  const result = await chrome.storage.local.get(
    STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT
  );
  const value = result[STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value;
}

export async function persistEnrichmentCacheClearedAt(
  clearedAtMs: number = Date.now()
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT]: new Date(clearedAtMs).toISOString(),
  });
}

export async function clearEnrichmentCache(
  options?: ClearEnrichmentCacheOptions
): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_CACHE);
  if (options?.recordClearTimestamp === true) {
    await persistEnrichmentCacheClearedAt();
  }
}

export async function clearEnrichmentCacheForSource(
  sourceId: EnrichmentSourceId,
  options?: ClearEnrichmentCacheOptions
): Promise<number> {
  const cache = await getEnrichmentCache();
  const { cache: next, removedKeys } = removeEnrichmentCacheEntriesForSource(
    cache,
    sourceId
  );
  if (removedKeys.length === 0) {
    return 0;
  }

  if (countEnrichmentCacheEntries(next) === 0) {
    await clearEnrichmentCache(options);
  } else {
    await setEnrichmentCache(next);
  }

  return removedKeys.length;
}

export async function invalidateEnrichmentCacheForIoc(
  iocValue: string
): Promise<number> {
  const cache = await getEnrichmentCache();
  const { cache: next, removedKeys } = removeEnrichmentCacheEntriesForIoc(
    cache,
    iocValue
  );
  if (removedKeys.length === 0) {
    return 0;
  }

  if (countEnrichmentCacheEntries(next) === 0) {
    await clearEnrichmentCache();
  } else {
    await setEnrichmentCache(next);
  }

  return removedKeys.length;
}

export async function invalidateEnrichmentCacheEntry(
  iocValue: string,
  sourceId: EnrichmentSourceId
): Promise<boolean> {
  const cacheKey = buildEnrichmentCacheKey(iocValue, sourceId);
  if (!cacheKey) {
    return false;
  }

  const cache = await getEnrichmentCache();
  if (!(cacheKey in cache)) {
    return false;
  }

  const next = { ...cache };
  delete next[cacheKey];

  if (countEnrichmentCacheEntries(next) === 0) {
    await clearEnrichmentCache();
  } else {
    await setEnrichmentCache(next);
  }

  return true;
}

export async function readStoredEnrichmentSourceResult(
  iocValue: string,
  sourceId: EnrichmentSourceId,
  nowMs: number = Date.now()
): Promise<EnrichmentSourceResult | null> {
  const entry = await readValidEnrichmentCacheEntry(iocValue, sourceId, nowMs);
  if (!entry) {
    return null;
  }

  const restored = normalizeEnrichmentSourceResult(entry.payload);
  if (!restored) {
    return null;
  }

  const fromCache =
    restored.status === ENRICHMENT_SOURCE_STATUS.OK ? true : restored.fromCache;

  return {
    ...restored,
    ...(fromCache === true ? { fromCache: true } : {}),
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
  };
}

export async function readCachedEnrichmentSourceResult(
  iocValue: string,
  sourceId: EnrichmentSourceId,
  nowMs: number = Date.now()
): Promise<EnrichmentSourceResult | null> {
  const stored = await readStoredEnrichmentSourceResult(iocValue, sourceId, nowMs);
  if (!stored || stored.status !== ENRICHMENT_SOURCE_STATUS.OK) {
    return null;
  }

  return stored;
}

export async function cacheEnrichmentSourceResult(
  iocValue: string,
  sourceId: EnrichmentSourceId,
  result: EnrichmentSourceResult
): Promise<void> {
  if (result.fromCache === true) {
    return;
  }

  const payload = normalizeEnrichmentSourceResult(result);
  if (!payload) {
    return;
  }

  await writeEnrichmentCacheEntry(iocValue, sourceId, payload);
}
