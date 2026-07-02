import { describe, expect, it } from "vitest";
import {
  MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH,
  TIMELINE_EVENT_SCHEMA_VERSION,
  TIMELINE_EVENT_TYPE,
  TIMELINE_EVENT_TYPE_ORDER,
  createTimelineEvent,
  filterTimelineEventsForAppend,
  isTimelineEventRapidDuplicate,
  isTimelineEventRecord,
  isTimelineEventType,
  normalizeTimelineEvent,
  normalizeTimelineEventSourceAttributionSummary,
  formatMacroRunTimelineSourceAttribution,
  TIMELINE_EVENT_DEDUP_WINDOW_MS,
  MAX_INVESTIGATION_SESSION_TIMELINE_EVENTS,
  pruneInvestigationSessionTimelineEvents,
  createDefaultTimelineEventFilter,
  filterTimelineEvents,
  formatTimelineEventIocLabel,
  formatTimelineEventTimestamp,
  formatTimelineEventTypeLabel,
  buildTimelineEventNavigationAriaLabel,
  buildTimelineEventRowAriaLabel,
  isTimelineEventNavigable,
  listTimelineEventIocFilterOptions,
  readTimelineEventFilterDateTimeLocal,
  sortTimelineEventsChronologically,
  TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE,
  timelineEventHasSessionScopeEntries,
} from "./timelineEvent";

describe("timelineEvent types", () => {
  it("defines six versioned event types in stable order", () => {
    expect(TIMELINE_EVENT_TYPE_ORDER).toEqual([
      "scan",
      "enrich",
      "export",
      "watchlistTag",
      "macroRun",
      "redetect",
    ]);
  });

  it("recognizes each timeline event type", () => {
    for (const type of TIMELINE_EVENT_TYPE_ORDER) {
      expect(isTimelineEventType(type)).toBe(true);
    }
    expect(isTimelineEventType("first-seen")).toBe(false);
    expect(isTimelineEventType("")).toBe(false);
  });
});

describe("timelineEvent payload", () => {
  it("creates events with sessionId, iocKey, timestamp, and source attribution summary", () => {
    const event = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: "vera5-inv-abc",
      iocKey: "8.8.8.8",
      timestamp: 1_700_000_000_000,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });

    expect(event).toEqual({
      schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
      type: "enrich",
      sessionId: "vera5-inv-abc",
      iocKey: "8.8.8.8",
      timestamp: 1_700_000_000_000,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
  });

  it("includes optional templateId on export events", () => {
    const event = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId: "vera5-inv-abc",
      iocKey: "8.8.8.8",
      timestamp: 1_700_000_000_001,
      sourceAttributionSummary: "",
      templateId: "jira-comment",
    });

    expect(event.templateId).toBe("jira-comment");
  });

  it("normalizes iocKey and trims source attribution summary", () => {
    const event = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.REDETECT,
      sessionId: " vera5-inv-abc ",
      iocKey: "  Example.COM  ",
      timestamp: 1_700_000_000_002,
      sourceAttributionSummary: "  OTX · cached  ",
    });

    expect(event.sessionId).toBe("vera5-inv-abc");
    expect(event.iocKey).toBe("Example.COM");
    expect(event.sourceAttributionSummary).toBe("OTX · cached");
  });

  it("caps source attribution summary length", () => {
    const longSummary = "x".repeat(
      MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH + 25
    );
    expect(normalizeTimelineEventSourceAttributionSummary(longSummary)).toHaveLength(
      MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH
    );
  });

  it("formats macro run attribution from macro id and step type", () => {
    expect(
      formatMacroRunTimelineSourceAttribution({
        stepType: "openFromSelection",
      })
    ).toBe("openFromSelection");
    expect(
      formatMacroRunTimelineSourceAttribution({
        macroId: "triage-selection",
        stepType: "openFromSelection",
      })
    ).toBe("triage-selection: openFromSelection");
  });

  it("normalizes stored timeline event records", () => {
    expect(
      normalizeTimelineEvent({
        schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
        type: TIMELINE_EVENT_TYPE.WATCHLIST_TAG,
        sessionId: "vera5-inv-xyz",
        iocKey: "malware.testcategory.com",
        timestamp: 1_700_000_000_003,
        sourceAttributionSummary: "Internal",
      })
    ).toEqual({
      schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
      type: "watchlistTag",
      sessionId: "vera5-inv-xyz",
      iocKey: "malware.testcategory.com",
      timestamp: 1_700_000_000_003,
      sourceAttributionSummary: "Internal",
    });
  });

  it("rejects records with invalid schemaVersion, sessionId, timestamp, or templateId", () => {
    const base = {
      schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId: "vera5-inv-abc",
      iocKey: "8.8.8.8",
      timestamp: 1_700_000_000_000,
      sourceAttributionSummary: "",
    };

    expect(normalizeTimelineEvent({ ...base, schemaVersion: 99 })).toBeNull();
    expect(normalizeTimelineEvent({ ...base, sessionId: "  " })).toBeNull();
    expect(normalizeTimelineEvent({ ...base, timestamp: Number.NaN })).toBeNull();
    expect(
      normalizeTimelineEvent({ ...base, templateId: "not-a-template" })
    ).toBeNull();
    expect(normalizeTimelineEvent(null)).toBeNull();
  });

  it("validates timeline event records through isTimelineEventRecord", () => {
    expect(
      isTimelineEventRecord({
        schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
        type: TIMELINE_EVENT_TYPE.MACRO_RUN,
        sessionId: "vera5-inv-macro",
        iocKey: "",
        timestamp: 1_700_000_000_004,
        sourceAttributionSummary: "",
      })
    ).toBe(true);
    expect(
      isTimelineEventRecord({
        schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
        type: "unknown",
        sessionId: "vera5-inv-macro",
        iocKey: "",
        timestamp: 1_700_000_000_004,
        sourceAttributionSummary: "",
      })
    ).toBe(false);
  });
});

