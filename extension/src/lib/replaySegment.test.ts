import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildHoverCardSourceEntries } from "./hoverCardEnrichment";
import {
  buildNormalizedEnrichmentRecord,
} from "./enrichmentExport";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";
import { IOC_TYPE } from "./iocRegex";
import { createTimelineEvent, TIMELINE_EVENT_TYPE } from "./timelineEvent";
import * as investigationSessionStorage from "./investigationSessionStorage";
import {
  REPLAY_FORBIDDEN_CAPTURE_APIS,
  REPLAY_FORBIDDEN_SHARE_SURFACES,
  REPLAY_FORBIDDEN_UPLOAD_SURFACES,
  REPLAY_SEGMENT_ACTION,
  REPLAY_SEGMENT_ACTION_ORDER,
  REPLAY_SEGMENT_SCHEMA_VERSION,
  TIMELINE_EVENT_TYPE_TO_REPLAY_SEGMENT_ACTION,
  assertInvestigationReplayForbidsCaptureApis,
  assertInvestigationReplayShareIsUserInitiatedClipboardOnly,
  assertInvestigationReplayUsesLocalStorageOnly,
  assertReplayCaptureApiForbidden,
  assertReplayShareSurfaceForbidden,
  assertReplayUploadSurfaceForbidden,
  buildInvestigationReplayTranscriptFilename,
  buildInvestigationReplayTranscriptMarkdown,
  buildReplaySegmentId,
  buildReplaySegmentDetailView,
  clampReplayStepIndex,
  containsReplayPayloadSecrets,
  copyInvestigationReplayTranscriptToClipboard,
  createReplaySegment,
  dedupeReplaySegmentsById,
  downloadInvestigationReplayTranscriptFile,
  findReplayForbiddenCaptureApiCallInSource,
  findReplayForbiddenShareCallInSource,
  findReplayForbiddenUploadCallInSource,
  formatReplaySegmentActionLabel,
  formatReplaySegmentIocDisplay,
  formatReplayStepPositionLabel,
  ingestReplaySegmentsFromInvestigationSession,
  ingestReplaySegmentsFromSessionStore,
  ingestReplaySegmentsFromTimelineEvents,
  INVESTIGATION_REPLAY_EMPTY_TEXT,
  INVESTIGATION_REPLAY_SHARE_CHANNEL,
  INVESTIGATION_REPLAY_STORAGE_BACKEND,
  INVESTIGATION_REPLAY_STORAGE_KEY,
  INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS,
  INVESTIGATION_REPLAY_UPLOAD_ENDPOINT,
  isReplayForbiddenCaptureApi,
  isReplayForbiddenShareSurface,
  isReplayForbiddenUploadSurface,
  isReplaySegmentAction,
  isReplaySegmentNavigable,
  isReplaySegmentRecord,
  jumpToReplayStepIndex,
  mapTimelineEventToReplaySegment,
  mapTimelineEventTypeToReplaySegmentAction,
  MAX_REPLAY_SEGMENT_IOC_DISPLAY_LENGTH,
  normalizeReplaySegment,
  renderInvestigationReplayTranscript,
  resolveInvestigationReplayTranscriptCopyFeedback,
  resolveInvestigationReplayTranscriptDownloadFeedback,
  resolveReplayNextStepIndex,
  resolveReplayPreviousStepIndex,
  ReplayCaptureApiForbiddenError,
  ReplayShareForbiddenError,
  ReplayUploadForbiddenError,
  sanitizeReplaySegment,
  serializeReplaySegmentsJson,
  sortReplaySegmentsStable,
  truncateReplaySegmentIocValue,
} from "./replaySegment";
import { STORAGE_KEY_INVESTIGATION_SESSIONS } from "./investigationSessionStorage";

