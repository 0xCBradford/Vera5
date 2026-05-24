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
  attribution: EnrichmentSourceAttribution | undefined
): boolean {
  if (!attribution?.sourceLabel.trim()) {
    return false;
  }
  return enrichmentState === "ready" || enrichmentState === "error";
}

export const HOVER_CARD_OPEN_SETTINGS_LABEL = "Open settings";

export function shouldShowMissingKeyAction(
  enrichmentState?: HoverCardEnrichmentState,
  errorCode?: string
): boolean {
  return enrichmentState === "error" && errorCode === "missing_key";
}

export function shouldShowRateLimitRetryHint(
  enrichmentState?: HoverCardEnrichmentState,
  retryHint?: string
): boolean {
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

