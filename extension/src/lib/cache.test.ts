import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import type { EnrichmentCacheRecord } from "./cache";
import {
  buildEnrichmentCacheKey,
  cacheEnrichmentSourceResult,
  clearEnrichmentCache,
  countEnrichmentCacheEntries,
  createEmptyEnrichmentCache,
  DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES,
  enforceEnrichmentCacheSizeLimit,
  enrichmentCacheEntryAgeMs,
  enrichmentCacheKeysForIoc,
  getEnrichmentCache,
  getMaxEnrichmentCacheEntries,
  getValidEnrichmentCacheEntry,
  invalidateEnrichmentCacheEntry,
  invalidateEnrichmentCacheForIoc,
  isEnrichmentCacheEntryExpired,
  normalizeEnrichmentCache,
  parseEnrichmentCacheKey,
  pruneExpiredEnrichmentCacheEntries,
  pruneExpiredEnrichmentCacheEntriesForSources,
  readCachedEnrichmentSourceResult,
  readStoredEnrichmentSourceResult,
  readValidEnrichmentCacheEntry,
  removeEnrichmentCacheEntriesForIoc,
  resolveEnrichmentCacheTtlSeconds,
  STORAGE_KEY_ENRICHMENT_CACHE,
  upsertEnrichmentCacheEntry,
  writeEnrichmentCacheEntry,
} from "./cache";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
} from "./storage";

function stubChromeStorage(store: Record<string, unknown>): void {
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
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

describe("enrichment cache storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {
      [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]:
        DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
    };
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty cache when storage is missing", async () => {
    await expect(getEnrichmentCache()).resolves.toEqual(
      createEmptyEnrichmentCache()
    );
  });

  it("normalizes invalid cache payloads to empty", () => {
    expect(normalizeEnrichmentCache(null)).toEqual(createEmptyEnrichmentCache());
    expect(normalizeEnrichmentCache([1, 2, 3])).toEqual(
      createEmptyEnrichmentCache()
    );
    expect(
      normalizeEnrichmentCache({
        "185.220.101.4|abuseipdb": { fetchedAt: Date.now(), payload: {} },
      })
    ).toEqual({
      "185.220.101.4|abuseipdb": { fetchedAt: expect.any(Number), payload: {} },
    });
  });

  it("counts cache entries", () => {
    expect(countEnrichmentCacheEntries(createEmptyEnrichmentCache())).toBe(0);
    expect(
      countEnrichmentCacheEntries({
        "a|abuseipdb": { fetchedAt: 1, payload: {} },
        "b|otx": { fetchedAt: 2, payload: {} },
      })
    ).toBe(2);
  });

  it("clears enrichment cache from storage", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "185.220.101.4|abuseipdb": {
        fetchedAt: Date.now(),
        payload: { summary: "cached" },
      },
    };

    await clearEnrichmentCache();

    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toBeUndefined();
    await expect(getEnrichmentCache()).resolves.toEqual(
      createEmptyEnrichmentCache()
    );
  });
});

describe("enrichment cache size limit", () => {
  it("defines a positive default max entry count", () => {
    expect(getMaxEnrichmentCacheEntries()).toBe(
      DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES
    );
    expect(DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES).toBeGreaterThan(0);
  });

  it("evicts oldest entries when over the max size", () => {
    const cache: EnrichmentCacheRecord = {};
    for (let index = 0; index < 4; index += 1) {
      cache[`ioc-${index}|abuseipdb`] = {
        fetchedAt: index * 1000,
        payload: { index },
      };
    }

    const bounded = enforceEnrichmentCacheSizeLimit(cache, 2);
    expect(Object.keys(bounded)).toEqual(["ioc-2|abuseipdb", "ioc-3|abuseipdb"]);
  });

  it("keeps a protected key when enforcing the limit on upsert", () => {
    const cache: EnrichmentCacheRecord = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: { old: true } },
      "1.1.1.1|abuseipdb": { fetchedAt: 2, payload: {} },
      "9.9.9.9|otx": { fetchedAt: 3, payload: {} },
    };

    const bounded = enforceEnrichmentCacheSizeLimit(cache, 2, new Set(["8.8.8.8|abuseipdb"]));
    expect(Object.keys(bounded).sort()).toEqual([
      "8.8.8.8|abuseipdb",
      "9.9.9.9|otx",
    ]);
    expect(bounded["8.8.8.8|abuseipdb"]?.payload).toEqual({ old: true });
  });
});

