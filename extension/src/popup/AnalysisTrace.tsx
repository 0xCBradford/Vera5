/**
 * Phase 20 / 20E / 20F-A…F — ANALYSIS TRACE.
 *
 * Domain state lives in analysisTraceStore. This component owns presentation only
 * and NEVER writes domain events (all begin/complete/record calls live in Popup).
 *
 * 20F-D — CURRENT | HISTORY | SESSION internal views (architecture frozen).
 *
 * 20F-F — CURRENT information responsibility (de-duplication):
 *   CURRENT owns this-run operational telemetry only.
 *   Scorecard owns current score/severity.
 *   ACTIVE IOC owns selected target identity.
 *   Vendor Evidence owns full source/vendor detail.
 *   CURRENT must NOT duplicate those surfaces.
 *
 *   CURRENT structure: compact target · run strip · metrics line ·
 *   RUN SIGNALS · optional RUN ASSESSMENT · score movement (only if real).
 *   SOURCE DETAILS / SCORE PATH / Takeaway prose removed from CURRENT.
 *
 * View switching is presentational only. Disclosure + signal derivation from
 * prior phases remain derived presentation — never synthetic domain events.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ANALYSIS_TRACE_EVENT_TYPE,
  ANALYSIS_TRACE_RUN_STATUS,
  ANALYSIS_TRACE_SEVERITY,
  formatAnalysisTraceTime,
  summarizeAnalysisTraceEvent,
  useAnalysisTrace,
  type AnalysisTraceEvent,
} from "../lib/analysisTrace";

const ANALYSIS_TRACE_TITLE = "Analysis Trace";
const NEAR_BOTTOM_THRESHOLD_PX = 24;
/** Cap RUN SIGNALS rows — keep CURRENT compact (Phase 20F-F: target 2–4). */
const RUN_SIGNAL_CAP = 4;
/** Max error rows admitted into RUN SIGNALS before the global cap. */
const RUN_SIGNAL_ERROR_CAP = 2;
/** Max SUSPICIOUS risk rows when no HIGH/CRITICAL exists. */
const RUN_SIGNAL_SUSPICIOUS_CAP = 2;
/** Max distinct score points shown before visual compression. */
const SCORE_EVOLUTION_MAX_POINTS = 6;

type TraceView = "current" | "history" | "session";

interface TraceNode {
  event: AnalysisTraceEvent;
  children: TraceNode[];
}

interface ScorePoint {
  score: number;
  severity: string | null;
}

/**
 * Phase 20F-B — derived presentation for one enrichment run.
 * Built only from real run children; never written back as Trace domain events.
 */
interface RunSignalSummary {
  totalSources: number;
  lowCount: number;
  suspiciousCount: number;
  highCount: number;
  criticalCount: number;
  errorCount: number;
  status: string | null;
  scoreSequence: ScorePoint[];
  scoreEvolutionDisplay: ScorePoint[];
  scoreEvolutionTruncated: boolean;
  finalScore: number | null;
  finalSeverity: string | null;
}

/** Phase 20F-F — terse operational RUN SIGNAL kinds (presentation-only). */
type RunSignalKind =
  | "RISK"
  | "ERROR"
  | "COVERAGE"
  | "ELEVATED_COUNT"
  | "NO_ELEVATED";

interface RunSignal {
  id: string;
  kind: RunSignalKind;
  label: string;
  value: string;
  severity?: string | null;
  /** Lower number = higher priority. */
  priority: number;
}

/** Structured assessment tags — never prose paragraphs. */
interface RunAssessment {
  tags: string[];
}

function isContextEvent(type: AnalysisTraceEvent["type"]): boolean {
  return (
    type === ANALYSIS_TRACE_EVENT_TYPE.SESSION || type === ANALYSIS_TRACE_EVENT_TYPE.SCAN
  );
}

function isStructuredScoreEvent(event: AnalysisTraceEvent): boolean {
  return event.type === ANALYSIS_TRACE_EVENT_TYPE.SCORE && typeof event.scoreAfter === "number";
}

