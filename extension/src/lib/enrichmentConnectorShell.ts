import {
  ENRICHMENT_ERROR_CODE,
  createErrorSourceResult,
  createSkippedSourceResult,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import {
  ENRICHMENT_SOURCE_DEFINITIONS,
  ENRICHMENT_SOURCE_LABELS,
  formatMissingApiKeySourceMessage,
  formatNotImplementedSourceMessage,
  formatUnsupportedIndicatorTypeMessage,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
  enrichmentSourceSupportsIocType,
} from "./enrichmentSourceRegistry";
import { getApiKey } from "./storage";

async function sourceHasRequiredApiKeys(
  sourceId: EnrichmentSourceId
): Promise<boolean> {
  const definition = getEnrichmentSourceDefinition(sourceId);
  if (!definition.requiresApiKey) {
    return true;
  }

  const primaryKey = (await getApiKey(sourceId)).trim();
  if (!primaryKey) {
    return false;
  }

  if (definition.secondaryApiKeySlot) {
    const secondaryKey = (await getApiKey(definition.secondaryApiKeySlot)).trim();
    if (!secondaryKey) {
      return false;
    }
  }

  return true;
}

export async function enrichWithConnectorShell(
  sourceId: EnrichmentSourceId,
  ioc: EnrichmentIoc
): Promise<EnrichmentSourceResult> {
  const definition = ENRICHMENT_SOURCE_DEFINITIONS[sourceId];
  const displayName = ENRICHMENT_SOURCE_LABELS[sourceId];

  if (!enrichmentSourceSupportsIocType(sourceId, ioc.type)) {
    return createSkippedSourceResult(
      sourceId,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      formatUnsupportedIndicatorTypeMessage(displayName)
    );
  }

  if (definition.requiresApiKey && !(await sourceHasRequiredApiKeys(sourceId))) {
    return createSkippedSourceResult(
      sourceId,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingApiKeySourceMessage(displayName)
    );
  }

  return createErrorSourceResult({
    sourceId,
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: formatNotImplementedSourceMessage(displayName),
  });
}
