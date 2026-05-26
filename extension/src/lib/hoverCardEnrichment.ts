export const ENRICHMENT_SOURCE = {
  ABUSEIPDB: "abuseipdb",
  OTX: "otx",
  URLSCAN: "urlscan",
  GREYNOISE: "greynoise",
} as const;

export type EnrichmentSourceId =
  (typeof ENRICHMENT_SOURCE)[keyof typeof ENRICHMENT_SOURCE];

export const ENRICHMENT_SOURCE_ORDER: EnrichmentSourceId[] = [
  ENRICHMENT_SOURCE.ABUSEIPDB,
  ENRICHMENT_SOURCE.OTX,
  ENRICHMENT_SOURCE.URLSCAN,
  ENRICHMENT_SOURCE.GREYNOISE,
];

export const ENRICHMENT_SOURCE_LABELS: Record<EnrichmentSourceId, string> = {
  abuseipdb: "AbuseIPDB",
  otx: "OTX",
  urlscan: "URLScan.io",
  greynoise: "GreyNoise",
};

export type HoverCardEnrichmentState = "empty" | "loading" | "error" | "ready";

export const DEFAULT_HOVER_CARD_SUMMARY =
  "Threat intelligence summary is not available yet.";

export const HOVER_CARD_LOADING_SUMMARY = "Loading threat intelligence…";

export const HOVER_CARD_ERROR_SUMMARY =
  "Threat intelligence could not be loaded.";

export type EnrichmentDisplay = {
  text: string;
  variant: HoverCardEnrichmentState;
};

export type EnrichmentSourceAttribution = {
  sourceLabel: string;
  fromCache?: boolean;
};

export function formatEnrichmentSourceAttribution(
  attribution: EnrichmentSourceAttribution,
  enrichmentState?: HoverCardEnrichmentState
): string {
  if (enrichmentState === "error") {
    return `Source: ${attribution.sourceLabel}`;
  }
  if (attribution.fromCache) {
    return `Source: ${attribution.sourceLabel} · cached`;
  }
  return `Source: ${attribution.sourceLabel} · live`;
}

export function shouldShowEnrichmentSourceAttribution(
  enrichmentState: HoverCardEnrichmentState | undefined,
  attribution: EnrichmentSourceAttribution | undefined,
  sourceResults?: readonly HoverCardSourceEntry[]
): boolean {
  if (shouldShowMultiSourceResults(sourceResults)) {
    return false;
  }
  if (!attribution?.sourceLabel.trim()) {
    return false;
  }
  return enrichmentState === "ready" || enrichmentState === "error";
}

export const HOVER_CARD_OPEN_SETTINGS_LABEL = "Open settings";

export const HOVER_CARD_RAW_JSON_SUMMARY_LABEL = "Raw response";

export function shouldShowMissingKeyAction(
  enrichmentState?: HoverCardEnrichmentState,
  errorCode?: string,
  sourceResults?: readonly HoverCardSourceEntry[]
): boolean {
  if (shouldShowMultiSourceResults(sourceResults)) {
    return false;
  }
  return enrichmentState === "error" && errorCode === "missing_key";
}

export function shouldShowRateLimitRetryHint(
  enrichmentState?: HoverCardEnrichmentState,
  retryHint?: string,
  sourceResults?: readonly HoverCardSourceEntry[]
): boolean {
  if (shouldShowMultiSourceResults(sourceResults)) {
    return false;
  }
  return enrichmentState === "error" && Boolean(retryHint?.trim());
}

export type DisabledSourcePlaceholder = {
  sourceId: EnrichmentSourceId;
  label: string;
  message: string;
};

export function formatDisabledSourceMessage(label: string): string {
  return `${label} is disabled. Enable it in extension settings to load enrichment.`;
}

export function buildDisabledSourcePlaceholders(
  sourceIds: readonly EnrichmentSourceId[]
): DisabledSourcePlaceholder[] {
  const ordered = ENRICHMENT_SOURCE_ORDER.filter((id) => sourceIds.includes(id));
  return ordered.map((sourceId) => {
    const label = ENRICHMENT_SOURCE_LABELS[sourceId];
    return {
      sourceId,
      label,
      message: formatDisabledSourceMessage(label),
    };
  });
}

export type HoverCardSourceEntryStatus = "ok" | "error" | "skipped";

export type HoverCardSourceEntry = {
  sourceId: EnrichmentSourceId;
  label: string;
  status: HoverCardSourceEntryStatus;
  badgeText: string;
  detail: string;
  tags?: readonly string[];
  errorCode?: string;
  retryHint?: string;
  rawVendorJson?: string;
};

export function formatSourceStatusBadge(
  status: HoverCardSourceEntryStatus
): string {
  if (status === "ok") {
    return "Live";
  }
  if (status === "error") {
    return "Error";
  }
  return "Skipped";
}

export function buildSourceStatusBadgeClassName(
  status: HoverCardSourceEntryStatus
): string {
  return `vera5-hover-card-source-badge vera5-hover-card-source-badge--${status}`;
}

