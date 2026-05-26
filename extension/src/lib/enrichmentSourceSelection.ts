import {
  ENRICHMENT_SOURCE,
  type EnrichmentSourceId,
} from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import type { EnrichmentSourceEnabledRecord } from "./storage";
import {
  ENRICHMENT_SOURCE_STATUS,
  type EnrichmentSourceResult,
} from "./enrichment";

export const LIVE_ENRICHMENT_SOURCE_ORDER: readonly EnrichmentSourceId[] = [
  ENRICHMENT_SOURCE.ABUSEIPDB,
  ENRICHMENT_SOURCE.OTX,
];

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
  if (sourceId === ENRICHMENT_SOURCE.ABUSEIPDB) {
    return iocType === IOC_TYPE.IPV4;
  }
  if (sourceId === ENRICHMENT_SOURCE.OTX) {
    return true;
  }
  return false;
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
  for (const sourceId of LIVE_ENRICHMENT_SOURCE_ORDER) {
    const candidate = byId.get(sourceId);
    if (candidate?.status === ENRICHMENT_SOURCE_STATUS.OK) {
      return candidate;
    }
  }
  return sources[0];
}
