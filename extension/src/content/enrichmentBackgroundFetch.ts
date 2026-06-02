import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
import { isExtensionContextInvalidated } from "../lib/extensionContext";
import { listEnabledLiveEnrichmentSourceIds } from "../lib/enrichmentSourceSelection";
import { resolveMultiSourceEnrichmentView } from "../lib/hoverCardEnrichment";
import {
  requestEnrichmentFromServiceWorker,
  type ContentEnrichmentSourceResult,
} from "./enrichmentMessageClient";
import { getEnrichmentSourceEnabledForContent } from "./enrichmentSourceStorage";
import {
  getLastHoverCardAnchor,
  showHoverCardNearAnchor,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import { setAutoEnrichmentFetcher } from "./enrichmentAutoFetch";

export const DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS = 400;

let hoverEnrichmentTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelPendingHoverEnrichment(): void {
  if (hoverEnrichmentTimer !== null) {
    clearTimeout(hoverEnrichmentTimer);
    hoverEnrichmentTimer = null;
  }
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
  };
}

export type BackgroundEnrichmentOptions = {
  bypassCache?: boolean;
};

export async function runBackgroundEnrichment(
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  options: BackgroundEnrichmentOptions = {}
): Promise<void> {
  if (isExtensionContextInvalidated()) {
    return;
  }

  const anchor = getLastHoverCardAnchor();
  if (!anchor) {
    return;
  }

  const enabledSources = await getEnrichmentSourceEnabledForContent();
  const enabledLiveSourceIds = listEnabledLiveEnrichmentSourceIds(
    enabledSources,
    payload.type
  );
  if (enabledLiveSourceIds.length === 0) {
    showHoverCardNearAnchor(
      anchor,
      {
        ...payload,
        enrichmentState: "error",
        errorCode: ENRICHMENT_ERROR_CODE.DISABLED,
        errorMessage: "No enrichment sources are enabled in extension settings.",
      },
      doc
    );
    return;
  }

  showHoverCardNearAnchor(
    anchor,
    { ...payload, enrichmentState: "loading" },
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
    showHoverCardNearAnchor(
      anchor,
      {
        ...payload,
        enrichmentState: "error",
        errorMessage: "Threat intelligence could not be loaded.",
      },
      doc
    );
    return;
  }

  showHoverCardNearAnchor(
    anchor,
    mapEnrichmentResultsToPayload(payload, fetchResult.sources),
    doc
  );
}

export function setupBackgroundEnrichmentRouting(): void {
  setAutoEnrichmentFetcher((payload) => {
    scheduleDebouncedBackgroundEnrichment(payload);
  });
}
