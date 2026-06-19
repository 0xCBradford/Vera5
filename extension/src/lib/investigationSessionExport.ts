import {
  buildEnrichmentExportDocument,
  buildEnrichmentExportScoreSectionLines,
  buildEnrichmentExportSourceAttributionLines,
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  formatExportSourceSummaryLine,
  type EnrichmentExportDocument,
  type NormalizedEnrichmentRecord,
  type NormalizedEnrichmentRiskScore,
} from "./enrichmentExport";
import { buildDisabledSourcePlaceholders } from "./hoverCardEnrichment";
import { copyTextToClipboard } from "./copyText";
import {
  buildTraySubsetEnrichmentRecords,
  type TabScanSummaryEntry,
} from "./tabScanSummary";
import {
  buildInvestigationSessionActivitySummaryText,
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  type InvestigationSession,
} from "./investigationSession";
import { renderTraySubsetExportTemplate } from "./exportTemplates";
import {
  redactEnrichmentVendorPayload,
} from "./enrichmentRawResponse";

export const INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION = 1;
export const INVESTIGATION_SESSION_EXPORT_CSV_HEADER =
  "ioc,ioc_type,summary,risk_score,tags,sources,analyst_notes,exported_at";

export const INVESTIGATION_SESSION_EXPORT_HEADING = "Investigation Session Export";
export const INVESTIGATION_SESSION_EXPORT_SUMMARY_HEADING = "Session summary";
export const INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING = "Indicators";
export const INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING = "Enrichment details";
export const INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING = "Source attribution";

export type InvestigationSessionExportInput = {
  session: InvestigationSession;
  records: readonly NormalizedEnrichmentRecord[];
  exportedAt?: string;
};

export type InvestigationSessionExportMetadata = {
  id: string;
  title: string;
  pageUrl: string;
  createdAt: string;
  updatedAt: string;
  totalIocCount: number;
  iocCountByType: Partial<Record<IocType, number>>;
  enrichmentCount: number;
  exportCount: number;
  notes?: string;
};

export type InvestigationSessionExportDocument = {
  schemaVersion: typeof INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  session: InvestigationSessionExportMetadata;
  iocs: EnrichmentExportDocument[];
};

const INVESTIGATION_SESSION_EXPORT_FORBIDDEN_TOKENS = [
  "rawVendorJson",
  '"apiKeys"',
  '"apiKey"',
] as const;

function sanitizeInvestigationSessionExportText(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(redactEnrichmentVendorPayload(JSON.parse(trimmed)));
    } catch {
      return value;
    }
  }

  return value;
}

function sanitizeInvestigationSessionExportRiskScore(
  riskScore: NormalizedEnrichmentRiskScore | null
): NormalizedEnrichmentRiskScore | null {
  if (!riskScore) {
    return null;
  }

  if (riskScore.mode === "unavailable") {
    return {
      ...riskScore,
      headline:
        sanitizeInvestigationSessionExportText(riskScore.headline) ??
        riskScore.headline,
      detail:
        sanitizeInvestigationSessionExportText(riskScore.detail) ?? riskScore.detail,
    };
  }

  return {
    ...riskScore,
    summaryText:
      sanitizeInvestigationSessionExportText(riskScore.summaryText) ??
      riskScore.summaryText,
    reasoningLines: riskScore.reasoningLines.map(
      (line) => sanitizeInvestigationSessionExportText(line) ?? line
    ),
    reasoningEmptyDetail: riskScore.reasoningEmptyDetail
      ? sanitizeInvestigationSessionExportText(riskScore.reasoningEmptyDetail)
      : undefined,
    disagreementNotice: riskScore.disagreementNotice
      ? sanitizeInvestigationSessionExportText(riskScore.disagreementNotice)
      : undefined,
    ...(riskScore.mode === "insufficient"
      ? {
          insufficientDetail:
            sanitizeInvestigationSessionExportText(riskScore.insufficientDetail) ??
            riskScore.insufficientDetail,
        }
      : {}),
  };
}

export function sanitizeInvestigationSessionExportRecord(
  record: NormalizedEnrichmentRecord
): NormalizedEnrichmentRecord {
  return {
    ...record,
    summary: sanitizeInvestigationSessionExportText(record.summary),
    analystNotes: sanitizeInvestigationSessionExportText(record.analystNotes),
    tags: [...record.tags],
    sources: record.sources.map((source) => ({
      ...source,
      summary:
        sanitizeInvestigationSessionExportText(source.summary) ?? source.summary,
      lastUpdatedLine: sanitizeInvestigationSessionExportText(source.lastUpdatedLine),
      tags: [...source.tags],
    })),
    disabledSources: [...record.disabledSources],
    riskScore: sanitizeInvestigationSessionExportRiskScore(record.riskScore),
    pivots: [...record.pivots],
  };
}

