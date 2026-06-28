import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  enrichmentSourceSupportsIocType,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import type { EnrichmentSourceEnabledRecord } from "./storage";
import {
  ENRICHMENT_SOURCE_STATUS,
  type EnrichmentSourceResult,
} from "./enrichment";

export { LIVE_ENRICHMENT_SOURCE_ORDER };

export function isEnrichmentSourceEnabled(
  enabled: EnrichmentSourceEnabledRecord,
  sourceId: EnrichmentSourceId
): boolean {
  return enabled[sourceId] === true;
}

export function liveEnrichmentSupportsIocType(
  sourceId: EnrichmentSourceId,
  iocType: IocType
): boolean {
  const definition = getEnrichmentSourceDefinition(sourceId);
  return (
    definition.liveConnector &&
    enrichmentSourceSupportsIocType(sourceId, iocType)
  );
}

export function listEnabledLiveEnrichmentSourceIds(
  enabled: EnrichmentSourceEnabledRecord,
  iocType: IocType
): EnrichmentSourceId[] {
  return LIVE_ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) =>
      isEnrichmentSourceEnabled(enabled, sourceId) &&
      liveEnrichmentSupportsIocType(sourceId, iocType)
  );
}

export function resolveEnabledLiveEnrichmentSourceId(
  enabled: EnrichmentSourceEnabledRecord,
  iocType: IocType
): EnrichmentSourceId | null {
  const sourceIds = listEnabledLiveEnrichmentSourceIds(enabled, iocType);
  return sourceIds[0] ?? null;
}

export function pickPrimaryEnrichmentSource(
  sources: readonly EnrichmentSourceResult[]
): EnrichmentSourceResult | undefined {
  if (sources.length === 0) {
    return undefined;
  }
  const byId = new Map(sources.map((source) => [source.sourceId, source]));
  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    const candidate = byId.get(sourceId);
    if (candidate?.status === ENRICHMENT_SOURCE_STATUS.OK) {
      return candidate;
    }
  }
  return sources[0];
}

export { ENRICHMENT_SOURCE };
