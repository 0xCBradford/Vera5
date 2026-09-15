/**
 * @vitest-environment node
 *
 * Phase 21A — fixture matrix A–N + coverage/explainability shells.
 */
import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import {
  createEmptyEvidenceCoverage,
  createEmptySignalDisagreement,
  hasScoringRisk,
  isCompositeEligible,
  isSourceScoringApplicable,
  serializeScoringSignalForDiagnostics,
  toScoreContributor,
  validateScoringSignal,
} from "./index";
import {
  FIXTURE_APPLICABLE_IOC,
  FIXTURE_CONFIDENCE_0,
  FIXTURE_CONFIDENCE_1,
  FIXTURE_CONTEXT_ONLY,
  FIXTURE_INVALID_CONFIDENCE,
  FIXTURE_INVALID_RISK_101,
  FIXTURE_INVALID_RISK_NAN,
  FIXTURE_INVALID_RISK_NEG,
  FIXTURE_NOT_APPLICABLE,
  FIXTURE_RISK_100,
  FIXTURE_RISK_50,
  FIXTURE_RISK_NULL,
  FIXTURE_RISK_ZERO,
  FIXTURE_UNSUPPORTED_IOC,
} from "./scoringFixtures";

describe("Phase 21A fixtures A–N", () => {
  it("A–F valid fixtures validate as expected", () => {
    expect(validateScoringSignal(FIXTURE_RISK_ZERO).ok).toBe(true);
    expect(hasScoringRisk(FIXTURE_RISK_ZERO)).toBe(true);

    expect(validateScoringSignal(FIXTURE_RISK_100).ok).toBe(true);
    expect(validateScoringSignal(FIXTURE_RISK_50).ok).toBe(true);

    expect(validateScoringSignal(FIXTURE_RISK_NULL).ok).toBe(true);
    expect(hasScoringRisk(FIXTURE_RISK_NULL)).toBe(false);

    expect(validateScoringSignal(FIXTURE_CONFIDENCE_0).ok).toBe(true);
    expect(validateScoringSignal(FIXTURE_CONFIDENCE_1).ok).toBe(true);
  });

  it("G–H context-only and not-applicable are ineligible", () => {
    expect(validateScoringSignal(FIXTURE_CONTEXT_ONLY).ok).toBe(true);
    expect(isCompositeEligible(FIXTURE_CONTEXT_ONLY)).toBe(false);
    expect(validateScoringSignal(FIXTURE_NOT_APPLICABLE).ok).toBe(true);
    expect(isCompositeEligible(FIXTURE_NOT_APPLICABLE)).toBe(false);
  });

  it("I–L invalid fixtures fail validation", () => {
    expect(validateScoringSignal(FIXTURE_INVALID_RISK_NEG).ok).toBe(false);
    expect(validateScoringSignal(FIXTURE_INVALID_RISK_101).ok).toBe(false);
    expect(validateScoringSignal(FIXTURE_INVALID_RISK_NAN).ok).toBe(false);
    expect(validateScoringSignal(FIXTURE_INVALID_CONFIDENCE).ok).toBe(false);
  });

  it("M–N applicability differs by IOC for same source", () => {
    expect(
      isSourceScoringApplicable(FIXTURE_APPLICABLE_IOC.source, FIXTURE_APPLICABLE_IOC.targetType)
    ).toBe(true);
    expect(
      isSourceScoringApplicable(
        FIXTURE_UNSUPPORTED_IOC.source,
        FIXTURE_UNSUPPORTED_IOC.targetType
      )
    ).toBe(false);
  });
});

describe("Phase 21A coverage / explainability shells", () => {
  it("creates empty coverage with applicable vs missing lists", () => {
    const coverage = createEmptyEvidenceCoverage(IOC_TYPE.IPV4);
    expect(coverage.applicableSources).toContain(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(coverage.applicableSources).toContain(ENRICHMENT_SOURCE.SHODAN);
    expect(coverage.scoringSourcesAvailable).toEqual([]);
    expect(coverage.expectedSources).toContain(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(coverage.missingSources).toContain(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(coverage.missingSources).not.toContain(ENRICHMENT_SOURCE.SHODAN);
    expect(coverage.weightedScoringRatio).toBe(0);
    expect(coverage.scoringCoverageLabel).toBe("NONE");
  });

  it("contributor shell preserves null risk and zeroed contribution fields", () => {
    const contributor = toScoreContributor(FIXTURE_RISK_NULL);
    expect(contributor.risk).toBeNull();
    expect(contributor.weightedContribution).toBeNull();
    expect(contributor.weightShare).toBe(0);
    expect(createEmptySignalDisagreement().present).toBe(false);
  });

  it("diagnostics serialize without functions or secrets", () => {
    const snap = serializeScoringSignalForDiagnostics(FIXTURE_RISK_ZERO);
    expect(snap.source).toBe(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(snap.risk).toBe(0);
    expect(JSON.stringify(snap)).not.toMatch(/api[_-]?key|authorization|secret/i);
  });
});
