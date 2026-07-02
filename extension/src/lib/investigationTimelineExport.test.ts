import { describe, expect, it, vi } from "vitest";
import { createInvestigationSession } from "./investigationSession";
import {
  buildInvestigationTimelineExportDocument,
  containsInvestigationTimelineExportSecrets,
  copyInvestigationTimelineExportAppendixToClipboard,
  copyInvestigationTimelineExportJsonToClipboard,
  downloadInvestigationTimelineExportAppendixFile,
  downloadInvestigationTimelineExportJsonFile,
  INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING,
  INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION,
  INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS,
  renderInvestigationTimelineExportAppendix,
  resolveInvestigationTimelineExportCopyFeedback,
  resolveInvestigationTimelineJsonExportCopyFeedback,
  serializeInvestigationTimelineExportJson,
} from "./investigationTimelineExport";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";
import { IOC_TYPE } from "./iocRegex";
import {
  createTimelineEvent,
  TIMELINE_EVENT_TYPE,
} from "./timelineEvent";
import * as copyText from "./copyText";

const EXPORTED_AT = "2026-07-02T12:00:00.000Z";

const sampleSession = createInvestigationSession({
  id: "vera5-inv-timeline-export",
  title: "Phishing Investigation",
  pageUrl: "https://example.com/alert",
  createdAt: 100,
  updatedAt: 200,
  totalIocCount: 1,
  iocCountByType: {
    [IOC_TYPE.IPV4]: 1,
  },
})!;

const sampleEvents = [
  createTimelineEvent({
    type: TIMELINE_EVENT_TYPE.SCAN,
    sessionId: sampleSession.id,
    iocKey: "8.8.8.8",
    timestamp: 100,
  }),
  createTimelineEvent({
    type: TIMELINE_EVENT_TYPE.ENRICH,
    sessionId: sampleSession.id,
    iocKey: "8.8.8.8",
    timestamp: 250,
    sourceAttributionSummary: "Source: AbuseIPDB · live",
  }),
  createTimelineEvent({
    type: TIMELINE_EVENT_TYPE.EXPORT,
    sessionId: sampleSession.id,
    iocKey: "example.com",
    timestamp: 400,
    templateId: "jira-comment",
  }),
];

