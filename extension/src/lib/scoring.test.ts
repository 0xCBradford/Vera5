import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import {
  buildHoverCardRiskReasoningChain,
  buildHoverCardRiskScoreView,
  buildRiskScoreReasoningChain,
  createHoverCardRiskReasoningSection,
  COMPOSITE_RISK_LABEL,
  COMPOSITE_SCORE_DISAGREEMENT_NOTICE,
  computeCompositeRiskScore,
  formatCompositeScoreContributionLine,
  formatCompositeScoreContributionTooltip,
  formatCompositeRiskScoreSummaryText,
  DEFAULT_SOURCE_SCORE_WEIGHTS,
  MIN_REQUIRED_SCORING_SIGNALS,
  resolveHoverCardRiskScorePresentation,
  RISK_SCORE_REASONING_CHAIN_CLASS,
  RISK_SCORE_REASONING_EMPTY_CLASS,
  RISK_SCORE_REASONING_EMPTY_DETAIL,
  RISK_SCORE_REASONING_HEADING,
  RISK_SCORE_REASONING_NO_LINES_DETAIL,
  RISK_SCORE_REASONING_SECTION_CLASS,
  RISK_SCORE_REASONING_ARIA_LABEL,
  resolveRiskScoreReasoningPresentation,
  RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL,
  RISK_SCORE_UNAVAILABLE_HEADLINE,
  RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL,
  signalStrengthToBand,
  unifiedSummaryToSignalStrength,
} from "./scoring";

describe("unifiedSummaryToSignalStrength", () => {
  it("parses abuse confidence summaries", () => {
    expect(unifiedSummaryToSignalStrength("92 abuse confidence")).toBe(92);
    expect(unifiedSummaryToSignalStrength("0 abuse confidence")).toBe(0);
  });

  it("parses report count summaries", () => {
    expect(unifiedSummaryToSignalStrength("1 reports")).toBe(22);
    expect(unifiedSummaryToSignalStrength("5 reports")).toBe(54);
  });

  it("parses OTX pulse summaries", () => {
    expect(unifiedSummaryToSignalStrength("1 threat pulse")).toBe(26);
    expect(unifiedSummaryToSignalStrength("12 threat pulses")).toBe(56);
  });

  it("returns null for unrecognized summaries", () => {
    expect(unifiedSummaryToSignalStrength(undefined)).toBeNull();
    expect(unifiedSummaryToSignalStrength("")).toBeNull();
    expect(unifiedSummaryToSignalStrength("Unknown vendor text")).toBeNull();
  });
});

describe("signalStrengthToBand", () => {
  it("maps numeric strength to discrete bands", () => {
    expect(signalStrengthToBand(12)).toBe(COMPOSITE_RISK_LABEL.LOW);
    expect(signalStrengthToBand(40)).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(signalStrengthToBand(60)).toBe(COMPOSITE_RISK_LABEL.HIGH);
    expect(signalStrengthToBand(92)).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(signalStrengthToBand(null)).toBeNull();
  });
});

describe("computeCompositeRiskScore", () => {
  it("defaults weights for every enrichment source id", () => {
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.abuseipdb).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.otx).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.urlscan).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.greynoise).toBeGreaterThan(0);
  });

  it("requires at least the minimum number of parseable source signals", () => {
    expect(MIN_REQUIRED_SCORING_SIGNALS).toBe(2);
  });

  it("returns unknown when no source produced a parseable ok signal", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        summary: "92 abuse confidence",
      },
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
    expect(result.disagreement).toBe(false);
  });

  it("returns unknown when only one source produced a parseable signal", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "80 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        summary: "3 threat pulses",
      },
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
    expect(result.disagreement).toBe(false);
    expect(result.sources[0]?.signalStrength).toBe(80);
    expect(result.sources[1]?.signalStrength).toBeNull();
  });

  it("blends multiple ok sources with default weights", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "80 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "3 threat pulses",
      },
    ]);
    expect(result.compositeSignal).not.toBeNull();
    expect(result.label).not.toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.signalStrength).toBe(80);
    expect(result.sources[1]?.signalStrength).toBe(42);
  });

  it("honors per-source weight overrides", () => {
    const result = computeCompositeRiskScore(
      [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "50 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "50 abuse confidence",
        },
      ],
      { weights: { otx: 3, abuseipdb: 1 } }
    );
    expect(result.compositeSignal).toBeCloseTo(50, 5);
    expect(result.sources[0]?.weight).toBe(1);
    expect(result.sources[1]?.weight).toBe(3);
  });

  it("excludes sources with zero weight from the blended signal", () => {
    const result = computeCompositeRiskScore(
      [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "10 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "90 abuse confidence",
        },
      ],
      { weights: { otx: 0 } }
    );
    expect(result.compositeSignal).toBeNull();
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.disagreement).toBe(false);
  });

  it("flags disagreement when sources land two or more bands apart", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "95 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "1 threat pulse",
      },
    ]);
    expect(result.disagreement).toBe(true);
    expect(result.sources[0]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(result.sources[1]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
  });

  it("flags disagreement when numeric spread crosses the material threshold", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "48 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "90 abuse confidence",
      },
    ]);
    expect(result.sources[0]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.sources[1]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(Math.abs(90 - 48)).toBeGreaterThanOrEqual(35);
    expect(result.disagreement).toBe(true);
  });

  it("records skipped sources without affecting the blended score", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        summary: "40 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "40 abuse confidence",
      },
    ]);
    expect(result.compositeSignal).toBeNull();
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.sources[0]?.signalStrength).toBeNull();
  });
});

