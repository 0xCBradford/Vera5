/**
 * @vitest-environment node
 *
 * Phase 21C — Composite Engine v2 test matrix.
 */
import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import {
  COMPOSITE_FLOAT_TOLERANCE,
  COMPOSITE_SCORE_STATUS,
  DEFAULT_SCORING_ENGINE_MODE,
  DISAGREEMENT_LEVEL,
  SCORING_ENGINE_MODE,
  SCORING_EXCLUSION_REASON,
  SCORING_MODE,
  SCORING_SCHEMA_VERSION,
  SIGNAL_DIRECTION,
  SCORING_SIGNAL_STATUS,
  approxEqual,
  calculateScoreContributors,
  calculateWeightedComposite,
  computeCompositeScore,
  computeEffectiveWeight,
  computeShadowScoringComparison,
  createScoringTarget,
  getScoringEngineMode,
  hasScoringRisk,
  isNumericCompositeParticipant,
  resetScoringEngineMode,
  roundCompositeScore,
  safeComputeCompositeScore,
  type ScoringSignal,
} from "./index";
import { createOkSourceResult } from "../enrichment";

function signal(partial: Partial<ScoringSignal> & Pick<ScoringSignal, "source" | "risk">): ScoringSignal {
  const confidence = partial.confidence ?? 1;
  const baseWeight = partial.baseWeight ?? 1;
  const effectiveWeight =
    partial.effectiveWeight ?? computeEffectiveWeight(baseWeight, confidence);
  return {
    mode: SCORING_MODE.DERIVED,
    direction: SIGNAL_DIRECTION.RISK,
    applicable: true,
    basis: [{ code: "TEST", label: "Test" }],
    targetType: IOC_TYPE.IPV4,
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
    ...partial,
    source: partial.source,
    risk: partial.risk,
    confidence: partial.confidence ?? confidence,
    baseWeight: partial.baseWeight ?? baseWeight,
    effectiveWeight,
  };
}

const target = createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4");

describe("Phase 21C core composite math", () => {
  it("TEST 1 — one signal → score 80", () => {
    const result = computeCompositeScore({
      target,
      signals: [signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 80, mode: SCORING_MODE.DIRECT })],
    });
    expect(result.status).toBe(COMPOSITE_SCORE_STATUS.SCORED);
    expect(result.rawScore).toBeCloseTo(80, 10);
    expect(result.score).toBe(80);
    expect(result.severity).toBe("critical");
  });

  it("TEST 2 — equal weight 80/20 → 50", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 80 }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 20 }),
      ],
    });
    expect(result.score).toBe(50);
  });

  it("TEST 3 — unequal effective weights 0.9/0.1 → 74", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 80,
          confidence: 0.9,
          baseWeight: 1,
        }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: 20,
          confidence: 0.1,
          baseWeight: 1,
        }),
      ],
    });
    expect(result.rawScore).toBeCloseTo(74, 10);
    expect(result.score).toBe(74);
  });

  it("TEST 4 — valid zero scores as 0 not null", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
          mode: SCORING_MODE.DIRECT,
        }),
      ],
    });
    expect(result.score).toBe(0);
    expect(hasScoringRisk({ risk: 0 })).toBe(true);
    expect(result.severity).toBe("low");
    expect(result.status).toBe(COMPOSITE_SCORE_STATUS.SCORED);
  });

  it("TEST 5 — zero + 100 equal weight → 50 high disagreement", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 0, direction: SIGNAL_DIRECTION.NEUTRAL }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 100 }),
      ],
    });
    expect(result.score).toBe(50);
    expect(result.disagreement.spread).toBe(100);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.HIGH);
  });

  it("TEST 6 — null exclusion does not dilute", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 100 }),
        signal({
          source: ENRICHMENT_SOURCE.THREATFOX,
          risk: null,
          mode: SCORING_MODE.MATCH,
          status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
          confidence: 0,
          effectiveWeight: 0,
        }),
        signal({
          source: ENRICHMENT_SOURCE.URLHAUS,
          risk: null,
          mode: SCORING_MODE.MATCH,
          status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
          confidence: 0,
          effectiveWeight: 0,
        }),
      ],
    });
    expect(result.score).toBe(100);
  });

  it("TEST 7 — context exclusion", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 80, mode: SCORING_MODE.DIRECT }),
        signal({
          source: ENRICHMENT_SOURCE.RDAP_WHOIS,
          risk: null,
          mode: SCORING_MODE.CONTEXT_ONLY,
          targetType: IOC_TYPE.DOMAIN,
          confidence: 0,
          baseWeight: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
        signal({
          source: ENRICHMENT_SOURCE.SHODAN,
          risk: null,
          mode: SCORING_MODE.CONTEXT_ONLY,
          confidence: 0,
          baseWeight: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(result.score).toBe(80);
    expect(result.contextualSignals.length).toBe(2);
    expect(
      result.exclusions.some((e) => e.reason === SCORING_EXCLUSION_REASON.CONTEXT_ONLY)
    ).toBe(true);
  });

  it("TEST 8 — low-confidence zero → 81", () => {
    // 90*.9 + 0*.1 = 81
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 90,
          confidence: 0.9,
          baseWeight: 1,
        }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: 0,
          confidence: 0.1,
          baseWeight: 1,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(result.rawScore).toBeCloseTo(81, 10);
    expect(result.score).toBe(81);
  });

  it("TEST 9 — all null → INSUFFICIENT_SIGNAL", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.THREATFOX,
          risk: null,
          mode: SCORING_MODE.MATCH,
          status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
          confidence: 0,
          effectiveWeight: 0,
        }),
      ],
    });
    expect(result.score).toBeNull();
    expect(result.severity).toBeNull();
    expect(result.status).toBe(COMPOSITE_SCORE_STATUS.INSUFFICIENT_SIGNAL);
  });

  it("TEST 10 — no applicable scoring sources", () => {
    const domainTarget = createScoringTarget(IOC_TYPE.DOMAIN, "example.com");
    const result = computeCompositeScore({
      target: domainTarget,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.RDAP_WHOIS,
          risk: null,
          mode: SCORING_MODE.CONTEXT_ONLY,
          targetType: IOC_TYPE.DOMAIN,
          confidence: 0,
          baseWeight: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
      // Disable all numeric scoring sources for domain so only context remains expected
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.URLSCAN,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    });
    expect(result.score).toBeNull();
    expect(result.status).toBe(COMPOSITE_SCORE_STATUS.NO_APPLICABLE_SCORING_SOURCES);
  });
});

