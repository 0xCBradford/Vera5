/**
 * @vitest-environment happy-dom
 */
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AnalysisTrace,
  deriveCurrentRunMetrics,
  deriveRunSignals,
  deriveRunAssessment,
  deriveScoreMovement,
  RUN_SIGNAL_CAP,
} from "./AnalysisTrace";
import {
  ANALYSIS_TRACE_EVENT_TYPE,
  ANALYSIS_TRACE_RUN_STATUS,
  ANALYSIS_TRACE_SEVERITY,
  beginAnalysisTraceEnrichmentRun,
  completeAnalysisTraceEnrichmentRun,
  getActiveAnalysisTraceRun,
  recordAnalysisTraceEvent,
  resetAnalysisTrace,
  analysisTraceStore,
} from "../lib/analysisTrace";

let container: HTMLDivElement;
let root: Root;

function render(props: { currentTargetKey?: string } = {}): void {
  act(() => {
    root.render(<AnalysisTrace {...props} />);
  });
}

function seedInvestigation(): void {
  recordAnalysisTraceEvent({
    id: "s1",
    type: ANALYSIS_TRACE_EVENT_TYPE.SESSION,
    title: "SESSION",
    detail: "VERA5 ready",
    timestamp: 1,
  });
  recordAnalysisTraceEvent({
    id: "sc1",
    type: ANALYSIS_TRACE_EVENT_TYPE.SCAN,
    title: "SCAN PAGE",
    detail: "96 indicators detected",
    timestamp: 2,
  });
  recordAnalysisTraceEvent({
    id: "t1",
    type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
    title: "TARGET",
    detail: "IP 198.185.159.145",
    targetKey: "198.185.159.145",
    timestamp: 3,
  });
  recordAnalysisTraceEvent({
    id: "r1",
    type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
    title: "ENRICHMENT RUN",
    runId: "run-1",
    runNumber: 1,
    parentId: "t1",
    targetKey: "198.185.159.145",
    status: ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
    timestamp: 4,
  });
  recordAnalysisTraceEvent({
    id: "v1",
    type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
    title: "VIRUSTOTAL",
    detail: "8/100 · LOW",
    severity: ANALYSIS_TRACE_SEVERITY.LOW,
    parentId: "r1",
    runId: "run-1",
    targetKey: "198.185.159.145",
    timestamp: 5,
  });
  recordAnalysisTraceEvent({
    id: "sc-1",
    type: ANALYSIS_TRACE_EVENT_TYPE.SCORE,
    title: "SCORE",
    detail: "27 · SUSPICIOUS · ESTABLISHED",
    severity: ANALYSIS_TRACE_SEVERITY.SUSPICIOUS,
    scoreAfter: 27,
    parentId: "r1",
    runId: "run-1",
    targetKey: "198.185.159.145",
    timestamp: 6,
  });
}

beforeEach(() => {
  resetAnalysisTrace();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  resetAnalysisTrace();
});

