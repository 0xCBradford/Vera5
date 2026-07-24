/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeVisibleTextAndAttributeIocMatches,
  type PageIocScanMatch,
} from "../content/attributeHrefExtractor";
import { resolveMaxIocsPerScan, scanTextNodesForIocs } from "../content/detector";
import { IOC_TYPE } from "./iocRegex";
import {
  getActiveInvestigationSession,
  recordActiveInvestigationSessionEnrichmentEvent,
  recordActiveInvestigationSessionExportEvent,
  recordActiveInvestigationSessionMacroRunEvent,
  recordActiveInvestigationSessionWatchlistTagEvent,
  syncActiveInvestigationSessionFromScan,
} from "./investigationSessionStorage";
import {
  buildInvestigationReplayTranscriptMarkdown,
  createReplaySegment,
  dedupeReplaySegmentsById,
  ingestReplaySegmentsFromSessionStore,
  INVESTIGATION_REPLAY_TRANSCRIPT_HEADING,
  INVESTIGATION_REPLAY_TRANSCRIPT_STEPS_HEADING,
  jumpToReplayStepIndex,
  REPLAY_SEGMENT_ACTION,
  resolveReplayNextStepIndex,
  resolveReplayPreviousStepIndex,
  sortReplaySegmentsStable,
  type ReplaySegment,
} from "./replaySegment";
import { MACRO_RUN_STATUS, TIMELINE_EVENT_TYPE } from "./timelineEvent";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SAMPLE_ALERT_PAGE_URL = "http://localhost:8080/sample-alert.html";
const SAMPLE_ALERT_FOCUS_IOC = "8.8.8.8";

const EXPECTED_SAMPLE_ALERT_IOC_VALUES = [
  "192.0.2.1",
  "8.8.8.8",
  "malware.testcategory.com",
  "https://example.com/login",
  "d41d8cd98f00b204e9800998ecf8427e",
  "098f6bcd4621d373cade4e832627b4f6",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "CVE-2021-44228",
  "CVE-2017-0144",
  "analyst@example.com",
] as const;

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

function loadSampleAlertFixture(): void {
  const html = readFileSync(join(repoRoot, "examples", "sample-alert.html"), "utf8");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
}

function buildSampleAlertScanEntries(): PageIocScanMatch[] {
  loadSampleAlertFixture();
  const textMatches = scanTextNodesForIocs(document.body);
  return mergeVisibleTextAndAttributeIocMatches(
    textMatches,
    [],
    resolveMaxIocsPerScan({})
  );
}

function mergeSyntheticNonTimelineSegments(
  sessionId: string,
  timelineSegments: readonly ReplaySegment[]
): ReplaySegment[] {
  const selectSegment = createReplaySegment({
    action: REPLAY_SEGMENT_ACTION.SELECT,
    sessionId,
    iocKey: SAMPLE_ALERT_FOCUS_IOC,
    timestamp: 1_050,
  });
  const noteSegment = createReplaySegment({
    action: REPLAY_SEGMENT_ACTION.NOTE,
    sessionId,
    iocKey: SAMPLE_ALERT_FOCUS_IOC,
    timestamp: 1_250,
    sourceAttributionSummary: "Synthetic analyst note for fixture replay",
  });
  return dedupeReplaySegmentsById(
    sortReplaySegmentsStable([...timelineSegments, selectSegment, noteSegment])
  );
}