describe("replaySegment actions", () => {
  it("defines the v1 replay action catalog in stable order", () => {
    expect(REPLAY_SEGMENT_ACTION_ORDER).toEqual([
      "scan",
      "select",
      "enrich",
      "export",
      "note",
      "macroRun",
      "watchlistTag",
    ]);
  });

  it("explicitly forbids screen and video capture APIs in replay", () => {
    expect(REPLAY_FORBIDDEN_CAPTURE_APIS).toEqual([
      "getDisplayMedia",
      "desktopCapture",
      "tabCapture",
      "captureStream",
    ]);
    expect(() => assertInvestigationReplayForbidsCaptureApis()).not.toThrow();

    for (const apiName of REPLAY_FORBIDDEN_CAPTURE_APIS) {
      expect(isReplayForbiddenCaptureApi(apiName)).toBe(true);
      expect(() => assertReplayCaptureApiForbidden(apiName)).toThrow(
        ReplayCaptureApiForbiddenError
      );
      expect(() => assertReplayCaptureApiForbidden(`chrome.${apiName}`)).toThrow(
        ReplayCaptureApiForbiddenError
      );
    }
    expect(() => assertReplayCaptureApiForbidden("copyTextToClipboard")).not.toThrow();

    expect(
      findReplayForbiddenCaptureApiCallInSource(
        "await navigator.mediaDevices.getDisplayMedia({ video: true });"
      )
    ).toMatch(/getDisplayMedia/);
    expect(
      findReplayForbiddenCaptureApiCallInSource("chrome.desktopCapture.chooseDesktopMedia")
    ).toMatch(/desktopCapture/);
    expect(
      findReplayForbiddenCaptureApiCallInSource("const x = 1;")
    ).toBeNull();

    const here = dirname(fileURLToPath(import.meta.url));
    const replaySource = readFileSync(join(here, "replaySegment.ts"), "utf8");
    const popupSource = readFileSync(join(here, "../popup/Popup.tsx"), "utf8");
    expect(findReplayForbiddenCaptureApiCallInSource(replaySource)).toBeNull();
    expect(findReplayForbiddenCaptureApiCallInSource(popupSource)).toBeNull();
  });

  it("stores and reads replay data only from extension local storage with no upload endpoint", () => {
    expect(INVESTIGATION_REPLAY_STORAGE_BACKEND).toBe("chrome.storage.local");
    expect(INVESTIGATION_REPLAY_STORAGE_KEY).toBe(STORAGE_KEY_INVESTIGATION_SESSIONS);
    expect(INVESTIGATION_REPLAY_UPLOAD_ENDPOINT).toBeNull();
    expect(REPLAY_FORBIDDEN_UPLOAD_SURFACES).toEqual([
      "fetch",
      "XMLHttpRequest",
      "sendBeacon",
      "WebSocket",
      "chrome.storage.sync",
    ]);
    expect(() => assertInvestigationReplayUsesLocalStorageOnly()).not.toThrow();

    for (const surface of REPLAY_FORBIDDEN_UPLOAD_SURFACES) {
      expect(isReplayForbiddenUploadSurface(surface)).toBe(true);
      expect(() => assertReplayUploadSurfaceForbidden(surface)).toThrow(
        ReplayUploadForbiddenError
      );
    }
    expect(() => assertReplayUploadSurfaceForbidden("chrome.storage.local")).not.toThrow();

    expect(
      findReplayForbiddenUploadCallInSource('await fetch("https://example.com/replay")')
    ).toMatch(/fetch/);
    expect(
      findReplayForbiddenUploadCallInSource("chrome.storage.sync.set({ replay: true })")
    ).toMatch(/chrome\.storage\.sync/);
    expect(findReplayForbiddenUploadCallInSource("chrome.storage.local.get(null)")).toBeNull();
    expect(
      findReplayForbiddenUploadCallInSource('const surfaces = ["fetch", "XMLHttpRequest"];')
    ).toBeNull();

    const here = dirname(fileURLToPath(import.meta.url));
    const replaySource = readFileSync(join(here, "replaySegment.ts"), "utf8");
    expect(findReplayForbiddenUploadCallInSource(replaySource)).toBeNull();
  });

  it("requires replay copy/share to be user-initiated clipboard only", () => {
    expect(INVESTIGATION_REPLAY_SHARE_CHANNEL).toBe("clipboard");
    expect(REPLAY_FORBIDDEN_SHARE_SURFACES).toEqual([
      "navigator.share",
      "navigator.canShare",
    ]);
    expect(() =>
      assertInvestigationReplayShareIsUserInitiatedClipboardOnly()
    ).not.toThrow();

    for (const surface of REPLAY_FORBIDDEN_SHARE_SURFACES) {
      expect(isReplayForbiddenShareSurface(surface)).toBe(true);
      expect(() => assertReplayShareSurfaceForbidden(surface)).toThrow(
        ReplayShareForbiddenError
      );
    }
    expect(() => assertReplayShareSurfaceForbidden("clipboard")).not.toThrow();

    expect(
      findReplayForbiddenShareCallInSource(
        'await navigator.share({ text: "replay transcript" });'
      )
    ).toMatch(/navigator\.share/);
    expect(
      findReplayForbiddenShareCallInSource("navigator.canShare({ text: 'x' })")
    ).toMatch(/navigator\.canShare/);
    expect(
      findReplayForbiddenShareCallInSource("await copyTextToClipboard(content)")
    ).toBeNull();

    const here = dirname(fileURLToPath(import.meta.url));
    const replaySource = readFileSync(join(here, "replaySegment.ts"), "utf8");
    const popupSource = readFileSync(join(here, "../popup/Popup.tsx"), "utf8");
    expect(findReplayForbiddenShareCallInSource(replaySource)).toBeNull();
    expect(findReplayForbiddenShareCallInSource(popupSource)).toBeNull();
    expect(popupSource).toMatch(/onClick=\{handleCopyTranscript\}/);
    expect(popupSource).toMatch(/copyInvestigationReplayTranscriptToClipboard/);
  });

  it("recognizes each replay segment action", () => {
    for (const action of REPLAY_SEGMENT_ACTION_ORDER) {
      expect(isReplaySegmentAction(action)).toBe(true);
      expect(formatReplaySegmentActionLabel(action).length).toBeGreaterThan(0);
    }
    expect(isReplaySegmentAction("redetect")).toBe(false);
    expect(isReplaySegmentAction("")).toBe(false);
  });
});

