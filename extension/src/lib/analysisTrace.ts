/**
 * Phase 20 — ANALYSIS TRACE / investigation activity ledger.
 *
 * A session-scoped, in-memory chronology of meaningful analytical events for the
 * current VERA5 investigation (SESSION, SCAN, TARGET, ENRICH, VENDOR, SCORE,
 * PIVOT, EXPORT, COLLECTION, ERROR). Every production event must originate from a
 * real VERA5 action or state transition — this module never fabricates data.
 *
 * Retention is in-memory for the panel/session lifetime with a rolling cap; it
 * makes zero network requests and records analyst-facing summaries only (never
 * secrets, headers, or raw debug payloads).
 */
import { useSyncExternalStore } from "react";

export const ANALYSIS_TRACE_EVENT_TYPE = {
  SESSION: "session",
  SCAN: "scan",
  TARGET: "target",
  /** Phase 20D — an enrichment RUN: parent of the vendor/score/error children it produced. */
  RUN: "run",
  ENRICH: "enrich",
  VENDOR: "vendor",
  SCORE: "score",
  PIVOT: "pivot",
  EXPORT: "export",
  COLLECTION: "collection",
  ERROR: "error",
} as const;

export type AnalysisTraceEventType =
  (typeof ANALYSIS_TRACE_EVENT_TYPE)[keyof typeof ANALYSIS_TRACE_EVENT_TYPE];

/** Phase 20D — lifecycle status for an enrichment RUN (never fabricated). */
export const ANALYSIS_TRACE_RUN_STATUS = {
  RUNNING: "running",
  COMPLETE: "complete",
  PARTIAL: "partial",
  ERROR: "error",
} as const;

export type AnalysisTraceRunStatus =
  (typeof ANALYSIS_TRACE_RUN_STATUS)[keyof typeof ANALYSIS_TRACE_RUN_STATUS];

export const ANALYSIS_TRACE_SEVERITY = {
  INFO: "info",
  CLEAR: "clear",
  LOW: "low",
  SUSPICIOUS: "suspicious",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type AnalysisTraceSeverity =
  (typeof ANALYSIS_TRACE_SEVERITY)[keyof typeof ANALYSIS_TRACE_SEVERITY];

/** Rolling session cap — oldest events drop first once exceeded. */
export const ANALYSIS_TRACE_EVENT_CAP = 400;

/** Phase 20D — max distinct target branches retained; oldest target subtree drops first. */
export const ANALYSIS_TRACE_MAX_TARGETS = 12;

export interface AnalysisTraceEvent {
  id: string;
  timestamp: number;
  type: AnalysisTraceEventType;
  /** EVENT/SOURCE column label (event type name, or vendor source for VENDOR). */
  title: string;
  /** DETAIL column text — analyst-facing summary only. */
  detail?: string;
  source?: string;
  severity?: AnalysisTraceSeverity;
  scoreBefore?: number;
  scoreAfter?: number;
  targetKey?: string;
  /** Phase 20D — hierarchy: enrichment-run identity this event belongs to. */
  runId?: string;
  /** Phase 20D — hierarchy: id of the parent event (TARGET for RUN, RUN for children). */
  parentId?: string;
  /** Phase 20D — human-readable session-local run number (RUN events). */
  runNumber?: number;
  /** Phase 20D — RUN lifecycle status; only set from real state. */
  status?: AnalysisTraceRunStatus;
  /** Dedupe guard: a new event equal to the most recent event's key is dropped. */
  dedupeKey?: string;
}

export interface CreateAnalysisTraceEventInput {
  type: AnalysisTraceEventType;
  title: string;
  detail?: string;
  source?: string;
  severity?: AnalysisTraceSeverity;
  scoreBefore?: number;
  scoreAfter?: number;
  targetKey?: string;
  runId?: string;
  parentId?: string;
  runNumber?: number;
  status?: AnalysisTraceRunStatus;
  dedupeKey?: string;
  id?: string;
  timestamp?: number;
}

export interface AnalysisTraceEventPatch {
  detail?: string;
  severity?: AnalysisTraceSeverity;
  scoreBefore?: number;
  scoreAfter?: number;
  status?: AnalysisTraceRunStatus;
}

let sequence = 0;

export function createAnalysisTraceEvent(
  input: CreateAnalysisTraceEventInput
): AnalysisTraceEvent {
  const timestamp = input.timestamp ?? Date.now();
  sequence = (sequence + 1) % 1_000_000;
  const id = input.id ?? `atr-${timestamp}-${sequence}`;
  return {
    id,
    timestamp,
    type: input.type,
    title: input.title,
    detail: input.detail,
    source: input.source,
    severity: input.severity,
    scoreBefore: input.scoreBefore,
    scoreAfter: input.scoreAfter,
    targetKey: input.targetKey,
    runId: input.runId,
    parentId: input.parentId,
    runNumber: input.runNumber,
    status: input.status,
    dedupeKey: input.dedupeKey,
  };
}

/**
 * Phase 20D — bound target history: keep only the most recent `maxTargets`
 * distinct target branches (by first-seen order), dropping the entire subtree
 * (all events sharing the pruned `targetKey`) of older targets. Session-level
 * events without a targetKey (SESSION/SCAN) are never pruned here.
 */
export function pruneTraceTargets(
  events: readonly AnalysisTraceEvent[],
  maxTargets: number = ANALYSIS_TRACE_MAX_TARGETS
): readonly AnalysisTraceEvent[] {
  const order: string[] = [];
  for (const event of events) {
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.TARGET && event.targetKey) {
      if (!order.includes(event.targetKey)) {
        order.push(event.targetKey);
      }
    }
  }
  if (order.length <= maxTargets) {
    return events;
  }
  const drop = new Set(order.slice(0, order.length - maxTargets));
  return events.filter((event) => !event.targetKey || !drop.has(event.targetKey));
}

