import { describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  CONNECTOR_HEALTH_STATUS,
} from "./enrichment";
import {
  CONNECTOR_AUTHORITY_TIER,
  CONNECTOR_FRESHNESS_POLICY,
  CONNECTOR_RELIABILITY_TIER,
  CONNECTOR_RELIABILITY_TIER_DEFINITIONS,
  CONNECTOR_SOURCE_CLASS,
  connectorDefinitionSupportsIocType,
  enrichWithConnectorDefinition,
  getConnectorReliabilityTierDefinition,
  getConnectorReliabilityTierLabel,
  isConnectorAuthorityTier,
  isConnectorCapabilityFlags,
  isConnectorCapabilityMetadata,
  isConnectorConfidenceMetadata,
  isConnectorConfidenceMetadataFields,
  isConnectorDefinition,
  isConnectorFetchResult,
  isConnectorFreshnessPolicy,
  isConnectorNormalizeResult,
  normalizeConnectorConfidenceMetadataOverride,
  normalizeConnectorConfidenceMetadataOverridesRecord,
  validateConnectorConfidenceMetadataOverrideForImport,
  validateImportedConnectorConfidenceMetadataOverridesRecord,
  isConnectorRateLimitPolicy,
  isConnectorReliabilityTier,
  isConnectorSourceClass,
  isLiveConnectorCapability,
  isPivotOnlyConnectorCapability,
  listConnectorReliabilityTierDefinitions,
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

    expect(isConnectorReliabilityTier(CONNECTOR_RELIABILITY_TIER.COMMUNITY)).toBe(
      true
    );
    expect(isConnectorReliabilityTier(CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY)).toBe(
      true
    );
    expect(isConnectorReliabilityTier("unknown")).toBe(false);

    expect(isConnectorSourceClass(CONNECTOR_SOURCE_CLASS.AUTHORITATIVE)).toBe(
      true
    );
    expect(isConnectorSourceClass("pivot_only")).toBe(false);

    expect(isConnectorFreshnessPolicy(CONNECTOR_FRESHNESS_POLICY.STANDARD)).toBe(
      true
    );
    expect(isConnectorFreshnessPolicy(CONNECTOR_FRESHNESS_POLICY.STABLE)).toBe(
      true
    );
    expect(isConnectorFreshnessPolicy("realtime")).toBe(false);

    expect(
      isConnectorConfidenceMetadataFields({
        freshnessPolicy: CONNECTOR_FRESHNESS_POLICY.VOLATILE,
        reliabilityTier: CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE,
        sourceClass: CONNECTOR_SOURCE_CLASS.AUTHORITATIVE,
      })
    ).toBe(true);
    expect(
      isConnectorConfidenceMetadataFields({
        freshnessPolicy: null,
        reliabilityTier: null,
        sourceClass: null,
      })
    ).toBe(true);
    expect(
      isConnectorConfidenceMetadata({
        sourceId: ENRICHMENT_SOURCE.OTX,
        freshnessPolicy: CONNECTOR_FRESHNESS_POLICY.STANDARD,
        reliabilityTier: CONNECTOR_RELIABILITY_TIER.COMMUNITY,
        sourceClass: CONNECTOR_SOURCE_CLASS.COMMUNITY,
      })
    ).toBe(true);
    expect(
      isConnectorConfidenceMetadata({
        sourceId: "unknown_source",
        freshnessPolicy: null,
        reliabilityTier: null,
        sourceClass: null,
      })
    ).toBe(false);

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

  it("documents reliability tier enum values with labels and descriptions", () => {
    const definitions = listConnectorReliabilityTierDefinitions();

    expect(definitions).toHaveLength(3);
    expect(definitions.map((entry) => entry.value)).toEqual([
      CONNECTOR_RELIABILITY_TIER.COMMUNITY,
      CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE,
      CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY,
    ]);

    expect(
      CONNECTOR_RELIABILITY_TIER_DEFINITIONS[CONNECTOR_RELIABILITY_TIER.COMMUNITY]
    ).toMatchObject({
      label: "Community",
      description: expect.stringContaining("Community-sourced"),
    });
    expect(
      CONNECTOR_RELIABILITY_TIER_DEFINITIONS[
        CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE
      ]
    ).toMatchObject({
      label: "Authoritative",
      description: expect.stringContaining("Vendor-operated"),
    });
    expect(
      CONNECTOR_RELIABILITY_TIER_DEFINITIONS[
        CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY
      ]
    ).toMatchObject({
      label: "Pivot only",
      description: expect.stringContaining("No live enrichment connector"),
    });

    expect(
      getConnectorReliabilityTierLabel(CONNECTOR_RELIABILITY_TIER.COMMUNITY)
    ).toBe("Community");
    expect(
      getConnectorReliabilityTierDefinition(
        CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY
      ).value
    ).toBe("pivot_only");
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

describe("connector confidence metadata overrides", () => {
  it("normalizes per-source override fields and rejects invalid enums", () => {
    expect(
      normalizeConnectorConfidenceMetadataOverride(
        { reliabilityTier: "community", freshnessPolicy: "volatile" },
        ENRICHMENT_SOURCE.OTX
      )
    ).toEqual({
      reliabilityTier: "community",
      freshnessPolicy: "volatile",
    });

    expect(() =>
      normalizeConnectorConfidenceMetadataOverride(
        { reliabilityTier: "bogus" },
        ENRICHMENT_SOURCE.OTX
      )
    ).toThrow(/Invalid reliabilityTier/);
  });

  it("normalizes override records for known connector ids only", () => {
    expect(
      normalizeConnectorConfidenceMetadataOverridesRecord({
        otx: { reliabilityTier: "authoritative" },
        unknown_source: { reliabilityTier: "community" },
      })
    ).toEqual({
      otx: { reliabilityTier: "authoritative" },
    });
  });
});

describe("imported connector confidence metadata validation", () => {
  it("accepts valid override records for import", () => {
    expect(
      validateImportedConnectorConfidenceMetadataOverridesRecord({
        otx: { reliabilityTier: "authoritative", freshnessPolicy: "volatile" },
        urlscan: { sourceClass: "authoritative" },
      })
    ).toEqual({
      otx: { reliabilityTier: "authoritative", freshnessPolicy: "volatile" },
      urlscan: { sourceClass: "authoritative" },
    });
  });

  it("returns an empty record when import metadata is omitted", () => {
    expect(
      validateImportedConnectorConfidenceMetadataOverridesRecord(undefined)
    ).toEqual({});
  });

  it("rejects unknown connector ids on import", () => {
    expect(() =>
      validateImportedConnectorConfidenceMetadataOverridesRecord({
        unknown_source: { reliabilityTier: "community" },
      })
    ).toThrow(/Unknown connector id/);
  });

  it("rejects unknown override fields on import", () => {
    expect(() =>
      validateConnectorConfidenceMetadataOverrideForImport(
        { reliabilityTier: "authoritative", scoreWeight: 2 },
        ENRICHMENT_SOURCE.OTX
      )
    ).toThrow(/Unknown connector confidence metadata field/);
  });

  it("rejects empty override objects on import", () => {
    expect(() =>
      validateConnectorConfidenceMetadataOverrideForImport({}, ENRICHMENT_SOURCE.OTX)
    ).toThrow(/must include at least one supported field/);
  });

  it("rejects non-object metadata containers on import", () => {
    expect(() =>
      validateImportedConnectorConfidenceMetadataOverridesRecord([])
    ).toThrow(/must be an object/);
  });
});
