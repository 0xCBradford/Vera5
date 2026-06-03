import { copyTextToClipboard } from "./copyText";
import {
  buildEnrichmentExportMarkdown,
  buildEnrichmentExportScoreSectionLines,
  ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING,
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING,
  formatExportSourceSummaryLine,
  hasEnrichmentExportRiskScoreData,
  type NormalizedEnrichmentRecord,
} from "./enrichmentExport";
import { buildDisabledSourcePlaceholders } from "./hoverCardEnrichment";
import { RISK_SCORE_UNAVAILABLE_HEADLINE } from "./scoring";

export const EXPORT_TEMPLATE_IDS = [
  "jira-comment",
  "thehive-case-note",
  "analyst-update",
  "obsidian-note",
  "markdown-report",
  "csv-row",
] as const;

export type ExportTemplateId = (typeof EXPORT_TEMPLATE_IDS)[number];

export const EXPORT_TEMPLATE_LABEL: Record<ExportTemplateId, string> = {
  "jira-comment": "Jira comment",
  "thehive-case-note": "TheHive case note",
  "analyst-update": "Analyst update",
  "obsidian-note": "Obsidian note",
  "markdown-report": "Markdown report",
  "csv-row": "CSV rows",
};

export const TRAY_SUBSET_TEMPLATE_SEPARATOR = "\n\n---\n\n";

export type ExportTemplateFieldContext = {
  ioc: string;
  iocType: string;
  iocTypeLabel: string;
  summary: string;
  tags: string;
  scoreSummary: string;
  scoreReasoning: string;
  sourcesBlock: string;
  analystNotes: string;
  exportedAt: string;
  disagreementNotice: string;
};

export function listExportTemplateIds(): ExportTemplateId[] {
  return [...EXPORT_TEMPLATE_IDS];
}

export function getExportTemplateLabel(templateId: ExportTemplateId): string {
  return EXPORT_TEMPLATE_LABEL[templateId];
}

