import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "../lib/enrichment";
import { STORAGE_KEY_ENRICHMENT_CACHE } from "../lib/cache";
import { enrichIocMessage } from "../lib/messages";
import * as storage from "../lib/storage";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
} from "../lib/storage";
import { clearGlobalEnrichmentCooldown } from "../lib/enrichmentCooldown";
import {
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_OTX_API_KEY,
  TEST_FIXTURE_URLSCAN_API_KEY,
} from "../lib/fixtureSecrets";
import { handleEnrichIocMessage } from "./enrichmentHandler";

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({ abuseipdb: true })),
  };
});

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

function successPayload() {
  return {
    data: {
      ipAddress: "8.8.8.8",
      abuseConfidenceScore: 42,
      countryCode: "US",
      usageType: "Fixed Line ISP",
    },
  };
}

describe("enrichment handler with mocked fetch", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockReset();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
    });
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    await storage.setApiKey("abuseipdb", TEST_FIXTURE_GENERIC_API_KEY);
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("removes cached entries for the IOC when bypassCache is set", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 10_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "99 abuse confidence",
        },
      },
      "8.8.8.8|otx": {
        fetchedAt: nowMs - 10_000,
        payload: {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "2 threat pulses",
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(successPayload(), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4", bypassCache: true })
    );

    const remaining = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<
      string,
      { payload: { summary?: string } }
    >;
    expect(Object.keys(remaining)).toEqual(["8.8.8.8|abuseipdb"]);
    expect(remaining["8.8.8.8|abuseipdb"]?.payload.summary).toBe(
      "42 abuse confidence"
    );
  });

  it("fetches live data when bypassCache is set despite a valid cache entry", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 10_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "99 abuse confidence",
          tags: ["US"],
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(successPayload(), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4", bypassCache: true })
    );

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source.summary).toBe("42 abuse confidence");
    expect(source.fromCache).toBeUndefined();
  });

  it("returns cached enrichment without calling fetch on a valid cache hit", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 10_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "99 abuse confidence",
          tags: ["US"],
        },
      },
    };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "99 abuse confidence",
      fromCache: true,
    });
  });

  it("refetches only sources whose cache expired under per-source TTL", async () => {
    const nowMs = Date.now();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { otx: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 90_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "stale abuse",
        },
      },
      "8.8.8.8|otx": {
        fetchedAt: nowMs - 90_000,
        payload: {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached pulses",
        },
      },
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes("abuseipdb.com")) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      return Response.json(successPayload(), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.ok).toBe(true);
    const payload = (response as {
      ok: true;
      payload: { sources: Record<string, unknown>[] };
    }).payload;
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "abuseipdb",
          summary: "42 abuse confidence",
        }),
        expect.objectContaining({
          sourceId: "otx",
          summary: "cached pulses",
          fromCache: true,
        }),
      ])
    );
    const abuse = payload.sources.find(
      (source) => source.sourceId === "abuseipdb"
    );
    expect(abuse?.fromCache).toBeUndefined();
  });

  it("fetches live data when the cache entry is expired", async () => {
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 120_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "stale cache",
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(successPayload(), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source.summary).toBe("42 abuse confidence");
    expect(source.fromCache).toBeUndefined();
  });

  it("uses cache for one source and fetches the other in parallel", async () => {
    const nowMs = Date.now();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": {
        fetchedAt: nowMs - 5_000,
        payload: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "cached abuse confidence",
        },
      },
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("otx.alienvault.com")) {
        return Response.json(
          { pulse_info: { count: 1, pulses: [{ tags: ["scanner"] }] } },
          { status: 200 }
        );
      }
      return Response.json(successPayload(), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("otx.alienvault.com");
    expect(response.ok).toBe(true);
    const payload = (response as { ok: true; payload: { sources: Record<string, unknown>[] } })
      .payload;
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "abuseipdb",
          summary: "cached abuse confidence",
          fromCache: true,
        }),
        expect.objectContaining({
          sourceId: "otx",
          summary: "1 threat pulse",
        }),
      ])
    );
  });

  it("returns skipped without fetch when no enrichment sources are enabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.DISABLED,
      errorMessage: "No enrichment sources are enabled in extension settings.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses OTX when AbuseIPDB is disabled but OTX is enabled for IPv4", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            pulse_info: { count: 2, pulses: [{ tags: ["scanner"] }] },
          },
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "otx",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 threat pulses",
    });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "https://otx.alienvault.com/api/v1/indicators/IPv4/8.8.8.8"
    );
  });

  it("returns normalized enrichment when mocked fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(successPayload(), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "42 abuse confidence",
          tags: ["US", "Fixed Line ISP"],
          fetchedAt: expect.any(String),
          rawVendorJson: expect.stringContaining("abuseConfidenceScore"),
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "42 abuse confidence",
            tags: ["US", "Fixed Line ISP"],
            fetchedAt: expect.any(String),
            rawVendorJson: expect.stringContaining("abuseConfidenceScore"),
          },
        ],
      },
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("fetches enabled live sources in parallel with Promise.allSettled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(successPayload(), { status: 200 });
      }
      return Response.json(
        {
          pulse_info: { count: 4, pulses: [{ tags: ["scanner"] }] },
        },
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.ok).toBe(true);
    const payload = (response as { ok: true; payload: { sources: unknown[] } })
      .payload;
    expect(payload.sources).toHaveLength(2);
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "abuseipdb",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "42 abuse confidence",
        }),
        expect.objectContaining({
          sourceId: "otx",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "4 threat pulses",
        }),
      ])
    );
    const primary = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(primary.sourceId).toBe("abuseipdb");
  });

  it("surfaces HTTP 401 from mocked fetch as unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: unknown } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "AbuseIPDB rejected the API key.",
    });
  });

  it("blocks further enrichment while global cooldown is active", async () => {
    clearGlobalEnrichmentCooldown();
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "Retry-After": "120" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const second = await handleEnrichIocMessage(
      enrichIocMessage({ value: "1.1.1.1", iocType: "ipv4" })
    );
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const source = (
      second as { ok: true; payload: { source: Record<string, unknown> } }
    ).payload.source;
    expect(source.errorMessage).toBe(
      "Threat intelligence rate limit reached. Back off before retrying."
    );
    expect(source.retryHint).toMatch(/^Retry after \d+ seconds\.$/);
  });

  it("allows manual refresh to bypass global cooldown", async () => {
    clearGlobalEnrichmentCooldown();
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "Retry-After": "120" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(fetchMock).toHaveBeenCalledOnce();

    await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        bypassCache: true,
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces HTTP 429 from mocked fetch with retry hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 429,
            headers: { "Retry-After": "90" },
          })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 90 seconds.",
    });
  });

  it("returns normalized OTX enrichment when sourceId is otx", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            indicator: "8.8.8.8",
            pulse_info: {
              count: 3,
              pulses: [{ tags: ["malware", "scanner"] }],
            },
          },
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "otx",
      })
    );

    expect(response.ok).toBe(true);
    const payload = (response as {
      ok: true;
      payload: { source: Record<string, unknown>; sources: unknown[] };
    }).payload;
    expect(payload.source).toMatchObject({
      sourceId: "otx",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 threat pulses",
    });
    expect(payload.sources).toHaveLength(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const requestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(requestUrl).toBe(
      "https://otx.alienvault.com/api/v1/indicators/IPv4/8.8.8.8"
    );
  });

  it("surfaces mocked fetch abort as timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      })
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: unknown } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "AbuseIPDB request timed out.",
    });
  });

  it("surfaces URLScan.io missing-key with actionable settings copy", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your URLScan.io API key in Vera5 Settings to load enrichment.",
    });
  });

  it("surfaces URLScan.io HTTP 401 as unauthorized through the handler", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "URLScan.io rejected the API key.",
    });
  });

  it("surfaces URLScan.io HTTP 403 as unauthorized through the handler", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 }))
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "URLScan.io rejected the API key.",
    });
  });

  it("surfaces URLScan.io HTTP 429 with retry hint through the handler", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 429,
            headers: { "Retry-After": "90" },
          })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage:
        "URLScan.io rate limit reached. Back off before retrying.",
      retryHint: "Retry after 90 seconds.",
    });
  });

  it("surfaces URLScan.io timeout through the handler", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      })
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "URLScan.io request timed out.",
    });
  });

  it("returns cached URLScan.io enrichment without calling fetch on a valid cache hit", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    const nowMs = Date.now();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "example.com|urlscan": {
        fetchedAt: nowMs - 10_000,
        payload: {
          sourceId: "urlscan",
          sourceLabel: "URLScan.io",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "5 urlscan results",
          tags: ["malicious"],
        },
      },
    };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "5 urlscan results",
      fromCache: true,
    });
  });

  it("refetches OTX when global TTL expires but keeps URLScan.io cached under per-source TTL", async () => {
    const nowMs = Date.now();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      otx: true,
      urlscan: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 60;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] = { urlscan: 300 };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "example.com|otx": {
        fetchedAt: nowMs - 90_000,
        payload: {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "stale pulses",
        },
      },
      "example.com|urlscan": {
        fetchedAt: nowMs - 90_000,
        payload: {
          sourceId: "urlscan",
          sourceLabel: "URLScan.io",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "3 urlscan results",
        },
      },
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes("otx.alienvault.com")) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      return Response.json(
        {
          indicator: "example.com",
          pulse_info: { count: 2, pulses: [{ tags: ["phishing"] }] },
        },
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "example.com", iocType: "domain" })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.ok).toBe(true);
    const payload = (response as {
      ok: true;
      payload: { sources: Record<string, unknown>[] };
    }).payload;
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "otx",
          summary: "2 threat pulses",
        }),
        expect.objectContaining({
          sourceId: "urlscan",
          summary: "3 urlscan results",
          fromCache: true,
        }),
      ])
    );
    const otx = payload.sources.find((source) => source.sourceId === "otx");
    expect(otx?.fromCache).toBeUndefined();
  });

  it("persists URLScan.io live results and serves them on a subsequent request", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      urlscan: true,
    });
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;

    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          total: 2,
          results: [{ verdicts: { tags: ["phishing"] } }],
        },
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toMatchObject({
      "example.com|urlscan": expect.objectContaining({
        payload: expect.objectContaining({
          sourceId: "urlscan",
          summary: "2 urlscan results",
        }),
      }),
    });

    fetchMock.mockClear();
    const second = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "example.com",
        iocType: "domain",
        sourceId: "urlscan",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.ok).toBe(true);
    const source = (second as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      sourceId: "urlscan",
      summary: "2 urlscan results",
      fromCache: true,
    });
  });
});

