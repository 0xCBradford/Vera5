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
import {
  STORAGE_KEY_INVESTIGATION_SESSIONS,
} from "../lib/investigationSessionStorage";
import { STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS } from "../lib/enrichmentSourceOps";
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
const enrichWithUrlscan = vi.fn();
const enrichWithGreynoise = vi.fn();

// Spread the real connector modules so transitively-imported consumers (e.g.
// connectorProfileExport.ts, which reads DEFAULT_*_REQUEST_TIMEOUT_MS at module
// evaluation) always find every export. Returning a partial factory here let
// those constants resolve as undefined whenever the real module was evaluated
// fresh under the mock, producing an order/cache-dependent suite flake.
vi.mock("../lib/abuseipdbConnector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/abuseipdbConnector")>();
  return {
    ...actual,
    enrichWithAbuseIpdb: (...args: unknown[]) => enrichWithAbuseIpdb(...args),
  };
});

vi.mock("../lib/otxConnector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/otxConnector")>();
  return {
    ...actual,
    enrichWithOtx: (...args: unknown[]) => enrichWithOtx(...args),
  };
});

vi.mock("../lib/urlscanConnector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/urlscanConnector")>();
  return {
    ...actual,
    enrichWithUrlscan: (...args: unknown[]) => enrichWithUrlscan(...args),
  };
});

vi.mock("../lib/greynoiseConnector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/greynoiseConnector")>();
  return {
    ...actual,
    enrichWithGreynoise: (...args: unknown[]) => enrichWithGreynoise(...args),
  };
});

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({
      abuseipdb: true,
      otx: true,
    })),
    getLocalBackendEnabled: vi.fn(async () => false),
  };
});

const requestLocalBackendEnrichment = vi.fn();

vi.mock("../lib/localBackendEnrichment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/localBackendEnrichment")>();
  return {
    ...actual,
    requestLocalBackendEnrichment: (...args: unknown[]) =>
      requestLocalBackendEnrichment(...args),
  };
});

