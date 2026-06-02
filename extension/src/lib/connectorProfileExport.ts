import { DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS } from "./abuseipdbConnector";
import {
  DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
  MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
} from "./enrichmentCooldown";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
  type EnrichmentSourceId,
} from "./hoverCardEnrichment";
import { DEFAULT_OTX_REQUEST_TIMEOUT_MS } from "./otxConnector";
import {
  normalizeEnrichmentSourceCacheTtlRecord,
  normalizeEnrichmentSourceEnabledRecord,
  normalizeIocTypeEnabledRecord,
  readStoredCacheTtlSeconds,
  STORAGE_KEY_API_KEYS,
  vera5SettingsToStoragePayload,
  type EnrichmentSourceCacheTtlRecord,
  type EnrichmentSourceEnabledRecord,
  type IocTypeEnabledRecord,
  type Vera5Settings,
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  getVera5Settings,
} from "./storage";

export const CONNECTOR_PROFILE_SCHEMA_VERSION = 1;

export const CONNECTOR_PROFILE_EXPORT_FILENAME = "vera5-connector-profile.json";

export const CONNECTOR_PROFILE_HOVER_ENRICHMENT_DEBOUNCE_MS = 400;

export type ConnectorProfilePrivacyWarnings = {
  enrichmentDisclaimer: string;
  riskScoreDisclaimer: string;
};

export type ConnectorProfileSourceRateLimit = {
  sourceId: EnrichmentSourceId;
  liveEnrichment: boolean;
  requestTimeoutSeconds: number | null;
  quotaSummary: string;
  rateLimitHeaderHints: readonly string[];
};

export type ConnectorProfileRateLimitMetadata = {
  defaultGlobalCooldownSeconds: number;
  maxGlobalCooldownSeconds: number;
  hoverEnrichmentDebounceMs: number;
  manualRefreshBypassesGlobalCooldown: boolean;
  sources: ConnectorProfileSourceRateLimit[];
};

export type ConnectorProfilePreferences = {
  iocTypeEnabled: IocTypeEnabledRecord;
  enrichmentSourceEnabled: EnrichmentSourceEnabledRecord;
  includePrivateIpv4: boolean;
  manualOnlyMode: boolean;
  enrichmentCacheTtlSeconds: number;
  enrichmentSourceCacheTtlSeconds: EnrichmentSourceCacheTtlRecord;
};

export type ConnectorProfileDocument = {
  connectorProfileSchemaVersion: number;
  exportedAt: string;
  preferences: ConnectorProfilePreferences;
  rateLimitMetadata: ConnectorProfileRateLimitMetadata;
  privacyWarnings: ConnectorProfilePrivacyWarnings;
};

export class ConnectorProfileImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorProfileImportError";
  }
}

const SOURCE_RATE_LIMIT_METADATA: Record<
  EnrichmentSourceId,
  Omit<ConnectorProfileSourceRateLimit, "sourceId">
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    liveEnrichment: true,
    requestTimeoutSeconds: DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS / 1000,
    quotaSummary:
      "Typical free tier: 1,000 checks/day (resets 00:00 UTC). Confirm limits in your AbuseIPDB account.",
    rateLimitHeaderHints: [
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  },
  [ENRICHMENT_SOURCE.OTX]: {
    liveEnrichment: true,
    requestTimeoutSeconds: DEFAULT_OTX_REQUEST_TIMEOUT_MS / 1000,
    quotaSummary:
      "Typical keyed tier: 10,000 requests/hour. Confirm limits in your OTX account.",
    rateLimitHeaderHints: ["Retry-After"],
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    liveEnrichment: false,
    requestTimeoutSeconds: null,
    quotaSummary:
      "Live enrichment not shipped. Toggle stores preference and pivot links only.",
    rateLimitHeaderHints: ["X-Rate-Limit-Limit", "X-Rate-Limit-Remaining"],
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    liveEnrichment: false,
    requestTimeoutSeconds: null,
    quotaSummary:
      "Live enrichment not shipped. Toggle stores preference and pivot links only.",
    rateLimitHeaderHints: [],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readStoredBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return Boolean(value);
}

function assertNoApiKeysInDocument(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "apiKeys") ||
    Object.prototype.hasOwnProperty.call(value, STORAGE_KEY_API_KEYS)
  ) {
    throw new ConnectorProfileImportError(
      "Connector profile must not include API keys."
    );
  }
  for (const child of Object.values(value)) {
    assertNoApiKeysInDocument(child);
  }
}

export function buildConnectorProfilePrivacyWarnings(): ConnectorProfilePrivacyWarnings {
  return {
    enrichmentDisclaimer: HOVER_CARD_ENRICHMENT_DISCLAIMER,
    riskScoreDisclaimer: HOVER_CARD_RISK_SCORE_DISCLAIMER,
  };
}

export function buildConnectorProfileRateLimitMetadata(): ConnectorProfileRateLimitMetadata {
  return {
    defaultGlobalCooldownSeconds: DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
    maxGlobalCooldownSeconds: MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
    hoverEnrichmentDebounceMs: CONNECTOR_PROFILE_HOVER_ENRICHMENT_DEBOUNCE_MS,
    manualRefreshBypassesGlobalCooldown: true,
    sources: ENRICHMENT_SOURCE_ORDER.map((sourceId) => ({
      sourceId,
      ...SOURCE_RATE_LIMIT_METADATA[sourceId],
    })),
  };
}