describe("AnalysisTrace (Phase 20F-A progressive disclosure)", () => {
  it("renders expanded by default with an empty ledger", () => {
    render();
    expect(container.querySelector(".vera5-analysis-trace")?.getAttribute("data-vera5-expanded")).toBe(
      "true"
    );
    expect(container.querySelector(".vera5-analysis-trace-count")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-empty")).not.toBeNull();
  });

  it("shows compact CURRENT run context without Source Details or scorecard duplication", () => {
    seedInvestigation();
    render({ currentTargetKey: "198.185.159.145" });

    expect(container.querySelector(".vera5-analysis-trace-current-kicker")?.textContent).toBe(
      "CURRENT TARGET"
    );
    expect(container.querySelector(".vera5-analysis-trace-current-value")?.textContent).toContain(
      "198.185.159.145"
    );
    expect(container.textContent).toContain("RUN 01");
    // Vendor Evidence owns source detail — CURRENT must not host SOURCE DETAILS.
    expect(container.textContent).not.toContain("SOURCE DETAILS");
    expect(container.querySelector("#vera5-trace-source-details-button")).toBeNull();
    expect(container.querySelector('.vera5-analysis-trace-row[data-vera5-trace-type="vendor"]')).toBeNull();
    // Scorecard owns current score — no FINAL duplicate / SCORE PATH.
    expect(container.textContent).not.toContain("SCORE PATH");
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-takeaway")).toBeNull();
    // Metrics line is terse; single score has no SCORE MOVEMENT.
    expect(container.querySelector(".vera5-analysis-trace-run-metrics")?.textContent).toMatch(
      /1 SOURCE/
    );
    expect(container.querySelector(".vera5-analysis-trace-score-movement")).toBeNull();
    // Phase 20F-C — module header is instrument identity only.
    expect(container.querySelector(".vera5-analysis-trace-header")?.textContent).not.toMatch(/LAST/i);
    expect(container.querySelector(".vera5-analysis-trace-header")?.textContent).not.toMatch(/RUN\s*\d/i);
    expect(container.querySelector(".vera5-analysis-trace-header")?.textContent).not.toMatch(/SCORE/i);
  });

  it("switching views and expanding previous runs does not create domain events", () => {
    seedInvestigation();
    render({ currentTargetKey: "198.185.159.145" });
    const before = analysisTraceStore.getSnapshot().length;
    const sessionTab = container.querySelector<HTMLButtonElement>("#vera5-trace-viewtab-session");
    act(() => {
      sessionTab?.click();
    });
    expect(sessionTab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".vera5-analysis-trace-context")?.textContent).toContain(
      "SCAN PAGE"
    );
    expect(container.querySelector(".vera5-analysis-trace-current")).toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>("#vera5-trace-viewtab-current")?.click();
    });
    expect(analysisTraceStore.getSnapshot()).toHaveLength(before);
  });

  it("keeps SESSION out of the default CURRENT view once an investigation exists", () => {
    seedInvestigation();
    render({ currentTargetKey: "198.185.159.145" });
    expect(container.querySelector("#vera5-trace-viewtab-session")?.getAttribute("aria-selected")).toBe(
      "false"
    );
    expect(container.querySelector("#vera5-trace-viewtab-current")?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(container.querySelector(".vera5-analysis-trace-context")).toBeNull();
  });

  it("collapses previous runs behind PREVIOUS RUNS", () => {
    seedInvestigation();
    recordAnalysisTraceEvent({
      id: "r2",
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-2",
      runNumber: 2,
      parentId: "t1",
      targetKey: "198.185.159.145",
      status: ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
      timestamp: 7,
    });
    recordAnalysisTraceEvent({
      id: "v2",
      type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
      title: "OTX",
      detail: "79/100 · CRITICAL",
      severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
      parentId: "r2",
      runId: "run-2",
      targetKey: "198.185.159.145",
      timestamp: 8,
    });
    render({ currentTargetKey: "198.185.159.145" });

    expect(container.textContent).toContain("RUN 02");
    expect(container.textContent).toContain("PREVIOUS RUNS · 1");
    const prevButton = container.querySelector<HTMLButtonElement>(
      "#vera5-trace-previous-runs-button"
    );
    expect(prevButton?.getAttribute("aria-expanded")).toBe("false");
    // Old run vendor not visible until Previous Runs (and then the run) expands.
    expect(container.textContent).not.toContain("VIRUSTOTAL");
  });

  it("keeps historical targets in the HISTORY view, not CURRENT", () => {
    seedInvestigation();
    recordAnalysisTraceEvent({
      id: "t2",
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      detail: "IP 9.9.9.9",
      targetKey: "9.9.9.9",
      timestamp: 10,
    });
    render({ currentTargetKey: "9.9.9.9" });

    // CURRENT view focuses on the active target only.
    expect(container.querySelector(".vera5-analysis-trace-current-value")?.textContent).toContain(
      "9.9.9.9"
    );
    // HISTORY tab advertises the prior target count but does not render it inline.
    const historyTab = container.querySelector("#vera5-trace-viewtab-history");
    expect(historyTab?.getAttribute("aria-selected")).toBe("false");
    expect(historyTab?.textContent).toContain("1");
    expect(container.textContent).not.toContain("198.185.159.145");

    // Switching to HISTORY reveals the prior target row.
    act(() => {
      container.querySelector<HTMLButtonElement>("#vera5-trace-viewtab-history")?.click();
    });
    expect(container.querySelector(".vera5-analysis-trace-current")).toBeNull();
    expect(container.textContent).toContain("198.185.159.145");
  });

  it("orients to SESSION view when no target exists yet", () => {
    recordAnalysisTraceEvent({
      id: "s1",
      type: ANALYSIS_TRACE_EVENT_TYPE.SESSION,
      title: "SESSION",
      detail: "VERA5 ready",
      timestamp: 1,
    });
    recordAnalysisTraceEvent({
      id: "sc1",
      type: ANALYSIS_TRACE_EVENT_TYPE.SCAN,
      title: "SCAN PAGE",
      detail: "12 indicators detected",
      timestamp: 2,
    });
    render();
    // No target → effective view auto-orients to SESSION.
    expect(container.querySelector("#vera5-trace-viewtab-session")?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(container.querySelector(".vera5-analysis-trace-current")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-context")?.textContent).toContain(
      "SCAN PAGE"
    );
  });

  it("handles current target with no run", () => {
    recordAnalysisTraceEvent({
      id: "t1",
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      detail: "DOM example.com",
      targetKey: "example.com",
      timestamp: 1,
    });
    render({ currentTargetKey: "example.com" });
    expect(container.textContent).toContain("No enrichment run yet");
    expect(container.textContent).not.toContain("SOURCE DETAILS");
  });

  it("does not create runs on remount over existing history", () => {
    seedInvestigation();
    const before = analysisTraceStore
      .getSnapshot()
      .filter((event) => event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN).length;
    render({ currentTargetKey: "198.185.159.145" });
    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    render({ currentTargetKey: "198.185.159.145" });
    const after = analysisTraceStore
      .getSnapshot()
      .filter((event) => event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN).length;
    expect(after).toBe(before);
    expect(getActiveAnalysisTraceRun()).toBeNull();
  });

  it("preserves vendor events in the store without rendering Source Details in CURRENT", () => {
    recordAnalysisTraceEvent({
      id: "t1",
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      detail: "IP 9.9.9.9",
      targetKey: "9.9.9.9",
      timestamp: 1,
    });
    recordAnalysisTraceEvent({
      id: "r1",
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-1",
      runNumber: 1,
      parentId: "t1",
      targetKey: "9.9.9.9",
      timestamp: 2,
    });
    recordAnalysisTraceEvent({
      id: "v1",
      type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
      title: "OTX",
      detail: "0/100 · Cached",
      severity: ANALYSIS_TRACE_SEVERITY.CLEAR,
      parentId: "r1",
      runId: "run-1",
      targetKey: "9.9.9.9",
      timestamp: 3,
    });
    render({ currentTargetKey: "9.9.9.9" });
    expect(container.textContent).not.toContain("SOURCE DETAILS");
    expect(container.querySelector('.vera5-analysis-trace-row[data-vera5-trace-type="vendor"]')).toBeNull();
    // Underlying Trace events remain intact for History/reconstruction.
    expect(
      analysisTraceStore.getSnapshot().some((e) => e.id === "v1" && e.detail === "0/100 · Cached")
    ).toBe(true);
  });
});

