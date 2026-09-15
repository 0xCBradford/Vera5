/**
 * Phase 21D / 21D.1 — benchmark case contract + provenance.
 * Prefer severity ranges / behavioral assertions over exact scores.
 */

import type { EnrichmentSourceId } from "../../enrichmentSourceRegistry";
import type { IocType } from "../../iocRegex";
import type { CoverageRunContext } from "../scoringCoverage";
import type { ScoringEvidence } from "../scoringEvidence";
import type { CoverageLabel, ScoringSignal } from "../scoringTypes";

export const BENCHMARK_RISK_CLASS = {
  BENIGN_OR_LOW_RISK: "BENIGN_OR_LOW_RISK",
  SUSPICIOUS: "SUSPICIOUS",
  HIGH_RISK: "HIGH_RISK",
  KNOWN_MALICIOUS: "KNOWN_MALICIOUS",
  AMBIGUOUS: "AMBIGUOUS",
  UNSCORED: "UNSCORED",
} as const;

export type BenchmarkRiskClass =
  (typeof BENCHMARK_RISK_CLASS)[keyof typeof BENCHMARK_RISK_CLASS];

export const BENCHMARK_CATEGORY = {
  ENGINE_INVARIANT: "ENGINE_INVARIANT",
  PROVIDER_SEMANTICS: "PROVIDER_SEMANTICS",
  STRONG_RISK: "STRONG_RISK",
  LOW_TRUSTED: "LOW_TRUSTED",
  CONFLICT: "CONFLICT",
  SPARSE: "SPARSE",
  ERROR_PARTIAL: "ERROR_PARTIAL",
  CONTEXT_ONLY: "CONTEXT_ONLY",
  VALID_ZERO: "VALID_ZERO",
  NO_SIGNAL: "NO_SIGNAL",
  MATCH: "MATCH",
  IOC_TYPE: "IOC_TYPE",
  AMBIGUOUS_MIXED: "AMBIGUOUS_MIXED",
  ADVERSARIAL: "ADVERSARIAL",
} as const;

export type BenchmarkCategory =
  (typeof BENCHMARK_CATEGORY)[keyof typeof BENCHMARK_CATEGORY];

export const BENCHMARK_PROVENANCE_KIND = {
  SYNTHETIC_MATH: "SYNTHETIC_MATH",
  ARCHITECTURE_INVARIANT: "ARCHITECTURE_INVARIANT",
  VENDOR_FIXTURE_POSITIVE: "VENDOR_FIXTURE_POSITIVE",
  VENDOR_FIXTURE_NEGATIVE: "VENDOR_FIXTURE_NEGATIVE",
  EXPLICIT_TRUSTED_CLASSIFICATION: "EXPLICIT_TRUSTED_CLASSIFICATION",
  CONFIRMED_INTEL_MATCH: "CONFIRMED_INTEL_MATCH",
  MANUALLY_REVIEWED_MIXED: "MANUALLY_REVIEWED_MIXED",
  REGRESSION_CAPTURE: "REGRESSION_CAPTURE",
} as const;

export type BenchmarkProvenanceKind =
  (typeof BENCHMARK_PROVENANCE_KIND)[keyof typeof BENCHMARK_PROVENANCE_KIND];

export type BenchmarkCaseQuality = "HIGH" | "MEDIUM" | "SYNTHETIC";

export type BenchmarkProvenance = {
  kind: BenchmarkProvenanceKind;
  /** Why this expected class is trusted. Required for non-synthetic labels. */
  rationale: string;
  /** Optional fixture path / source id. */
  fixtureRef?: string;
  /** Optional fixture capture date (ISO) — snapshot only, not a scoring dimension. */
  capturedAt?: string;
};

export type BenchmarkExpected = {
  riskClass?: BenchmarkRiskClass;
  /** Legacy COMPOSITE_RISK_LABEL values: low | suspicious | high | critical */
  expectedSeverity?: string | null;
  acceptableSeverity?: Array<string | null>;
  minScore?: number;
  maxScore?: number;
  /** Exact score only for pure arithmetic cases. */
  exactScore?: number;
  expectScored?: boolean;
  expectedCoverageClass?: CoverageLabel;
  expectDisagreement?: boolean;
  expectDirectionalConflict?: boolean;
  expectNullScore?: boolean;
  notes?: string;
};

export type BenchmarkEvidenceInput = {
  source: EnrichmentSourceId;
  /** Pre-built adapter-ready enrichment status path via scoringEvidence. */
  scoringEvidence?: ScoringEvidence;
  /** Or supply a fully formed signal (synthetic / invariant). */
  signal?: ScoringSignal;
  status?: "ok" | "error" | "skipped";
  summary?: string;
  errorCode?: string;
};

export type ScoringBenchmarkCase = {
  id: string;
  description: string;
  category: BenchmarkCategory;
  targetType: IocType;
  targetValue?: string;
  /** GOLDEN = invariants; CALIBRATION = tune; HOLDOUT = independent validation. */
  set: "calibration" | "holdout" | "golden";
  provenance: BenchmarkProvenance;
  expected: BenchmarkExpected;
  /** Prefer signals for synthetic math; evidence for provider semantics. */
  inputs: BenchmarkEvidenceInput[];
  runContext?: CoverageRunContext;
  /** Provenance strength / fixture quality. */
  quality?: BenchmarkCaseQuality;
  /** Related case ids when one IOC/fixture yields multiple scenarios. */
  relatedCaseIds?: readonly string[];
};

export type ExcludedBenchmarkCase = {
  id: string;
  reason: string;
  proposedCategory?: BenchmarkCategory;
};
