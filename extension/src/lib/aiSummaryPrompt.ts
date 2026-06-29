import {
  ENRICHMENT_EXPORT_SCHEMA_VERSION,
  type EnrichmentExportDocument,
} from "./enrichmentExport";

import enrichmentSummaryPromptV1 from "../../prompts/enrichment-summary.v1.json";

export type EnrichmentSummaryPromptTemplate = {
  promptTemplateVersion: number;
  compatibleEnrichmentExportSchemaVersion: number;
  description: string;
  allowedPlaceholders: readonly string[];
  forbiddenPromptContent: readonly string[];
  system: string;
  user: string;
};

export const ENRICHMENT_SUMMARY_PROMPT_TEMPLATE_V1 =
  enrichmentSummaryPromptV1 as EnrichmentSummaryPromptTemplate;

export const ENRICHMENT_SUMMARY_PROMPT_PLACEHOLDER = "ENRICHMENT_EXPORT_JSON";

export const FORBIDDEN_ENRICHMENT_SUMMARY_EXPORT_KEYS = [
  "apiKeys",
  "rawVendorJson",
  "html",
  "dom",
  "pageText",
  "storage",
] as const;

export class AiSummaryInputRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSummaryInputRejectedError";
  }
}

export function assertEnrichmentSummaryExportInput(
  document: EnrichmentExportDocument
): void {
  if (document.schemaVersion !== ENRICHMENT_EXPORT_SCHEMA_VERSION) {
    throw new AiSummaryInputRejectedError(
      "Enrichment summary requires export schemaVersion 1."
    );
  }

  if (document.enrichmentState !== "ready") {
    throw new AiSummaryInputRejectedError(
      "Enrichment summary requires enrichmentState ready."
    );
  }

  const record = document as EnrichmentExportDocument & Record<string, unknown>;
  for (const key of FORBIDDEN_ENRICHMENT_SUMMARY_EXPORT_KEYS) {
    if (key in record) {
      throw new AiSummaryInputRejectedError(
        `Enrichment summary rejects forbidden export field: ${key}.`
      );
    }
  }

  if (
    ENRICHMENT_SUMMARY_PROMPT_TEMPLATE_V1.compatibleEnrichmentExportSchemaVersion !==
    ENRICHMENT_EXPORT_SCHEMA_VERSION
  ) {
    throw new AiSummaryInputRejectedError(
      "Enrichment summary prompt template is incompatible with export schema."
    );
  }
}

export function buildEnrichmentSummaryPromptMessages(
  exportDocument: EnrichmentExportDocument,
  template: EnrichmentSummaryPromptTemplate = ENRICHMENT_SUMMARY_PROMPT_TEMPLATE_V1
): { system: string; user: string } {
  assertEnrichmentSummaryExportInput(exportDocument);

  const placeholder = `{{${ENRICHMENT_SUMMARY_PROMPT_PLACEHOLDER}}}`;
  if (!template.user.includes(placeholder)) {
    throw new AiSummaryInputRejectedError(
      "Enrichment summary prompt template is missing the export JSON placeholder."
    );
  }

  const exportJson = JSON.stringify(exportDocument);
  return {
    system: template.system,
    user: template.user.replace(placeholder, exportJson),
  };
}
