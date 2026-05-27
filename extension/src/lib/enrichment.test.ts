import { describe, expect, it } from "vitest";
import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  createEmptyEnrichmentResult,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  isConnectorHealthCheckResult,
  isEnrichmentConnector,
  isEnrichmentIoc,
  isEnrichmentResult,
  isEnrichmentSourceResult,
  normalizeEnrichmentResult,
  normalizeEnrichmentSourceResult,
  runConnectorHealthCheck,
  parseRateLimitHeaders,
  formatRateLimitRetryHint,
  buildRateLimitedErrorMessage,
  buildRateLimitedEnrichmentError,
  formatMissingKeyErrorMessage,
  formatRateLimitedBackoffMessage,
  formatRateLimitRetryHintText,
  isMissingKeyError,
  isRateLimitedError,
  parseRetryAfterSecondsFromHint,
  type EnrichmentConnector,
  type EnrichmentResult,
} from "./enrichment";

describe("EnrichmentResult shape", () => {
  const sampleResult: EnrichmentResult = {
    ioc: "185.220.101.4",
    type: "ipv4",
    sources: [
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        tags: ["ssh", "scanner"],
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 pulses",
        tags: ["tor"],
      },
    ],
    cached: true,
    lastUpdated: "2026-05-22T10:00:00.000Z",
  };

  it("validates a normalized enrichment result", () => {
    expect(isEnrichmentResult(sampleResult)).toBe(true);
  });

  it("rejects results missing required fields", () => {
    expect(isEnrichmentResult(null)).toBe(false);
    expect(isEnrichmentResult({ ...sampleResult, ioc: "" })).toBe(false);
    expect(isEnrichmentResult({ ...sampleResult, type: "email" })).toBe(false);
    expect(
      isEnrichmentResult({ ...sampleResult, lastUpdated: "not-a-date" })
    ).toBe(false);
  });

  it("validates per-source results", () => {
    expect(isEnrichmentSourceResult(sampleResult.sources[0])).toBe(true);
    expect(
      isEnrichmentSourceResult({
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      })
    ).toBe(true);
    expect(
      isEnrichmentSourceResult({
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "bad",
      })
    ).toBe(false);
  });

  it("normalizes enrichment payloads", () => {
    const normalized = normalizeEnrichmentResult({
      ...sampleResult,
      ioc: "  185.220.101.4  ",
      sources: [
        {
          ...sampleResult.sources[0],
          summary: " 74 abuse confidence ",
          tags: [" ssh ", "", "scanner"],
        },
      ],
    });
    expect(normalized).toEqual({
      ...sampleResult,
      ioc: "185.220.101.4",
      sources: [
        {
          ...sampleResult.sources[0],
          summary: "74 abuse confidence",
          tags: ["ssh", "scanner"],
        },
      ],
    });
  });

  it("normalizes individual source results", () => {
    expect(
      normalizeEnrichmentSourceResult({
        sourceId: "otx",
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: " pulse context ",
      })
    ).toEqual({
      sourceId: "otx",
      sourceLabel: "OTX",
      status: "ok",
      summary: "pulse context",
    });
  });

  it("creates empty and factory source results", () => {
    const empty = createEmptyEnrichmentResult("8.8.8.8", "ipv4");
    expect(empty.sources).toEqual([]);
    expect(empty.cached).toBe(false);
    expect(isEnrichmentResult(empty)).toBe(true);

    expect(
      createOkSourceResult({
        sourceId: "abuseipdb",
        summary: "Low confidence",
        tags: ["scanner"],
        fromCache: true,
      })
    ).toMatchObject({
      status: "ok",
      sourceLabel: "AbuseIPDB",
      fromCache: true,
    });

    expect(
      createErrorSourceResult({
        sourceId: "otx",
        errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        errorMessage: "Try again later",
      })
    ).toMatchObject({
      status: "error",
      errorCode: "rate_limited",
    });

    expect(
      createSkippedSourceResult(
        "urlscan",
        ENRICHMENT_ERROR_CODE.DISABLED,
        "Source disabled in settings"
      )
    ).toMatchObject({
      status: "skipped",
      errorCode: "disabled",
    });
  });
});