function buildTraceTree(events: readonly AnalysisTraceEvent[]): TraceNode[] {
  const nodes = new Map<string, TraceNode>();
  for (const event of events) {
    nodes.set(event.id, { event, children: [] });
  }
  const roots: TraceNode[] = [];
  for (const event of events) {
    const node = nodes.get(event.id);
    if (!node) {
      continue;
    }
    const parent = event.parentId ? nodes.get(event.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function formatRunNumber(runNumber: number | undefined): string {
  if (typeof runNumber !== "number") {
    return "";
  }
  return String(runNumber).padStart(2, "0");
}

function formatEventCountLabel(count: number): string {
  return `${count} EVT`;
}

function getRunChildren(node: TraceNode): {
  sources: TraceNode[];
  scores: TraceNode[];
  other: TraceNode[];
} {
  const sources: TraceNode[] = [];
  const scores: TraceNode[] = [];
  const other: TraceNode[] = [];
  for (const child of node.children) {
    if (
      child.event.type === ANALYSIS_TRACE_EVENT_TYPE.VENDOR ||
      child.event.type === ANALYSIS_TRACE_EVENT_TYPE.ERROR
    ) {
      sources.push(child);
    } else if (child.event.type === ANALYSIS_TRACE_EVENT_TYPE.SCORE) {
      scores.push(child);
    } else {
      other.push(child);
    }
  }
  return { sources, scores, other };
}

/** Compress consecutive identical scores: 10,10,27,27,24 → [10, 27, 24]. */
function compressScoreSequence(points: ScorePoint[]): ScorePoint[] {
  const out: ScorePoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && last.score === point.score) {
      if (point.severity) last.severity = point.severity;
      continue;
    }
    out.push({ ...point });
  }
  return out;
}

/**
 * Long-history visual compression: keep first + last (MAX-1) points.
 * Never fabricates middle scores — only drops display points.
 */
function truncateScoreEvolution(points: ScorePoint[]): {
  display: ScorePoint[];
  truncated: boolean;
} {
  if (points.length <= SCORE_EVOLUTION_MAX_POINTS) {
    return { display: points, truncated: false };
  }
  const keepTail = SCORE_EVOLUTION_MAX_POINTS - 1;
  return {
    display: [points[0]!, ...points.slice(points.length - keepTail)],
    truncated: true,
  };
}

function formatScoreEvolutionChain(
  display: ScorePoint[],
  truncated: boolean
): string {
  if (display.length === 0) return "";
  if (display.length === 1) return String(display[0]!.score);

  const arrow = " \u2192 ";
  if (!truncated) {
    return display.map((point) => point.score).join(arrow);
  }
  const [first, ...rest] = display;
  return [String(first!.score), "\u2026", ...rest.map((point) => String(point.score))].join(
    arrow
  );
}

/**
 * SUSPICIOUS visibility retained inside deriveRunSignals (Phase 20F-B/F):
 * - Surface SUSPICIOUS only when there are no HIGH/CRITICAL vendor signals.
 * - Cap at RUN_SIGNAL_SUSPICIOUS_CAP before the global signal cap.
 * LOW never enters RUN SIGNALS (including valid 0/100).
 */

/** Derive run signal summary from real children only — never fabricate counts or scores. */
function deriveRunSignalSummary(run: TraceNode): RunSignalSummary {
  const { sources, scores } = getRunChildren(run);
  let errorCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let suspiciousCount = 0;
  let lowCount = 0;

  for (const child of sources) {
    const event = child.event;
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.ERROR) {
      errorCount += 1;
      continue;
    }
    switch (event.severity) {
      case ANALYSIS_TRACE_SEVERITY.CRITICAL:
        criticalCount += 1;
        break;
      case ANALYSIS_TRACE_SEVERITY.HIGH:
        highCount += 1;
        break;
      case ANALYSIS_TRACE_SEVERITY.SUSPICIOUS:
        suspiciousCount += 1;
        break;
      case ANALYSIS_TRACE_SEVERITY.LOW:
        lowCount += 1;
        break;
      default:
        break;
    }
  }

  // Score events are already children of this run (same runId).
  const rawScorePoints: ScorePoint[] = scores
    .map((node) => node.event)
    .filter((event) => typeof event.scoreAfter === "number")
    .map((event) => ({
      score: event.scoreAfter as number,
      severity: event.severity ? event.severity.toUpperCase() : null,
    }));

  const scoreSequence = compressScoreSequence(rawScorePoints);
  const { display: scoreEvolutionDisplay, truncated: scoreEvolutionTruncated } =
    truncateScoreEvolution(scoreSequence);

  const lastScoreEvent = scores.length > 0 ? scores[scores.length - 1]!.event : null;
  const finalScore =
    typeof lastScoreEvent?.scoreAfter === "number"
      ? lastScoreEvent.scoreAfter
      : typeof run.event.scoreAfter === "number"
        ? run.event.scoreAfter
        : null;
  const finalSeverity = lastScoreEvent?.severity
    ? lastScoreEvent.severity.toUpperCase()
    : run.event.severity
      ? run.event.severity.toUpperCase()
      : null;

  return {
    totalSources: sources.length,
    lowCount,
    suspiciousCount,
    highCount,
    criticalCount,
    errorCount,
    status: run.event.status ? run.event.status.toUpperCase() : null,
    scoreSequence,
    scoreEvolutionDisplay,
    scoreEvolutionTruncated,
    finalScore,
    finalSeverity,
  };
}

function formatCompactRunRow(node: TraceNode): string {
  const summary = deriveRunSignalSummary(node);
  const runNo = formatRunNumber(node.event.runNumber);
  const parts = [
    runNo ? `RUN ${runNo}` : "RUN",
    summary.status ?? "",
  ];
  if (summary.totalSources > 0) {
    parts.push(`${summary.totalSources} SRC`);
  }
  if (summary.errorCount > 0) {
    parts.push(`${summary.errorCount} ERR`);
  }
  if (summary.finalScore !== null) {
    parts.push(
      [String(summary.finalScore), summary.finalSeverity].filter(Boolean).join(" ")
    );
  }
  return parts.filter(Boolean).join(" \u00b7 ");
}

/**
 * Split a target's display detail (e.g. "IP 198.185.159.145") into a short type
 * label + value. Falls back gracefully when no leading type token is present.
 */
function splitTargetIdentity(target: TraceNode): { type: string | null; value: string } {
  const raw = (target.event.detail ?? target.event.targetKey ?? "").trim();
  const spaceIdx = raw.indexOf(" ");
  if (spaceIdx > 0) {
    const type = raw.slice(0, spaceIdx);
    const value = raw.slice(spaceIdx + 1).trim();
    // A leading token is a type label only if it is short and value-free of IOC glyphs.
    if (value && type.length <= 6 && !/[.:/@]/.test(type)) {
      return { type: type.toUpperCase(), value };
    }
  }
  return { type: null, value: raw };
}

