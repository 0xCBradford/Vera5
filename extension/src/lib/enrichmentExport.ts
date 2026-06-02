import type { IocType } from "./iocRegex";
import { getSessionAnalystNote } from "./analystNotesSession";
import { copyTextToClipboard } from "./copyText";import {
  buildDisabledSourcePlaceholders,
  formatEnrichmentSourceAttribution,
  resolveMultiSourceEnrichmentView,
  type EnrichmentSourceId,
  type HoverCardEnrichmentState,
  type HoverCardSourceEntry,
} from "./hoverCardEnrichment";
import { getPivotLinks, type PivotLink } from "./pivots";
import {
  COMPOSITE_SCORE_DISAGREEMENT_NOTICE,
  resolveHoverCardRiskScorePresentation,
  resolveRiskScoreReasoningPresentation,
  RISK_SCORE_REASONING_HEADING,
  RISK_SCORE_UNAVAILABLE_HEADLINE,
  type CompositeRiskLabel,
} from "./scoring";

export const ENRICHMENT_EXPORT_HEADING = "Vera5 IOC Summary";
export const ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING = "Source Summary";
export const ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING = "Analyst notes";
export const ENRICHMENT_EXPORT_SCHEMA_VERSION = 1;
export const ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL =
  "No enrichment source results are available to compute a local advisory score.";

const IOC_TYPE_LABELS: Record<IocType, string> = {
  ipv4: "IPv4 address",
  domain: "Domain",
  url: "URL",
  md5: "MD5 hash",
  sha1: "SHA1 hash",
  sha256: "SHA256 hash",
  cve: "CVE ID",
};

export function formatEnrichmentExportTypeLabel(type: IocType): string {
  return IOC_TYPE_LABELS[type];
}

export type NormalizedEnrichmentSource = {
  sourceId: EnrichmentSourceId;
  name: string;
  status: HoverCardSourceEntry["status"];
  summary: string;
  tags: readonly string[];
  fromCache?: boolean;
  lastUpdatedLine?: string;
  badgeText: string;
};

export type NormalizedEnrichmentRiskScore =
  | {
      mode: "unavailable";
      headline: string;
      detail: string;
      disagreement: false;
      reasoningLines: readonly string[];
    }
  | {
      mode: "insufficient";
      label: CompositeRiskLabel;
      summaryText: string;
      compositeSignal: number | null;
      disagreement: boolean;
      disagreementNotice?: string;
      reasoningLines: readonly string[];
      reasoningEmptyDetail?: string;
      insufficientDetail: string;
    }
  | {
      mode: "available";
      label: CompositeRiskLabel;
      summaryText: string;
      compositeSignal: number | null;
      disagreement: boolean;
      disagreementNotice?: string;
      reasoningLines: readonly string[];
      reasoningEmptyDetail?: string;
    };

export type NormalizedEnrichmentRecord = {
  ioc: string;
  iocType: IocType;
  iocTypeLabel: string;
  enrichmentState: HoverCardEnrichmentState;
  summary?: string;
  tags: readonly string[];
  sources: readonly NormalizedEnrichmentSource[];
  disabledSources: readonly EnrichmentSourceId[];
  riskScore: NormalizedEnrichmentRiskScore | null;
  analystNotes?: string;
  pivots: readonly PivotLink[];
  exportedAt: string;
};

export type EnrichmentExportJsonSource = {
  sourceId: EnrichmentSourceId;
  name: string;
  status: HoverCardSourceEntry["status"];
  summary: string;
  tags: string[];
  fromCache?: boolean;
  lastUpdatedLine?: string;
  badgeText: string;
};