describe("investigationTimelineExport", () => {
  it("lists markdown appendix template ids", () => {
    expect(INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS).toEqual([
      "markdown-report",
      "obsidian-note",
      "jira-comment",
      "thehive-case-note",
      "analyst-update",
    ]);
  });

  it("renders a markdown-report timeline appendix for the filtered slice", () => {
    const markdown = renderInvestigationTimelineExportAppendix("markdown-report", {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });

    expect(markdown).toContain(`## ${INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING}`);
    expect(markdown).toContain("**Session:** Phishing Investigation");
    expect(markdown).toContain("| Time (UTC) | Event | Indicator | Details |");
    expect(markdown).toMatch(/First seen[\s\S]*8\.8\.8\.8/);
    expect(markdown).toContain("Source: AbuseIPDB · live");
    expect(markdown).toContain("Template: Jira comment");
  });

  it("renders template-specific appendix formats", () => {
    const jira = renderInvestigationTimelineExportAppendix("jira-comment", {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });
    expect(jira).toContain("h3. Vera5");
    expect(jira).toContain("||Time (UTC)||Event||Indicator||Details||");

    const obsidian = renderInvestigationTimelineExportAppendix("obsidian-note", {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });
    expect(obsidian.startsWith("---")).toBe(true);
    expect(obsidian).toContain("artifact: investigation-timeline-appendix");

    const theHive = renderInvestigationTimelineExportAppendix("thehive-case-note", {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });
    expect(theHive).toContain("[Vera5]");
    expect(theHive).toContain("Timeline:");

    const analystUpdate = renderInvestigationTimelineExportAppendix("analyst-update", {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });
    expect(analystUpdate).toContain("Vera5 timeline appendix for Phishing Investigation");
    expect(analystUpdate).toContain("First seen 8.8.8.8");
  });

  it("sorts events chronologically in the appendix", () => {
    const markdown = renderInvestigationTimelineExportAppendix("markdown-report", {
      session: sampleSession,
      events: [sampleEvents[2]!, sampleEvents[0]!, sampleEvents[1]!],
      exportedAt: EXPORTED_AT,
    });

    const firstSeenIndex = markdown.indexOf("| First seen |");
    const enrichedIndex = markdown.indexOf("| Enriched |");
    const exportedIndex = markdown.indexOf("| Exported |");
    expect(firstSeenIndex).toBeGreaterThan(-1);
    expect(enrichedIndex).toBeGreaterThan(firstSeenIndex);
    expect(exportedIndex).toBeGreaterThan(enrichedIndex);
  });

  it("copies and downloads timeline appendix exports", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);
    const input = {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    };

    await expect(
      copyInvestigationTimelineExportAppendixToClipboard("markdown-report", input)
    ).resolves.toBe(true);
    expect(copy).toHaveBeenCalledWith(
      renderInvestigationTimelineExportAppendix("markdown-report", input)
    );

    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    expect(
      downloadInvestigationTimelineExportAppendixFile("obsidian-note", input, doc)
    ).toBe(true);
    expect(anchor.click).toHaveBeenCalled();
  });

  it("reports empty filtered slices", () => {
    expect(
      resolveInvestigationTimelineExportCopyFeedback({
        copied: false,
        eventCount: 0,
        templateId: "markdown-report",
      })
    ).toBe("No timeline events match the current filters.");
    expect(
      resolveInvestigationTimelineJsonExportCopyFeedback({
        copied: false,
        eventCount: 0,
      })
    ).toBe("No timeline events match the current filters.");
  });

  it("builds a versioned JSON export document for the filtered slice", () => {
    const input = {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    };
    const document = buildInvestigationTimelineExportDocument(input);

    expect(document.schemaVersion).toBe(INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION);
    expect(document.exportedAt).toBe(EXPORTED_AT);
    expect(document.session).toMatchObject({
      id: sampleSession.id,
      title: "Phishing Investigation",
      pageUrl: "https://example.com/alert",
    });
    expect(document.events).toHaveLength(3);
    expect(document.events.map((event) => event.type)).toEqual([
      "scan",
      "enrich",
      "export",
    ]);
    expect(document.events[1]).toMatchObject({
      iocKey: "8.8.8.8",
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
  });

  it("serializes timeline JSON exports with schemaVersion", () => {
    const json = serializeInvestigationTimelineExportJson({
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    });
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      events: Array<{ type: string }>;
    };

    expect(parsed.schemaVersion).toBe(INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION);
    expect(parsed.events.map((event) => event.type)).toEqual([
      "scan",
      "enrich",
      "export",
    ]);
  });

  it("copies and downloads timeline JSON exports", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);
    const input = {
      session: sampleSession,
      events: sampleEvents,
      exportedAt: EXPORTED_AT,
    };

    await expect(copyInvestigationTimelineExportJsonToClipboard(input)).resolves.toBe(
      true
    );
    expect(copy).toHaveBeenCalledWith(serializeInvestigationTimelineExportJson(input));

    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    expect(downloadInvestigationTimelineExportJsonFile(input, doc)).toBe(true);
    expect(anchor.click).toHaveBeenCalled();
  });
});

describe("investigationTimelineExport redaction", () => {
  const leakyVendorPayload = JSON.stringify({
    api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    data: { abuseConfidenceScore: 74 },
  });

  const leakyEvents = [
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: sampleSession.id,
      iocKey: "8.8.8.8",
      timestamp: 250,
      sourceAttributionSummary: leakyVendorPayload,
    }),
  ];

  const exportInput = {
    session: {
      ...sampleSession,
      pageUrl: leakyVendorPayload,
    },
    events: leakyEvents,
    exportedAt: EXPORTED_AT,
  };

  it("redacts vendor secrets from markdown and json timeline exports", () => {
    const markdown = renderInvestigationTimelineExportAppendix("markdown-report", exportInput);
    const json = serializeInvestigationTimelineExportJson(exportInput);

    for (const payload of [markdown, json]) {
      expect(payload).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
      expect(containsInvestigationTimelineExportSecrets(payload)).toBe(false);
    }

    expect(json).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(
      buildInvestigationTimelineExportDocument(exportInput).events[0]
        ?.sourceAttributionSummary
    ).toContain(REDACTED_VALUE_PLACEHOLDER);
  });

  it("flags payloads that still contain forbidden secret fields", () => {
    expect(
      containsInvestigationTimelineExportSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(
      containsInvestigationTimelineExportSecrets(
        serializeInvestigationTimelineExportJson(exportInput)
      )
    ).toBe(false);
  });
});
