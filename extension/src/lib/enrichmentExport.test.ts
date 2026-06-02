import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionAnalystNotes,
  setSessionAnalystNote,
} from "./analystNotesSession";
import { IOC_TYPE } from "./iocRegex";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
} from "./hoverCardEnrichment";
import {
  buildEnrichmentExportAnalystNotesLines,
  buildEnrichmentExportDocument,
  buildEnrichmentExportMarkdown,
  buildEnrichmentExportNoScoreLines,
  buildEnrichmentExportRiskScoreLines,
  buildEnrichmentExportScoreSectionLines,
  buildEnrichmentExportSourceAttributionLines,
  buildNormalizedEnrichmentRecord,
  copyEnrichmentExportJsonToClipboard,
  copyEnrichmentExportMarkdownToClipboard,
  copyEnrichmentExportTxtToClipboard,
  buildEnrichmentExportFilename,
  buildEnrichmentExportTxt,
  ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING,
  ENRICHMENT_EXPORT_HEADING,
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  ENRICHMENT_EXPORT_SCHEMA_VERSION,
  ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING,
  formatEnrichmentExportTypeLabel,
  formatExportSourceSummaryLine,
  hasEnrichmentExportRiskScoreData,
  serializeEnrichmentExportJson,
  shouldRenderEnrichmentExportNoScoreSection,
} from "./enrichmentExport";
import {
  COMPOSITE_SCORE_DISAGREEMENT_NOTICE,
  RISK_SCORE_REASONING_HEADING,
  RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL,
  RISK_SCORE_UNAVAILABLE_HEADLINE,
} from "./scoring";

const EXPORTED_AT = "2026-06-02T12:00:00.000Z";

afterEach(() => {
  clearSessionAnalystNotes();
  vi.unstubAllGlobals();
});

describe("formatEnrichmentExportTypeLabel", () => {
  it("maps IOC types to export labels", () => {
    expect(formatEnrichmentExportTypeLabel(IOC_TYPE.IPV4)).toBe("IPv4 address");
    expect(formatEnrichmentExportTypeLabel(IOC_TYPE.SHA256)).toBe("SHA256 hash");
  });
});

describe("buildNormalizedEnrichmentRecord", () => {
  it("captures per-source rows, pivots, and blended risk score fields", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        tags: ["ssh"],
        fromCache: true,
        fetchedAt: "2026-06-02T11:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
        tags: ["scanner"],
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    expect(record.ioc).toBe("185.220.101.4");
    expect(record.iocTypeLabel).toBe("IPv4 address");
    expect(record.enrichmentState).toBe("ready");
    expect(record.summary).toBe("74 abuse confidence");
    expect(record.tags).toEqual(["ssh"]);
    expect(record.sources).toHaveLength(2);
    expect(record.sources[0]).toMatchObject({
      name: "AbuseIPDB",
      status: "ok",
      summary: "74 abuse confidence",
      fromCache: true,
    });
    expect(record.pivots.length).toBeGreaterThan(0);
    expect(record.exportedAt).toBe(EXPORTED_AT);
    expect(record.riskScore).toMatchObject({
      mode: "available",
      summaryText: expect.stringContaining("risk"),
      disagreement: expect.any(Boolean),
    });
    expect(record.riskScore?.mode === "available" && record.riskScore.reasoningLines.length).toBeGreaterThan(0);
  });

  it("records unavailable risk score when every enrichment source is disabled", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      sourceResults: [],
      exportedAt: EXPORTED_AT,
    });

    expect(record.riskScore).toMatchObject({
      mode: "unavailable",
      headline: "Risk score unavailable",
      disagreement: false,
      reasoningLines: [],
    });
    expect(hasEnrichmentExportRiskScoreData(record.riskScore)).toBe(false);
  });

  it("stores analyst notes on the normalized record", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "example.com",
      iocType: IOC_TYPE.DOMAIN,
      analystNotes: "  Review DNS logs.  ",
      exportedAt: EXPORTED_AT,
    });

    expect(record.analystNotes).toBe("Review DNS logs.");
  });

  it("resolves analyst notes from the session cache when input omits them", () => {
    setSessionAnalystNote("example.com", "Check DNS logs.");

    const record = buildNormalizedEnrichmentRecord({
      value: "example.com",
      iocType: IOC_TYPE.DOMAIN,
      exportedAt: EXPORTED_AT,
    });

    expect(record.analystNotes).toBe("Check DNS logs.");
  });
});

