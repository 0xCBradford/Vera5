import {
  createAbuseIpdbConnectorDefinition,
} from "./abuseipdbConnector";
import {
  createCensysConnectorDefinition,
} from "./censysConnector";
import {
  buildConnectorProfileRateLimitMetadata,
  getEnrichmentSourceQuotaSummary,
} from "./connectorProfileExport";
import {
  CONNECTOR_AUTHORITY_TIER,
  enrichWithConnectorDefinition,
  isConnectorDefinition,
  type ConnectorCapabilityFlags,
  type ConnectorCapabilityMetadata,
  type ConnectorDefinition,
  type ConnectorRateLimitPolicy,
} from "./connectorDefinition";
import {
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import {
  createGreynoiseConnectorDefinition,
} from "./greynoiseConnector";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  getEnrichmentSourceDefinition,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import {
  createOtxConnectorDefinition,
} from "./otxConnector";
import {
  createRdapWhoisConnectorDefinition,
} from "./rdapWhoisConnector";
import {
  createShodanConnectorDefinition,
} from "./shodanConnector";
import {
  createUrlscanConnectorDefinition,
} from "./urlscanConnector";

export class ConnectorRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorRegistryError";
  }
}

const registry = new Map<EnrichmentSourceId, ConnectorDefinition>();

let defaultRegistryInitialized = false;

const CONNECTOR_DEFINITION_BUILDERS: Partial<
  Record<EnrichmentSourceId, () => ConnectorDefinition>
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: () =>
    createAbuseIpdbConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.ABUSEIPDB),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.ABUSEIPDB),
    }),
  [ENRICHMENT_SOURCE.OTX]: () =>
    createOtxConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.OTX),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.OTX),
    }),
  [ENRICHMENT_SOURCE.URLSCAN]: () =>
    createUrlscanConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.URLSCAN),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.URLSCAN),
    }),
  [ENRICHMENT_SOURCE.GREYNOISE]: () =>
    createGreynoiseConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.GREYNOISE),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.GREYNOISE),
    }),
  [ENRICHMENT_SOURCE.SHODAN]: () =>
    createShodanConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.SHODAN),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.SHODAN),
    }),
  [ENRICHMENT_SOURCE.CENSYS]: () =>
    createCensysConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.CENSYS),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.CENSYS),
    }),
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: () =>
    createRdapWhoisConnectorDefinition({
      rateLimitPolicy: buildRateLimitPolicyForSource(ENRICHMENT_SOURCE.RDAP_WHOIS),
      capabilities: buildCapabilityFlagsForSource(ENRICHMENT_SOURCE.RDAP_WHOIS),
    }),
};

const CONNECTOR_AUTHORITY_TIER_BY_SOURCE: Record<
  EnrichmentSourceId,
  (typeof CONNECTOR_AUTHORITY_TIER)[keyof typeof CONNECTOR_AUTHORITY_TIER]
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.OTX]: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.URLSCAN]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.GREYNOISE]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.SHODAN]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]:
    CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.PULSEDIVE]: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  [ENRICHMENT_SOURCE.CENSYS]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
  [ENRICHMENT_SOURCE.THREATFOX]: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  [ENRICHMENT_SOURCE.URLHAUS]: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
};

function buildRateLimitPolicyForSource(
  sourceId: EnrichmentSourceId
): ConnectorRateLimitPolicy {
  const metadata = buildConnectorProfileRateLimitMetadata().sources.find(
    (entry) => entry.sourceId === sourceId
  );
  if (!metadata) {
    return {
      requestTimeoutMs: null,
      quotaSummary: getEnrichmentSourceQuotaSummary(sourceId),
      rateLimitHeaderHints: [],
    };
  }
  return {
    requestTimeoutMs:
      metadata.requestTimeoutSeconds === null
        ? null
        : metadata.requestTimeoutSeconds * 1000,
    quotaSummary: metadata.quotaSummary,
    rateLimitHeaderHints: metadata.rateLimitHeaderHints,
  };
}

