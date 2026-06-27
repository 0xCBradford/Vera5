import {
  ABUSEIPDB_SOURCE_ID,
  enrichWithAbuseIpdb,
} from "../lib/abuseipdbConnector";
import {
  cacheEnrichmentSourceResult,
  invalidateEnrichmentCacheForIoc,
  readCachedEnrichmentSourceResult,
} from "../lib/cache";
import { enrichWithConnectorShell } from "../lib/enrichmentConnectorShell";
import { enrichWithOtx } from "../lib/otxConnector";
import {
  GREYNOISE_SOURCE_ID,
  enrichWithGreynoise,
} from "../lib/greynoiseConnector";
import {
  URLSCAN_SOURCE_ID,
  enrichWithUrlscan,
} from "../lib/urlscanConnector";
import {
  formatGlobalEnrichmentCooldownMessage,
  formatGlobalEnrichmentCooldownRetryHint,
  isGlobalEnrichmentCooldownActive,
  recordGlobalEnrichmentCooldown,
} from "../lib/enrichmentCooldown";
import {
  createErrorSourceResult,
  createSkippedSourceResult,
  ENRICHMENT_ERROR_CODE,
  isRateLimitedError,
  parseRetryAfterSecondsFromHint,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "../lib/enrichment";
import { sanitizeEnrichmentIoc } from "../lib/iocRequestBoundaries";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
} from "../lib/hoverCardEnrichment";
import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE_DEFINITIONS,
  isEnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import { recordActiveInvestigationSessionEnrichmentEvent } from "../lib/investigationSessionStorage";
import { recordEnrichmentSourceLastStatuses } from "../lib/enrichmentSourceOps";
import type { EnrichIocMessage, MessageResponse } from "../lib/messages";
import { isEnrichIocMessage } from "../lib/messages";
import {
  listEnabledLiveEnrichmentSourceIds,
  pickPrimaryEnrichmentSource,
} from "../lib/enrichmentSourceSelection";
import {
  applyLocalBackendFallbackHint,
  requestLocalBackendEnrichment,
} from "../lib/localBackendEnrichment";
import type { EnrichmentSourceEnabledRecord } from "../lib/storage";
import {
  getEnrichmentSourceEnabled,
  getEnrichmentCacheTtlSecondsFromSettings,
  getEnrichmentSourceCacheTtlSeconds,
  getLocalBackendEnabled,
} from "../lib/storage";

function createGlobalCooldownSourceResult(
  sourceId: EnrichmentSourceId
): EnrichmentSourceResult {
  return createErrorSourceResult({
    sourceId,
    errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
    errorMessage: formatGlobalEnrichmentCooldownMessage(),
    retryHint: formatGlobalEnrichmentCooldownRetryHint(),
  });
}

async function fetchLiveSource(
  sourceId: EnrichmentSourceId,
  ioc: EnrichmentIoc
): Promise<EnrichmentSourceResult> {
  if (sourceId === ABUSEIPDB_SOURCE_ID) {
    return enrichWithAbuseIpdb(ioc);
  }

  if (sourceId === ENRICHMENT_SOURCE.OTX) {
    return enrichWithOtx(ioc);
  }

  if (sourceId === URLSCAN_SOURCE_ID) {
    return enrichWithUrlscan(ioc);
  }

  if (sourceId === GREYNOISE_SOURCE_ID) {
    return enrichWithGreynoise(ioc);
  }

  if (ENRICHMENT_SOURCE_DEFINITIONS[sourceId].liveConnector) {
    return createErrorSourceResult({
      sourceId,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: `${ENRICHMENT_SOURCE_LABELS[sourceId]} request failed.`,
    });
  }

  return enrichWithConnectorShell(sourceId, ioc);
}

async function enrichLiveSource(
  sourceId: EnrichmentSourceId,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord,
  bypassCache: boolean
): Promise<EnrichmentSourceResult> {
  if (enabled[sourceId] !== true) {
    return createSkippedSourceResult(
      sourceId,
      ENRICHMENT_ERROR_CODE.DISABLED,
      "Source is disabled in extension settings."
    );
  }

  if (!bypassCache) {
    if (isGlobalEnrichmentCooldownActive()) {
      return createGlobalCooldownSourceResult(sourceId);
    }

    const cached = await readCachedEnrichmentSourceResult(ioc.value, sourceId);
    if (cached) {
      return cached;
    }
  }

  try {
    const result = await fetchLiveSource(sourceId, ioc);
    if (isRateLimitedError(result.errorCode)) {
      recordGlobalEnrichmentCooldown(
        parseRetryAfterSecondsFromHint(result.retryHint)
      );
    }
    await cacheEnrichmentSourceResult(ioc.value, sourceId, result);
    return result;
  } catch {
    return createErrorSourceResult({
      sourceId,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: `${ENRICHMENT_SOURCE_LABELS[sourceId]} request failed.`,
    });
  }
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
  enabled: EnrichmentSourceEnabledRecord,
  bypassCache: boolean
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
    sourceIds.map((sourceId) =>
      enrichLiveSource(sourceId, ioc, enabled, bypassCache)
    )
  );

  return settled.map((outcome, index) =>
    settleEnrichmentOutcome(sourceIds[index]!, outcome)
  );
}

