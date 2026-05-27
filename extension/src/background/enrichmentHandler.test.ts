import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY_ENRICHMENT_CACHE } from "../lib/cache";
import { enrichIocMessage } from "../lib/messages";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import * as storage from "../lib/storage";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
} from "../lib/storage";
import { clearGlobalEnrichmentCooldown } from "../lib/enrichmentCooldown";
import { handleEnrichIocMessage } from "./enrichmentHandler";

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

const enrichWithAbuseIpdb = vi.fn();
const enrichWithOtx = vi.fn();

vi.mock("../lib/abuseipdbConnector", () => ({
  ABUSEIPDB_SOURCE_ID: "abuseipdb",
  enrichWithAbuseIpdb: (...args: unknown[]) => enrichWithAbuseIpdb(...args),
}));

vi.mock("../lib/otxConnector", () => ({
  enrichWithOtx: (...args: unknown[]) => enrichWithOtx(...args),
}));

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({
      abuseipdb: true,
      otx: true,
    })),
  };
});

describe("enrichment handler", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    enrichWithAbuseIpdb.mockReset();
    enrichWithOtx.mockReset();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
  });

  it("fetches live enrichment when bypassCache is set despite a cache hit", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 5_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached summary",
        },
      },
    };

    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "live summary",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
        bypassCache: true,
      })
    );

    expect(enrichWithAbuseIpdb).toHaveBeenCalledOnce();
    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "live summary",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "live summary",
          },
        ],
      },
    });
  });

  it("returns cached enrichment without calling the connector on a cache hit", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 5_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached summary",
        },
      },
    };

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached summary",
          fromCache: true,
          fetchedAt: expect.any(String),
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "cached summary",
            fromCache: true,
            fetchedAt: expect.any(String),
          },
        ],
      },
    });
  });

  it("routes ENRICH_IOC through the AbuseIPDB connector when sourceId is abuseipdb", async () => {
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "ok",
            summary: "12 abuse confidence",
          },
        ],
      },
    });
    expect(enrichWithAbuseIpdb).toHaveBeenCalledWith({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(enrichWithOtx).not.toHaveBeenCalled();
  });

  it("rejects invalid enrich envelopes", async () => {
    const response = await handleEnrichIocMessage({ type: "ENRICH_IOC" });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });

  it("rejects enrich messages with extra page fields", async () => {
    const response = await handleEnrichIocMessage({
      type: "ENRICH_IOC",
      value: "8.8.8.8",
      iocType: "ipv4",
      pageHtml: "<html></html>",
    });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });

  it("rejects enrich messages with trailing page context", async () => {
    const response = await handleEnrichIocMessage({
      type: "ENRICH_IOC",
      value: "8.8.8.8 seen on the page",
      iocType: "ipv4",
    });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });

  it("returns skipped when the requested source is disabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: false,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4", sourceId: "abuseipdb" })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "skipped",
          errorCode: "disabled",
          errorMessage: "Source is disabled in extension settings.",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "skipped",
            errorCode: "disabled",
            errorMessage: "Source is disabled in extension settings.",
          },
        ],
      },
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(enrichWithOtx).not.toHaveBeenCalled();
  });

  it("returns skipped when no live sources are enabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: false,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "skipped",
          errorCode: "disabled",
          errorMessage: "No enrichment sources are enabled in extension settings.",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "skipped",
            errorCode: "disabled",
            errorMessage: "No enrichment sources are enabled in extension settings.",
          },
        ],
      },
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(enrichWithOtx).not.toHaveBeenCalled();
  });

  it("fetches all enabled live sources in parallel when sourceId is omitted", async () => {
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
    });
    enrichWithOtx.mockResolvedValue({
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 threat pulses",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(enrichWithAbuseIpdb).toHaveBeenCalledOnce();
    expect(enrichWithOtx).toHaveBeenCalledOnce();
    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "ok",
            summary: "12 abuse confidence",
          },
          {
            sourceId: "otx",
            sourceLabel: "OTX",
            status: "ok",
            summary: "3 threat pulses",
          },
        ],
      },
    });
  });

  it("routes ENRICH_IOC through the OTX connector when sourceId is otx", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    enrichWithOtx.mockResolvedValue({
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 threat pulses",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "otx",
      })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: "ok",
          summary: "3 threat pulses",
        },
        sources: [
          {
            sourceId: "otx",
            sourceLabel: "OTX",
            status: "ok",
            summary: "3 threat pulses",
          },
        ],
      },
    });
    expect(enrichWithOtx).toHaveBeenCalledWith({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });
});