describe("buildEnrichmentExportRiskScoreLines", () => {
  it("renders composite score label and reasoning chain for blended scores", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const lines = buildEnrichmentExportRiskScoreLines(record);
    const joined = lines.join("\n");

    expect(record.riskScore?.mode).toBe("available");
    expect(joined).toContain("Risk score:");
    expect(joined).toContain("/100");
    expect(joined).toContain(`### ${RISK_SCORE_REASONING_HEADING}`);
    expect(joined).toContain("1. AbuseIPDB:");
    expect(joined).toContain("2. OTX:");
  });

  it("includes disagreement callout when source bands diverge materially", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "95 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "1 threat pulse",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const lines = buildEnrichmentExportRiskScoreLines(record);

    expect(record.riskScore?.disagreement).toBe(true);
    expect(lines.join("\n")).toContain(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
  });

  it("returns no lines when risk score is unavailable", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      exportedAt: EXPORTED_AT,
    });

    expect(buildEnrichmentExportRiskScoreLines(record)).toEqual([]);
  });

  it("returns no lines when enrichment has not produced score data yet", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    expect(record.riskScore).toBeNull();
    expect(buildEnrichmentExportRiskScoreLines(record)).toEqual([]);
  });
});

describe("buildEnrichmentExportNoScoreLines", () => {
  it("renders unavailable headline and detail when every source is disabled", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      exportedAt: EXPORTED_AT,
    });

    expect(shouldRenderEnrichmentExportNoScoreSection(record)).toBe(true);
    expect(buildEnrichmentExportNoScoreLines(record)).toEqual([
      "",
      RISK_SCORE_UNAVAILABLE_HEADLINE,
      "",
      RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL,
    ]);
  });

  it("renders explicit no-score copy when enrichment results are absent", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    expect(shouldRenderEnrichmentExportNoScoreSection(record)).toBe(true);
    expect(buildEnrichmentExportNoScoreLines(record)).toEqual([
      "",
      RISK_SCORE_UNAVAILABLE_HEADLINE,
      "",
      ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    ]);
  });

  it("returns no lines when a score section is available", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    expect(shouldRenderEnrichmentExportNoScoreSection(record)).toBe(false);
    expect(buildEnrichmentExportNoScoreLines(record)).toEqual([]);
    expect(buildEnrichmentExportScoreSectionLines(record).length).toBeGreaterThan(0);
  });
});

