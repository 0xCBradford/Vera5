import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
import {
  beginPreQueryDisclosureWait,
  cancelPreQueryDisclosure,
  resolvePreQueryDisclosure,
  shouldShowPreQueryNotices,
} from "../lib/enrichmentPolicy";
import { isExtensionContextInvalidated } from "../lib/extensionContext";
import { listEnabledLiveEnrichmentSourceIds } from "../lib/enrichmentSourceSelection";
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
import {
  getLastHoverCardAnchor,
  getLastHoverCardPayload,
  showHoverCardNearAnchor,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import { setAutoEnrichmentFetcher } from "./enrichmentAutoFetch";
import { tryUpdateWorkspaceDetailPayload, isWorkspaceTargetForPayload } from "./workspaceSelectionState";

export const DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS = 400;

export const DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE =
  "Threat intelligence queries are blocked for this site by domain policy.";

let hoverEnrichmentTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelPendingHoverEnrichment(): void {
  if (hoverEnrichmentTimer !== null) {
    clearTimeout(hoverEnrichmentTimer);
    hoverEnrichmentTimer = null;
  }
  cancelPreQueryDisclosure();
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
  if (tryUpdateWorkspaceDetailPayload(payload, doc)) {
    return true;
  }

  const anchor = getLastHoverCardAnchor();
  const hoverPayload = getLastHoverCardPayload();
  if (anchor && hoverPayload?.value === payload.value) {
    showHoverCardNearAnchor(anchor, payload, doc);
    return true;
  }

  return tryUpdateWorkspaceDetailPayload(payload, doc);
}

function hasIndicatorDetailTarget(
  payload: HoverCardOverlayPayload,
  doc: Document
): boolean {
  if (isWorkspaceTargetForPayload(payload, doc)) {
    return true;
  }
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
): Promise<void> {
  if (isExtensionContextInvalidated()) {
    return;
  }

  if (!hasIndicatorDetailTarget(payload, doc)) {
    return;
  }

  const enabledSources = await getEnrichmentSourceEnabledForContent();
  const enabledLiveSourceIds = listEnabledLiveEnrichmentSourceIds(
    enabledSources,
    payload.type
  );
  if (enabledLiveSourceIds.length === 0) {
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
    return;
  }

  const enrichAllowed = await isEnrichmentAllowedForCurrentPage(doc);
  if (!enrichAllowed) {
    applyIndicatorDetailPayload(
      {
        ...payload,
        enrichmentState: "error",
        errorCode: ENRICHMENT_ERROR_CODE.DOMAIN_POLICY,
        errorMessage: DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
        preQueryDisclosure: undefined,
      },
      doc
    );
    return;
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
    return;
  }

  if (!hasIndicatorDetailTarget(payload, doc)) {
    return;
  }

  await executeBackgroundEnrichmentFetch(payload, doc, options);
}

export function setupBackgroundEnrichmentRouting(): void {
  setAutoEnrichmentFetcher((payload) => {
    scheduleDebouncedBackgroundEnrichment(payload);
  });
}

export { resolvePreQueryDisclosure };