export function sanitizeInvestigationSessionExportInput(
  input: InvestigationSessionExportInput
): InvestigationSessionExportInput {
  const session: InvestigationSession = {
    ...input.session,
    notes: sanitizeInvestigationSessionExportText(input.session.notes),
  };

  return {
    ...input,
    session,
    records: input.records.map(sanitizeInvestigationSessionExportRecord),
  };
}

export function containsInvestigationSessionExportSecrets(payload: string): boolean {
  if (
    INVESTIGATION_SESSION_EXPORT_FORBIDDEN_TOKENS.some((token) =>
      payload.includes(token)
    )
  ) {
    return true;
  }

  return /"(?:api[_-]?key|authorization|token|secret|password|bearer)"\s*:\s*"(?!\[redacted\])[^"]+"/i.test(
    payload
  );
}

function resolveInvestigationSessionExportInput(
  input: InvestigationSessionExportInput
): InvestigationSessionExportInput {
  return sanitizeInvestigationSessionExportInput(input);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export function formatInvestigationSessionExportTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function buildInvestigationSessionExportMetadata(
  session: InvestigationSession
): InvestigationSessionExportMetadata {
  const metadata: InvestigationSessionExportMetadata = {
    id: session.id,
    title: session.title,
    pageUrl: session.pageUrl,
    createdAt: formatInvestigationSessionExportTimestamp(session.createdAt),
    updatedAt: formatInvestigationSessionExportTimestamp(session.updatedAt),
    totalIocCount: session.totalIocCount,
    iocCountByType: { ...session.iocCountByType },
    enrichmentCount: session.enrichmentCount,
    exportCount: session.exportCount,
  };

  if (session.notes) {
    metadata.notes = session.notes;
  }

  return metadata;
}

export function buildInvestigationSessionExportDocument(
  input: InvestigationSessionExportInput
): InvestigationSessionExportDocument {
  const sanitized = resolveInvestigationSessionExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  return {
    schemaVersion: INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION,
    exportedAt,
    session: buildInvestigationSessionExportMetadata(sanitized.session),
    iocs: sanitized.records.map((record) => buildEnrichmentExportDocument(record)),
  };
}

export function serializeInvestigationSessionExportJson(
  input: InvestigationSessionExportInput,
  pretty = true
): string {
  return JSON.stringify(
    buildInvestigationSessionExportDocument(input),
    null,
    pretty ? 2 : undefined
  );
}

export function buildInvestigationSessionExportCsv(
  input: InvestigationSessionExportInput
): string {
  const sanitized = resolveInvestigationSessionExportInput(input);
  return renderTraySubsetExportTemplate("csv-row", sanitized.records);
}

function resolveInvestigationSessionExportRecordSummary(
  record: NormalizedEnrichmentRecord
): string {
  if (record.summary && record.summary.trim().length > 0) {
    return record.summary.trim();
  }

  const firstSourceSummary = record.sources.find(
    (source) => source.summary.trim().length > 0
  )?.summary;
  if (firstSourceSummary) {
    return firstSourceSummary.trim();
  }

  return ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL;
}

function hasInvestigationSessionExportEnrichmentData(
  record: NormalizedEnrichmentRecord
): boolean {
  return record.sources.length > 0 || record.riskScore !== null;
}

export function buildInvestigationSessionExportSummaryLines(
  session: InvestigationSession,
  exportedAt: string
): string[] {
  const lines = [
    `# ${INVESTIGATION_SESSION_EXPORT_HEADING}`,
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_SUMMARY_HEADING}`,
    "",
    `- **Title:** ${session.title}`,
    `- **Page URL:** ${session.pageUrl || "(none)"}`,
    `- **Created:** ${formatInvestigationSessionExportTimestamp(session.createdAt)}`,
    `- **Updated:** ${formatInvestigationSessionExportTimestamp(session.updatedAt)}`,
    `- **Exported:** ${exportedAt}`,
    `- **Indicators:** ${buildInvestigationSessionIocCountText(session.totalIocCount)}`,
  ];

  const typeBreakdown = buildInvestigationSessionTypeBreakdownText(session);
  if (typeBreakdown) {
    lines.push(`- **By type:** ${typeBreakdown}`);
  }

  const activitySummary = buildInvestigationSessionActivitySummaryText(session);
  if (activitySummary) {
    lines.push(`- **Activity:** ${activitySummary}`);
  }

  if (session.notes) {
    lines.push(`- **Notes:** ${session.notes}`);
  }

  return lines;
}

export function buildInvestigationSessionExportIocTableLines(
  records: readonly NormalizedEnrichmentRecord[]
): string[] {
  if (records.length === 0) {
    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`,
      "",
      "_No indicator rows are available for this export._",
    ];
  }

  const lines = [
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`,
    "",
    "| Type | IOC | Enrichment summary |",
    "| --- | --- | --- |",
  ];

  for (const record of records) {
    lines.push(
      `| ${escapeMarkdownTableCell(record.iocTypeLabel)} | ${escapeMarkdownTableCell(record.ioc)} | ${escapeMarkdownTableCell(resolveInvestigationSessionExportRecordSummary(record))} |`
    );
  }

  return lines;
}

export function buildInvestigationSessionExportEnrichmentSnippetLines(
  record: NormalizedEnrichmentRecord
): string[] {
  if (!hasInvestigationSessionExportEnrichmentData(record)) {
    return [];
  }

  const lines = [
    "",
    `### ${record.ioc}`,
    "",
    `**Type:** ${record.iocTypeLabel}`,
  ];

  lines.push(...buildEnrichmentExportScoreSectionLines(record));

  const sourceLines = buildEnrichmentExportSourceAttributionLines(record);
  if (sourceLines.length > 0) {
    lines.push(...sourceLines);
  } else if (record.sources.length > 0) {
    lines.push("", ...record.sources.map((source) => `- ${formatExportSourceSummaryLine(source)}`));
  }

  return lines;
}