/** Coverage state from real outcomes — never fabricated. */
function deriveCoverageState(summary: RunSignalSummary): "FULL" | "PARTIAL" | "LIMITED" {
  if (summary.status === "ERROR") {
    return "LIMITED";
  }
  const responded = summary.totalSources - summary.errorCount;
  if (summary.errorCount > 0) {
    return responded > 0 ? "PARTIAL" : "LIMITED";
  }
  if (summary.status === "PARTIAL") {
    return "PARTIAL";
  }
  return "FULL";
}

function riskSignalPriority(severity: string | null | undefined): number {
  switch (severity) {
    case ANALYSIS_TRACE_SEVERITY.CRITICAL:
      return 1;
    case ANALYSIS_TRACE_SEVERITY.HIGH:
      return 2;
    case ANALYSIS_TRACE_SEVERITY.SUSPICIOUS:
      return 5;
    default:
      return 99;
  }
}

/** Compact error value — no prose, no repeated vendor name. */
function compactErrorValue(title: string, detail?: string): string {
  if (!detail?.trim()) return "ERROR";
  let value = detail.trim().replace(/^ERROR\s*[·•\-:]?\s*/i, "");
  const upperTitle = title.toUpperCase();
  if (value.toUpperCase().startsWith(upperTitle)) {
    value = value.slice(title.length).replace(/^\s*[·•\-:]?\s*/, "");
  }
  return value || "ERROR";
}

/**
 * Phase 20F-F — SCORE MOVEMENT only when ≥2 distinct compressed score states.
 * Single value / identical repeats → null (Scorecard owns the result).
 */
function deriveScoreMovement(summary: RunSignalSummary): string | null {
  if (summary.scoreSequence.length < 2) return null;
  return formatScoreEvolutionChain(
    summary.scoreEvolutionDisplay,
    summary.scoreEvolutionTruncated
  );
}

/**
 * Phase 20F-F — one concise run-metrics line. Never repeats run status (PARTIAL etc.).
 */
function deriveCurrentRunMetrics(
  summary: RunSignalSummary,
  options?: { running?: boolean }
): string | null {
  const { totalSources, errorCount, criticalCount, highCount } = summary;
  if (totalSources === 0 && errorCount === 0) return null;

  if (options?.running) {
    return `${totalSources} ${totalSources === 1 ? "SOURCE" : "SOURCES"} RESPONDED`;
  }

  const usable = Math.max(0, totalSources - errorCount);
  const elevated = criticalCount + highCount;
  const parts: string[] = [
    `${totalSources} ${totalSources === 1 ? "SOURCE" : "SOURCES"}`,
  ];

  if (errorCount > 0) {
    parts.push(`${usable} USABLE`);
    parts.push(`${errorCount} ${errorCount === 1 ? "ERROR" : "ERRORS"}`);
  } else if (elevated > 0) {
    parts.push(`${elevated} ELEVATED`);
  } else {
    parts.push("NO ELEVATED SIGNALS");
  }

  return parts.join(" \u00b7 ");
}

/**
 * Phase 20F-F — RUN SIGNALS (terse facts). Cap at RUN_SIGNAL_CAP.
 * Does not include score movement (owned by deriveScoreMovement).
 * Does not repeat PARTIAL as a label — COVERAGE uses "usable / total".
 */
