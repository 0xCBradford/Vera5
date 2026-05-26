import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  buildRateLimitedEnrichmentError,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  formatMissingKeyErrorMessage,
  type ConnectorHealthCheckResult,
  type EnrichmentConnector,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import { IOC_TYPE } from "./iocRegex";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import { mapAbuseIpdbFieldsToUnifiedPresentation } from "./enrichmentVendorNormalize";
import { getApiKey } from "./storage";

export const ABUSEIPDB_SOURCE_ID = "abuseipdb" as const;

export const ABUSEIPDB_CHECK_API_URL =
  "https://api.abuseipdb.com/api/v2/check";

export const DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS = 15_000;

export type AbuseIpdbCheckData = {
  ipAddress?: string;
  abuseConfidenceScore?: number;
  countryCode?: string;
  usageType?: string;
  isp?: string;
  domain?: string;
  totalReports?: number;
  numDistinctUsers?: number;
  lastReportedAt?: string;
};

export type AbuseIpdbConnectorDeps = {
  getApiKey?: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function buildAbuseIpdbCheckUrl(ipAddress: string): string {
  const url = new URL(ABUSEIPDB_CHECK_API_URL);
  url.searchParams.set("ipAddress", ipAddress.trim());
  url.searchParams.set("maxAgeInDays", "90");
  return url.toString();
}

export function inspectAbuseIpdbVendorRequest(
  url: string,
  init?: RequestInit
): { ipAddress: string | null; hasRequestBody: boolean } {
  let ipAddress: string | null = null;
  try {
    const parsed = new URL(url);
    ipAddress = parsed.searchParams.get("ipAddress");
  } catch {
    ipAddress = null;
  }
  return {
    ipAddress,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseAbuseIpdbCheckData(payload: unknown): AbuseIpdbCheckData | null {
  if (!isRecord(payload)) {
    return null;
  }
  const data = payload.data;
  if (!isRecord(data)) {
    return null;
  }

  const parsed: AbuseIpdbCheckData = {};
  const ipAddress = readNonEmptyString(data.ipAddress);
  if (ipAddress) {
    parsed.ipAddress = ipAddress;
  }
  const abuseConfidenceScore = readFiniteNumber(data.abuseConfidenceScore);
  if (abuseConfidenceScore !== undefined) {
    parsed.abuseConfidenceScore = abuseConfidenceScore;
  }
  const countryCode = readNonEmptyString(data.countryCode);
  if (countryCode) {
    parsed.countryCode = countryCode;
  }
  const usageType = readNonEmptyString(data.usageType);
  if (usageType) {
    parsed.usageType = usageType;
  }
  const isp = readNonEmptyString(data.isp);
  if (isp) {
    parsed.isp = isp;
  }
  const domain = readNonEmptyString(data.domain);
  if (domain) {
    parsed.domain = domain;
  }
  const totalReports = readFiniteNumber(data.totalReports);
  if (totalReports !== undefined) {
    parsed.totalReports = totalReports;
  }
  const numDistinctUsers = readFiniteNumber(data.numDistinctUsers);
  if (numDistinctUsers !== undefined) {
    parsed.numDistinctUsers = numDistinctUsers;
  }
  const lastReportedAt = readNonEmptyString(data.lastReportedAt);
  if (lastReportedAt) {
    parsed.lastReportedAt = lastReportedAt;
  }

  if (
    parsed.abuseConfidenceScore === undefined &&
    parsed.totalReports === undefined &&
    parsed.countryCode === undefined
  ) {
    return null;
  }

  return parsed;
}

export function formatAbuseIpdbSummary(data: AbuseIpdbCheckData): string {
  return (
    mapAbuseIpdbFieldsToUnifiedPresentation(data)?.summary ??
    "No AbuseIPDB reputation data"
  );
}

export function buildAbuseIpdbTags(data: AbuseIpdbCheckData): readonly string[] {
  return mapAbuseIpdbFieldsToUnifiedPresentation(data)?.tags ?? [];
}

export function normalizeAbuseIpdbCheckResponse(
  payload: unknown
): { summary: string; tags: readonly string[] } | null {
  const data = parseAbuseIpdbCheckData(payload);
  if (!data) {
    return null;
  }
  return mapAbuseIpdbFieldsToUnifiedPresentation(data);
}

function mapAbuseIpdbHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "AbuseIPDB rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "AbuseIPDB rate limit reached.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "AbuseIPDB request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `AbuseIPDB returned HTTP ${status}.`,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AbortError"
  );
}

async function fetchAbuseIpdbCheck(
  ipAddress: string,
  apiKey: string,
  deps: Required<
    Pick<AbuseIpdbConnectorDeps, "fetch" | "timeoutMs">
  >
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(buildAbuseIpdbCheckUrl(ipAddress), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Key: apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichWithAbuseIpdb(
  ioc: EnrichmentIoc,
  deps: AbuseIpdbConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(ABUSEIPDB_SOURCE_ID));
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  if (sanitized.type !== IOC_TYPE.IPV4) {
    return createSkippedSourceResult(
      ABUSEIPDB_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      "AbuseIPDB supports IPv4 addresses only."
    );
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return createSkippedSourceResult(
      ABUSEIPDB_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingKeyErrorMessage(ENRICHMENT_SOURCE_LABELS[ABUSEIPDB_SOURCE_ID])
    );
  }

  try {
    const response = await fetchAbuseIpdbCheck(sanitized.value, apiKey, {
      fetch: fetchImpl,
      timeoutMs,
    });

    if (!response.ok) {
      const mapped = mapAbuseIpdbHttpStatus(response.status);
      if (response.status === 429) {
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[ABUSEIPDB_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: ABUSEIPDB_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      const errorMessage = mapped.errorMessage;
      return createErrorSourceResult({
        sourceId: ABUSEIPDB_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage,
        fetchedAt,
      });
    }

    const payload: unknown = await response.json();
    const normalized = normalizeAbuseIpdbCheckResponse(payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: ABUSEIPDB_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "AbuseIPDB returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: ABUSEIPDB_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "AbuseIPDB request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "AbuseIPDB request failed.",
      fetchedAt,
    });
  }
}

export async function checkAbuseIpdbHealth(
  deps: AbuseIpdbConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(ABUSEIPDB_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "AbuseIPDB API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createAbuseIpdbConnector(
  deps: AbuseIpdbConnectorDeps = {}
): EnrichmentConnector {
  return {
    name: ABUSEIPDB_SOURCE_ID,
    enrich(ioc) {
      return enrichWithAbuseIpdb(ioc, deps);
    },
    healthCheck() {
      return checkAbuseIpdbHealth(deps);
    },
  };
}