/**
 * Append with consecutive-dedupe + rolling cap. A React rerender that re-emits
 * the current state produces the same `dedupeKey` as the most recent event and
 * is therefore dropped — rerenders can never create duplicate events.
 */
export function appendAnalysisTraceEvent(
  events: readonly AnalysisTraceEvent[],
  next: AnalysisTraceEvent,
  cap: number = ANALYSIS_TRACE_EVENT_CAP
): readonly AnalysisTraceEvent[] {
  const last = events[events.length - 1];
  if (next.dedupeKey && last?.dedupeKey && next.dedupeKey === last.dedupeKey) {
    return events;
  }
  const appended = [...events, next];
  if (appended.length > cap) {
    return appended.slice(appended.length - cap);
  }
  return appended;
}

/** Platform-consistent numeric-score → severity mapping (mirrors composite thresholds). */
export function resolveAnalysisTraceSeverityFromScore(
  score: number | null | undefined
): AnalysisTraceSeverity | undefined {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return undefined;
  }
  if (score <= 0) {
    return ANALYSIS_TRACE_SEVERITY.CLEAR;
  }
  if (score >= 65) {
    return ANALYSIS_TRACE_SEVERITY.CRITICAL;
  }
  if (score >= 30) {
    return ANALYSIS_TRACE_SEVERITY.HIGH;
  }
  if (score >= 15) {
    return ANALYSIS_TRACE_SEVERITY.SUSPICIOUS;
  }
  return ANALYSIS_TRACE_SEVERITY.LOW;
}

/** Verdict word matching VERA5 composite scoring (CLEAR/LOW/SUSPICIOUS/HIGH/CRITICAL). */
export function resolveAnalysisTraceScoreVerdict(score: number): string {
  if (score <= 0) {
    return "CLEAR";
  }
  if (score >= 65) {
    return "CRITICAL";
  }
  if (score >= 30) {
    return "HIGH";
  }
  if (score >= 15) {
    return "SUSPICIOUS";
  }
  return "LOW";
}

/** Local wall-clock timestamp rendered as HH:mm:ss. */
export function formatAnalysisTraceTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Compact "TITLE detail" summary for the collapsed header (truncation is visual). */
export function summarizeAnalysisTraceEvent(event: AnalysisTraceEvent): string {
  const title = event.title.trim();
  const detail = event.detail?.trim();
  return detail ? `${title} ${detail}` : title;
}

