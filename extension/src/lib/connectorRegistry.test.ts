import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";
import {
  clearConnectorRegistry,
  ConnectorRegistryError,
  ensureDefaultConnectorRegistry,
  enrichRegisteredLiveConnector,
  getConnectorCapabilityMetadata,
  hasRegisteredConnector,
  listConnectorCapabilityMetadata,
  listRegisteredConnectorIds,
  lookupConnectorCapabilityMetadata,
  lookupConnectorDefinition,
  registerBuiltInLiveConnectors,
  registerConnectorDefinition,
  resetDefaultConnectorRegistryState,
  unregisterConnectorDefinition,
} from "./connectorRegistry";
import {
  CONNECTOR_AUTHORITY_TIER,
  type ConnectorDefinition,
} from "./connectorDefinition";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
} from "./enrichmentSourceRegistry";
import { IOC_TYPE } from "./iocRegex";

function buildStubDefinition(
  overrides: Partial<ConnectorDefinition> = {}
): ConnectorDefinition {
  return {
    id: ENRICHMENT_SOURCE.OTX,
    supportedIocTypes: [IOC_TYPE.IPV4],
    rateLimitPolicy: {
      requestTimeoutMs: 15_000,
      quotaSummary: "Stub quota summary.",
      rateLimitHeaderHints: ["Retry-After"],
    },
    capabilities: {
      liveEnrichment: true,
      pivotOnly: false,
      requiresApiKey: true,
      supportsHealthCheck: true,
      authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
    },
    async fetch() {
      return {
        ok: true,
        payload: { pulse_count: 1 },
        fetchedAt: "2026-06-29T12:00:00.000Z",
      };
    },
    normalize() {
      return { summary: "1 pulse" };
    },
    async healthCheck() {
      return { status: CONNECTOR_HEALTH_STATUS.OK };
    },
    ...overrides,
  };
}

