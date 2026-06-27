import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUrlscanSearchQuery,
  buildUrlscanSearchUrl,
  createUrlscanConnector,
  enrichWithUrlscan,
  formatUrlscanSummary,
  inspectUrlscanVendorRequest,
  mapUrlscanSearchDataToUnifiedPresentation,
  normalizeUrlscanSearchResponse,
  parseUrlscanSearchData,
  URLSCAN_SEARCH_API_URL,
} from "./urlscanConnector";
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
  TEST_FIXTURE_URLSCAN_API_KEY,
} from "./fixtureSecrets";
import { getApiKey, setApiKey, STORAGE_KEY_API_KEYS } from "./storage";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadUrlscanFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

function createUrlscanFixtureFetchMock(relativePath: string) {
  const payload = loadUrlscanFixture(relativePath);
  return vi.fn(async () =>
    Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

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

describe("URLScan.io connector normalization", () => {
  it("parses search API payloads", () => {
    expect(
      parseUrlscanSearchData({
        total: 12,
        results: [
          {
            page: { domain: "malware.testcategory.com" },
            task: { tags: ["phishing"] },
            verdicts: { tags: ["malware", "phishing"] },
          },
        ],
      })
    ).toEqual({
      total: 12,
      results: [
        {
          pageDomain: "malware.testcategory.com",
          taskTags: ["phishing"],
          verdictTags: ["malware", "phishing"],
        },
      ],
    });
  });

  it("builds summary and tags from normalized data", () => {
    expect(formatUrlscanSummary(12)).toBe("12 urlscan results");
    expect(formatUrlscanSummary(1)).toBe("1 urlscan result");
    expect(
      normalizeUrlscanSearchResponse({
        total: 2,
        results: [{ verdicts: { tags: ["phishing", "c2"] } }],
      })
    ).toEqual({
      summary: "2 urlscan results",
      tags: ["phishing", "c2"],
    });
  });

  it("maps parsed search data through unified presentation", () => {
    const data = parseUrlscanSearchData({
      total: 5,
      results: [
        {
          page: { domain: "evil.example", country: "US" },
          verdicts: { overall: { malicious: true }, tags: ["phishing"] },
        },
      ],
    });
    expect(mapUrlscanSearchDataToUnifiedPresentation(data!)).toEqual({
      summary: "5 urlscan results",
      tags: ["US", "evil.example", "malicious", "phishing"],
    });
  });

  it("builds search queries for URL and domain IOC types only", () => {
    expect(buildUrlscanSearchQuery("domain", "example.com")).toBe(
      "domain:example.com"
    );
    expect(
      buildUrlscanSearchQuery("url", "https://example.com/login")
    ).toBe('page.url:"https://example.com/login"');
    expect(buildUrlscanSearchQuery("ipv4", "8.8.8.8")).toBeNull();
    expect(
      buildUrlscanSearchQuery(
        "sha256",
        "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
      )
    ).toBeNull();
    expect(buildUrlscanSearchQuery("cve", "CVE-2021-44228")).toBeNull();
  });

  it("builds search URLs with encoded query parameters", () => {
    const url = buildUrlscanSearchUrl("domain", "example.com");
    expect(url).toContain(URLSCAN_SEARCH_API_URL);
    expect(url).toContain("q=domain%3Aexample.com");
    expect(url).toContain("size=5");
  });
});

describe("URLScan.io connector enrich", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing-key when storage has no URLScan.io key", async () => {
    stubChromeStorage({});
    const result = await enrichWithUrlscan({
      value: "example.com",
      type: "domain",
    });
    expect(result).toMatchObject({
      sourceId: "urlscan",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your URLScan.io API key in Vera5 Settings to load enrichment.",
    });
  });

  it("loads the API key from storage and sends only the indicator value", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "API-Key": TEST_FIXTURE_URLSCAN_API_KEY,
      });
      return new Response(
        JSON.stringify({
          total: 3,
          results: [{ verdicts: { tags: ["malware"] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      { fetch: fetchMock as typeof fetch }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestUrl).toContain("urlscan.io/api/v1/search/");
    expect(requestUrl).toContain("q=domain%3Aexample.com");
    expect(requestUrl).not.toContain(TEST_FIXTURE_URLSCAN_API_KEY);
    expect(inspectUrlscanVendorRequest(requestUrl, requestInit)).toEqual({
      searchQuery: "domain:example.com",
      hasRequestBody: false,
    });
    expect(requestInit?.method).toBe("GET");
    expect(requestInit?.body).toBeUndefined();
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 urlscan results",
      tags: ["malware"],
    });
    expect(result.rawVendorJson).toContain("total");
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_URLSCAN_API_KEY);
    expect(isEnrichmentSourceResult(result)).toBe(true);
    await expect(getApiKey("urlscan")).resolves.toBe(TEST_FIXTURE_URLSCAN_API_KEY);
  });

  it("enriches URL indicators with defanged scheme normalization", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total: 1,
        results: [{ verdicts: { tags: ["phishing"] } }],
      })
    );
    const result = await enrichWithUrlscan(
      { value: "hxxps://evil.example/path", type: "url" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      encodeURIComponent('page.url:"https://evil.example/path"')
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 urlscan result",
      tags: ["phishing"],
    });
  });

  it("returns zero-result summaries without treating them as errors", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total: 0,
        results: [],
      })
    );
    const result = await enrichWithUrlscan(
      { value: "clean.example", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "0 urlscan results",
    });
    expect(result.tags).toBeUndefined();
  });

  it("rejects values with appended page context", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithUrlscan(
      { value: "example.com malicious traffic on page", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps HTTP 401 to unauthorized", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "URLScan.io rejected the API key.",
    });
  });

  it("maps HTTP 429 to rate limited", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "URLScan.io rate limit reached. Back off before retrying.",
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
            "X-Rate-Limit-Remaining": "0",
          },
        })
    );
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result.errorMessage).toBe(
      "URLScan.io rate limit reached. Back off before retrying."
    );
    expect(result.retryHint).toBe("Retry after 120 seconds.");
  });

  it("maps HTTP 403 to unauthorized", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "URLScan.io rejected the API key.",
    });
  });

  it("maps HTTP 408 to timeout", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 408 }));
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "URLScan.io request timed out.",
    });
  });

  it("maps abort errors to timeout", async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    });
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "URLScan.io request timed out.",
    });
  });

  it("skips unsupported indicator types", async () => {
    const fetchMock = vi.fn();
    const unsupportedCases = [
      { value: "CVE-2021-44228", type: "cve" as const },
      { value: "8.8.8.8", type: "ipv4" as const },
      {
        value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        type: "sha256" as const,
      },
    ];

    for (const ioc of unsupportedCases) {
      const result = await enrichWithUrlscan(ioc, {
        getApiKey: async () => TEST_FIXTURE_CONFIGURED_API_KEY,
        fetch: fetchMock as typeof fetch,
      });
      expect(result).toMatchObject({
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
        errorMessage: "URLScan.io does not support this indicator type.",
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("URLScan.io connector enrich with vendor fixtures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("enriches domain IOCs using search-domain-results.json", async () => {
    const fetchMock = createUrlscanFixtureFetchMock(
      "urlscan/search-domain-results.json"
    );
    const result = await enrichWithUrlscan(
      { value: "malware.testcategory.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=domain%3A");
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 urlscan results",
      tags: ["DE", "malware.testcategory.com", "malicious", "malware", "phishing"],
    });
    expect(result.rawVendorJson).toContain('"total": 12');
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("enriches URL IOCs using search-url-results.json", async () => {
    const fetchMock = createUrlscanFixtureFetchMock(
      "urlscan/search-url-results.json"
    );
    const result = await enrichWithUrlscan(
      { value: "https://evil.example/path", type: "url" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("page.url");
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 urlscan result",
      tags: ["evil.example", "suspicious"],
    });
  });

  it("returns zero-result summaries from search-empty-total.json", async () => {
    const fetchMock = createUrlscanFixtureFetchMock(
      "urlscan/search-empty-total.json"
    );
    const result = await enrichWithUrlscan(
      { value: "clean.example", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "0 urlscan results",
    });
    expect(result.tags).toBeUndefined();
  });

  it("maps search-malformed.json to vendor_error", async () => {
    const fetchMock = createUrlscanFixtureFetchMock("urlscan/search-malformed.json");
    const result = await enrichWithUrlscan(
      { value: "example.com", type: "domain" },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "URLScan.io returned an unexpected response.",
    });
  });
});

describe("URLScan.io connector factory", () => {
  it("exposes enrich and healthCheck through the connector interface", async () => {
    const connector = createUrlscanConnector({
      getApiKey: async () => TEST_FIXTURE_CONFIGURED_API_KEY,
    });
    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("urlscan");
    await expect(connector.healthCheck()).resolves.toEqual({
      status: "ok",
    });
  });

  it("persists API keys under the urlscan storage slot", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("urlscan", TEST_FIXTURE_URLSCAN_API_KEY);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      urlscan: TEST_FIXTURE_URLSCAN_API_KEY,
    });
    vi.unstubAllGlobals();
  });
});
