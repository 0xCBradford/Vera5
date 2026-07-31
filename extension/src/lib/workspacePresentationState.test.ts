import { describe, expect, it } from "vitest";
import {
  ENRICHMENT_ASSESSMENT_KIND,
  ENRICHMENT_SOURCE,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { HoverCardSourceEntry } from "./hoverCardEnrichment";
import { buildTabScanSummary } from "./tabScanSummary";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";
import {
  WORKSPACE_STATE_COPY,
  formatDetectedIndicatorsCountLine,
  resolveCanonicalDetectedCount,
  resolveCompositeScorePresentation,
  resolveDetectedIndicatorsStatusCopy,
  resolveEnrichmentPresentation,
  resolveIntelFeedUnselectedCopy,
  resolveInvestigationPathsSelectionCopy,
  resolveScanPresentation,
  resolveVendorCardPresentation,
} from "./workspacePresentationState";

const resultsSummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/alert",
    entries: [
      { type: "ipv4", value: "8.8.8.8", anchorId: "a1" },
      { type: "cve", value: "CVE-2021-44228", anchorId: "a2" },
    ],
  }),
  tabId: 1,
});

const emptySummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/blank",
    entries: [],
  }),
  tabId: 1,
});

describe("resolveScanPresentation", () => {
  it("distinguishes not_started, running, empty, results, and error", () => {
    expect(
      resolveScanPresentation({
        scanState: "idle",
        trayView: "prompt",
        scanSummary: null,
      })
    ).toBe("not_started");
    expect(
      resolveScanPresentation({
        scanState: "scanning",
        trayView: "scanning",
        scanSummary: null,
      })
    ).toBe("running");
    expect(
      resolveScanPresentation({
        scanState: "done",
        trayView: "empty",
        scanSummary: emptySummary,
      })
    ).toBe("completed_empty");
    expect(
      resolveScanPresentation({
        scanState: "done",
        trayView: "results",
        scanSummary: resultsSummary,
      })
    ).toBe("completed_with_results");
    expect(
      resolveScanPresentation({
        scanState: "error",
        trayView: "prompt",
        scanSummary: null,
      })
    ).toBe("error");
  });
});

describe("detected indicator count copy", () => {
  it("uses totalCount and singular/plural grammar", () => {
    expect(resolveCanonicalDetectedCount(resultsSummary)).toBe(2);
    expect(formatDetectedIndicatorsCountLine(1)).toBe("1 indicator detected");
    expect(formatDetectedIndicatorsCountLine(2)).toBe("2 indicators detected");
    expect(formatDetectedIndicatorsCountLine(397)).toBe("397 indicators detected");
  });

  it("keeps before-scan and empty-scan Detected Indicators copy distinct", () => {
    expect(resolveDetectedIndicatorsStatusCopy("not_started")).toBe(
      WORKSPACE_STATE_COPY.scan.before
    );
    expect(resolveDetectedIndicatorsStatusCopy("completed_empty")).toBe(
      WORKSPACE_STATE_COPY.scan.empty
    );
    expect(resolveDetectedIndicatorsStatusCopy("running")).toBe(
      WORKSPACE_STATE_COPY.scan.runningShort
    );
  });
});

describe("resolveIntelFeedUnselectedCopy", () => {
  it("does not ask to select an indicator before scan or after empty scan", () => {
    expect(
      resolveIntelFeedUnselectedCopy({ scan: "not_started", detectedCount: 0 }).primary
    ).toBe(WORKSPACE_STATE_COPY.selection.intelBeforeScan);
    expect(
      resolveIntelFeedUnselectedCopy({ scan: "completed_empty", detectedCount: 0 }).secondary
    ).toBeNull();
    const withResults = resolveIntelFeedUnselectedCopy({
      scan: "completed_with_results",
      detectedCount: 2,
    });
    expect(withResults.primary).toBe("2 indicators detected");
    expect(withResults.secondary).toContain("investigation paths");
  });
});

