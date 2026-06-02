import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import type { IocType } from "../lib/iocRegex";
import { safeRuntimeSendMessage } from "../lib/extensionContext";
import { sanitizeEnrichmentIoc } from "../lib/iocRequestBoundaries";

const ENRICH_IOC_MESSAGE_TYPE = "ENRICH_IOC";

export type ContentEnrichmentSourceResult = {
  sourceId: string;
  sourceLabel: string;
  status: "ok" | "error" | "skipped";
  summary?: string;
  tags?: readonly string[];
  fromCache?: boolean;
  fetchedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryHint?: string;
  rawVendorJson?: string;
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
  if (record.rawVendorJson !== undefined && typeof record.rawVendorJson !== "string") {
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
  if (typeof record.fetchedAt === "string" && record.fetchedAt.trim()) {
    parsed.fetchedAt = record.fetchedAt.trim();
  }
  if (record.errorCode) {
    parsed.errorCode = record.errorCode;
  }
  if (record.retryHint) {
    parsed.retryHint = record.retryHint;
  }
  const rawVendorJson = record.rawVendorJson?.trim();
  if (rawVendorJson) {
    parsed.rawVendorJson = rawVendorJson;
  }
  return parsed;
}

type MessageResponse =
  | { ok: true; payload?: unknown }
  | { ok: false; error: string };

function parseContentEnrichmentSourceResults(
  value: unknown
): ContentEnrichmentSourceResult[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed: ContentEnrichmentSourceResult[] = [];
  for (const entry of value) {
    const source = parseContentEnrichmentSourceResult(entry);
    if (source) {
      parsed.push(source);
    }
  }
  return parsed;
}

export type ContentEnrichmentFetchResult = {
  sources: ContentEnrichmentSourceResult[];
  primary: ContentEnrichmentSourceResult | null;
};

export async function requestEnrichmentFromServiceWorker(
  input: {
    value: string;
    iocType: IocType;
    sourceId?: EnrichmentSourceId;
    bypassCache?: boolean;
  }
): Promise<ContentEnrichmentFetchResult | null> {
  const sanitized = sanitizeEnrichmentIoc({
    value: input.value,
    type: input.iocType,
  });
  if (!sanitized) {
    return null;
  }

  const message: Record<string, unknown> = {
    type: ENRICH_IOC_MESSAGE_TYPE,
    value: sanitized.value,
    iocType: sanitized.type,
  };
  if (input.sourceId) {
    message.sourceId = input.sourceId;
  }
  if (input.bypassCache === true) {
    message.bypassCache = true;
  }

  const response = (await safeRuntimeSendMessage(message)) as MessageResponse | null;

  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const payload = response.payload as Record<string, unknown>;
  const sources = parseContentEnrichmentSourceResults(payload.sources);
  if (sources.length === 0) {
    const single = parseContentEnrichmentSourceResult(payload.source);
    if (!single) {
      return null;
    }
    return { sources: [single], primary: single };
  }
  const primary =
    parseContentEnrichmentSourceResult(payload.source) ?? sources[0] ?? null;
  return { sources, primary };
}
