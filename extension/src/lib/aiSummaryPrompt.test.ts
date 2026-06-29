import { describe, expect, it } from "vitest";
import {
  buildHoverCardSourceEntries,
} from "./hoverCardEnrichment";
import {
  AiSummaryInputRejectedError,
  assertEnrichmentSummaryExportInput,
  buildEnrichmentSummaryPromptMessages,
  ENRICHMENT_SUMMARY_PROMPT_PLACEHOLDER,
  FORBIDDEN_ENRICHMENT_SUMMARY_EXPORT_KEYS,
} from "./aiSummaryPrompt";
import {
  buildNormalizedEnrichmentRecord,
  ENRICHMENT_EXPORT_SCHEMA_VERSION,
} from "./enrichmentExport";
import { IOC_TYPE } from "./iocRegex";

function readyExportDocument() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    enrichmentState: "ready",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
    ]),
    exportedAt: "2026-06-28T15:00:00.000Z",
  });
}

describe("assertEnrichmentSummaryExportInput", () => {
  it("accepts a ready schema version 1 export record", () => {
    const record = readyExportDocument();
    expect(() =>
      assertEnrichmentSummaryExportInput({
        schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
        exportedAt: record.exportedAt,
        ioc: record.ioc,
        iocType: record.iocType,
        iocTypeLabel: record.iocTypeLabel,
        enrichmentState: "ready",
        summary: record.summary,
        tags: [...record.tags],
        sources: record.sources.map((source) => ({
          sourceId: source.sourceId,
          name: source.name,
          status: source.status,
          summary: source.summary,
          tags: [...source.tags],
          badgeText: source.badgeText,
        })),
        disabledSources: [...record.disabledSources],
        score: {
          mode: "insufficient",
          label: "unknown",
          summaryText: "Unknown risk",
          compositeSignal: null,
          reasoningLines: [],
          insufficientDetail:
            "Blended scoring needs at least two parseable OK source signals.",
        },
        disagreement: false,
        pivots: [...record.pivots],
      })
    ).not.toThrow();
  });

  it("rejects unsupported schema versions", () => {
    const record = readyExportDocument();
    expect(() =>
      assertEnrichmentSummaryExportInput({
        schemaVersion: 99,
        exportedAt: record.exportedAt,
        ioc: record.ioc,
        iocType: record.iocType,
        iocTypeLabel: record.iocTypeLabel,
        enrichmentState: "ready",
        tags: [],
        sources: [],
        disabledSources: [],
        score: {
          mode: "none",
          headline: "Risk score unavailable",
          detail: "No enrichment source results are available.",
        },
        disagreement: false,
        pivots: [],
      })
    ).toThrow(AiSummaryInputRejectedError);
  });

  it("rejects forbidden export keys", () => {
    for (const key of FORBIDDEN_ENRICHMENT_SUMMARY_EXPORT_KEYS) {
      const record = readyExportDocument();
      const document = {
        schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
        exportedAt: record.exportedAt,
        ioc: record.ioc,
        iocType: record.iocType,
        iocTypeLabel: record.iocTypeLabel,
        enrichmentState: "ready" as const,
        tags: [],
        sources: [],
        disabledSources: [],
        score: {
          mode: "none" as const,
          headline: "Risk score unavailable",
          detail: "No enrichment source results are available.",
        },
        disagreement: false,
        pivots: [],
        [key]: "blocked",
      };

      expect(() => assertEnrichmentSummaryExportInput(document)).toThrow(
        AiSummaryInputRejectedError
      );
    }
  });
});

describe("buildEnrichmentSummaryPromptMessages", () => {
  it("inlines export JSON into the user prompt placeholder", () => {
    const record = readyExportDocument();
    const exportDocument = {
      schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
      exportedAt: record.exportedAt,
      ioc: record.ioc,
      iocType: record.iocType,
      iocTypeLabel: record.iocTypeLabel,
      enrichmentState: "ready" as const,
      summary: record.summary,
      tags: [...record.tags],
      sources: record.sources.map((source) => ({
        sourceId: source.sourceId,
        name: source.name,
        status: source.status,
        summary: source.summary,
        tags: [...source.tags],
        badgeText: source.badgeText,
      })),
      disabledSources: [...record.disabledSources],
      score: {
        mode: "insufficient" as const,
        label: "unknown" as const,
        summaryText: "Unknown risk",
        compositeSignal: null,
        reasoningLines: [],
        insufficientDetail:
          "Blended scoring needs at least two parseable OK source signals.",
      },
      disagreement: false,
      pivots: [...record.pivots],
    };

    const messages = buildEnrichmentSummaryPromptMessages(exportDocument);
    expect(messages.system.length).toBeGreaterThan(0);
    expect(messages.user).toContain('"ioc":"8.8.8.8"');
    expect(messages.user).not.toContain(`{{${ENRICHMENT_SUMMARY_PROMPT_PLACEHOLDER}}}`);
  });
});
