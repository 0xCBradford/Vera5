import {
  isEnrichmentSourceResult,
  type EnrichmentSourceResult,
} from "./enrichment";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import type { EnrichmentSourceCacheTtlRecord, EnrichmentSourceEnabledRecord } from "./storage";

export const DEFAULT_LOCAL_BACKEND_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_BACKEND_PORT = 8765;
export const DEFAULT_LOCAL_BACKEND_REQUEST_TIMEOUT_MS = 15_000;
export const LOCAL_BACKEND_ENRICH_PATH = "/enrich";
export const LOCAL_BACKEND_FALLBACK_HINT =
  "Local backend unreachable. Loaded through extension connectors instead.";

export type LocalBackendEnrichmentInput = {
  value: string;
  iocType: IocType;
  sourceId?: EnrichmentSourceId;
  bypassCache?: boolean;
  enabledSources: EnrichmentSourceEnabledRecord;
  cacheTtlSeconds?: number;
  sourceCacheTtlSeconds?: EnrichmentSourceCacheTtlRecord;
};

export type LocalBackendEnrichmentResponse = {
  source: EnrichmentSourceResult;
  sources: EnrichmentSourceResult[];
};

export function applyLocalBackendFallbackHint(
  bundle: LocalBackendEnrichmentResponse
): LocalBackendEnrichmentResponse {
  const source: EnrichmentSourceResult = {
    ...bundle.source,
    retryHint: LOCAL_BACKEND_FALLBACK_HINT,
  };
  const sources = bundle.sources.map((entry) =>
    entry.sourceId === source.sourceId ? source : entry
  );
  return { source, sources };
}

export class LocalBackendOutboundBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalBackendOutboundBlockedError";
  }
}

export function buildLocalBackendEnrichUrl(
  host: string = DEFAULT_LOCAL_BACKEND_HOST,
  port: number = DEFAULT_LOCAL_BACKEND_PORT
): string {
  return `http://${host}:${port}${LOCAL_BACKEND_ENRICH_PATH}`;
}

export function assertLocalBackendEnrichUrl(url: string | URL): void {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    throw new LocalBackendOutboundBlockedError(
      "Local backend enrich URL is invalid."
    );
  }

  if (parsed.protocol !== "http:") {
    throw new LocalBackendOutboundBlockedError(
      "Local backend enrich requires HTTP on localhost."
    );
  }

  if (parsed.hostname !== DEFAULT_LOCAL_BACKEND_HOST) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend enrich is restricted to 127.0.0.1."
    );
  }

  if (parsed.pathname !== LOCAL_BACKEND_ENRICH_PATH) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend enrich path must be /enrich."
    );
  }

  const port =
    parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : 80;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend enrich port is invalid."
    );
  }
}

function isLocalBackendEnrichmentResponse(
  value: unknown
): value is LocalBackendEnrichmentResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!isEnrichmentSourceResult(record.source)) {
    return false;
  }
  if (!Array.isArray(record.sources)) {
    return false;
  }
  return record.sources.every((entry) => isEnrichmentSourceResult(entry));
}

export function parseLocalBackendEnrichmentResponse(
  payload: unknown
): LocalBackendEnrichmentResponse | null {
  if (!isLocalBackendEnrichmentResponse(payload)) {
    return null;
  }
  return payload;
}

export type LocalBackendEnrichmentDeps = {
  fetch?: typeof fetch;
  host?: string;
  port?: number;
  timeoutMs?: number;
};

export async function requestLocalBackendEnrichment(
  input: LocalBackendEnrichmentInput,
  deps: LocalBackendEnrichmentDeps = {}
): Promise<LocalBackendEnrichmentResponse | null> {
  const fetchImpl = deps.fetch ?? fetch;
  const host = deps.host ?? DEFAULT_LOCAL_BACKEND_HOST;
  const port = deps.port ?? DEFAULT_LOCAL_BACKEND_PORT;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_LOCAL_BACKEND_REQUEST_TIMEOUT_MS;
  const url = buildLocalBackendEnrichUrl(host, port);
  assertLocalBackendEnrichUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: input.value,
        iocType: input.iocType,
        sourceId: input.sourceId,
        bypassCache: input.bypassCache === true,
        enabledSources: input.enabledSources,
        cacheTtlSeconds: input.cacheTtlSeconds,
        sourceCacheTtlSeconds: input.sourceCacheTtlSeconds,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return parseLocalBackendEnrichmentResponse(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