describe("replay step navigation", () => {
  it("clamps step indexes and resolves previous / next / jump targets", () => {
    expect(clampReplayStepIndex(0, 0)).toBe(-1);
    expect(clampReplayStepIndex(-3, 3)).toBe(0);
    expect(clampReplayStepIndex(99, 3)).toBe(2);
    expect(clampReplayStepIndex(1, 3)).toBe(1);

    expect(resolveReplayPreviousStepIndex(0, 3)).toBeNull();
    expect(resolveReplayPreviousStepIndex(2, 3)).toBe(1);
    expect(resolveReplayNextStepIndex(2, 3)).toBeNull();
    expect(resolveReplayNextStepIndex(0, 3)).toBe(1);

    expect(jumpToReplayStepIndex(1, 3)).toBe(1);
    expect(jumpToReplayStepIndex(3, 3)).toBeNull();
    expect(jumpToReplayStepIndex(-1, 3)).toBeNull();
    expect(jumpToReplayStepIndex(0, 0)).toBeNull();
  });

  it("formats step position labels for the replay panel", () => {
    expect(formatReplayStepPositionLabel(0, 0)).toBe("No replay steps");
    expect(formatReplayStepPositionLabel(0, 4)).toBe("Step 1 of 4");
    expect(formatReplayStepPositionLabel(3, 4)).toBe("Step 4 of 4");
  });

  it("exposes empty-state copy for sessions with no replayable segments", () => {
    expect(INVESTIGATION_REPLAY_EMPTY_TEXT).toMatch(/No replayable steps yet/);
    expect(INVESTIGATION_REPLAY_EMPTY_TEXT.length).toBeGreaterThan(20);
  });

  it("treats non-empty ioc keys as navigable replay segments", () => {
    expect(
      isReplaySegmentNavigable(
        createReplaySegment({
          action: REPLAY_SEGMENT_ACTION.SCAN,
          sessionId: "vera5-inv-abc",
          iocKey: "192.0.2.1",
          timestamp: 1,
        })
      )
    ).toBe(true);
    expect(
      isReplaySegmentNavigable(
        createReplaySegment({
          action: REPLAY_SEGMENT_ACTION.MACRO_RUN,
          sessionId: "vera5-inv-abc",
          iocKey: "",
          timestamp: 1,
        })
      )
    ).toBe(false);
  });

  it("builds truncated segment detail for the current replay step", () => {
    const longIoc = `very-long-indicator.${"x".repeat(80)}.example`;
    const detail = buildReplaySegmentDetailView(
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.EXPORT,
        sessionId: "vera5-inv-abc",
        iocKey: longIoc,
        timestamp: 1,
        sourceAttributionSummary: "Source: AbuseIPDB · live",
        templateId: "markdown-report",
      })
    );

    expect(detail.actionLabel).toBe("Export");
    expect(detail.iocFull).toBe(longIoc);
    expect(detail.iocDisplay).toBe(
      truncateReplaySegmentIocValue(longIoc, MAX_REPLAY_SEGMENT_IOC_DISPLAY_LENGTH)
    );
    expect(detail.iocDisplay.length).toBe(MAX_REPLAY_SEGMENT_IOC_DISPLAY_LENGTH);
    expect(detail.iocDisplay.endsWith("…")).toBe(true);
    expect(detail.sourceAttributionSummary).toBe("Source: AbuseIPDB · live");
    expect(detail.templateLabel).toBe("Markdown report");
    expect(formatReplaySegmentIocDisplay("")).toBe("Session scope");
    expect(
      buildReplaySegmentDetailView(
        createReplaySegment({
          action: REPLAY_SEGMENT_ACTION.SCAN,
          sessionId: "vera5-inv-abc",
          iocKey: "8.8.8.8",
          timestamp: 1,
        })
      ).templateLabel
    ).toBeNull();
  });
});