export type EnrichmentExportJsonScore =
  | {
      mode: "unavailable";
      headline: string;
      detail: string;
    }
  | {
      mode: "none";
      headline: string;
      detail: string;
    }
  | {
      mode: "insufficient";
      label: CompositeRiskLabel;
      summaryText: string;
      compositeSignal: number | null;
      reasoningLines: string[];
      reasoningEmptyDetail?: string;
      insufficientDetail: string;
    }
  | {
      mode: "available";
      label: CompositeRiskLabel;
      summaryText: string;
      compositeSignal: number | null;
      reasoningLines: string[];
      reasoningEmptyDetail?: string;
    };

export type EnrichmentExportDocument = {
  schemaVersion: number;
  exportedAt: string;
  ioc: string;
  iocType: IocType;
  iocTypeLabel: string;
  enrichmentState: HoverCardEnrichmentState;
  summary?: string;
  tags: string[];
  sources: EnrichmentExportJsonSource[];
  disabledSources: EnrichmentSourceId[];
  score: EnrichmentExportJsonScore;
  disagreement: boolean;
  disagreementNotice?: string;
  pivots: readonly PivotLink[];
  analystNotes?: string;
};

export type NormalizeEnrichmentExportInput = {
  value: string;
  iocType: IocType;
  enrichmentState?: HoverCardEnrichmentState;
  summary?: string;
  tags?: readonly string[];
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
  analystNotes?: string;
  exportedAt?: string;
};

function resolveExportAnalystNotes(
  value: string,
  inputNote?: string
): string | undefined {
  const trimmedInput = inputNote?.trim();
  if (trimmedInput) {
    return trimmedInput;
  }
  const sessionNote = getSessionAnalystNote(value).trim();
  return sessionNote.length > 0 ? sessionNote : undefined;
}

function normalizeSources(  entries: readonly HoverCardSourceEntry[]
): NormalizedEnrichmentSource[] {
  return entries.map((entry) => ({
    sourceId: entry.sourceId,
    name: entry.label,
    status: entry.status,
    summary: entry.detail,
    tags: (entry.tags ?? [])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    fromCache: entry.fromCache,
    lastUpdatedLine: entry.lastUpdatedLine,
    badgeText: entry.badgeText,
  }));
}

function normalizeRiskScore(
  disabledSources: readonly EnrichmentSourceId[],
  sourceResults: readonly HoverCardSourceEntry[]
): NormalizedEnrichmentRiskScore | null {
  const presentation = resolveHoverCardRiskScorePresentation(
    disabledSources,
    sourceResults
  );
  if (!presentation) {
    return null;
  }

  if (presentation.mode === "unavailable") {
    return {
      mode: "unavailable",
      headline: presentation.headline,
      detail: presentation.detail,
      disagreement: false,
      reasoningLines: [],
    };
  }

  const reasoning = resolveRiskScoreReasoningPresentation(
    presentation.view,
    presentation.insufficientCompositeNotice
  );
  const reasoningLines =
    reasoning.mode === "chain" ? reasoning.chain.sourceLines : [];
  const reasoningEmptyDetail =
    reasoning.mode === "empty" ? reasoning.detail : undefined;
  const disagreement = presentation.view.score.disagreement;
  const disagreementNotice = disagreement
    ? COMPOSITE_SCORE_DISAGREEMENT_NOTICE
    : undefined;
  const base = {
    label: presentation.view.score.label,
    summaryText: presentation.view.summaryText,
    compositeSignal: presentation.view.score.compositeSignal,
    disagreement,
    disagreementNotice,
    reasoningLines,
    reasoningEmptyDetail,
  };

  if (presentation.insufficientCompositeNotice) {
    return {
      mode: "insufficient",
      ...base,
      insufficientDetail: presentation.insufficientCompositeNotice,
    };
  }

  return {
    mode: "available",
    ...base,
  };
}