type Listener = () => void;

const EMPTY_SNAPSHOT: readonly AnalysisTraceEvent[] = Object.freeze([]);

/**
 * Phase 20E — domain pointer to the in-flight enrichment transaction.
 * Lives in the session store (not React component state) so remount / tab
 * navigation cannot orphan or recreate it.
 */
export interface AnalysisTraceActiveRun {
  /** Same as runId — the enrichment execution identity. */
  executionId: string;
  runId: string;
  eventId: string;
  runNumber: number;
  targetKey: string;
  /** Composite score observed when the run began (real value or undefined). */
  scoreAtStart?: number;
}

class AnalysisTraceStore {
  private events: readonly AnalysisTraceEvent[] = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<Listener>();
  /** Global (non-consecutive) dedupe of keyed events — rerender/reselect safety. */
  private seenDedupeKeys = new Set<string>();
  /** At most one in-flight enrichment transaction (authoritative begin/complete). */
  private activeRun: AnalysisTraceActiveRun | null = null;

  record(input: CreateAnalysisTraceEventInput): AnalysisTraceEvent | null {
    if (input.dedupeKey && this.seenDedupeKeys.has(input.dedupeKey)) {
      return null;
    }
    const event = createAnalysisTraceEvent(input);
    const appended = appendAnalysisTraceEvent(this.events, event);
    if (appended === this.events) {
      return null;
    }
    this.events = pruneTraceTargets(appended);
    this.rebuildSeenKeys();
    this.emit();
    return event;
  }

  private rebuildSeenKeys(): void {
    const seen = new Set<string>();
    for (const event of this.events) {
      if (event.dedupeKey) {
        seen.add(event.dedupeKey);
      }
    }
    this.seenDedupeKeys = seen;
  }

  /**
   * Immutably patch an existing event (e.g. RUN status → COMPLETE, run scoreAfter).
   * Represents a real state transition; no-op if the id is absent or unchanged.
   */
  update(id: string, patch: AnalysisTraceEventPatch): AnalysisTraceEvent | null {
    let updated: AnalysisTraceEvent | null = null;
    const next = this.events.map((event) => {
      if (event.id !== id) {
        return event;
      }
      updated = { ...event, ...patch };
      return updated;
    });
    if (!updated) {
      return null;
    }
    this.events = next;
    this.emit();
    return updated;
  }

  getActiveRun(): AnalysisTraceActiveRun | null {
    return this.activeRun;
  }

  setActiveRun(run: AnalysisTraceActiveRun | null): void {
    this.activeRun = run;
  }

  getSnapshot = (): readonly AnalysisTraceEvent[] => this.events;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  reset(): void {
    if (this.events === EMPTY_SNAPSHOT && this.activeRun === null) {
      return;
    }
    this.events = EMPTY_SNAPSHOT;
    this.seenDedupeKeys = new Set<string>();
    this.activeRun = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const analysisTraceStore = new AnalysisTraceStore();

/** Record a real analytical event. Returns null when dropped as a duplicate. */
export function recordAnalysisTraceEvent(
  input: CreateAnalysisTraceEventInput
): AnalysisTraceEvent | null {
  return analysisTraceStore.record(input);
}

/** Patch an existing event by id (real state transitions only). */
export function updateAnalysisTraceEvent(
  id: string,
  patch: AnalysisTraceEventPatch
): AnalysisTraceEvent | null {
  return analysisTraceStore.update(id, patch);
}

/** Latest stored TARGET event id for a target key, or null (dedupe / reuse guard). */
export function findTraceTargetEventId(targetKey: string): string | null {
  const events = analysisTraceStore.getSnapshot();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.TARGET && event.targetKey === targetKey) {
      return event.id;
    }
  }
  return null;
}