describe("EnrichmentConnector interface", () => {
  const stubConnector: EnrichmentConnector = {
    name: "abuseipdb",
    async enrich(ioc) {
      return createOkSourceResult({
        sourceId: "abuseipdb",
        summary: `Checked ${ioc.value}`,
      });
    },
    async healthCheck() {
      return { status: CONNECTOR_HEALTH_STATUS.OK };
    },
  };

  it("validates connector shape and IOC input", () => {
    expect(isEnrichmentConnector(stubConnector)).toBe(true);
    expect(isEnrichmentConnector({ name: "otx" })).toBe(false);
    expect(isEnrichmentIoc({ value: "8.8.8.8", type: "ipv4" })).toBe(true);
    expect(isEnrichmentIoc({ value: "", type: "ipv4" })).toBe(false);
  });

  it("runs enrich and optional healthCheck", async () => {
    const sourceResult = await stubConnector.enrich({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(isEnrichmentSourceResult(sourceResult)).toBe(true);
    expect(sourceResult.summary).toBe("Checked 8.8.8.8");

    const health = await runConnectorHealthCheck(stubConnector);
    expect(isConnectorHealthCheckResult(health)).toBe(true);
    expect(health.status).toBe("ok");
  });

  it("defaults health check to ok when omitted", async () => {
    const connector: EnrichmentConnector = {
      name: "otx",
      async enrich(ioc) {
        if (ioc.type !== "ipv4") {
          return createSkippedSourceResult(
            "otx",
            ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE
          );
        }
        return createOkSourceResult({
          sourceId: "otx",
          summary: "Pulse context",
        });
      },
    };
    expect(isEnrichmentConnector(connector)).toBe(true);
    const health = await runConnectorHealthCheck(connector);
    expect(health).toEqual({ status: "ok" });
  });

  it("surfaces invalid health check responses", async () => {
    const connector: EnrichmentConnector = {
      name: "urlscan",
      async enrich() {
        return createErrorSourceResult({
          sourceId: "urlscan",
          errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        });
      },
      async healthCheck() {
        return { status: "bad" } as unknown as { status: "ok" };
      },
    };
    const health = await runConnectorHealthCheck(connector);
    expect(health.status).toBe("error");
    expect(health.message).toContain("invalid");
  });
});

describe("rate limit header handling", () => {
  it("parses standard rate limit headers", () => {
    const headers = new Headers({
      "X-RateLimit-Limit": "1000",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1716379200",
      "Retry-After": "60",
    });
    expect(parseRateLimitHeaders(headers)).toEqual({
      limit: 1000,
      remaining: 0,
      resetAt: new Date(1716379200 * 1000).toISOString(),
      retryAfterSeconds: 60,
    });
  });

  it("returns null when no rate limit headers are present", () => {
    expect(parseRateLimitHeaders(new Headers())).toBeNull();
  });

  it("builds retry hints for rate-limited responses", () => {
    const hint = formatRateLimitRetryHint(
      "AbuseIPDB rate limit reached. Back off before retrying.",
      { retryAfterSeconds: 45 }
    );
    expect(hint).toBe(
      "AbuseIPDB rate limit reached. Back off before retrying. Retry after 45 seconds."
    );
    expect(
      buildRateLimitedErrorMessage(
        "AbuseIPDB rate limit reached. Back off before retrying.",
        new Headers({ "Retry-After": "30" })
      )
    ).toBe(
      "AbuseIPDB rate limit reached. Back off before retrying. Retry after 30 seconds."
    );
  });
});

describe("missing key error messaging", () => {
  it("formats actionable missing-key copy with the source label", () => {
    expect(formatMissingKeyErrorMessage("AbuseIPDB")).toBe(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    expect(formatMissingKeyErrorMessage("  ")).toBe(
      "Add an API key in Vera5 Settings to load enrichment."
    );
  });

  it("detects missing-key error codes", () => {
    expect(isMissingKeyError(ENRICHMENT_ERROR_CODE.MISSING_KEY)).toBe(true);
    expect(isMissingKeyError(ENRICHMENT_ERROR_CODE.UNAUTHORIZED)).toBe(false);
    expect(isMissingKeyError(undefined)).toBe(false);
  });
});

describe("rate limit error messaging", () => {
  it("formats backoff and retry hint separately for hover card binding", () => {
    expect(formatRateLimitedBackoffMessage("AbuseIPDB")).toBe(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    expect(formatRateLimitRetryHintText({ retryAfterSeconds: 120 })).toBe(
      "Retry after 120 seconds."
    );
    expect(formatRateLimitRetryHintText(null)).toBe("Try again later.");
    expect(
      buildRateLimitedEnrichmentError(
        "AbuseIPDB",
        new Headers({ "Retry-After": "120" })
      )
    ).toEqual({
      errorMessage: "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 120 seconds.",
    });
  });

  it("parses retry-after seconds from retry hint text", () => {
    expect(parseRetryAfterSecondsFromHint("Retry after 45 seconds.")).toBe(45);
    expect(parseRetryAfterSecondsFromHint("Try again later.")).toBeUndefined();
  });

  it("detects rate-limited error codes", () => {
    expect(isRateLimitedError(ENRICHMENT_ERROR_CODE.RATE_LIMITED)).toBe(true);
    expect(isRateLimitedError(ENRICHMENT_ERROR_CODE.TIMEOUT)).toBe(false);
    expect(isRateLimitedError(undefined)).toBe(false);
  });
});