describe("timelineEvent deduplication", () => {
  const sessionId = "vera5-inv-dedup";

  it("drops rapid duplicates with the same iocKey and type within the window", () => {
    const existing = [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.ENRICH,
        sessionId,
        iocKey: "8.8.8.8",
        timestamp: 1_000,
      }),
    ];
    const duplicate = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 1_000 + TIMELINE_EVENT_DEDUP_WINDOW_MS,
    });
    const later = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 1_000 + TIMELINE_EVENT_DEDUP_WINDOW_MS + 1,
    });

    expect(isTimelineEventRapidDuplicate(existing, duplicate)).toBe(true);
    expect(isTimelineEventRapidDuplicate(existing, later)).toBe(false);
    expect(filterTimelineEventsForAppend(existing, [duplicate, later])).toEqual([
      later,
    ]);
  });

  it("keeps events when the type or iocKey differs", () => {
    const existing = [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.SCAN,
        sessionId,
        iocKey: "8.8.8.8",
        timestamp: 1_000,
      }),
    ];
    const exportEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 1_100,
    });
    const otherIoc = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId,
      iocKey: "1.1.1.1",
      timestamp: 1_100,
    });

    expect(filterTimelineEventsForAppend(existing, [exportEvent, otherIoc])).toEqual([
      exportEvent,
      otherIoc,
    ]);
  });

  it("deduplicates within an incoming batch after prior accepted events", () => {
    const first = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.REDETECT,
      sessionId,
      iocKey: "evil.example",
      timestamp: 500,
    });
    const duplicate = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.REDETECT,
      sessionId,
      iocKey: "evil.example",
      timestamp: 700,
    });

    expect(filterTimelineEventsForAppend([], [first, duplicate])).toEqual([first]);
  });
});

describe("timelineEvent session cap", () => {
  const sessionId = "vera5-inv-cap";

  it("prunes oldest events when the session log exceeds the cap", () => {
    const events = Array.from({ length: MAX_INVESTIGATION_SESSION_TIMELINE_EVENTS + 3 }, (_, index) =>
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.ENRICH,
        sessionId,
        iocKey: `10.0.0.${index + 1}`,
        timestamp: 1_000 + index,
      })
    );

    const pruned = pruneInvestigationSessionTimelineEvents(events);
    expect(pruned).toHaveLength(MAX_INVESTIGATION_SESSION_TIMELINE_EVENTS);
    expect(pruned[0]?.iocKey).toBe("10.0.0.4");
    expect(pruned.at(-1)?.iocKey).toBe("10.0.0.103");
  });

  it("returns a copy when the event count is within the cap", () => {
    const events = [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.SCAN,
        sessionId,
        iocKey: "8.8.8.8",
        timestamp: 100,
      }),
    ];

    const pruned = pruneInvestigationSessionTimelineEvents(events);
    expect(pruned).toEqual(events);
    expect(pruned).not.toBe(events);
  });
});

