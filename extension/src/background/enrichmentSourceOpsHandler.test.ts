import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
} from "../lib/storage";
import { handleGetEnrichmentSourceOpsMessage } from "./enrichmentSourceOpsHandler";
import { recordGlobalEnrichmentCooldown, clearGlobalEnrichmentCooldown } from "../lib/enrichmentCooldown";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === "string") {
            return Promise.resolve({ [keys]: store[keys] });
          }
          if (Array.isArray(keys)) {
            const result: Record<string, unknown> = {};
            for (const key of keys) {
              result[key] = store[key];
            }
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...store, ...keys });
        },
        set: (values: Record<string, unknown>) => {
          Object.assign(store, values);
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

describe("enrichment source ops handler", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    clearGlobalEnrichmentCooldown();
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
  });

  it("returns source ops snapshot including active cooldown", async () => {
    recordGlobalEnrichmentCooldown(45);

    const response = await handleGetEnrichmentSourceOpsMessage();

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }
    const payload = response.payload as {
      globalCooldownActive: boolean;
      globalCooldownRemainingSeconds: number;
      sources: unknown[];
    };
    expect(payload.globalCooldownActive).toBe(true);
    expect(payload.globalCooldownRemainingSeconds).toBeGreaterThan(0);
    expect(payload.sources.length).toBeGreaterThan(0);
  });
});
