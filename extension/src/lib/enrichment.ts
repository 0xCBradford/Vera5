import type {
  EnrichmentAssessmentKind,
  EnrichmentSourceAssessment,
  EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";

const ENRICHMENT_RESULT_SOURCE_LABELS: Record<EnrichmentSourceId, string> = {
  abuseipdb: "AbuseIPDB",
  otx: "OTX",
  virustotal: "VirusTotal",
  urlscan: "URLScan.io",
  greynoise: "GreyNoise",
  shodan: "Shodan",
  google_safe_browsing: "Google Safe Browsing",
  pulsedive: "Pulsedive",
  malwarebazaar: "MalwareBazaar",
  censys: "Censys",
  threatfox: "ThreatFox",
  urlhaus: "URLHaus",
  rdap_whois: "RDAP/WHOIS",
};

export const ENRICHMENT_SOURCE_STATUS = {
  OK: "ok",
  ERROR: "error",
  SKIPPED: "skipped",
} as const;

export type EnrichmentSourceStatus =
  (typeof ENRICHMENT_SOURCE_STATUS)[keyof typeof ENRICHMENT_SOURCE_STATUS];

export const ENRICHMENT_ERROR_CODE = {
  MISSING_KEY: "missing_key",
  UNAUTHORIZED: "unauthorized",
  RATE_LIMITED: "rate_limited",
  TIMEOUT: "timeout",
  UNSUPPORTED_TYPE: "unsupported_type",
  NETWORK: "network_error",
  DISABLED: "disabled",
  DOMAIN_POLICY: "domain_policy",
  INTERNAL_ASSET: "internal_asset",
  QUIET_MODE: "quiet_mode",
  KNOWN_GOOD_POLICY: "known_good_policy",
  DISCLOSURE_DECLINED: "disclosure_declined",
  VENDOR: "vendor_error",
} as const;

export type EnrichmentErrorCode =
  (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];

export type EnrichmentSourceResult = {
  sourceId: EnrichmentSourceId;
  sourceLabel: string;
  status: EnrichmentSourceStatus;
  summary?: string;
  tags?: readonly string[];
  assessment?: EnrichmentSourceAssessment;
  errorCode?: EnrichmentErrorCode;
  errorMessage?: string;
  retryHint?: string;
  fetchedAt?: string;
  fromCache?: boolean;
  rawVendorJson?: string;
};

export type EnrichmentResult = {
  ioc: string;
  type: IocType;
  sources: EnrichmentSourceResult[];
  cached: boolean;
  lastUpdated: string;
};

export type EnrichmentIoc = {
  value: string;
  type: IocType;
};

export const CONNECTOR_HEALTH_STATUS = {
  OK: "ok",
  ERROR: "error",
} as const;

export type ConnectorHealthStatus =
  (typeof CONNECTOR_HEALTH_STATUS)[keyof typeof CONNECTOR_HEALTH_STATUS];

export type ConnectorHealthCheckResult = {
  status: ConnectorHealthStatus;
  message?: string;
};

export type EnrichmentConnector = {
  name: EnrichmentSourceId;
  enrich(ioc: EnrichmentIoc): Promise<EnrichmentSourceResult>;
  healthCheck?(): Promise<ConnectorHealthCheckResult>;
};

const CONNECTOR_HEALTH_STATUS_SET = new Set<string>(Object.values(CONNECTOR_HEALTH_STATUS));

export function isEnrichmentIoc(value: unknown): value is EnrichmentIoc {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.value) &&
    typeof record.type === "string" &&
    IOC_TYPE_SET.has(record.type)
  );
}

export function isConnectorHealthCheckResult(value: unknown): value is ConnectorHealthCheckResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.status !== "string" || !CONNECTOR_HEALTH_STATUS_SET.has(record.status)) {
    return false;
  }
  if (record.message !== undefined && typeof record.message !== "string") {
    return false;
  }
  return true;
}

export function isEnrichmentConnector(value: unknown): value is EnrichmentConnector {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || typeof record.enrich !== "function") {
    return false;
  }
  if (record.healthCheck !== undefined && typeof record.healthCheck !== "function") {
    return false;
  }
  return true;
}

