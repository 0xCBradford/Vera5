import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "../lib/enrichment";
import { enrichIocMessage } from "../lib/messages";
import * as storage from "../lib/storage";
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
    stubChromeStorage(store);
    await storage.setApiKey("abuseipdb", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
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
    await storage.setApiKey("otx", "test-otx-key");

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
    await storage.setApiKey("otx", "test-otx-key");

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
    await storage.setApiKey("otx", "test-otx-key");

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
});
