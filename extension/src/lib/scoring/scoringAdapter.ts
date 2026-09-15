/**
 * Phase 21A — Source Scoring Adapter interface.
 *
 * Phase 21B implements adapters. Adapters MUST:
 * - operate on already-normalized enrichment data
 * - make ZERO network requests
 * - not parse raw HTTP responses when normalization exists
 */

import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";
import type { SourceScoringPolicy, SourceTargetScoringPolicy } from "./scoringPolicy";
import type { ScoringSignal, ScoringTarget } from "./scoringTypes";

export type SourceScoringAdapterInput<TNormalized = unknown> = {
  target: ScoringTarget;
  normalized: TNormalized;
  policy: SourceScoringPolicy;
  targetPolicy: SourceTargetScoringPolicy | null;
};

/**
 * Common adapter contract for Phase 21B+.
 * Synchronous by default — scoring must not await vendor I/O.
 */
export interface SourceScoringAdapter<TNormalized = unknown> {
  readonly source: EnrichmentSourceId;

  supports(targetType: IocType): boolean;

  /**
   * Evaluate normalized enrichment into a ScoringSignal.
   * Must not perform network I/O or DNS.
   */
  evaluate(input: SourceScoringAdapterInput<TNormalized>): ScoringSignal;
}
