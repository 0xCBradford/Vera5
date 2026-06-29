import type { EnrichmentExportDocument } from "./enrichmentExport";
import { buildEnrichmentSummaryPromptMessages } from "./aiSummaryPrompt";
import { requestLocalBackendSummarize } from "./localBackendSummarize";
import {
  findAsnsInText,
  findCidrsInText,
  findCvesInText,
  findDomainsInText,
  findEmailsInText,
  findFilepathsInText,
  findHashesInText,
  findIpv4InText,
  findOnionsInText,
  findUrlsInText,
  refangIndicatorText,
  type IocMatch,
} from "./iocRegex";
import { COMPOSITE_RISK_LABEL } from "./scoring";

export const DEFAULT_LOCAL_LLM_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT =
  "http://127.0.0.1:11434/v1/chat/completions";
export const DEFAULT_LOCAL_LLM_SUMMARY_MODEL = "local";
export const DEFAULT_LOCAL_LLM_SUMMARY_REQUEST_TIMEOUT_MS = 30_000;

export const LOCAL_LLM_SUMMARY_ERROR_CODE = {
  TIMEOUT: "timeout",
  CONNECTION_REFUSED: "connection_refused",
  HTTP_ERROR: "http_error",
  INVALID_JSON: "invalid_json",
  MALFORMED_RESPONSE: "malformed_response",
  GROUNDING_VIOLATION: "grounding_violation",
} as const;

export type LocalLlmSummaryErrorCode =
  (typeof LOCAL_LLM_SUMMARY_ERROR_CODE)[keyof typeof LOCAL_LLM_SUMMARY_ERROR_CODE];

export type LocalLlmSummarySuccess = {
  ok: true;
  markdown: string;
};

export type LocalLlmSummaryFailure = {
  ok: false;
  errorCode: LocalLlmSummaryErrorCode;
  errorMessage: string;
};

export type LocalLlmSummaryResult = LocalLlmSummarySuccess | LocalLlmSummaryFailure;

export const LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION = {
  UNGROUNDED_INDICATOR: "ungrounded_indicator",
  VERDICT_LANGUAGE: "verdict_language",
  UNGROUNDED_DETECTION_COUNT: "ungrounded_detection_count",
  INVENTED_COMPOSITE_SCORE: "invented_composite_score",
  SEVERITY_OVERRIDE: "severity_override",
} as const;

export type LocalLlmSummaryGuardrailViolation =
  (typeof LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION)[keyof typeof LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION];

export type LocalLlmSummaryGroundingValid = {
  ok: true;
};

export type LocalLlmSummaryGroundingFailure = {
  ok: false;
  violation: LocalLlmSummaryGuardrailViolation;
  errorMessage: string;
};

export type LocalLlmSummaryGroundingResult =
  | LocalLlmSummaryGroundingValid
  | LocalLlmSummaryGroundingFailure;

export class LocalLlmOutboundBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalLlmOutboundBlockedError";
  }
}

export type LocalLlmSummaryRequestInput = {
  endpointUrl: string;
  exportDocument: EnrichmentExportDocument;
  model?: string;
};

export type LocalLlmSummaryRequestDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const LOCAL_LLM_SUMMARY_FOOTER_MARKER =
  "---\n\n**AI summary (local, unverified)**";

const LOCAL_LLM_SUMMARY_VERDICT_PATTERNS: readonly RegExp[] = [
  /\bconfirmed malicious\b/i,
  /\bconfirmed benign\b/i,
  /\bdefinitely malicious\b/i,
  /\bdefinitely benign\b/i,
  /\b100%\s+malicious\b/i,
  /\b100%\s+benign\b/i,
];

const LOCAL_LLM_SUMMARY_DETECTION_COUNT_PATTERN =
  /\b\d+\s+(?:detections|detection hits|malicious detections|engines detected|vendor detections|security vendors|positive detections)\b/gi;

const LOCAL_LLM_SUMMARY_COMPOSITE_SCORE_PATTERN = /\b\d{1,3}\s*\/\s*100\b/g;