export function buildNormalizedEnrichmentRecord(
  input: NormalizeEnrichmentExportInput
): NormalizedEnrichmentRecord {
  const sourceResults = input.sourceResults ?? [];
  const disabledSources = input.disabledSources ?? [];
  const resolvedView = resolveMultiSourceEnrichmentView(
    sourceResults.map((entry) => ({
      sourceId: entry.sourceId,
      sourceLabel: entry.label,
      status: entry.status,
      summary: entry.status === "ok" ? entry.detail : undefined,
      tags: entry.tags,
      fromCache: entry.fromCache,
      errorCode: entry.errorCode,
      errorMessage: entry.status === "error" ? entry.detail : undefined,
      retryHint: entry.retryHint,
      rawVendorJson: entry.rawVendorJson,
    }))
  );
  const enrichmentState =
    input.enrichmentState ?? resolvedView.enrichmentState;
  const summary = input.summary?.trim() || resolvedView.summary?.trim();
  const tags = (input.tags ?? resolvedView.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    ioc: input.value.trim(),
    iocType: input.iocType,
    iocTypeLabel: formatEnrichmentExportTypeLabel(input.iocType),
    enrichmentState,
    summary: summary || undefined,
    tags,
    sources: normalizeSources(sourceResults),
    disabledSources: [...disabledSources],
    riskScore: normalizeRiskScore(disabledSources, sourceResults),
    analystNotes: resolveExportAnalystNotes(input.value, input.analystNotes),
    pivots: getPivotLinks(input.iocType, input.value),
    exportedAt: input.exportedAt ?? new Date().toISOString(),
  };
}

export function hasEnrichmentExportRiskScoreData(
  riskScore: NormalizedEnrichmentRiskScore | null | undefined
): riskScore is
  | (NormalizedEnrichmentRiskScore & { mode: "available" })
  | (NormalizedEnrichmentRiskScore & { mode: "insufficient" }) {
  return riskScore?.mode === "available" || riskScore?.mode === "insufficient";
}

export function shouldRenderEnrichmentExportNoScoreSection(
  record: NormalizedEnrichmentRecord
): boolean {
  if (record.riskScore?.mode === "unavailable") {
    return true;
  }
  return record.riskScore === null;
}

export function buildEnrichmentExportNoScoreLines(
  record: NormalizedEnrichmentRecord
): string[] {
  if (record.riskScore?.mode === "unavailable") {
    return ["", record.riskScore.headline, "", record.riskScore.detail];
  }

  if (record.riskScore === null) {
    return [
      "",
      RISK_SCORE_UNAVAILABLE_HEADLINE,
      "",
      ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    ];
  }

  return [];
}

export function buildEnrichmentExportRiskScoreLines(
  record: NormalizedEnrichmentRecord
): string[] {
  const { riskScore } = record;
  if (!hasEnrichmentExportRiskScoreData(riskScore)) {
    return [];
  }

  const lines: string[] = ["", `Risk score: ${riskScore.summaryText}`];

  if (riskScore.mode === "insufficient") {
    lines.push("", riskScore.insufficientDetail);
  }

  lines.push("", `### ${RISK_SCORE_REASONING_HEADING}`, "");

  if (riskScore.reasoningLines.length > 0) {
    for (let index = 0; index < riskScore.reasoningLines.length; index += 1) {
      lines.push(`${index + 1}. ${riskScore.reasoningLines[index]}`);
    }
  } else if (riskScore.reasoningEmptyDetail) {
    lines.push(riskScore.reasoningEmptyDetail);
  }

  if (riskScore.disagreement && riskScore.disagreementNotice) {
    lines.push("", riskScore.disagreementNotice);
  }

  return lines;
}

export function buildEnrichmentExportScoreSectionLines(
  record: NormalizedEnrichmentRecord
): string[] {
  const scoreLines = buildEnrichmentExportRiskScoreLines(record);
  if (scoreLines.length > 0) {
    return scoreLines;
  }
  return buildEnrichmentExportNoScoreLines(record);
}

