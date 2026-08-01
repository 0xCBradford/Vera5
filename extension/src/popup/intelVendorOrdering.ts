/**
 * Display-only Intel Feed vendor ordering helpers.
 * Never mutates enrichment results, availability, or cache.
 */

import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import {
  ENRICHMENT_ASSESSMENT_KIND,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";

export type IntelSourceAvailability = {
  enabled: boolean;
  configured: boolean;
};

export type IntelSourceAvailabilityRecord = Partial<
  Record<EnrichmentSourceId, IntelSourceAvailability>
>;

/** Display-only sort groups for INTEL FEED vendor evidence. */
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
 * Derived display order only — never mutates sourceEntries, availability, or cache.
 * Group 0: valid finite RISK scores (including 0), descending
 * Group 1: enabled operational / non-scored states, stable registry order
 * Group 2: pivot-only, stable registry order
 * Group 3: disabled / unselected, stable registry order
 */
export function orderIntelFeedVendorSourceIds(
  sourceIds: readonly EnrichmentSourceId[],
  sourceEntryById: ReadonlyMap<EnrichmentSourceId, HoverCardSourceEntry>,
  availability: IntelSourceAvailabilityRecord
): EnrichmentSourceId[] {
  return [...sourceIds]
    .map((sourceId, originalIndex) => {
      const source = sourceEntryById.get(sourceId);
      const status = resolveIntelVendorCardStatus(sourceId, source, availability[sourceId]);
      const numericScore = resolveIntelVendorNumericScore(source);
      return {
        sourceId,
        originalIndex,
        sortGroup: resolveIntelVendorSortGroup(status, numericScore),
        numericScore,
      };
    })
    .sort((left, right) => {
      if (left.sortGroup !== right.sortGroup) {
        return left.sortGroup - right.sortGroup;
      }
      if (left.sortGroup === 0 && right.sortGroup === 0) {
        const scoreDelta = (right.numericScore ?? 0) - (left.numericScore ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
      }
      return left.originalIndex - right.originalIndex;
    })
    .map((entry) => entry.sourceId);
}
