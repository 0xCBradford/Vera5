import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOtxIndicatorUrl,
  createOtxConnector,
  enrichWithOtx,
  formatOtxSummary,
  inspectOtxVendorRequest,
  normalizeOtxIndicatorResponse,
  OTX_INDICATORS_API_BASE,
  parseOtxPulseInfo,
} from "./otxConnector";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  isEnrichmentConnector,
  isEnrichmentSourceResult,
} from "./enrichment";
import {
  TEST_FIXTURE_CONFIGURED_API_KEY,
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_INVALID_API_KEY,
  TEST_FIXTURE_OTX_API_KEY,
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

describe("OTX connector normalization", () => {
  it("parses pulse_info from indicator payloads", () => {
    expect(
      parseOtxPulseInfo({
        indicator: "8.8.8.8",
        pulse_info: {
          count: 3,
          pulses: [{ name: "Test pulse", tags: ["malware", "scanner"] }],
        },
      })
    ).toEqual({
      count: 3,
      pulses: [{ name: "Test pulse", tags: ["malware", "scanner"] }],
    });
  });

  it("builds summary and tags from normalized data", () => {
    expect(formatOtxSummary(3)).toBe("3 threat pulses");
    expect(formatOtxSummary(1)).toBe("1 threat pulse");
    expect(
      normalizeOtxIndicatorResponse({
        pulse_info: {
          count: 2,
          pulses: [{ tags: ["phishing", "c2"] }],
        },
      })
    ).toEqual({
      summary: "2 threat pulses",
      tags: ["phishing", "c2"],
    });
  });

  it("builds indicator URLs for MVP IOC types", () => {
    expect(buildOtxIndicatorUrl("ipv4", "8.8.8.8")).toBe(
      `${OTX_INDICATORS_API_BASE}/IPv4/8.8.8.8`
    );
    expect(buildOtxIndicatorUrl("domain", "example.com")).toBe(
      `${OTX_INDICATORS_API_BASE}/domain/example.com`
    );
    expect(
      buildOtxIndicatorUrl("url", "https://example.com/login")
    ).toBe(
      `${OTX_INDICATORS_API_BASE}/URL/${encodeURIComponent("https://example.com/login")}`
    );
    expect(
      buildOtxIndicatorUrl(
        "sha256",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      )
    ).toBe(
      `${OTX_INDICATORS_API_BASE}/file/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
    );
    expect(buildOtxIndicatorUrl("cve", "CVE-2021-44228")).toBe(
      `${OTX_INDICATORS_API_BASE}/CVE/CVE-2021-44228`
    );
  });
});

describe("OTX connector enrich", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing-key when storage has no OTX key", async () => {
    stubChromeStorage({});
    const result = await enrichWithOtx({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(result).toMatchObject({
      sourceId: "otx",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage: "Add your OTX API key in Vera5 Settings to load enrichment.",
    });
  });

  it("loads the API key from storage and sends only the indicator value", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("otx", TEST_FIXTURE_OTX_API_KEY);

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "X-OTX-API-KEY": TEST_FIXTURE_OTX_API_KEY,
      });
      return new Response(
        JSON.stringify({
          indicator: "8.8.8.8",
          pulse_info: {
            count: 3,
            pulses: [{ tags: ["malware", "scanner"] }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      { fetch: fetchMock as typeof fetch }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestUrl).toBe(`${OTX_INDICATORS_API_BASE}/IPv4/8.8.8.8`);
    expect(requestUrl).not.toContain(TEST_FIXTURE_OTX_API_KEY);
    expect(inspectOtxVendorRequest(requestUrl, requestInit)).toEqual({
      indicatorPath: "IPv4/8.8.8.8",
      hasRequestBody: false,
    });
    expect(requestInit?.method).toBe("GET");
    expect(requestInit?.body).toBeUndefined();
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 threat pulses",
      tags: ["malware", "scanner"],
    });
    expect(result.rawVendorJson).toContain("pulse_info");
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_OTX_API_KEY);
    expect(isEnrichmentSourceResult(result)).toBe(true);
    await expect(getApiKey("otx")).resolves.toBe(TEST_FIXTURE_OTX_API_KEY);
  });

  it("enriches domain indicators", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        pulse_info: { count: 1, pulses: [{ tags: ["phishing"] }] },
      })
    );
    const result = await enrichWithOtx(
      { value: "example.com", type: "domain" },
      { getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY, fetch: fetchMock as typeof fetch }
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${OTX_INDICATORS_API_BASE}/domain/example.com`
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 threat pulse",
      tags: ["phishing"],
    });
  });

  it("rejects values with appended page context", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithOtx(
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
    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "OTX rejected the API key.",
    });
  });

  it("maps HTTP 429 to rate limited", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "OTX rate limit reached. Back off before retrying.",
      retryHint: "Try again later.",
    });
  });

  it("includes retry hint from rate limit headers on HTTP 429", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
    );
    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result.retryHint).toBe("Retry after 60 seconds.");
  });

  it("maps abort errors to timeout", async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    });
    const result = await enrichWithOtx(
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

  it("maps network failures to network_error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Network unreachable");
    });
    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "OTX request failed.",
    });
  });

  it("maps unexpected payloads to vendor_error", async () => {
    const fetchMock = vi.fn(async () => Response.json({}, { status: 200 }));
    const result = await enrichWithOtx(
      { value: "8.8.8.8", type: "ipv4" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "OTX returned an unexpected response.",
    });
  });

  it("exposes an EnrichmentConnector with healthCheck", async () => {
    const connector = createOtxConnector({
      getApiKey: async () => TEST_FIXTURE_CONFIGURED_API_KEY,
    });
    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("otx");
    await expect(connector.healthCheck?.()).resolves.toEqual({ status: "ok" });
  });
});

describe("OTX connector storage integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the configured key slot from chrome.storage.local", async () => {
    const store: Record<string, unknown> = {
      [STORAGE_KEY_API_KEYS]: { otx: "stored-otx-key" },
    };
    stubChromeStorage(store);
    await expect(getApiKey("otx")).resolves.toBe("stored-otx-key");
  });
});
