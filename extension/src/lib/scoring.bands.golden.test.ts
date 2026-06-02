import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
} from "./hoverCardEnrichment";
import {
  buildHoverCardRiskScoreView,
  COMPOSITE_RISK_LABEL,
  formatCompositeRiskLabelDisplay,
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

describe("golden: composite bands through hover-card overlay scoring path", () => {
  function pairSameAbuseConfidence(score: number) {
    const summary = `${score} abuse confidence`;
    return buildHoverCardSourceEntries([
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
    ]);
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
    "two-source abuse confidence $score → overlay summary matches composite band",
    ({ score, composite, label }) => {
      const view = buildHoverCardRiskScoreView(pairSameAbuseConfidence(score));
      const labelText = formatCompositeRiskLabelDisplay(label);

      expect(view.score.label).toBe(label);
      expect(view.score.compositeSignal).toBeCloseTo(composite, 10);
      expect(view.score.disagreement).toBe(false);
      expect(view.summaryText).toBe(
        `${labelText} risk (${Math.round(composite)}/100)`
      );
      expect(view.chain.sourceLines).toHaveLength(2);
    }
  );
});
