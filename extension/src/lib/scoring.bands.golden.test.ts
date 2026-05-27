import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import {
  COMPOSITE_RISK_LABEL,
  computeCompositeRiskScore,
  signalStrengthToBand,
} from "./scoring";

describe("golden: signalStrengthToBand thresholds", () => {
  const cases = [
    { signal: 0, label: COMPOSITE_RISK_LABEL.LOW },
    { signal: 24, label: COMPOSITE_RISK_LABEL.LOW },
    { signal: 25, label: COMPOSITE_RISK_LABEL.SUSPICIOUS },
    { signal: 49, label: COMPOSITE_RISK_LABEL.SUSPICIOUS },
    { signal: 50, label: COMPOSITE_RISK_LABEL.HIGH },
    { signal: 74, label: COMPOSITE_RISK_LABEL.HIGH },
    { signal: 75, label: COMPOSITE_RISK_LABEL.CRITICAL },
    { signal: 100, label: COMPOSITE_RISK_LABEL.CRITICAL },
  ] as const;

  it.each(cases)(
    "$signal → $label",
    ({ signal, label }) => {
      expect(signalStrengthToBand(signal)).toBe(label);
    }
  );
});

describe("golden: composite bands with two agreeing abuse-confidence sources", () => {
  function pairSameAbuseConfidence(score: number) {
    const summary = `${score} abuse confidence`;
    return [
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary,
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary,
      },
    ] as const;
  }

  const cases = [
    { score: 10, composite: 10, label: COMPOSITE_RISK_LABEL.LOW },
    { score: 24, composite: 24, label: COMPOSITE_RISK_LABEL.LOW },
    { score: 25, composite: 25, label: COMPOSITE_RISK_LABEL.SUSPICIOUS },
    { score: 40, composite: 40, label: COMPOSITE_RISK_LABEL.SUSPICIOUS },
    { score: 49, composite: 49, label: COMPOSITE_RISK_LABEL.SUSPICIOUS },
    { score: 50, composite: 50, label: COMPOSITE_RISK_LABEL.HIGH },
    { score: 62, composite: 62, label: COMPOSITE_RISK_LABEL.HIGH },
    { score: 74, composite: 74, label: COMPOSITE_RISK_LABEL.HIGH },
    { score: 75, composite: 75, label: COMPOSITE_RISK_LABEL.CRITICAL },
    { score: 92, composite: 92, label: COMPOSITE_RISK_LABEL.CRITICAL },
  ] as const;

  it.each(cases)(
    "two-source abuse confidence $score → composite ~$composite → $label",
    ({ score, composite, label }) => {
      const result = computeCompositeRiskScore(pairSameAbuseConfidence(score));
      expect(result.label).toBe(label);
      expect(result.compositeSignal).toBeCloseTo(composite, 10);
      expect(result.disagreement).toBe(false);
    }
  );
});
