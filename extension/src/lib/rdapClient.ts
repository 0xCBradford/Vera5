import { parseRateLimitHeaders } from "./enrichment";
import { IOC_TYPE } from "./iocRegex";
import { sanitizeEnrichmentIoc, enrichmentFetch } from "./iocRequestBoundaries";

export const RDAP_ORG_DOMAIN_BASE_URL = "https://rdap.org/domain/";

export const DEFAULT_RDAP_REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_RDAP_MIN_REQUEST_INTERVAL_MS = 1_000;

export const RDAP_CLIENT_ERROR_CODE = {
  INVALID_DOMAIN: "invalid_domain",
  TIMEOUT: "timeout",
  RATE_LIMITED: "rate_limited",
  NOT_FOUND: "not_found",
  VENDOR: "vendor",
} as const;

export type RdapClientErrorCode =
  (typeof RDAP_CLIENT_ERROR_CODE)[keyof typeof RDAP_CLIENT_ERROR_CODE];

export type RdapClientDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  minRequestIntervalMs?: number;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type RdapClientOk = {
  ok: true;
  domain: string;
  url: string;
  payload: unknown;
  fetchedAt: string;
};

export type RdapClientError = {
  ok: false;
  errorCode: RdapClientErrorCode;
  errorMessage: string;
  fetchedAt: string;
  retryAfterSeconds?: number;
};

export type RdapClientResult = RdapClientOk | RdapClientError;

let lastRdapRequestStartedAtMs: number | null = null;
let rdapRateLimitBlockedUntilMs = 0;

export function resetRdapClientRateLimitState(): void {
  lastRdapRequestStartedAtMs = null;
  rdapRateLimitBlockedUntilMs = 0;
}

export function buildRdapDomainUrl(domain: string): string {
  const normalized = normalizeRdapDomainQuery(domain);
  if (!normalized) {
    throw new Error("Invalid RDAP domain query.");
  }
  return `${RDAP_ORG_DOMAIN_BASE_URL}${encodeURIComponent(normalized)}`;
}

export function normalizeRdapDomainQuery(value: string): string | null {
  const sanitized = sanitizeEnrichmentIoc({
    value: value.trim(),
    type: IOC_TYPE.DOMAIN,
  });
  return sanitized?.value.toLowerCase() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AbortError"
  );
}

function readRetryAfterSeconds(headers: Headers): number | undefined {
  return parseRateLimitHeaders(headers)?.retryAfterSeconds;
}

function recordRdapServerRateLimit(headers: Headers, nowMs: number): void {
  const retryAfterSeconds = readRetryAfterSeconds(headers);
  if (retryAfterSeconds === undefined) {
    return;
  }
  rdapRateLimitBlockedUntilMs = Math.max(
    rdapRateLimitBlockedUntilMs,
    nowMs + retryAfterSeconds * 1000
  );
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRdapRateLimitSlot(
  minRequestIntervalMs: number,
  deps: Pick<RdapClientDeps, "nowMs" | "sleep">
): Promise<void> {
  const nowMs = deps.nowMs?.() ?? Date.now();
  let nextAllowedAtMs = rdapRateLimitBlockedUntilMs;
  if (lastRdapRequestStartedAtMs !== null) {
    nextAllowedAtMs = Math.max(
      nextAllowedAtMs,
      lastRdapRequestStartedAtMs + minRequestIntervalMs
    );
  }
  const waitMs = nextAllowedAtMs - nowMs;
  if (waitMs > 0) {
    await (deps.sleep ?? defaultSleep)(waitMs);
  }
  lastRdapRequestStartedAtMs = deps.nowMs?.() ?? Date.now();
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const text = await response.text();
    return text.length > 0 ? { message: text.slice(0, 512) } : null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapRdapHttpStatus(
  status: number,
  headers: Headers,
  nowMs: number
): Omit<RdapClientError, "fetchedAt"> | null {
  if (status === 404) {
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.NOT_FOUND,
      errorMessage: "RDAP domain object not found.",
    };
  }
  if (status === 408) {
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.TIMEOUT,
      errorMessage: "RDAP request timed out.",
    };
  }
  if (status === 429 || status === 503) {
    recordRdapServerRateLimit(headers, nowMs);
    const retryAfterSeconds = readRetryAfterSeconds(headers);
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "RDAP rate limit reached. Back off before retrying.",
      retryAfterSeconds,
    };
  }
  if (status >= 400) {
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.VENDOR,
      errorMessage: `RDAP server returned HTTP ${status}.`,
    };
  }
  return null;
}

async function fetchRdapDomainResponse(
  url: string,
  deps: Required<Pick<RdapClientDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rdap+json, application/json",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchRdapDomain(
  domainInput: string,
  deps: RdapClientDeps = {}
): Promise<RdapClientResult> {
  const fetchedAt = new Date().toISOString();
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_RDAP_REQUEST_TIMEOUT_MS;
  const minRequestIntervalMs =
    deps.minRequestIntervalMs ?? DEFAULT_RDAP_MIN_REQUEST_INTERVAL_MS;

  const domain = normalizeRdapDomainQuery(domainInput);
  if (!domain) {
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.INVALID_DOMAIN,
      errorMessage: "Invalid domain for RDAP lookup.",
      fetchedAt,
    };
  }

  let url: string;
  try {
    url = buildRdapDomainUrl(domain);
  } catch {
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.INVALID_DOMAIN,
      errorMessage: "Invalid domain for RDAP lookup.",
      fetchedAt,
    };
  }

  await waitForRdapRateLimitSlot(minRequestIntervalMs, deps);

  try {
    const response = await fetchRdapDomainResponse(url, {
      fetch: fetchImpl,
      timeoutMs,
    });
    const nowMs = deps.nowMs?.() ?? Date.now();
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const mapped = mapRdapHttpStatus(response.status, response.headers, nowMs);
      if (mapped) {
        return { ...mapped, fetchedAt };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: RDAP_CLIENT_ERROR_CODE.VENDOR,
        errorMessage: `RDAP server returned HTTP ${response.status}.`,
        fetchedAt,
      };
    }

    if (!isRecord(payload) || payload.objectClassName !== "domain") {
      return {
        ok: false,
        errorCode: RDAP_CLIENT_ERROR_CODE.VENDOR,
        errorMessage: "RDAP response did not contain a domain object.",
        fetchedAt,
      };
    }

    return {
      ok: true,
      domain,
      url,
      payload,
      fetchedAt,
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        errorCode: RDAP_CLIENT_ERROR_CODE.TIMEOUT,
        errorMessage: "RDAP request timed out.",
        fetchedAt,
      };
    }
    return {
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.VENDOR,
      errorMessage: "RDAP request failed.",
      fetchedAt,
    };
  }
}
