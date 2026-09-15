import { beforeEach, describe, expect, it } from "vitest";
import {
  ANALYSIS_TRACE_EVENT_CAP,
  ANALYSIS_TRACE_EVENT_TYPE,
  ANALYSIS_TRACE_MAX_TARGETS,
  ANALYSIS_TRACE_RUN_STATUS,
  ANALYSIS_TRACE_SEVERITY,
  analysisTraceStore,
  appendAnalysisTraceEvent,
  beginAnalysisTraceEnrichmentRun,
  completeAnalysisTraceEnrichmentRun,
  createAnalysisTraceEvent,
  formatAnalysisTraceTime,
  getActiveAnalysisTraceRun,
  pruneTraceTargets,
  recordAnalysisTraceEvent,
  resetAnalysisTrace,
  resolveAnalysisTraceScoreVerdict,
  resolveAnalysisTraceSeverityFromScore,
  summarizeAnalysisTraceEvent,
  updateAnalysisTraceEvent,
  type AnalysisTraceEvent,
} from "./analysisTrace";

function makeEvent(overrides: Partial<AnalysisTraceEvent> = {}): AnalysisTraceEvent {
  return createAnalysisTraceEvent({
    type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
    title: "VIRUSTOTAL",
    detail: "8/100 · LOW",
    ...overrides,
  });
}

describe("analysisTrace model", () => {
  beforeEach(() => {
    resetAnalysisTrace();
  });

  it("assigns a stable id and timestamp when omitted", () => {
    const event = createAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.SESSION,
      title: "SESSION",
      detail: "VERA5 ready",
    });
    expect(event.id).toMatch(/^atr-/);
    expect(typeof event.timestamp).toBe("number");
  });

  it("formats timestamps as HH:mm:ss local wall clock", () => {
    const date = new Date(2026, 8, 1, 13, 42, 7);
    expect(formatAnalysisTraceTime(date.getTime())).toBe("13:42:07");
  });

  it("drops a consecutive event with the same dedupeKey (rerender safety)", () => {
    const first = makeEvent({ dedupeKey: "target:qaenat.com" });
    let events = appendAnalysisTraceEvent([], first);
    events = appendAnalysisTraceEvent(events, makeEvent({ dedupeKey: "target:qaenat.com" }));
    expect(events).toHaveLength(1);
  });

  it("allows the same dedupeKey again once another event intervenes", () => {
    let events = appendAnalysisTraceEvent([], makeEvent({ dedupeKey: "target:a" }));
    events = appendAnalysisTraceEvent(events, makeEvent({ dedupeKey: "target:b" }));
    events = appendAnalysisTraceEvent(events, makeEvent({ dedupeKey: "target:a" }));
    expect(events).toHaveLength(3);
  });

  it("enforces the rolling cap, dropping oldest first", () => {
    let events: readonly AnalysisTraceEvent[] = [];
    for (let index = 0; index < ANALYSIS_TRACE_EVENT_CAP + 25; index += 1) {
      events = appendAnalysisTraceEvent(events, makeEvent({ detail: `evt-${index}` }));
    }
    expect(events).toHaveLength(ANALYSIS_TRACE_EVENT_CAP);
    expect(events[events.length - 1].detail).toBe(`evt-${ANALYSIS_TRACE_EVENT_CAP + 24}`);
    expect(events[0].detail).toBe("evt-25");
  });

  it("maps numeric scores to platform-consistent severities", () => {
    expect(resolveAnalysisTraceSeverityFromScore(0)).toBe(ANALYSIS_TRACE_SEVERITY.CLEAR);
    expect(resolveAnalysisTraceSeverityFromScore(8)).toBe(ANALYSIS_TRACE_SEVERITY.LOW);
    expect(resolveAnalysisTraceSeverityFromScore(20)).toBe(ANALYSIS_TRACE_SEVERITY.SUSPICIOUS);
    expect(resolveAnalysisTraceSeverityFromScore(32)).toBe(ANALYSIS_TRACE_SEVERITY.HIGH);
    expect(resolveAnalysisTraceSeverityFromScore(82)).toBe(ANALYSIS_TRACE_SEVERITY.CRITICAL);
    expect(resolveAnalysisTraceSeverityFromScore(null)).toBeUndefined();
  });

  it("derives verdict words matching the composite scoring bands", () => {
    expect(resolveAnalysisTraceScoreVerdict(0)).toBe("CLEAR");
    expect(resolveAnalysisTraceScoreVerdict(8)).toBe("LOW");
    expect(resolveAnalysisTraceScoreVerdict(20)).toBe("SUSPICIOUS");
    expect(resolveAnalysisTraceScoreVerdict(32)).toBe("HIGH");
    expect(resolveAnalysisTraceScoreVerdict(69)).toBe("CRITICAL");
  });

  it("summarizes an event as TITLE + detail for the collapsed header", () => {
    expect(
      summarizeAnalysisTraceEvent(
        makeEvent({ title: "SCORE", detail: "8 → 32 · HIGH" })
      )
    ).toBe("SCORE 8 → 32 · HIGH");
    expect(summarizeAnalysisTraceEvent(makeEvent({ title: "SESSION", detail: undefined }))).toBe(
      "SESSION"
    );
  });
});

