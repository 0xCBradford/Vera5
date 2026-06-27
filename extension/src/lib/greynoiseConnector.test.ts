import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  buildGreyNoiseCommunityUrl,
  createGreynoiseConnector,
  enrichWithGreynoise,
  formatGreyNoiseSummary,
  inspectGreyNoiseVendorRequest,
  mapGreyNoiseCommunityDataToUnifiedPresentation,
  normalizeGreyNoiseCommunityResponse,
  parseGreyNoiseCommunityData,
  GREYNOISE_COMMUNITY_API_BASE_URL,
} from "./greynoiseConnector";
import {
  buildGreyNoiseUnifiedSummary,
  mapGreyNoiseFieldsToUnifiedPresentation,
} from "./enrichmentVendorNormalize";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  isEnrichmentConnector,
  isEnrichmentSourceResult,
} from "./enrichment";
import {
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_GREYNOISE_API_KEY,
  TEST_FIXTURE_INVALID_API_KEY,
} from "./fixtureSecrets";
import { IOC_TYPE } from "./iocRegex";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadGreyNoiseFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

function createGreyNoiseFixtureFetchMock(relativePath: string) {
  const payload = loadGreyNoiseFixture(relativePath);
  return vi.fn(async () =>
    Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("GreyNoise community connector normalization", () => {
  it("parses community API payloads", () => {
    expect(parseGreyNoiseCommunityData(loadGreyNoiseFixture("greynoise/community-benign-riot.json"))).toEqual({
      ip: "8.8.8.8",
      noise: false,
      riot: true,
      classification: "benign",
      name: "Google Public DNS",
      link: "https://viz.greynoise.io/riot/8.8.8.8",
      lastSeen: "2026-03-18",
      message: "Success",
    });
  });

  it("maps benign RIOT service summaries and tags", () => {
    expect(
      mapGreyNoiseFieldsToUnifiedPresentation({
        noise: false,
        riot: true,
        classification: "benign",
        name: "Google Public DNS",
      })
    ).toEqual({
      summary: "benign RIOT service",
      tags: ["benign", "Google Public DNS", "riot"],
    });
  });

  it("maps malicious internet noise summaries", () => {
    expect(
      normalizeGreyNoiseCommunityResponse(
        loadGreyNoiseFixture("greynoise/community-malicious-noise.json")
      )
    ).toEqual({
      summary: "malicious internet noise",
      tags: ["malicious", "noise"],
    });
  });

  it("maps not-observed responses", () => {
    expect(
      normalizeGreyNoiseCommunityResponse(
        loadGreyNoiseFixture("greynoise/community-not-observed.json")
      )
    ).toEqual({
      summary: "not observed in GreyNoise",
      tags: [],
    });
  });

  it("builds community lookup URLs", () => {
    expect(buildGreyNoiseCommunityUrl("8.8.8.8")).toBe(
      `${GREYNOISE_COMMUNITY_API_BASE_URL}8.8.8.8`
    );
  });

  it("inspects vendor requests without bodies", () => {
    expect(
      inspectGreyNoiseVendorRequest(`${GREYNOISE_COMMUNITY_API_BASE_URL}8.8.8.8`, {
        method: "GET",
      })
    ).toEqual({
      ipAddress: "8.8.8.8",
      hasRequestBody: false,
    });
  });
});

describe("GreyNoise community connector enrich", () => {
  it("returns missing-key when no API key is configured", async () => {
    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      { getApiKey: async () => "" }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage:
        "Add your GreyNoise API key in Vera5 Settings to load enrichment.",
    });
  });

  it("skips unsupported indicator types without calling the vendor", async () => {
    const fetchMock = vi.fn();
    const unsupportedCases = [
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      { value: "https://example.com/path", type: IOC_TYPE.URL },
      { value: "d41d8cd98f00b204e9800998ecf8427e", type: IOC_TYPE.MD5 },
      {
        value: "356a192b7913b04c54574d18c28d46e6395428ab",
        type: IOC_TYPE.SHA1,
      },
      {
        value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        type: IOC_TYPE.SHA256,
      },
      { value: "CVE-2021-44228", type: IOC_TYPE.CVE },
    ];

    for (const ioc of unsupportedCases) {
      const result = await enrichWithGreynoise(ioc, {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: fetchMock as typeof fetch,
      });

      expect(result).toMatchObject({
        sourceId: "greynoise",
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
        errorMessage: "GreyNoise supports IPv4 addresses only.",
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enriches IPv4 with mocked benign RIOT fixture", async () => {
    const fetchMock = createGreyNoiseFixtureFetchMock("greynoise/community-benign-riot.json");

    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: fetchMock,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${GREYNOISE_COMMUNITY_API_BASE_URL}8.8.8.8`
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: {
        Accept: "application/json",
        key: TEST_FIXTURE_GREYNOISE_API_KEY,
      },
    });
    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "benign RIOT service",
      tags: ["benign", "Google Public DNS", "riot"],
    });
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_GREYNOISE_API_KEY);
  });

  it("surfaces HTTP 401 as unauthorized", async () => {
    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 401 })),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "GreyNoise rejected the API key.",
    });
  });

  it("surfaces HTTP 403 as unauthorized", async () => {
    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_INVALID_API_KEY,
        fetch: vi.fn(async () => new Response("", { status: 403 })),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "GreyNoise rejected the API key.",
    });
  });

  it("surfaces HTTP 429 with retry hint", async () => {
    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GENERIC_API_KEY,
        fetch: vi.fn(
          async () =>
            new Response("", {
              status: 429,
              headers: { "Retry-After": "60" },
            })
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "GreyNoise rate limit reached. Back off before retrying.",
      retryHint: "Retry after 60 seconds.",
    });
  });

  it("maps HTTP 404 with not-observed payload to ok enrichment", async () => {
    const payload = loadGreyNoiseFixture("greynoise/community-not-observed.json");
    const result = await enrichWithGreynoise(
      { value: "196.188.245.219", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: vi.fn(async () =>
          Response.json(payload, {
            status: 404,
            headers: { "Content-Type": "application/json" },
          })
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "not observed in GreyNoise",
    });
  });

  it("surfaces request timeouts", async () => {
    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: vi.fn(
          async () =>
            new Promise<Response>((_resolve, reject) => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            })
        ),
        timeoutMs: 1,
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "GreyNoise request timed out.",
    });
  });
});

describe("GreyNoise community connector enrich with vendor fixtures for noise vs malicious classifications", () => {
  it("maps community-malicious-noise.json to malicious internet noise presentation", async () => {
    const fetchMock = createGreyNoiseFixtureFetchMock(
      "greynoise/community-malicious-noise.json"
    );

    const result = await enrichWithGreynoise(
      { value: "51.91.185.74", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: fetchMock,
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "malicious internet noise",
      tags: ["malicious", "noise"],
    });
    expect(result.rawVendorJson).toContain('"classification": "malicious"');
    expect(result.rawVendorJson).not.toContain(TEST_FIXTURE_GREYNOISE_API_KEY);
  });

  it("maps community-benign-riot.json to benign RIOT service presentation", async () => {
    const fetchMock = createGreyNoiseFixtureFetchMock("greynoise/community-benign-riot.json");

    const result = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: fetchMock,
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "benign RIOT service",
      tags: ["benign", "Google Public DNS", "riot"],
    });
    expect(result.rawVendorJson).toContain('"classification": "benign"');
    expect(result.rawVendorJson).not.toContain("internet noise");
  });

  it("maps mocked unknown internet noise responses", async () => {
    const result = await enrichWithGreynoise(
      { value: "203.0.113.10", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: vi.fn(async () =>
          Response.json(
            {
              ip: "203.0.113.10",
              noise: true,
              riot: false,
              classification: "unknown",
              name: "unknown",
              message: "Success",
            },
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "unknown internet noise",
      tags: ["unknown", "noise"],
    });
  });

  it("maps mocked benign internet noise responses", async () => {
    const result = await enrichWithGreynoise(
      { value: "203.0.113.11", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: vi.fn(async () =>
          Response.json(
            {
              ip: "203.0.113.11",
              noise: true,
              riot: false,
              classification: "benign",
              name: "Example CDN",
              message: "Success",
            },
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: "greynoise",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "benign internet noise",
      tags: ["benign", "Example CDN", "noise"],
    });
  });

  it("distinguishes malicious noise from benign RIOT using fixture payloads", async () => {
    const maliciousResult = await enrichWithGreynoise(
      { value: "51.91.185.74", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: createGreyNoiseFixtureFetchMock("greynoise/community-malicious-noise.json"),
      }
    );
    const benignResult = await enrichWithGreynoise(
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      {
        getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
        fetch: createGreyNoiseFixtureFetchMock("greynoise/community-benign-riot.json"),
      }
    );

    expect(maliciousResult.summary).toBe("malicious internet noise");
    expect(maliciousResult.tags).toEqual(["malicious", "noise"]);
    expect(benignResult.summary).toBe("benign RIOT service");
    expect(benignResult.tags).toEqual(["benign", "Google Public DNS", "riot"]);
    expect(maliciousResult.summary).not.toBe(benignResult.summary);
  });
});

describe("GreyNoise connector interface", () => {
  it("exports a valid enrichment connector", async () => {
    const connector = createGreynoiseConnector({
      getApiKey: async () => TEST_FIXTURE_GREYNOISE_API_KEY,
      fetch: createGreyNoiseFixtureFetchMock("greynoise/community-benign-riot.json"),
    });

    expect(isEnrichmentConnector(connector)).toBe(true);
    expect(connector.name).toBe("greynoise");

    const result = await connector.enrich({ value: "8.8.8.8", type: IOC_TYPE.IPV4 });
    expect(isEnrichmentSourceResult(result)).toBe(true);
    expect(formatGreyNoiseSummary(parseGreyNoiseCommunityData(loadGreyNoiseFixture("greynoise/community-benign-riot.json"))!)).toBe(
      "benign RIOT service"
    );
    expect(
      mapGreyNoiseCommunityDataToUnifiedPresentation(
        parseGreyNoiseCommunityData(loadGreyNoiseFixture("greynoise/community-malicious-noise.json"))!
      ).summary
    ).toBe("malicious internet noise");
    expect(buildGreyNoiseUnifiedSummary({ noise: true, riot: false, classification: "unknown" })).toBe(
      "unknown internet noise"
    );
  });
});