describe("timeline event → replay segment mapping", () => {
  it("maps session timeline types onto replay actions without duplicating capture", () => {
    expect(TIMELINE_EVENT_TYPE_TO_REPLAY_SEGMENT_ACTION).toEqual({
      scan: "scan",
      enrich: "enrich",
      export: "export",
      watchlistTag: "watchlistTag",
      macroRun: "macroRun",
    });
    expect(mapTimelineEventTypeToReplaySegmentAction(TIMELINE_EVENT_TYPE.SCAN)).toBe(
      REPLAY_SEGMENT_ACTION.SCAN
    );
    expect(mapTimelineEventTypeToReplaySegmentAction(TIMELINE_EVENT_TYPE.REDETECT)).toBeNull();
  });

  it("projects mappable timeline events into replay segments", () => {
    const enrichEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_000,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
    const segment = mapTimelineEventToReplaySegment(enrichEvent);
    expect(segment).toEqual({
      schemaVersion: REPLAY_SEGMENT_SCHEMA_VERSION,
      id: "replay:vera5-inv-abc:1700000000000:enrich:192.0.2.1",
      action: "enrich",
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_000,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
      sourceTimelineEventType: "enrich",
    });
  });

  it("preserves export templateId when projecting timeline export events", () => {
    const exportEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId: "vera5-inv-abc",
      iocKey: "example.com",
      timestamp: 1_700_000_000_001,
      templateId: "markdown-report",
    });
    const segment = mapTimelineEventToReplaySegment(exportEvent);
    expect(segment?.action).toBe("export");
    expect(segment?.templateId).toBe("markdown-report");
    expect(segment?.sourceTimelineEventType).toBe("export");
  });

  it("projects macro run id, step index, and run status onto replay segments", () => {
    const macroEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.MACRO_RUN,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_050,
      sourceAttributionSummary: "cti-deep-check: enrich",
      macroId: "cti-deep-check",
      stepIndex: 0,
      runStatus: "success",
    });
    const segment = mapTimelineEventToReplaySegment(macroEvent);
    expect(segment).toEqual({
      schemaVersion: REPLAY_SEGMENT_SCHEMA_VERSION,
      id: "replay:vera5-inv-abc:1700000000050:macroRun:192.0.2.1:s0:success",
      action: "macroRun",
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_050,
      sourceAttributionSummary: "cti-deep-check: enrich",
      sourceTimelineEventType: "macroRun",
      macroId: "cti-deep-check",
      stepIndex: 0,
      runStatus: "success",
    });
  });

  it("skips unmapped timeline types such as redetect", () => {
    const redetect = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.REDETECT,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_002,
    });
    expect(mapTimelineEventToReplaySegment(redetect)).toBeNull();
  });
});