describe("enrichment pipeline regression (service worker)", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockReset();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    await storage.setApiKey("abuseipdb", TEST_FIXTURE_GENERIC_API_KEY);
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    clearGlobalEnrichmentCooldown();
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("parallel multi-source → cache hit → manual refresh bypasses global cooldown", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(successPayload(), { status: 200 });
      }
      return Response.json(
        { pulse_info: { count: 2, pulses: [{ tags: ["scanner"] }] } },
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const parallel = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(parallel.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const parallelPayload = (
      parallel as { ok: true; payload: { sources: Record<string, unknown>[] } }
    ).payload;
    expect(parallelPayload.sources).toHaveLength(2);
    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toBeTruthy();

    fetchMock.mockClear();
    const cached = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(cached.ok).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThan(2);
    const cachedSources = (
      cached as { ok: true; payload: { sources: Record<string, unknown>[] } }
    ).payload.sources;
    expect(
      cachedSources.some((source) => source.fromCache === true)
    ).toBe(true);

    fetchMock.mockClear();
    const cachedRepeat = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(cachedRepeat.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const repeatSource = (
      cachedRepeat as { ok: true; payload: { source: Record<string, unknown> } }
    ).payload.source;
    expect(repeatSource.fromCache).toBe(true);

    clearGlobalEnrichmentCooldown();
    const fetchMock429 = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "Retry-After": "120" },
        })
    );
    vi.stubGlobal("fetch", fetchMock429);

    await handleEnrichIocMessage(
      enrichIocMessage({ value: "9.9.9.9", iocType: "ipv4" })
    );
    const fetchCountAfterRateLimit = fetchMock429.mock.calls.length;
    expect(fetchCountAfterRateLimit).toBeGreaterThan(0);

    const blocked = await handleEnrichIocMessage(
      enrichIocMessage({ value: "1.1.1.1", iocType: "ipv4" })
    );
    expect(blocked.ok).toBe(true);
    expect(fetchMock429.mock.calls.length).toBe(fetchCountAfterRateLimit);
    const blockedSource = (
      blocked as { ok: true; payload: { source: Record<string, unknown> } }
    ).payload.source;
    expect(blockedSource.errorMessage).toBe(
      "Threat intelligence rate limit reached. Back off before retrying."
    );

    fetchMock429.mockClear();
    fetchMock429.mockImplementation(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(successPayload(), { status: 200 });
      }
      return Response.json(
        { pulse_info: { count: 2, pulses: [{ tags: ["scanner"] }] } },
        { status: 200 }
      );
    });

    await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        bypassCache: true,
      })
    );
    expect(fetchMock429.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("IOC-only vendor request security regression", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockReset();
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
    });
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    await storage.setApiKey("abuseipdb", TEST_FIXTURE_GENERIC_API_KEY);
    clearGlobalEnrichmentCooldown();
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("uses GET without a request body and sends only the sanitized IPv4 in the URL", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(successPayload(), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.method).toBe("GET");
    expect(requestInit?.body).toBeUndefined();
    expect(requestUrl.searchParams.get("ipAddress")).toBe("8.8.8.8");
    expect(String(requestUrl)).not.toMatch(/page|html|<script/i);
  });

  it("does not call vendor fetch when the enrich message contains page snippets", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage({
      type: "ENRICH_IOC",
      value: "8.8.8.8 malicious page excerpt",
      iocType: "ipv4",
    });

    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("disabled source and partial success regression", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockReset();
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    clearGlobalEnrichmentCooldown();
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("skips a disabled requested source without calling vendor fetch", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: false,
      otx: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
      })
    );

    expect(response.ok).toBe(true);
    const source = (
      response as { ok: true; payload: { source: Record<string, unknown> } }
    ).payload.source;
    expect(source).toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.DISABLED,
      errorMessage: "Source is disabled in extension settings.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches only enabled live sources when the other source is disabled", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: false,
    });
    await storage.setApiKey("abuseipdb", TEST_FIXTURE_GENERIC_API_KEY);
    const fetchMock = vi.fn(async () =>
      Response.json(successPayload(), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("abuseipdb.com");
    const sources = (
      response as { ok: true; payload: { sources: Record<string, unknown>[] } }
    ).payload.sources;
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.OK,
    });
  });

  it("returns partial success when one live source succeeds and another errors", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      abuseipdb: true,
      otx: true,
    });
    await storage.setApiKey("abuseipdb", TEST_FIXTURE_GENERIC_API_KEY);
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(successPayload(), { status: 200 });
      }
      return new Response("", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.ok).toBe(true);
    const payload = (
      response as {
        ok: true;
        payload: {
          source: Record<string, unknown>;
          sources: Record<string, unknown>[];
        };
      }
    ).payload;
    expect(payload.source).toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "42 abuse confidence",
    });
    expect(payload.sources).toHaveLength(2);
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "abuseipdb",
          status: ENRICHMENT_SOURCE_STATUS.OK,
        }),
        expect.objectContaining({
          sourceId: "otx",
          status: ENRICHMENT_SOURCE_STATUS.ERROR,
          errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        }),
      ])
    );
  });

  it("returns partial success when OTX succeeds and URLScan.io rate limits on domain enrichment", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      otx: true,
      urlscan: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("otx.alienvault.com")) {
        return Response.json(
          {
            indicator: "example.com",
            pulse_info: { count: 2, pulses: [{ tags: ["phishing"] }] },
          },
          { status: 200 }
        );
      }
      if (url.includes("urlscan.io")) {
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "example.com", iocType: "domain" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.ok).toBe(true);
    const payload = (
      response as {
        ok: true;
        payload: {
          source: Record<string, unknown>;
          sources: Record<string, unknown>[];
        };
      }
    ).payload;
    expect(payload.source).toMatchObject({
      sourceId: "otx",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 threat pulses",
    });
    expect(payload.sources).toHaveLength(2);
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "otx",
          status: ENRICHMENT_SOURCE_STATUS.OK,
        }),
        expect.objectContaining({
          sourceId: "urlscan",
          status: ENRICHMENT_SOURCE_STATUS.ERROR,
          errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        }),
      ])
    );
  });

  it("returns partial success when URLScan.io succeeds and OTX rate limits on domain enrichment", async () => {
    vi.mocked(storage.getEnrichmentSourceEnabled).mockResolvedValue({
      otx: true,
      urlscan: true,
    });
    await storage.setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);
    await storage.setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("urlscan.io")) {
        return Response.json(
          {
            total: 3,
            results: [{ verdicts: { tags: ["malicious"] } }],
          },
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("otx.alienvault.com")) {
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "45" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "example.com", iocType: "domain" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.ok).toBe(true);
    const payload = (
      response as {
        ok: true;
        payload: {
          source: Record<string, unknown>;
          sources: Record<string, unknown>[];
        };
      }
    ).payload;
    expect(payload.source).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 urlscan results",
    });
    expect(payload.sources).toHaveLength(2);
    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "urlscan",
          status: ENRICHMENT_SOURCE_STATUS.OK,
        }),
        expect.objectContaining({
          sourceId: "otx",
          status: ENRICHMENT_SOURCE_STATUS.ERROR,
          errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        }),
      ])
    );
  });
});