/** Ensure a TARGET branch exists; returns its event id. Never creates a RUN. */
export function ensureAnalysisTraceTarget(input: {
  targetKey: string;
  detail: string;
}): string {
  const existing = findTraceTargetEventId(input.targetKey);
  if (existing) {
    return existing;
  }
  const created = recordAnalysisTraceEvent({
    type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
    title: "TARGET",
    detail: input.detail,
    targetKey: input.targetKey,
    dedupeKey: `target:${input.targetKey}`,
  });
  return created?.id ?? findTraceTargetEventId(input.targetKey) ?? `target:${input.targetKey}`;
}

/** Next session-local run number (max existing + 1). Session-scoped; resets with the trace. */
export function nextTraceRunNumber(): number {
  const events = analysisTraceStore.getSnapshot();
  let max = 0;
  for (const event of events) {
    if (event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN && typeof event.runNumber === "number") {
      max = Math.max(max, event.runNumber);
    }
  }
  return max + 1;
}

/**
 * Phase 20E — authoritative enrichment-transaction start.
 * Call ONLY from the enrichment execution boundary (e.g. Enrich button handler).
 * Never call from mount, tab activation, cache hydration, or Trace rendering.
 * executionId === runId for this session store.
 */
export function beginAnalysisTraceEnrichmentRun(input: {
  targetKey: string;
  targetDetail: string;
  scoreAtStart?: number;
}): AnalysisTraceActiveRun {
  const parentId = ensureAnalysisTraceTarget({
    targetKey: input.targetKey,
    detail: input.targetDetail,
  });
  const runNumber = nextTraceRunNumber();
  const runId = `run-${runNumber}`;
  const created = recordAnalysisTraceEvent({
    type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
    title: "ENRICHMENT RUN",
    runNumber,
    runId,
    parentId,
    targetKey: input.targetKey,
    status: ANALYSIS_TRACE_RUN_STATUS.RUNNING,
    dedupeKey: `run:${runId}`,
  });
  const active: AnalysisTraceActiveRun = {
    executionId: runId,
    runId,
    eventId: created?.id ?? runId,
    runNumber,
    targetKey: input.targetKey,
    scoreAtStart: input.scoreAtStart,
  };
  analysisTraceStore.setActiveRun(active);
  return active;
}

/** In-flight enrichment transaction, if any. Survives component remount. */
export function getActiveAnalysisTraceRun(
  targetKey?: string
): AnalysisTraceActiveRun | null {
  const active = analysisTraceStore.getActiveRun();
  if (!active) {
    return null;
  }
  if (targetKey && active.targetKey !== targetKey) {
    return null;
  }
  return active;
}

/**
 * Phase 20E — authoritative enrichment-transaction completion.
 * Call from the enrichment execution boundary when the execution finishes.
 */
export function completeAnalysisTraceEnrichmentRun(
  executionId: string,
  patch: {
    status: AnalysisTraceRunStatus;
    scoreAfter?: number;
    severity?: AnalysisTraceSeverity;
  }
): void {
  const active = analysisTraceStore.getActiveRun();
  if (!active || active.executionId !== executionId) {
    // Still patch the RUN event if it exists (navigation-away completion).
    const events = analysisTraceStore.getSnapshot();
    const runEvent = events.find(
      (event) =>
        event.type === ANALYSIS_TRACE_EVENT_TYPE.RUN && event.runId === executionId
    );
    if (runEvent) {
      updateAnalysisTraceEvent(runEvent.id, {
        status: patch.status,
        scoreAfter: patch.scoreAfter,
        severity: patch.severity,
      });
    }
    if (active?.executionId === executionId) {
      analysisTraceStore.setActiveRun(null);
    }
    return;
  }
  updateAnalysisTraceEvent(active.eventId, {
    status: patch.status,
    scoreAfter: patch.scoreAfter,
    severity: patch.severity,
  });
  analysisTraceStore.setActiveRun(null);
}

/** Clear the ledger (test harness / explicit session reset). */
export function resetAnalysisTrace(): void {
  analysisTraceStore.reset();
}

/** React binding — re-renders subscribers when the ledger changes. */
export function useAnalysisTrace(): readonly AnalysisTraceEvent[] {
  return useSyncExternalStore(
    analysisTraceStore.subscribe,
    analysisTraceStore.getSnapshot,
    analysisTraceStore.getSnapshot
  );
}
