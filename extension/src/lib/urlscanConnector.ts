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
import { recordGlobalEnrichmentCooldownFromHeaders } from "./enrichmentCooldown";
import {
  collectUrlscanThreatTags,
  mapUrlscanFieldsToUnifiedPresentation,
} from "./enrichmentVendorNormalize";
import { ENRICHMENT_SOURCE, enrichmentSourceSupportsIocType } from "./enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
  enrichmentFetch,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import { getApiKey } from "./storage";

export const URLSCAN_SOURCE_ID = "urlscan" as const;

export const URLSCAN_SEARCH_API_URL = "https://urlscan.io/api/v1/search/";

export const DEFAULT_URLSCAN_REQUEST_TIMEOUT_MS = 15_000;

export const URLSCAN_SEARCH_RESULT_SIZE = 5;

export type UrlscanSearchResultEntry = {
  pageDomain?: string;
  pageCountry?: string;
  verdictTags?: readonly string[];
  taskTags?: readonly string[];
  maliciousVerdict?: boolean;
};

export type UrlscanSearchData = {
  total: number;
  results?: readonly UrlscanSearchResultEntry[];
};

export type UrlscanConnectorDeps = {
  getApiKey?: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function normalizeDefangedUrl(value: string): string {
  return value.replace(/^hxxps?:\/\//i, (match) =>
    match.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
  );
}

function escapeUrlscanQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return strings.length > 0 ? strings : undefined;
}

export function buildUrlscanSearchQuery(type: IocType, value: string): string | null {
  if (!enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.URLSCAN, type)) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  switch (type) {
    case IOC_TYPE.DOMAIN:
      return `domain:${trimmed}`;
    case IOC_TYPE.URL: {
      const normalized = normalizeDefangedUrl(trimmed);
      return `page.url:"${escapeUrlscanQueryLiteral(normalized)}"`;
    }
    default:
      return null;
  }
}