function deriveRunSignals(
  summary: RunSignalSummary,
  sourceEvents: AnalysisTraceEvent[]
): { signals: RunSignal[]; moreCount: number } {
  const candidates: RunSignal[] = [];
  const hasSevere = sourceEvents.some((event) => {
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.ERROR) return false;
    return (
      event.severity === ANALYSIS_TRACE_SEVERITY.CRITICAL ||
      event.severity === ANALYSIS_TRACE_SEVERITY.HIGH
    );
  });

  let suspiciousTaken = 0;
  let errorTaken = 0;

  for (const event of sourceEvents) {
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.ERROR) {
      if (errorTaken >= RUN_SIGNAL_ERROR_CAP) continue;
      candidates.push({
        id: `error:${event.id}`,
        kind: "ERROR",
        label: event.title,
        value: compactErrorValue(event.title, event.detail),
        severity: null,
        priority: 3,
      });
      errorTaken += 1;
      continue;
    }

    if (
      event.severity === ANALYSIS_TRACE_SEVERITY.CRITICAL ||
      event.severity === ANALYSIS_TRACE_SEVERITY.HIGH
    ) {
      candidates.push({
        id: `risk:${event.id}`,
        kind: "RISK",
        label: event.title,
        value:
          event.detail?.trim() ||
          (event.severity ? event.severity.toUpperCase() : ""),
        severity: event.severity ?? null,
        priority: riskSignalPriority(event.severity),
      });
      continue;
    }

    if (
      event.severity === ANALYSIS_TRACE_SEVERITY.SUSPICIOUS &&
      !hasSevere &&
      suspiciousTaken < RUN_SIGNAL_SUSPICIOUS_CAP
    ) {
      candidates.push({
        id: `risk:${event.id}`,
        kind: "RISK",
        label: event.title,
        value:
          event.detail?.trim() ||
          (event.severity ? event.severity.toUpperCase() : ""),
        severity: event.severity ?? null,
        priority: riskSignalPriority(event.severity),
      });
      suspiciousTaken += 1;
    }
  }

  const usable = Math.max(0, summary.totalSources - summary.errorCount);
  const coverage = deriveCoverageState(summary);
  const elevated = summary.criticalCount + summary.highCount;

  // Compact coverage only when incomplete — never "PARTIAL COVERAGE" prose.
  if (
    summary.totalSources > 0 &&
    (coverage === "PARTIAL" || coverage === "LIMITED" || summary.errorCount > 0)
  ) {
    candidates.push({
      id: "coverage",
      kind: "COVERAGE",
      label: "COVERAGE",
      value: `${usable} / ${summary.totalSources}`,
      priority: 4,
    });
  }

  if (!hasSevere && summary.totalSources > 0) {
    const hasOther =
      errorTaken > 0 ||
      suspiciousTaken > 0 ||
      coverage === "PARTIAL" ||
      coverage === "LIMITED";
    // Clean complete runs: metrics already say NO ELEVATED SIGNALS — skip duplicate row.
    if (hasOther) {
      candidates.push({
        id: "elevated-count",
        kind: "ELEVATED_COUNT",
        label: "ELEVATED SOURCES",
        value: String(elevated),
        priority: 7,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  });

  if (candidates.length <= RUN_SIGNAL_CAP) {
    return { signals: candidates, moreCount: 0 };
  }
  return {
    signals: candidates.slice(0, RUN_SIGNAL_CAP),
    moreCount: candidates.length - RUN_SIGNAL_CAP,
  };
}

/**
 * Phase 20F-F — optional structured RUN ASSESSMENT (tags only, never prose).
 * Returns null when signals/metrics already communicate everything, or while RUNNING.
 */
function deriveRunAssessment(
  summary: RunSignalSummary,
  options?: { running?: boolean }
): RunAssessment | null {
  if (options?.running) return null;
  if (summary.totalSources === 0) return null;

  const elevated = summary.criticalCount + summary.highCount;
  const coverage = deriveCoverageState(summary);
  const incomplete = coverage === "PARTIAL" || coverage === "LIMITED";
  const tags: string[] = [];

  if (elevated >= 2) {
    tags.push("MULTIPLE ELEVATED SIGNALS");
  } else if (elevated === 1) {
    tags.push("SINGLE ELEVATED SIGNAL");
  } else if (summary.suspiciousCount > 0) {
    tags.push("NO ELEVATED CORROBORATION");
  }

  // Do not restate PARTIAL from the run strip — use INCOMPLETE COVERAGE once if needed.
  if (incomplete && elevated === 0 && summary.suspiciousCount === 0) {
    if (summary.errorCount > 0) {
      tags.push("INCOMPLETE COVERAGE");
      tags.push("SOURCE ERRORS PRESENT");
    } else {
      tags.push("INCOMPLETE COVERAGE");
    }
  } else if (incomplete && elevated > 0) {
    tags.push("INCOMPLETE COVERAGE");
  }

  // Simple complete zero-elevated: metrics already say NO ELEVATED SIGNALS — omit assessment.
  if (tags.length === 0) return null;

  // Cap assessment density — max 2 tags.
  return { tags: tags.slice(0, 2) };
}

function LeafRow({
  event,
  latest,
  hideTime,
}: {
  event: AnalysisTraceEvent;
  latest?: boolean;
  hideTime?: boolean;
}) {
  return (
    <li
      className="vera5-analysis-trace-row"
      data-vera5-trace-type={event.type}
      data-vera5-trace-severity={event.severity ?? undefined}
      data-vera5-trace-latest={latest ? "true" : undefined}
      data-vera5-trace-hide-time={hideTime ? "true" : undefined}
    >
      <span className="vera5-analysis-trace-marker" aria-hidden="true" />
      {hideTime ? (
        <span className="vera5-analysis-trace-time" aria-hidden="true" />
      ) : (
        <time
          className="vera5-analysis-trace-time"
          dateTime={new Date(event.timestamp).toISOString()}
        >
          {formatAnalysisTraceTime(event.timestamp)}
        </time>
      )}
      <span className="vera5-analysis-trace-event">{event.title}</span>
      {isStructuredScoreEvent(event) ? (
        <span
          className="vera5-analysis-trace-detail vera5-analysis-trace-detail--score"
          title={summarizeAnalysisTraceEvent(event)}
        >
          <span className="vera5-analysis-trace-score-label" aria-hidden="true">
            SCORE
          </span>
          {typeof event.scoreBefore === "number" && event.scoreBefore !== event.scoreAfter ? (
            <>
              <span className="vera5-analysis-trace-score-prev">{event.scoreBefore}</span>
              <span className="vera5-analysis-trace-score-arrow" aria-hidden="true">
                {"\u2192"}
              </span>
            </>
          ) : null}
          <span className="vera5-analysis-trace-score-value">{event.scoreAfter}</span>
          {event.severity ? (
            <span className="vera5-analysis-trace-score-verdict">
              {event.severity.toUpperCase()}
            </span>
          ) : null}
        </span>
      ) : event.detail ? (
        <span className="vera5-analysis-trace-detail" title={event.detail}>
          {event.detail}
        </span>
      ) : (
        <span className="vera5-analysis-trace-detail" aria-hidden="true" />
      )}
    </li>
  );
}

function DisclosureControl({
  id,
  label,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="vera5-analysis-trace-disclosure" data-vera5-expanded={expanded ? "true" : "false"}>
      <button
        type="button"
        id={`${id}-button`}
        className="vera5-analysis-trace-disclosure-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="vera5-analysis-trace-disclosure-label">{label}</span>
        <span className="vera5-analysis-trace-disclosure-chevron" aria-hidden="true" />
      </button>
      {expanded && children ? (
        <div id={id} className="vera5-analysis-trace-disclosure-body" role="region" aria-labelledby={`${id}-button`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Slim, enterprise-style internal subnav — subordinate to the app's main tabs. */
function TraceViewTabs({
  activeView,
  onSelect,
  historyCount,
  sessionCount,
}: {
  activeView: TraceView;
  onSelect: (view: TraceView) => void;
  historyCount: number;
  sessionCount: number;
}) {
  const tabs: Array<{ id: TraceView; label: string; count?: number }> = [
    { id: "current", label: "CURRENT" },
    { id: "history", label: "HISTORY", count: historyCount },
    { id: "session", label: "SESSION", count: sessionCount },
  ];
  return (
    <div
      className="vera5-analysis-trace-viewtabs"
      role="tablist"
      aria-label="Analysis trace views"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeView;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`vera5-trace-viewtab-${tab.id}`}
            aria-selected={active}
            aria-controls="vera5-analysis-trace-body"
            className="vera5-analysis-trace-viewtab"
            data-vera5-active={active ? "true" : "false"}
            onClick={() => onSelect(tab.id)}
          >
            <span className="vera5-analysis-trace-viewtab-label">{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span className="vera5-analysis-trace-viewtab-count">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Compact identity + run-state header — high value, low noise. */
function TraceCurrentHeader({
  currentTarget,
  currentRun,
  status,
}: {
  currentTarget: TraceNode;
  currentRun: TraceNode | null;
  status: string | null;
}) {
  const { type, value } = splitTargetIdentity(currentTarget);
  return (
    <div className="vera5-analysis-trace-current-header">
      <div className="vera5-analysis-trace-current-target">
        <span
          className="vera5-analysis-trace-node vera5-analysis-trace-node--target"
          aria-hidden="true"
        />
        <span className="vera5-analysis-trace-current-kicker">CURRENT TARGET</span>
        {type ? <span className="vera5-analysis-trace-type-chip">{type}</span> : null}
        <span className="vera5-analysis-trace-current-value" title={value}>
          {value}
        </span>
      </div>
      {currentRun ? (
        <div
          className="vera5-analysis-trace-runline"
          data-vera5-trace-status={currentRun.event.status ?? undefined}
        >
          <span
            className="vera5-analysis-trace-node vera5-analysis-trace-node--run"
            aria-hidden="true"
          />
          <span className="vera5-analysis-trace-branch-label">
            {typeof currentRun.event.runNumber === "number"
              ? `RUN ${formatRunNumber(currentRun.event.runNumber)}`
              : "RUN"}
          </span>
          {status ? (
            <span
              className="vera5-analysis-trace-branch-status"
              data-vera5-trace-status={currentRun.event.status ?? undefined}
            >
              {status}
            </span>
          ) : null}
          <time className="vera5-analysis-trace-branch-time">
            {formatAnalysisTraceTime(currentRun.event.timestamp)}
          </time>
        </div>
      ) : null}
    </div>
  );
}

/** Phase 20F-F — concise metrics line (replaces chip strip). Never repeats run status. */
function TraceCurrentMetrics({ line }: { line: string | null }) {
  if (!line) return null;
  return <p className="vera5-analysis-trace-run-metrics">{line}</p>;
}

/** Phase 20F-F — RUN SIGNALS: terse operational telemetry rows. */
function TraceCurrentRunSignals({
  signals,
  moreCount,
}: {
  signals: RunSignal[];
  moreCount: number;
}) {
  if (signals.length === 0) return null;
  return (
    <div className="vera5-analysis-trace-notable" aria-label="Run signals">
      <span className="vera5-analysis-trace-notable-kicker">RUN SIGNALS</span>
      <ul className="vera5-analysis-trace-notable-list" role="list">
        {signals.map((signal) => (
          <li
            key={signal.id}
            className="vera5-analysis-trace-notable-row"
            data-vera5-finding-kind={signal.kind}
            data-vera5-trace-type={
              signal.kind === "ERROR" ? "error" : signal.kind === "RISK" ? "vendor" : "meta"
            }
            data-vera5-trace-severity={signal.severity ?? undefined}
            title={`${signal.label} · ${signal.value}`}
          >
            <span className="vera5-analysis-trace-notable-title">{signal.label}</span>
            <span className="vera5-analysis-trace-notable-detail">{signal.value}</span>
          </li>
        ))}
      </ul>
      {moreCount > 0 ? (
        <p className="vera5-analysis-trace-notable-more">+{moreCount} MORE</p>
      ) : null}
    </div>
  );
}

/** Phase 20F-F — optional structured assessment (tags only; never prose). */
function TraceCurrentRunAssessment({ assessment }: { assessment: RunAssessment | null }) {
  if (!assessment || assessment.tags.length === 0) return null;
  return (
    <div className="vera5-analysis-trace-run-assessment" aria-label="Run assessment">
      <span className="vera5-analysis-trace-run-assessment-kicker">RUN ASSESSMENT</span>
      <span className="vera5-analysis-trace-run-assessment-tags">
        {assessment.tags.join(" \u00b7 ")}
      </span>
    </div>
  );
}

/** Score movement only — never a static FINAL score duplicate of the Scorecard. */
function TraceCurrentScoreMovement({ chain }: { chain: string | null }) {
  if (!chain) return null;
  return (
    <div className="vera5-analysis-trace-score-movement" aria-label="Score movement">
      <span className="vera5-analysis-trace-score-movement-kicker">SCORE MOVEMENT</span>
      <span className="vera5-analysis-trace-score-movement-chain">{chain}</span>
    </div>
  );
}

/**
 * Same-target previous runs stay collapsed and demoted.
 * SOURCE DETAILS removed (Vendor Evidence owns vendor detail).
 * SCORE PATH removed (Scorecard owns current score; movement is shown above when real).
 */
function TraceCurrentPreviousRuns({
  previousRuns,
  previousRunsExpanded,
  onTogglePreviousRuns,
  expandedPreviousRunIds,
  onTogglePreviousRun,
}: {
  previousRuns: TraceNode[];
  previousRunsExpanded: boolean;
  onTogglePreviousRuns: () => void;
  expandedPreviousRunIds: Record<string, boolean>;
  onTogglePreviousRun: (id: string) => void;
}) {
  if (previousRuns.length === 0) return null;
  return (
    <div className="vera5-analysis-trace-details">
      <DisclosureControl
        id="vera5-trace-previous-runs"
        label={`PREVIOUS RUNS · ${previousRuns.length}`}
        expanded={previousRunsExpanded}
        onToggle={onTogglePreviousRuns}
      >
        <ul className="vera5-analysis-trace-compact-list" role="list">
          {[...previousRuns].reverse().map((run) => {
            const open = Boolean(expandedPreviousRunIds[run.event.id]);
            const { sources } = getRunChildren(run);
            return (
              <li key={run.event.id} className="vera5-analysis-trace-compact-item">
                <button
                  type="button"
                  className="vera5-analysis-trace-compact-row"
                  aria-expanded={open}
                  onClick={() => onTogglePreviousRun(run.event.id)}
                >
                  <span className="vera5-analysis-trace-compact-text">
                    {formatCompactRunRow(run)}
                  </span>
                  <span className="vera5-analysis-trace-disclosure-chevron" aria-hidden="true" />
                </button>
                {open && sources.length > 0 ? (
                  <ol
                    className="vera5-analysis-trace-children vera5-analysis-trace-children--quiet"
                    role="list"
                  >
                    {sources.map((child) => (
                      <LeafRow key={child.event.id} event={child.event} hideTime />
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      </DisclosureControl>
    </div>
  );
}

/** CURRENT — this-run operational telemetry only (Phase 20F-F). */
function CurrentTraceView({
  currentTarget,
  currentRun,
  currentRunSignals,
  sourceChildren,
  previousRuns,
  isCurrentRunRunning,
  previousRunsExpanded,
  onTogglePreviousRuns,
  expandedPreviousRunIds,
  onTogglePreviousRun,
}: {
  currentTarget: TraceNode | null;
  currentRun: TraceNode | null;
  currentRunSignals: RunSignalSummary | null;
  sourceChildren: TraceNode[];
  previousRuns: TraceNode[];
  isCurrentRunRunning: boolean;
  previousRunsExpanded: boolean;
  onTogglePreviousRuns: () => void;
  expandedPreviousRunIds: Record<string, boolean>;
  onTogglePreviousRun: (id: string) => void;
}) {
  if (!currentTarget) {
    return (
      <p className="vera5-analysis-trace-empty">
        No active target. Select an indicator to begin an investigation — session activity
        is available under SESSION.
      </p>
    );
  }

  const sourceEvents = sourceChildren.map((child) => child.event);
  const metricsLine =
    currentRun && currentRunSignals
      ? deriveCurrentRunMetrics(currentRunSignals, { running: isCurrentRunRunning })
      : null;
  const runSignals =
    currentRun && currentRunSignals
      ? deriveRunSignals(currentRunSignals, sourceEvents)
      : { signals: [] as RunSignal[], moreCount: 0 };
  const assessment =
    currentRun && currentRunSignals
      ? deriveRunAssessment(currentRunSignals, { running: isCurrentRunRunning })
      : null;
  const scoreMovement =
    currentRun && currentRunSignals ? deriveScoreMovement(currentRunSignals) : null;

  return (
    <section
      className="vera5-analysis-trace-current"
      aria-label="Current run"
      data-vera5-trace-type="target"
    >
      <TraceCurrentHeader
        currentTarget={currentTarget}
        currentRun={currentRun}
        status={currentRunSignals?.status ?? null}
      />

      {!currentRun || !currentRunSignals ? (
        <p className="vera5-analysis-trace-idle">No enrichment run yet</p>
      ) : (
        <>
          <TraceCurrentMetrics line={metricsLine} />
          <TraceCurrentRunSignals
            signals={runSignals.signals}
            moreCount={runSignals.moreCount}
          />
          <TraceCurrentScoreMovement chain={scoreMovement} />
          <TraceCurrentRunAssessment assessment={assessment} />
          <TraceCurrentPreviousRuns
            previousRuns={previousRuns}
            previousRunsExpanded={previousRunsExpanded}
            onTogglePreviousRuns={onTogglePreviousRuns}
            expandedPreviousRunIds={expandedPreviousRunIds}
            onTogglePreviousRun={onTogglePreviousRun}
          />
        </>
      )}
    </section>
  );
}

/** HISTORY — previously investigated targets and their runs (compact, expandable). */
function HistoryTraceView({
  historicalTargets,
  expandedTargetIds,
  onToggleTarget,
  expandedRunIds,
  onToggleRun,
}: {
  historicalTargets: TraceNode[];
  expandedTargetIds: Record<string, boolean>;
  onToggleTarget: (id: string) => void;
  expandedRunIds: Record<string, boolean>;
  onToggleRun: (id: string) => void;
}) {
  if (historicalTargets.length === 0) {
    return (
      <p className="vera5-analysis-trace-empty">
        No previous targets yet. Prior investigations will collect here.
      </p>
    );
  }

  return (
    <ul className="vera5-analysis-trace-compact-list" role="list" aria-label="Target history">
      {[...historicalTargets].reverse().map((target) => {
        const open = Boolean(expandedTargetIds[target.event.id]);
        const runs = target.children.filter(
          (child) => child.event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN
        );
        return (
          <li key={target.event.id} className="vera5-analysis-trace-compact-item">
            <button
              type="button"
              className="vera5-analysis-trace-compact-row"
              aria-expanded={open}
              onClick={() => onToggleTarget(target.event.id)}
            >
              <span className="vera5-analysis-trace-compact-text">
                {target.event.detail ?? target.event.targetKey}
                {" \u00b7 "}
                {runs.length} {runs.length === 1 ? "RUN" : "RUNS"}
              </span>
              <span className="vera5-analysis-trace-disclosure-chevron" aria-hidden="true" />
            </button>
            {open ? (
              <ul className="vera5-analysis-trace-compact-list" role="list">
                {[...runs].reverse().map((run) => {
                  const runOpen = Boolean(expandedRunIds[run.event.id]);
                  const { sources } = getRunChildren(run);
                  return (
                    <li key={run.event.id} className="vera5-analysis-trace-compact-item">
                      <button
                        type="button"
                        className="vera5-analysis-trace-compact-row"
                        aria-expanded={runOpen}
                        onClick={() => onToggleRun(run.event.id)}
                      >
                        <span className="vera5-analysis-trace-compact-text">
                          {formatCompactRunRow(run)}
                        </span>
                        <span
                          className="vera5-analysis-trace-disclosure-chevron"
                          aria-hidden="true"
                        />
                      </button>
                      {runOpen && sources.length > 0 ? (
                        <ol
                          className="vera5-analysis-trace-children vera5-analysis-trace-children--quiet"
                          role="list"
                        >
                          {sources.map((child) => (
                            <LeafRow key={child.event.id} event={child.event} hideTime />
                          ))}
                        </ol>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** SESSION — lightweight chronological operational log for this browser session. */
function SessionTraceView({ sessionEvents }: { sessionEvents: AnalysisTraceEvent[] }) {
  if (sessionEvents.length === 0) {
    return (
      <p className="vera5-analysis-trace-empty">
        No session activity yet. Scanning a page will record session chronology here.
      </p>
    );
  }
  return (
    <ol className="vera5-analysis-trace-context" aria-label="Session chronology">
      {sessionEvents.map((event) => (
        <li key={event.id} className="vera5-analysis-trace-context-row">
          <time className="vera5-analysis-trace-context-time">
            {formatAnalysisTraceTime(event.timestamp)}
          </time>
          <span className="vera5-analysis-trace-context-label">{event.title}</span>
          {event.detail ? (
            <span className="vera5-analysis-trace-context-detail">{event.detail}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function AnalysisTrace({ currentTargetKey }: { currentTargetKey?: string }) {
  const events = useAnalysisTrace();
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Internal view selection is presentation-only. It never writes domain events.
  const [activeView, setActiveView] = useState<TraceView>("current");
  const userSelectedViewRef = useRef(false);

  // Presentation-only disclosure state (never written into domain events).
  const [previousRunsExpanded, setPreviousRunsExpanded] = useState(false);
  const [expandedHistoricalTargetIds, setExpandedHistoricalTargetIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedHistoricalRunIds, setExpandedHistoricalRunIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedPreviousRunIds, setExpandedPreviousRunIds] = useState<Record<string, boolean>>(
    {}
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const lastCountRef = useRef(events.length);
  const prevTargetIdRef = useRef<string | null>(null);
  const prevRunIdRef = useRef<string | null>(null);
  // Independent scroll offset per internal view (restored on switch).
  const scrollByViewRef = useRef<Record<TraceView, number>>({
    current: 0,
    history: 0,
    session: 0,
  });

  const eventCount = events.length;
  const roots = useMemo(() => buildTraceTree(events), [events]);

  const sessionEvents = useMemo(
    () => roots.filter((node) => isContextEvent(node.event.type)).map((node) => node.event),
    [roots]
  );

  const targetNodes = useMemo(
    () => roots.filter((node) => node.event.type === ANALYSIS_TRACE_EVENT_TYPE.TARGET),
    [roots]
  );

  const { currentTarget, historicalTargets, currentRun, previousRuns } = useMemo(() => {
    let current: TraceNode | null = null;
    if (currentTargetKey) {
      for (let i = targetNodes.length - 1; i >= 0; i -= 1) {
        if (targetNodes[i].event.targetKey === currentTargetKey) {
          current = targetNodes[i];
          break;
        }
      }
    }
    if (!current && targetNodes.length) {
      current = targetNodes[targetNodes.length - 1];
    }
    const historical = targetNodes.filter((node) => node !== current);
    const runs = current
      ? current.children.filter((child) => child.event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN)
      : [];
    const newest = runs.length ? runs[runs.length - 1] : null;
    const previous = newest ? runs.slice(0, -1) : runs;
    return {
      currentTarget: current,
      historicalTargets: historical,
      currentRun: newest,
      previousRuns: previous,
    };
  }, [targetNodes, currentTargetKey]);

  const currentRunSignals = useMemo(
    () => (currentRun ? deriveRunSignalSummary(currentRun) : null),
    [currentRun]
  );

  const sourceChildren = useMemo(
    () => (currentRun ? getRunChildren(currentRun).sources : []),
    [currentRun]
  );

  const isCurrentRunRunning =
    currentRun?.event.status === ANALYSIS_TRACE_RUN_STATUS.RUNNING;

  const hasInvestigation = Boolean(currentTarget);

  /**
   * Effective view resolves the tab to render. Until the analyst explicitly
   * picks a tab, orient to SESSION when there is no active target (so a fresh
   * scan lands somewhere useful), otherwise CURRENT. Once the analyst chooses a
   * tab, that choice is always honored — switching never happens unexpectedly.
   */
  const effectiveView: TraceView = userSelectedViewRef.current
    ? activeView
    : hasInvestigation
      ? "current"
      : sessionEvents.length > 0
        ? "session"
        : "current";

  const selectView = (view: TraceView) => {
    userSelectedViewRef.current = true;
    setActiveView(view);
  };

  // New target → reset previous-run disclosure for the new investigation focus.
  useEffect(() => {
    const targetId = currentTarget?.event.id ?? null;
    if (targetId && targetId !== prevTargetIdRef.current) {
      setPreviousRunsExpanded(false);
      setExpandedPreviousRunIds({});
    }
    prevTargetIdRef.current = targetId;
  }, [currentTarget?.event.id]);

  // New run → Previous Runs collapsed.
  useEffect(() => {
    const runId = currentRun?.event.id ?? null;
    if (runId && runId !== prevRunIdRef.current) {
      setPreviousRunsExpanded(false);
      setExpandedPreviousRunIds({});
    }
    prevRunIdRef.current = runId;
  }, [currentRun?.event.id]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    scrollByViewRef.current[effectiveView] = node.scrollTop;
    nearBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
  };

  // Restore each view's own scroll position when switching between views.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || panelCollapsed) {
      return;
    }
    node.scrollTop = scrollByViewRef.current[effectiveView] ?? 0;
    nearBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
  }, [effectiveView, panelCollapsed]);

  // Autoscroll only the CURRENT view as its live run events arrive (near-bottom only).
  useEffect(() => {
    const grew = events.length > lastCountRef.current;
    lastCountRef.current = events.length;
    if (panelCollapsed || !grew || effectiveView !== "current") {
      return;
    }
    const node = scrollRef.current;
    if (node && nearBottomRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [events.length, panelCollapsed, effectiveView]);

  const activeTabId = `vera5-trace-viewtab-${effectiveView}`;

  return (
    <section
      className="vera5-analysis-trace"
      aria-label="Analysis trace"
      data-vera5-expanded={panelCollapsed ? "false" : "true"}
    >
      <button
        type="button"
        className="vera5-analysis-trace-header"
        aria-expanded={!panelCollapsed}
        aria-controls="vera5-analysis-trace-body"
        onClick={() => setPanelCollapsed((value) => !value)}
      >
        <span className="vera5-analysis-trace-brand">
          <span className="vera5-analysis-trace-sig" aria-hidden="true" />
          <span className="vera5-analysis-trace-title">{ANALYSIS_TRACE_TITLE}</span>
        </span>
        {/* 20F-C/20F-D — header carries only instrument identity + a demoted count. */}
        {eventCount > 0 ? (
          <span className="vera5-analysis-trace-count" data-vera5-secondary="true">
            {formatEventCountLabel(eventCount)}
          </span>
        ) : null}
        <span
          className="vera5-analysis-trace-disclosure-chevron vera5-analysis-trace-header-chevron"
          data-vera5-expanded={panelCollapsed ? "false" : "true"}
          aria-hidden="true"
        />
      </button>

      {!panelCollapsed ? (
        eventCount === 0 ? (
          <div className="vera5-analysis-trace-shell">
            <p className="vera5-analysis-trace-empty">
              No analytical events recorded yet. Scan a page and select an indicator to begin the
              investigation chronology.
            </p>
          </div>
        ) : (
          <div className="vera5-analysis-trace-shell">
            <TraceViewTabs
              activeView={effectiveView}
              onSelect={selectView}
              historyCount={historicalTargets.length}
              sessionCount={sessionEvents.length}
            />
            <div
              id="vera5-analysis-trace-body"
              className="vera5-analysis-trace-body"
              role="tabpanel"
              aria-labelledby={activeTabId}
              ref={scrollRef}
              onScroll={handleScroll}
            >
              {effectiveView === "current" ? (
                <CurrentTraceView
                  currentTarget={currentTarget}
                  currentRun={currentRun}
                  currentRunSignals={currentRunSignals}
                  sourceChildren={sourceChildren}
                  previousRuns={previousRuns}
                  isCurrentRunRunning={isCurrentRunRunning}
                  previousRunsExpanded={previousRunsExpanded}
                  onTogglePreviousRuns={() => setPreviousRunsExpanded((open) => !open)}
                  expandedPreviousRunIds={expandedPreviousRunIds}
                  onTogglePreviousRun={(id) =>
                    setExpandedPreviousRunIds((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                />
              ) : effectiveView === "history" ? (
                <HistoryTraceView
                  historicalTargets={historicalTargets}
                  expandedTargetIds={expandedHistoricalTargetIds}
                  onToggleTarget={(id) =>
                    setExpandedHistoricalTargetIds((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  expandedRunIds={expandedHistoricalRunIds}
                  onToggleRun={(id) =>
                    setExpandedHistoricalRunIds((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                />
              ) : (
                <SessionTraceView sessionEvents={sessionEvents} />
              )}
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}

export {
  ANALYSIS_TRACE_EVENT_TYPE,
  deriveCurrentRunMetrics,
  deriveRunSignals,
  deriveRunAssessment,
  deriveScoreMovement,
  RUN_SIGNAL_CAP,
};