export async function runConnectorHealthCheck(
  connector: EnrichmentConnector
): Promise<ConnectorHealthCheckResult> {
  if (typeof connector.healthCheck !== "function") {
    return { status: CONNECTOR_HEALTH_STATUS.OK };
  }
  const result = await connector.healthCheck();
  if (!isConnectorHealthCheckResult(result)) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "Health check returned an invalid result.",
    };
  }
  return result;
}

const ENRICHMENT_SOURCE_STATUS_SET = new Set<string>(Object.values(ENRICHMENT_SOURCE_STATUS));

const ENRICHMENT_ERROR_CODE_SET = new Set<string>(Object.values(ENRICHMENT_ERROR_CODE));

const ENRICHMENT_ASSESSMENT_KIND_SET = new Set<string>(["risk", "exposure", "context"]);

const IOC_TYPE_SET = new Set<string>(Object.values(IOC_TYPE));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIso8601Timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function normalizeStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return tags.length > 0 ? tags : undefined;
}

export function isEnrichmentSourceStatus(value: unknown): value is EnrichmentSourceStatus {
  return typeof value === "string" && ENRICHMENT_SOURCE_STATUS_SET.has(value);
}

export function isEnrichmentErrorCode(value: unknown): value is EnrichmentErrorCode {
  return typeof value === "string" && ENRICHMENT_ERROR_CODE_SET.has(value);
}

export function isEnrichmentAssessmentKind(value: unknown): value is EnrichmentAssessmentKind {
  return typeof value === "string" && ENRICHMENT_ASSESSMENT_KIND_SET.has(value);
}

export function isEnrichmentSourceAssessment(value: unknown): value is EnrichmentSourceAssessment {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    !isEnrichmentAssessmentKind(record.kind) ||
    !isNonEmptyString(record.verdict) ||
    !Array.isArray(record.evidence) ||
    record.evidence.length === 0 ||
    record.evidence.some((entry) => !isNonEmptyString(entry))
  ) {
    return false;
  }
  return (
    record.signal === undefined ||
    (typeof record.signal === "number" &&
      Number.isFinite(record.signal) &&
      record.signal >= 0 &&
      record.signal <= 100)
  );
}

export function normalizeEnrichmentSourceAssessment(
  value: unknown
): EnrichmentSourceAssessment | null {
  if (!isEnrichmentSourceAssessment(value)) {
    return null;
  }
  return {
    kind: value.kind,
    ...(value.signal === undefined ? {} : { signal: Math.round(value.signal) }),
    verdict: value.verdict.trim(),
    evidence: value.evidence.map((entry) => entry.trim()),
  };
}

export function isEnrichmentSourceResult(value: unknown): value is EnrichmentSourceResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.sourceId !== "string" ||
    typeof record.sourceLabel !== "string" ||
    !isEnrichmentSourceStatus(record.status)
  ) {
    return false;
  }
  if (record.summary !== undefined && typeof record.summary !== "string") {
    return false;
  }
  if (record.tags !== undefined && normalizeStringArray(record.tags) === undefined) {
    return false;
  }
  if (record.assessment !== undefined && !isEnrichmentSourceAssessment(record.assessment)) {
    return false;
  }
  if (record.errorCode !== undefined && !isEnrichmentErrorCode(record.errorCode)) {
    return false;
  }
  if (record.errorMessage !== undefined && typeof record.errorMessage !== "string") {
    return false;
  }
  if (record.retryHint !== undefined && typeof record.retryHint !== "string") {
    return false;
  }
  if (record.fetchedAt !== undefined && !isIso8601Timestamp(record.fetchedAt)) {
    return false;
  }
  if (record.fromCache !== undefined && typeof record.fromCache !== "boolean") {
    return false;
  }
  if (record.rawVendorJson !== undefined && typeof record.rawVendorJson !== "string") {
    return false;
  }
  return true;
}

export function isEnrichmentResult(value: unknown): value is EnrichmentResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    !isNonEmptyString(record.ioc) ||
    typeof record.type !== "string" ||
    !IOC_TYPE_SET.has(record.type) ||
    typeof record.cached !== "boolean" ||
    !isIso8601Timestamp(record.lastUpdated) ||
    !Array.isArray(record.sources)
  ) {
    return false;
  }
  return record.sources.every((entry) => isEnrichmentSourceResult(entry));
}