describe("timelineEvent ordering", () => {
  const sessionId = "vera5-inv-order";

  it("sorts timeline events chronologically by timestamp", () => {
    const later = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 300,
    });
    const earlier = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 100,
    });

    expect(
      sortTimelineEventsChronologically([later, earlier]).map((event) => event.timestamp)
    ).toEqual([100, 300]);
  });
});

describe("timelineEvent display helpers", () => {
  it("formats event type labels and IOC display text", () => {
    expect(formatTimelineEventTypeLabel(TIMELINE_EVENT_TYPE.SCAN)).toBe("First seen");
    expect(formatTimelineEventTypeLabel(TIMELINE_EVENT_TYPE.REDETECT)).toBe("Seen again");
    expect(formatTimelineEventIocLabel("8.8.8.8")).toBe("8.8.8.8");
    expect(formatTimelineEventIocLabel("  ")).toBe("Session scope");
  });

  it("formats timestamps for display", () => {
    expect(formatTimelineEventTimestamp(Number.NaN)).toBe("Unknown time");
    expect(formatTimelineEventTimestamp(0)).toBe(new Date(0).toLocaleString());
  });
});

describe("timelineEvent filters", () => {
  const sessionId = "vera5-inv-filter";

  const events = [
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 100,
    }),
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId,
      iocKey: "8.8.8.8",
      timestamp: 250,
    }),
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId,
      iocKey: "example.com",
      timestamp: 400,
    }),
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.MACRO_RUN,
      sessionId,
      iocKey: "",
      timestamp: 500,
    }),
  ];

  it("filters by indicator, event type, and time range", () => {
    expect(listTimelineEventIocFilterOptions(events)).toEqual(["8.8.8.8", "example.com"]);
    expect(timelineEventHasSessionScopeEntries(events)).toBe(true);

    expect(
      filterTimelineEvents(events, {
        ...createDefaultTimelineEventFilter(),
        iocKey: "8.8.8.8",
      }).map((event) => event.type)
    ).toEqual(["scan", "enrich"]);

    expect(
      filterTimelineEvents(events, {
        ...createDefaultTimelineEventFilter(),
        eventType: TIMELINE_EVENT_TYPE.EXPORT,
      }).map((event) => event.iocKey)
    ).toEqual(["example.com"]);

    expect(
      filterTimelineEvents(events, {
        ...createDefaultTimelineEventFilter(),
        iocKey: TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE,
      })
    ).toHaveLength(1);

    expect(
      filterTimelineEvents(events, {
        ...createDefaultTimelineEventFilter(),
        timeRangeStart: 200,
        timeRangeEnd: 450,
      }).map((event) => event.timestamp)
    ).toEqual([250, 400]);
  });

  it("reads datetime-local filter values", () => {
    expect(readTimelineEventFilterDateTimeLocal("")).toBeUndefined();
    expect(readTimelineEventFilterDateTimeLocal("not-a-date")).toBeUndefined();
    expect(readTimelineEventFilterDateTimeLocal("2026-01-15T10:30")).toBe(
      new Date("2026-01-15T10:30").getTime()
    );
  });

  it("marks IOC-scoped events as navigable and builds navigation labels", () => {
    const iocEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId: "vera5-inv-test",
      iocKey: "8.8.8.8",
      timestamp: 100,
    });
    const sessionEvent = createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.MACRO_RUN,
      sessionId: "vera5-inv-test",
      iocKey: "",
      timestamp: 200,
    });

    expect(isTimelineEventNavigable(iocEvent)).toBe(true);
    expect(isTimelineEventNavigable(sessionEvent)).toBe(false);
    expect(buildTimelineEventNavigationAriaLabel(iocEvent)).toBe(
      "View 8.8.8.8 on page. First seen"
    );
    expect(buildTimelineEventRowAriaLabel(sessionEvent)).toContain("Macro run");
  });
});