export function formatExportSourceSummaryLine(
  source: NormalizedEnrichmentSource
): string {
  let line = `- ${source.name} (${source.badgeText}): ${source.summary}`;
  if (source.tags.length > 0) {
    line += ` [${source.tags.join(", ")}]`;
  }
  if (source.lastUpdatedLine) {
    line += ` — ${source.lastUpdatedLine}`;
  }
  return line;
}

export function buildEnrichmentExportSourceAttributionLines(
  record: NormalizedEnrichmentRecord
): string[] {
  const lines: string[] = [];

  if (record.sources.length === 1) {
    const source = record.sources[0]!;
    lines.push(
      formatEnrichmentSourceAttribution(
        {
          sourceLabel: source.name,
          fromCache: source.fromCache,
        },
        record.enrichmentState
      )
    );
    if (source.summary) {
      lines.push(source.summary);
    }
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
    lines.push(`- ${placeholder.label}: ${placeholder.message}`);
  }

  if (lines.length === 0) {
    return [];
  }

  return [
    "",
    `### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`,
    "",
    ...lines,
  ];
}

export function buildEnrichmentExportAnalystNotesLines(
  record: NormalizedEnrichmentRecord
): string[] {
  if (!record.analystNotes) {
    return [];
  }

  return [
    "",
    `### ${ENRICHMENT_EXPORT_ANALYST_NOTES_HEADING}`,
    "",
    record.analystNotes,
  ];
}

export function buildEnrichmentExportMarkdown(
  record: NormalizedEnrichmentRecord
): string {
  const lines: string[] = [
    `## ${ENRICHMENT_EXPORT_HEADING}`,
    "",
    `IOC: ${record.ioc}`,
    `Type: ${record.iocTypeLabel}`,
  ];

  if (record.summary) {
    lines.push("", `Summary: ${record.summary}`);
  }

  if (record.tags.length > 0) {
    lines.push("", `Tags: ${record.tags.join(", ")}`);
  }

  lines.push(...buildEnrichmentExportScoreSectionLines(record));
  lines.push(...buildEnrichmentExportSourceAttributionLines(record));
  lines.push(...buildEnrichmentExportAnalystNotesLines(record));
  lines.push("");
  return lines.join("\n");
}

export function buildEnrichmentExportJsonSources(
  record: NormalizedEnrichmentRecord
): EnrichmentExportJsonSource[] {
  return record.sources.map((source) => ({
    sourceId: source.sourceId,
    name: source.name,
    status: source.status,
    summary: source.summary,
    tags: [...source.tags],
    fromCache: source.fromCache,
    lastUpdatedLine: source.lastUpdatedLine,
    badgeText: source.badgeText,
  }));
}

export function buildEnrichmentExportJsonScore(
  record: NormalizedEnrichmentRecord
): EnrichmentExportJsonScore {
  const { riskScore } = record;
  if (!riskScore) {
    return {
      mode: "none",
      headline: RISK_SCORE_UNAVAILABLE_HEADLINE,
      detail: ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    };
  }

  if (riskScore.mode === "unavailable") {
    return {
      mode: "unavailable",
      headline: riskScore.headline,
      detail: riskScore.detail,
    };
  }

  if (riskScore.mode === "insufficient") {
    return {
      mode: "insufficient",
      label: riskScore.label,
      summaryText: riskScore.summaryText,
      compositeSignal: riskScore.compositeSignal,
      reasoningLines: [...riskScore.reasoningLines],
      reasoningEmptyDetail: riskScore.reasoningEmptyDetail,
      insufficientDetail: riskScore.insufficientDetail,
    };
  }

  return {
    mode: "available",
    label: riskScore.label,
    summaryText: riskScore.summaryText,
    compositeSignal: riskScore.compositeSignal,
    reasoningLines: [...riskScore.reasoningLines],
    reasoningEmptyDetail: riskScore.reasoningEmptyDetail,
  };
}