describe("risk score reasoning chain", () => {
  it("formats per-source contribution lines and summary text", () => {
    const score = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "84 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "4 threat pulses",
      },
    ]);

    expect(formatCompositeRiskScoreSummaryText(score)).toContain("risk");
    expect(formatCompositeScoreContributionLine(score.sources[0]!)).toBe(
      "AbuseIPDB: Critical (84/100, weight 1.00)."
    );
    expect(formatCompositeScoreContributionLine(score.sources[1]!)).toContain(
      "OTX:"
    );
  });

  it("builds reasoning chain with disagreement notice when sources diverge", () => {
    const score = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "95 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "1 threat pulse",
      },
    ]);
    const chain = buildRiskScoreReasoningChain(score);

    expect(chain.sourceLines).toHaveLength(2);
    expect(chain.showDisagreement).toBe(true);
    expect(chain.disagreementLine).toBe(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
  });

  it("formats no weighted signal when summary is not parseable", () => {
    const score = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "vendor message unavailable",
      },
    ]);
    expect(formatCompositeScoreContributionLine(score.sources[0]!)).toBe(
      "AbuseIPDB: no weighted signal (ok)."
    );
  });

  it("builds a shared hover-card risk score view for overlay and React surfaces", () => {
    const sourceResults = [
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Live",
        detail: "84 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "4 threat pulses",
      },
    ];
    const view = buildHoverCardRiskScoreView(sourceResults);

    expect(view.summaryText).toContain("risk");
    expect(view.chain.sourceLines).toHaveLength(2);
    expect(formatCompositeScoreContributionTooltip(view.score.sources[0]!)).toBe(
      view.chain.sourceLines[0]
    );
  });

  it("builds the same reasoning chain from normalized hover-card sources as the score view", () => {
    const sourceResults = [
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Live",
        detail: "84 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "4 threat pulses",
      },
    ];

    expect(buildHoverCardRiskReasoningChain(sourceResults)).toEqual(
      buildHoverCardRiskScoreView(sourceResults).chain
    );
  });
});

/**
 * @vitest-environment happy-dom
 */
describe("createHoverCardRiskReasoningSection", () => {
  it("renders overlay reasoning chain markup from the shared chain builder", () => {
    const chain = buildHoverCardRiskReasoningChain([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok",
        badgeText: "Live",
        detail: "84 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok",
        badgeText: "Live",
        detail: "4 threat pulses",
      },
    ]);
    const section = createHoverCardRiskReasoningSection(
      {
        mode: "chain",
        chain,
        sourceIds: [ENRICHMENT_SOURCE.ABUSEIPDB, ENRICHMENT_SOURCE.OTX],
      },
      document
    );

    expect(section.className).toBe(RISK_SCORE_REASONING_SECTION_CLASS);
    expect(section.getAttribute("aria-label")).toBe(RISK_SCORE_REASONING_ARIA_LABEL);
    expect(section.textContent).toContain(RISK_SCORE_REASONING_HEADING);
    expect(section.querySelector("ol")?.className).toBe(
      RISK_SCORE_REASONING_CHAIN_CLASS
    );
    expect(section.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders overlay empty reasoning state markup", () => {
    const section = createHoverCardRiskReasoningSection(
      { mode: "empty", detail: RISK_SCORE_REASONING_EMPTY_DETAIL },
      document
    );

    expect(section.querySelector(`.${RISK_SCORE_REASONING_EMPTY_CLASS}`)).not.toBeNull();
    expect(section.textContent).toContain(RISK_SCORE_REASONING_EMPTY_DETAIL);
    expect(section.querySelector("ol")).toBeNull();
  });
});

