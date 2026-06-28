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
  mapShodanFieldsToUnifiedPresentation,
  type ShodanUnifiedInput,
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

export const SHODAN_SOURCE_ID = "shodan" as const;

export const SHODAN_API_BASE_URL = "https://api.shodan.io";

export const DEFAULT_SHODAN_REQUEST_TIMEOUT_MS = 15_000;

export const SHODAN_UNSUPPORTED_TYPE_MESSAGE =
  "Shodan supports IPv4 addresses and domains only.";

export type ShodanHostData = {
  ip?: string;
  openServiceCount: number;
  countryCode?: string;
  organization?: string;
  serviceTags: readonly string[];
};

export type ShodanDomainData = {
  domain?: string;
  subdomainCount: number;
  dnsRecordCount: number;
  serviceTags: readonly string[];
};

export type ShodanConnectorDeps = {
  getApiKey?: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

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

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function shodanLiveSupportsIocType(type: IocType): boolean {
  return enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.SHODAN, type);
}

export function resolveShodanResourcePath(
  type: IocType,
  value: string
): { collection: "host" | "domain"; resourceId: string } | null {
  if (!shodanLiveSupportsIocType(type)) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (type === IOC_TYPE.IPV4) {
    return { collection: "host", resourceId: trimmed };
  }

  if (type === IOC_TYPE.DOMAIN) {
    return { collection: "domain", resourceId: trimmed.toLowerCase() };
  }

  return null;
}

export function buildShodanApiUrl(
  type: IocType,
  value: string,
  apiKey: string
): string | null {
  const resource = resolveShodanResourcePath(type, value);
  if (!resource) {
    return null;
  }

  const encodedKey = encodeURIComponent(apiKey.trim());
  if (resource.collection === "host") {
    return `${SHODAN_API_BASE_URL}/shodan/host/${encodeURIComponent(resource.resourceId)}?key=${encodedKey}`;
  }

  return `${SHODAN_API_BASE_URL}/dns/domain/${encodeURIComponent(resource.resourceId)}?key=${encodedKey}`;
}

export function inspectShodanVendorRequest(
  url: string,
  init?: RequestInit
): { resourcePath: string | null; hasRequestBody: boolean } {
  let resourcePath: string | null = null;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    resourcePath = pathname.length > 0 ? pathname : null;
  } catch {
    resourcePath = null;
  }

  return {
    resourcePath,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

function collectShodanHostServiceTags(
  entries: readonly Record<string, unknown>[]
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const product = readNonEmptyString(entry.product);
    if (product && !seen.has(product)) {
      seen.add(product);
      tags.push(product);
    }

    const shodan = entry._shodan;
    if (isRecord(shodan)) {
      const moduleName = readNonEmptyString(shodan.module);
      if (moduleName && !seen.has(moduleName)) {
        seen.add(moduleName);
        tags.push(moduleName);
      }
    }

    const port = readFiniteNumber(entry.port);
    const transport = readNonEmptyString(entry.transport);
    if (port !== undefined) {
      const portLabel = transport ? `${port}/${transport}` : String(port);
      if (!seen.has(portLabel)) {
        seen.add(portLabel);
        tags.push(portLabel);
      }
    }

    if (tags.length >= 5) {
      break;
    }
  }

  return tags;
}

export function parseShodanHostData(payload: unknown): ShodanHostData | null {
  if (!isRecord(payload)) {
    return null;
  }

  const dataEntries = Array.isArray(payload.data)
    ? payload.data.filter(isRecord)
    : [];
  const ports = Array.isArray(payload.ports)
    ? payload.ports.filter((entry) => typeof entry === "number")
    : [];
  const openServiceCount =
    dataEntries.length > 0 ? dataEntries.length : ports.length;

  const countryCode =
    readNonEmptyString(payload.country_code) ??
    readNonEmptyString(payload.country);
  const organization =
    readNonEmptyString(payload.org) ?? readNonEmptyString(payload.isp);
  const ip = readNonEmptyString(payload.ip_str) ?? readNonEmptyString(payload.ip);

  if (
    openServiceCount === 0 &&
    !countryCode &&
    !organization &&
    !ip
  ) {
    return null;
  }

  return {
    ip,
    openServiceCount,
    countryCode,
    organization,
    serviceTags: collectShodanHostServiceTags(dataEntries),
  };
}

