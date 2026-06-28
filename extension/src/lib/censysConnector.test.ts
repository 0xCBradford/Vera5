import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCensysBasicAuthorization,
  buildCensysHostApiUrl,
  CENSYS_API_BASE_URL,
  CENSYS_UNSUPPORTED_TYPE_MESSAGE,
  censysLiveSupportsIocType,
  collectCensysCertificateTags,
  collectCensysServiceTags,
  enrichWithCensys,
  inspectCensysVendorRequest,
  normalizeCensysHostResponse,
  parseCensysCertificateFields,
  parseCensysHostData,
  unwrapCensysHostPayload,
} from "./censysConnector";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";
import {
  buildCensysUnifiedSummary,
  mapCensysFieldsToUnifiedPresentation,
} from "./enrichmentVendorNormalize";
import {
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_INVALID_API_KEY,
  TEST_FIXTURE_SECONDARY_API_KEY,
} from "./fixtureSecrets";
import { getApiKey, setApiKey } from "./storage";
import { IOC_TYPE } from "./iocRegex";

const SAMPLE_CENSYS_HOST_PAYLOAD = {
  code: 200,
  result: {
    ip: "8.8.8.8",
    location: { country_code: "US" },
    autonomous_system: {
      asn: 15169,
      name: "GOOGLE",
    },
    services: [
      {
        port: 443,
        service_name: "HTTP",
        transport_protocol: "TCP",
        tls: {
          certificates: {
            leaf_data: {
              subject: { common_name: "dns.google" },
              issuer: { common_name: "Google Trust Services" },
              fingerprint_sha256:
                "fb444eb8e68437bae06232b9f5091bccff62a768ca09e92eb5c9c2cf9d17c426",
            },
          },
        },
      },
      {
        port: 53,
        service_name: "DNS",
        transport_protocol: "UDP",
      },
    ],
    dns: {
      names: ["dns.google", "ns1.google.com"],
    },
  },
};