describe("AnalysisTrace transaction integrity (Phase 20E retained)", () => {
  it("beginAnalysisTraceEnrichmentRun creates exactly one RUN per call", () => {
    beginAnalysisTraceEnrichmentRun({
      targetKey: "1.2.3.4",
      targetDetail: "IP 1.2.3.4",
    });
    beginAnalysisTraceEnrichmentRun({
      targetKey: "1.2.3.4",
      targetDetail: "IP 1.2.3.4",
      scoreAtStart: 10,
    });
    const runs = analysisTraceStore
      .getSnapshot()
      .filter((event) => event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN);
    expect(runs).toHaveLength(2);
    expect(getActiveAnalysisTraceRun()?.runNumber).toBe(2);
  });

  it("completeAnalysisTraceEnrichmentRun clears the active transaction", () => {
    const active = beginAnalysisTraceEnrichmentRun({
      targetKey: "5.6.7.8",
      targetDetail: "IP 5.6.7.8",
    });
    completeAnalysisTraceEnrichmentRun(active.executionId, {
      status: ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
      scoreAfter: 42,
    });
    expect(getActiveAnalysisTraceRun()).toBeNull();
  });
});

describe("AnalysisTrace (Phase 20F-B signal prioritization)", () => {
  function seedTargetRun(opts?: {
    runStatus?: string;
    vendors?: Array<{
      id: string;
      title: string;
      detail: string;
      severity?: string;
      type?: "vendor" | "error";
      ts: number;
    }>;
    scores?: Array<{
      id: string;
      scoreAfter: number;
      scoreBefore?: number;
      severity?: string;
      ts: number;
    }>;
  }): void {
    recordAnalysisTraceEvent({
      id: "t1",
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      detail: "IP 1.1.1.1",
      targetKey: "1.1.1.1",
      timestamp: 1,
    });
    recordAnalysisTraceEvent({
      id: "r1",
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-1",
      runNumber: 6,
      parentId: "t1",
      targetKey: "1.1.1.1",
      status: (opts?.runStatus as typeof ANALYSIS_TRACE_RUN_STATUS.COMPLETE) ??
        ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
      timestamp: 2,
    });
    for (const vendor of opts?.vendors ?? []) {
      recordAnalysisTraceEvent({
        id: vendor.id,
        type:
          vendor.type === "error"
            ? ANALYSIS_TRACE_EVENT_TYPE.ERROR
            : ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
        title: vendor.title,
        detail: vendor.detail,
        severity: vendor.severity as typeof ANALYSIS_TRACE_SEVERITY.LOW | undefined,
        parentId: "r1",
        runId: "run-1",
        targetKey: "1.1.1.1",
        timestamp: vendor.ts,
      });
    }
    for (const score of opts?.scores ?? []) {
      recordAnalysisTraceEvent({
        id: score.id,
        type: ANALYSIS_TRACE_EVENT_TYPE.SCORE,
        title: "SCORE",
        detail: `${score.scoreAfter}`,
        severity: score.severity as typeof ANALYSIS_TRACE_SEVERITY.LOW | undefined,
        scoreAfter: score.scoreAfter,
        scoreBefore: score.scoreBefore,
        parentId: "r1",
        runId: "run-1",
        targetKey: "1.1.1.1",
        timestamp: score.ts,
      });
    }
  }

  it("keeps all-low vendors out of RUN SIGNALS and omits Source Details", () => {
    seedTargetRun({
      vendors: [
        {
          id: "v1",
          title: "ABUSEIPDB",
          detail: "0/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 10,
        },
        {
          id: "v2",
          title: "VIRUSTOTAL",
          detail: "2/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 11,
        },
        {
          id: "v3",
          title: "SHODAN",
          detail: "1/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 12,
        },
        {
          id: "v4",
          title: "GREYNOISE",
          detail: "0/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 13,
        },
        {
          id: "v5",
          title: "CENSYS",
          detail: "3/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 14,
        },
      ],
      scores: [
        {
          id: "sc1",
          scoreAfter: 10,
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 20,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.querySelector(".vera5-analysis-trace-run-metrics")?.textContent).toContain(
      "5 SOURCES"
    );
    expect(container.querySelector(".vera5-analysis-trace-run-metrics")?.textContent).toContain(
      "NO ELEVATED SIGNALS"
    );
    // Clean complete: no need to fill RUN SIGNALS — metrics already say enough.
    expect(container.textContent).not.toContain("SOURCE DETAILS");
    expect(container.querySelector('.vera5-analysis-trace-row[data-vera5-trace-type="vendor"]')).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-score-movement")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-takeaway")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
  });

  it("surfaces CRITICAL in RUN SIGNALS without dumping LOW vendors", () => {
    seedTargetRun({
      vendors: [
        {
          id: "v1",
          title: "VIRUSTOTAL",
          detail: "8/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 10,
        },
        {
          id: "v2",
          title: "OTX",
          detail: "71/100 · CRITICAL",
          severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
          ts: 11,
        },
        {
          id: "v3",
          title: "SHODAN",
          detail: "0/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 12,
        },
      ],
      scores: [
        {
          id: "sc1",
          scoreAfter: 54,
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 20,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.textContent).toContain("RUN SIGNALS");
    expect(container.querySelector(".vera5-analysis-trace-notable")?.textContent).toContain("OTX");
    expect(container.querySelector(".vera5-analysis-trace-notable")?.textContent).not.toContain(
      "VIRUSTOTAL"
    );
    expect(container.querySelector(".vera5-analysis-trace-notable")?.textContent).not.toContain(
      "SHODAN"
    );
    expect(container.textContent).not.toContain("SOURCE DETAILS");
  });

  it("surfaces HIGH, CRITICAL, and ERROR without dumping all vendors", () => {
    seedTargetRun({
      vendors: [
        {
          id: "v1",
          title: "OTX",
          detail: "71/100 · CRITICAL",
          severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
          ts: 10,
        },
        {
          id: "v2",
          title: "ABUSEIPDB",
          detail: "55/100 · HIGH",
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 11,
        },
        {
          id: "v3",
          title: "URLSCAN.IO",
          detail: "ERROR · HTTP 400",
          type: "error",
          ts: 12,
        },
        {
          id: "v4",
          title: "VIRUSTOTAL",
          detail: "2/100 · LOW",
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 13,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    const notable = container.querySelector(".vera5-analysis-trace-notable")?.textContent ?? "";
    expect(notable).toContain("OTX");
    expect(notable).toContain("ABUSEIPDB");
    expect(notable).toContain("URLSCAN.IO");
    expect(notable).not.toContain("VIRUSTOTAL");
    expect(container.querySelector(".vera5-analysis-trace-run-metrics")?.textContent).toMatch(
      /1 ERROR/
    );
  });

  it("limits SUSPICIOUS dump when many vendors return suspicious", () => {
    const vendors = Array.from({ length: 8 }, (_, i) => ({
      id: `v${i}`,
      title: `VENDOR_${i}`,
      detail: `40/100 · SUSPICIOUS`,
      severity: ANALYSIS_TRACE_SEVERITY.SUSPICIOUS,
      ts: 10 + i,
    }));
    seedTargetRun({ vendors });
    render({ currentTargetKey: "1.1.1.1" });

    const suspiciousRiskRows = container.querySelectorAll(
      '.vera5-analysis-trace-notable-row[data-vera5-finding-kind="RISK"][data-vera5-trace-severity="suspicious"]'
    );
    expect(suspiciousRiskRows.length).toBeLessThanOrEqual(2);
    expect(container.querySelectorAll(".vera5-analysis-trace-notable-row").length).toBeLessThanOrEqual(
      RUN_SIGNAL_CAP
    );
  });

  it("shows SCORE MOVEMENT for 3 → 4 → 3 and never dumps raw SCORE rows", () => {
    seedTargetRun({
      scores: [
        { id: "sc1", scoreAfter: 3, severity: ANALYSIS_TRACE_SEVERITY.LOW, ts: 10 },
        {
          id: "sc2",
          scoreAfter: 4,
          scoreBefore: 3,
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 11,
        },
        {
          id: "sc3",
          scoreAfter: 3,
          scoreBefore: 4,
          severity: ANALYSIS_TRACE_SEVERITY.LOW,
          ts: 12,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.querySelector(".vera5-analysis-trace-score-movement-chain")?.textContent).toBe(
      "3 → 4 → 3"
    );
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
    expect(container.querySelector('.vera5-analysis-trace-row[data-vera5-trace-type="score"]')).toBeNull();
  });

  it("hides SCORE MOVEMENT when scores are identical", () => {
    seedTargetRun({
      scores: [
        { id: "sc1", scoreAfter: 10, severity: ANALYSIS_TRACE_SEVERITY.LOW, ts: 10 },
        { id: "sc2", scoreAfter: 10, severity: ANALYSIS_TRACE_SEVERITY.LOW, ts: 11 },
        { id: "sc3", scoreAfter: 10, severity: ANALYSIS_TRACE_SEVERITY.LOW, ts: 12 },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.querySelector(".vera5-analysis-trace-score-movement")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
  });

  it("compresses long score histories in SCORE MOVEMENT without FINAL scorecard duplicate", () => {
    const scores = Array.from({ length: 12 }, (_, i) => ({
      id: `sc${i}`,
      scoreAfter: i + 1,
      severity:
        i + 1 >= 50
          ? ANALYSIS_TRACE_SEVERITY.HIGH
          : i + 1 >= 25
            ? ANALYSIS_TRACE_SEVERITY.SUSPICIOUS
            : ANALYSIS_TRACE_SEVERITY.LOW,
      ts: 10 + i,
    }));
    seedTargetRun({ scores });
    render({ currentTargetKey: "1.1.1.1" });

    const chain =
      container.querySelector(".vera5-analysis-trace-score-movement-chain")?.textContent ?? "";
    expect(chain).toContain("\u2026");
    expect(chain.startsWith("1")).toBe(true);
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
  });

  it("caps RUN SIGNALS to RUN_SIGNAL_CAP", () => {
    seedTargetRun({
      vendors: [
        {
          id: "v1",
          title: "A",
          detail: "CRITICAL",
          severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
          ts: 10,
        },
        {
          id: "v2",
          title: "B",
          detail: "CRITICAL",
          severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
          ts: 11,
        },
        {
          id: "v3",
          title: "C",
          detail: "HIGH",
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 12,
        },
        {
          id: "v4",
          title: "D",
          detail: "HIGH",
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 13,
        },
        {
          id: "v5",
          title: "E",
          detail: "ERROR",
          type: "error",
          ts: 14,
        },
        {
          id: "v6",
          title: "F",
          detail: "ERROR",
          type: "error",
          ts: 15,
        },
        {
          id: "v7",
          title: "G",
          detail: "HIGH",
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 16,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.querySelectorAll(".vera5-analysis-trace-notable-row").length).toBeLessThanOrEqual(
      RUN_SIGNAL_CAP
    );
  });

  it("updates running-run metrics without final assessment language", () => {
    seedTargetRun({
      runStatus: ANALYSIS_TRACE_RUN_STATUS.RUNNING,
      vendors: [
        {
          id: "v1",
          title: "OTX",
          detail: "79/100 · CRITICAL",
          severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
          ts: 10,
        },
      ],
      scores: [
        { id: "sc1", scoreAfter: 12, severity: ANALYSIS_TRACE_SEVERITY.LOW, ts: 11 },
        {
          id: "sc2",
          scoreAfter: 31,
          scoreBefore: 12,
          severity: ANALYSIS_TRACE_SEVERITY.HIGH,
          ts: 12,
        },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.textContent).toContain("RUNNING");
    expect(container.querySelector(".vera5-analysis-trace-run-metrics")?.textContent).toContain(
      "1 SOURCE RESPONDED"
    );
    expect(container.querySelector(".vera5-analysis-trace-notable")?.textContent).toContain("OTX");
    expect(container.querySelector(".vera5-analysis-trace-run-assessment")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-score-movement-chain")?.textContent).toBe(
      "12 → 31"
    );
  });

  it("keeps previous-run summaries compact with source and error counts", () => {
    recordAnalysisTraceEvent({
      id: "t1",
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      detail: "IP 1.1.1.1",
      targetKey: "1.1.1.1",
      timestamp: 1,
    });
    recordAnalysisTraceEvent({
      id: "r0",
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-0",
      runNumber: 5,
      parentId: "t1",
      targetKey: "1.1.1.1",
      status: ANALYSIS_TRACE_RUN_STATUS.PARTIAL,
      timestamp: 3,
    });
    recordAnalysisTraceEvent({
      id: "v0",
      type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
      title: "VIRUSTOTAL",
      detail: "50/100 · HIGH",
      severity: ANALYSIS_TRACE_SEVERITY.HIGH,
      parentId: "r0",
      runId: "run-0",
      targetKey: "1.1.1.1",
      timestamp: 4,
    });
    recordAnalysisTraceEvent({
      id: "e0",
      type: ANALYSIS_TRACE_EVENT_TYPE.ERROR,
      title: "URLSCAN.IO",
      detail: "TIMEOUT",
      parentId: "r0",
      runId: "run-0",
      targetKey: "1.1.1.1",
      timestamp: 5,
    });
    recordAnalysisTraceEvent({
      id: "sc0",
      type: ANALYSIS_TRACE_EVENT_TYPE.SCORE,
      title: "SCORE",
      detail: "50",
      severity: ANALYSIS_TRACE_SEVERITY.HIGH,
      scoreAfter: 50,
      parentId: "r0",
      runId: "run-0",
      targetKey: "1.1.1.1",
      timestamp: 6,
    });
    recordAnalysisTraceEvent({
      id: "r1",
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-1",
      runNumber: 6,
      parentId: "t1",
      targetKey: "1.1.1.1",
      status: ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
      timestamp: 10,
    });
    recordAnalysisTraceEvent({
      id: "v-cur",
      type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
      title: "OTX",
      detail: "10/100 · LOW",
      severity: ANALYSIS_TRACE_SEVERITY.LOW,
      parentId: "r1",
      runId: "run-1",
      targetKey: "1.1.1.1",
      timestamp: 11,
    });
    recordAnalysisTraceEvent({
      id: "sc-cur",
      type: ANALYSIS_TRACE_EVENT_TYPE.SCORE,
      title: "SCORE",
      detail: "10",
      severity: ANALYSIS_TRACE_SEVERITY.LOW,
      scoreAfter: 10,
      parentId: "r1",
      runId: "run-1",
      targetKey: "1.1.1.1",
      timestamp: 12,
    });
    render({ currentTargetKey: "1.1.1.1" });

    expect(container.textContent).toContain("RUN 06");
    act(() => {
      container.querySelector<HTMLButtonElement>("#vera5-trace-previous-runs-button")?.click();
    });
    const compact = container.querySelector(".vera5-analysis-trace-compact-text")?.textContent ?? "";
    expect(compact).toContain("RUN 05");
    expect(compact).toContain("PARTIAL");
    expect(compact).toContain("2 SRC");
    expect(compact).toContain("1 ERR");
    expect(compact).toContain("50 HIGH");
  });

  it("hides SCORE MOVEMENT when only one score exists", () => {
    seedTargetRun({
      scores: [
        { id: "sc1", scoreAfter: 24, severity: ANALYSIS_TRACE_SEVERITY.SUSPICIOUS, ts: 10 },
      ],
    });
    render({ currentTargetKey: "1.1.1.1" });
    expect(container.querySelector(".vera5-analysis-trace-score-movement")).toBeNull();
    expect(container.querySelector(".vera5-analysis-trace-score-evolution-final")).toBeNull();
  });
});

describe("AnalysisTrace (Phase 20F-F CURRENT de-duplication)", () => {
  function emptySummary(
    overrides: Partial<Parameters<typeof deriveCurrentRunMetrics>[0]> = {}
  ): Parameters<typeof deriveCurrentRunMetrics>[0] {
    return {
      totalSources: 0,
      lowCount: 0,
      suspiciousCount: 0,
      highCount: 0,
      criticalCount: 0,
      errorCount: 0,
      status: "COMPLETE",
      scoreSequence: [],
      scoreEvolutionDisplay: [],
      scoreEvolutionTruncated: false,
      finalScore: null,
      finalSeverity: null,
      ...overrides,
    };
  }

  it("A — 3 low / complete: compact metrics, no Source Details, no FINAL, no Takeaway", () => {
    const summary = emptySummary({
      totalSources: 3,
      lowCount: 3,
      finalScore: 8,
      finalSeverity: "LOW",
      scoreSequence: [{ score: 8, severity: "LOW" }],
      scoreEvolutionDisplay: [{ score: 8, severity: "LOW" }],
    });
    expect(deriveCurrentRunMetrics(summary)).toBe("3 SOURCES · NO ELEVATED SIGNALS");
    expect(deriveRunSignals(summary, []).signals).toHaveLength(0);
    expect(deriveScoreMovement(summary)).toBeNull();
    expect(deriveRunAssessment(summary)).toBeNull();
  });

  it("B — 1 error / partial: coverage 2/3, metrics without PARTIAL repeat", () => {
    const summary = emptySummary({
      totalSources: 3,
      lowCount: 2,
      errorCount: 1,
      status: "PARTIAL",
    });
    const metrics = deriveCurrentRunMetrics(summary) ?? "";
    expect(metrics).toContain("2 USABLE");
    expect(metrics).toContain("1 ERROR");
    expect(metrics).not.toContain("PARTIAL");
    const { signals } = deriveRunSignals(summary, [
      {
        id: "e1",
        type: ANALYSIS_TRACE_EVENT_TYPE.ERROR,
        title: "OTX",
        detail: "HTTP 404",
        timestamp: 1,
      },
    ]);
    expect(signals.some((s) => s.kind === "ERROR" && s.label === "OTX" && s.value === "HTTP 404")).toBe(
      true
    );
    expect(signals.some((s) => s.kind === "COVERAGE" && s.value === "2 / 3")).toBe(true);
  });

  it("C — 2 critical: MULTIPLE ELEVATED assessment", () => {
    const summary = emptySummary({
      totalSources: 2,
      criticalCount: 2,
      finalSeverity: "CRITICAL",
      finalScore: 80,
    });
    expect(deriveRunAssessment(summary)?.tags).toContain("MULTIPLE ELEVATED SIGNALS");
  });

  it("D — 1 high + many low: single elevated assessment", () => {
    const summary = emptySummary({
      totalSources: 5,
      lowCount: 4,
      highCount: 1,
      finalSeverity: "HIGH",
    });
    expect(deriveCurrentRunMetrics(summary)).toContain("1 ELEVATED");
    expect(deriveRunAssessment(summary)?.tags).toContain("SINGLE ELEVATED SIGNAL");
  });

  it("E — 0 elevated: metrics carry the story", () => {
    const summary = emptySummary({ totalSources: 4, lowCount: 4 });
    expect(deriveCurrentRunMetrics(summary)).toBe("4 SOURCES · NO ELEVATED SIGNALS");
    expect(deriveRunSignals(summary, []).signals).toHaveLength(0);
  });

  it("F — score unchanged: no SCORE MOVEMENT", () => {
    const summary = emptySummary({
      totalSources: 1,
      lowCount: 1,
      scoreSequence: [{ score: 22, severity: "LOW" }],
      scoreEvolutionDisplay: [{ score: 22, severity: "LOW" }],
    });
    expect(deriveScoreMovement(summary)).toBeNull();
  });

  it("G — score changes several times: SCORE MOVEMENT shown", () => {
    const summary = emptySummary({
      totalSources: 2,
      highCount: 1,
      scoreSequence: [
        { score: 18, severity: "LOW" },
        { score: 27, severity: "HIGH" },
        { score: 22, severity: "SUSPICIOUS" },
      ],
      scoreEvolutionDisplay: [
        { score: 18, severity: "LOW" },
        { score: 27, severity: "HIGH" },
        { score: 22, severity: "SUSPICIOUS" },
      ],
    });
    expect(deriveScoreMovement(summary)).toBe("18 → 27 → 22");
  });

  it("H — running: metrics responded, no assessment", () => {
    const summary = emptySummary({
      totalSources: 3,
      criticalCount: 1,
      status: "RUNNING",
    });
    expect(deriveCurrentRunMetrics(summary, { running: true })).toBe("3 SOURCES RESPONDED");
    expect(deriveRunAssessment(summary, { running: true })).toBeNull();
  });

  it("I — no usable sources: limited coverage signal", () => {
    const summary = emptySummary({
      totalSources: 2,
      errorCount: 2,
      status: "ERROR",
    });
    const { signals } = deriveRunSignals(summary, [
      {
        id: "e1",
        type: ANALYSIS_TRACE_EVENT_TYPE.ERROR,
        title: "A",
        detail: "TIMEOUT",
        timestamp: 1,
      },
      {
        id: "e2",
        type: ANALYSIS_TRACE_EVENT_TYPE.ERROR,
        title: "B",
        detail: "TIMEOUT",
        timestamp: 2,
      },
    ]);
    expect(signals.some((s) => s.kind === "COVERAGE" && s.value === "0 / 2")).toBe(true);
  });

  it("J — source error + high signal: both visible, assessment incomplete once", () => {
    const summary = emptySummary({
      totalSources: 2,
      highCount: 1,
      errorCount: 1,
      status: "PARTIAL",
    });
    const { signals } = deriveRunSignals(summary, [
      {
        id: "v1",
        type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
        title: "OTX",
        detail: "79/100 · CRITICAL",
        severity: ANALYSIS_TRACE_SEVERITY.CRITICAL,
        timestamp: 1,
      },
      {
        id: "e1",
        type: ANALYSIS_TRACE_EVENT_TYPE.ERROR,
        title: "RDAP/WHOIS",
        detail: "HTTP 400",
        timestamp: 2,
      },
    ]);
    expect(signals.some((s) => s.kind === "RISK")).toBe(true);
    expect(signals.some((s) => s.kind === "ERROR")).toBe(true);
    const tags = deriveRunAssessment(summary)?.tags ?? [];
    expect(tags.filter((t) => /INCOMPLETE|PARTIAL/i.test(t)).length).toBeLessThanOrEqual(1);
  });

  it("K — caps RUN SIGNALS at RUN_SIGNAL_CAP for dense runs", () => {
    expect(RUN_SIGNAL_CAP).toBe(4);
    const summary = emptySummary({
      totalSources: 11,
      criticalCount: 3,
      highCount: 4,
      errorCount: 2,
      status: "PARTIAL",
    });
    const events = Array.from({ length: 11 }, (_, i) => ({
      id: `v${i}`,
      type:
        i < 2
          ? ANALYSIS_TRACE_EVENT_TYPE.ERROR
          : ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
      title: `SRC_${i}`,
      detail: i < 2 ? "HTTP 500" : "CRITICAL",
      severity: i < 2 ? undefined : ANALYSIS_TRACE_SEVERITY.CRITICAL,
      timestamp: i + 1,
    }));
    const { signals, moreCount } = deriveRunSignals(summary, events);
    expect(signals.length).toBeLessThanOrEqual(RUN_SIGNAL_CAP);
    expect(moreCount).toBeGreaterThanOrEqual(0);
  });
});

