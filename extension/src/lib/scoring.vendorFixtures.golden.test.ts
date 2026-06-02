import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeAbuseIpdbCheckResponse } from "./abuseipdbConnector";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { normalizeOtxIndicatorResponse } from "./otxConnector";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
  type HoverCardSourceEntry,
} from "./hoverCardEnrichment";
import {
  buildHoverCardRiskScoreView,
  COMPOSITE_RISK_LABEL,
  computeCompositeRiskScore,
  formatCompositeScoreContributionLine,
  resolveHoverCardRiskScorePresentation,
  resolveRiskScoreReasoningPresentation,
  RISK_SCORE_REASONING_EMPTY_DETAIL,
  RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL,
  signalStrengthToBand,
  type HoverCardRiskScoreAvailablePresentation,
  type ScoringSourceInput,
} from "./scoring";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadVendorFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

function scoringInputFromNormalized(
  sourceId: (typeof ENRICHMENT_SOURCE)[keyof typeof ENRICHMENT_SOURCE],
  sourceLabel: string,
  summary: string | undefined
): ScoringSourceInput {
  return {
    sourceId,
    sourceLabel,
    status: ENRICHMENT_SOURCE_STATUS.OK,
    summary,
  };
}

function sourceEntriesFromVendorSummaries(
  pairs: ReadonlyArray<{
    sourceId: (typeof ENRICHMENT_SOURCE)[keyof typeof ENRICHMENT_SOURCE];
    sourceLabel: string;
    summary: string | undefined;
  }>
): HoverCardSourceEntry[] {
  return buildHoverCardSourceEntries(
    pairs.map(({ sourceId, sourceLabel, summary }) => ({
      sourceId,
      sourceLabel,
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary,
    }))
  );
}

function expectOverlayScorePresentation(
  sourceResults: readonly HoverCardSourceEntry[]
): HoverCardRiskScoreAvailablePresentation {
  const presentation = resolveHoverCardRiskScorePresentation([], sourceResults);
  expect(presentation?.mode).toBe("score");
  if (presentation?.mode !== "score") {
    throw new Error("Expected score presentation");
  }
  return presentation;
}

describe("golden: vendor fixtures → composite score bands", () => {
  it("AbuseIPDB check-high-confidence.json summary maps to HIGH band", () => {
    const payload = loadVendorFixture("abuseipdb/check-high-confidence.json");
    const normalized = normalizeAbuseIpdbCheckResponse(payload);
    expect(normalized?.summary).toBe("74 abuse confidence");
    expect(signalStrengthToBand(74)).toBe(COMPOSITE_RISK_LABEL.HIGH);
  });

  it("OTX indicator-ipv4-pulses.json summary maps to SUSPICIOUS band when paired", () => {
    const payload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const normalized = normalizeOtxIndicatorResponse(payload);
    expect(normalized?.summary).toBe("3 threat pulses");

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        normalized?.summary
      ),
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.OTX,
        "OTX",
        normalized?.summary
      ),
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.compositeSignal).toBeCloseTo(42, 10);
    expect(result.disagreement).toBe(false);
  });

  it("paired high-confidence AbuseIPDB + OTX pulse fixtures composite to HIGH", () => {
    const abusePayload = loadVendorFixture("abuseipdb/check-high-confidence.json");
    const otxPayload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const abuseSummary = normalizeAbuseIpdbCheckResponse(abusePayload)?.summary;
    const otxSummary = normalizeOtxIndicatorResponse(otxPayload)?.summary;

    const paired = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        abuseSummary
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", otxSummary),
    ]);
    expect(paired.label).toBe(COMPOSITE_RISK_LABEL.HIGH);
    expect(paired.compositeSignal).toBeCloseTo(59.297, 2);
    expect(paired.disagreement).toBe(false);
  });

  it("divergent vendor summaries flag disagreement", () => {
    const otxPayload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const otxSummary = normalizeOtxIndicatorResponse(otxPayload)?.summary;

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        "92 abuse confidence"
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", otxSummary),
    ]);
    expect(result.disagreement).toBe(true);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.HIGH);
  });

  it("AbuseIPDB check-reports-only.json maps report summary to SUSPICIOUS band when paired", () => {
    const payload = loadVendorFixture("abuseipdb/check-reports-only.json");
    const normalized = normalizeAbuseIpdbCheckResponse(payload);
    expect(normalized?.summary).toBe("9 reports");

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        normalized?.summary
      ),
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.OTX,
        "OTX",
        "1 threat pulse"
      ),
    ]);

    expect(result.label).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.compositeSignal).toBeCloseTo(48.703, 2);
    expect(result.disagreement).toBe(true);
  });

  it("empty vendor fixtures yield unknown composite label", () => {
    const abuseEmpty = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-empty-data.json")
    );
    const otxEmpty = normalizeOtxIndicatorResponse(
      loadVendorFixture("otx/indicator-empty.json")
    );
    expect(abuseEmpty).toBeNull();
    expect(otxEmpty).toBeNull();

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        undefined
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", undefined),
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
  });
});

