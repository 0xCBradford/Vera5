import type { EnrichmentExportDocument } from "./enrichmentExport";
import {
  DEFAULT_LOCAL_BACKEND_HOST,
  DEFAULT_LOCAL_BACKEND_PORT,
  LocalBackendOutboundBlockedError,
} from "./localBackendEnrichment";

export const LOCAL_BACKEND_SUMMARIZE_PATH = "/summarize";
export const DEFAULT_LOCAL_BACKEND_SUMMARIZE_TIMEOUT_MS = 30_000;

export type LocalBackendSummarizeSuccess = {
  ok: true;
  markdown: string;
};

export type LocalBackendSummarizeFailure = {
  ok: false;
  errorCode:
    | "timeout"
    | "connection_refused"
    | "http_error"
    | "invalid_json"
    | "malformed_response"
    | "grounding_violation";
  errorMessage: string;
};

export type LocalBackendSummarizeResult =
  | LocalBackendSummarizeSuccess
  | LocalBackendSummarizeFailure;

export type LocalBackendSummarizeDeps = {
  fetch?: typeof fetch;
  host?: string;
  port?: number;
  timeoutMs?: number;
};

export function buildLocalBackendSummarizeUrl(
  host: string = DEFAULT_LOCAL_BACKEND_HOST,
  port: number = DEFAULT_LOCAL_BACKEND_PORT
): string {
  return `http://${host}:${port}${LOCAL_BACKEND_SUMMARIZE_PATH}`;
}

export function assertLocalBackendSummarizeUrl(url: string | URL): void {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    throw new LocalBackendOutboundBlockedError(
      "Local backend summarize URL is invalid."
    );
  }

  if (parsed.protocol !== "http:") {
    throw new LocalBackendOutboundBlockedError(
      "Local backend summarize requires HTTP on localhost."
    );
  }

  if (parsed.hostname !== DEFAULT_LOCAL_BACKEND_HOST) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend summarize is restricted to 127.0.0.1."
    );
  }

  if (parsed.pathname !== LOCAL_BACKEND_SUMMARIZE_PATH) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend summarize path must be /summarize."
    );
  }

  const port =
    parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : 80;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new LocalBackendOutboundBlockedError(
      "Local backend summarize port is invalid."
    );
  }
}

function isLocalBackendSummarizeErrorCode(
  value: unknown
): value is LocalBackendSummarizeFailure["errorCode"] {
  return (
    value === "timeout" ||
    value === "connection_refused" ||
    value === "http_error" ||
    value === "invalid_json" ||
    value === "malformed_response" ||
    value === "grounding_violation"
  );
}

export function parseLocalBackendSummarizeResponse(
  payload: unknown
): LocalBackendSummarizeResult | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.ok === true) {
    if (typeof record.markdown !== "string") {
      return null;
    }
    const trimmed = record.markdown.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return { ok: true, markdown: trimmed };
  }

  if (record.ok === false) {
    if (
      !isLocalBackendSummarizeErrorCode(record.errorCode) ||
      typeof record.errorMessage !== "string"
    ) {
      return null;
    }
    return {
      ok: false,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
    };
  }

  return null;
}

export async function requestLocalBackendSummarize(
  exportDocument: EnrichmentExportDocument,
  deps: LocalBackendSummarizeDeps = {}
): Promise<LocalBackendSummarizeResult | null> {
  const fetchImpl = deps.fetch ?? fetch;
  const host = deps.host ?? DEFAULT_LOCAL_BACKEND_HOST;
  const port = deps.port ?? DEFAULT_LOCAL_BACKEND_PORT;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_LOCAL_BACKEND_SUMMARIZE_TIMEOUT_MS;
  const url = buildLocalBackendSummarizeUrl(host, port);
  assertLocalBackendSummarizeUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(exportDocument),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return parseLocalBackendSummarizeResponse(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
