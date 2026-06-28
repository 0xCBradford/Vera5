import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  enrichmentSourceSupportsIocType,
  formatUnsupportedIndicatorTypeMessage,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import { censysLiveSupportsIocType } from "./censysConnector";
import type { IocType } from "./iocRegex";
import type { EnrichmentSourceEnabledRecord } from "./storage";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  createSkippedSourceResult,
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
  if (!definition.liveConnector) {
    return false;
  }
  if (sourceId === ENRICHMENT_SOURCE.CENSYS) {
    return censysLiveSupportsIocType(iocType);
  }
  return enrichmentSourceSupportsIocType(sourceId, iocType);
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

export function hasAnyEnabledLiveEnrichmentSource(
  enabled: EnrichmentSourceEnabledRecord
): boolean {
  return LIVE_ENRICHMENT_SOURCE_ORDER.some((sourceId) =>
    isEnrichmentSourceEnabled(enabled, sourceId)
  );
}

export function buildSkippedLiveEnrichmentUnsupportedTypeResults(
  enabled: EnrichmentSourceEnabledRecord
): EnrichmentSourceResult[] {
  return LIVE_ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
    isEnrichmentSourceEnabled(enabled, sourceId)
  ).map((sourceId) =>
    createSkippedSourceResult(
      sourceId,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      formatUnsupportedIndicatorTypeMessage(ENRICHMENT_SOURCE_LABELS[sourceId])
    )
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
