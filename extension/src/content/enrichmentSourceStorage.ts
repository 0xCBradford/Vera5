import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE_ORDER,
  isEnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import { safeStorageLocalGet } from "../lib/extensionContext";

export const CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED =
  "enrichmentSourceEnabled";

export const CONTENT_STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE =
  "showDisabledSourcesInWorkspace";

export type EnrichmentSourceEnabledMap = Record<EnrichmentSourceId, boolean>;

export function createDefaultEnrichmentSourceEnabledMap(): EnrichmentSourceEnabledMap {
  return Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [sourceId, false])
  ) as EnrichmentSourceEnabledMap;
}

export function normalizeEnrichmentSourceEnabledMap(
  value: unknown
): EnrichmentSourceEnabledMap {
  const normalized = createDefaultEnrichmentSourceEnabledMap();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    const entry = (value as Record<string, unknown>)[sourceId];
    if (typeof entry === "boolean") {
      normalized[sourceId] = entry;
    }
  }

  return normalized;
}

export async function getEnrichmentSourceEnabledForContent(): Promise<EnrichmentSourceEnabledMap> {
  const result = await safeStorageLocalGet(
    CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED
  );
  return normalizeEnrichmentSourceEnabledMap(
    result[CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]
  );
}

export async function getShowDisabledSourcesInWorkspaceForContent(): Promise<boolean> {
  const result = await safeStorageLocalGet(
    CONTENT_STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE
  );
  return result[CONTENT_STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE] === true;
}

export function listDisabledEnrichmentSourceIds(
  sources: EnrichmentSourceEnabledMap,
  showDisabledSourcesInWorkspace = true
): EnrichmentSourceId[] {
  const disabled = ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) => !sources[sourceId]
  );
  if (showDisabledSourcesInWorkspace) {
    return disabled;
  }
  return [];
}

export function listEnabledEnrichmentSourceIds(
  sources: EnrichmentSourceEnabledMap
): EnrichmentSourceId[] {
  return ENRICHMENT_SOURCE_ORDER.filter((sourceId) => sources[sourceId]);
}

export function isKnownEnrichmentSourceId(
  value: string
): value is EnrichmentSourceId {
  return isEnrichmentSourceId(value);
}

export async function loadWorkspaceEnrichmentSourceContext(): Promise<{
  sources: EnrichmentSourceEnabledMap;
  showDisabledSourcesInWorkspace: boolean;
  disabledSourceIds: EnrichmentSourceId[];
  enabledSourceIds: EnrichmentSourceId[];
}> {
  const [sources, showDisabledSourcesInWorkspace] = await Promise.all([
    getEnrichmentSourceEnabledForContent(),
    getShowDisabledSourcesInWorkspaceForContent(),
  ]);
  return {
    sources,
    showDisabledSourcesInWorkspace,
    disabledSourceIds: listDisabledEnrichmentSourceIds(
      sources,
      showDisabledSourcesInWorkspace
    ),
    enabledSourceIds: listEnabledEnrichmentSourceIds(sources),
  };
}
