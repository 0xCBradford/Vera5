/**
 * @vitest-environment node
 *
 * Phase 21A — ScoringSignal helpers, validation, effective weight, eligibility.
 */
import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import {
  SCORING_BASIS_CODE,
  SCORING_MODE,
  SIGNAL_DIRECTION,
  SCORING_SIGNAL_STATUS,
  computeEffectiveWeight,
  hasScoringRisk,
  isCompositeEligible,
  validateScoringSignal,
  type ScoringSignal,
} from "./index";

function baseSignal(overrides: Partial<ScoringSignal> = {}): ScoringSignal {
  return {
    source: ENRICHMENT_SOURCE.ABUSEIPDB,
    mode: SCORING_MODE.DIRECT,
    risk: 0,
    confidence: 0.5,
    baseWeight: 1,
    effectiveWeight: 0.5,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    applicable: true,
    basis: [
      {
        code: SCORING_BASIS_CODE.ABUSE_CONFIDENCE,
        label: "Abuse confidence",
        value: 0,
      },
    ],
    targetType: IOC_TYPE.IPV4,
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
    ...overrides,
  };
}

describe("Phase 21A ScoringSignal zero/null semantics", () => {
  it("TEST 1 — valid risk 0 is a scoring risk and can be composite-eligible", () => {
    const signal = baseSignal({ risk: 0, confidence: 0.4, effectiveWeight: 0.4 });
    expect(hasScoringRisk(signal)).toBe(true);
    expect(validateScoringSignal(signal).ok).toBe(true);
    expect(isCompositeEligible(signal)).toBe(true);
  });

  it("TEST 2 — null risk is valid context but not a scoring risk", () => {
    const signal = baseSignal({
      source: ENRICHMENT_SOURCE.RDAP_WHOIS,
      mode: SCORING_MODE.CONTEXT_ONLY,
      risk: null,
      confidence: 0,
      baseWeight: 0,
      effectiveWeight: 0,
      direction: SIGNAL_DIRECTION.NEUTRAL,
      targetType: IOC_TYPE.DOMAIN,
      basis: [
        {
          code: SCORING_BASIS_CODE.REGISTRATION_CONTEXT,
          label: "Registration context",
        },
      ],
      status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
    });
    expect(validateScoringSignal(signal).ok).toBe(true);
    expect(hasScoringRisk(signal)).toBe(false);
    expect(isCompositeEligible(signal)).toBe(false);
  });

  it("never collapses zero via truthiness", () => {
    const zero = baseSignal({ risk: 0 });
    const nil = baseSignal({ risk: null, mode: SCORING_MODE.CONTEXT_ONLY, baseWeight: 0 });
    expect(Boolean(zero.risk)).toBe(false); // illustrates the trap
    expect(hasScoringRisk(zero)).toBe(true); // correct helper
    expect(hasScoringRisk(nil)).toBe(false);
  });
});

describe("Phase 21A ScoringSignal validation", () => {
  it("accepts risk 100 and confidence 1", () => {
    const signal = baseSignal({
      risk: 100,
      confidence: 1,
      effectiveWeight: 1,
      direction: SIGNAL_DIRECTION.RISK,
    });
    expect(validateScoringSignal(signal).ok).toBe(true);
  });

  it("TEST 4 — rejects risk 150", () => {
    const result = validateScoringSignal(baseSignal({ risk: 150 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "risk")).toBe(true);
    }
    expect(isCompositeEligible(baseSignal({ risk: 150 }))).toBe(false);
  });

  it("rejects risk -1 and NaN", () => {
    expect(validateScoringSignal(baseSignal({ risk: -1 })).ok).toBe(false);
    expect(validateScoringSignal(baseSignal({ risk: Number.NaN })).ok).toBe(false);
    expect(validateScoringSignal(baseSignal({ risk: Number.POSITIVE_INFINITY })).ok).toBe(false);
  });

  it("TEST 5 — rejects confidence 1.4", () => {
    const result = validateScoringSignal(baseSignal({ confidence: 1.4 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "confidence")).toBe(true);
    }
  });

  it("accepts confidence 0", () => {
    expect(validateScoringSignal(baseSignal({ confidence: 0, effectiveWeight: 0 })).ok).toBe(true);
  });

  it("rejects undefined risk (must be number | null)", () => {
    const bad = { ...baseSignal(), risk: undefined } as unknown as ScoringSignal;
    expect(validateScoringSignal(bad).ok).toBe(false);
  });
});

describe("Phase 21A effective weight", () => {
  it("TEST 6 — 0.8 × 0.5 = 0.4", () => {
    expect(computeEffectiveWeight(0.8, 0.5)).toBeCloseTo(0.4, 10);
  });

  it("returns 0 for non-finite or negative inputs", () => {
    expect(computeEffectiveWeight(Number.NaN, 0.5)).toBe(0);
    expect(computeEffectiveWeight(0.8, Number.POSITIVE_INFINITY)).toBe(0);
    expect(computeEffectiveWeight(-1, 0.5)).toBe(0);
  });
});

describe("Phase 21A composite eligibility", () => {
  it("TEST 7 — context-only never eligible", () => {
    const signal = baseSignal({
      mode: SCORING_MODE.CONTEXT_ONLY,
      risk: null,
      baseWeight: 0,
      effectiveWeight: 0,
      source: ENRICHMENT_SOURCE.SHODAN,
    });
    expect(isCompositeEligible(signal)).toBe(false);
  });

  it("not applicable → ineligible even with risk", () => {
    expect(isCompositeEligible(baseSignal({ applicable: false, risk: 40 }))).toBe(false);
  });
});