describe("replaySegment create and normalize", () => {
  it("creates select and note segments that are not timeline event types", () => {
    const selectSegment = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.SELECT,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_010,
    });
    const noteSegment = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.NOTE,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_011,
      sourceAttributionSummary: "Analyst note applied",
    });

    expect(selectSegment.action).toBe("select");
    expect(noteSegment.action).toBe("note");
    expect(isReplaySegmentRecord(selectSegment)).toBe(true);
    expect(isReplaySegmentRecord(noteSegment)).toBe(true);
  });

  it("builds a stable id from session, timestamp, action, and ioc key", () => {
    expect(
      buildReplaySegmentId({
        sessionId: "vera5-inv-abc",
        action: REPLAY_SEGMENT_ACTION.SCAN,
        timestamp: 1_700_000_000_000,
        iocKey: "  Example.COM  ",
      })
    ).toBe("replay:vera5-inv-abc:1700000000000:scan:Example.COM");
  });

  it("round-trips through normalizeReplaySegment", () => {
    const created = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.MACRO_RUN,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_020,
      sourceAttributionSummary: "cti-deep-check: enrich",
      sourceTimelineEventType: TIMELINE_EVENT_TYPE.MACRO_RUN,
    });
    expect(normalizeReplaySegment(created)).toEqual(created);
  });

  it("rejects unknown actions and schema versions", () => {
    expect(
      normalizeReplaySegment({
        schemaVersion: REPLAY_SEGMENT_SCHEMA_VERSION,
        id: "replay:x",
        action: "redetect",
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1,
        sourceAttributionSummary: "",
      })
    ).toBeNull();
    expect(
      normalizeReplaySegment({
        schemaVersion: 99,
        id: "replay:x",
        action: "scan",
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1,
        sourceAttributionSummary: "",
      })
    ).toBeNull();
  });
});

describe("replay segment ingest and stable sort", () => {
  it("sorts by timestamp, then action catalog rank as tie-breaker", () => {
    const exportSeg = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.EXPORT,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_100,
      id: "b-export",
    });
    const enrichSeg = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_100,
      id: "a-enrich",
    });
    const laterScan = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.SCAN,
      sessionId: "vera5-inv-abc",
      iocKey: "example.com",
      timestamp: 1_700_000_000_200,
    });

    const sorted = sortReplaySegmentsStable([exportSeg, laterScan, enrichSeg]);
    expect(sorted.map((segment) => segment.action)).toEqual(["enrich", "export", "scan"]);
  });

  it("orders, deduplicates by id, and redacts secrets on ingest", () => {
    const leaky = JSON.stringify({
      api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      note: "vendor",
    });
    const sharedId = buildReplaySegmentId({
      sessionId: "vera5-inv-dedupe",
      action: REPLAY_SEGMENT_ACTION.ENRICH,
      timestamp: 1_700_000_000_030,
      iocKey: "192.0.2.1",
    });
    const duplicateEnrich = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: "vera5-inv-dedupe",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_030,
      sourceAttributionSummary: leaky,
    });
    const events = [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.EXPORT,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_050,
        templateId: "markdown-report",
      }),
      duplicateEnrich,
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.SCAN,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_010,
      }),
      duplicateEnrich,
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.REDETECT,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_020,
      }),
    ];

    const segments = ingestReplaySegmentsFromTimelineEvents(events);
    expect(segments.map((segment) => segment.action)).toEqual([
      "scan",
      "enrich",
      "export",
    ]);
    expect(segments.filter((segment) => segment.id === sharedId)).toHaveLength(1);
    expect(segments[1]?.sourceAttributionSummary).not.toContain(
      TEST_FIXTURE_ABUSEIPDB_API_KEY
    );
    expect(segments[1]?.sourceAttributionSummary).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(containsReplayPayloadSecrets(serializeReplaySegmentsJson(segments))).toBe(
      false
    );

    const withDupes = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_010,
        id: "dup-id",
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_030,
        id: "dup-id",
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.EXPORT,
        sessionId: "vera5-inv-dedupe",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_050,
        id: "unique-export",
      }),
    ];
    expect(dedupeReplaySegmentsById(withDupes).map((segment) => segment.action)).toEqual([
      "scan",
      "export",
    ]);
  });

  it("ingests timeline events in order and skips redetect", () => {
    const events = [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.EXPORT,
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_050,
        templateId: "markdown-report",
      }),
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.REDETECT,
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_040,
      }),
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.SCAN,
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_010,
      }),
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.ENRICH,
        sessionId: "vera5-inv-abc",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_030,
      }),
    ];

    const segments = ingestReplaySegmentsFromTimelineEvents(events);
    expect(segments.map((segment) => segment.action)).toEqual(["scan", "enrich", "export"]);
    expect(segments.every((segment) => segment.sourceTimelineEventType)).toBe(true);
  });

  it("ingests from an investigation session timelineEvents array", () => {
    const segments = ingestReplaySegmentsFromInvestigationSession({
      timelineEvents: [
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.WATCHLIST_TAG,
          sessionId: "vera5-inv-abc",
          iocKey: "192.0.2.1",
          timestamp: 1_700_000_000_060,
          sourceAttributionSummary: "suspicious",
        }),
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.MACRO_RUN,
          sessionId: "vera5-inv-abc",
          iocKey: "192.0.2.1",
          timestamp: 1_700_000_000_055,
          sourceAttributionSummary: "dfir-triage: enrich",
        }),
      ],
    });
    expect(segments.map((segment) => segment.action)).toEqual(["macroRun", "watchlistTag"]);
  });

  it("returns an empty list when the session has no timeline events", () => {
    expect(ingestReplaySegmentsFromInvestigationSession({})).toEqual([]);
    expect(ingestReplaySegmentsFromInvestigationSession({ timelineEvents: [] })).toEqual([]);
  });
});

