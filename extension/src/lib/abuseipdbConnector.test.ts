import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ABUSEIPDB_CHECK_API_URL,
  buildAbuseIpdbTags,
  createAbuseIpdbConnector,
  enrichWithAbuseIpdb,
  formatAbuseIpdbSummary,
  inspectAbuseIpdbVendorRequest,
  normalizeAbuseIpdbCheckResponse,
  parseAbuseIpdbCheckData,
} from "./abuseipdbConnector";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  isEnrichmentConnector,
  isEnrichmentSourceResult,
} from "./enrichment";
import {
  TEST_FIXTURE_ABUSEIPDB_API_KEY,
  TEST_FIXTURE_CONFIGURED_API_KEY,
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_INVALID_API_KEY,
  TEST_FIXTURE_STORED_ABUSEIPDB_API_KEY,
} from "./fixtureSecrets";
import { getApiKey, setApiKey, STORAGE_KEY_API_KEYS } from "./storage";

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

describe("AbuseIPDB connector normalization", () => {
  it("parses check API payloads", () => {
    expect(
      parseAbuseIpdbCheckData({
        data: {
          ipAddress: "8.8.8.8",
          abuseConfidenceScore: 74,
          countryCode: "US",
          usageType: "Content Delivery Network",
          totalReports: 3,
        },
      })
    ).toEqual({
      ipAddress: "8.8.8.8",
      abuseConfidenceScore: 74,
      countryCode: "US",
      usageType: "Content Delivery Network",
      totalReports: 3,
    });
  });

  it("builds summary and tags from normalized data", () => {
    const data = {
      abuseConfidenceScore: 74,
      countryCode: "de",
      usageType: "Data Center/Web Hosting/Transit",
      isp: "Example ISP",
    };
    expect(formatAbuseIpdbSummary(data)).toBe("74 abuse confidence");
    expect(buildAbuseIpdbTags(data)).toEqual([
      "DE",
      "Data Center/Web Hosting/Transit",
      "Example ISP",
    ]);
    expect(
      normalizeAbuseIpdbCheckResponse({
        data: {
          abuseConfidenceScore: 74,
          countryCode: "DE",
          usageType: "scanner",
        },
      })
    ).toEqual({
      summary: "74 abuse confidence",
      tags: ["DE", "scanner"],
    });
  });
});

describe("AbuseIPDB connector enrich", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing-key when storage has no AbuseIPDB key", async () => {
    stubChromeStorage({});
    const result = await enrichWithAbuseIpdb({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(result).toMatchObject({
      sourceId: "abuseipdb",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
    });
  });

  it("loads the API key from storage and sends only the IPv4 value", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("abuseipdb", TEST_FIXTURE_ABUSEIPDB_API_KEY);

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        Key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      });
      return new Response(
        JSON.stringify({
          data: {
            ipAddress: "8.8.8.8",
            abuseConfidenceScore: 12,
            countryCode: "US",
            usageType: "Fixed Line ISP",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      { fetch: fetchMock as typeof fetch }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestUrl.origin + requestUrl.pathname).toBe(ABUSEIPDB_CHECK_API_URL);
    expect(requestUrl.searchParams.get("ipAddress")).toBe("8.8.8.8");
    expect(requestUrl.search).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(inspectAbuseIpdbVendorRequest(requestUrl.toString(), requestInit)).toEqual({
      ipAddress: "8.8.8.8",
      hasRequestBody: false,
    });
    expect(requestInit?.method).toBe("GET");
    expect(requestInit?.body).toBeUndefined();
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
      tags: ["US", "Fixed Line ISP"],
    });
    expect(result.rawVendorJson).toContain("12");
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(isEnrichmentSourceResult(result)).toBe(true);
    await expect(getApiKey("abuseipdb")).resolves.toBe(TEST_FIXTURE_ABUSEIPDB_API_KEY);
  });

  it("skips non-IPv4 indicator types", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithAbuseIpdb(
      { value: "example.com", type: "domain" },
      { getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY, fetch: fetchMock as typeof fetch }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects IPv4 values with appended page context", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8 malicious traffic on page", type: "ipv4" },
      { getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY, fetch: fetchMock as typeof fetch }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps HTTP 401 to unauthorized", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
    });
  });

  it("maps HTTP 429 to rate limited", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Try again later.",
    });
  });

  it("includes retry hint from rate limit headers on HTTP 429", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: {
            "Retry-After": "120",
            "X-RateLimit-Remaining": "0",
          },
        })
    );
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result.errorMessage).toBe(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    expect(result.retryHint).toBe("Retry after 120 seconds.");
  });

  it("maps abort errors to timeout", async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    });
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
    });
  });

  it("maps HTTP 403 to unauthorized", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "AbuseIPDB rejected the API key.",
    });
  });

  it("maps HTTP 408 to timeout", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 408 }));
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "AbuseIPDB request timed out.",
    });
  });

  it("maps network failures from mocked fetch to network_error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Network unreachable");
    });
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "AbuseIPDB request failed.",
    });
  });

  it("maps unexpected mocked fetch payloads to vendor_error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: {} }, { status: 200 })
    );
    const result = await enrichWithAbuseIpdb(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "AbuseIPDB returned an unexpected response.",
    });
  });

  it("exposes an EnrichmentConnector with healthCheck", async () => {
    const connector = createAbuseIpdbConnector({
      getApiKey: async () => TEST_FIXTURE_CONFIGURED_API_KEY,
    });
    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("abuseipdb");
    await expect(connector.healthCheck?.()).resolves.toEqual({ status: "ok" });
  });
});

describe("AbuseIPDB connector storage integration", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the configured key slot from chrome.storage.local", async () => {
    const store: Record<string, unknown> = {
      [STORAGE_KEY_API_KEYS]: { abuseipdb: TEST_FIXTURE_STORED_ABUSEIPDB_API_KEY },
    };
    stubChromeStorage(store);
    await expect(getApiKey("abuseipdb")).resolves.toBe(TEST_FIXTURE_STORED_ABUSEIPDB_API_KEY);
  });
});