describe("sample-alert.html investigation replay fixture flow", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("replays ordered segments from a synthetic fixture session without live enrich", async () => {
    const snapshotMatches = buildSampleAlertScanEntries();
    const entries = snapshotMatches.map((match) => ({
      type: match.type,
      value: match.value,
    }));

    expect(entries.length).toBeGreaterThanOrEqual(EXPECTED_SAMPLE_ALERT_IOC_VALUES.length);
    for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
      expect(entries.some((entry) => entry.value === value)).toBe(true);
    }

    const firstScan = await syncActiveInvestigationSessionFromScan({
      pageUrl: SAMPLE_ALERT_PAGE_URL,
      entries,
      now: 1_000,
    });
    expect(firstScan?.pageUrl).toBe(SAMPLE_ALERT_PAGE_URL);

    await recordActiveInvestigationSessionEnrichmentEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      iocType: IOC_TYPE.IPV4,
      now: 1_100,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
    await recordActiveInvestigationSessionExportEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      iocType: IOC_TYPE.IPV4,
      now: 1_200,
      templateId: "jira-comment",
    });
    await recordActiveInvestigationSessionWatchlistTagEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      label: "case-important",
      now: 1_300,
    });
    await recordActiveInvestigationSessionMacroRunEvent({
      stepType: "enrich",
      macroId: "built-in-cti-deep-check",
      stepIndex: 0,
      runStatus: MACRO_RUN_STATUS.SUCCESS,
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      iocType: IOC_TYPE.IPV4,
      now: 1_350,
    });

    const active = await getActiveInvestigationSession();
    expect(active?.pageUrl).toBe(SAMPLE_ALERT_PAGE_URL);
    expect(active?.id).toBeTruthy();

    const timelineSegments = await ingestReplaySegmentsFromSessionStore();
    expect(timelineSegments.length).toBeGreaterThan(0);
    expect(
      timelineSegments.every(
        (segment) => segment.sourceTimelineEventType !== TIMELINE_EVENT_TYPE.REDETECT
      )
    ).toBe(true);

    for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
      expect(
        timelineSegments.some(
          (segment) =>
            segment.action === REPLAY_SEGMENT_ACTION.SCAN && segment.iocKey === value
        )
      ).toBe(true);
    }

    const focusTimelineActions = timelineSegments
      .filter((segment) => segment.iocKey === SAMPLE_ALERT_FOCUS_IOC)
      .map((segment) => segment.action);

    expect(focusTimelineActions).toEqual([
      REPLAY_SEGMENT_ACTION.SCAN,
      REPLAY_SEGMENT_ACTION.ENRICH,
      REPLAY_SEGMENT_ACTION.EXPORT,
      REPLAY_SEGMENT_ACTION.WATCHLIST_TAG,
      REPLAY_SEGMENT_ACTION.MACRO_RUN,
    ]);

    const focusEnrich = timelineSegments.find(
      (segment) =>
        segment.iocKey === SAMPLE_ALERT_FOCUS_IOC &&
        segment.action === REPLAY_SEGMENT_ACTION.ENRICH
    );
    expect(focusEnrich?.sourceAttributionSummary).toBe("Source: AbuseIPDB · live");

    const focusMacro = timelineSegments.find(
      (segment) =>
        segment.iocKey === SAMPLE_ALERT_FOCUS_IOC &&
        segment.action === REPLAY_SEGMENT_ACTION.MACRO_RUN
    );
    expect(focusMacro).toEqual(
      expect.objectContaining({
        macroId: "built-in-cti-deep-check",
        stepIndex: 0,
        runStatus: MACRO_RUN_STATUS.SUCCESS,
      })
    );

    const sessionId = active!.id;
    const replaySegments = mergeSyntheticNonTimelineSegments(sessionId, timelineSegments);
    const focusReplayActions = replaySegments
      .filter((segment) => segment.iocKey === SAMPLE_ALERT_FOCUS_IOC)
      .map((segment) => segment.action);

    expect(focusReplayActions).toEqual([
      REPLAY_SEGMENT_ACTION.SCAN,
      REPLAY_SEGMENT_ACTION.SELECT,
      REPLAY_SEGMENT_ACTION.ENRICH,
      REPLAY_SEGMENT_ACTION.EXPORT,
      REPLAY_SEGMENT_ACTION.NOTE,
      REPLAY_SEGMENT_ACTION.WATCHLIST_TAG,
      REPLAY_SEGMENT_ACTION.MACRO_RUN,
    ]);

    expect(resolveReplayPreviousStepIndex(0, replaySegments.length)).toBeNull();
    expect(resolveReplayNextStepIndex(0, replaySegments.length)).toBe(1);
    expect(jumpToReplayStepIndex(3, replaySegments.length)).toBe(3);

    const timestamps = replaySegments.map((segment) => segment.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));

    const transcript = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: active!.id,
        title: active!.title,
        pageUrl: active!.pageUrl,
      },
      segments: replaySegments,
      exportedAt: "2026-07-21T12:00:00.000Z",
    });

    expect(transcript).toContain(`# ${INVESTIGATION_REPLAY_TRANSCRIPT_HEADING}`);
    expect(transcript).toContain(`## ${INVESTIGATION_REPLAY_TRANSCRIPT_STEPS_HEADING}`);
    expect(transcript).toContain(SAMPLE_ALERT_PAGE_URL);
    expect(transcript).toContain(SAMPLE_ALERT_FOCUS_IOC);
  });
});