export function parseShodanDomainData(payload: unknown): ShodanDomainData | null {
  if (!isRecord(payload)) {
    return null;
  }

  const subdomains = readStringArray(payload.subdomains);
  const dnsRecords = Array.isArray(payload.data)
    ? payload.data.filter(isRecord)
    : [];
  const domain = readNonEmptyString(payload.domain);
  const tags = readStringArray(payload.tags);

  if (
    subdomains.length === 0 &&
    dnsRecords.length === 0 &&
    !domain &&
    tags.length === 0
  ) {
    return null;
  }

  return {
    domain,
    subdomainCount: subdomains.length,
    dnsRecordCount: dnsRecords.length,
    serviceTags: tags,
  };
}

export function mapShodanHostDataToUnifiedPresentation(
  data: ShodanHostData
): ReturnType<typeof mapShodanFieldsToUnifiedPresentation> {
  const input: ShodanUnifiedInput = {
    openServiceCount: data.openServiceCount,
    countryCode: data.countryCode,
    organization: data.organization,
    serviceTags: data.serviceTags,
  };
  return mapShodanFieldsToUnifiedPresentation(input);
}

export function mapShodanDomainDataToUnifiedPresentation(
  data: ShodanDomainData
): ReturnType<typeof mapShodanFieldsToUnifiedPresentation> {
  const input: ShodanUnifiedInput = {
    subdomainCount: data.subdomainCount,
    dnsRecordCount: data.dnsRecordCount,
    serviceTags: data.serviceTags,
  };
  return mapShodanFieldsToUnifiedPresentation(input);
}

export function normalizeShodanHostResponse(
  payload: unknown
): ReturnType<typeof mapShodanFieldsToUnifiedPresentation> | null {
  const data = parseShodanHostData(payload);
  if (!data) {
    return null;
  }
  return mapShodanHostDataToUnifiedPresentation(data);
}

export function normalizeShodanDomainResponse(
  payload: unknown
): ReturnType<typeof mapShodanFieldsToUnifiedPresentation> | null {
  const data = parseShodanDomainData(payload);
  if (!data) {
    return null;
  }
  return mapShodanDomainDataToUnifiedPresentation(data);
}

export function normalizeShodanResponse(
  type: IocType,
  payload: unknown
): ReturnType<typeof mapShodanFieldsToUnifiedPresentation> | null {
  if (type === IOC_TYPE.IPV4) {
    return normalizeShodanHostResponse(payload);
  }
  if (type === IOC_TYPE.DOMAIN) {
    return normalizeShodanDomainResponse(payload);
  }
  return null;
}

function mapShodanHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Shodan rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "Shodan rate limit reached.",
    };
  }
  if (status === 404) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Shodan has no report for this indicator.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "Shodan request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `Shodan returned HTTP ${status}.`,
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

async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchShodanObject(
  url: string,
  deps: Required<Pick<ShodanConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichWithShodan(
  ioc: EnrichmentIoc,
  deps: ShodanConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(SHODAN_SOURCE_ID));
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_SHODAN_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: SHODAN_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  if (!shodanLiveSupportsIocType(sanitized.type)) {
    return createSkippedSourceResult(
      SHODAN_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      SHODAN_UNSUPPORTED_TYPE_MESSAGE
    );
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return createSkippedSourceResult(
      SHODAN_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingKeyErrorMessage(ENRICHMENT_SOURCE_LABELS[SHODAN_SOURCE_ID])
    );
  }

  const requestUrl = buildShodanApiUrl(sanitized.type, sanitized.value, apiKey);
  if (!requestUrl) {
    return createSkippedSourceResult(
      SHODAN_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      SHODAN_UNSUPPORTED_TYPE_MESSAGE
    );
  }

  try {
    const response = await fetchShodanObject(requestUrl, {
      fetch: fetchImpl,
      timeoutMs,
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const mapped = mapShodanHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[SHODAN_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: SHODAN_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      return createErrorSourceResult({
        sourceId: SHODAN_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      });
    }

    const normalized = normalizeShodanResponse(sanitized.type, payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: SHODAN_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "Shodan returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: SHODAN_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: SHODAN_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "Shodan request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: SHODAN_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "Shodan request failed.",
      fetchedAt,
    });
  }
}

export async function checkShodanHealth(
  deps: ShodanConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(SHODAN_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "Shodan API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createShodanConnector(
  deps: ShodanConnectorDeps = {}
): EnrichmentConnector {
  return {
    name: SHODAN_SOURCE_ID,
    enrich(ioc) {
      return enrichWithShodan(ioc, deps);
    },
    healthCheck() {
      return checkShodanHealth(deps);
    },
  };
}