describe("connectorRegistry", () => {
  afterEach(() => {
    resetDefaultConnectorRegistryState();
  });

  it("registers, looks up, lists, and unregisters connector definitions", () => {
    const definition = buildStubDefinition();
    registerConnectorDefinition(definition);

    expect(hasRegisteredConnector(ENRICHMENT_SOURCE.OTX)).toBe(true);
    expect(lookupConnectorDefinition(ENRICHMENT_SOURCE.OTX)).toBe(definition);
    expect(listRegisteredConnectorIds()).toEqual([ENRICHMENT_SOURCE.OTX]);

    expect(unregisterConnectorDefinition(ENRICHMENT_SOURCE.OTX)).toBe(true);
    expect(lookupConnectorDefinition(ENRICHMENT_SOURCE.OTX)).toBeUndefined();
    expect(listRegisteredConnectorIds()).toEqual([]);
  });

  it("rejects invalid and duplicate registrations", () => {
    registerConnectorDefinition(buildStubDefinition());

    expect(() => registerConnectorDefinition(buildStubDefinition())).toThrow(
      ConnectorRegistryError
    );
    expect(() =>
      registerConnectorDefinition({ id: ENRICHMENT_SOURCE.OTX } as ConnectorDefinition)
    ).toThrow(ConnectorRegistryError);
  });

  describe("enrichRegisteredLiveConnector", () => {
    it("returns null when the connector id is not registered", async () => {
      clearConnectorRegistry();

      expect(lookupConnectorDefinition(ENRICHMENT_SOURCE.ABUSEIPDB)).toBeUndefined();

      const result = await enrichRegisteredLiveConnector(ENRICHMENT_SOURCE.ABUSEIPDB, {
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      });

      expect(result).toBeNull();
    });

    it("returns null when the source is pivot-only and not registered for live enrichment", async () => {
      registerBuiltInLiveConnectors();

      expect(lookupConnectorDefinition(ENRICHMENT_SOURCE.VIRUSTOTAL)).toBeUndefined();

      const result = await enrichRegisteredLiveConnector(
        ENRICHMENT_SOURCE.VIRUSTOTAL,
        {
          value: "8.8.8.8",
          type: IOC_TYPE.IPV4,
        }
      );

      expect(result).toBeNull();
    });

    it("returns skipped when the registered connector does not support the IOC type", async () => {
      registerBuiltInLiveConnectors();

      const fetchSpy = vi.fn();
      const abuseIpdbDefinition = lookupConnectorDefinition(
        ENRICHMENT_SOURCE.ABUSEIPDB
      );
      expect(abuseIpdbDefinition).toBeDefined();
      const fetch = abuseIpdbDefinition!.fetch;
      abuseIpdbDefinition!.fetch = (...args) => {
        fetchSpy();
        return fetch(...args);
      };

      const result = await enrichRegisteredLiveConnector(ENRICHMENT_SOURCE.ABUSEIPDB, {
        value: "example.com",
        type: IOC_TYPE.DOMAIN,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
        errorMessage: "AbuseIPDB supports IPv4 addresses only.",
      });
    });

    it("returns skipped for unsupported types on a registered stub connector", async () => {
      const fetchSpy = vi.fn();
      registerConnectorDefinition(
        buildStubDefinition({
          supportedIocTypes: [IOC_TYPE.IPV4],
          fetch: fetchSpy,
        })
      );

      const result = await enrichRegisteredLiveConnector(ENRICHMENT_SOURCE.OTX, {
        value: "https://example.com/malware",
        type: IOC_TYPE.URL,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        sourceId: ENRICHMENT_SOURCE.OTX,
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
        errorMessage: "OTX does not support this indicator type.",
      });
    });
  });

  it("registers built-in live connectors in stable order", () => {
    registerBuiltInLiveConnectors();

    expect(listRegisteredConnectorIds()).toEqual(LIVE_ENRICHMENT_SOURCE_ORDER);
    for (const sourceId of LIVE_ENRICHMENT_SOURCE_ORDER) {
      expect(lookupConnectorDefinition(sourceId)?.capabilities.liveEnrichment).toBe(
        true
      );
    }
  });

  it("initializes the default registry once", () => {
    ensureDefaultConnectorRegistry();
    expect(listRegisteredConnectorIds()).toEqual(LIVE_ENRICHMENT_SOURCE_ORDER);

    clearConnectorRegistry();
    ensureDefaultConnectorRegistry();
    expect(listRegisteredConnectorIds()).toEqual([]);
  });

  it("registers native AbuseIPDB and OTX connector definitions through the bootstrap path", async () => {
    clearConnectorRegistry();
    registerBuiltInLiveConnectors();

    const abuseIpdbDefinition = lookupConnectorDefinition(
      ENRICHMENT_SOURCE.ABUSEIPDB
    );
    expect(abuseIpdbDefinition).toBeDefined();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ipAddress: "8.8.8.8",
          abuseConfidenceScore: 12,
        },
      }),
      headers: new Headers(),
    });

    const fetchResult = await abuseIpdbDefinition!.fetch(
      {
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      },
      {
        fetch: mockFetch,
        getApiKey: async () => "registry-test-key",
      }
    );
    expect(fetchResult.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const normalized = abuseIpdbDefinition!.normalize(
      (fetchResult as { payload: unknown }).payload,
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 }
    );
    expect(normalized?.summary).toContain("12");

    const otxDefinition = lookupConnectorDefinition(ENRICHMENT_SOURCE.OTX);
    expect(otxDefinition?.supportedIocTypes).toContain(IOC_TYPE.DOMAIN);
    expect(otxDefinition?.capabilities.authorityTier).toBe(
      CONNECTOR_AUTHORITY_TIER.COMMUNITY
    );
  });

  it("exposes live vs pivot-only and authority tier metadata for all sources", () => {
    const metadata = listConnectorCapabilityMetadata();

    expect(metadata).toHaveLength(ENRICHMENT_SOURCE_ORDER.length);
    expect(lookupConnectorCapabilityMetadata(ENRICHMENT_SOURCE.OTX)).toEqual(
      getConnectorCapabilityMetadata(ENRICHMENT_SOURCE.OTX)
    );
    expect(getConnectorCapabilityMetadata(ENRICHMENT_SOURCE.ABUSEIPDB)).toEqual({
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      liveEnrichment: true,
      pivotOnly: false,
      requiresApiKey: true,
      supportsHealthCheck: true,
      authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
    });
    expect(getConnectorCapabilityMetadata(ENRICHMENT_SOURCE.OTX)).toMatchObject({
      liveEnrichment: true,
      pivotOnly: false,
      authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
    });
    expect(getConnectorCapabilityMetadata(ENRICHMENT_SOURCE.VIRUSTOTAL)).toEqual({
      sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
      liveEnrichment: false,
      pivotOnly: true,
      requiresApiKey: true,
      supportsHealthCheck: false,
      authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
    });

    for (const entry of metadata) {
      expect(entry.liveEnrichment).not.toBe(entry.pivotOnly);
    }
  });

  it("rejects connector definitions whose capabilities drift from metadata", () => {
    expect(() =>
      registerConnectorDefinition(
        buildStubDefinition({
          capabilities: {
            liveEnrichment: true,
            pivotOnly: false,
            requiresApiKey: true,
            supportsHealthCheck: true,
            authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
          },
        })
      )
    ).toThrow(ConnectorRegistryError);
  });
});