describe("analysisTraceStore", () => {
  beforeEach(() => {
    resetAnalysisTrace();
  });

  it("records real events and notifies subscribers", () => {
    let notifications = 0;
    const unsubscribe = analysisTraceStore.subscribe(() => {
      notifications += 1;
    });
    recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.SCAN,
      title: "SCAN PAGE",
      detail: "6 indicators detected",
      dedupeKey: "scan:1",
    });
    expect(analysisTraceStore.getSnapshot()).toHaveLength(1);
    expect(notifications).toBe(1);
    unsubscribe();
  });

  it("returns null and does not notify when a duplicate is dropped", () => {
    recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.SESSION,
      title: "SESSION",
      dedupeKey: "session",
    });
    const before = analysisTraceStore.getSnapshot();
    const dropped = recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.SESSION,
      title: "SESSION",
      dedupeKey: "session",
    });
    expect(dropped).toBeNull();
    expect(analysisTraceStore.getSnapshot()).toBe(before);
  });

  it("keeps a stable snapshot reference between record calls", () => {
    const empty = analysisTraceStore.getSnapshot();
    expect(analysisTraceStore.getSnapshot()).toBe(empty);
    recordAnalysisTraceEvent({ type: ANALYSIS_TRACE_EVENT_TYPE.SCAN, title: "SCAN" });
    const snapshot = analysisTraceStore.getSnapshot();
    expect(analysisTraceStore.getSnapshot()).toBe(snapshot);
    expect(snapshot).not.toBe(empty);
  });

  it("globally dedupes a keyed event even when other events intervene (reselect safety)", () => {
    recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      targetKey: "a",
      dedupeKey: "target:a",
    });
    recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.SCAN,
      title: "SCAN",
      dedupeKey: "scan:2",
    });
    const dropped = recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
      title: "TARGET",
      targetKey: "a",
      dedupeKey: "target:a",
    });
    expect(dropped).toBeNull();
    expect(
      analysisTraceStore
        .getSnapshot()
        .filter((event) => event.type === ANALYSIS_TRACE_EVENT_TYPE.TARGET)
    ).toHaveLength(1);
  });

  it("patches an existing event by id (real run-status transition)", () => {
    const run = recordAnalysisTraceEvent({
      type: ANALYSIS_TRACE_EVENT_TYPE.RUN,
      title: "ENRICHMENT RUN",
      runId: "run-1",
      runNumber: 1,
      status: ANALYSIS_TRACE_RUN_STATUS.RUNNING,
      dedupeKey: "run:run-1",
    });
    expect(run).not.toBeNull();
    const updated = updateAnalysisTraceEvent(run!.id, {
      status: ANALYSIS_TRACE_RUN_STATUS.COMPLETE,
      scoreAfter: 54,
    });
    expect(updated?.status).toBe(ANALYSIS_TRACE_RUN_STATUS.COMPLETE);
    expect(analysisTraceStore.getSnapshot()[0].status).toBe(ANALYSIS_TRACE_RUN_STATUS.COMPLETE);
    expect(analysisTraceStore.getSnapshot()[0].scoreAfter).toBe(54);
  });
});

describe("pruneTraceTargets", () => {
  it("drops the oldest target subtree once the target cap is exceeded", () => {
    const events = [];
    for (let index = 0; index < ANALYSIS_TRACE_MAX_TARGETS + 2; index += 1) {
      const targetKey = `t-${index}`;
      events.push(
        createAnalysisTraceEvent({
          type: ANALYSIS_TRACE_EVENT_TYPE.TARGET,
          title: "TARGET",
          targetKey,
          timestamp: index * 2,
        })
      );
      events.push(
        createAnalysisTraceEvent({
          type: ANALYSIS_TRACE_EVENT_TYPE.VENDOR,
          title: "OTX",
          detail: "1/100 · LOW",
          targetKey,
          timestamp: index * 2 + 1,
        })
      );
    }
    const pruned = pruneTraceTargets(events);
    const remainingTargets = new Set(
      pruned
        .filter((event) => event.type === ANALYSIS_TRACE_EVENT_TYPE.TARGET)
        .map((event) => event.targetKey)
    );
    expect(remainingTargets.size).toBe(ANALYSIS_TRACE_MAX_TARGETS);
    expect(remainingTargets.has("t-0")).toBe(false);
    expect(remainingTargets.has("t-1")).toBe(false);
    // Children of a pruned target are removed with it.
    expect(pruned.some((event) => event.targetKey === "t-0")).toBe(false);
  });
});

describe("analysisTrace enrichment transactions (Phase 20E)", () => {
  beforeEach(() => {
    resetAnalysisTrace();
  });

  it("binds executionId to runId and tracks the active run in the store", () => {
    const active = beginAnalysisTraceEnrichmentRun({
      targetKey: "9.9.9.9",
      targetDetail: "IP 9.9.9.9",
      scoreAtStart: 12,
    });
    expect(active.executionId).toBe(active.runId);
    expect(active.runNumber).toBe(1);
    expect(getActiveAnalysisTraceRun("9.9.9.9")?.eventId).toBe(active.eventId);
    expect(getActiveAnalysisTraceRun("other")).toBeNull();
  });

  it("completing a run clears active state and patches status", () => {
    const active = beginAnalysisTraceEnrichmentRun({
      targetKey: "8.8.8.8",
      targetDetail: "IP 8.8.8.8",
    });
    completeAnalysisTraceEnrichmentRun(active.executionId, {
      status: ANALYSIS_TRACE_RUN_STATUS.PARTIAL,
      scoreAfter: 33,
    });
    expect(getActiveAnalysisTraceRun()).toBeNull();
    const run = analysisTraceStore.getSnapshot().find((event) => event.id === active.eventId);
    expect(run?.status).toBe(ANALYSIS_TRACE_RUN_STATUS.PARTIAL);
    expect(run?.scoreAfter).toBe(33);
  });

  it("reset clears both events and the active run pointer", () => {
    beginAnalysisTraceEnrichmentRun({
      targetKey: "1.1.1.1",
      targetDetail: "IP 1.1.1.1",
    });
    resetAnalysisTrace();
    expect(analysisTraceStore.getSnapshot()).toHaveLength(0);
    expect(getActiveAnalysisTraceRun()).toBeNull();
  });
});