describe("resolveCompositeScorePresentation", () => {
  it("keeps Not scored, Score unavailable, and valid zero distinct", () => {
    expect(
      resolveCompositeScorePresentation({
        compositeScore: null,
        enrichment: "not_started",
      }).verdict
    ).toBe("Not scored");
    expect(
      resolveCompositeScorePresentation({
        compositeScore: null,
        enrichment: "complete",
      }).verdict
    ).toBe("Score unavailable");
    const zero = resolveCompositeScorePresentation({
      compositeScore: 0,
      enrichment: "complete",
    });
    expect(zero.kind).toBe("zero");
    expect(zero.meterValue).toBe(0);
    expect(zero.verdict).toBe("CLEAR");
    expect(zero.scoreBand).toBe("zero");
  });
});

describe("resolveVendorCardPresentation", () => {
  it("maps mutually exclusive vendor presentation kinds", () => {
    expect(
      resolveVendorCardPresentation({
        source: undefined,
        loading: true,
        cardStatus: "not-enriched",
        numericScore: null,
        okDetail: "",
      }).stateLabel
    ).toBe("Querying");

    expect(
      resolveVendorCardPresentation({
        source: undefined,
        loading: false,
        cardStatus: "not-enriched",
        numericScore: null,
        okDetail: "",
      })
    ).toMatchObject({
      kind: "not_queried",
      stateLabel: "Not queried",
      signalText: "",
    });

    expect(
      resolveVendorCardPresentation({
        source: undefined,
        loading: false,
        cardStatus: "not-configured",
        numericScore: null,
        okDetail: "",
      })
    ).toMatchObject({
      stateLabel: "Missing configuration",
      signalText: "API key required",
    });

    expect(
      resolveVendorCardPresentation({
        source: undefined,
        loading: false,
        cardStatus: "pivot-only",
        numericScore: null,
        okDetail: "",
      })
    ).toMatchObject({
      stateLabel: "Pivot only",
      signalText: "",
    });

    const zero = resolveVendorCardPresentation({
      source: {
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok",
        badgeText: "Cached",
        detail: "0 risk signal",
        metadataChips: [],
        assessment: {
          kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
          signal: 0,
          verdict: "0 risk signal",
          evidence: [],
        },
      },
      loading: false,
      cardStatus: "ok",
      numericScore: 0,
      okDetail: "0 risk signal",
    });
    expect(zero.kind).toBe("scored");
    expect(zero.sourceState).toBe("zero");
  });
});

describe("resolveEnrichmentPresentation", () => {
  it("distinguishes not_started, running, partial_running, complete, and partial_terminal", () => {
    const applicable = [ENRICHMENT_SOURCE.ABUSEIPDB, ENRICHMENT_SOURCE.VIRUSTOTAL] as const;
    const availability = {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true, configured: true },
    };
    const emptyMap = new Map<EnrichmentSourceId, HoverCardSourceEntry>();

    expect(
      resolveEnrichmentPresentation({
        hasSelection: false,
        loading: false,
        applicableSourceIds: applicable,
        sourceEntryById: emptyMap,
        availability,
      })
    ).toBe("not_applicable");

    expect(
      resolveEnrichmentPresentation({
        hasSelection: true,
        loading: false,
        applicableSourceIds: applicable,
        sourceEntryById: emptyMap,
        availability,
      })
    ).toBe("not_started");

    expect(
      resolveEnrichmentPresentation({
        hasSelection: true,
        loading: true,
        applicableSourceIds: applicable,
        sourceEntryById: emptyMap,
        availability,
      })
    ).toBe("running");

    const partialMap = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Cached",
          detail: "ok",
          metadataChips: [],
        },
      ],
    ]);

    expect(
      resolveEnrichmentPresentation({
        hasSelection: true,
        loading: true,
        applicableSourceIds: applicable,
        sourceEntryById: partialMap,
        availability,
      })
    ).toBe("partial_running");
  });
});

describe("resolveInvestigationPathsSelectionCopy", () => {
  it("uses one primary no-selection message and neutral placeholders", () => {
    const awaiting = resolveInvestigationPathsSelectionCopy({
      scan: "completed_with_results",
      hasSelection: false,
    });
    expect(awaiting.selectedPrimary).toBe("No indicator selected");
    expect(awaiting.selectedSecondary).toContain("Detected Indicators");
    expect(awaiting.sourcesPlaceholder).toBe(
      WORKSPACE_STATE_COPY.selection.sourcesAfterSelection
    );
    expect(awaiting.conditionalStatus).toBe("Awaiting selection");
    expect(awaiting.sourcesPlaceholder).not.toBe("No indicator selected");
  });
});
