/**
 * Display-only Intel Feed vendor ordering helpers.
 * Never mutates enrichment results, availability, or cache.
 *
 * Phase 16E — ordering is registry-priority deterministic; never sorted by result severity.
 */

import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import type { IocType } from "../lib/iocRegex";
import {
  ENRICHMENT_ASSESSMENT_KIND,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import { orderSourcesForVendorEvidence } from "../lib/enrichmentSourceApplicability";

export type IntelSourceAvailability = {
  enabled: boolean;
  configured: boolean;
};

export type IntelSourceAvailabilityRecord = Partial<
  Record<EnrichmentSourceId, IntelSourceAvailability>
>;

/** Display-only sort groups retained for status classification tests. */
export type IntelVendorSortGroup = 0 | 1 | 2 | 3;

export function resolveIntelVendorNumericScore(
  source: HoverCardSourceEntry | undefined
): number | null {
  const assessment = source?.assessment;
  if (
    assessment?.kind !== ENRICHMENT_ASSESSMENT_KIND.RISK ||
    typeof assessment.signal !== "number" ||
    !Number.isFinite(assessment.signal)
  ) {
    return null;
  }
  return Math.round(assessment.signal);
}

export function resolveIntelVendorCardStatus(
  sourceId: EnrichmentSourceId,
  source: HoverCardSourceEntry | undefined,
  availability: IntelSourceAvailability | undefined
): HoverCardSourceEntry["status"] | "pivot-only" | "disabled" | "not-configured" | "not-enriched" {
  if (source) {
    return source.status;
  }
  const definition = getEnrichmentSourceDefinition(sourceId);
  if (!definition.liveConnector) {
    return "pivot-only";
  }
  if (availability?.enabled === false) {
    return "disabled";
  }
  if (availability?.configured === false) {
    return "not-configured";
  }
  return "not-enriched";
}

export function resolveIntelVendorSortGroup(
  status: string,
  numericScore: number | null
): IntelVendorSortGroup {
  if (numericScore !== null) {
    return 0;
  }
  if (status === "disabled") {
    return 3;
  }
  if (status === "pivot-only") {
    return 2;
  }
  return 1;
}

/**
 * Derived display order only — registry priority per IOC type; never result severity.
 */
export function orderIntelFeedVendorSourceIds(
  sourceIds: readonly EnrichmentSourceId[],
  iocType: IocType,
  _sourceEntryById: ReadonlyMap<EnrichmentSourceId, HoverCardSourceEntry>,
  availability: IntelSourceAvailabilityRecord
): EnrichmentSourceId[] {
  return orderSourcesForVendorEvidence(iocType, sourceIds, availability);
}
