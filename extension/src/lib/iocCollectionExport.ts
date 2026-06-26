import type { NormalizedEnrichmentRecord } from "./enrichmentExport";
import {
  buildInvestigationSessionExportEnrichmentSectionLines,
  buildInvestigationSessionExportIocTableLines,
  buildInvestigationSessionExportSourceAttributionLines,
  containsInvestigationSessionExportSecrets,
  formatInvestigationSessionExportTimestamp,
  sanitizeInvestigationSessionExportRecord,
  sanitizeInvestigationSessionExportText,
} from "./investigationSessionExport";
import { renderTraySubsetExportTemplate } from "./exportTemplates";
import {
  buildInvestigationSessionTypeBreakdownText,
} from "./investigationSession";
import {
  buildIocCollectionMemberCountText,
  countIocCollectionMembersByType,
  normalizeIocCollectionDescription,
  type IocCollection,
  type IocCollectionMember,
} from "./iocCollection";
import { buildIocValueEnrichmentRecords } from "./tabScanSummary";
import type { IocType } from "./iocRegex";

export const IOC_COLLECTION_EXPORT_HEADING = "IOC Collection Export";
export const IOC_COLLECTION_EXPORT_SUMMARY_HEADING = "Collection summary";
export const IOC_COLLECTION_EXPORT_MARKDOWN_LABEL = "Export Markdown";
export const IOC_COLLECTION_EXPORT_JSON_LABEL = "Export JSON";
export const IOC_COLLECTION_EXPORT_CSV_LABEL = "Export CSV";
export const IOC_COLLECTION_EXPORT_SCHEMA_VERSION = 1;

export type IocCollectionExportFormat = "markdown" | "json" | "csv";

export type IocCollectionExportInput = {
  collection: IocCollection;
  records: readonly NormalizedEnrichmentRecord[];
  exportedAt?: string;
};

export type IocCollectionExportMetadata = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  memberCountByType: Partial<Record<IocType, number>>;
  description?: string;
};

export type IocCollectionExportDocument = {
  schemaVersion: typeof IOC_COLLECTION_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  collection: IocCollectionExportMetadata;
  members: IocCollectionMember[];
};

function sanitizeIocCollectionExportInput(
  input: IocCollectionExportInput
): IocCollectionExportInput {
  const normalizedDescription = normalizeIocCollectionDescription(
    input.collection.description
  );
  const description =
    normalizedDescription !== undefined
      ? sanitizeInvestigationSessionExportText(normalizedDescription)
      : undefined;
  const collection: IocCollection = {
    ...input.collection,
  };
  if (description !== undefined) {
    collection.description = description;
  } else {
    delete collection.description;
  }

  return {
    ...input,
    collection,
    records: input.records.map(sanitizeInvestigationSessionExportRecord),
  };
}

function resolveIocCollectionExportInput(
  input: IocCollectionExportInput
): IocCollectionExportInput {
  return sanitizeIocCollectionExportInput(input);
}

export function buildIocCollectionExportMetadata(
  collection: IocCollection
): IocCollectionExportMetadata {
  const metadata: IocCollectionExportMetadata = {
    id: collection.id,
    name: collection.name,
    createdAt: formatInvestigationSessionExportTimestamp(collection.createdAt),
    updatedAt: formatInvestigationSessionExportTimestamp(collection.updatedAt),
    memberCount: collection.members.length,
    memberCountByType: countIocCollectionMembersByType(collection.members),
  };

  if (collection.description) {
    metadata.description = collection.description;
  }

  return metadata;
}

export function buildIocCollectionExportSummaryLines(
  collection: IocCollection,
  exportedAt: string
): string[] {
  const memberCountByType = countIocCollectionMembersByType(collection.members);
  const lines = [
    `# ${IOC_COLLECTION_EXPORT_HEADING}`,
    "",
    `## ${IOC_COLLECTION_EXPORT_SUMMARY_HEADING}`,
    "",
    `- **Name:** ${collection.name}`,
    `- **Created:** ${formatInvestigationSessionExportTimestamp(collection.createdAt)}`,
    `- **Updated:** ${formatInvestigationSessionExportTimestamp(collection.updatedAt)}`,
    `- **Exported:** ${exportedAt}`,
    `- **Indicators:** ${buildIocCollectionMemberCountText(collection.members.length)}`,
  ];

  const typeBreakdown = buildInvestigationSessionTypeBreakdownText({
    totalIocCount: collection.members.length,
    iocCountByType: memberCountByType,
  });
  if (typeBreakdown) {
    lines.push(`- **By type:** ${typeBreakdown}`);
  }

  if (collection.description) {
    lines.push(`- **Description:** ${collection.description}`);
  }

  return lines;
}

