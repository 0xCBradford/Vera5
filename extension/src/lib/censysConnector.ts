import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  buildRateLimitedEnrichmentError,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  type ConnectorHealthCheckResult,
  type EnrichmentConnector,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import { recordGlobalEnrichmentCooldownFromHeaders } from "./enrichmentCooldown";
import {
  formatMissingCensysCredentialsMessage,
  hasCensysCredentials,
  resolveCensysCredentials,
} from "./censysCredentials";
import {
  mapCensysFieldsToUnifiedPresentation,
  type CensysUnifiedInput,
} from "./enrichmentVendorNormalize";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
  enrichmentFetch,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";

export const CENSYS_SOURCE_ID = ENRICHMENT_SOURCE.CENSYS;

export const CENSYS_API_BASE_URL = "https://search.censys.io/api/v2";

export const DEFAULT_CENSYS_REQUEST_TIMEOUT_MS = 15_000;

export const CENSYS_UNSUPPORTED_TYPE_MESSAGE =
  "Censys live enrichment supports IPv4 addresses only. Domain pivot links remain available.";
export type CensysCertificateFields = {
  subjectCommonName?: string;
  issuerCommonName?: string;
  fingerprintSha256?: string;
};

export type CensysHostData = {
  ip?: string;
  serviceCount: number;
  certificateCount: number;
  dnsNameCount: number;
  countryCode?: string;
  autonomousSystemName?: string;
  serviceTags: readonly string[];
  certificateTags: readonly string[];
  dnsNames: readonly string[];
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

function readNamedCommonName(
  value: unknown,
  field: "subject" | "issuer"
): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const named = value[field];
  if (!isRecord(named)) {
    return undefined;
  }
  return readNonEmptyString(named.common_name);
}

export function unwrapCensysHostPayload(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  const result = payload.result;
  if (isRecord(result)) {
    const resource = result.resource;
    if (isRecord(resource)) {
      return resource;
    }
    return result;
  }

  if (
    readNonEmptyString(payload.ip) ||
    Array.isArray(payload.services) ||
    isRecord(payload.location)
  ) {
    return payload;
  }

  return null;
}

export function parseCensysCertificateFields(
  service: Record<string, unknown>
): CensysCertificateFields | null {
  const tls = service.tls;
  if (isRecord(tls)) {
    const certificates = tls.certificates;
    if (isRecord(certificates)) {
      const leafData = certificates.leaf_data;
      if (isRecord(leafData)) {
        const subjectCommonName = readNamedCommonName(leafData, "subject");
        const issuerCommonName = readNamedCommonName(leafData, "issuer");
        const fingerprintSha256 = readNonEmptyString(leafData.fingerprint_sha256);
        if (subjectCommonName || issuerCommonName || fingerprintSha256) {
          return { subjectCommonName, issuerCommonName, fingerprintSha256 };
        }
      }
    }
  }

  const cert = service.cert;
  if (isRecord(cert)) {
    const subjectCommonName = readNamedCommonName(cert, "subject");
    const issuerCommonName = readNamedCommonName(cert, "issuer");
    const fingerprintSha256 =
      readNonEmptyString(cert.fingerprint_sha256) ??
      readNonEmptyString(cert.fingerprint_sha2);
    if (subjectCommonName || issuerCommonName || fingerprintSha256) {
      return { subjectCommonName, issuerCommonName, fingerprintSha256 };
    }
  }

  const legacyFingerprint = readNonEmptyString(service.certificate);
  if (legacyFingerprint) {
    return { fingerprintSha256: legacyFingerprint };
  }

  return null;
}

export function collectCensysServiceTags(
  services: readonly Record<string, unknown>[]
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    const serviceName = readNonEmptyString(service.service_name);
    if (serviceName && !seen.has(serviceName)) {
      seen.add(serviceName);
      tags.push(serviceName);
      if (tags.length >= 5) {
        break;
      }
    }

    const port = readFiniteNumber(service.port);
    const transport =
      readNonEmptyString(service.transport_protocol) ??
      readNonEmptyString(service.transport);
    if (port !== undefined) {
      const portLabel = transport
        ? `${port}/${transport.toLowerCase()}`
        : String(port);
      if (!seen.has(portLabel)) {
        seen.add(portLabel);
        tags.push(portLabel);
        if (tags.length >= 5) {
          break;
        }
      }
    }

    const protocol = readNonEmptyString(service.protocol);
    if (protocol && !seen.has(protocol)) {
      seen.add(protocol);
      tags.push(protocol);
      if (tags.length >= 5) {
        break;
      }
    }
  }

  return tags;
}

export function collectCensysCertificateTags(
  services: readonly Record<string, unknown>[]
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    const certificate = parseCensysCertificateFields(service);
    if (!certificate) {
      continue;
    }

    if (certificate.subjectCommonName && !seen.has(certificate.subjectCommonName)) {
      seen.add(certificate.subjectCommonName);
      tags.push(certificate.subjectCommonName);
    } else if (
      certificate.issuerCommonName &&
      !seen.has(certificate.issuerCommonName)
    ) {
      seen.add(certificate.issuerCommonName);
      tags.push(certificate.issuerCommonName);
    }

    if (tags.length >= 5) {
      break;
    }
  }

  return tags;
}

export function countCensysCertificateServices(
  services: readonly Record<string, unknown>[]
): number {
  return services.filter((service) => parseCensysCertificateFields(service) !== null)
    .length;
}