describe("replay segment session store ingest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads ordered segments from a stored session id", async () => {
    vi.spyOn(investigationSessionStorage, "getStoredInvestigationSession").mockResolvedValue({
      id: "vera5-inv-abc",
      title: "Investigation",
      createdAt: 1,
      updatedAt: 2,
      pageUrl: "http://localhost:8080/sample-alert.html",
      totalIocCount: 1,
      iocCountByType: {},
      enrichmentCount: 1,
      exportCount: 0,
      timelineEvents: [
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.ENRICH,
          sessionId: "vera5-inv-abc",
          iocKey: "192.0.2.1",
          timestamp: 1_700_000_000_030,
        }),
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.SCAN,
          sessionId: "vera5-inv-abc",
          iocKey: "192.0.2.1",
          timestamp: 1_700_000_000_010,
        }),
      ],
    });

    const segments = await ingestReplaySegmentsFromSessionStore("vera5-inv-abc");
    expect(segments.map((segment) => segment.action)).toEqual(["scan", "enrich"]);
    expect(investigationSessionStorage.getStoredInvestigationSession).toHaveBeenCalledWith(
      "vera5-inv-abc"
    );
  });

  it("uses the active session when sessionId is omitted", async () => {
    vi.spyOn(investigationSessionStorage, "getActiveInvestigationSession").mockResolvedValue({
      id: "vera5-inv-active",
      title: "Active",
      createdAt: 1,
      updatedAt: 2,
      pageUrl: "http://localhost:8080/sample-alert.html",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
      timelineEvents: [
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.SCAN,
          sessionId: "vera5-inv-active",
          iocKey: "8.8.8.8",
          timestamp: 1_700_000_000_010,
        }),
      ],
    });

    const segments = await ingestReplaySegmentsFromSessionStore();
    expect(segments).toHaveLength(1);
    expect(segments[0]?.sessionId).toBe("vera5-inv-active");
  });

  it("returns [] when no session is found", async () => {
    vi.spyOn(investigationSessionStorage, "getActiveInvestigationSession").mockResolvedValue(null);
    expect(await ingestReplaySegmentsFromSessionStore()).toEqual([]);
  });
});

describe("replay segment secret redaction", () => {
  const leakyVendorPayload = JSON.stringify({
    api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    data: { abuseConfidenceScore: 74 },
  });

  it("redacts vendor secrets from sourceAttributionSummary on create and normalize", () => {
    const created = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_100,
      sourceAttributionSummary: leakyVendorPayload,
    });

    expect(created.sourceAttributionSummary).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(created.sourceAttributionSummary).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(normalizeReplaySegment(created)).toEqual(created);
  });

  it("redacts secrets when projecting and ingesting timeline events", () => {
    const event = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_101,
      sourceAttributionSummary: leakyVendorPayload,
    });

    const projected = mapTimelineEventToReplaySegment(event);
    expect(projected?.sourceAttributionSummary).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(projected?.sourceAttributionSummary).toContain(REDACTED_VALUE_PLACEHOLDER);

    const ingested = ingestReplaySegmentsFromTimelineEvents([event]);
    expect(ingested).toHaveLength(1);
    expect(ingested[0]?.sourceAttributionSummary).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
  });

  it("serializes replay payloads without unredacted secret fields", () => {
    const segment = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_102,
      sourceAttributionSummary: leakyVendorPayload,
    });
    const json = serializeReplaySegmentsJson([segment]);

    expect(json).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(json).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(containsReplayPayloadSecrets(json)).toBe(false);
    expect(
      containsReplayPayloadSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(
      sanitizeReplaySegment({
        ...segment,
        sourceAttributionSummary: leakyVendorPayload,
      }).sourceAttributionSummary
    ).toContain(REDACTED_VALUE_PLACEHOLDER);
  });

  it("leaves plain attribution lines unchanged when they do not embed secrets", () => {
    const segment = createReplaySegment({
      action: REPLAY_SEGMENT_ACTION.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "192.0.2.1",
      timestamp: 1_700_000_000_103,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
    expect(segment.sourceAttributionSummary).toBe("Source: AbuseIPDB · live");
  });
});