describe("buildEnrichmentExportSourceAttributionLines", () => {
  it("renders multi-source bullets with badge and summary", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-06-02T11:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "error",
        errorMessage: "OTX rate limit reached.",
        errorCode: "rate_limited",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const lines = buildEnrichmentExportSourceAttributionLines(record);

    expect(lines[0]).toBe("");
    expect(lines[1]).toBe(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`);
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe(
      formatExportSourceSummaryLine(record.sources[0]!)
    );
    expect(lines[4]).toBe(
      formatExportSourceSummaryLine(record.sources[1]!)
    );
    expect(lines[3]).toContain("AbuseIPDB (Cached): 74 abuse confidence");
    expect(lines[4]).toContain("OTX (Error): OTX rate limit reached.");
  });

  it("renders single-source attribution using overlay copy", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
        fromCache: false,
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const lines = buildEnrichmentExportSourceAttributionLines(record);

    expect(lines).toContain("Source: AbuseIPDB · live");
    expect(lines).toContain("42 abuse confidence");
  });

  it("includes disabled source placeholders", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [ENRICHMENT_SOURCE.URLSCAN],
      exportedAt: EXPORTED_AT,
    });

    const lines = buildEnrichmentExportSourceAttributionLines(record);

    expect(lines.join("\n")).toContain(
      "- URLScan.io: URLScan.io is disabled. Enable it in extension settings to load enrichment."
    );
  });

  it("returns no lines when there are no sources or disabled placeholders", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    expect(buildEnrichmentExportSourceAttributionLines(record)).toEqual([]);
  });
});

describe("buildEnrichmentExportMarkdown", () => {
  it("renders a ticket-ready header from the normalized enrichment object", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      summary: "74 abuse confidence",
      tags: ["ssh", "scanner"],
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toBe(
      [
        `## ${ENRICHMENT_EXPORT_HEADING}`,
        "",
        "IOC: 185.220.101.4",
        "Type: IPv4 address",
        "",
        "Summary: 74 abuse confidence",
        "",
        "Tags: ssh, scanner",
        "",
        RISK_SCORE_UNAVAILABLE_HEADLINE,
        "",
        ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
        "",
      ].join("\n")
    );
  });

  it("omits optional summary and tags when absent", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toBe(
      [
        `## ${ENRICHMENT_EXPORT_HEADING}`,
        "",
        "IOC: 8.8.8.8",
        "Type: IPv4 address",
        "",
        RISK_SCORE_UNAVAILABLE_HEADLINE,
        "",
        ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
        "",
      ].join("\n")
    );
  });

  it("appends score and source sections for enriched multi-source records", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toContain("Risk score:");
    expect(markdown).toContain(`### ${RISK_SCORE_REASONING_HEADING}`);
    expect(markdown).toContain(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`);
    expect(markdown).toContain("- AbuseIPDB (Live): 74 abuse confidence");
    expect(markdown).toContain("- OTX (Live): 3 threat pulses");
    expect(markdown.indexOf("Risk score:")).toBeLessThan(
      markdown.indexOf(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`)
    );
  });

  it("includes disagreement callout in full markdown when sources diverge", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "95 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "1 threat pulse",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toContain(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
    expect(markdown.indexOf(COMPOSITE_SCORE_DISAGREEMENT_NOTICE)).toBeGreaterThan(
      markdown.indexOf(`### ${RISK_SCORE_REASONING_HEADING}`)
    );
  });

  it("includes explicit no-score section when all enrichment sources are disabled", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toContain(RISK_SCORE_UNAVAILABLE_HEADLINE);
    expect(markdown).toContain(RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL);
    expect(markdown).not.toContain("Risk score:");
  });

  it("includes analyst notes when present on the normalized record", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      analystNotes: "Review firewall logs.\nCheck proxy egress.",
      exportedAt: EXPORTED_AT,
    });

    const markdown = buildEnrichmentExportMarkdown(record);

    expect(markdown).toContain(`### ${ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING}`);
    expect(markdown).toContain("Review firewall logs.");
    expect(markdown).toContain("Check proxy egress.");
    expect(markdown.indexOf(`### ${ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING}`)).toBeGreaterThan(
      markdown.indexOf(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`) === -1
        ? markdown.indexOf(RISK_SCORE_UNAVAILABLE_HEADLINE)
        : markdown.indexOf(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`)
    );
  });

  it("omits analyst notes from markdown when absent", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    expect(buildEnrichmentExportAnalystNotesLines(record)).toEqual([]);
    expect(buildEnrichmentExportMarkdown(record)).not.toContain(
      ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING
    );
  });
});

/**
 * @vitest-environment happy-dom
 */