export function parseCensysHostData(payload: unknown): CensysHostData | null {
  const host = unwrapCensysHostPayload(payload);
  if (!host) {
    return null;
  }

  const services = Array.isArray(host.services)
    ? host.services.filter(isRecord)
    : [];
  const location = host.location;
  const autonomousSystem = host.autonomous_system;
  const dns = host.dns;

  const countryCode = isRecord(location)
    ? readNonEmptyString(location.country_code)
    : undefined;
  const autonomousSystemName = isRecord(autonomousSystem)
    ? readNonEmptyString(autonomousSystem.name) ??
      readNonEmptyString(autonomousSystem.description)
    : undefined;
  const dnsNames = isRecord(dns)
    ? readStringArray(dns.names ?? dns.reverse_dns)
    : [];
  const ip = readNonEmptyString(host.ip);
  const serviceCount = services.length;
  const certificateCount = countCensysCertificateServices(services);
  const serviceTags = collectCensysServiceTags(services);
  const certificateTags = collectCensysCertificateTags(services);

  if (
    serviceCount === 0 &&
    certificateCount === 0 &&
    dnsNames.length === 0 &&
    !countryCode &&
    !autonomousSystemName &&
    !ip
  ) {
    return null;
  }

  return {
    ip,
    serviceCount,
    certificateCount,
    dnsNameCount: dnsNames.length,
    countryCode,
    autonomousSystemName,
    serviceTags,
    certificateTags,
    dnsNames,
  };
}

export function mapCensysHostDataToUnifiedPresentation(
  data: CensysHostData
): ReturnType<typeof mapCensysFieldsToUnifiedPresentation> {
  const input: CensysUnifiedInput = {
    serviceCount: data.serviceCount,
    certificateCount: data.certificateCount,
    dnsNameCount: data.dnsNameCount,
    countryCode: data.countryCode,
    autonomousSystemName: data.autonomousSystemName,
    serviceTags: data.serviceTags,
    certificateTags: data.certificateTags,
    dnsNames: data.dnsNames,
  };
  return mapCensysFieldsToUnifiedPresentation(input);
}

export function normalizeCensysHostResponse(
  payload: unknown
): ReturnType<typeof mapCensysFieldsToUnifiedPresentation> | null {
  const data = parseCensysHostData(payload);
  if (!data) {
    return null;
  }
  return mapCensysHostDataToUnifiedPresentation(data);
}

export function censysLiveSupportsIocType(type: IocType): boolean {
  return type === IOC_TYPE.IPV4;
}

export function buildCensysHostApiUrl(ipAddress: string): string {
  return `${CENSYS_API_BASE_URL}/hosts/${encodeURIComponent(ipAddress.trim())}`;
}

export function buildCensysBasicAuthorization(
  apiId: string,
  apiSecret: string
): string {
  const token = btoa(`${apiId.trim()}:${apiSecret.trim()}`);
  return `Basic ${token}`;
}

export function inspectCensysVendorRequest(
  url: string,
  init?: RequestInit
): { ipAddress: string | null; hasRequestBody: boolean } {
  let ipAddress: string | null = null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/hosts\/([^/]+)$/);
    if (match?.[1]) {
      ipAddress = decodeURIComponent(match[1]);
    }
  } catch {
    ipAddress = null;
  }

  return {
    ipAddress,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

function mapCensysHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "Censys rejected the API credentials.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "Censys rate limit reached.",
    };
  }
  if (status === 404) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Censys has no report for this indicator.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "Censys request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `Censys returned HTTP ${status}.`,
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

async function fetchCensysObject(
  url: string,
  authorization: string,
  deps: Required<Pick<CensysConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export type CensysConnectorDeps = {
  getApiId?: () => Promise<string>;
  getApiSecret?: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export async function enrichWithCensys(
  ioc: EnrichmentIoc,
  deps: CensysConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_CENSYS_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();
  const credentialDeps = {
    getApiId: deps.getApiId,
    getApiSecret: deps.getApiSecret,
  };

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: CENSYS_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  if (!censysLiveSupportsIocType(sanitized.type)) {
    return createSkippedSourceResult(
      CENSYS_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      CENSYS_UNSUPPORTED_TYPE_MESSAGE
    );
  }

  const credentials = await resolveCensysCredentials(credentialDeps);
  if (!credentials) {
    return createSkippedSourceResult(
      CENSYS_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingCensysCredentialsMessage()
    );
  }

  const requestUrl = buildCensysHostApiUrl(sanitized.value);
  const authorization = buildCensysBasicAuthorization(
    credentials.apiId,
    credentials.apiSecret
  );

  try {
    const response = await fetchCensysObject(requestUrl, authorization, {
      fetch: fetchImpl,
      timeoutMs,
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const mapped = mapCensysHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[CENSYS_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: CENSYS_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      return createErrorSourceResult({
        sourceId: CENSYS_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      });
    }

    const normalized = normalizeCensysHostResponse(payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: CENSYS_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "Censys returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: CENSYS_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: CENSYS_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "Censys request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: CENSYS_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "Censys request failed.",
      fetchedAt,
    });
  }
}

export async function checkCensysHealth(
  deps: CensysConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const credentialDeps = {
    getApiId: deps.getApiId,
    getApiSecret: deps.getApiSecret,
  };
  if (!(await hasCensysCredentials(credentialDeps))) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: formatMissingCensysCredentialsMessage(),
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createCensysConnector(
  deps: CensysConnectorDeps = {}
): EnrichmentConnector {
  return {
    name: CENSYS_SOURCE_ID,
    enrich(ioc) {
      return enrichWithCensys(ioc, deps);
    },
    healthCheck() {
      return checkCensysHealth(deps);
    },
  };
}