export function normalizeEnrichmentSourceResult(value: unknown): EnrichmentSourceResult | null {
  if (!isEnrichmentSourceResult(value)) {
    return null;
  }
  const record = value as EnrichmentSourceResult;
  const normalized: EnrichmentSourceResult = {
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel.trim(),
    status: record.status,
  };
  const summary = record.summary?.trim();
  if (summary) {
    normalized.summary = summary;
  }
  const tags = normalizeStringArray(record.tags);
  if (tags) {
    normalized.tags = tags;
  }
  const assessment = normalizeEnrichmentSourceAssessment(record.assessment);
  if (assessment) {
    normalized.assessment = assessment;
  }
  if (record.errorCode) {
    normalized.errorCode = record.errorCode;
  }
  const errorMessage = record.errorMessage?.trim();
  if (errorMessage) {
    normalized.errorMessage = errorMessage;
  }
  const retryHint = record.retryHint?.trim();
  if (retryHint) {
    normalized.retryHint = retryHint;
  }
  if (record.fetchedAt) {
    normalized.fetchedAt = record.fetchedAt;
  }
  if (record.fromCache === true) {
    normalized.fromCache = true;
  }
  const rawVendorJson = record.rawVendorJson?.trim();
  if (rawVendorJson) {
    normalized.rawVendorJson = rawVendorJson;
  }
  return normalized;
}

export function normalizeEnrichmentResult(value: unknown): EnrichmentResult | null {
  if (!isEnrichmentResult(value)) {
    return null;
  }
  const record = value as EnrichmentResult;
  const sources = record.sources
    .map((entry) => normalizeEnrichmentSourceResult(entry))
    .filter((entry): entry is EnrichmentSourceResult => entry !== null);
  return {
    ioc: record.ioc.trim(),
    type: record.type,
    sources,
    cached: record.cached,
    lastUpdated: record.lastUpdated,
  };
}

