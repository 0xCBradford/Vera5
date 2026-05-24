import type { IocType } from "../lib/iocRegex";
import { sanitizeEnrichmentIoc } from "../lib/iocRequestBoundaries";

const ENRICH_IOC_MESSAGE_TYPE = "ENRICH_IOC";
const DEFAULT_ENRICHMENT_SOURCE_ID = "abuseipdb";

export type ContentEnrichmentSourceResult = {
  sourceId: string;
  sourceLabel: string;
  status: "ok" | "error" | "skipped";
  summary?: string;
  tags?: readonly string[];
  fromCache?: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryHint?: string;
};

function normalizeContentTags(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return tags.length > 0 ? tags : undefined;
}

function isContentEnrichmentSourceResult(
  value: unknown
): value is ContentEnrichmentSourceResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.sourceId !== "string" ||
    typeof record.sourceLabel !== "string" ||
    (record.status !== "ok" &&
      record.status !== "error" &&
      record.status !== "skipped")
  ) {
    return false;
  }
  if (record.summary !== undefined && typeof record.summary !== "string") {
    return false;
  }
  if (record.tags !== undefined && normalizeContentTags(record.tags) === undefined) {
    return false;
  }
  if (record.errorMessage !== undefined && typeof record.errorMessage !== "string") {
    return false;
  }
  if (record.fromCache !== undefined && typeof record.fromCache !== "boolean") {
    return false;
  }
  if (record.errorCode !== undefined && typeof record.errorCode !== "string") {
    return false;
  }
  if (record.retryHint !== undefined && typeof record.retryHint !== "string") {
    return false;
  }
  return true;
}

function parseContentEnrichmentSourceResult(
  value: unknown
): ContentEnrichmentSourceResult | null {
  if (!isContentEnrichmentSourceResult(value)) {
    return null;
  }
  const record = value as ContentEnrichmentSourceResult;
  const parsed: ContentEnrichmentSourceResult = {
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    status: record.status,
  };
  if (record.summary) {
    parsed.summary = record.summary;
  }
  const tags = normalizeContentTags(record.tags);
  if (tags) {
    parsed.tags = tags;
  }
  if (record.errorMessage) {
    parsed.errorMessage = record.errorMessage;
  }
  if (record.fromCache === true) {
    parsed.fromCache = true;
  }
  if (record.errorCode) {
    parsed.errorCode = record.errorCode;
  }
  if (record.retryHint) {
    parsed.retryHint = record.retryHint;
  }
  return parsed;
}

type MessageResponse =
  | { ok: true; payload?: unknown }
  | { ok: false; error: string };

export async function requestEnrichmentFromServiceWorker(input: {
  value: string;
  iocType: IocType;
}): Promise<ContentEnrichmentSourceResult | null> {
  const sanitized = sanitizeEnrichmentIoc({
    value: input.value,
    type: input.iocType,
  });
  if (!sanitized) {
    return null;
  }

  const response = (await chrome.runtime.sendMessage({
    type: ENRICH_IOC_MESSAGE_TYPE,
    value: sanitized.value,
    iocType: sanitized.type,
    sourceId: DEFAULT_ENRICHMENT_SOURCE_ID,
  })) as MessageResponse;

  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const payload = response.payload as Record<string, unknown>;
  return parseContentEnrichmentSourceResult(payload.source);
}