describe("enrichment handler", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    enrichWithAbuseIpdb.mockReset();
    enrichWithOtx.mockReset();
    enrichWithUrlscan.mockReset();
    enrichWithGreynoise.mockReset();
    requestLocalBackendEnrichment.mockReset();
    vi.mocked(storage.getLocalBackendEnabled).mockResolvedValue(false);
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      urlscan: false,
      greynoise: false,
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

  it("returns explicit unsupported-type skipped rows for Phase 2 indicators", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      urlscan: false,
      greynoise: false,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "analyst@corp.example.com",
        iocType: "email",
      })
    );

    expect(response).toMatchObject({
      ok: true,
      payload: {
        sources: [
          {
            sourceId: "abuseipdb",
            status: "skipped",
            errorCode: "unsupported_type",
            errorMessage: "AbuseIPDB does not support this indicator type.",
          },
          {
            sourceId: "otx",
            status: "skipped",
            errorCode: "unsupported_type",
            errorMessage: "OTX does not support this indicator type.",
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

  it("routes ENRICH_IOC through the URLScan.io connector when sourceId is urlscan", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      urlscan: true,
    });
    enrichWithUrlscan.mockResolvedValue({
      sourceId: "urlscan",
      sourceLabel: "URLScan.io",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 urlscan results",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "urlscan",
          sourceLabel: "URLScan.io",
          status: "ok",
          summary: "3 urlscan results",
        },
        sources: [
          {
            sourceId: "urlscan",
            sourceLabel: "URLScan.io",
            status: "ok",
            summary: "3 urlscan results",
          },
        ],
      },
    });
    expect(enrichWithUrlscan).toHaveBeenCalledWith({
      value: "example.com",
      type: "domain",
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(enrichWithOtx).not.toHaveBeenCalled();
  });

  it("returns skipped when URLScan.io is disabled even if sourceId is urlscan", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      urlscan: false,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "https://example.com/login",
        iocType: "url",
        sourceId: "urlscan",
      })
    );

    expect(response).toMatchObject({
      ok: true,
      payload: {
        source: {
          sourceId: "urlscan",
          status: "skipped",
          errorCode: "disabled",
        },
      },
    });
    expect(enrichWithUrlscan).not.toHaveBeenCalled();
  });

  it("includes enabled URLScan.io in parallel domain enrichment", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: true,
      urlscan: true,
    });
    enrichWithOtx.mockResolvedValue({
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 threat pulse",
    });
    enrichWithUrlscan.mockResolvedValue({
      sourceId: "urlscan",
      sourceLabel: "URLScan.io",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 urlscan results",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "example.com", iocType: "domain" })
    );

    expect(enrichWithOtx).toHaveBeenCalledOnce();
    expect(enrichWithUrlscan).toHaveBeenCalledOnce();
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      payload: {
        sources: [
          { sourceId: "otx", status: "ok" },
          { sourceId: "urlscan", status: "ok" },
        ],
      },
    });
  });

  it("does not call URLScan.io for IPv4 when only URLScan.io is enabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: false,
      urlscan: true,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(enrichWithUrlscan).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      payload: {
        source: {
          sourceId: "urlscan",
          status: "skipped",
          errorCode: "unsupported_type",
          errorMessage: "URLScan.io does not support this indicator type.",
        },
      },
    });
  });

  it("routes ENRICH_IOC through the GreyNoise connector when sourceId is greynoise", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      greynoise: true,
    });
    enrichWithGreynoise.mockResolvedValue({
      sourceId: "greynoise",
      sourceLabel: "GreyNoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "benign RIOT service",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "greynoise",
      })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "greynoise",
          sourceLabel: "GreyNoise",
          status: "ok",
          summary: "benign RIOT service",
        },
        sources: [
          {
            sourceId: "greynoise",
            sourceLabel: "GreyNoise",
            status: "ok",
            summary: "benign RIOT service",
          },
        ],
      },
    });
    expect(enrichWithGreynoise).toHaveBeenCalledWith({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(enrichWithOtx).not.toHaveBeenCalled();
  });

  it("returns skipped when GreyNoise is disabled even if sourceId is greynoise", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
      greynoise: false,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "greynoise",
      })
    );

    expect(response).toMatchObject({
      ok: true,
      payload: {
        source: {
          sourceId: "greynoise",
          status: "skipped",
          errorCode: "disabled",
        },
      },
    });
    expect(enrichWithGreynoise).not.toHaveBeenCalled();
  });

  it("includes enabled GreyNoise in parallel IPv4 enrichment", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: true,
      greynoise: true,
    });
    enrichWithOtx.mockResolvedValue({
      sourceId: "otx",
      sourceLabel: "OTX",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 threat pulse",
    });
    enrichWithGreynoise.mockResolvedValue({
      sourceId: "greynoise",
      sourceLabel: "GreyNoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "benign RIOT service",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(enrichWithOtx).toHaveBeenCalledOnce();
    expect(enrichWithGreynoise).toHaveBeenCalledOnce();
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      payload: {
        sources: [
          { sourceId: "otx", status: "ok" },
          { sourceId: "greynoise", status: "ok" },
        ],
      },
    });
  });

  it("does not call GreyNoise for domain indicators when only GreyNoise is enabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: false,
      greynoise: true,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "example.com", iocType: "domain" })
    );

    expect(enrichWithGreynoise).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      payload: {
        source: {
          sourceId: "greynoise",
          status: "skipped",
          errorCode: "unsupported_type",
          errorMessage: "GreyNoise does not support this indicator type.",
        },
      },
    });
  });

  it("increments the active investigation session enrichment count", async () => {
    store[STORAGE_KEY_INVESTIGATION_SESSIONS] = {
      schemaVersion: 1,
      sessions: [
        {
          id: "vera5-inv-enrich-test",
          title: "Case",
          createdAt: 100,
          updatedAt: 100,
          pageUrl: "https://example.com",
          totalIocCount: 0,
          iocCountByType: {},
          enrichmentCount: 0,
          exportCount: 0,
        },
      ],
      activeSessionId: "vera5-inv-enrich-test",
    };

    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
    });

    await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    const stored = store[STORAGE_KEY_INVESTIGATION_SESSIONS] as {
      sessions: Array<{ enrichmentCount: number }>;
    };
    expect(stored.sessions[0]?.enrichmentCount).toBe(1);
  });

  it("records per-source last status after enrichment", async () => {
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    });

    await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_LAST_STATUS]).toEqual({
      abuseipdb: {
        status: ENRICHMENT_SOURCE_STATUS.OK,
        at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("routes enrichment through the local backend when the toggle is enabled", async () => {
    vi.mocked(storage.getLocalBackendEnabled).mockResolvedValue(true);
    requestLocalBackendEnrichment.mockResolvedValue({
      source: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "backend summary",
      },
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "backend summary",
        },
      ],
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(requestLocalBackendEnrichment).toHaveBeenCalledWith({
      value: "8.8.8.8",
      iocType: "ipv4",
      sourceId: "abuseipdb",
      bypassCache: false,
      enabledSources: {
        abuseipdb: true,
        otx: true,
        urlscan: false,
        greynoise: false,
      },
      cacheTtlSeconds: DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
      sourceCacheTtlSeconds: {},
    });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "backend summary",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "backend summary",
          },
        ],
      },
    });
  });

  it("surfaces backend cache hits with fromCache for cached vs live label parity", async () => {
    vi.mocked(storage.getLocalBackendEnabled).mockResolvedValue(true);
    requestLocalBackendEnrichment.mockResolvedValue({
      source: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "cached summary",
        fromCache: true,
      },
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached summary",
          fromCache: true,
        },
      ],
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
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached summary",
          fromCache: true,
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "cached summary",
            fromCache: true,
          },
        ],
      },
    });
  });

  it("falls back to extension connectors when the local backend request fails", async () => {
    vi.mocked(storage.getLocalBackendEnabled).mockResolvedValue(true);
    requestLocalBackendEnrichment.mockResolvedValue(null);
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "fallback summary",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(requestLocalBackendEnrichment).toHaveBeenCalledOnce();
    expect(enrichWithAbuseIpdb).toHaveBeenCalledOnce();
    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "fallback summary",
          retryHint:
            "Local backend unreachable. Loaded through extension connectors instead.",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "fallback summary",
            retryHint:
              "Local backend unreachable. Loaded through extension connectors instead.",
          },
        ],
      },
    });
  });
});
