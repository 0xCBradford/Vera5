import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import type { EnrichmentSourceEnabledRecord } from "./storage";
import {
  ENRICHMENT_SOURCE_STATUS,
  type EnrichmentSourceResult,
} from "./enrichment";
import {
  buildSkippedLiveEnrichmentUnsupportedTypeResults,
  createNoApplicableLiveSourcesResults,
  getApplicableSources,
  listApplicableLiveEnrichmentSourceIds,
  listEnabledApplicableLiveEnrichmentSourceIds,
  liveEnrichmentSupportsIocType,
  listVendorEvidenceSourceIds,
  orderSourcesForVendorEvidence,
  explainSourceIneligibilityReason,
  NO_APPLICABLE_LIVE_SOURCES_MESSAGE,
} from "./enrichmentSourceApplicability";

export { LIVE_ENRICHMENT_SOURCE_ORDER };

export {
  ENRICHMENT_SOURCE,
  buildSkippedLiveEnrichmentUnsupportedTypeResults,
  createNoApplicableLiveSourcesResults,
  getApplicableSources,
  listApplicableLiveEnrichmentSourceIds,
  listEnabledApplicableLiveEnrichmentSourceIds,
  liveEnrichmentSupportsIocType,
  listVendorEvidenceSourceIds,
  orderSourcesForVendorEvidence,
  explainSourceIneligibilityReason,
  NO_APPLICABLE_LIVE_SOURCES_MESSAGE,
};

export function isEnrichmentSourceEnabled(
  enabled: EnrichmentSourceEnabledRecord,
  sourceId: EnrichmentSourceId
): boolean {
  return enabled[sourceId] === true;
}

export function listEnabledLiveEnrichmentSourceIds(
  enabled: EnrichmentSourceEnabledRecord,
  iocType: IocType
): EnrichmentSourceId[] {
  return listEnabledApplicableLiveEnrichmentSourceIds(enabled, iocType);
}

export function hasAnyEnabledLiveEnrichmentSource(enabled: EnrichmentSourceEnabledRecord): boolean {
  return LIVE_ENRICHMENT_SOURCE_ORDER.some((sourceId) =>
    isEnrichmentSourceEnabled(enabled, sourceId)
  );
}

export function resolveEnabledLiveEnrichmentSourceId(
  enabled: EnrichmentSourceEnabledRecord,
  iocType: IocType
): EnrichmentSourceId | null {
  const sourceIds = listEnabledApplicableLiveEnrichmentSourceIds(enabled, iocType);
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