describe("Phase 21C contributors", () => {
  it("TEST 11–15 — shares, points, deltas, strongest pos/neg", () => {
    const signals = [
      signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 90, confidence: 1 }),
      signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 10, confidence: 1 }),
    ];
    const weighted = calculateWeightedComposite(signals)!;
    const contributors = calculateScoreContributors(signals, weighted.rawScore);
    const shareSum = contributors.reduce((s, c) => s + c.weightShare, 0);
    const pointsSum = contributors.reduce((s, c) => s + c.contributionPoints, 0);
    const deltaSum = contributors.reduce((s, c) => s + c.influenceDelta, 0);
    expect(approxEqual(shareSum, 1, 1e-9)).toBe(true);
    expect(approxEqual(pointsSum, weighted.rawScore, 1e-9)).toBe(true);
    expect(Math.abs(deltaSum)).toBeLessThanOrEqual(COMPOSITE_FLOAT_TOLERANCE * 10);

    const result = computeCompositeScore({ target, signals });
    expect(result.strongestPositive?.source).toBe(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(result.strongestNegative?.source).toBe(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(result.strongestPositive!.influenceDelta).toBeGreaterThan(0);
    expect(result.strongestNegative!.influenceDelta).toBeLessThan(0);
  });
});

describe("Phase 21C disagreement", () => {
  it("TEST 16 — identical risks → no disagreement", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 30 }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 30 }),
        signal({ source: ENRICHMENT_SOURCE.OTX, risk: 30 }),
      ],
    });
    expect(result.disagreement.spread).toBe(0);
    expect(result.disagreement.weightedStdDev).toBeCloseTo(0, 10);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.NONE);
    expect(result.disagreement.present).toBe(false);
  });

  it("TEST 17 — moderate spread", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 20 }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 40 }),
        signal({ source: ENRICHMENT_SOURCE.OTX, risk: 50 }),
      ],
    });
    expect(result.disagreement.spread).toBe(30);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.LOW);
  });

  it("TEST 18 — extreme spread", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 0 }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 100 }),
      ],
    });
    expect(result.disagreement.spread).toBe(100);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.HIGH);
  });

  it("TEST 19 — directional conflict RISK vs BENIGN", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 90,
          confidence: 0.9,
          direction: SIGNAL_DIRECTION.RISK,
        }),
        signal({
          source: ENRICHMENT_SOURCE.GREYNOISE,
          risk: 0,
          confidence: 0.7,
          direction: SIGNAL_DIRECTION.BENIGN,
        }),
      ],
    });
    expect(result.disagreement.directionalConflict).toBe(true);
  });

  it("TEST 20 — NEUTRAL does not create directional conflict", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 80,
          confidence: 0.9,
          direction: SIGNAL_DIRECTION.RISK,
        }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: 0,
          confidence: 0.9,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(result.disagreement.directionalConflict).toBe(false);
  });

  it("TEST 21 — single signal insufficient for disagreement", () => {
    const result = computeCompositeScore({
      target,
      signals: [signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 55 })],
    });
    expect(result.disagreement.present).toBe(false);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.INSUFFICIENT_SIGNALS);
  });
});