function clampAssessmentSignal(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function reportCountAssessmentSignal(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 22;
  if (count <= 3) return 38;
  if (count <= 8) return 54;
  if (count <= 20) return 68;
  if (count <= 45) return 82;
  return Math.min(100, 88 + Math.floor((count - 45) / 30));
}

function pulseCountAssessmentSignal(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 26;
  if (count <= 4) return 42;
  if (count <= 12) return 56;
  if (count <= 35) return 71;
  return Math.min(100, 78 + Math.min(22, Math.floor((count - 35) / 8)));
}

function parseFirstSummaryCount(summary: string): number | null {
  const match = /^(\d+)/.exec(summary);
  return match ? Number(match[1]) : null;
}

function presentationRiskSignal(
  sourceId: EnrichmentSourceId,
  summary: string,
  tags: readonly string[]
): number | null {
  const lower = summary.trim().toLowerCase();
  const count = parseFirstSummaryCount(summary);
  if (sourceId === "abuseipdb") {
    if (lower.endsWith(" abuse confidence") && count !== null) {
      return clampAssessmentSignal(count);
    }
    if (lower.endsWith(" reports") && count !== null) {
      return reportCountAssessmentSignal(count);
    }
  }
  if (sourceId === "otx" && lower.includes("threat pulse") && count !== null) {
    return pulseCountAssessmentSignal(count);
  }
  if (sourceId === "virustotal") {
    if (lower === "no vendor detections recorded") return 5;
    if (lower.includes("malicious detection") && count !== null) {
      return clampAssessmentSignal(45 + count * 8);
    }
    if (lower.includes("suspicious detection") && count !== null) {
      return clampAssessmentSignal(28 + count * 6);
    }
    if (lower.includes("harmless detection")) return 8;
  }
  if (sourceId === "urlscan" && lower.includes("urlscan result") && count !== null) {
    return tags.some((tag) => tag.toLowerCase() === "malicious")
      ? 78
      : reportCountAssessmentSignal(count);
  }
  if (sourceId === "greynoise") {
    if (lower === "benign riot service") return 8;
    if (lower === "not observed in greynoise") return 5;
    if (lower.startsWith("malicious")) return 72;
    if (lower.startsWith("benign")) return 12;
    if (lower.startsWith("unknown")) return 45;
  }
  return null;
}

function presentationAssessmentVerdict(
  kind: EnrichmentSourceAssessment["kind"],
  signal: number | null,
  summary: string
): string {
  if (kind === "exposure") {
    return /^no\s/i.test(summary) ? "No exposure observed" : "Exposure observed";
  }
  if (kind === "context") {
    return "Registration context";
  }
  if (signal === null) return "Risk evidence available";
  if (signal <= 24) return "Low risk signal";
  if (signal <= 49) return "Suspicious signal";
  if (signal <= 74) return "High risk signal";
  return "Critical risk signal";
}

export function buildEnrichmentAssessmentFromPresentation(input: {
  sourceId: EnrichmentSourceId;
  summary: string;
  tags?: readonly string[];
}): EnrichmentSourceAssessment {
  const summary = input.summary.trim();
  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const kind: EnrichmentAssessmentKind =
    input.sourceId === "shodan" || input.sourceId === "censys"
      ? "exposure"
      : input.sourceId === "rdap_whois"
        ? "context"
        : "risk";
  const signal = kind === "risk" ? presentationRiskSignal(input.sourceId, summary, tags) : null;
  return {
    kind,
    ...(signal === null ? {} : { signal }),
    verdict: presentationAssessmentVerdict(kind, signal, summary),
    evidence: [summary, ...tags].filter(Boolean).slice(0, 4),
  };
}

export function createEmptyEnrichmentResult(
  ioc: string,
  type: IocType,
  lastUpdated: string = new Date().toISOString()
): EnrichmentResult {
  return {
    ioc: ioc.trim(),
    type,
    sources: [],
    cached: false,
    lastUpdated,
  };
}

export function createSkippedSourceResult(
  sourceId: EnrichmentSourceId,
  errorCode: EnrichmentErrorCode,
  errorMessage?: string
): EnrichmentSourceResult {
  const result: EnrichmentSourceResult = {
    sourceId,
    sourceLabel: ENRICHMENT_RESULT_SOURCE_LABELS[sourceId],
    status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
    errorCode,
  };
  const message = errorMessage?.trim();
  if (message) {
    result.errorMessage = message;
  }
  return result;
}

export function createOkSourceResult(input: {
  sourceId: EnrichmentSourceId;
  summary: string;
  tags?: readonly string[];
  assessment?: EnrichmentSourceAssessment;
  fetchedAt?: string;
  fromCache?: boolean;
  rawVendorJson?: string;
}): EnrichmentSourceResult {
  const result: EnrichmentSourceResult = {
    sourceId: input.sourceId,
    sourceLabel: ENRICHMENT_RESULT_SOURCE_LABELS[input.sourceId],
    status: ENRICHMENT_SOURCE_STATUS.OK,
    summary: input.summary.trim(),
  };
  const tags = normalizeStringArray(input.tags);
  if (tags) {
    result.tags = tags;
  }
  result.assessment =
    normalizeEnrichmentSourceAssessment(input.assessment) ??
    buildEnrichmentAssessmentFromPresentation({
      sourceId: input.sourceId,
      summary: result.summary ?? "",
      tags: result.tags,
    });
  if (input.fetchedAt) {
    result.fetchedAt = input.fetchedAt;
  }
  if (input.fromCache === true) {
    result.fromCache = true;
  }
  const rawVendorJson = input.rawVendorJson?.trim();
  if (rawVendorJson) {
    result.rawVendorJson = rawVendorJson;
  }
  return result;
}

export function createErrorSourceResult(input: {
  sourceId: EnrichmentSourceId;
  errorCode: EnrichmentErrorCode;
  errorMessage?: string;
  retryHint?: string;
  fetchedAt?: string;
}): EnrichmentSourceResult {
  const result: EnrichmentSourceResult = {
    sourceId: input.sourceId,
    sourceLabel: ENRICHMENT_RESULT_SOURCE_LABELS[input.sourceId],
    status: ENRICHMENT_SOURCE_STATUS.ERROR,
    errorCode: input.errorCode,
  };
  const message = input.errorMessage?.trim();
  if (message) {
    result.errorMessage = message;
  }
  const retryHint = input.retryHint?.trim();
  if (retryHint) {
    result.retryHint = retryHint;
  }
  if (input.fetchedAt) {
    result.fetchedAt = input.fetchedAt;
  }
  return result;
}

export type RateLimitSnapshot = {
  limit?: number;
  remaining?: number;
  resetAt?: string;
  retryAfterSeconds?: number;
};

function parseRateLimitInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }
  const seconds = Math.ceil((retryAt - Date.now()) / 1000);
  return seconds >= 0 ? seconds : 0;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitSnapshot | null {
  const limit = parseRateLimitInteger(headers.get("x-ratelimit-limit"));
  const remaining = parseRateLimitInteger(headers.get("x-ratelimit-remaining"));
  const resetEpochSeconds = parseRateLimitInteger(headers.get("x-ratelimit-reset"));
  const retryAfterSeconds = parseRetryAfterSeconds(headers.get("retry-after"));
  const resetAt =
    resetEpochSeconds !== undefined ? new Date(resetEpochSeconds * 1000).toISOString() : undefined;

  if (
    limit === undefined &&
    remaining === undefined &&
    resetAt === undefined &&
    retryAfterSeconds === undefined
  ) {
    return null;
  }

  const snapshot: RateLimitSnapshot = {};
  if (limit !== undefined) {
    snapshot.limit = limit;
  }
  if (remaining !== undefined) {
    snapshot.remaining = remaining;
  }
  if (resetAt !== undefined) {
    snapshot.resetAt = resetAt;
  }
  if (retryAfterSeconds !== undefined) {
    snapshot.retryAfterSeconds = retryAfterSeconds;
  }
  return snapshot;
}

