export {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_DESCRIPTIONS,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  formatDisabledSourceMessage,
  formatMissingApiKeySourceMessage,
  formatUnsupportedIndicatorTypeMessage,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import {
  ENRICHMENT_SOURCE_ORDER,
  ENRICHMENT_SOURCE_LABELS,
  formatDisabledSourceMessage,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import {
  formatDetectionRuleReason,
  IOC_TYPE,
  type IocMatchProvenance,
  type IocType,
} from "./iocRegex";

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

export const HOVER_CARD_ANALYST_NOTES_LABEL = "Analyst notes";
export const HOVER_CARD_ANALYST_NOTES_PLACEHOLDER =
  "Add local notes for this indicator…";
export const HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL = "Analyst notes";
export const HOVER_CARD_ANALYST_NOTES_INPUT_ID = "vera5-analyst-notes-input";

export const HOVER_CARD_IOC_LABEL_LABEL = "Label";
export const HOVER_CARD_IOC_LABEL_SECTION_ARIA_LABEL = "Indicator label";
export const HOVER_CARD_IOC_LABEL_SELECT_ID = "vera5-ioc-label-select";
export const HOVER_CARD_IOC_LABEL_NONE_VALUE = "";

export const HOVER_CARD_IOC_TIMELINE_LABEL = "Session timeline";
export const HOVER_CARD_IOC_TIMELINE_SECTION_ARIA_LABEL =
  "Session timeline for this indicator";
export const HOVER_CARD_IOC_TIMELINE_EMPTY_TEXT =
  "No session timeline for this indicator yet.";

export const HOVER_CARD_IOC_PIN_LABEL = "Pin";
export const HOVER_CARD_IOC_PINNED_LABEL = "Pinned";
export const HOVER_CARD_IOC_PIN_ARIA_LABEL = "Pin indicator for triage priority";

export const HOVER_CARD_ENRICHMENT_DISCLAIMER =
  "Enrichment uses your API keys and sends only the selected indicator value to vendors you enable—not the full page.";

export const HOVER_CARD_RISK_SCORE_DISCLAIMER =
  "The risk label is computed locally from available source signals. It is advisory only; review each source before acting.";

export type HoverCardDisclaimerInput = {
  enrichmentState?: HoverCardEnrichmentState;
  includeRiskScoreDisclaimer?: boolean;
};

export function resolveHoverCardDisclaimerLines(
  input: HoverCardDisclaimerInput = {}
): readonly string[] {
  const lines: string[] = [];
  const state = input.enrichmentState ?? "empty";
  const showEnrichmentDisclaimer =
    state === "ready" || state === "loading" || state === "error";

  if (showEnrichmentDisclaimer) {
    lines.push(HOVER_CARD_ENRICHMENT_DISCLAIMER);
  }
  if (input.includeRiskScoreDisclaimer) {
    lines.push(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  }
  return lines;
}

export const HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK =
  "Enrichment and risk score notice";

export const HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY =
  "Enrichment notice";

export function resolveHoverCardDisclaimerAriaLabel(
  input: HoverCardDisclaimerInput = {}
): string {
  const lines = resolveHoverCardDisclaimerLines(input);
  const includesRisk = lines.includes(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  const includesEnrichment = lines.includes(HOVER_CARD_ENRICHMENT_DISCLAIMER);
  if (includesRisk && includesEnrichment) {
    return HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK;
  }
  if (includesEnrichment) {
    return HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY;
  }
  if (includesRisk) {
    return "Risk score notice";
  }
  return HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY;
}

export function resolveEffectiveSourceAttribution(
  sourceAttribution: EnrichmentSourceAttribution | undefined,
  sourceResults: readonly HoverCardSourceEntry[]
): EnrichmentSourceAttribution | undefined {
  if (sourceAttribution?.sourceLabel.trim()) {
    return sourceAttribution;
  }
  if (sourceResults.length !== 1) {
    return undefined;
  }
  const entry = sourceResults[0];
  if (!entry?.label.trim()) {
    return undefined;
  }
  return {
    sourceLabel: entry.label,
    fromCache: entry.fromCache,
  };
}

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
  fromCache?: boolean;
  lastUpdatedLine?: string;
  tags?: readonly string[];
  errorCode?: string;
  retryHint?: string;
  rawVendorJson?: string;
};

export function formatHoverCardLastUpdatedLabel(
  fetchedAtIso: string
): string | undefined {
  const trimmed = fetchedAtIso.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function buildHoverCardLastUpdatedLine(
  fetchedAtIso?: string
): string | undefined {
  const label = fetchedAtIso
    ? formatHoverCardLastUpdatedLabel(fetchedAtIso)
    : undefined;
  if (!label) {
    return undefined;
  }
  return `Last updated: ${label}`;
}

export function formatSourceStatusBadge(
  status: HoverCardSourceEntryStatus,
  fromCache?: boolean
): string {
  if (status === "ok") {
    return fromCache === true ? "Cached" : "Live";
  }
  if (status === "error") {
    return "Error";
  }
  return "Skipped";
}

export function buildSourceStatusBadgeClassName(
  status: HoverCardSourceEntryStatus,
  fromCache?: boolean
): string {
  if (status === "ok" && fromCache === true) {
    return "vera5-hover-card-source-badge vera5-hover-card-source-badge--cached";
  }
  return `vera5-hover-card-source-badge vera5-hover-card-source-badge--${status}`;
}

export function getSingleSourceLastUpdatedLine(
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): string | undefined {
  if (shouldShowMultiSourceResults(sourceResults)) {
    return undefined;
  }
  return sourceResults?.[0]?.lastUpdatedLine;
}

export type HoverCardSourceResultInput = {
  sourceId: string;
  sourceLabel: string;
  status: HoverCardSourceEntryStatus;
  summary?: string;
  tags?: readonly string[];
  fromCache?: boolean;
  fetchedAt?: string;
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
  const fromCache = result.status === "ok" && result.fromCache === true;
  const entry: HoverCardSourceEntry = {
    sourceId: result.sourceId,
    label: result.sourceLabel.trim() || ENRICHMENT_SOURCE_LABELS[result.sourceId],
    status: result.status,
    fromCache,
    badgeText: formatSourceStatusBadge(result.status, fromCache),
    detail: resolveSourceEntryDetail(result),
  };
  const lastUpdatedLine = buildHoverCardLastUpdatedLine(result.fetchedAt);
  if (lastUpdatedLine) {
    entry.lastUpdatedLine = lastUpdatedLine;
  }
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

export function areAllEnrichmentSourcesDisabled(
  disabledSources: readonly EnrichmentSourceId[]
): boolean {
  return ENRICHMENT_SOURCE_ORDER.every((sourceId) =>
    disabledSources.includes(sourceId)
  );
}

export function shouldShowRiskScore(
  disabledSources: readonly EnrichmentSourceId[] | undefined,
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): boolean {
  if (areAllEnrichmentSourcesDisabled(disabledSources ?? [])) {
    return false;
  }
  return (sourceResults?.length ?? 0) > 0;
}

export function shouldShowRiskScoreSection(
  disabledSources: readonly EnrichmentSourceId[] | undefined,
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): boolean {
  if (areAllEnrichmentSourcesDisabled(disabledSources ?? [])) {
    return true;
  }
  return (sourceResults?.length ?? 0) > 0;
}

export function shouldIncludeRiskScoreDisclaimer(
  disabledSources: readonly EnrichmentSourceId[] | undefined,
  sourceResults: readonly HoverCardSourceEntry[] | undefined
): boolean {
  return shouldShowRiskScore(disabledSources, sourceResults);
}

export function shouldShowHoverCardDisclaimer(
  input: HoverCardDisclaimerInput = {}
): boolean {
  return resolveHoverCardDisclaimerLines(input).length > 0;
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
          ? {
              sourceLabel: primary.label,
              fromCache: primary.fromCache,
            }
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

export type HoverCardDisplayInput = {
  enrichmentState?: HoverCardEnrichmentState;
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
  pivotLinkCount?: number;
};

export type HoverCardDisplayView = {
  enrichment: EnrichmentDisplay;
  enrichmentTags: readonly string[];
  showTags: boolean;
  showMultiSourceResults: boolean;
  showSingleSourceRawJson: boolean;
  singleSourceRawJson?: string;
  showAttribution: boolean;
  showMissingKeyAction: boolean;
  showRateLimitRetryHint: boolean;
  singleSourceLastUpdatedLine?: string;
  showRiskScore: boolean;
  includeRiskScoreDisclaimer: boolean;
  disclaimerLines: readonly string[];
  showDisclaimer: boolean;
  showFooter: boolean;
  showBelowSummary: boolean;
  disabledSourcePlaceholders: DisabledSourcePlaceholder[];
  hasPivotLinks: boolean;
};

export function resolveHoverCardDisplayView(
  input: HoverCardDisplayInput
): HoverCardDisplayView {
  const sourceResults = input.sourceResults ?? [];
  const disabledSources = input.disabledSources ?? [];
  const enrichment = resolveEnrichmentDisplay({
    enrichmentState: input.enrichmentState,
    summary: input.summary,
    errorMessage: input.errorMessage,
  });
  const disabledSourcePlaceholders =
    buildDisabledSourcePlaceholders(disabledSources);
  const enrichmentTags = (input.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const showTags = enrichment.variant === "ready" && enrichmentTags.length > 0;
  const showMultiSourceResults = shouldShowMultiSourceResults(sourceResults);
  const showSingleSourceRawJson = shouldShowSingleSourceRawJson(sourceResults);
  const singleSourceRawJson = showSingleSourceRawJson
    ? sourceResults[0]?.rawVendorJson
    : undefined;
  const showAttribution = shouldShowEnrichmentSourceAttribution(
    enrichment.variant,
    resolveEffectiveSourceAttribution(input.sourceAttribution, sourceResults),
    sourceResults
  );
  const showMissingKeyAction = shouldShowMissingKeyAction(
    enrichment.variant,
    input.errorCode,
    sourceResults
  );
  const showRateLimitRetryHint = shouldShowRateLimitRetryHint(
    enrichment.variant,
    input.retryHint,
    sourceResults
  );
  const singleSourceLastUpdatedLine =
    getSingleSourceLastUpdatedLine(sourceResults);
  const showRiskScore = shouldShowRiskScoreSection(
    disabledSources,
    sourceResults
  );
  const includeRiskScoreDisclaimer = shouldIncludeRiskScoreDisclaimer(
    disabledSources,
    sourceResults
  );
  const disclaimerInput: HoverCardDisclaimerInput = {
    enrichmentState: enrichment.variant,
    includeRiskScoreDisclaimer,
  };
  const disclaimerLines = resolveHoverCardDisclaimerLines(disclaimerInput);
  const showDisclaimer = shouldShowHoverCardDisclaimer(disclaimerInput);
  const hasPivotLinks = (input.pivotLinkCount ?? 0) > 0;
  const showFooter =
    hasPivotLinks ||
    disabledSourcePlaceholders.length > 0 ||
    showMultiSourceResults;
  const showBelowSummary =
    showFooter ||
    showTags ||
    Boolean(showSingleSourceRawJson && singleSourceRawJson) ||
    showAttribution ||
    showMissingKeyAction ||
    showRateLimitRetryHint ||
    Boolean(singleSourceLastUpdatedLine) ||
    showRiskScore ||
    showDisclaimer;

  return {
    enrichment,
    enrichmentTags,
    showTags,
    showMultiSourceResults,
    showSingleSourceRawJson,
    singleSourceRawJson,
    showAttribution,
    showMissingKeyAction,
    showRateLimitRetryHint,
    singleSourceLastUpdatedLine,
    showRiskScore,
    includeRiskScoreDisclaimer,
    disclaimerLines,
    showDisclaimer,
    showFooter,
    showBelowSummary,
    disabledSourcePlaceholders,
    hasPivotLinks,
  };
}

export const HOVER_CARD_WHY_DETECTED_HEADING = "Why detected?";
export const HOVER_CARD_WHY_DETECTED_SECTION_ARIA_LABEL = "Why detected?";

const DETECTION_TYPE_LABEL: Record<IocType, string> = {
  [IOC_TYPE.IPV4]: "IPv4 address",
  [IOC_TYPE.DOMAIN]: "Domain",
  [IOC_TYPE.URL]: "URL",
  [IOC_TYPE.MD5]: "MD5 hash",
  [IOC_TYPE.SHA1]: "SHA1 hash",
  [IOC_TYPE.SHA256]: "SHA256 hash",
  [IOC_TYPE.CVE]: "CVE ID",
};

export function formatDetectionTypeLabel(type: IocType): string {
  return DETECTION_TYPE_LABEL[type];
}

export type WhyDetectedOverlapView = {
  typeLabel: string;
  value: string;
  reason: string;
};

export type WhyDetectedView = {
  typeLabel: string;
  reason: string;
  sourceTextHint: string;
  ignoredOverlaps: WhyDetectedOverlapView[];
};

export function buildWhyDetectedView(
  input: IocMatchProvenance & { type: IocType }
): WhyDetectedView | null {
  if (!input.ruleId || !input.sourceTextHint) {
    return null;
  }
  return {
    typeLabel: formatDetectionTypeLabel(input.type),
    reason: formatDetectionRuleReason(input.ruleId),
    sourceTextHint: input.sourceTextHint,
    ignoredOverlaps: (input.ignoredOverlaps ?? []).map((overlap) => ({
      typeLabel: formatDetectionTypeLabel(overlap.type),
      value: overlap.value,
      reason: formatDetectionRuleReason(overlap.ruleId),
    })),
  };
}

export const HOVER_CARD_ON_PAGE_VALUE_LABEL = "On page:";
export const HOVER_CARD_REFANGED_VALUE_LABEL = "Refanged:";
export const HOVER_CARD_COPY_INDICATOR_LABEL = "Copy Indicator";
export const HOVER_CARD_COPY_DEFANGED_LABEL = "Copy defanged";
export const HOVER_CARD_COPY_REFANGED_LABEL = "Copy refanged";
export const HOVER_CARD_COPY_COPIED_LABEL = "Copied";
export const HOVER_CARD_OPEN_LIVE_URL_LABEL = "Open live URL";
export const HOVER_CARD_OPEN_LIVE_URL_CONFIRM_MESSAGE =
  "This opens the live URL in a new browser tab. The destination may be malicious or unreachable. Continue?";

export const PRE_QUERY_DISCLOSURE_SECTION_ARIA_LABEL = "Pre-query notice";
export const PRE_QUERY_DISCLOSURE_HEADING = "Before querying vendors";
export const PRE_QUERY_DISCLOSURE_SEND_LABEL = "Send query";
export const PRE_QUERY_DISCLOSURE_CANCEL_LABEL = "Cancel";
export const PRE_QUERY_DISCLOSURE_REMEMBER_LABEL =
  "Don't show this notice again";

export type IndicatorValuePresentation = {
  onPageValue: string;
  refangedValue: string;
  showRefangedPair: boolean;
};

export type IndicatorCopyAction = {
  copyValue: string;
  label: string;
  ariaLabel: string;
};

export function resolveIndicatorValuePresentation(input: {
  value: string;
  displayValue?: string;
}): IndicatorValuePresentation {
  const refangedValue = input.value;
  const onPageValue = input.displayValue ?? input.value;
  return {
    onPageValue,
    refangedValue,
    showRefangedPair: onPageValue !== refangedValue,
  };
}

export function resolveIndicatorCopyActions(
  presentation: IndicatorValuePresentation
): IndicatorCopyAction[] {
  if (presentation.showRefangedPair) {
    return [
      {
        copyValue: presentation.onPageValue,
        label: HOVER_CARD_COPY_DEFANGED_LABEL,
        ariaLabel: `Copy defanged indicator ${presentation.onPageValue}`,
      },
      {
        copyValue: presentation.refangedValue,
        label: HOVER_CARD_COPY_REFANGED_LABEL,
        ariaLabel: `Copy refanged indicator ${presentation.refangedValue}`,
      },
    ];
  }

  return [
    {
      copyValue: presentation.refangedValue,
      label: HOVER_CARD_COPY_INDICATOR_LABEL,
      ariaLabel: `Copy indicator ${presentation.refangedValue}`,
    },
  ];
}

export function shouldOfferLiveUrlOpen(type: IocType): boolean {
  return type === IOC_TYPE.URL;
}

export function confirmOpenLiveUrl(win: Pick<Window, "confirm"> = window): boolean {
  return win.confirm(HOVER_CARD_OPEN_LIVE_URL_CONFIRM_MESSAGE);
}

export function openLiveUrlInNewTab(
  url: string,
  win: Pick<Window, "open"> = window
): void {
  win.open(url, "_blank", "noopener,noreferrer");
}