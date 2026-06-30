import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
import {
  beginPreQueryDisclosureWait,
  cancelPreQueryDisclosure,
  resolvePreQueryDisclosure,
  shouldShowPreQueryNotices,
} from "../lib/enrichmentPolicy";
import { isExtensionContextInvalidated, logUnlessBenignExtensionError } from "../lib/extensionContext";
import { recordInvestigationHistoryEntry } from "../lib/investigationHistoryStorage";
import type { IocType } from "../lib/iocRegex";
import {
  hasAnyEnabledLiveEnrichmentSource,
  listEnabledLiveEnrichmentSourceIds,
} from "../lib/enrichmentSourceSelection";
import type { EnrichmentSourceId } from "../lib/enrichmentSourceRegistry";
import { resolveMultiSourceEnrichmentView } from "../lib/hoverCardEnrichment";
import {
  requestEnrichmentFromServiceWorker,
  type ContentEnrichmentSourceResult,
} from "./enrichmentMessageClient";
import {
  getEnrichmentSourceEnabledForContent,
  getShowPreQueryNoticesForContent,
  setShowPreQueryNoticesForContent,
} from "./enrichmentSourceStorage";
import { isEnrichmentAllowedForCurrentPage } from "./domainPolicyStorage";
import { isOutboundEnrichmentAllowedForIndicator } from "./internalAssetPolicyStorage";
import {
  getLastHoverCardAnchor,
  getLastHoverCardPayload,
  showHoverCardNearAnchor,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import { setAutoEnrichmentFetcher } from "./enrichmentAutoFetch";

export const DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS = 400;

export const DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE =
  "Threat intelligence queries are blocked for this site by domain policy.";

export const INTERNAL_ASSET_ENRICHMENT_BLOCKED_MESSAGE =
  "Threat intelligence queries are blocked for this indicator because it matches a configured internal asset list.";

export type EnrichmentTrustGateBlock = {
  errorCode: string;
  errorMessage: string;
};

export type EnrichmentTrustGateResult =
  | { allowed: true }
  | ({ allowed: false } & EnrichmentTrustGateBlock);

export type RunBackgroundEnrichmentResult =
  | "completed"
  | "blocked"
  | "cancelled"
  | "skipped";

let hoverEnrichmentTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelPendingHoverEnrichment(): void {
  if (hoverEnrichmentTimer !== null) {
    clearTimeout(hoverEnrichmentTimer);
    hoverEnrichmentTimer = null;
  }
  cancelPreQueryDisclosure();
}

export async function resolvePageEnrichmentTrustGate(
  doc: Document = document
): Promise<EnrichmentTrustGateResult> {
  const enrichAllowed = await isEnrichmentAllowedForCurrentPage(doc);
  if (!enrichAllowed) {
    return {
      allowed: false,
      errorCode: ENRICHMENT_ERROR_CODE.DOMAIN_POLICY,
      errorMessage: DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
    };
  }
  return { allowed: true };
}

export async function resolveIndicatorEnrichmentTrustGate(
  value: string,
  type: IocType
): Promise<EnrichmentTrustGateResult> {
  const indicatorAllowed = await isOutboundEnrichmentAllowedForIndicator(value, type);
  if (!indicatorAllowed) {
    return {
      allowed: false,
      errorCode: ENRICHMENT_ERROR_CODE.INTERNAL_ASSET,
      errorMessage: INTERNAL_ASSET_ENRICHMENT_BLOCKED_MESSAGE,
    };
  }
  return { allowed: true };
}

export function presentEnrichmentTrustGateBlocked(
  payload: HoverCardOverlayPayload,
  block: EnrichmentTrustGateBlock,
  doc: Document = document
): void {
  applyIndicatorDetailPayload(
    {
      ...payload,
      enrichmentState: "error",
      errorCode: block.errorCode,
      errorMessage: block.errorMessage,
      preQueryDisclosure: undefined,
    },
    doc
  );
}

export function scheduleDebouncedBackgroundEnrichment(
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  debounceMs: number = DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS
): void {
  cancelPendingHoverEnrichment();
  hoverEnrichmentTimer = setTimeout(() => {
    hoverEnrichmentTimer = null;
    void runBackgroundEnrichment(payload, doc);
  }, debounceMs);
}

function mapEnrichmentResultsToPayload(
  base: HoverCardOverlayPayload,
  results: readonly ContentEnrichmentSourceResult[]
): HoverCardOverlayPayload {
  const view = resolveMultiSourceEnrichmentView(results);
  return {
    ...base,
    enrichmentState: view.enrichmentState,
    summary: view.summary,
    tags: view.tags,
    sourceAttribution: view.sourceAttribution,
    errorMessage: view.errorMessage,
    errorCode: view.errorCode,
    retryHint: view.retryHint,
    sourceResults: view.sourceResults,
    preQueryDisclosure: undefined,
  };
}

export type BackgroundEnrichmentOptions = {
  bypassCache?: boolean;
};

function applyIndicatorDetailPayload(
  payload: HoverCardOverlayPayload,
  doc: Document
): boolean {
  const anchor = getLastHoverCardAnchor();
  const hoverPayload = getLastHoverCardPayload();
  if (anchor && hoverPayload?.value === payload.value) {
    showHoverCardNearAnchor(anchor, payload, doc);
    return true;
  }

  return false;
}

function hasIndicatorDetailTarget(
  payload: HoverCardOverlayPayload
): boolean {
  const anchor = getLastHoverCardAnchor();
  const hoverPayload = getLastHoverCardPayload();
  return Boolean(anchor && hoverPayload?.value === payload.value);
}

async function confirmPreQueryDisclosureIfRequired(
  payload: HoverCardOverlayPayload,
  enabledLiveSourceIds: readonly EnrichmentSourceId[],
  doc: Document
): Promise<boolean> {
  const showNotices = await getShowPreQueryNoticesForContent();
  if (!shouldShowPreQueryNotices(showNotices) || enabledLiveSourceIds.length === 0) {
    return true;
  }

  const decisionPromise = beginPreQueryDisclosureWait();
  applyIndicatorDetailPayload(
    {
      ...payload,
      enrichmentState: "empty",
      preQueryDisclosure: {
        sourceIds: enabledLiveSourceIds,
      },
    },
    doc
  );

  const decision = await decisionPromise;
  if (decision.rememberDismiss) {
    await setShowPreQueryNoticesForContent(false);
  }
  return decision.proceed;
}

async function executeBackgroundEnrichmentFetch(
  payload: HoverCardOverlayPayload,
  doc: Document,
  options: BackgroundEnrichmentOptions
): Promise<void> {
  applyIndicatorDetailPayload(
    { ...payload, enrichmentState: "loading", preQueryDisclosure: undefined },
    doc
  );

  const enrichRequest: Parameters<typeof requestEnrichmentFromServiceWorker>[0] =
    {
      value: payload.value,
      iocType: payload.type,
    };
  if (options.bypassCache === true) {
    enrichRequest.bypassCache = true;
  }

  const fetchResult = await requestEnrichmentFromServiceWorker(enrichRequest);

  if (!fetchResult || fetchResult.sources.length === 0) {
    applyIndicatorDetailPayload(
      {
        ...payload,
        enrichmentState: "error",
        errorMessage: "Threat intelligence could not be loaded.",
        preQueryDisclosure: undefined,
      },
      doc
    );
    return;
  }

  applyIndicatorDetailPayload(
    mapEnrichmentResultsToPayload(payload, fetchResult.sources),
    doc
  );
}

export async function runBackgroundEnrichment(
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  options: BackgroundEnrichmentOptions = {}
): Promise<RunBackgroundEnrichmentResult> {
  if (isExtensionContextInvalidated()) {
    return "skipped";
  }

  if (!hasIndicatorDetailTarget(payload)) {
    return "skipped";
  }

  const enabledSources = await getEnrichmentSourceEnabledForContent();
  if (!hasAnyEnabledLiveEnrichmentSource(enabledSources)) {
    applyIndicatorDetailPayload(
      {
        ...payload,
        enrichmentState: "error",
        errorCode: ENRICHMENT_ERROR_CODE.DISABLED,
        errorMessage: "No enrichment sources are enabled in extension settings.",
        preQueryDisclosure: undefined,
      },
      doc
    );
    return "blocked";
  }

  const enabledLiveSourceIds = listEnabledLiveEnrichmentSourceIds(
    enabledSources,
    payload.type
  );

  const pageGate = await resolvePageEnrichmentTrustGate(doc);
  if (!pageGate.allowed) {
    presentEnrichmentTrustGateBlocked(payload, pageGate, doc);
    return "blocked";
  }

  const indicatorGate = await resolveIndicatorEnrichmentTrustGate(
    payload.value,
    payload.type
  );
  if (!indicatorGate.allowed) {
    presentEnrichmentTrustGateBlocked(payload, indicatorGate, doc);
    return "blocked";
  }

  const proceed = await confirmPreQueryDisclosureIfRequired(
    payload,
    enabledLiveSourceIds,
    doc
  );
  if (!proceed) {
    applyIndicatorDetailPayload(
      {
        ...payload,
        enrichmentState: "empty",
        preQueryDisclosure: undefined,
      },
      doc
    );
    return "cancelled";
  }

  if (!hasIndicatorDetailTarget(payload)) {
    return "skipped";
  }

  await executeBackgroundEnrichmentFetch(payload, doc, options);
  void recordInvestigationHistoryEntry({
    ioc: payload.value,
    iocType: payload.type,
    pageUrl: doc.location.href,
  }).catch(logUnlessBenignExtensionError);
  return "completed";
}

export function setupBackgroundEnrichmentRouting(): void {
  setAutoEnrichmentFetcher((payload) => {
    scheduleDebouncedBackgroundEnrichment(payload);
  });
}

export { resolvePreQueryDisclosure };