const LOCAL_LLM_SUMMARY_SEVERITY_OVERRIDE_PATTERNS: readonly RegExp[] = [
  /\b(high|critical|severe)\s+risk\b/i,
  /\brisk\s+(?:is\s+)?(?:high|critical|severe)\b/i,
  /\b(critical|severe)\s+severity\b/i,
];

function createLocalLlmSummaryFailure(
  errorCode: LocalLlmSummaryErrorCode,
  errorMessage: string
): LocalLlmSummaryFailure {
  return { ok: false, errorCode, errorMessage };
}

function createLocalLlmSummaryGroundingFailure(
  violation: LocalLlmSummaryGuardrailViolation,
  errorMessage: string
): LocalLlmSummaryGroundingFailure {
  return { ok: false, violation, errorMessage };
}

export function assertLocalLlmSummaryEndpointUrl(url: string | URL): void {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    throw new LocalLlmOutboundBlockedError("Local LLM summary URL is invalid.");
  }

  if (parsed.protocol !== "http:") {
    throw new LocalLlmOutboundBlockedError(
      "Local LLM summary requires HTTP on 127.0.0.1."
    );
  }

  if (parsed.hostname !== DEFAULT_LOCAL_LLM_HOST) {
    throw new LocalLlmOutboundBlockedError(
      "Local LLM summary is restricted to 127.0.0.1."
    );
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new LocalLlmOutboundBlockedError(
      "Local LLM summary URL must not embed credentials."
    );
  }

  const port =
    parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : 80;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new LocalLlmOutboundBlockedError(
      "Local LLM summary port is invalid."
    );
  }
}

export function buildLocalLlmSummaryRequestBody(
  input: LocalLlmSummaryRequestInput
): {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  stream: false;
} {
  const prompts = buildEnrichmentSummaryPromptMessages(input.exportDocument);
  return {
    model: input.model ?? DEFAULT_LOCAL_LLM_SUMMARY_MODEL,
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    stream: false,
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

function isConnectionRefusedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.toLowerCase().includes("connection refused")) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    return (cause as { code?: string }).code === "ECONNREFUSED";
  }

  return false;
}

export function classifyLocalLlmSummaryFetchError(
  error: unknown
): LocalLlmSummaryFailure {
  if (isAbortError(error)) {
    return createLocalLlmSummaryFailure(
      LOCAL_LLM_SUMMARY_ERROR_CODE.TIMEOUT,
      "Local LLM request timed out."
    );
  }

  if (isConnectionRefusedError(error)) {
    return createLocalLlmSummaryFailure(
      LOCAL_LLM_SUMMARY_ERROR_CODE.CONNECTION_REFUSED,
      "Local LLM endpoint refused the connection on 127.0.0.1."
    );
  }

  return createLocalLlmSummaryFailure(
    LOCAL_LLM_SUMMARY_ERROR_CODE.CONNECTION_REFUSED,
    "Local LLM endpoint is unreachable on 127.0.0.1."
  );
}

export function mapLocalLlmSummaryHttpStatus(status: number): LocalLlmSummaryFailure {
  if (status === 408) {
    return createLocalLlmSummaryFailure(
      LOCAL_LLM_SUMMARY_ERROR_CODE.TIMEOUT,
      "Local LLM request timed out."
    );
  }

  return createLocalLlmSummaryFailure(
    LOCAL_LLM_SUMMARY_ERROR_CODE.HTTP_ERROR,
    `Local LLM returned HTTP ${status}.`
  );
}

export function parseLocalLlmSummaryResponse(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = choices[0];
  if (typeof firstChoice !== "object" || firstChoice === null) {
    return null;
  }

  const message = (firstChoice as { message?: { content?: unknown } }).message;
  if (typeof message?.content !== "string") {
    return null;
  }

  const trimmed = message.content.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function collectEnrichmentExportTextCorpus(
  exportDocument: EnrichmentExportDocument
): string[] {
  const corpus: string[] = [];

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      corpus.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const entry of Object.values(value)) {
        visit(entry);
      }
    }
  };

  visit(exportDocument);
  return corpus;
}