describe("enrichment cache eviction", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {
      [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]:
        DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
    };
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists cache keys for one IOC across sources", () => {
    const cache = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
      "8.8.8.8|otx": { fetchedAt: 2, payload: {} },
      "1.1.1.1|abuseipdb": { fetchedAt: 3, payload: {} },
    };
    expect(enrichmentCacheKeysForIoc(cache, "8.8.8.8").sort()).toEqual([
      "8.8.8.8|abuseipdb",
      "8.8.8.8|otx",
    ]);
  });

  it("removes all cache entries for one IOC", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: { summary: "a" } },
      "8.8.8.8|otx": { fetchedAt: 2, payload: { summary: "b" } },
      "1.1.1.1|otx": { fetchedAt: 3, payload: { summary: "c" } },
    };

    await expect(invalidateEnrichmentCacheForIoc("8.8.8.8")).resolves.toBe(2);

    const remaining = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      unknown
    >;
    expect(remaining).toEqual({
      "1.1.1.1|otx": { fetchedAt: 3, payload: { summary: "c" } },
    });
  });

  it("removes a single IOC+source cache entry", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
      "8.8.8.8|otx": { fetchedAt: 2, payload: {} },
    };

    await expect(
      invalidateEnrichmentCacheEntry("8.8.8.8", "abuseipdb")
    ).resolves.toBe(true);

    const remaining = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      unknown
    >;
    expect(Object.keys(remaining)).toEqual(["8.8.8.8|otx"]);
  });

  it("clears storage when the last cache entry is removed", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
    };

    await invalidateEnrichmentCacheForIoc("8.8.8.8");

    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toBeUndefined();
  });

  it("pure removal helper returns unchanged cache when IOC is unknown", () => {
    const cache = {
      "1.1.1.1|otx": { fetchedAt: 1, payload: {} },
    };
    expect(removeEnrichmentCacheEntriesForIoc(cache, "8.8.8.8")).toEqual({
      cache,
      removedKeys: [],
    });
  });
});

describe("enrichment cache keys", () => {
  it("builds IOC+source keys with trimmed values", () => {
    expect(buildEnrichmentCacheKey("  8.8.8.8  ", "abuseipdb")).toBe(
      "8.8.8.8|abuseipdb"
    );
    expect(buildEnrichmentCacheKey("example.com", "otx")).toBe(
      "example.com|otx"
    );
    expect(buildEnrichmentCacheKey("example.com", "urlscan")).toBe(
      "example.com|urlscan"
    );
    expect(buildEnrichmentCacheKey("8.8.8.8", "greynoise")).toBe(
      "8.8.8.8|greynoise"
    );
    expect(buildEnrichmentCacheKey("8.8.8.8", "shodan")).toBe(
      "8.8.8.8|shodan"
    );
    expect(buildEnrichmentCacheKey("example.com", "shodan")).toBe(
      "example.com|shodan"
    );
    expect(buildEnrichmentCacheKey("   ", "otx")).toBeNull();
  });

  it("parses cache keys back into IOC value and source id", () => {
    expect(parseEnrichmentCacheKey("8.8.8.8|abuseipdb")).toEqual({
      iocValue: "8.8.8.8",
      sourceId: "abuseipdb",
    });
    expect(parseEnrichmentCacheKey("|abuseipdb")).toBeNull();
    expect(parseEnrichmentCacheKey("8.8.8.8|")).toBeNull();
  });
});