async function enrichRequestedSource(
  message: EnrichIocMessage,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord,
  bypassCache: boolean
): Promise<EnrichmentSourceResult> {
  const sourceId = message.sourceId;
  if (!sourceId) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Unsupported enrichment source.",
    });
  }

  if (!isEnrichmentSourceId(sourceId)) {
    return createErrorSourceResult({
      sourceId: ABUSEIPDB_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Unsupported enrichment source.",
    });
  }

  return enrichLiveSource(sourceId, ioc, enabled, bypassCache);
}

async function enrichFromExtensionConnectors(
  message: EnrichIocMessage,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord,
  bypassCache: boolean
): Promise<{ source: EnrichmentSourceResult; sources: EnrichmentSourceResult[] }> {
  if (message.sourceId) {
    const source = await enrichRequestedSource(
      message,
      ioc,
      enabled,
      bypassCache
    );
    return { source, sources: [source] };
  }

  const sources = await enrichEnabledSourcesParallel(ioc, enabled, bypassCache);
  const source = pickPrimaryEnrichmentSource(sources) ?? sources[0]!;
  return { source, sources };
}

async function readCachedEnrichmentBundle(
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord,
  sourceId?: EnrichmentSourceId
): Promise<EnrichmentSourceResult[] | null> {
  if (sourceId) {
    const cached = await readCachedEnrichmentSourceResult(ioc.value, sourceId);
    return cached ? [cached] : null;
  }

  const sourceIds = listEnabledLiveEnrichmentSourceIds(enabled, ioc.type);
  if (sourceIds.length === 0) {
    return null;
  }

  const cachedResults: EnrichmentSourceResult[] = [];
  for (const id of sourceIds) {
    const cached = await readCachedEnrichmentSourceResult(ioc.value, id);
    if (!cached) {
      return null;
    }
    cachedResults.push(cached);
  }

  return cachedResults;
}

async function cacheEnrichmentBundle(
  iocValue: string,
  sources: EnrichmentSourceResult[]
): Promise<void> {
  for (const result of sources) {
    if (isRateLimitedError(result.errorCode)) {
      recordGlobalEnrichmentCooldown(
        parseRetryAfterSecondsFromHint(result.retryHint)
      );
    }
    await cacheEnrichmentSourceResult(iocValue, result.sourceId, result);
  }
}

async function enrichFromLocalBackend(
  message: EnrichIocMessage,
  ioc: EnrichmentIoc,
  enabled: EnrichmentSourceEnabledRecord,
  bypassCache: boolean
): Promise<{ source: EnrichmentSourceResult; sources: EnrichmentSourceResult[] }> {
  if (!bypassCache) {
    const cachedSources = await readCachedEnrichmentBundle(
      ioc,
      enabled,
      message.sourceId
    );
    if (cachedSources) {
      const source =
        pickPrimaryEnrichmentSource(cachedSources) ?? cachedSources[0]!;
      return { source, sources: cachedSources };
    }
  }

  const backendResponse = await requestLocalBackendEnrichment({
    value: ioc.value,
    iocType: ioc.type,
    sourceId: message.sourceId,
    bypassCache,
    enabledSources: enabled,
    cacheTtlSeconds: await getEnrichmentCacheTtlSecondsFromSettings(),
    sourceCacheTtlSeconds: await getEnrichmentSourceCacheTtlSeconds(),
  });

  if (!backendResponse) {
    const fallback = await enrichFromExtensionConnectors(
      message,
      ioc,
      enabled,
      bypassCache
    );
    return applyLocalBackendFallbackHint(fallback);
  }

  await cacheEnrichmentBundle(ioc.value, backendResponse.sources);
  return backendResponse;
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
  const bypassCache = message.bypassCache === true;

  if (bypassCache) {
    await invalidateEnrichmentCacheForIoc(sanitized.value);
  }

  if (!bypassCache && isGlobalEnrichmentCooldownActive()) {
    if (message.sourceId && isEnrichmentSourceId(message.sourceId)) {
      const source = createGlobalCooldownSourceResult(message.sourceId);
      return { source, sources: [source] };
    }

    const sourceIds = listEnabledLiveEnrichmentSourceIds(enabled, sanitized.type);
    if (sourceIds.length === 0) {
      const skipped = createSkippedSourceResult(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_ERROR_CODE.DISABLED,
        "No enrichment sources are enabled in extension settings."
      );
      return { source: skipped, sources: [skipped] };
    }

    const sources = sourceIds.map((sourceId) =>
      createGlobalCooldownSourceResult(sourceId)
    );
    const source = pickPrimaryEnrichmentSource(sources) ?? sources[0]!;
    return { source, sources };
  }

  if (await getLocalBackendEnabled()) {
    return enrichFromLocalBackend(message, sanitized, enabled, bypassCache);
  }

  return enrichFromExtensionConnectors(
    message,
    sanitized,
    enabled,
    bypassCache
  );
}

export async function handleEnrichIocMessage(
  raw: unknown
): Promise<MessageResponse> {
  if (!isEnrichIocMessage(raw)) {
    return { ok: false, error: "invalid enrich request" };
  }

  const { source, sources } = await enrichFromMessage(raw);
  const sanitized = sanitizeEnrichmentIoc({
    value: raw.value,
    type: raw.iocType,
  });
  await recordEnrichmentSourceLastStatuses(sources);
  await recordActiveInvestigationSessionEnrichmentEvent(
    sanitized
      ? { iocValue: sanitized.value, iocType: sanitized.type }
      : undefined
  );
  return { ok: true, payload: { source, sources } };
}
