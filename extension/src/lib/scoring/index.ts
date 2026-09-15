/**
 * Phase 21A–21C — Scoring Engine v2 architecture barrel.
 *
 * Additive / parallel to legacy lib/scoring.ts.
 * Production Scorecard remains on legacy until explicit cutover (Phase 21E+).
 * Phase 21D: offline calibration harness + RC1 policy (shadow only).
 */

export {
  SCORING_SCHEMA_VERSION,
  SCORING_MODE,
  SIGNAL_DIRECTION,
  SCORING_SIGNAL_STATUS,
  COVERAGE_LABEL,
  DISAGREEMENT_LEVEL,
  SCORING_EXCLUSION_REASON,
  COMPOSITE_SCORE_STATUS,
  type ScoringMode,
  type SignalDirection,
  type ScoringSignalStatus,
  type ScoringBasis,
  type ScoringSignal,
  type ScoringTarget,
  type EvidenceCoverage,
  type SignalDisagreement,
  type ScoreContributor,
  type CoverageLabel,
  type DisagreementLevel,
  type ScoringExclusion,
  type ScoringExclusionReason,
  type CompositeScoreStatus,
  type CompositeScoreResult,
} from "./scoringTypes";

export {
  SCORING_BASIS_CODE,
  SCORING_BASIS_LABEL,
  scoringBasis,
  type ScoringBasisCode,
} from "./scoringBasisCodes";

export {
  SCORING_CALIBRATION,
  SCORING_CALIBRATION_UNCALIBRATED,
} from "./scoringCalibration";

export {
  COMPOSITE_POLICY_UNCALIBRATED,
  COVERAGE_RATIO_THRESHOLDS,
  DISAGREEMENT_SPREAD_THRESHOLDS,
  DIRECTIONAL_CONFLICT_MIN_CONFIDENCE,
  COMPOSITE_FLOAT_TOLERANCE,
  SCORING_ENGINE_MODE,
  DEFAULT_SCORING_ENGINE_MODE,
  type ScoringEngineMode,
} from "./scoringCompositePolicy";

export type {
  ScoringEvidence,
  AbuseIpdbScoringEvidence,
  VirustotalScoringEvidence,
  OtxScoringEvidence,
  UrlscanScoringEvidence,
  GreynoiseScoringEvidence,
} from "./scoringEvidence";

export {
  isScoringEvidence,
  normalizeScoringEvidence,
} from "./scoringEvidence";

export {
  SCORING_WEIGHT_PLACEHOLDER,
  SCORING_WEIGHTS_UNCALIBRATED,
  SOURCE_SCORING_POLICIES,
  getSourceScoringPolicy,
  getSourceTargetScoringPolicy,
  isSourceScoringApplicable,
  getSourceScoringMode,
  getSourceBaseWeight,
  isSourceNumericScoringEnabled,
  listScoringApplicableSources,
  listNumericScoringSources,
  listContextOnlySources,
  type SourceScoringPolicy,
  type SourceTargetScoringPolicy,
} from "./scoringPolicy";

export {
  hasScoringRisk,
  computeEffectiveWeight,
  isCompositeEligible,
  isNumericCompositeParticipant,
  serializeScoringSignalForDiagnostics,
} from "./scoringSignal";

export {
  validateScoringSignal,
  type ScoringSignalValidationIssue,
  type ScoringSignalValidationResult,
} from "./scoringValidation";

export {
  type SourceScoringAdapter,
  type SourceScoringAdapterInput,
} from "./scoringAdapter";

export {
  createEmptyEvidenceCoverage,
  calculateEvidenceCoverage,
  coverageLabelFromRatio,
  listPolicyContextSources,
  listPolicyScoringSources,
  type SourceObservationState,
  type CoverageRunContext,
} from "./scoringCoverage";

export {
  createEmptySignalDisagreement,
  calculateSignalDisagreement,
  calculateWeightedStdDev,
  calculateDirectionalConflict,
  disagreementLevelFromSpread,
} from "./scoringDisagreement";

export {
  toScoreContributor,
  calculateScoreContributors,
  findStrongestPositive,
  findStrongestNegative,
  listRiskDirectionSources,
  listBenignDirectionSources,
} from "./scoringContributors";

export {
  deriveAbuseIPDBRisk,
  deriveAbuseIPDBConfidence,
  deriveVTRisk,
  deriveVTConfidence,
  deriveOTXRisk,
  deriveOTXConfidence,
  deriveURLScanRisk,
  deriveGreyNoiseInterpretation,
} from "./scoringDerivation";

export {
  SCORING_ADAPTER_REGISTRY,
  getScoringAdapter,
  evaluateSourceSignal,
  evaluateShadowScoringSignals,
  compareLegacyAssessmentToV2Signal,
  diagnoseScoringSignal,
  createScoringTarget,
  type LegacyVsV2Comparison,
} from "./scoringAdapterRegistry";

export {
  clampScore,
  roundCompositeScore,
  calculateWeightedComposite,
  deriveSeverityFromScore,
  approxEqual,
} from "./scoringCompositeMath";

export {
  classifyScoringExclusion,
  collectScoringExclusions,
} from "./scoringExclusions";

export {
  computeCompositeScore,
  safeComputeCompositeScore,
  type ComputeCompositeScoreInput,
} from "./scoringComposite";

export {
  computeShadowScoringComparison,
  serializeScoringComparisonForDiagnostics,
  computeCompositeScoreFromSignals,
  getScoringEngineMode,
  setScoringEngineModeForDevelopment,
  resetScoringEngineMode,
  type ScoringComparison,
} from "./scoringShadow";

export {
  SCORING_BENCHMARK_VERSION,
  SCORING_BENCHMARK_VERSION_V1,
  SCORING_CALIBRATION_POLICY_BASELINE_ID,
  SCORING_CALIBRATION_POLICY_RC1_ID,
  SCORING_CALIBRATION_POLICY_RC2_ID,
  type ScoringCalibrationPolicy,
  type CutoverReadiness,
  type IocCutoverReadiness,
  type CoverageThresholds,
  type DisagreementThresholds,
  type SourceIocWeightMatrix,
} from "./calibration/calibrationTypes";

export {
  CALIBRATION_POLICY_BASELINE,
  CALIBRATION_POLICY_RC1,
  CALIBRATION_POLICY_VARIANTS,
  RECOMMENDED_CALIBRATION_POLICY,
  getPolicyWeight,
  diffCalibrationPolicies,
} from "./calibration/calibrationPolicies";

export {
  getScoringBenchmarkCorpus,
  getScoringBenchmarkCorpusV1,
  getScoringBenchmarkCorpusByVersion,
  getBenchmarkCorpusMeta,
  getBenchmarkCorpusMetaV1,
  auditCorpusDuplication,
} from "./calibration/benchmarkCorpus";

export { PROVIDER_READINESS } from "./calibration/providerReadiness";

export {
  runBenchmarkCase,
  runCalibrationHarness,
  materializeBenchmarkSignals,
  ablateSources,
  sensitivitySweep,
} from "./calibration/calibrationHarness";

export { buildCalibrationReport } from "./calibration/calibrationReport";

export {
  withScoringCalibrationConstants,
  getScoringCalibrationConstants,
} from "./scoringCalibration";