describe("enrichment cache TTL", () => {
  const nowMs = 1_700_000_000_000;
  const entry = { fetchedAt: nowMs - 30_000, payload: { summary: "cached" } };

  it("computes entry age in milliseconds", () => {
    expect(enrichmentCacheEntryAgeMs(entry, nowMs)).toBe(30_000);
  });

  it("treats entries within TTL as valid", () => {
    expect(isEnrichmentCacheEntryExpired(entry, 3600, nowMs)).toBe(false);
    expect(
      getValidEnrichmentCacheEntry(
        { "8.8.8.8|abuseipdb": entry },
        "8.8.8.8|abuseipdb",
        3600,
        nowMs
      )
    ).toEqual(entry);
  });

  it("treats entries at or beyond TTL as expired", () => {
    expect(isEnrichmentCacheEntryExpired(entry, 30, nowMs)).toBe(true);
    expect(
      getValidEnrichmentCacheEntry(
        { "8.8.8.8|abuseipdb": entry },
        "8.8.8.8|abuseipdb",
        30,
        nowMs
      )
    ).toBeNull();
  });

  it("expires entries exactly at the TTL boundary", () => {
    const ttlSeconds = 60;
    const atBoundary = {
      fetchedAt: nowMs - ttlSeconds * 1000,
      payload: { ok: true },
    };
    const justInsideTtl = {
      fetchedAt: nowMs - ttlSeconds * 1000 + 1,
      payload: { ok: true },
    };

    expect(isEnrichmentCacheEntryExpired(atBoundary, ttlSeconds, nowMs)).toBe(
      true
    );
    expect(
      isEnrichmentCacheEntryExpired(justInsideTtl, ttlSeconds, nowMs)
    ).toBe(false);
    expect(
      getValidEnrichmentCacheEntry(
        { "8.8.8.8|abuseipdb": atBoundary },
        "8.8.8.8|abuseipdb",
        ttlSeconds,
        nowMs
      )
    ).toBeNull();
    expect(
      getValidEnrichmentCacheEntry(
        { "8.8.8.8|abuseipdb": justInsideTtl },
        "8.8.8.8|abuseipdb",
        ttlSeconds,
        nowMs
      )
    ).toEqual(justInsideTtl);
  });

  it("treats TTL of zero as disabled caching", () => {
    expect(isEnrichmentCacheEntryExpired(entry, 0, nowMs)).toBe(true);
    expect(
      pruneExpiredEnrichmentCacheEntries(
        { "8.8.8.8|abuseipdb": entry },
        0,
        nowMs
      )
    ).toEqual({});
  });

  it("prunes only expired entries from a record", () => {
    const fresh = { fetchedAt: nowMs - 1_000, payload: { ok: true } };
    const stale = { fetchedAt: nowMs - 7200_000, payload: { ok: false } };
    const cache = {
      "8.8.8.8|abuseipdb": fresh,
      "1.1.1.1|otx": stale,
    };
    expect(pruneExpiredEnrichmentCacheEntries(cache, 3600, nowMs)).toEqual({
      "8.8.8.8|abuseipdb": fresh,
    });
  });

  it("resolves per-source TTL overrides when present", () => {
    expect(resolveEnrichmentCacheTtlSeconds("abuseipdb", 3600, {})).toBe(3600);
    expect(
      resolveEnrichmentCacheTtlSeconds("otx", 3600, { otx: 120 })
    ).toBe(120);
    expect(
      resolveEnrichmentCacheTtlSeconds("urlscan", 3600, { urlscan: 900 })
    ).toBe(900);
    expect(
      resolveEnrichmentCacheTtlSeconds("abuseipdb", 3600, { otx: 120 })
    ).toBe(3600);
  });

  it("prunes entries using per-source TTL overrides", () => {
    const abuseEntry = { fetchedAt: nowMs - 90_000, payload: { a: 1 } };
    const otxEntry = { fetchedAt: nowMs - 90_000, payload: { b: 2 } };
    const cache = {
      "8.8.8.8|abuseipdb": abuseEntry,
      "8.8.8.8|otx": otxEntry,
    };

    expect(
      pruneExpiredEnrichmentCacheEntriesForSources(cache, 60, { otx: 120 }, nowMs)
    ).toEqual({
      "8.8.8.8|otx": otxEntry,
    });
  });
});

