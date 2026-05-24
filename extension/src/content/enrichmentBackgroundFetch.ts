import {
  requestEnrichmentFromServiceWorker,
  type ContentEnrichmentSourceResult,
} from "./enrichmentMessageClient";
import {
  getLastHoverCardAnchor,
  showHoverCardNearAnchor,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import { setAutoEnrichmentFetcher } from "./enrichmentAutoFetch";
import type { EnrichmentSourceAttribution } from "../lib/hoverCardEnrichment";

function buildSourceAttribution(
  source: ContentEnrichmentSourceResult
): EnrichmentSourceAttribution {
  const attribution: EnrichmentSourceAttribution = {
    sourceLabel: source.sourceLabel,
  };
  if (source.fromCache === true) {
    attribution.fromCache = true;
  }
  return attribution;
}

function mapSourceResultToPayload(
  base: HoverCardOverlayPayload,
  source: ContentEnrichmentSourceResult
): HoverCardOverlayPayload {
  const sourceAttribution = buildSourceAttribution(source);

  if (source.status === "ok") {
    return {
      ...base,
      enrichmentState: "ready",
      summary: source.summary,
      tags: source.tags,
      sourceAttribution,
    };
  }

  if (source.status === "error") {
    return {
      ...base,
      enrichmentState: "error",
      errorMessage: source.errorMessage,
      errorCode: source.errorCode,
      retryHint: source.retryHint,
      sourceAttribution,
    };
  }

  return {
    ...base,
    enrichmentState: "error",
    errorMessage: source.errorMessage ?? "Enrichment was not available.",
    errorCode: source.errorCode,
    retryHint: source.retryHint,
    sourceAttribution,
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

  showHoverCardNearAnchor(
    anchor,
    { ...payload, enrichmentState: "loading" },
    doc
  );

  const source = await requestEnrichmentFromServiceWorker({
    value: payload.value,
    iocType: payload.type,
  });

  if (!source) {
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
    mapSourceResultToPayload(payload, source),
    doc
  );
}

export function setupBackgroundEnrichmentRouting(): void {
  setAutoEnrichmentFetcher((payload) => runBackgroundEnrichment(payload));
}