describe("resolveHoverCardRiskScorePresentation", () => {
  const allDisabled = [
    ENRICHMENT_SOURCE.ABUSEIPDB,
    ENRICHMENT_SOURCE.OTX,
    ENRICHMENT_SOURCE.URLSCAN,
    ENRICHMENT_SOURCE.GREYNOISE,
  ];
  const okAbuse = {
    sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
    label: "AbuseIPDB",
    status: "ok" as const,
    badgeText: "Live",
    detail: "84 abuse confidence",
  };

  it("returns unavailable when all enrichment sources are disabled", () => {
    const presentation = resolveHoverCardRiskScorePresentation(allDisabled, [
      okAbuse,
    ]);
    expect(presentation?.mode).toBe("unavailable");
    if (presentation?.mode !== "unavailable") {
      return;
    }
    expect(presentation.headline).toBe(RISK_SCORE_UNAVAILABLE_HEADLINE);
    expect(presentation.detail).toBe(RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL);
  });

  it("returns null when there are no source results", () => {
    expect(resolveHoverCardRiskScorePresentation([], [])).toBeNull();
  });

  it("returns score with insufficient notice for a single parseable source", () => {
    const presentation = resolveHoverCardRiskScorePresentation([], [okAbuse]);
    expect(presentation?.mode).toBe("score");
    if (presentation?.mode !== "score") {
      return;
    }
    expect(presentation.view.summaryText).toContain("Unknown");
    expect(presentation.insufficientCompositeNotice).toBe(
      RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL
    );
  });

  it("returns score without insufficient notice when composite is blendable", () => {
    const presentation = resolveHoverCardRiskScorePresentation([], [
      okAbuse,
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "4 threat pulses",
      },
    ]);
    expect(presentation?.mode).toBe("score");
    if (presentation?.mode !== "score") {
      return;
    }
    expect(presentation.insufficientCompositeNotice).toBeNull();
    expect(presentation.view.summaryText).not.toContain("Unknown");
  });
});

describe("resolveRiskScoreReasoningPresentation", () => {
  const okAbuse = {
    sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
    label: "AbuseIPDB",
    status: "ok" as const,
    badgeText: "Live",
    detail: "84 abuse confidence",
  };

  it("returns empty reasoning presentation when composite is not blendable", () => {
    const view = buildHoverCardRiskScoreView([okAbuse]);
    const presentation = resolveRiskScoreReasoningPresentation(
      view,
      RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL
    );

    expect(presentation.mode).toBe("empty");
    if (presentation.mode !== "empty") {
      return;
    }
    expect(presentation.detail).toBe(RISK_SCORE_REASONING_EMPTY_DETAIL);
  });

  it("returns chain presentation when composite is blendable", () => {
    const view = buildHoverCardRiskScoreView([
      okAbuse,
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "4 threat pulses",
      },
    ]);
    const presentation = resolveRiskScoreReasoningPresentation(view, null);

    expect(presentation.mode).toBe("chain");
    if (presentation.mode !== "chain") {
      return;
    }
    expect(presentation.chain.sourceLines.length).toBeGreaterThan(1);
  });

  it("keeps chain presentation without disagreement when sources agree", () => {
    const view = buildHoverCardRiskScoreView([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Live",
        detail: "74 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "74 abuse confidence",
      },
    ]);
    const presentation = resolveRiskScoreReasoningPresentation(view, null);

    expect(presentation.mode).toBe("chain");
    if (presentation.mode !== "chain") {
      return;
    }
    expect(presentation.chain.showDisagreement).toBe(false);
    expect(presentation.chain.sourceLines).toHaveLength(2);
  });

  it("exposes disagreement on chain presentation when sources diverge", () => {
    const view = buildHoverCardRiskScoreView([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Live",
        detail: "95 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok" as const,
        badgeText: "Live",
        detail: "1 threat pulse",
      },
    ]);
    const presentation = resolveRiskScoreReasoningPresentation(view, null);

    expect(presentation.mode).toBe("chain");
    if (presentation.mode !== "chain") {
      return;
    }
    expect(presentation.chain.showDisagreement).toBe(true);
    expect(presentation.chain.disagreementLine).toBe(
      COMPOSITE_SCORE_DISAGREEMENT_NOTICE
    );
  });

  it("returns empty reasoning presentation when no parseable source signals exist", () => {
    const score = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        summary: "92 abuse confidence",
      },
    ]);
    const view = {
      score,
      summaryText: formatCompositeRiskScoreSummaryText(score),
      chain: buildRiskScoreReasoningChain(score),
    };
    const presentation = resolveRiskScoreReasoningPresentation(view, null);

    expect(presentation.mode).toBe("empty");
    if (presentation.mode !== "empty") {
      return;
    }
    expect(presentation.detail).toBe(RISK_SCORE_REASONING_NO_LINES_DETAIL);
  });
});
