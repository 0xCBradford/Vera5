import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEnrichmentCache,
  countEnrichmentCacheEntries,
  createEmptyEnrichmentCache,
  getEnrichmentCache,
  normalizeEnrichmentCache,
  STORAGE_KEY_ENRICHMENT_CACHE,
} from "./cache";

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
    store = {};
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
