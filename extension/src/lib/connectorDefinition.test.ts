import { describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  CONNECTOR_HEALTH_STATUS,
} from "./enrichment";
import {
  CONNECTOR_AUTHORITY_TIER,
  connectorDefinitionSupportsIocType,
  enrichWithConnectorDefinition,
  isConnectorAuthorityTier,
  isConnectorCapabilityFlags,
  isConnectorCapabilityMetadata,
  isConnectorDefinition,
  isConnectorFetchResult,
  isConnectorNormalizeResult,
  isConnectorRateLimitPolicy,
  isLiveConnectorCapability,
  isPivotOnlyConnectorCapability,
  runConnectorDefinitionHealthCheck,
  type ConnectorDefinition,
} from "./connectorDefinition";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import { IOC_TYPE } from "./iocRegex";

const stubConnectorDefinition: ConnectorDefinition = {
  id: ENRICHMENT_SOURCE.OTX,
  supportedIocTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
  rateLimitPolicy: {
    requestTimeoutMs: 15_000,
    quotaSummary: "Stub quota summary for tests.",
    rateLimitHeaderHints: ["Retry-After"],
  },
  capabilities: {
    liveEnrichment: true,
    pivotOnly: false,
    requiresApiKey: true,
    supportsHealthCheck: true,
    authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  },
  async fetch(ioc) {
    return {
      ok: true,
      payload: { indicator: ioc.value, pulse_count: 2 },
      fetchedAt: "2026-06-29T12:00:00.000Z",
      rawVendorJson: '{"pulse_count":2}',
    };
  },
  normalize(payload) {
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as { pulse_count?: unknown }).pulse_count !== "number"
    ) {
      return null;
    }
    const pulseCount = (payload as { pulse_count: number }).pulse_count;
    return {
      summary: `${pulseCount} pulses`,
      tags: ["stub-tag"],
    };
  },
  async healthCheck() {
    return { status: CONNECTOR_HEALTH_STATUS.OK };
  },
};