export function resolveEnrichmentExportDisagreement(
  record: NormalizedEnrichmentRecord
): { disagreement: boolean; disagreementNotice?: string } {
  if (!hasEnrichmentExportRiskScoreData(record.riskScore)) {
    return { disagreement: false };
  }

  return {
    disagreement: record.riskScore.disagreement,
    disagreementNotice: record.riskScore.disagreementNotice,
  };
}

export function buildEnrichmentExportDocument(
  record: NormalizedEnrichmentRecord
): EnrichmentExportDocument {
  const disagreementFields = resolveEnrichmentExportDisagreement(record);
  const document: EnrichmentExportDocument = {
    schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
    exportedAt: record.exportedAt,
    ioc: record.ioc,
    iocType: record.iocType,
    iocTypeLabel: record.iocTypeLabel,
    enrichmentState: record.enrichmentState,
    summary: record.summary,
    tags: [...record.tags],
    sources: buildEnrichmentExportJsonSources(record),
    disabledSources: [...record.disabledSources],
    score: buildEnrichmentExportJsonScore(record),
    disagreement: disagreementFields.disagreement,
    disagreementNotice: disagreementFields.disagreementNotice,
    pivots: record.pivots,
  };

  if (record.analystNotes) {
    document.analystNotes = record.analystNotes;
  }

  return document;
}

export function serializeEnrichmentExportJson(
  record: NormalizedEnrichmentRecord,
  pretty = true
): string {
  return JSON.stringify(
    buildEnrichmentExportDocument(record),
    null,
    pretty ? 2 : undefined
  );
}

export async function copyEnrichmentExportJsonToClipboard(
  record: NormalizedEnrichmentRecord
): Promise<boolean> {
  return copyTextToClipboard(serializeEnrichmentExportJson(record));
}

export async function copyEnrichmentExportMarkdownToClipboard(
  record: NormalizedEnrichmentRecord
): Promise<boolean> {
  return copyTextToClipboard(buildEnrichmentExportMarkdown(record));
}

export function buildEnrichmentExportTxt(
  record: NormalizedEnrichmentRecord
): string {
  return buildEnrichmentExportMarkdown(record)
    .replace(/^## /gm, "")
    .replace(/^### /gm, "");
}

export async function copyEnrichmentExportTxtToClipboard(
  record: NormalizedEnrichmentRecord
): Promise<boolean> {
  return copyTextToClipboard(buildEnrichmentExportTxt(record));
}

export type EnrichmentExportFileFormat = "markdown" | "json" | "txt";

function sanitizeEnrichmentExportFilename(ioc: string): string {
  const sanitized = ioc.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized.slice(0, 80) : "ioc";
}

export function buildEnrichmentExportFilename(
  record: NormalizedEnrichmentRecord,
  format: EnrichmentExportFileFormat
): string {
  const extension =
    format === "markdown" ? "md" : format === "json" ? "json" : "txt";
  const stamp = record.exportedAt.replace(/[:.]/g, "-");
  return `vera5-${sanitizeEnrichmentExportFilename(record.ioc)}-${stamp}.${extension}`;
}

function resolveEnrichmentExportFileContent(
  record: NormalizedEnrichmentRecord,
  format: EnrichmentExportFileFormat
): { content: string; mimeType: string } {
  if (format === "json") {
    return {
      content: serializeEnrichmentExportJson(record),
      mimeType: "application/json",
    };
  }
  if (format === "markdown") {
    return {
      content: buildEnrichmentExportMarkdown(record),
      mimeType: "text/markdown",
    };
  }
  return {
    content: buildEnrichmentExportTxt(record),
    mimeType: "text/plain",
  };
}

export function downloadEnrichmentExportFile(
  record: NormalizedEnrichmentRecord,
  format: EnrichmentExportFileFormat,
  doc: Document = document
): void {
  const { content, mimeType } = resolveEnrichmentExportFileContent(record, format);
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildEnrichmentExportFilename(record, format);
  anchor.click();
  URL.revokeObjectURL(url);
}
