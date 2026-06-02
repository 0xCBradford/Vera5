import type { EnrichmentSourceId } from "../lib/hoverCardEnrichment";
import { safeStorageLocalGet } from "../lib/extensionContext";

export const CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED =
  "enrichmentSourceEnabled";

export const MVP_ENRICHMENT_SOURCE_IDS = [
  "abuseipdb",
  "otx",
  "urlscan",
  "greynoise",
] as const satisfies readonly EnrichmentSourceId[];

export type MvpEnrichmentSourceId = (typeof MVP_ENRICHMENT_SOURCE_IDS)[number];

export type EnrichmentSourceEnabledMap = Record<MvpEnrichmentSourceId, boolean>;

const MVP_ENRICHMENT_SOURCE_ID_SET = new Set<string>(MVP_ENRICHMENT_SOURCE_IDS);

export function createDefaultEnrichmentSourceEnabledMap(): EnrichmentSourceEnabledMap {
  return {
    abuseipdb: false,
    otx: false,
    urlscan: false,
    greynoise: false,
  };
}

export function normalizeEnrichmentSourceEnabledMap(
  value: unknown
): EnrichmentSourceEnabledMap {
  const normalized = createDefaultEnrichmentSourceEnabledMap();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  for (const sourceId of MVP_ENRICHMENT_SOURCE_IDS) {
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

export function listDisabledEnrichmentSourceIds(
  sources: EnrichmentSourceEnabledMap
): EnrichmentSourceId[] {
  return MVP_ENRICHMENT_SOURCE_IDS.filter((sourceId) => !sources[sourceId]);
}

export function isKnownEnrichmentSourceId(
  value: string
): value is MvpEnrichmentSourceId {
  return MVP_ENRICHMENT_SOURCE_ID_SET.has(value);
}