function buildCapabilityFlagsForSource(
  sourceId: EnrichmentSourceId
): ConnectorCapabilityFlags {
  const definition = getEnrichmentSourceDefinition(sourceId);
  return {
    liveEnrichment: definition.liveConnector,
    pivotOnly: !definition.liveConnector,
    requiresApiKey: definition.requiresApiKey,
    supportsHealthCheck: definition.liveConnector,
    authorityTier:
      CONNECTOR_AUTHORITY_TIER_BY_SOURCE[sourceId] ??
      CONNECTOR_AUTHORITY_TIER.UNKNOWN,
  };
}

export function getConnectorCapabilityMetadata(
  sourceId: EnrichmentSourceId
): ConnectorCapabilityMetadata {
  return {
    sourceId,
    ...buildCapabilityFlagsForSource(sourceId),
  };
}

export function listConnectorCapabilityMetadata(): readonly ConnectorCapabilityMetadata[] {
  return ENRICHMENT_SOURCE_ORDER.map((sourceId) =>
    getConnectorCapabilityMetadata(sourceId)
  );
}

export function lookupConnectorCapabilityMetadata(
  sourceId: EnrichmentSourceId
): ConnectorCapabilityMetadata | undefined {
  if (!ENRICHMENT_SOURCE_ORDER.includes(sourceId)) {
    return undefined;
  }
  return getConnectorCapabilityMetadata(sourceId);
}

function assertCapabilityMetadataMatchesDefinition(
  definition: ConnectorDefinition
): void {
  const expected = getConnectorCapabilityMetadata(definition.id);
  const actual = definition.capabilities;
  if (
    actual.liveEnrichment !== expected.liveEnrichment ||
    actual.pivotOnly !== expected.pivotOnly ||
    actual.requiresApiKey !== expected.requiresApiKey ||
    actual.supportsHealthCheck !== expected.supportsHealthCheck ||
    actual.authorityTier !== expected.authorityTier
  ) {
    throw new ConnectorRegistryError(
      `Connector ${definition.id} capabilities do not match registry metadata.`
    );
  }
}

function createBuiltInLiveConnectorDefinition(
  sourceId: EnrichmentSourceId
): ConnectorDefinition {
  const builder = CONNECTOR_DEFINITION_BUILDERS[sourceId];
  if (!builder) {
    throw new ConnectorRegistryError(
      `No connector definition builder registered for ${sourceId}.`
    );
  }
  return builder();
}

export function registerConnectorDefinition(
  definition: ConnectorDefinition
): void {
  if (!isConnectorDefinition(definition)) {
    throw new ConnectorRegistryError("Invalid connector definition.");
  }
  assertCapabilityMetadataMatchesDefinition(definition);
  if (registry.has(definition.id)) {
    throw new ConnectorRegistryError(
      `Connector ${definition.id} is already registered.`
    );
  }
  registry.set(definition.id, definition);
}

export function lookupConnectorDefinition(
  sourceId: EnrichmentSourceId
): ConnectorDefinition | undefined {
  return registry.get(sourceId);
}

export function hasRegisteredConnector(sourceId: EnrichmentSourceId): boolean {
  return registry.has(sourceId);
}

export function listRegisteredConnectorIds(): readonly EnrichmentSourceId[] {
  return ENRICHMENT_SOURCE_ORDER.filter((sourceId) => registry.has(sourceId));
}

export function unregisterConnectorDefinition(
  sourceId: EnrichmentSourceId
): boolean {
  return registry.delete(sourceId);
}

export function clearConnectorRegistry(): void {
  registry.clear();
}

export function registerBuiltInLiveConnectors(): void {
  for (const sourceId of LIVE_ENRICHMENT_SOURCE_ORDER) {
    if (registry.has(sourceId)) {
      continue;
    }
    registerConnectorDefinition(createBuiltInLiveConnectorDefinition(sourceId));
  }
}

export function ensureDefaultConnectorRegistry(): void {
  if (defaultRegistryInitialized) {
    return;
  }
  defaultRegistryInitialized = true;
  registerBuiltInLiveConnectors();
}

export function resetDefaultConnectorRegistryState(): void {
  clearConnectorRegistry();
  defaultRegistryInitialized = false;
}

export async function enrichRegisteredLiveConnector(
  sourceId: EnrichmentSourceId,
  ioc: EnrichmentIoc
): Promise<EnrichmentSourceResult | null> {
  const definition = lookupConnectorDefinition(sourceId);
  if (!definition?.capabilities.liveEnrichment) {
    return null;
  }
  return enrichWithConnectorDefinition(definition, ioc);
}