describe("enrichment JSON export", () => {
  it("builds a versioned export document with explicit score and source fields", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const document = buildEnrichmentExportDocument(record);

    expect(document.schemaVersion).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
    expect(document.exportedAt).toBe(EXPORTED_AT);
    expect(document.ioc).toBe("8.8.8.8");
    expect(document.sources).toHaveLength(2);
    expect(document.sources[0]).toMatchObject({
      sourceId: "abuseipdb",
      name: "AbuseIPDB",
      status: "ok",
      summary: "84 abuse confidence",
      badgeText: "Live",
    });
    expect(document.score.mode).toBe("available");
    expect(document.score).toMatchObject({
      summaryText: expect.stringContaining("risk"),
      compositeSignal: expect.any(Number),
    });
    expect(document.disagreement).toEqual(expect.any(Boolean));
    expect(document).not.toHaveProperty("enrichment");
  });

  it("includes analystNotes in JSON when present on the normalized record", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      analystNotes: "Review firewall logs.",
      exportedAt: EXPORTED_AT,
    });

    const document = buildEnrichmentExportDocument(record);
    const parsed = JSON.parse(serializeEnrichmentExportJson(record)) as {
      analystNotes?: string;
    };

    expect(document.analystNotes).toBe("Review firewall logs.");
    expect(parsed.analystNotes).toBe("Review firewall logs.");
  });

  it("omits analystNotes from JSON when absent", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    const document = buildEnrichmentExportDocument(record);
    const parsed = JSON.parse(serializeEnrichmentExportJson(record)) as {
      analystNotes?: string;
    };

    expect(document.analystNotes).toBeUndefined();
    expect(parsed).not.toHaveProperty("analystNotes");
  });

  it("serializes score, disagreement, and per-source fields in clipboard JSON", () => {
    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "95 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "1 threat pulse",
      },
    ]);

    const record = buildNormalizedEnrichmentRecord({
      value: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      sourceResults,
      exportedAt: EXPORTED_AT,
    });

    const json = serializeEnrichmentExportJson(record);
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      sources: Array<{ sourceId: string; summary: string }>;
      score: { mode: string; summaryText: string; reasoningLines: string[] };
      disagreement: boolean;
      disagreementNotice?: string;
    };

    expect(parsed.schemaVersion).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
    expect(parsed.sources).toHaveLength(2);
    expect(parsed.sources[0]?.sourceId).toBe("abuseipdb");
    expect(parsed.score.mode).toBe("available");
    expect(parsed.score.summaryText).toContain("risk");
    expect(parsed.score.reasoningLines.length).toBeGreaterThan(0);
    expect(parsed.disagreement).toBe(true);
    expect(parsed.disagreementNotice).toBe(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
  });

  it("serializes unavailable score mode when every enrichment source is disabled", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      exportedAt: EXPORTED_AT,
    });

    const parsed = JSON.parse(serializeEnrichmentExportJson(record)) as {
      score: { mode: string; headline: string; detail: string };
      disagreement: boolean;
      sources: unknown[];
    };

    expect(parsed.score.mode).toBe("unavailable");
    expect(parsed.score.headline).toBe(RISK_SCORE_UNAVAILABLE_HEADLINE);
    expect(parsed.score.detail).toBe(RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL);
    expect(parsed.disagreement).toBe(false);
    expect(parsed.sources).toEqual([]);
  });

  it("serializes none score mode when enrichment results are absent", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    const parsed = JSON.parse(serializeEnrichmentExportJson(record)) as {
      score: { mode: string; detail: string };
      sources: unknown[];
    };

    expect(parsed.score.mode).toBe("none");
    expect(parsed.score.detail).toBe(ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL);
    expect(parsed.sources).toEqual([]);
  });

  it("copies serialized JSON to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    await expect(copyEnrichmentExportJsonToClipboard(record)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeText.mock.calls[0]![0] as string)).toMatchObject({
      schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
      score: { mode: "none" },
      sources: [],
      disagreement: false,
    });
  });

  it("copies markdown export to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    await expect(
      copyEnrichmentExportMarkdownToClipboard(record)
    ).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0] as string).toContain(
      ENRICHMENT_EXPORT_HEADING
    );
  });

  it("builds plain-text export without markdown headings", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    const txt = buildEnrichmentExportTxt(record);
    expect(txt).toContain(ENRICHMENT_EXPORT_HEADING);
    expect(txt).not.toContain("## ");
    expect(txt).not.toContain("### ");
  });

  it("copies plain-text export to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      exportedAt: EXPORTED_AT,
    });

    await expect(copyEnrichmentExportTxtToClipboard(record)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(buildEnrichmentExportTxt(record));
  });

  it("builds deterministic export filenames", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "http://103.156.91.97/recent/ctf.exe",
      iocType: IOC_TYPE.URL,
      exportedAt: "2026-05-27T12:00:00.000Z",
    });

    expect(buildEnrichmentExportFilename(record, "markdown")).toBe(
      "vera5-http_103.156.91.97_recent_ctf.exe-2026-05-27T12-00-00-000Z.md"
    );
    expect(buildEnrichmentExportFilename(record, "json")).toMatch(/\.json$/);
    expect(buildEnrichmentExportFilename(record, "txt")).toMatch(/\.txt$/);
  });
});