export type HoverCardSourceResultInput = {
  sourceId: string;
  sourceLabel: string;
  status: HoverCardSourceEntryStatus;
  summary?: string;
  tags?: readonly string[];
  errorCode?: string;
  errorMessage?: string;
  retryHint?: string;
  rawVendorJson?: string;
};

function isKnownSourceId(sourceId: string): sourceId is EnrichmentSourceId {
  return ENRICHMENT_SOURCE_ORDER.includes(sourceId as EnrichmentSourceId);
}

function resolveSourceEntryDetail(result: HoverCardSourceResultInput): string {
  if (result.status === "ok") {
    return result.summary?.trim() || DEFAULT_HOVER_CARD_SUMMARY;
  }
  return (
    result.errorMessage?.trim() ||
    (result.status === "skipped"
      ? "Enrichment was not available for this source."
      : HOVER_CARD_ERROR_SUMMARY)
  );
}

export function buildHoverCardSourceEntry(
  result: HoverCardSourceResultInput
): HoverCardSourceEntry | null {
  if (!isKnownSourceId(result.sourceId)) {
    return null;
  }
  const entry: HoverCardSourceEntry = {
    sourceId: result.sourceId,
    label: result.sourceLabel.trim() || ENRICHMENT_SOURCE_LABELS[result.sourceId],
    status: result.status,
    badgeText: formatSourceStatusBadge(result.status),
    detail: resolveSourceEntryDetail(result),
  };
  const tags = result.tags
    ?.map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  if (tags && tags.length > 0) {
    entry.tags = tags;
  }
  if (result.errorCode) {
    entry.errorCode = result.errorCode;
  }
  if (result.retryHint) {
    entry.retryHint = result.retryHint;
  }
  const rawVendorJson = result.rawVendorJson?.trim();
  if (rawVendorJson && result.status === "ok") {
    entry.rawVendorJson = rawVendorJson;
  }
  return entry;
}

export function listSourceEntriesWithRawJson(
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): HoverCardSourceEntry[] {
  return (sourceResults ?? []).filter((entry) => Boolean(entry.rawVendorJson?.trim()));
}

export function shouldShowSingleSourceRawJson(
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): boolean {
  const entries = sourceResults ?? [];
  return entries.length === 1 && Boolean(entries[0]?.rawVendorJson?.trim());
}

export function buildHoverCardSourceEntries(
  results: readonly HoverCardSourceResultInput[]
): HoverCardSourceEntry[] {
  const byId = new Map<EnrichmentSourceId, HoverCardSourceEntry>();
  for (const result of results) {
    const entry = buildHoverCardSourceEntry(result);
    if (entry) {
      byId.set(entry.sourceId, entry);
    }
  }
  return ENRICHMENT_SOURCE_ORDER.flatMap((sourceId) => {
    const entry = byId.get(sourceId);
    return entry ? [entry] : [];
  });
}

export function shouldShowMultiSourceResults(
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): boolean {
  return (sourceResults?.length ?? 0) > 1;
}

export type MultiSourceEnrichmentView = {
  enrichmentState: HoverCardEnrichmentState;
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  sourceResults: HoverCardSourceEntry[];
};

export function resolveMultiSourceEnrichmentView(
  results: readonly HoverCardSourceResultInput[]
): MultiSourceEnrichmentView {
  const sourceResults = buildHoverCardSourceEntries(results);
  if (sourceResults.length === 0) {
    return {
      enrichmentState: "error",
      errorMessage: HOVER_CARD_ERROR_SUMMARY,
      sourceResults: [],
    };
  }

  const successful = sourceResults.filter((entry) => entry.status === "ok");
  if (successful.length > 0) {
    const primary = successful[0]!;
    return {
      enrichmentState: "ready",
      summary: primary.detail,
      tags: primary.tags,
      sourceAttribution:
        sourceResults.length === 1
          ? { sourceLabel: primary.label }
          : undefined,
      sourceResults,
    };
  }

  const primary = sourceResults[0]!;
  return {
    enrichmentState: "error",
    summary: primary.detail,
    errorMessage: primary.detail,
    errorCode: primary.errorCode,
    retryHint: primary.retryHint,
    sourceAttribution: { sourceLabel: primary.label },
    sourceResults,
  };
}

export function resolveEnrichmentDisplay(input: {
  enrichmentState?: HoverCardEnrichmentState;
  summary?: string;
  errorMessage?: string;
}): EnrichmentDisplay {
  const state = input.enrichmentState ?? "empty";

  if (state === "loading") {
    return { text: HOVER_CARD_LOADING_SUMMARY, variant: "loading" };
  }

  if (state === "error") {
    return {
      text: input.errorMessage?.trim() || HOVER_CARD_ERROR_SUMMARY,
      variant: "error",
    };
  }

  if (state === "ready") {
    return {
      text: input.summary?.trim() || DEFAULT_HOVER_CARD_SUMMARY,
      variant: "ready",
    };
  }

  return {
    text: input.summary?.trim() || DEFAULT_HOVER_CARD_SUMMARY,
    variant: "empty",
  };
}

