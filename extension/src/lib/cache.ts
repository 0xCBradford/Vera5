export const STORAGE_KEY_ENRICHMENT_CACHE = "enrichmentCache";

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

export async function getEnrichmentCache(): Promise<EnrichmentCacheRecord> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ENRICHMENT_CACHE);
  return normalizeEnrichmentCache(result[STORAGE_KEY_ENRICHMENT_CACHE]);
}

export async function clearEnrichmentCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_CACHE);
}