export function buildInvestigationSessionExportEnrichmentSectionLines(
  records: readonly NormalizedEnrichmentRecord[]
): string[] {
  const snippetBlocks = records
    .map((record) => buildInvestigationSessionExportEnrichmentSnippetLines(record))
    .filter((lines) => lines.length > 0);

  if (snippetBlocks.length === 0) {
    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`,
      "",
      ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    ];
  }

  return [
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`,
    ...snippetBlocks.flat(),
  ];
}

export function buildInvestigationSessionExportSourceAttributionLines(
  records: readonly NormalizedEnrichmentRecord[]
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    for (const source of record.sources) {
      const summaryLine = formatExportSourceSummaryLine(source);
      if (seen.has(summaryLine)) {
        continue;
      }
      seen.add(summaryLine);
      lines.push(`- ${summaryLine}`);
    }

    for (const placeholder of buildDisabledSourcePlaceholders(record.disabledSources)) {
      const line = `${placeholder.label}: ${placeholder.message}`;
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(`- ${line}`);
    }
  }

  if (lines.length === 0) {
    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING}`,
      "",
      "No enrichment source results are available for indicators in this session.",
    ];
  }

  return [
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING}`,
    "",
    "Enrichment performed locally with your configured API keys.",
    "",
    ...lines,
  ];
}

export function buildInvestigationSessionExportMarkdown(
  input: InvestigationSessionExportInput
): string {
  const sanitized = resolveInvestigationSessionExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const lines = [
    ...buildInvestigationSessionExportSummaryLines(sanitized.session, exportedAt),
    ...buildInvestigationSessionExportIocTableLines(sanitized.records),
    ...buildInvestigationSessionExportEnrichmentSectionLines(sanitized.records),
    ...buildInvestigationSessionExportSourceAttributionLines(sanitized.records),
    "",
  ];
  return lines.join("\n");
}

export function buildInvestigationSessionExportFilename(
  session: Pick<InvestigationSession, "title">,
  exportedAt: string = new Date().toISOString(),
  format: "markdown" | "json" | "csv" = "markdown"
): string {
  const slug =
    session.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "investigation-session";
  const extension = format === "json" ? "json" : format === "csv" ? "csv" : "md";
  return `vera5-session-${slug}-${exportedAt.slice(0, 10)}.${extension}`;
}

export type InvestigationSessionExportFormat = "markdown" | "json" | "csv";

export async function buildInvestigationSessionExportInput(input: {
  session: InvestigationSession;
  entries: ReadonlyArray<TabScanSummaryEntry>;
  exportedAt?: string;
}): Promise<InvestigationSessionExportInput> {
  const records = await buildTraySubsetEnrichmentRecords(input.entries);
  return {
    session: input.session,
    records,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
  };
}

function resolveInvestigationSessionExportContent(
  input: InvestigationSessionExportInput,
  format: InvestigationSessionExportFormat
): { content: string; mimeType: string } {
  const sanitized = resolveInvestigationSessionExportInput(input);

  if (format === "json") {
    return {
      content: serializeInvestigationSessionExportJson(sanitized),
      mimeType: "application/json",
    };
  }

  if (format === "csv") {
    return {
      content: buildInvestigationSessionExportCsv(sanitized),
      mimeType: "text/csv",
    };
  }

  return {
    content: buildInvestigationSessionExportMarkdown(sanitized),
    mimeType: "text/markdown",
  };
}

export async function copyInvestigationSessionExportToClipboard(
  input: InvestigationSessionExportInput,
  format: InvestigationSessionExportFormat
): Promise<boolean> {
  const { content } = resolveInvestigationSessionExportContent(input, format);
  if (content.length === 0) {
    return false;
  }
  return copyTextToClipboard(content);
}

export function downloadInvestigationSessionExportFile(
  input: InvestigationSessionExportInput,
  format: InvestigationSessionExportFormat,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const { content, mimeType } = resolveInvestigationSessionExportContent(
    { ...input, exportedAt },
    format
  );
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildInvestigationSessionExportFilename(
    input.session,
    exportedAt,
    format
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