const SAMPLE_PLATFORM_HOST_PAYLOAD = {
  result: {
    resource: {
      ip: "137.220.232.142",
      location: { country_code: "JP" },
      autonomous_system: {
        name: "CTGSERVERLIMITED-AS-AP CTG Server Limited",
      },
      services: [
        {
          port: 22,
          protocol: "SSH",
          transport_protocol: "tcp",
          cert: {
            subject: { common_name: "server.example.test" },
            issuer: { common_name: "Example CA" },
            fingerprint_sha2: "abc123def456",
          },
        },
      ],
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

describe("Censys host and certificate normalization", () => {
  it("unwraps v2 and platform host payloads", () => {
    expect(unwrapCensysHostPayload(SAMPLE_CENSYS_HOST_PAYLOAD)?.ip).toBe("8.8.8.8");
    expect(unwrapCensysHostPayload(SAMPLE_PLATFORM_HOST_PAYLOAD)?.ip).toBe(
      "137.220.232.142"
    );
  });

  it("parses analyst-relevant host, service, and certificate fields", () => {
    expect(parseCensysHostData(SAMPLE_CENSYS_HOST_PAYLOAD)).toEqual({
      ip: "8.8.8.8",
      serviceCount: 2,
      certificateCount: 1,
      dnsNameCount: 2,
      countryCode: "US",
      autonomousSystemName: "GOOGLE",
      serviceTags: ["HTTP", "443/tcp", "DNS", "53/udp"],
      certificateTags: ["dns.google"],
      dnsNames: ["dns.google", "ns1.google.com"],
    });
  });

  it("extracts certificate leaf and legacy cert fields from services", () => {
    const tlsService = (
      SAMPLE_CENSYS_HOST_PAYLOAD.result as { services: Record<string, unknown>[] }
    ).services[0];
    expect(parseCensysCertificateFields(tlsService)).toEqual({
      subjectCommonName: "dns.google",
      issuerCommonName: "Google Trust Services",
      fingerprintSha256:
        "fb444eb8e68437bae06232b9f5091bccff62a768ca09e92eb5c9c2cf9d17c426",
    });

    const legacyService = (
      SAMPLE_PLATFORM_HOST_PAYLOAD.result as {
        resource: { services: Record<string, unknown>[] };
      }
    ).resource.services[0];
    expect(parseCensysCertificateFields(legacyService)).toEqual({
      subjectCommonName: "server.example.test",
      issuerCommonName: "Example CA",
      fingerprintSha256: "abc123def456",
    });
  });

  it("collects service and certificate tags with a five-tag cap", () => {
    const services = Array.from({ length: 6 }, (_, index) => ({
      port: 4000 + index,
      service_name: `SERVICE_${index}`,
      transport_protocol: "TCP",
    }));

    expect(collectCensysServiceTags(services)).toHaveLength(5);
    expect(
      collectCensysCertificateTags([
        {
          tls: {
            certificates: {
              leaf_data: {
                subject: { common_name: "alpha.example" },
              },
            },
          },
        },
        {
          cert: {
            subject: { common_name: "beta.example" },
          },
        },
      ])
    ).toEqual(["alpha.example", "beta.example"]);
  });

  it("normalizes host payloads into unified presentation", () => {
    expect(normalizeCensysHostResponse(SAMPLE_CENSYS_HOST_PAYLOAD)).toEqual({
      summary: "2 observed services",
      tags: ["US", "GOOGLE", "HTTP", "443/tcp", "DNS"],
    });

    expect(normalizeCensysHostResponse(SAMPLE_PLATFORM_HOST_PAYLOAD)).toEqual({
      summary: "1 observed service",
      tags: [
        "JP",
        "CTGSERVERLIMITED-AS-AP CTG Server Limited",
        "22/tcp",
        "SSH",
        "server.example.test",
      ],
    });
  });

  it("falls back to certificate and DNS summaries when services are absent", () => {
    expect(
      mapCensysFieldsToUnifiedPresentation({
        certificateCount: 2,
        certificateTags: ["legacy.example", "other.example"],
      })
    ).toEqual({
      summary: "2 TLS certificates",
      tags: ["legacy.example", "other.example"],
    });

    expect(buildCensysUnifiedSummary({ dnsNameCount: 1 })).toBe("1 DNS name");
    expect(buildCensysUnifiedSummary({})).toBe("No Censys host data");
  });
});

describe("Censys IPv4 live enrichment path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("supports IPv4 host lookups only for live enrichment", () => {
    expect(censysLiveSupportsIocType(IOC_TYPE.IPV4)).toBe(true);
    expect(censysLiveSupportsIocType(IOC_TYPE.DOMAIN)).toBe(false);
    expect(censysLiveSupportsIocType(IOC_TYPE.URL)).toBe(false);
    expect(censysLiveSupportsIocType(IOC_TYPE.SHA256)).toBe(false);
  });

  it("builds host API URLs and Basic authorization headers", () => {
    expect(buildCensysHostApiUrl("8.8.8.8")).toBe(
      `${CENSYS_API_BASE_URL}/hosts/8.8.8.8`
    );
    expect(
      buildCensysBasicAuthorization(
        TEST_FIXTURE_GENERIC_API_KEY,
        TEST_FIXTURE_SECONDARY_API_KEY
      )
    ).toBe(
      `Basic ${btoa(`${TEST_FIXTURE_GENERIC_API_KEY}:${TEST_FIXTURE_SECONDARY_API_KEY}`)}`
    );
    expect(
      inspectCensysVendorRequest(`${CENSYS_API_BASE_URL}/hosts/8.8.8.8`, {
        method: "GET",
      })
    ).toEqual({
      ipAddress: "8.8.8.8",
      hasRequestBody: false,
    });
  });

  it("returns unsupported type for non-IPv4 indicators", async () => {
    const result = await enrichWithCensys({
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
    });

    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      errorMessage: CENSYS_UNSUPPORTED_TYPE_MESSAGE,
    });
  });

  it("returns missing credentials when the API pair is incomplete", async () => {
    stubChromeStorage({});
    const result = await enrichWithCensys({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
    });
  });

  it("enriches IPv4 hosts with mocked auth success responses", async () => {
    stubChromeStorage({});
    await setApiKey("censys", TEST_FIXTURE_GENERIC_API_KEY);
    await setApiKey("censys_secret", TEST_FIXTURE_SECONDARY_API_KEY);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_CENSYS_HOST_PAYLOAD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await enrichWithCensys(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      { fetch: fetchMock }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${CENSYS_API_BASE_URL}/hosts/8.8.8.8`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: buildCensysBasicAuthorization(
            TEST_FIXTURE_GENERIC_API_KEY,
            TEST_FIXTURE_SECONDARY_API_KEY
          ),
        }),
      })
    );
    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "2 observed services",
      tags: ["US", "GOOGLE", "HTTP", "443/tcp", "DNS"],
    });
    await expect(getApiKey("censys")).resolves.toBe(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("maps HTTP 401 to unauthorized when auth fails", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    const result = await enrichWithCensys(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiId: async () => TEST_FIXTURE_INVALID_API_KEY,
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${CENSYS_API_BASE_URL}/hosts/8.8.8.8`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: buildCensysBasicAuthorization(
            TEST_FIXTURE_INVALID_API_KEY,
            TEST_FIXTURE_SECONDARY_API_KEY
          ),
        }),
      })
    );
    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Censys rejected the API credentials.",
    });
  });

  it("maps HTTP 403 to unauthorized when auth fails", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    const result = await enrichWithCensys(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiId: async () => TEST_FIXTURE_INVALID_API_KEY,
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
        fetch: fetchMock as typeof fetch,
      }
    );

    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Censys rejected the API credentials.",
    });
  });

  it("maps HTTP 429 to rate limited with retry hint", async () => {
    const result = await enrichWithCensys(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiId: async () => TEST_FIXTURE_GENERIC_API_KEY,
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
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
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "Censys rate limit reached. Back off before retrying.",
      retryHint: "Retry after 60 seconds.",
    });
  });
});
