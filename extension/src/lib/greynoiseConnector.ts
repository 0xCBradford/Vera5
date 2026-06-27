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
  mapGreyNoiseFieldsToUnifiedPresentation,
  type GreyNoiseUnifiedInput,
} from "./enrichmentVendorNormalize";
import { ENRICHMENT_SOURCE, enrichmentSourceSupportsIocType } from "./enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
  enrichmentFetch,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import { getApiKey } from "./storage";

export const GREYNOISE_SOURCE_ID = "greynoise" as const;

export const GREYNOISE_COMMUNITY_API_BASE_URL =
  "https://api.greynoise.io/v3/community/";

export const DEFAULT_GREYNOISE_REQUEST_TIMEOUT_MS = 15_000;

export type GreyNoiseCommunityData = {
  ip?: string;
  noise: boolean;
  riot: boolean;
  classification?: string;
  name?: string;
  link?: string;
  lastSeen?: string;
  message?: string;
};

export type GreyNoiseConnectorDeps = {
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

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function buildGreyNoiseCommunityUrl(ipAddress: string): string {
  return `${GREYNOISE_COMMUNITY_API_BASE_URL}${encodeURIComponent(ipAddress.trim())}`;
}

export function inspectGreyNoiseVendorRequest(
  url: string,
  init?: RequestInit
): { ipAddress: string | null; hasRequestBody: boolean } {
  let ipAddress: string | null = null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
    ipAddress = segments.at(-1) ?? null;
  } catch {
    ipAddress = null;
  }
  return {
    ipAddress,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

export function parseGreyNoiseCommunityData(
  payload: unknown
): GreyNoiseCommunityData | null {
  if (!isRecord(payload)) {
    return null;
  }

  const noise = readBoolean(payload.noise);
  const riot = readBoolean(payload.riot);
  const classification = readNonEmptyString(payload.classification);
  const message = readNonEmptyString(payload.message);

  if (noise === undefined && riot === undefined && !classification && !message) {
    return null;
  }

  const parsed: GreyNoiseCommunityData = {
    noise: noise ?? false,
    riot: riot ?? false,
  };

  const ip = readNonEmptyString(payload.ip);
  if (ip) {
    parsed.ip = ip;
  }
  if (classification) {
    parsed.classification = classification;
  }
  const name = readNonEmptyString(payload.name);
  if (name) {
    parsed.name = name;
  }
  const link = readNonEmptyString(payload.link);
  if (link) {
    parsed.link = link;
  }
  const lastSeen = readNonEmptyString(payload.last_seen);
  if (lastSeen) {
    parsed.lastSeen = lastSeen;
  }
  if (message) {
    parsed.message = message;
  }

  return parsed;
}

export function mapGreyNoiseCommunityDataToUnifiedPresentation(
  data: GreyNoiseCommunityData
): { summary: string; tags: readonly string[] } {
  const input: GreyNoiseUnifiedInput = {
    noise: data.noise,
    riot: data.riot,
    classification: data.classification,
    name: data.name && data.name.toLowerCase() !== "unknown" ? data.name : undefined,
  };
  return mapGreyNoiseFieldsToUnifiedPresentation(input);
}

export function formatGreyNoiseSummary(data: GreyNoiseCommunityData): string {
  return mapGreyNoiseCommunityDataToUnifiedPresentation(data).summary;
}

export function buildGreyNoiseTags(data: GreyNoiseCommunityData): readonly string[] {
  return mapGreyNoiseCommunityDataToUnifiedPresentation(data).tags;
}

export function normalizeGreyNoiseCommunityResponse(
  payload: unknown
): { summary: string; tags: readonly string[] } | null {
  const data = parseGreyNoiseCommunityData(payload);
  if (!data) {
    return null;
  }
  return mapGreyNoiseCommunityDataToUnifiedPresentation(data);
}

function mapGreyNoiseHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "GreyNoise rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "GreyNoise rate limit reached.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "GreyNoise request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `GreyNoise returned HTTP ${status}.`,
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

async function fetchGreyNoiseCommunity(
  ipAddress: string,
  apiKey: string,
  deps: Required<Pick<GreyNoiseConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(buildGreyNoiseCommunityUrl(ipAddress), {
      method: "GET",
      headers: {
        Accept: "application/json",
        key: apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeGreyNoiseResponsePayload(
  payload: unknown
): { summary: string; tags: readonly string[] } | null {
  const normalized = normalizeGreyNoiseCommunityResponse(payload);
  if (normalized) {
    return normalized;
  }
  if (isRecord(payload)) {
    const message = readNonEmptyString(payload.message);
    if (message) {
      return mapGreyNoiseCommunityDataToUnifiedPresentation({
        noise: false,
        riot: false,
        message,
      });
    }
  }
  return null;
}

export async function enrichWithGreynoise(
  ioc: EnrichmentIoc,
  deps: GreyNoiseConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(GREYNOISE_SOURCE_ID));
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_GREYNOISE_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: GREYNOISE_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  if (!enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.GREYNOISE, sanitized.type)) {
    return createSkippedSourceResult(
      GREYNOISE_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      "GreyNoise supports IPv4 addresses only."
    );
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return createSkippedSourceResult(
      GREYNOISE_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingKeyErrorMessage(ENRICHMENT_SOURCE_LABELS[GREYNOISE_SOURCE_ID])
    );
  }

  try {
    const response = await fetchGreyNoiseCommunity(sanitized.value, apiKey, {
      fetch: fetchImpl,
      timeoutMs,
    });

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      if (response.status === 404) {
        const normalized = normalizeGreyNoiseResponsePayload(payload);
        if (normalized) {
          return createOkSourceResult({
            sourceId: GREYNOISE_SOURCE_ID,
            summary: normalized.summary,
            tags: normalized.tags,
            fetchedAt,
            rawVendorJson: formatRedactedVendorJson(payload),
          });
        }
      }

      const mapped = mapGreyNoiseHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[GREYNOISE_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: GREYNOISE_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      return createErrorSourceResult({
        sourceId: GREYNOISE_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      });
    }

    const normalized = normalizeGreyNoiseResponsePayload(payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: GREYNOISE_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "GreyNoise returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: GREYNOISE_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: GREYNOISE_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "GreyNoise request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: GREYNOISE_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "GreyNoise request failed.",
      fetchedAt,
    });
  }
}

export async function checkGreynoiseHealth(
  deps: GreyNoiseConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(GREYNOISE_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "GreyNoise API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createGreynoiseConnector(
  deps: GreyNoiseConnectorDeps = {}
): EnrichmentConnector {
  return {
    name: GREYNOISE_SOURCE_ID,
    enrich(ioc) {
      return enrichWithGreynoise(ioc, deps);
    },
    healthCheck() {
      return checkGreynoiseHealth(deps);
    },
  };
}
