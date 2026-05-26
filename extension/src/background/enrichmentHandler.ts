import {
  ABUSEIPDB_SOURCE_ID,
  enrichWithAbuseIpdb,
} from "../lib/abuseipdbConnector";
import { enrichWithOtx } from "../lib/otxConnector";
import {
  createErrorSourceResult,
  createSkippedSourceResult,
  ENRICHMENT_ERROR_CODE,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "../lib/enrichment";
import { sanitizeEnrichmentIoc } from "../lib/iocRequestBoundaries";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
} from "../lib/hoverCardEnrichment";
import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import type { EnrichIocMessage, MessageResponse } from "../lib/messages";
import { isEnrichIocMessage } from "../lib/messages";
import {
  listEnabledLiveEnrichmentSourceIds,
  pickPrimaryEnrichmentSource,
} from "../lib/enrichmentSourceSelection";
import type { EnrichmentSourceEnabledRecord } from "../lib/storage";
import { getEnrichmentSourceEnabled } from "../lib/storage";

function isSupportedEnrichmentSource(
  sourceId: string
): sourceId is EnrichmentSourceId {
  return (
    sourceId === ENRICHMENT_SOURCE.ABUSEIPDB ||
    sourceId === ENRICHMENT_SOURCE.OTX ||
    sourceId === ENRICHMENT_SOURCE.URLSCAN ||
    sourceId === ENRICHMENT_SOURCE.GREYNOISE
  );
}

async function enrichLiveSource(
  sourceId: EnrichmentSourceId,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord
): Promise<EnrichmentSourceResult> {
  if (enabled[sourceId] !== true) {
    return createSkippedSourceResult(
      sourceId,
      ENRICHMENT_ERROR_CODE.DISABLED,
      "Source is disabled in extension settings."
    );
  }

  if (sourceId === ABUSEIPDB_SOURCE_ID) {
    return enrichWithAbuseIpdb(ioc);
  }

  if (sourceId === ENRICHMENT_SOURCE.OTX) {
    return enrichWithOtx(ioc);
  }

  return createErrorSourceResult({
    sourceId,
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: "Live connector is not available for this source yet.",
  });
}

function settleEnrichmentOutcome(
  sourceId: EnrichmentSourceId,
  outcome: PromiseSettledResult<EnrichmentSourceResult>
): EnrichmentSourceResult {
  if (outcome.status === "fulfilled") {
    return outcome.value;
  }
  return createErrorSourceResult({
    sourceId,
    errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
    errorMessage: `${ENRICHMENT_SOURCE_LABELS[sourceId]} request failed.`,
  });
}

async function enrichEnabledSourcesParallel(
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord
): Promise<EnrichmentSourceResult[]> {
  const sourceIds = listEnabledLiveEnrichmentSourceIds(enabled, ioc.type);
  if (sourceIds.length === 0) {
    return [
      createSkippedSourceResult(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_ERROR_CODE.DISABLED,
        "No enrichment sources are enabled in extension settings."
      ),
    ];
  }

  const settled = await Promise.allSettled(
    sourceIds.map((sourceId) => enrichLiveSource(sourceId, ioc, enabled))
  );

  return settled.map((outcome, index) =>
    settleEnrichmentOutcome(sourceIds[index]!, outcome)
  );
}

async function enrichRequestedSource(
  message: EnrichIocMessage,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord
): Promise<EnrichmentSourceResult> {
  const sourceId = message.sourceId;
  if (!sourceId) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Unsupported enrichment source.",
    });
  }

  if (!isSupportedEnrichmentSource(sourceId)) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Unsupported enrichment source.",
    });
  }

  return enrichLiveSource(sourceId, ioc, enabled);
}

async function enrichFromMessage(
  message: EnrichIocMessage
): Promise<{ source: EnrichmentSourceResult; sources: EnrichmentSourceResult[] }> {
  const sanitized = sanitizeEnrichmentIoc({
    value: message.value,
    type: message.iocType,
  });
  if (!sanitized) {
    const invalid = createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
    });
    return { source: invalid, sources: [invalid] };
  }

  const enabled = await getEnrichmentSourceEnabled();

  if (message.sourceId) {
    const source = await enrichRequestedSource(message, sanitized, enabled);
    return { source, sources: [source] };
  }

  const sources = await enrichEnabledSourcesParallel(sanitized, enabled);
  const source = pickPrimaryEnrichmentSource(sources) ?? sources[0]!;
  return { source, sources };
}

export async function handleEnrichIocMessage(
  raw: unknown
): Promise<MessageResponse> {
  if (!isEnrichIocMessage(raw)) {
    return { ok: false, error: "invalid enrich request" };
  }

  const { source, sources } = await enrichFromMessage(raw);
  return { ok: true, payload: { source, sources } };
}