describe("export contract: schemaVersion, score, disagreement, and no-score paths", () => {
  function disagreementSourceResults() {
    return buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "95 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "1 threat pulse",
      },
    ]);
  }

  const contractCases = [
    {
      label: "available score with disagreement",
      buildRecord: () =>
        buildNormalizedEnrichmentRecord({
          value: "8.8.8.8",
          iocType: IOC_TYPE.IPV4,
          sourceResults: disagreementSourceResults(),
          exportedAt: EXPORTED_AT,
        }),
      scoreMode: "available" as const,
      disagreement: true,
      expectDisagreementNotice: true,
      expectReasoningLines: true,
      expectMarkdownRiskScore: true,
      expectMarkdownNoScore: false,
      noScoreDetail: null,
    },
    {
      label: "unavailable score when all sources are disabled",
      buildRecord: () =>
        buildNormalizedEnrichmentRecord({
          value: "8.8.8.8",
          iocType: IOC_TYPE.IPV4,
          disabledSources: [
            ENRICHMENT_SOURCE.ABUSEIPDB,
            ENRICHMENT_SOURCE.OTX,
            ENRICHMENT_SOURCE.URLSCAN,
            ENRICHMENT_SOURCE.GREYNOISE,
          ],
          exportedAt: EXPORTED_AT,
        }),
      scoreMode: "unavailable" as const,
      disagreement: false,
      expectDisagreementNotice: false,
      expectReasoningLines: false,
      expectMarkdownRiskScore: false,
      expectMarkdownNoScore: true,
      noScoreDetail: RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL,
    },
    {
      label: "none score when enrichment results are absent",
      buildRecord: () =>
        buildNormalizedEnrichmentRecord({
          value: "8.8.8.8",
          iocType: IOC_TYPE.IPV4,
          exportedAt: EXPORTED_AT,
        }),
      scoreMode: "none" as const,
      disagreement: false,
      expectDisagreementNotice: false,
      expectReasoningLines: false,
      expectMarkdownRiskScore: false,
      expectMarkdownNoScore: true,
      noScoreDetail: ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    },
  ];

  it.each(contractCases)(
    "$label JSON includes schemaVersion, score mode, and disagreement fields",
    ({
      buildRecord,
      scoreMode,
      disagreement,
      expectDisagreementNotice,
      expectReasoningLines,
    }) => {
      const record = buildRecord();
      const document = buildEnrichmentExportDocument(record);
      const parsed = JSON.parse(serializeEnrichmentExportJson(record)) as {
        schemaVersion: number;
        score: {
          mode: string;
          summaryText?: string;
          compositeSignal?: number;
          reasoningLines?: string[];
          headline?: string;
          detail?: string;
        };
        disagreement: boolean;
        disagreementNotice?: string;
      };

      expect(document.schemaVersion).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
      expect(parsed.schemaVersion).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
      expect(document.score.mode).toBe(scoreMode);
      expect(parsed.score.mode).toBe(scoreMode);
      expect(document.disagreement).toBe(disagreement);
      expect(parsed.disagreement).toBe(disagreement);

      if (expectDisagreementNotice) {
        expect(document.disagreementNotice).toBe(
          COMPOSITE_SCORE_DISAGREEMENT_NOTICE
        );
        expect(parsed.disagreementNotice).toBe(
          COMPOSITE_SCORE_DISAGREEMENT_NOTICE
        );
      } else {
        expect(document.disagreementNotice).toBeUndefined();
        expect(parsed.disagreementNotice).toBeUndefined();
      }

      if (expectReasoningLines) {
        expect(document.score.mode).toBe("available");
        expect(parsed.score.mode).toBe("available");
        if (document.score.mode === "available") {
          expect(document.score.reasoningLines.length).toBeGreaterThan(0);
          expect(document.score.summaryText).toContain("risk");
          expect(document.score.compositeSignal).toEqual(expect.any(Number));
        }
        if (parsed.score.mode === "available") {
          expect(parsed.score.reasoningLines?.length).toBeGreaterThan(0);
          expect(parsed.score.summaryText).toContain("risk");
          expect(parsed.score.compositeSignal).toEqual(expect.any(Number));
        }
      }
    }
  );

  it.each(contractCases)(
    "$label markdown uses score or explicit no-score sections",
    ({
      buildRecord,
      expectMarkdownRiskScore,
      expectMarkdownNoScore,
      noScoreDetail,
    }) => {
      const markdown = buildEnrichmentExportMarkdown(buildRecord());
      const scoreSection = buildEnrichmentExportScoreSectionLines(buildRecord());

      if (expectMarkdownRiskScore) {
        expect(markdown).toContain("Risk score:");
        expect(markdown).toContain(`### ${RISK_SCORE_REASONING_HEADING}`);
        expect(scoreSection.join("\n")).toContain("Risk score:");
      } else {
        expect(markdown).not.toContain("Risk score:");
        expect(scoreSection.join("\n")).not.toContain("Risk score:");
      }

      if (expectMarkdownNoScore) {
        expect(markdown).toContain(RISK_SCORE_UNAVAILABLE_HEADLINE);
        expect(scoreSection.join("\n")).toContain(RISK_SCORE_UNAVAILABLE_HEADLINE);
        expect(markdown).toContain(noScoreDetail);
        expect(scoreSection.join("\n")).toContain(noScoreDetail);
      }
    }
  );
});
