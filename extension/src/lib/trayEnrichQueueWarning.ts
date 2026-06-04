import { buildConnectorProfileRateLimitMetadata } from "./connectorProfileExport";
import {
  ENRICHMENT_SOURCE_LABELS,
  type EnrichmentSourceId,
} from "./hoverCardEnrichment";
import { listEnabledLiveEnrichmentSourceIds } from "./enrichmentSourceSelection";
import type { TabScanSummaryEntry } from "./tabScanSummary";
import type { EnrichmentSourceEnabledRecord } from "./storage";

export type TrayEnrichQueueQuotaSummary = {
  sourceId: EnrichmentSourceId;
  label: string;
  quotaSummary: string;
};

export type TrayEnrichQueueImpact = {
  iocCount: number;
  maxLiveRequests: number;
  quotaSummaries: readonly TrayEnrichQueueQuotaSummary[];
};

export function estimateTrayEnrichQueueImpact(
  entries: readonly TabScanSummaryEntry[],
  anchorIds: readonly string[],
  enabledSources: EnrichmentSourceEnabledRecord
): TrayEnrichQueueImpact {
  const entryByAnchorId = new Map(
    entries.map((entry) => [entry.anchorId, entry] as const)
  );
  const liveSourceIds = new Set<EnrichmentSourceId>();
  let maxLiveRequests = 0;

  for (const anchorId of anchorIds) {
    const entry = entryByAnchorId.get(anchorId);
    if (!entry) {
      continue;
    }
    const sources = listEnabledLiveEnrichmentSourceIds(enabledSources, entry.type);
    maxLiveRequests += sources.length;
    for (const sourceId of sources) {
      liveSourceIds.add(sourceId);
    }
  }

  const rateLimitMetadata = buildConnectorProfileRateLimitMetadata();
  const quotaSummaries = [...liveSourceIds].map((sourceId) => {
    const sourceMetadata = rateLimitMetadata.sources.find(
      (source) => source.sourceId === sourceId
    );
    return {
      sourceId,
      label: ENRICHMENT_SOURCE_LABELS[sourceId],
      quotaSummary:
        sourceMetadata?.quotaSummary ??
        "Confirm limits in your vendor account.",
    };
  });

  return {
    iocCount: anchorIds.length,
    maxLiveRequests,
    quotaSummaries,
  };
}

export function buildTrayEnrichQueueWarningMessage(
  impact: TrayEnrichQueueImpact
): string {
  const lines: string[] = [];
  const rateLimitMetadata = buildConnectorProfileRateLimitMetadata();

  if (impact.maxLiveRequests === 0) {
    lines.push(
      `Enrich ${impact.iocCount} selected indicator${impact.iocCount === 1 ? "" : "s"} without live vendor queries (no live enrichment sources are enabled for these types).`
    );
  } else {
    lines.push(
      `Enrich ${impact.iocCount} selected indicator${impact.iocCount === 1 ? "" : "s"} with up to ${impact.maxLiveRequests} live vendor request${impact.maxLiveRequests === 1 ? "" : "s"}.`
    );
    lines.push("Vendor quotas apply:");
    for (const summary of impact.quotaSummaries) {
      lines.push(`• ${summary.label}: ${summary.quotaSummary}`);
    }
  }

  lines.push(
    `Rate limits may pause or fail queue items. After a vendor rate limit, Vera5 may wait up to ${rateLimitMetadata.maxGlobalCooldownSeconds} seconds before retrying.`
  );

  return lines.join("\n\n");
}