function normalizeGroundingText(value: string): string {
  return refangIndicatorText(value).trim().toLowerCase();
}

function isPhrasePresentInCorpus(phrase: string, corpus: string[]): boolean {
  const normalizedPhrase = normalizeGroundingText(phrase);
  if (normalizedPhrase.length === 0) {
    return true;
  }
  return corpus.some((entry) =>
    normalizeGroundingText(entry).includes(normalizedPhrase)
  );
}

function stripLocalLlmSummaryFooter(markdown: string): string {
  const footerIndex = markdown.indexOf(LOCAL_LLM_SUMMARY_FOOTER_MARKER);
  return footerIndex >= 0 ? markdown.slice(0, footerIndex) : markdown;
}

function dedupeIndicatorMatches(matches: readonly IocMatch[]): IocMatch[] {
  const seen = new Set<string>();
  const deduped: IocMatch[] = [];

  for (const match of matches) {
    const key = `${match.type}:${normalizeGroundingText(match.value)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(match);
  }

  return deduped;
}

function findAllSummaryIndicatorMatches(text: string): IocMatch[] {
  const urls = findUrlsInText(text);
  const urlSpans = urls.map((match) => ({ start: match.start, end: match.end }));
  const ipv4 = findIpv4InText(text, { includePrivateIpv4: true }).filter(
    (match) =>
      !urlSpans.some(
        (span) => match.start >= span.start && match.end <= span.end
      )
  );
  const ipv4Spans = ipv4.map((match) => ({ start: match.start, end: match.end }));
  const occupiedSpans = [...urlSpans, ...ipv4Spans];
  const domains = findDomainsInText(text, occupiedSpans);
  const hashes = findHashesInText(text, occupiedSpans);
  const cves = findCvesInText(text, occupiedSpans);
  const emails = findEmailsInText(text);
  const asns = findAsnsInText(text);
  const cidrs = findCidrsInText(text);
  const onions = findOnionsInText(text);
  const filepaths = findFilepathsInText(text);

  return dedupeIndicatorMatches([
    ...urls,
    ...ipv4,
    ...domains,
    ...hashes,
    ...cves,
    ...emails,
    ...asns,
    ...cidrs,
    ...onions,
    ...filepaths,
  ]);
}

function resolveExportCompositeSignal(
  exportDocument: EnrichmentExportDocument
): number | null {
  const score = exportDocument.score;
  if (score.mode === "available" || score.mode === "insufficient") {
    return score.compositeSignal;
  }
  return null;
}

function resolveExportRiskLabel(
  exportDocument: EnrichmentExportDocument
): string | null {
  const score = exportDocument.score;
  if (score.mode === "available" || score.mode === "insufficient") {
    return score.label;
  }
  return null;
}

export function validateLocalLlmSummaryGrounding(
  exportDocument: EnrichmentExportDocument,
  markdown: string
): LocalLlmSummaryGroundingResult {
  const corpus = collectEnrichmentExportTextCorpus(exportDocument);
  const body = stripLocalLlmSummaryFooter(markdown);

  for (const match of findAllSummaryIndicatorMatches(body)) {
    if (!isPhrasePresentInCorpus(match.value, corpus)) {
      return createLocalLlmSummaryGroundingFailure(
        LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.UNGROUNDED_INDICATOR,
        "Local LLM summary cites an indicator not present in enrichment JSON."
      );
    }
  }

  for (const pattern of LOCAL_LLM_SUMMARY_VERDICT_PATTERNS) {
    const verdictMatch = body.match(pattern);
    if (verdictMatch && !isPhrasePresentInCorpus(verdictMatch[0], corpus)) {
      return createLocalLlmSummaryGroundingFailure(
        LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.VERDICT_LANGUAGE,
        "Local LLM summary uses verdict language not supported by enrichment JSON."
      );
    }
  }

  for (const detectionMatch of body.matchAll(
    LOCAL_LLM_SUMMARY_DETECTION_COUNT_PATTERN
  )) {
    if (!isPhrasePresentInCorpus(detectionMatch[0], corpus)) {
      return createLocalLlmSummaryGroundingFailure(
        LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.UNGROUNDED_DETECTION_COUNT,
        "Local LLM summary cites vendor detection counts not present in enrichment JSON."
      );
    }
  }

  if (resolveExportCompositeSignal(exportDocument) === null) {
    for (const scoreMatch of body.matchAll(
      LOCAL_LLM_SUMMARY_COMPOSITE_SCORE_PATTERN
    )) {
      if (!isPhrasePresentInCorpus(scoreMatch[0], corpus)) {
        return createLocalLlmSummaryGroundingFailure(
          LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.INVENTED_COMPOSITE_SCORE,
          "Local LLM summary invents a /100 score not present in enrichment JSON."
        );
      }
    }
  }

  const exportRiskLabel = resolveExportRiskLabel(exportDocument);
  if (exportRiskLabel === COMPOSITE_RISK_LABEL.UNKNOWN) {
    for (const pattern of LOCAL_LLM_SUMMARY_SEVERITY_OVERRIDE_PATTERNS) {
      const severityMatch = body.match(pattern);
      if (severityMatch && !isPhrasePresentInCorpus(severityMatch[0], corpus)) {
        return createLocalLlmSummaryGroundingFailure(
          LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.SEVERITY_OVERRIDE,
          "Local LLM summary overrides the exported risk band."
        );
      }
    }
  }

  return { ok: true };
}

export async function requestLocalLlmSummary(
  input: LocalLlmSummaryRequestInput,
  deps: LocalLlmSummaryRequestDeps = {}
): Promise<LocalLlmSummaryResult> {
  assertLocalLlmSummaryEndpointUrl(input.endpointUrl);

  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs =
    deps.timeoutMs ?? DEFAULT_LOCAL_LLM_SUMMARY_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(input.endpointUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildLocalLlmSummaryRequestBody(input)),
      signal: controller.signal,
    });

    if (!response.ok) {
      return mapLocalLlmSummaryHttpStatus(response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return createLocalLlmSummaryFailure(
        LOCAL_LLM_SUMMARY_ERROR_CODE.INVALID_JSON,
        "Local LLM returned invalid JSON."
      );
    }

    const markdown = parseLocalLlmSummaryResponse(payload);
    if (!markdown) {
      return createLocalLlmSummaryFailure(
        LOCAL_LLM_SUMMARY_ERROR_CODE.MALFORMED_RESPONSE,
        "Local LLM returned an unexpected response."
      );
    }

    const grounding = validateLocalLlmSummaryGrounding(
      input.exportDocument,
      markdown
    );
    if (!grounding.ok) {
      return createLocalLlmSummaryFailure(
        LOCAL_LLM_SUMMARY_ERROR_CODE.GROUNDING_VIOLATION,
        grounding.errorMessage
      );
    }

    return { ok: true, markdown };
  } catch (error) {
    return classifyLocalLlmSummaryFetchError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ResolveLocalLlmSummaryRequestInput = {
  exportDocument: EnrichmentExportDocument;
  useLocalBackend: boolean;
  endpointUrl?: string;
};

export async function resolveLocalLlmSummaryRequest(
  input: ResolveLocalLlmSummaryRequestInput,
  deps: LocalLlmSummaryRequestDeps = {}
): Promise<LocalLlmSummaryResult> {
  if (input.useLocalBackend) {
    const backendResult = await requestLocalBackendSummarize(input.exportDocument, {
      fetch: deps.fetch,
      timeoutMs: deps.timeoutMs,
    });
    if (backendResult !== null) {
      return backendResult;
    }
  }

  return requestLocalLlmSummary(
    {
      endpointUrl: input.endpointUrl ?? DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
      exportDocument: input.exportDocument,
    },
    deps
  );
}
