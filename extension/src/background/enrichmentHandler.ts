import {
  ABUSEIPDB_SOURCE_ID,
  enrichWithAbuseIpdb,
} from "../lib/abuseipdbConnector";
import {
  createErrorSourceResult,
  createSkippedSourceResult,
  ENRICHMENT_ERROR_CODE,
  type EnrichmentSourceResult,
} from "../lib/enrichment";
import { sanitizeEnrichmentIoc } from "../lib/iocRequestBoundaries";
import { ENRICHMENT_SOURCE } from "../lib/hoverCardEnrichment";
import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import type { EnrichIocMessage, MessageResponse } from "../lib/messages";
import { isEnrichIocMessage } from "../lib/messages";
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

async function enrichFromSource(
  message: EnrichIocMessage
): Promise<EnrichmentSourceResult> {
  const sourceId = message.sourceId ?? ABUSEIPDB_SOURCE_ID;
  const sanitized = sanitizeEnrichmentIoc({
    value: message.value,
    type: message.iocType,
  });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
    });
  }
  const ioc = sanitized;

  if (!isSupportedEnrichmentSource(sourceId)) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Unsupported enrichment source.",
    });
  }

  const enabled = await getEnrichmentSourceEnabled();
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

  return createErrorSourceResult({
    sourceId,
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: "Live connector is not available for this source yet.",
  });
}

export async function handleEnrichIocMessage(
  raw: unknown
): Promise<MessageResponse> {
  if (!isEnrichIocMessage(raw)) {
    return { ok: false, error: "invalid enrich request" };
  }

  const source = await enrichFromSource(raw);
  return { ok: true, payload: { source } };
}
