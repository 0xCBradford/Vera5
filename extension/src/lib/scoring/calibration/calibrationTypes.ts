/**
 * Phase 21D — versioned scoring calibration policy contract.
 *
 * Calibration tunes weights/constants/thresholds.
 * It does NOT rewrite adapter semantics (no-match≠benign, context≠vote, errors≠risk).
 */

import type { EnrichmentSourceId } from "../../enrichmentSourceRegistry";
import type { IocType } from "../../iocRegex";
import type { ScoringAdapterConstants } from "./adapterConstantsType";

export type { ScoringAdapterConstants } from "./adapterConstantsType";

export const SCORING_BENCHMARK_VERSION_V1 = 1 as const;
/** Current production-readiness corpus (Phase 21D.1). */
export const SCORING_BENCHMARK_VERSION = 2 as const;
export const SCORING_CALIBRATION_POLICY_BASELINE_ID = "vera5-v2-baseline-uncalibrated" as const;
export const SCORING_CALIBRATION_POLICY_RC1_ID = "vera5-v2-rc1" as const;
export const SCORING_CALIBRATION_POLICY_RC2_ID = "vera5-v2-rc2" as const;

export type CoverageThresholds = {
  NONE: number;
  LIMITED: number;
  PARTIAL: number;
  STRONG: number;
  COMPLETE: number;
};

export type DisagreementThresholds = {
  NONE: number;
  LOW: number;
  MODERATE: number;
  HIGH: number;
};

/** source → IOC type → baseWeight (0–1). Missing entry = 0 / not applicable. */
export type SourceIocWeightMatrix = Partial<
  Record<EnrichmentSourceId, Partial<Record<IocType, number>>>
>;

export type ScoringCalibrationPolicy = {
  /** Calibration policy id (distinct from schemaVersion). */
  calibrationVersion: string;
  /** Scoring schema this policy targets. */
  schemaVersion: 2;
  /** True when weights/constants are still provisional placeholders. */
  uncalibrated: boolean;
  description: string;
  sourceWeights: SourceIocWeightMatrix;
  adapterConstants: ScoringAdapterConstants;
  coverageThresholds: CoverageThresholds;
  disagreementThresholds: DisagreementThresholds;
  directionalConflictMinConfidence: number;
};

export type CutoverReadiness = "READY" | "READY_WITH_CAVEATS" | "NOT_READY";

export type IocCutoverReadiness = {
  iocType: IocType;
  readiness: CutoverReadiness;
  caseCount: number;
  notes: string;
};
