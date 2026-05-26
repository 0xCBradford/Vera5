import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
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

export async function runBackgroundEnrichment(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): Promise<void> {
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

  const fetchResult = await requestEnrichmentFromServiceWorker({
    value: payload.value,
    iocType: payload.type,
  });

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
  setAutoEnrichmentFetcher((payload) => runBackgroundEnrichment(payload));
}