export function buildIocCollectionExportMarkdown(
  input: IocCollectionExportInput
): string {
  const sanitized = resolveIocCollectionExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const lines = [
    ...buildIocCollectionExportSummaryLines(sanitized.collection, exportedAt),
    ...buildInvestigationSessionExportIocTableLines(sanitized.records),
    ...buildInvestigationSessionExportEnrichmentSectionLines(sanitized.records),
    ...buildInvestigationSessionExportSourceAttributionLines(sanitized.records),
    "",
  ];
  return lines.join("\n");
}

export function buildIocCollectionExportDocument(
  input: IocCollectionExportInput
): IocCollectionExportDocument {
  const sanitized = resolveIocCollectionExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  return {
    schemaVersion: IOC_COLLECTION_EXPORT_SCHEMA_VERSION,
    exportedAt,
    collection: buildIocCollectionExportMetadata(sanitized.collection),
    members: sanitized.collection.members.map((member) => ({
      iocType: member.iocType,
      value: member.value,
    })),
  };
}

export function serializeIocCollectionExportJson(
  input: IocCollectionExportInput,
  pretty = true
): string {
  return JSON.stringify(
    buildIocCollectionExportDocument(input),
    null,
    pretty ? 2 : undefined
  );
}

export function buildIocCollectionExportCsv(input: IocCollectionExportInput): string {
  const sanitized = resolveIocCollectionExportInput(input);
  return renderTraySubsetExportTemplate("csv-row", sanitized.records);
}

export function buildIocCollectionExportFilename(
  collection: Pick<IocCollection, "name">,
  exportedAt: string = new Date().toISOString(),
  format: IocCollectionExportFormat = "markdown"
): string {
  const slug =
    collection.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ioc-collection";
  const extension = format === "json" ? "json" : format === "csv" ? "csv" : "md";
  return `vera5-collection-${slug}-${exportedAt.slice(0, 10)}.${extension}`;
}

export async function buildIocCollectionExportInput(input: {
  collection: IocCollection;
  exportedAt?: string;
}): Promise<IocCollectionExportInput> {
  const records = await buildIocValueEnrichmentRecords(
    input.collection.members.map((member) => ({
      iocType: member.iocType,
      value: member.value,
    }))
  );

  return {
    collection: input.collection,
    records,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
  };
}

export function downloadIocCollectionExportMarkdownFile(
  input: IocCollectionExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = buildIocCollectionExportMarkdown({ ...input, exportedAt });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildIocCollectionExportFilename(input.collection, exportedAt);
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadIocCollectionExportJsonFile(
  input: IocCollectionExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = serializeIocCollectionExportJson({ ...input, exportedAt });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildIocCollectionExportFilename(
    input.collection,
    exportedAt,
    "json"
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadIocCollectionExportCsvFile(
  input: IocCollectionExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = buildIocCollectionExportCsv({ ...input, exportedAt });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildIocCollectionExportFilename(
    input.collection,
    exportedAt,
    "csv"
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function formatIocCollectionExportMarkdownFeedback(input: {
  collectionName: string;
  success: boolean;
}): string {
  if (input.success) {
    return `Downloaded Markdown export for ${input.collectionName}.`;
  }
  return `Could not export ${input.collectionName} as Markdown.`;
}

export function formatIocCollectionExportJsonFeedback(input: {
  collectionName: string;
  success: boolean;
}): string {
  if (input.success) {
    return `Downloaded JSON export for ${input.collectionName}.`;
  }
  return `Could not export ${input.collectionName} as JSON.`;
}

export function formatIocCollectionExportCsvFeedback(input: {
  collectionName: string;
  success: boolean;
}): string {
  if (input.success) {
    return `Downloaded CSV export for ${input.collectionName}.`;
  }
  return `Could not export ${input.collectionName} as CSV.`;
}

export { containsInvestigationSessionExportSecrets as containsIocCollectionExportSecrets };