export function buildUrlscanSearchUrl(
  type: IocType,
  value: string,
  size = URLSCAN_SEARCH_RESULT_SIZE
): string | null {
  const query = buildUrlscanSearchQuery(type, value);
  if (!query) {
    return null;
  }
  const url = new URL(URLSCAN_SEARCH_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("size", String(size));
  return url.toString();
}

export function inspectUrlscanVendorRequest(
  url: string,
  init?: RequestInit
): { searchQuery: string | null; hasRequestBody: boolean } {
  let searchQuery: string | null = null;
  try {
    const parsed = new URL(url);
    searchQuery = parsed.searchParams.get("q");
  } catch {
    searchQuery = null;
  }
  return {
    searchQuery,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

function parseUrlscanResultEntry(value: unknown): UrlscanSearchResultEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const parsed: UrlscanSearchResultEntry = {};
  const page = value.page;
  if (isRecord(page)) {
    const pageDomain = readNonEmptyString(page.domain);
    if (pageDomain) {
      parsed.pageDomain = pageDomain;
    }
    const pageCountry = readNonEmptyString(page.country);
    if (pageCountry) {
      parsed.pageCountry = pageCountry;
    }
  }

  const verdicts = value.verdicts;
  if (isRecord(verdicts)) {
    const verdictTags = readStringArray(verdicts.tags);
    if (verdictTags) {
      parsed.verdictTags = verdictTags;
    }
    const overall = verdicts.overall;
    if (isRecord(overall) && overall.malicious === true) {
      parsed.maliciousVerdict = true;
    }
  }

  const task = value.task;
  if (isRecord(task)) {
    const taskTags = readStringArray(task.tags);
    if (taskTags) {
      parsed.taskTags = taskTags;
    }
  }

  if (
    parsed.pageDomain === undefined &&
    parsed.pageCountry === undefined &&
    parsed.verdictTags === undefined &&
    parsed.taskTags === undefined &&
    parsed.maliciousVerdict === undefined
  ) {
    return null;
  }

  return parsed;
}

export function parseUrlscanSearchData(payload: unknown): UrlscanSearchData | null {
  if (!isRecord(payload)) {
    return null;
  }

  const total = readFiniteNumber(payload.total);
  if (total === undefined) {
    return null;
  }

  const parsed: UrlscanSearchData = { total };
  const resultsRaw = payload.results;
  if (Array.isArray(resultsRaw)) {
    const results: UrlscanSearchResultEntry[] = [];
    for (const entry of resultsRaw) {
      const parsedEntry = parseUrlscanResultEntry(entry);
      if (parsedEntry) {
        results.push(parsedEntry);
      }
    }
    if (results.length > 0) {
      parsed.results = results;
    }
  }

  return parsed;
}

export function mapUrlscanSearchDataToUnifiedPresentation(
  data: UrlscanSearchData
): ReturnType<typeof mapUrlscanFieldsToUnifiedPresentation> {
  const threatTags = collectUrlscanThreatTags(data.results);
  const topResult = data.results?.[0];
  return mapUrlscanFieldsToUnifiedPresentation({
    scanCount: data.total,
    threatTags,
    topDomain: topResult?.pageDomain,
    countryCode: topResult?.pageCountry,
  });
}

export function formatUrlscanSummary(scanCount: number): string {
  return (
    mapUrlscanFieldsToUnifiedPresentation({
      scanCount,
      threatTags: [],
    })?.summary ?? "No URLScan.io search results"
  );
}

export function buildUrlscanTags(data: UrlscanSearchData): readonly string[] {
  return mapUrlscanSearchDataToUnifiedPresentation(data)?.tags ?? [];
}

export function normalizeUrlscanSearchResponse(
  payload: unknown
): { summary: string; tags: readonly string[] } | null {
  const data = parseUrlscanSearchData(payload);
  if (!data) {
    return null;
  }
  return mapUrlscanSearchDataToUnifiedPresentation(data);
}

function mapUrlscanHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "URLScan.io rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "URLScan.io rate limit reached.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "URLScan.io request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `URLScan.io returned HTTP ${status}.`,
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

async function fetchUrlscanSearch(
  searchUrl: string,
  apiKey: string,
  deps: Required<Pick<UrlscanConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "API-Key": apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichWithUrlscan(
  ioc: EnrichmentIoc,
  deps: UrlscanConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(URLSCAN_SOURCE_ID));
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_URLSCAN_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: URLSCAN_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  const searchUrl = buildUrlscanSearchUrl(sanitized.type, sanitized.value);
  if (!searchUrl) {
    return createSkippedSourceResult(
      URLSCAN_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      "URLScan.io does not support this indicator type."
    );
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return createSkippedSourceResult(
      URLSCAN_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingKeyErrorMessage(ENRICHMENT_SOURCE_LABELS[URLSCAN_SOURCE_ID])
    );
  }

  try {
    const response = await fetchUrlscanSearch(searchUrl, apiKey, {
      fetch: fetchImpl,
      timeoutMs,
    });

    if (!response.ok) {
      const mapped = mapUrlscanHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[URLSCAN_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: URLSCAN_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      return createErrorSourceResult({
        sourceId: URLSCAN_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      });
    }

    const payload: unknown = await response.json();
    const normalized = normalizeUrlscanSearchResponse(payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: URLSCAN_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "URLScan.io returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: URLSCAN_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: URLSCAN_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "URLScan.io request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: URLSCAN_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "URLScan.io request failed.",
      fetchedAt,
    });
  }
}

export async function checkUrlscanHealth(
  deps: UrlscanConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(URLSCAN_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "URLScan.io API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createUrlscanConnector(
  deps: UrlscanConnectorDeps = {}
): EnrichmentConnector {
  return {
    name: URLSCAN_SOURCE_ID,
    enrich(ioc) {
      return enrichWithUrlscan(ioc, deps);
    },
    healthCheck() {
      return checkUrlscanHealth(deps);
    },
  };
}
