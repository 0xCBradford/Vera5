import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  attemptAutoEnrichmentFetch,
  setAutoEnrichmentFetcherForTests,
  shouldAutoFetchEnrichmentForContent,
} from "./enrichmentAutoFetch";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";

describe("enrichment auto fetch policy", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
                result[key] = true;
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });
    setAutoEnrichmentFetcherForTests(null);
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    vi.unstubAllGlobals();
  });

  it("blocks auto fetch when manual-only mode is on", async () => {
    await expect(shouldAutoFetchEnrichmentForContent()).resolves.toBe(false);
  });

  it("does not invoke a fetcher when manual-only mode is on", async () => {
    const fetcher = vi.fn();
    setAutoEnrichmentFetcherForTests(fetcher);

    const allowed = await attemptAutoEnrichmentFetch({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(allowed).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("invokes a fetcher when manual-only mode is off", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
                result[key] = false;
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });

    const fetcher = vi.fn();
    setAutoEnrichmentFetcherForTests(fetcher);

    const payload = { value: "8.8.8.8", type: IOC_TYPE.IPV4 };
    const allowed = await attemptAutoEnrichmentFetch(payload);

    expect(allowed).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(payload);
  });
});