export function isExportTemplateId(value: unknown): value is ExportTemplateId {
  return (
    typeof value === "string" &&
    (EXPORT_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

function resolveScoreSummary(record: NormalizedEnrichmentRecord): string {
  if (hasEnrichmentExportRiskScoreData(record.riskScore)) {
    return record.riskScore.summaryText;
  }
  if (record.riskScore?.mode === "unavailable") {
    return record.riskScore.headline;
  }
  return RISK_SCORE_UNAVAILABLE_HEADLINE;
}

function resolveScoreReasoning(record: NormalizedEnrichmentRecord): string {
  if (!hasEnrichmentExportRiskScoreData(record.riskScore)) {
    return ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL;
  }
  return record.riskScore.reasoningLines.join("\n");
}

function resolveSourcesPlainBlock(record: NormalizedEnrichmentRecord): string {
  const lines: string[] = [];

  if (record.sources.length === 1) {
    const source = record.sources[0]!;
    lines.push(`${source.name}: ${source.summary}`);
    if (source.tags.length > 0) {
      lines.push(`Tags: ${source.tags.join(", ")}`);
    }
    if (source.lastUpdatedLine) {
      lines.push(source.lastUpdatedLine);
    }
  } else if (record.sources.length > 1) {
    for (const source of record.sources) {
      lines.push(formatExportSourceSummaryLine(source));
    }
  }

  for (const placeholder of buildDisabledSourcePlaceholders(record.disabledSources)) {
    lines.push(`${placeholder.label}: ${placeholder.message}`);
  }

  if (lines.length === 0) {
    return "No enrichment source results available.";
  }

  return lines.join("\n");
}

function resolveDisagreementNotice(record: NormalizedEnrichmentRecord): string {
  if (hasEnrichmentExportRiskScoreData(record.riskScore)) {
    return record.riskScore.disagreementNotice ?? "";
  }
  return "";
}

export function buildExportTemplateFieldContext(
  record: NormalizedEnrichmentRecord
): ExportTemplateFieldContext {
  return {
    ioc: record.ioc,
    iocType: record.iocType,
    iocTypeLabel: record.iocTypeLabel,
    summary: record.summary ?? "",
    tags: record.tags.join(", "),
    scoreSummary: resolveScoreSummary(record),
    scoreReasoning: resolveScoreReasoning(record),
    sourcesBlock: resolveSourcesPlainBlock(record),
    analystNotes: record.analystNotes ?? "",
    exportedAt: record.exportedAt,
    disagreementNotice: resolveDisagreementNotice(record),
  };
}

function renderJiraCommentTemplate(context: ExportTemplateFieldContext): string {
  const lines = [
    `h3. Vera5 IOC triage — ${context.ioc}`,
    "",
    `*Type:* ${context.iocTypeLabel}`,
  ];

  if (context.summary) {
    lines.push(`*Summary:* ${context.summary}`);
  }
  if (context.tags) {
    lines.push(`*Tags:* ${context.tags}`);
  }
  lines.push(`*Risk score:* ${context.scoreSummary}`);
  if (context.disagreementNotice) {
    lines.push(`*Sources disagree:* ${context.disagreementNotice}`);
  }
  lines.push("", "h4. Source summary", "", context.sourcesBlock);
  if (context.scoreReasoning) {
    lines.push("", "h4. Score reasoning", "", context.scoreReasoning);
  }
  if (context.analystNotes) {
    lines.push("", "h4. Analyst notes", "", context.analystNotes);
  }
  lines.push("", `_Exported ${context.exportedAt} via Vera5._`);
  return lines.join("\n");
}

function renderTheHiveCaseNoteTemplate(
  context: ExportTemplateFieldContext
): string {
  const lines = [
    `[Vera5] ${context.ioc} (${context.iocTypeLabel})`,
    "",
    `Summary: ${context.summary || "No enrichment summary available."}`,
    `Risk score: ${context.scoreSummary}`,
  ];

  if (context.disagreementNotice) {
    lines.push(`Sources disagree: ${context.disagreementNotice}`);
  }

  lines.push("", "Sources:", context.sourcesBlock);

  if (context.analystNotes) {
    lines.push("", "Analyst notes:", context.analystNotes);
  }

  lines.push("", `Exported ${context.exportedAt} via Vera5.`);
  return lines.join("\n");
}

function renderAnalystUpdateTemplate(context: ExportTemplateFieldContext): string {
  const summaryPart = context.summary
    ? `Summary: ${context.summary}. `
    : "";
  const tagsPart = context.tags ? `Tags: ${context.tags}. ` : "";
  const disagreementPart = context.disagreementNotice
    ? `Sources disagree: ${context.disagreementNotice}. `
    : "";

  let text = `Vera5 triage for ${context.ioc} (${context.iocTypeLabel}). ${summaryPart}${tagsPart}Risk score: ${context.scoreSummary}. ${disagreementPart}`.trim();

  if (context.analystNotes) {
    text += ` Analyst notes: ${context.analystNotes}`;
  }

  return text;
}

function renderObsidianNoteTemplate(
  record: NormalizedEnrichmentRecord,
  context: ExportTemplateFieldContext
): string {
  const lines = [
    "---",
    `ioc: ${context.ioc}`,
    `ioc_type: ${context.iocType}`,
    `exported_at: ${context.exportedAt}`,
    "source: Vera5",
    "---",
    "",
    `# Vera5 IOC — ${context.ioc}`,
    "",
    `- Type: ${context.iocTypeLabel}`,
  ];

  if (context.summary) {
    lines.push(`- Summary: ${context.summary}`);
  }
  if (context.tags) {
    lines.push(`- Tags: ${context.tags}`);
  }

  lines.push(`- Risk score: ${context.scoreSummary}`);
  if (context.disagreementNotice) {
    lines.push(`- Sources disagree: ${context.disagreementNotice}`);
  }

  lines.push(
    "",
    `## ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`,
    "",
    context.sourcesBlock
  );
  lines.push(...buildEnrichmentExportScoreSectionLines(record));

  if (context.analystNotes) {
    lines.push("", `## ${ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING}`, "", context.analystNotes);
  }

  return lines.join("\n");
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function renderCsvRowTemplate(record: NormalizedEnrichmentRecord): string {
  const context = buildExportTemplateFieldContext(record);
  return [
    escapeCsvField(context.ioc),
    escapeCsvField(context.iocType),
    escapeCsvField(context.summary),
    escapeCsvField(context.scoreSummary),
    escapeCsvField(context.tags),
    escapeCsvField(context.sourcesBlock.replace(/\n/g, " | ")),
    escapeCsvField(context.analystNotes),
    escapeCsvField(context.exportedAt),
  ].join(",");
}

const CSV_HEADER =
  "ioc,ioc_type,summary,risk_score,tags,sources,analyst_notes,exported_at";

export function renderExportTemplate(
  templateId: ExportTemplateId,
  record: NormalizedEnrichmentRecord
): string {
  if (templateId === "markdown-report") {
    return buildEnrichmentExportMarkdown(record);
  }
  if (templateId === "csv-row") {
    return renderCsvRowTemplate(record);
  }

  const context = buildExportTemplateFieldContext(record);
  switch (templateId) {
    case "jira-comment":
      return renderJiraCommentTemplate(context);
    case "thehive-case-note":
      return renderTheHiveCaseNoteTemplate(context);
    case "analyst-update":
      return renderAnalystUpdateTemplate(context);
    case "obsidian-note":
      return renderObsidianNoteTemplate(record, context);
    default:
      return renderAnalystUpdateTemplate(context);
  }
}

export function renderTraySubsetExportTemplate(
  templateId: ExportTemplateId,
  records: readonly NormalizedEnrichmentRecord[]
): string {
  if (records.length === 0) {
    return "";
  }

  if (templateId === "csv-row") {
    return [CSV_HEADER, ...records.map((record) => renderCsvRowTemplate(record))].join(
      "\n"
    );
  }

  return records
    .map((record) => renderExportTemplate(templateId, record))
    .join(TRAY_SUBSET_TEMPLATE_SEPARATOR);
}

export function resolveExportTemplateMimeType(templateId: ExportTemplateId): string {
  if (templateId === "csv-row") {
    return "text/csv";
  }
  if (
    templateId === "obsidian-note" ||
    templateId === "markdown-report" ||
    templateId === "jira-comment"
  ) {
    return "text/markdown";
  }
  return "text/plain";
}

export function resolveExportTemplateFileExtension(
  templateId: ExportTemplateId
): string {
  if (templateId === "csv-row") {
    return "csv";
  }
  if (
    templateId === "obsidian-note" ||
    templateId === "markdown-report" ||
    templateId === "jira-comment"
  ) {
    return "md";
  }
  return "txt";
}

export function buildTrayTemplateExportFilename(
  templateId: ExportTemplateId,
  count: number,
  exportedAt: string
): string {
  const stamp = exportedAt.replace(/[:.]/g, "-");
  const extension = resolveExportTemplateFileExtension(templateId);
  return `vera5-tray-${templateId}-${count}-iocs-${stamp}.${extension}`;
}

export function downloadTrayTemplateExportFile(
  templateId: ExportTemplateId,
  records: readonly NormalizedEnrichmentRecord[],
  doc: Document = document
): void {
  if (records.length === 0) {
    return;
  }

  const exportedAt = records[0]?.exportedAt ?? new Date().toISOString();
  const content = renderTraySubsetExportTemplate(templateId, records);
  const blob = new Blob([content], {
    type: resolveExportTemplateMimeType(templateId),
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildTrayTemplateExportFilename(
    templateId,
    records.length,
    exportedAt
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function copyTrayTemplateExportToClipboard(
  templateId: ExportTemplateId,
  records: readonly NormalizedEnrichmentRecord[]
): Promise<boolean> {
  if (records.length === 0) {
    return false;
  }
  return copyTextToClipboard(renderTraySubsetExportTemplate(templateId, records));
}