export function extractConnectorProfilePreferences(
  settings: Vera5Settings
): ConnectorProfilePreferences {
  return {
    iocTypeEnabled: { ...settings.iocTypeEnabled },
    enrichmentSourceEnabled: { ...settings.enrichmentSourceEnabled },
    includePrivateIpv4: settings.includePrivateIpv4,
    manualOnlyMode: settings.manualOnlyMode,
    enrichmentCacheTtlSeconds: settings.enrichmentCacheTtlSeconds,
    enrichmentSourceCacheTtlSeconds: {
      ...settings.enrichmentSourceCacheTtlSeconds,
    },
  };
}

export function buildConnectorProfileDocument(
  settings: Vera5Settings,
  exportedAt: string = new Date().toISOString()
): ConnectorProfileDocument {
  return {
    connectorProfileSchemaVersion: CONNECTOR_PROFILE_SCHEMA_VERSION,
    exportedAt,
    preferences: extractConnectorProfilePreferences(settings),
    rateLimitMetadata: buildConnectorProfileRateLimitMetadata(),
    privacyWarnings: buildConnectorProfilePrivacyWarnings(),
  };
}

export function serializeConnectorProfileExport(
  settings: Vera5Settings,
  pretty = true
): string {
  return JSON.stringify(
    buildConnectorProfileDocument(settings),
    null,
    pretty ? 2 : undefined
  );
}

function normalizeConnectorProfilePreferences(
  value: unknown
): ConnectorProfilePreferences {
  if (!isRecord(value)) {
    throw new ConnectorProfileImportError(
      "Connector profile is missing preferences."
    );
  }

  return {
    iocTypeEnabled: normalizeIocTypeEnabledRecord(value.iocTypeEnabled),
    enrichmentSourceEnabled: normalizeEnrichmentSourceEnabledRecord(
      value.enrichmentSourceEnabled
    ),
    includePrivateIpv4: readStoredBoolean(value.includePrivateIpv4, false),
    manualOnlyMode: readStoredBoolean(value.manualOnlyMode, true),
    enrichmentCacheTtlSeconds: readStoredCacheTtlSeconds(
      value.enrichmentCacheTtlSeconds,
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS
    ),
    enrichmentSourceCacheTtlSeconds: normalizeEnrichmentSourceCacheTtlRecord(
      value.enrichmentSourceCacheTtlSeconds
    ),
  };
}

export function parseConnectorProfileDocument(rawJson: string): {
  document: ConnectorProfileDocument;
  preferences: ConnectorProfilePreferences;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new ConnectorProfileImportError("Invalid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new ConnectorProfileImportError(
      "Connector profile must be a JSON object."
    );
  }

  assertNoApiKeysInDocument(parsed);

  if (
    parsed.connectorProfileSchemaVersion !== CONNECTOR_PROFILE_SCHEMA_VERSION
  ) {
    throw new ConnectorProfileImportError(
      "Unsupported connector profile format."
    );
  }

  if (
    typeof parsed.exportedAt !== "string" ||
    parsed.exportedAt.trim() === ""
  ) {
    throw new ConnectorProfileImportError(
      "Connector profile is missing export metadata."
    );
  }

  const preferences = normalizeConnectorProfilePreferences(parsed.preferences);

  const document: ConnectorProfileDocument = {
    connectorProfileSchemaVersion: CONNECTOR_PROFILE_SCHEMA_VERSION,
    exportedAt: parsed.exportedAt,
    preferences,
    rateLimitMetadata:
      isRecord(parsed.rateLimitMetadata) &&
      typeof parsed.rateLimitMetadata.defaultGlobalCooldownSeconds === "number"
        ? (parsed.rateLimitMetadata as ConnectorProfileRateLimitMetadata)
        : buildConnectorProfileRateLimitMetadata(),
    privacyWarnings:
      isRecord(parsed.privacyWarnings) &&
      typeof parsed.privacyWarnings.enrichmentDisclaimer === "string" &&
      typeof parsed.privacyWarnings.riskScoreDisclaimer === "string"
        ? {
            enrichmentDisclaimer: parsed.privacyWarnings.enrichmentDisclaimer,
            riskScoreDisclaimer: parsed.privacyWarnings.riskScoreDisclaimer,
          }
        : buildConnectorProfilePrivacyWarnings(),
  };

  return { document, preferences };
}

export function mergeImportedConnectorProfile(
  current: Vera5Settings,
  preferences: ConnectorProfilePreferences
): Vera5Settings {
  return {
    ...current,
    iocTypeEnabled: { ...preferences.iocTypeEnabled },
    enrichmentSourceEnabled: { ...preferences.enrichmentSourceEnabled },
    includePrivateIpv4: preferences.includePrivateIpv4,
    manualOnlyMode: preferences.manualOnlyMode,
    enrichmentCacheTtlSeconds: preferences.enrichmentCacheTtlSeconds,
    enrichmentSourceCacheTtlSeconds: {
      ...preferences.enrichmentSourceCacheTtlSeconds,
    },
  };
}

export async function exportConnectorProfileJson(): Promise<string> {
  const settings = await getVera5Settings();
  return serializeConnectorProfileExport(settings);
}

export async function importConnectorProfileJson(rawJson: string): Promise<void> {
  const current = await getVera5Settings();
  const { preferences } = parseConnectorProfileDocument(rawJson);
  const merged = mergeImportedConnectorProfile(current, preferences);
  await chrome.storage.local.set(vera5SettingsToStoragePayload(merged));
}