describe("investigation replay transcript markdown", () => {
  const EXPORTED_AT = "2026-07-21T15:00:00.000Z";

  it("builds a markdown transcript with session title, URL, ordered steps, and timestamps", () => {
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-transcript",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_200,
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-transcript",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_250,
        sourceAttributionSummary: "Source: AbuseIPDB · live",
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.EXPORT,
        sessionId: "vera5-inv-transcript",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_300,
        templateId: "markdown-report",
      }),
    ];

    const markdown = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: "vera5-inv-transcript",
        title: "Training handoff case",
        pageUrl: "https://example.com/alert",
      },
      segments,
      exportedAt: EXPORTED_AT,
    });

    expect(markdown).toContain("# Investigation replay transcript");
    expect(markdown).toContain("- **Session:** Training handoff case");
    expect(markdown).toContain("- **Page URL:** https://example.com/alert");
    expect(markdown).toContain(`- **Exported:** ${EXPORTED_AT}`);
    expect(markdown).toContain("- **Steps:** 3");
    expect(markdown).toContain("## Ordered steps");
    expect(markdown).toContain("| Step | Time (UTC) | Action | Indicator | Details |");
    expect(markdown).toContain("| 1 | 2023-11-14T22:13:20.200Z | Scan | 192.0.2.1 |");
    expect(markdown).toContain("| 2 | 2023-11-14T22:13:20.250Z | Enrich | 192.0.2.1 | Source: AbuseIPDB · live |");
    expect(markdown).toContain("Template: Markdown report");
  });

  it("includes an empty-steps note when the session has no replayable segments", () => {
    const markdown = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: "vera5-inv-empty",
        title: "Empty case",
        pageUrl: "https://example.com/",
      },
      segments: [],
      exportedAt: EXPORTED_AT,
    });
    expect(markdown).toContain("- **Steps:** 0");
    expect(markdown).toContain(
      "_No replayable steps are included in this transcript._"
    );
    expect(markdown).not.toContain("## Indicators");
  });

  it("optionally appends IOC table and enrichment summary from session memory", () => {
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-appendix",
        iocKey: "185.220.101.4",
        timestamp: 1_700_000_000_450,
      }),
    ];
    const records = [
      buildNormalizedEnrichmentRecord({
        value: "185.220.101.4",
        iocType: IOC_TYPE.IPV4,
        sourceResults: buildHoverCardSourceEntries([
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "ok",
            summary: "74 abuse confidence",
            tags: ["ssh"],
            fromCache: true,
            rawVendorJson: JSON.stringify({
              api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
              dump: "secret-vendor-body",
            }),
          },
        ]),
        exportedAt: EXPORTED_AT,
      }),
    ];

    const withAppendix = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: "vera5-inv-appendix",
        title: "Appendix case",
        pageUrl: "https://example.com/appendix",
      },
      segments,
      records,
      exportedAt: EXPORTED_AT,
    });
    expect(withAppendix).toContain("## Indicators");
    expect(withAppendix).toContain("| Type | IOC | Enrichment summary |");
    expect(withAppendix).toContain("185.220.101.4");
    expect(withAppendix).toContain("## Enrichment details");
    expect(withAppendix).toContain("74 abuse confidence");
    expect(withAppendix).not.toContain("secret-vendor-body");
    expect(withAppendix).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(withAppendix).not.toContain("rawVendorJson");

    const withoutAppendix = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: "vera5-inv-appendix",
        title: "Appendix case",
        pageUrl: "https://example.com/appendix",
      },
      segments,
      records,
      includeMemoryAppendix: false,
      exportedAt: EXPORTED_AT,
    });
    expect(withoutAppendix).not.toContain("## Indicators");
    expect(withoutAppendix).not.toContain("## Enrichment details");
  });

  it("renders Obsidian and Analyst update transcript shapes with overlapping template fields", () => {
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-templates",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_460,
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-templates",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_470,
        sourceAttributionSummary: "Source: AbuseIPDB · live",
      }),
    ];
    const records = [
      buildNormalizedEnrichmentRecord({
        value: "192.0.2.1",
        iocType: IOC_TYPE.IPV4,
        sourceResults: buildHoverCardSourceEntries([
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: "ok",
            summary: "12 abuse confidence",
            fromCache: true,
          },
        ]),
        exportedAt: EXPORTED_AT,
      }),
    ];

    expect(INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS).toEqual([
      "markdown-report",
      "obsidian-note",
      "analyst-update",
    ]);

    const obsidian = renderInvestigationReplayTranscript("obsidian-note", {
      session: {
        id: "vera5-inv-templates",
        title: "Template overlap case",
        pageUrl: "https://example.com/templates",
      },
      segments,
      records,
      exportedAt: EXPORTED_AT,
    });
    expect(obsidian.startsWith("---\n")).toBe(true);
    expect(obsidian).toContain("session: Template overlap case");
    expect(obsidian).toContain("page_url: https://example.com/templates");
    expect(obsidian).toContain(`exported_at: ${EXPORTED_AT}`);
    expect(obsidian).toContain("source: Vera5");
    expect(obsidian).toContain("artifact: investigation-replay-transcript");
    expect(obsidian).toContain("| Step | Time (UTC) | Action | Indicator | Details |");
    expect(obsidian).toContain("ioc: 192.0.2.1");
    expect(obsidian).toContain("12 abuse confidence");

    const analystUpdate = renderInvestigationReplayTranscript("analyst-update", {
      session: {
        id: "vera5-inv-templates",
        title: "Template overlap case",
        pageUrl: "https://example.com/templates",
      },
      segments,
      records,
      exportedAt: EXPORTED_AT,
    });
    expect(analystUpdate).toContain(
      "Vera5 replay transcript for Template overlap case (2 steps):"
    );
    expect(analystUpdate).toContain("Scan 192.0.2.1 at");
    expect(analystUpdate).toContain("Enrich 192.0.2.1 at");
    expect(analystUpdate).toContain("Vera5 triage for 192.0.2.1");
    expect(analystUpdate).toContain("12 abuse confidence");
  });

  it("redacts secret-shaped material from transcript markdown", () => {
    const leaky = JSON.stringify({
      api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      note: "vendor",
    });
    const markdown = buildInvestigationReplayTranscriptMarkdown({
      session: {
        id: "vera5-inv-secret",
        title: "Secret case",
        pageUrl: "https://example.com/",
      },
      segments: [
        createReplaySegment({
          action: REPLAY_SEGMENT_ACTION.ENRICH,
          sessionId: "vera5-inv-secret",
          iocKey: "192.0.2.1",
          timestamp: 1_700_000_000_400,
          sourceAttributionSummary: leaky,
        }),
      ],
      exportedAt: EXPORTED_AT,
    });
    expect(markdown).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(markdown).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(containsReplayPayloadSecrets(markdown)).toBe(false);
  });

  it("builds transcript filenames and copies or downloads when steps exist", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:replay-transcript");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-dl",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_500,
      }),
    ];
    const input = {
      session: {
        id: "vera5-inv-dl",
        title: "Download Case!",
        pageUrl: "https://example.com/dl",
      },
      segments,
      exportedAt: EXPORTED_AT,
    };

    expect(buildInvestigationReplayTranscriptFilename(input.session, EXPORTED_AT)).toBe(
      "vera5-replay-transcript-download-case-markdown-report-2026-07-21.md"
    );
    expect(
      resolveInvestigationReplayTranscriptCopyFeedback({ copied: true, stepCount: 1 })
    ).toBe("Copied Markdown report replay transcript (1 step).");
    expect(
      resolveInvestigationReplayTranscriptDownloadFeedback({
        downloaded: true,
        stepCount: 2,
      })
    ).toBe("Downloaded Markdown report replay transcript (2 steps).");

    await expect(copyInvestigationReplayTranscriptToClipboard(input)).resolves.toBe(
      true
    );
    expect(writeText).toHaveBeenCalled();

    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const doc = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    } as unknown as Document;
    expect(downloadInvestigationReplayTranscriptFile(input, doc)).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    await expect(
      copyInvestigationReplayTranscriptToClipboard({ ...input, segments: [] })
    ).resolves.toBe(false);
    expect(downloadInvestigationReplayTranscriptFile({ ...input, segments: [] })).toBe(
      false
    );
  });
});