describe("Phase 21C coverage", () => {
  it("TEST 22–27 — retrieval vs scoring coverage distinctions", () => {
    const full = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 40, mode: SCORING_MODE.DIRECT }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 40 }),
        signal({ source: ENRICHMENT_SOURCE.OTX, risk: 40 }),
        signal({ source: ENRICHMENT_SOURCE.GREYNOISE, risk: 40 }),
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.PULSEDIVE,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
        ],
      },
    });
    expect(full.coverage.weightedScoringRatio).toBeGreaterThan(0.5);

    const withContext = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 50, mode: SCORING_MODE.DIRECT }),
        signal({
          source: ENRICHMENT_SOURCE.SHODAN,
          risk: null,
          mode: SCORING_MODE.CONTEXT_ONLY,
          confidence: 0,
          baseWeight: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(withContext.coverage.contextSourcesAvailable).toContain(ENRICHMENT_SOURCE.SHODAN);
    expect(withContext.score).toBe(50);

    const withError = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 70, mode: SCORING_MODE.DIRECT }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: null,
          status: SCORING_SIGNAL_STATUS.ERROR,
          confidence: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(withError.score).toBe(70);
    expect(withError.coverage.errorSources).toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);

    const noMatch = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.THREATFOX,
          risk: null,
          mode: SCORING_MODE.MATCH,
          status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
          confidence: 0,
          effectiveWeight: 0,
        }),
      ],
    });
    expect(noMatch.coverage.noSignalSources).toContain(ENRICHMENT_SOURCE.THREATFOX);
    expect(noMatch.score).toBeNull();

    const disabled = computeCompositeScore({
      target,
      signals: [signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 33, mode: SCORING_MODE.DIRECT })],
      runContext: { disabledSources: [ENRICHMENT_SOURCE.VIRUSTOTAL] },
    });
    expect(disabled.coverage.disabledSources).toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(disabled.coverage.expectedSources).not.toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);
  });
});

describe("Phase 21C realistic cases", () => {
  it("TEST 28 — strong AbuseIPDB + weak VT zero", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 90,
          confidence: 0.85,
          mode: SCORING_MODE.DIRECT,
        }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: 0,
          confidence: 0.12,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(result.score!).toBeGreaterThan(70);
    expect(result.score!).toBeLessThan(90);
  });

  it("TEST 29 — strong match + weak zero", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.THREATFOX,
          risk: 92,
          confidence: 0.85,
          mode: SCORING_MODE.MATCH,
        }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: 0,
          confidence: 0.1,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
    });
    expect(result.score!).toBeGreaterThan(75);
  });

  it("TEST 30 — clustered high sources", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 88 }),
        signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 90 }),
        signal({ source: ENRICHMENT_SOURCE.OTX, risk: 85 }),
      ],
    });
    expect(result.score!).toBeGreaterThanOrEqual(85);
    expect(result.disagreement.level).toBe(DISAGREEMENT_LEVEL.NONE);
  });

  it("TEST 31 — high RISK vs high-confidence BENIGN", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          risk: 95,
          confidence: 0.9,
          direction: SIGNAL_DIRECTION.RISK,
        }),
        signal({
          source: ENRICHMENT_SOURCE.GREYNOISE,
          risk: 0,
          confidence: 0.8,
          direction: SIGNAL_DIRECTION.BENIGN,
        }),
      ],
    });
    expect(result.disagreement.directionalConflict).toBe(true);
    expect(result.score!).toBeGreaterThan(30);
    expect(result.score!).toBeLessThan(70);
  });

  it("TEST 32 — context-only target path", () => {
    const result = computeCompositeScore({
      target: createScoringTarget(IOC_TYPE.DOMAIN, "example.com"),
      signals: [
        signal({
          source: ENRICHMENT_SOURCE.RDAP_WHOIS,
          risk: null,
          mode: SCORING_MODE.CONTEXT_ONLY,
          targetType: IOC_TYPE.DOMAIN,
          confidence: 0,
          baseWeight: 0,
          effectiveWeight: 0,
          direction: SIGNAL_DIRECTION.NEUTRAL,
        }),
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.URLSCAN,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    });
    expect(result.score).toBeNull();
  });

  it("TEST 33 — error-heavy: one valid signal", () => {
    const result = computeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 64, mode: SCORING_MODE.DIRECT }),
        signal({
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          risk: null,
          status: SCORING_SIGNAL_STATUS.ERROR,
          confidence: 0,
          effectiveWeight: 0,
        }),
        signal({
          source: ENRICHMENT_SOURCE.OTX,
          risk: null,
          status: SCORING_SIGNAL_STATUS.ERROR,
          confidence: 0,
          effectiveWeight: 0,
        }),
      ],
    });
    expect(result.score).toBe(64);
    expect(result.coverage.errorSources.length).toBe(2);
  });
});