export function formatRateLimitRetryHint(
  baseMessage: string,
  snapshot: RateLimitSnapshot | null
): string {
  const retryHint = formatRateLimitRetryHintText(snapshot);
  return `${baseMessage} ${retryHint}`;
}

export function formatRateLimitedBackoffMessage(sourceLabel: string): string {
  const label = sourceLabel.trim();
  if (!label) {
    return "Rate limit reached. Back off before retrying.";
  }
  return `${label} rate limit reached. Back off before retrying.`;
}

export function formatRateLimitRetryHintText(snapshot: RateLimitSnapshot | null): string {
  if (!snapshot) {
    return "Try again later.";
  }
  if (snapshot.retryAfterSeconds !== undefined) {
    return `Retry after ${snapshot.retryAfterSeconds} seconds.`;
  }
  if (snapshot.resetAt) {
    return `Limit resets at ${snapshot.resetAt}.`;
  }
  if (snapshot.remaining === 0) {
    return "Quota exhausted. Try again later.";
  }
  return "Try again later.";
}

export function buildRateLimitedEnrichmentError(
  sourceLabel: string,
  headers: Headers
): { errorMessage: string; retryHint: string } {
  return {
    errorMessage: formatRateLimitedBackoffMessage(sourceLabel),
    retryHint: formatRateLimitRetryHintText(parseRateLimitHeaders(headers)),
  };
}

export function buildRateLimitedErrorMessage(baseMessage: string, headers: Headers): string {
  return formatRateLimitRetryHint(baseMessage, parseRateLimitHeaders(headers));
}

export function formatMissingKeyErrorMessage(sourceLabel: string): string {
  const label = sourceLabel.trim();
  if (!label) {
    return "Add an API key in Vera5 Settings to load enrichment.";
  }
  return `Add your ${label} API key in Vera5 Settings to load enrichment.`;
}

export function isMissingKeyError(
  errorCode?: EnrichmentErrorCode
): errorCode is typeof ENRICHMENT_ERROR_CODE.MISSING_KEY {
  return errorCode === ENRICHMENT_ERROR_CODE.MISSING_KEY;
}

export function isRateLimitedError(
  errorCode?: EnrichmentErrorCode
): errorCode is typeof ENRICHMENT_ERROR_CODE.RATE_LIMITED {
  return errorCode === ENRICHMENT_ERROR_CODE.RATE_LIMITED;
}

export function parseRetryAfterSecondsFromHint(retryHint?: string): number | undefined {
  const trimmed = retryHint?.trim();
  if (!trimmed) {
    return undefined;
  }
  const match = /Retry after (\d+) seconds\./i.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