describe("ConnectorDefinition contract", () => {
  it("validates rate limit policy, capability flags, and definition shape", () => {
    expect(
      isConnectorRateLimitPolicy({
        requestTimeoutMs: 15_000,
        quotaSummary: "Typical tier limits apply.",
        rateLimitHeaderHints: ["Retry-After"],
      })
    ).toBe(true);
    expect(
      isConnectorRateLimitPolicy({
        requestTimeoutMs: null,
        quotaSummary: "Pivot-only source.",
        rateLimitHeaderHints: [],
      })
    ).toBe(true);
    expect(isConnectorRateLimitPolicy({ quotaSummary: "missing timeout" })).toBe(
      false
    );

    expect(
      isConnectorCapabilityFlags({
        liveEnrichment: true,
        pivotOnly: false,
        requiresApiKey: true,
        supportsHealthCheck: false,
        authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
      })
    ).toBe(true);
    expect(
      isConnectorCapabilityFlags({
        liveEnrichment: false,
        pivotOnly: true,
        requiresApiKey: false,
        supportsHealthCheck: false,
        authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
      })
    ).toBe(true);
    expect(isConnectorCapabilityFlags({ liveEnrichment: true })).toBe(false);
    expect(
      isConnectorCapabilityFlags({
        liveEnrichment: true,
        pivotOnly: true,
        requiresApiKey: true,
        supportsHealthCheck: true,
        authorityTier: CONNECTOR_AUTHORITY_TIER.UNKNOWN,
      })
    ).toBe(false);

    expect(isConnectorAuthorityTier(CONNECTOR_AUTHORITY_TIER.UNKNOWN)).toBe(
      true
    );
    expect(isConnectorAuthorityTier("vendor")).toBe(false);
    expect(
      isConnectorCapabilityMetadata({
        sourceId: ENRICHMENT_SOURCE.OTX,
        liveEnrichment: true,
        pivotOnly: false,
        requiresApiKey: true,
        supportsHealthCheck: true,
        authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
      })
    ).toBe(true);
    expect(
      isLiveConnectorCapability({
        liveEnrichment: true,
        pivotOnly: false,
        requiresApiKey: true,
        supportsHealthCheck: true,
        authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
      })
    ).toBe(true);
    expect(
      isPivotOnlyConnectorCapability({
        liveEnrichment: false,
        pivotOnly: true,
        requiresApiKey: false,
        supportsHealthCheck: false,
        authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
      })
    ).toBe(true);

    expect(isConnectorDefinition(stubConnectorDefinition)).toBe(true);
    expect(isConnectorDefinition({ id: ENRICHMENT_SOURCE.OTX })).toBe(false);
    expect(isConnectorDefinition(null)).toBe(false);
  });

  it("validates fetch and normalize result guards", () => {
    expect(
      isConnectorFetchResult({
        ok: true,
        payload: { pulse_count: 1 },
        fetchedAt: "2026-06-29T12:00:00.000Z",
      })
    ).toBe(true);
    expect(
      isConnectorFetchResult({
        ok: false,
        errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        errorMessage: "Rate limited.",
        fetchedAt: "2026-06-29T12:00:00.000Z",
        retryHint: "Wait and retry.",
      })
    ).toBe(true);
    expect(isConnectorFetchResult({ ok: true, payload: {} })).toBe(false);

    expect(
      isConnectorNormalizeResult({
        summary: "2 pulses",
        tags: ["malware"],
      })
    ).toBe(true);
    expect(isConnectorNormalizeResult({ summary: "   " })).toBe(false);
  });

  it("checks supported IOC types on the definition", () => {
    expect(
      connectorDefinitionSupportsIocType(stubConnectorDefinition, IOC_TYPE.IPV4)
    ).toBe(true);
    expect(
      connectorDefinitionSupportsIocType(stubConnectorDefinition, IOC_TYPE.URL)
    ).toBe(false);
  });

  it("composes fetch and normalize into an enrichment source result", async () => {
    const result = await enrichWithConnectorDefinition(stubConnectorDefinition, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.OK);
    expect(result.sourceId).toBe(ENRICHMENT_SOURCE.OTX);
    expect(result.summary).toBe("2 pulses");
    expect(result.tags).toEqual(["stub-tag"]);
    expect(result.rawVendorJson).toBe('{"pulse_count":2}');
  });

  it("skips unsupported indicator types before fetch", async () => {
    const fetchSpy = vi.fn(stubConnectorDefinition.fetch);
    const definition: ConnectorDefinition = {
      ...stubConnectorDefinition,
      fetch: fetchSpy,
    };

    const result = await enrichWithConnectorDefinition(definition, {
      value: "https://example.com",
      type: IOC_TYPE.URL,
    });

    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.SKIPPED);
    expect(result.errorCode).toBe(ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps fetch errors and normalize failures", async () => {
    const fetchErrorDefinition: ConnectorDefinition = {
      ...stubConnectorDefinition,
      async fetch() {
        return {
          ok: false,
          errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
          errorMessage: "Vendor rate limit reached.",
          fetchedAt: "2026-06-29T12:00:00.000Z",
        };
      },
    };
    const rateLimited = await enrichWithConnectorDefinition(
      fetchErrorDefinition,
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 }
    );
    expect(rateLimited.status).toBe(ENRICHMENT_SOURCE_STATUS.ERROR);
    expect(rateLimited.errorCode).toBe(ENRICHMENT_ERROR_CODE.RATE_LIMITED);

    const normalizeFailureDefinition: ConnectorDefinition = {
      ...stubConnectorDefinition,
      normalize() {
        return null;
      },
    };
    const unparseable = await enrichWithConnectorDefinition(
      normalizeFailureDefinition,
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 }
    );
    expect(unparseable.status).toBe(ENRICHMENT_SOURCE_STATUS.ERROR);
    expect(unparseable.errorCode).toBe(ENRICHMENT_ERROR_CODE.VENDOR);
  });

  it("runs optional health checks with a safe default", async () => {
    const health = await runConnectorDefinitionHealthCheck(stubConnectorDefinition);
    expect(health.status).toBe(CONNECTOR_HEALTH_STATUS.OK);

    const withoutHealthCheck: ConnectorDefinition = {
      ...stubConnectorDefinition,
      healthCheck: undefined,
    };
    const defaultHealth =
      await runConnectorDefinitionHealthCheck(withoutHealthCheck);
    expect(defaultHealth.status).toBe(CONNECTOR_HEALTH_STATUS.OK);
  });
});