describe("enrichment cache read/write with settings TTL", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {
      [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]: 60,
    };
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a valid entry using TTL from settings", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 10_000,
        payload: { summary: "live data" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toEqual({
      fetchedAt: nowMs - 10_000,
      payload: { summary: "live data" },
    });
  });

  it("returns null when the entry is older than settings TTL", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 120_000,
        payload: { summary: "stale" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toBeNull();
  });

  it("returns null from readCachedEnrichmentSourceResult when TTL expired", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 120_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "stale summary",
        },
      },
    };

    await expect(
      readCachedEnrichmentSourceResult("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toBeNull();
  });

  it("uses a per-source TTL override when configured", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { otx: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "stale for global ttl" },
      },
      "8.8.8.8|otx": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "fresh for otx override" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toBeNull();
    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "otx", nowMs)
    ).resolves.toEqual({
      fetchedAt: nowMs - 90_000,
      payload: { summary: "fresh for otx override" },
    });
  });

  it("uses a URLScan.io per-source TTL override when configured", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { urlscan: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "example.com|otx": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "stale for global ttl" },
      },
      "example.com|urlscan": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "fresh for urlscan override" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("example.com", "otx", nowMs)
    ).resolves.toBeNull();
    await expect(
      readValidEnrichmentCacheEntry("example.com", "urlscan", nowMs)
    ).resolves.toEqual({
      fetchedAt: nowMs - 90_000,
      payload: { summary: "fresh for urlscan override" },
    });
  });

  it("uses a GreyNoise per-source TTL override when configured", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { greynoise: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|otx": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "stale for global ttl" },
      },
      "8.8.8.8|greynoise": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "fresh for greynoise override" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "otx", nowMs)
    ).resolves.toBeNull();
    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "greynoise", nowMs)
    ).resolves.toEqual({
      fetchedAt: nowMs - 90_000,
      payload: { summary: "fresh for greynoise override" },
    });
  });

  it("uses a Shodan per-source TTL override when configured", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { shodan: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|otx": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "stale for global ttl" },
      },
      "8.8.8.8|shodan": {
        fetchedAt: nowMs - 90_000,
        payload: { summary: "fresh for shodan override" },
      },
    };

    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "otx", nowMs)
    ).resolves.toBeNull();
    await expect(
      readValidEnrichmentCacheEntry("8.8.8.8", "shodan", nowMs)
    ).resolves.toEqual({
      fetchedAt: nowMs - 90_000,
      payload: { summary: "fresh for shodan override" },
    });
  });

  it("writes entries under IOC+source keys", async () => {
    await writeEnrichmentCacheEntry("8.8.8.8", "otx", {
      summary: "pulses",
    });

    const cache = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      { payload: unknown }
    >;
    expect(cache["8.8.8.8|otx"]?.payload).toEqual({ summary: "pulses" });
  });

  it("upserts by explicit cache key", async () => {
    await upsertEnrichmentCacheEntry("evil.com|otx", { tags: ["phish"] });

    const cache = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      { payload: unknown }
    >;
    expect(cache["evil.com|otx"]?.payload).toEqual({ tags: ["phish"] });
  });

  it("returns cached enrichment results with fromCache set", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 5_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "12 abuse confidence",
        },
      },
    };

    await expect(
      readCachedEnrichmentSourceResult("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
      fromCache: true,
    });
  });

  it("returns stored error and skipped enrichment results", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 5_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.ERROR,
          errorMessage: "Rate limited",
        },
      },
      "1.1.1.1|otx": {
        fetchedAt: nowMs - 2_000,
        payload: {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
          errorMessage: "Source is disabled in extension settings.",
        },
      },
    };

    await expect(
      readStoredEnrichmentSourceResult("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorMessage: "Rate limited",
    });
    await expect(
      readStoredEnrichmentSourceResult("1.1.1.1", "otx", nowMs)
    ).resolves.toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
    });
    await expect(
      readCachedEnrichmentSourceResult("8.8.8.8", "abuseipdb", nowMs)
    ).resolves.toBeNull();
  });

  it("persists error and skipped live results for tray status hints", async () => {
    await cacheEnrichmentSourceResult("8.8.8.8", "abuseipdb", {
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorMessage: "Unauthorized",
    });

    await expect(
      readStoredEnrichmentSourceResult("8.8.8.8", "abuseipdb")
    ).resolves.toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorMessage: "Unauthorized",
    });
  });

  it("persists successful live results for later cache hits", async () => {
    await cacheEnrichmentSourceResult("8.8.8.8", "otx", {
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 threat pulses",
    });

    await expect(
      readCachedEnrichmentSourceResult("8.8.8.8", "otx")
    ).resolves.toMatchObject({
      summary: "2 threat pulses",
      fromCache: true,
    });
  });

  it("persists URLScan.io live results for later cache hits", async () => {
    await cacheEnrichmentSourceResult("example.com", "urlscan", {
      sourceId: "urlscan",
      sourceLabel: "URLScan.io",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "4 urlscan results",
      tags: ["phishing"],
    });

    await expect(
      readCachedEnrichmentSourceResult("example.com", "urlscan")
    ).resolves.toMatchObject({
      sourceId: "urlscan",
      summary: "4 urlscan results",
      tags: ["phishing"],
      fromCache: true,
    });
  });

  it("trims an oversized cache on read", async () => {
    const oversized: EnrichmentCacheRecord = {};
    for (let index = 0; index < DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES + 5; index += 1) {
      oversized[`10.0.0.${index}|abuseipdb`] = {
        fetchedAt: index,
        payload: { index },
      };
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE] = oversized;

    const cache = await getEnrichmentCache();
    expect(countEnrichmentCacheEntries(cache)).toBe(
      DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES
    );
    expect(cache["10.0.0.4|abuseipdb"]).toBeUndefined();
    expect(cache[`10.0.0.${DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES + 4}|abuseipdb`]).toBeDefined();
  });

  it("evicts oldest entries when upserting beyond the max size", async () => {
    const oversized: EnrichmentCacheRecord = {};
    for (let index = 0; index < DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES; index += 1) {
      oversized[`10.0.0.${index}|abuseipdb`] = {
        fetchedAt: index,
        payload: { index },
      };
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE] = oversized;

    await upsertEnrichmentCacheEntry("fresh.example|otx", { summary: "new" }, 999_999);

    const cache = store[STORAGE_KEY_ENRICHMENT_CACHE] as EnrichmentCacheRecord;
    expect(countEnrichmentCacheEntries(cache)).toBe(
      DEFAULT_MAX_ENRICHMENT_CACHE_ENTRIES
    );
    expect(cache["fresh.example|otx"]?.payload).toEqual({ summary: "new" });
    expect(cache["10.0.0.0|abuseipdb"]).toBeUndefined();
  });

  it("does not cache already-cached results", async () => {
    await cacheEnrichmentSourceResult("1.1.1.1", "otx", {
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "cached already",
      fromCache: true,
    });

    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toBeUndefined();
  });

  it("persists error results for tray status hints", async () => {
    await cacheEnrichmentSourceResult("8.8.8.8", "abuseipdb", {
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: "rate_limited",
      errorMessage: "Rate limited.",
    });

    const cache = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      { payload: unknown }
    >;
    expect(cache["8.8.8.8|abuseipdb"]?.payload).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
    });
  });
});
