import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  STORAGE_KEY_ENRICHMENT_CACHE,
  STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT,
  clearEnrichmentCache,
  countEnrichmentCacheEntriesBySource,
  createEmptyEnrichmentCache,
  readEnrichmentCacheClearedAt,
} from "./cache";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
} from "./enrichmentSourceRegistry";
import {
  STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS,
  buildEnrichmentSourceOpsRows,
  buildEnrichmentSourceOpsSnapshot,
  formatEnrichmentCacheClearedAtLabel,
  formatEnrichmentSourceLastStatusLabel,
  formatEnrichmentSourceOpsCooldownLabel,
  isEnrichmentSourceOpsSnapshot,
  normalizeEnrichmentSourceLastStatusRecord,
  recordEnrichmentSourceLastStatuses,
} from "./enrichmentSourceOps";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
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

describe("enrichment source ops", () => {
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

  it("counts cache entries per source", () => {
    const cache = createEmptyEnrichmentCache();
    cache["8.8.8.8|abuseipdb"] = { fetchedAt: 1, payload: {} };
    cache["8.8.8.8|otx"] = { fetchedAt: 2, payload: {} };
    cache["1.1.1.1|abuseipdb"] = { fetchedAt: 3, payload: {} };

    expect(countEnrichmentCacheEntriesBySource(cache)).toEqual({
      abuseipdb: 2,
      otx: 1,
    });
  });

  it("normalizes last status records", () => {
    expect(
      normalizeEnrichmentSourceLastStatusRecord({
        abuseipdb: {
          status: ENRICHMENT_SOURCE_STATUS.OK,
          at: "2026-01-01T00:00:00.000Z",
          fromCache: true,
        },
        invalid: {
          status: "unknown",
          at: "2026-01-01T00:00:00.000Z",
        },
      })
    ).toEqual({
      abuseipdb: {
        status: ENRICHMENT_SOURCE_STATUS.OK,
        at: "2026-01-01T00:00:00.000Z",
        fromCache: true,
      },
    });
  });

  it("records last statuses for enrichment sources", async () => {
    await recordEnrichmentSourceLastStatuses([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        fetchedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        errorCode: "rate_limited",
        fetchedAt: "2026-01-02T00:00:01.000Z",
      },
    ]);

    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS]).toEqual({
      abuseipdb: {
        status: ENRICHMENT_SOURCE_STATUS.OK,
        at: "2026-01-02T00:00:00.000Z",
      },
      otx: {
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        at: "2026-01-02T00:00:01.000Z",
        errorCode: "rate_limited",
      },
    });
  });

  it("builds ops rows for every registered source", () => {
    const rows = buildEnrichmentSourceOpsRows({
      lastStatus: {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: {
          status: ENRICHMENT_SOURCE_STATUS.OK,
          at: "2026-01-01T00:00:00.000Z",
        },
      },
      cache: {
        "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
      },
    });

    expect(rows).toHaveLength(ENRICHMENT_SOURCE_ORDER.length);
    expect(rows[0]).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      cacheEntryCount: 1,
      lastStatus: {
        status: ENRICHMENT_SOURCE_STATUS.OK,
        at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("builds a snapshot from cache, status, and cooldown inputs", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
    };
    store[STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS] = {
      abuseipdb: {
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        at: "2026-01-01T00:00:00.000Z",
        errorCode: "rate_limited",
      },
    };
    store[STORAGE_KEY_ENRICHMENT_CACHE_CLEARED_AT] = "2026-01-01T12:00:00.000Z";

    const snapshot = await buildEnrichmentSourceOpsSnapshot({
      globalCooldownRemainingSeconds: 42,
      globalCooldownActive: true,
    });

    expect(snapshot.totalCacheEntryCount).toBe(1);
    expect(snapshot.lastCacheClearAt).toBe("2026-01-01T12:00:00.000Z");
    expect(snapshot.globalCooldownRemainingSeconds).toBe(42);
    expect(snapshot.globalCooldownActive).toBe(true);
    expect(isEnrichmentSourceOpsSnapshot(snapshot)).toBe(true);
  });

  it("formats status, cache clear, and cooldown labels", () => {
    expect(formatEnrichmentSourceLastStatusLabel(null)).toBe("No recent activity");
    expect(
      formatEnrichmentSourceLastStatusLabel({
        status: ENRICHMENT_SOURCE_STATUS.OK,
        at: "2026-01-01T00:00:00.000Z",
        fromCache: true,
      })
    ).toBe("Cached");
    expect(
      formatEnrichmentSourceLastStatusLabel({
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        at: "2026-01-01T00:00:00.000Z",
        errorCode: "rate_limited",
      })
    ).toBe("Rate limited");
    expect(formatEnrichmentCacheClearedAtLabel(null)).toBe("Never");
    expect(
      formatEnrichmentSourceOpsCooldownLabel({
        globalCooldownActive: true,
        globalCooldownRemainingSeconds: 15,
        lastCacheClearAt: null,
        totalCacheEntryCount: 0,
        sources: [],
      })
    ).toBe("Rate limit cooldown: 15s remaining");
  });

  it("records cache clear timestamps only when requested", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
    };

    await clearEnrichmentCache();
    expect(await readEnrichmentCacheClearedAt()).toBeNull();

    await clearEnrichmentCache({ recordClearTimestamp: true });
    expect(await readEnrichmentCacheClearedAt()).toMatch(/^\d{4}-/);
  });
});
