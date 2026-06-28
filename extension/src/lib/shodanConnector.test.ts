import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildShodanApiUrl,
  checkShodanHealth,
  createShodanConnector,
  enrichWithShodan,
  inspectShodanVendorRequest,
  normalizeShodanDomainResponse,
  normalizeShodanHostResponse,
  parseShodanDomainData,
  parseShodanHostData,
  resolveShodanResourcePath,
  SHODAN_API_BASE_URL,
  SHODAN_UNSUPPORTED_TYPE_MESSAGE,
  shodanLiveSupportsIocType,
} from "./shodanConnector";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  isEnrichmentConnector,
  isEnrichmentSourceResult,
} from "./enrichment";
import {
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_INVALID_API_KEY,
} from "./fixtureSecrets";
import { getApiKey, setApiKey } from "./storage";
import { IOC_TYPE } from "./iocRegex";

const SAMPLE_HOST_PAYLOAD = {
  ip_str: "8.8.8.8",
  country_code: "US",
  org: "Google LLC",
  data: [
    { port: 443, transport: "tcp", product: "nginx", _shodan: { module: "https" } },
    { port: 53, transport: "udp", product: "DNS" },
  ],
};

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

describe("Shodan connector normalization", () => {
  it("supports IPv4 host and domain lookups only", () => {
    expect(shodanLiveSupportsIocType(IOC_TYPE.IPV4)).toBe(true);
    expect(shodanLiveSupportsIocType(IOC_TYPE.DOMAIN)).toBe(true);
    expect(shodanLiveSupportsIocType(IOC_TYPE.URL)).toBe(false);
    expect(shodanLiveSupportsIocType(IOC_TYPE.SHA256)).toBe(false);
    expect(shodanLiveSupportsIocType(IOC_TYPE.CVE)).toBe(false);
  });

  it("builds host and domain API URLs with query key auth", () => {
    expect(resolveShodanResourcePath(IOC_TYPE.IPV4, "8.8.8.8")).toEqual({
      collection: "host",
      resourceId: "8.8.8.8",
    });
    expect(resolveShodanResourcePath(IOC_TYPE.DOMAIN, "Example.COM")).toEqual({
      collection: "domain",
      resourceId: "example.com",
    });
    expect(buildShodanApiUrl(IOC_TYPE.IPV4, "8.8.8.8", TEST_FIXTURE_GENERIC_API_KEY)).toBe(
      `${SHODAN_API_BASE_URL}/shodan/host/8.8.8.8?key=${encodeURIComponent(TEST_FIXTURE_GENERIC_API_KEY)}`
    );
    expect(buildShodanApiUrl(IOC_TYPE.DOMAIN, "example.com", TEST_FIXTURE_GENERIC_API_KEY)).toBe(
      `${SHODAN_API_BASE_URL}/dns/domain/example.com?key=${encodeURIComponent(TEST_FIXTURE_GENERIC_API_KEY)}`
    );
  });

  it("normalizes host service payloads", () => {
    expect(normalizeShodanHostResponse(SAMPLE_HOST_PAYLOAD)).toEqual({
      summary: "2 open services",
      tags: ["US", "Google LLC", "nginx", "https", "443/tcp"],
    });
    expect(parseShodanHostData({ ports: [80, 443], country_code: "DE" })).toMatchObject({
      openServiceCount: 2,
      countryCode: "DE",
    });
  });

  it("normalizes domain DNS payloads", () => {
    expect(
      normalizeShodanDomainResponse({
        domain: "example.com",
        subdomains: ["www", "mail"],
        tags: ["cdn"],
        data: [{ subdomain: "", type: "A", value: "93.184.216.34" }],
      })
    ).toEqual({
      summary: "2 subdomains",
      tags: ["cdn"],
    });
    expect(parseShodanDomainData({ data: [{ type: "MX", value: "smtp.example.com" }] })).toMatchObject({
      subdomainCount: 0,
      dnsRecordCount: 1,
    });
  });

  it("inspects vendor requests without bodies", () => {
    const url = buildShodanApiUrl(IOC_TYPE.IPV4, "8.8.8.8", TEST_FIXTURE_GENERIC_API_KEY)!;
    expect(
      inspectShodanVendorRequest(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
    ).toEqual({
      resourcePath: "shodan/host/8.8.8.8",
      hasRequestBody: false,
    });
  });
});

describe("Shodan connector enrich", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing-key when storage has no Shodan key", async () => {
    stubChromeStorage({});
    const result = await enrichWithShodan({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your Shodan API key in Vera5 Settings to load enrichment.",
    });
  });

  it("skips unsupported indicator types without calling the vendor", async () => {
    const fetchMock = vi.fn();
    const unsupportedCases = [
      { value: "https://example.com/path", type: IOC_TYPE.URL },
      { value: "d41d8cd98f00b204e9800998ecf8427e", type: IOC_TYPE.MD5 },
      {
        value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        type: IOC_TYPE.SHA256,
      },
      { value: "CVE-2021-44228", type: IOC_TYPE.CVE },
    ];

    for (const ioc of unsupportedCases) {
      const result = await enrichWithShodan(ioc, {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      });

      expect(result).toMatchObject({
        sourceId: "shodan",
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
        errorMessage: SHODAN_UNSUPPORTED_TYPE_MESSAGE,
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the API key from storage and enriches IPv4 host indicators", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("shodan", TEST_FIXTURE_GENERIC_API_KEY);

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        `${SHODAN_API_BASE_URL}/shodan/host/8.8.8.8?key=${encodeURIComponent(TEST_FIXTURE_GENERIC_API_KEY)}`
      );
      expect(init).toMatchObject({
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      return Response.json(SAMPLE_HOST_PAYLOAD, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      { fetch: fetchMock as typeof fetch }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(inspectShodanVendorRequest(String(fetchMock.mock.calls[0]?.[0]), fetchMock.mock.calls[0]?.[1] as RequestInit)).toEqual({
      resourcePath: "shodan/host/8.8.8.8",
      hasRequestBody: false,
    });
    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 open services",
      tags: ["US", "Google LLC", "nginx", "https", "443/tcp"],
    });
    expect(result.rawVendorJson).toContain("ip_str");
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_GENERIC_API_KEY);
    expect(isEnrichmentSourceResult(result)).toBe(true);
    await expect(getApiKey("shodan")).resolves.toBe(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("enriches domain indicators via the DNS domain API", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(
        `${SHODAN_API_BASE_URL}/dns/domain/example.com?key=${encodeURIComponent(TEST_FIXTURE_GENERIC_API_KEY)}`
      );
      return Response.json(
        {
          domain: "example.com",
          subdomains: ["www", "api"],
          tags: ["cloud"],
          data: [{ subdomain: "", type: "A", value: "93.184.216.34" }],
        },
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await enrichWithShodan(
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 subdomains",
      tags: ["cloud"],
    });
  });

  it("rejects values with appended page context", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithShodan(
      { value: "8.8.8.8 malicious traffic on page", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps HTTP 401 to unauthorized", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 401 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Shodan rejected the API key.",
    });
  });

  it("maps HTTP 403 to unauthorized", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 403 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Shodan rejected the API key.",
    });
  });

  it("maps HTTP 429 to rate limited with retry hint", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(
          async () =>
            new Response("", {
              status: 429,
              headers: { "Retry-After": "60" },
            })
        ) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "Shodan rate limit reached. Back off before retrying.",
      retryHint: "Retry after 60 seconds.",
    });
  });

  it("maps HTTP 404 to vendor error", async () => {
    const result = await enrichWithShodan(
      { value: "203.0.113.10", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 404 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Shodan has no report for this indicator.",
    });
  });

  it("maps unexpected HTTP statuses to vendor errors", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 503 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Shodan returned HTTP 503.",
    });
  });

  it("surfaces unexpected success payloads as vendor errors", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => Response.json({}, { status: 200 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Shodan returned an unexpected response.",
    });
  });

  it("surfaces request timeouts", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(
          async () =>
            new Promise<Response>((_resolve, reject) => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            })
        ) as typeof fetch,
        timeoutMs: 1,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "Shodan request timed out.",
    });
  });

  it("surfaces network failures", async () => {
    const result = await enrichWithShodan(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => {
          throw new Error("network down");
        }) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "shodan",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "Shodan request failed.",
    });
  });
});

describe("Shodan connector interface", () => {
  it("exports a valid enrichment connector and health check", async () => {
    const connector = createShodanConnector({
      getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
      fetch: vi.fn(async () =>
        Response.json(SAMPLE_HOST_PAYLOAD, { status: 200 })
      ) as typeof fetch,
    });

    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("shodan");

    const result = await connector.enrich({ value: "8.8.8.8", type: IOC_TYPE.IPV4 });
    expect(isEnrichmentSourceResult(result)).toBe(true);
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 open services",
    });

    await expect(
      checkShodanHealth({ getApiKey: async () => "" })
    ).resolves.toMatchObject({
      status: "error",
      message: "Shodan API key is not configured.",
    });
    await expect(
      checkShodanHealth({ getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY })
    ).resolves.toMatchObject({
      status: "ok",
    });
  });
});
