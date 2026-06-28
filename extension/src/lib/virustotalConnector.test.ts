import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVirustotalApiUrl,
  checkVirustotalHealth,
  createVirustotalConnector,
  encodeVirustotalUrlId,
  enrichWithVirustotal,
  formatVirustotalDetectionSummary,
  inspectVirustotalVendorRequest,
  normalizeVirustotalResponse,
  parseVirustotalAnalysisStats,
  parseVirustotalUnifiedInput,
  resolveVirustotalResourcePath,
  virustotalLiveSupportsIocType,
  VIRUSTOTAL_API_V3_BASE,
} from "./virustotalConnector";
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

const SAMPLE_IPV4_PAYLOAD = {
  data: {
    attributes: {
      last_analysis_stats: {
        malicious: 5,
        suspicious: 2,
        harmless: 60,
        undetected: 8,
      },
      country: "US",
      as_owner: "GOOGLE",
    },
  },
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

describe("VirusTotal connector normalization", () => {
  it("tracks supported live IOC types", () => {
    expect(virustotalLiveSupportsIocType(IOC_TYPE.IPV4)).toBe(true);
    expect(virustotalLiveSupportsIocType(IOC_TYPE.DOMAIN)).toBe(true);
    expect(virustotalLiveSupportsIocType(IOC_TYPE.URL)).toBe(true);
    expect(virustotalLiveSupportsIocType(IOC_TYPE.SHA256)).toBe(true);
    expect(virustotalLiveSupportsIocType(IOC_TYPE.CVE)).toBe(false);
  });

  it("resolves resource paths for supported indicator types", () => {
    expect(resolveVirustotalResourcePath(IOC_TYPE.IPV4, "8.8.8.8")).toEqual({
      collection: "ip_addresses",
      resourceId: "8.8.8.8",
    });
    expect(resolveVirustotalResourcePath(IOC_TYPE.DOMAIN, "Example.COM")).toEqual({
      collection: "domains",
      resourceId: "example.com",
    });
    expect(resolveVirustotalResourcePath(IOC_TYPE.URL, "https://example.com/login")).toEqual({
      collection: "urls",
      resourceId: encodeVirustotalUrlId("https://example.com/login"),
    });
    expect(
      resolveVirustotalResourcePath(
        IOC_TYPE.SHA256,
        "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
      )
    ).toEqual({
      collection: "files",
      resourceId: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
    expect(resolveVirustotalResourcePath(IOC_TYPE.CVE, "CVE-2021-44228")).toBeNull();
  });

  it("builds API URLs without embedding credentials", () => {
    const url = buildVirustotalApiUrl(IOC_TYPE.IPV4, "8.8.8.8");
    expect(url).toBe(`${VIRUSTOTAL_API_V3_BASE}/ip_addresses/8.8.8.8`);
    expect(url).not.toContain(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("parses analysis stats and unified input from vendor payloads", () => {
    expect(parseVirustotalAnalysisStats(SAMPLE_IPV4_PAYLOAD)).toEqual({
      malicious: 5,
      suspicious: 2,
      harmless: 60,
      undetected: 8,
    });
    expect(parseVirustotalUnifiedInput(SAMPLE_IPV4_PAYLOAD)).toEqual({
      maliciousDetections: 5,
      suspiciousDetections: 2,
      harmlessDetections: 60,
      countryCode: "US",
      networkOwner: "GOOGLE",
    });
    expect(normalizeVirustotalResponse(SAMPLE_IPV4_PAYLOAD)).toEqual({
      summary: "5 malicious detections",
      tags: ["US", "GOOGLE"],
    });
    expect(
      formatVirustotalDetectionSummary(parseVirustotalAnalysisStats(SAMPLE_IPV4_PAYLOAD)!)
    ).toBe("5 malicious detections");
  });

  it("inspects vendor requests without bodies", () => {
    const url = buildVirustotalApiUrl(IOC_TYPE.IPV4, "8.8.8.8")!;
    expect(
      inspectVirustotalVendorRequest(url, {
        method: "GET",
        headers: { "x-apikey": TEST_FIXTURE_GENERIC_API_KEY },
      })
    ).toEqual({
      resourcePath: "ip_addresses/8.8.8.8",
      hasRequestBody: false,
    });
  });
});

describe("VirusTotal connector enrich", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing-key when storage has no VirusTotal key", async () => {
    stubChromeStorage({});
    const result = await enrichWithVirustotal({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your VirusTotal API key in Vera5 Settings to load enrichment.",
    });
  });

  it("skips unsupported indicator types without calling the vendor", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithVirustotal(
      { value: "CVE-2021-44228", type: IOC_TYPE.CVE },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      errorMessage:
        "VirusTotal live lookup supports IPv4, domain, URL, and file hashes only.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the API key from storage and enriches IPv4 indicators", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("virustotal", TEST_FIXTURE_GENERIC_API_KEY);

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "x-apikey": TEST_FIXTURE_GENERIC_API_KEY,
      });
      return Response.json(SAMPLE_IPV4_PAYLOAD, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      { fetch: fetchMock as typeof fetch }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestUrl).toBe(`${VIRUSTOTAL_API_V3_BASE}/ip_addresses/8.8.8.8`);
    expect(requestUrl).not.toContain(TEST_FIXTURE_GENERIC_API_KEY);
    expect(inspectVirustotalVendorRequest(requestUrl, requestInit)).toEqual({
      resourcePath: "ip_addresses/8.8.8.8",
      hasRequestBody: false,
    });
    expect(requestInit?.method).toBe("GET");
    expect(requestInit?.body).toBeUndefined();
    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "5 malicious detections",
      tags: ["US", "GOOGLE"],
    });
    expect(result.rawVendorJson).toContain("last_analysis_stats");
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_GENERIC_API_KEY);
    expect(isEnrichmentSourceResult(result)).toBe(true);
    await expect(getApiKey("virustotal")).resolves.toBe(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("enriches domain indicators", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          data: {
            attributes: {
              last_analysis_stats: { malicious: 1, suspicious: 0, harmless: 70 },
              country: "DE",
              registrar: "Example Registrar",
            },
          },
        },
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await enrichWithVirustotal(
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${VIRUSTOTAL_API_V3_BASE}/domains/example.com`
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "1 malicious detection",
      tags: ["DE", "Example Registrar"],
    });
  });

  it("enriches URL indicators with encoded resource ids", async () => {
    const urlValue = "https://example.com/login";
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          data: {
            attributes: {
              last_analysis_stats: { malicious: 2, suspicious: 1, harmless: 10 },
            },
          },
        },
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await enrichWithVirustotal(
      { value: urlValue, type: IOC_TYPE.URL },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toBe(
      `${VIRUSTOTAL_API_V3_BASE}/urls/${encodeURIComponent(
        encodeVirustotalUrlId(urlValue)
      )}`
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 malicious detections",
    });
  });

  it("enriches file hash indicators", async () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          data: {
            attributes: {
              last_analysis_stats: { harmless: 60, undetected: 8 },
            },
          },
        },
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await enrichWithVirustotal(
      { value: hash, type: IOC_TYPE.SHA256 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${VIRUSTOTAL_API_V3_BASE}/files/${hash}`
    );
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "60 harmless detections",
    });
  });

  it("rejects values with appended page context", async () => {
    const fetchMock = vi.fn();
    const result = await enrichWithVirustotal(
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
    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 401 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "VirusTotal rejected the API key.",
    });
  });

  it("maps HTTP 403 to unauthorized", async () => {
    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 403 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "VirusTotal rejected the API key.",
    });
  });

  it("maps HTTP 429 to rate limited with retry hint", async () => {
    const result = await enrichWithVirustotal(
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
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "VirusTotal rate limit reached. Back off before retrying.",
      retryHint: "Retry after 60 seconds.",
    });
  });

  it("maps HTTP 404 to vendor error", async () => {
    const result = await enrichWithVirustotal(
      { value: "203.0.113.10", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 404 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "VirusTotal has no report for this indicator.",
    });
  });

  it("maps unexpected HTTP statuses to vendor errors", async () => {
    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 503 })) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "VirusTotal returned HTTP 503.",
    });
  });

  it("surfaces unexpected success payloads as vendor errors", async () => {
    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () =>
          Response.json({ data: { attributes: {} } }, { status: 200 })
        ) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "VirusTotal returned an unexpected response.",
    });
  });

  it("surfaces request timeouts", async () => {
    const result = await enrichWithVirustotal(
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
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "VirusTotal request timed out.",
    });
  });

  it("surfaces network failures", async () => {
    const result = await enrichWithVirustotal(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(async () => {
          throw new Error("network down");
        }) as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "virustotal",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "VirusTotal request failed.",
    });
  });
});

describe("VirusTotal connector interface", () => {
  it("exports a valid enrichment connector and health check", async () => {
    const connector = createVirustotalConnector({
      getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
      fetch: vi.fn(async () =>
        Response.json(SAMPLE_IPV4_PAYLOAD, { status: 200 })
      ) as typeof fetch,
    });

    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("virustotal");

    const result = await connector.enrich({ value: "8.8.8.8", type: IOC_TYPE.IPV4 });
    expect(isEnrichmentSourceResult(result)).toBe(true);
    expect(result).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "5 malicious detections",
    });

    await expect(
      checkVirustotalHealth({ getApiKey: async () => "" })
    ).resolves.toMatchObject({
      status: "error",
      message: "VirusTotal API key is not configured.",
    });
    await expect(
      checkVirustotalHealth({ getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY })
    ).resolves.toMatchObject({
      status: "ok",
    });
  });
});