describe("golden: vendor fixtures → overlay-equivalent risk score output", () => {
  it("paired AbuseIPDB and OTX fixtures match overlay composite label and reasoning chain", () => {
    const abuseSummary = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-high-confidence.json")
    )?.summary;
    const otxSummary = normalizeOtxIndicatorResponse(
      loadVendorFixture("otx/indicator-ipv4-pulses.json")
    )?.summary;
    const sourceResults = sourceEntriesFromVendorSummaries([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        summary: abuseSummary,
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        summary: otxSummary,
      },
    ]);

    const presentation = expectOverlayScorePresentation(sourceResults);
    const { view } = presentation;

    expect(view.summaryText).toBe("High risk (59/100)");
    expect(view.score.label).toBe(COMPOSITE_RISK_LABEL.HIGH);
    expect(view.score.compositeSignal).toBeCloseTo(59.297, 2);
    expect(presentation.insufficientCompositeNotice).toBeNull();
    expect(
      resolveRiskScoreReasoningPresentation(view, presentation.insufficientCompositeNotice)
        .mode
    ).toBe("chain");
    expect(view.chain.sourceLines).toEqual(
      view.score.sources.map(formatCompositeScoreContributionLine)
    );
    expect(view.chain.sourceLines[0]).toContain("AbuseIPDB: High (74/100");
    expect(view.chain.sourceLines[1]).toContain("OTX: Suspicious");
  });

  it("divergent vendor summaries match overlay disagreement presentation", () => {
    const otxSummary = normalizeOtxIndicatorResponse(
      loadVendorFixture("otx/indicator-ipv4-pulses.json")
    )?.summary;
    const sourceResults = sourceEntriesFromVendorSummaries([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        summary: "92 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        summary: otxSummary,
      },
    ]);

    const presentation = expectOverlayScorePresentation(sourceResults);
    const { view } = presentation;

    expect(view.summaryText).toBe("High risk (69/100)");
    expect(view.chain.showDisagreement).toBe(true);
    expect(presentation.insufficientCompositeNotice).toBeNull();
    expect(
      resolveRiskScoreReasoningPresentation(view, presentation.insufficientCompositeNotice)
        .mode
    ).toBe("chain");
  });

  it("reports-only AbuseIPDB fixture matches overlay suspicious blended label", () => {
    const abuseSummary = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-reports-only.json")
    )?.summary;
    const sourceResults = sourceEntriesFromVendorSummaries([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        summary: abuseSummary,
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        summary: "1 threat pulse",
      },
    ]);

    const presentation = expectOverlayScorePresentation(sourceResults);
    const { view } = presentation;

    expect(view.summaryText).toBe("Suspicious risk (49/100)");
    expect(view.score.disagreement).toBe(true);
    expect(view.chain.showDisagreement).toBe(true);
  });

  it("single-source vendor fixture matches overlay unknown label and empty reasoning chain", () => {
    const abuseSummary = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-high-confidence.json")
    )?.summary;
    const sourceResults = sourceEntriesFromVendorSummaries([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        summary: abuseSummary,
      },
    ]);

    const presentation = expectOverlayScorePresentation(sourceResults);
    const { view } = presentation;

    expect(view.summaryText).toBe("Unknown risk");
    expect(presentation.insufficientCompositeNotice).toBe(
      RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL
    );
    const reasoning = resolveRiskScoreReasoningPresentation(
      view,
      presentation.insufficientCompositeNotice
    );
    expect(reasoning.mode).toBe("empty");
    if (reasoning.mode === "empty") {
      expect(reasoning.detail).toBe(RISK_SCORE_REASONING_EMPTY_DETAIL);
    }
  });

  it("hover-card scoring path matches direct composite scoring for vendor summaries", () => {
    const abuseSummary = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-high-confidence.json")
    )?.summary;
    const otxSummary = normalizeOtxIndicatorResponse(
      loadVendorFixture("otx/indicator-ipv4-pulses.json")
    )?.summary;

    const direct = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        abuseSummary
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", otxSummary),
    ]);
    const overlayView = buildHoverCardRiskScoreView(
      sourceEntriesFromVendorSummaries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          summary: abuseSummary,
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          summary: otxSummary,
        },
      ])
    );

    expect(overlayView.score).toEqual(direct);
    expect(overlayView.summaryText).toBe("High risk (59/100)");
  });
});