describe("Phase 21C engine behavior", () => {
  it("TEST 34 — input order independence", () => {
    const a = signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 70, confidence: 0.8 });
    const b = signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 20, confidence: 0.4 });
    const c = signal({ source: ENRICHMENT_SOURCE.OTX, risk: 55, confidence: 0.6 });
    const r1 = computeCompositeScore({ target, signals: [a, b, c] });
    const r2 = computeCompositeScore({ target, signals: [c, a, b] });
    const r3 = computeCompositeScore({ target, signals: [b, c, a] });
    expect(r1.score).toBe(r2.score);
    expect(r2.score).toBe(r3.score);
    expect(r1.rawScore).toBeCloseTo(r2.rawScore!, 12);
  });

  it("TEST 35 — repeated calculation identical", () => {
    const signals = [signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 41 })];
    const r1 = computeCompositeScore({ target, signals });
    const r2 = computeCompositeScore({ target, signals });
    expect(r1).toEqual(r2);
  });

  it("TEST 36 — incremental arrival", () => {
    const a = signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 80, mode: SCORING_MODE.DIRECT });
    const b = signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 20 });
    const c = signal({ source: ENRICHMENT_SOURCE.OTX, risk: 50 });
    const s1 = computeCompositeScore({ target, signals: [a] });
    const s2 = computeCompositeScore({ target, signals: [a, b] });
    const s3 = computeCompositeScore({ target, signals: [a, b, c] });
    expect(s1.score).toBe(80);
    expect(s2.score).toBe(50);
    expect(s3.score).toBe(roundCompositeScore((80 + 20 + 50) / 3));
  });

  it("TEST 37 — invalid signal excluded without crash", () => {
    const result = safeComputeCompositeScore({
      target,
      signals: [
        signal({ source: ENRICHMENT_SOURCE.ABUSEIPDB, risk: 40, mode: SCORING_MODE.DIRECT }),
        {
          ...signal({ source: ENRICHMENT_SOURCE.VIRUSTOTAL, risk: 150 }),
          risk: 150,
        },
      ],
    });
    expect(result.score).toBe(40);
    expect(result.exclusions.some((e) => e.reason === SCORING_EXCLUSION_REASON.INVALID_SIGNAL || e.reason === SCORING_EXCLUSION_REASON.NO_SIGNAL)).toBe(true);
  });

  it("TEST 38 — shadow comparison; legacy remains default", () => {
    resetScoringEngineMode();
    expect(getScoringEngineMode()).toBe(DEFAULT_SCORING_ENGINE_MODE);
    expect(DEFAULT_SCORING_ENGINE_MODE).toBe(SCORING_ENGINE_MODE.LEGACY);

    const enrichment = {
      ioc: "1.2.3.4",
      type: IOC_TYPE.IPV4,
      cached: false,
      lastUpdated: new Date().toISOString(),
      sources: [
        createOkSourceResult({
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          summary: "80 abuse confidence",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 80,
          },
        }),
        createOkSourceResult({
          sourceId: ENRICHMENT_SOURCE.OTX,
          summary: "2 threat pulses",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 2,
          },
        }),
      ],
    };

    const comparison = computeShadowScoringComparison(enrichment);
    expect(comparison.schemaVersion).toBe(SCORING_SCHEMA_VERSION);
    expect(comparison.v2.schemaVersion).toBe(SCORING_SCHEMA_VERSION);
    expect(comparison.engineMode).toBe(SCORING_ENGINE_MODE.LEGACY);
    expect(comparison.v2Score).not.toBeNull();
    // Legacy production path still independently computable
    expect(comparison.legacyScore === null || typeof comparison.legacyScore === "number").toBe(
      true
    );
  });

  it("confidence is not double-counted (effectiveWeight ownership)", () => {
    const s = signal({
      source: ENRICHMENT_SOURCE.ABUSEIPDB,
      risk: 50,
      baseWeight: 2,
      confidence: 0.5,
    });
    expect(s.effectiveWeight).toBeCloseTo(1, 10);
    expect(isNumericCompositeParticipant(s)).toBe(true);
    const result = computeCompositeScore({ target, signals: [s] });
    expect(result.score).toBe(50);
  });
});
