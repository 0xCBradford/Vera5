import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import type { IocType } from "./iocRegex";

export const SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS = 3600;

export const STORAGE_KEY_EXTENSION_ENABLED = "extensionEnabled";
export const STORAGE_KEY_HIGHLIGHT_ENABLED = "highlightEnabled";
export const STORAGE_KEY_SCHEMA_VERSION = "settingsSchemaVersion";
export const STORAGE_KEY_AUTO_SCAN_ENABLED = "autoScanEnabled";
export const STORAGE_KEY_MANUAL_ONLY_MODE = "manualOnlyMode";
export const STORAGE_KEY_INCLUDE_PRIVATE_IPV4 = "includePrivateIpv4";
export const STORAGE_KEY_API_KEYS = "apiKeys";
export const STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED = "enrichmentSourceEnabled";
export const STORAGE_KEY_IOC_TYPE_ENABLED = "iocTypeEnabled";
export const STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS =
  "enrichmentCacheTtlSeconds";
export const STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS =
  "enrichmentSourceCacheTtlSeconds";

export const STORAGE_KEYS = {
  EXTENSION_ENABLED: STORAGE_KEY_EXTENSION_ENABLED,
  HIGHLIGHT_ENABLED: STORAGE_KEY_HIGHLIGHT_ENABLED,
  SCHEMA_VERSION: STORAGE_KEY_SCHEMA_VERSION,
  AUTO_SCAN_ENABLED: STORAGE_KEY_AUTO_SCAN_ENABLED,
  MANUAL_ONLY_MODE: STORAGE_KEY_MANUAL_ONLY_MODE,
  INCLUDE_PRIVATE_IPV4: STORAGE_KEY_INCLUDE_PRIVATE_IPV4,
  API_KEYS: STORAGE_KEY_API_KEYS,
  ENRICHMENT_SOURCE_ENABLED: STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  IOC_TYPE_ENABLED: STORAGE_KEY_IOC_TYPE_ENABLED,
  ENRICHMENT_CACHE_TTL_SECONDS: STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  ENRICHMENT_SOURCE_CACHE_TTL_SECONDS:
    STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
} as const;

export type ApiKeySlot = EnrichmentSourceId;

export type ApiKeysRecord = Partial<Record<ApiKeySlot, string>>;

export type EnrichmentSourceEnabledRecord = Partial<
  Record<EnrichmentSourceId, boolean>
>;

export type IocTypeEnabledRecord = Partial<Record<IocType, boolean>>;

export type EnrichmentSourceCacheTtlRecord = Partial<
  Record<EnrichmentSourceId, number>
>;

export type Vera5Settings = {
  extensionEnabled: boolean;
  highlightEnabled: boolean;
  settingsSchemaVersion: number;
  autoScanEnabled: boolean;
  manualOnlyMode: boolean;
  includePrivateIpv4: boolean;
  apiKeys: ApiKeysRecord;
  enrichmentSourceEnabled: EnrichmentSourceEnabledRecord;
  iocTypeEnabled: IocTypeEnabledRecord;
  enrichmentCacheTtlSeconds: number;
  enrichmentSourceCacheTtlSeconds: EnrichmentSourceCacheTtlRecord;
};

export type Vera5StorageRaw = {
  [STORAGE_KEY_EXTENSION_ENABLED]?: unknown;
  [STORAGE_KEY_HIGHLIGHT_ENABLED]?: unknown;
  [STORAGE_KEY_SCHEMA_VERSION]?: unknown;
  [STORAGE_KEY_AUTO_SCAN_ENABLED]?: unknown;
  [STORAGE_KEY_MANUAL_ONLY_MODE]?: unknown;
  [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]?: unknown;
  [STORAGE_KEY_API_KEYS]?: unknown;
  [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]?: unknown;
  [STORAGE_KEY_IOC_TYPE_ENABLED]?: unknown;
  [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]?: unknown;
  [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]?: unknown;
};

export const VERA5_SETTINGS_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_AUTO_SCAN_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
  STORAGE_KEY_INCLUDE_PRIVATE_IPV4,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
];

export const VERA5_SETTINGS_READ_KEYS: readonly string[] = [
  ...VERA5_SETTINGS_STORAGE_KEYS,
  STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
];

export const API_KEY_SLOTS: readonly ApiKeySlot[] = [
  "abuseipdb",
  "otx",
  "urlscan",
  "greynoise",
];

export const IOC_TYPE_SETTINGS_ORDER: readonly IocType[] = [
  "ipv4",
  "domain",
  "url",
  "md5",
  "sha1",
  "sha256",
  "cve",
];

const IOC_TYPE_SET = new Set<string>(IOC_TYPE_SETTINGS_ORDER);

export function isApiKeysRecord(value: unknown): value is ApiKeysRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, entry]) =>
      API_KEY_SLOTS.includes(key as ApiKeySlot) && typeof entry === "string"
  );
}

export function isEnrichmentSourceEnabledRecord(
  value: unknown
): value is EnrichmentSourceEnabledRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, entry]) =>
      API_KEY_SLOTS.includes(key as EnrichmentSourceId) &&
      typeof entry === "boolean"
  );
}

export function isEnrichmentSourceCacheTtlRecord(
  value: unknown
): value is EnrichmentSourceCacheTtlRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, entry]) =>
      API_KEY_SLOTS.includes(key as ApiKeySlot) &&
      typeof entry === "number" &&
      Number.isFinite(entry) &&
      entry >= 0
  );
}

export function isIocTypeEnabledRecord(
  value: unknown
): value is IocTypeEnabledRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, entry]) => IOC_TYPE_SET.has(key) && typeof entry === "boolean"
  );
}

export function createDefaultApiKeysRecord(): ApiKeysRecord {
  return {};
}

export function createDefaultEnrichmentSourceEnabledRecord(): EnrichmentSourceEnabledRecord {
  const record: EnrichmentSourceEnabledRecord = {};
  for (const sourceId of API_KEY_SLOTS) {
    record[sourceId] = false;
  }
  return record;
}

export function createDefaultEnrichmentSourceCacheTtlRecord(): EnrichmentSourceCacheTtlRecord {
  return {};
}

export function createDefaultIocTypeEnabledRecord(): IocTypeEnabledRecord {
  const record: IocTypeEnabledRecord = {};
  for (const iocType of IOC_TYPE_SETTINGS_ORDER) {
    record[iocType] = true;
  }
  return record;
}

export function createDefaultVera5Settings(): Vera5Settings {
  return {
    extensionEnabled: true,
    highlightEnabled: true,
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    autoScanEnabled: false,
    manualOnlyMode: true,
    includePrivateIpv4: false,
    apiKeys: createDefaultApiKeysRecord(),
    enrichmentSourceEnabled: createDefaultEnrichmentSourceEnabledRecord(),
    iocTypeEnabled: createDefaultIocTypeEnabledRecord(),
    enrichmentCacheTtlSeconds: DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
    enrichmentSourceCacheTtlSeconds:
      createDefaultEnrichmentSourceCacheTtlRecord(),
  };
}

export function normalizeEnrichmentSourceCacheTtlRecord(
  value: unknown
): EnrichmentSourceCacheTtlRecord {
  if (!isEnrichmentSourceCacheTtlRecord(value)) {
    return createDefaultEnrichmentSourceCacheTtlRecord();
  }

  const record: EnrichmentSourceCacheTtlRecord = {};
  for (const [key, ttl] of Object.entries(value)) {
    if (API_KEY_SLOTS.includes(key as ApiKeySlot)) {
      record[key as ApiKeySlot] = Math.floor(ttl as number);
    }
  }
  return record;
}

function readStoredBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return Boolean(value);
}

function readStoredSchemaVersion(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function readStoredCacheTtlSeconds(
  value: unknown,
  fallback: number
): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return fallback;
}

export function normalizeApiKeysRecord(value: unknown): ApiKeysRecord {
  if (!isApiKeysRecord(value)) {
    return createDefaultApiKeysRecord();
  }

  const normalized: ApiKeysRecord = {};
  for (const slot of API_KEY_SLOTS) {
    const entry = value[slot];
    if (typeof entry === "string" && entry.length > 0) {
      normalized[slot] = entry;
    }
  }
  return normalized;
}

export function normalizeEnrichmentSourceEnabledRecord(
  value: unknown
): EnrichmentSourceEnabledRecord {
  const defaults = createDefaultEnrichmentSourceEnabledRecord();
  if (!isEnrichmentSourceEnabledRecord(value)) {
    return defaults;
  }

  const normalized: EnrichmentSourceEnabledRecord = { ...defaults };
  for (const sourceId of API_KEY_SLOTS) {
    const entry = value[sourceId];
    if (typeof entry === "boolean") {
      normalized[sourceId] = entry;
    }
  }
  return normalized;
}

export function normalizeIocTypeEnabledRecord(value: unknown): IocTypeEnabledRecord {
  const defaults = createDefaultIocTypeEnabledRecord();
  if (!isIocTypeEnabledRecord(value)) {
    return defaults;
  }

  const normalized: IocTypeEnabledRecord = { ...defaults };
  for (const iocType of IOC_TYPE_SETTINGS_ORDER) {
    const entry = value[iocType];
    if (typeof entry === "boolean") {
      normalized[iocType] = entry;
    }
  }
  return normalized;
}

export function normalizeVera5Settings(raw: Vera5StorageRaw): Vera5Settings {
  const defaults = createDefaultVera5Settings();
  return {
    extensionEnabled: readStoredBoolean(
      raw[STORAGE_KEY_EXTENSION_ENABLED],
      defaults.extensionEnabled
    ),
    highlightEnabled: readStoredBoolean(
      raw[STORAGE_KEY_HIGHLIGHT_ENABLED],
      defaults.highlightEnabled
    ),
    settingsSchemaVersion: readStoredSchemaVersion(
      raw[STORAGE_KEY_SCHEMA_VERSION],
      defaults.settingsSchemaVersion
    ),
    autoScanEnabled: readStoredBoolean(
      raw[STORAGE_KEY_AUTO_SCAN_ENABLED],
      defaults.autoScanEnabled
    ),
    manualOnlyMode: readStoredBoolean(
      raw[STORAGE_KEY_MANUAL_ONLY_MODE],
      defaults.manualOnlyMode
    ),
    includePrivateIpv4: readStoredBoolean(
      raw[STORAGE_KEY_INCLUDE_PRIVATE_IPV4],
      defaults.includePrivateIpv4
    ),
    apiKeys: normalizeApiKeysRecord(raw[STORAGE_KEY_API_KEYS]),
    enrichmentSourceEnabled: normalizeEnrichmentSourceEnabledRecord(
      raw[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]
    ),
    iocTypeEnabled: normalizeIocTypeEnabledRecord(
      raw[STORAGE_KEY_IOC_TYPE_ENABLED]
    ),
    enrichmentCacheTtlSeconds: readStoredCacheTtlSeconds(
      raw[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS],
      defaults.enrichmentCacheTtlSeconds
    ),
    enrichmentSourceCacheTtlSeconds: normalizeEnrichmentSourceCacheTtlRecord(
      raw[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]
    ),
  };
}

export function migrateVera5StorageRaw(raw: Vera5StorageRaw): Vera5StorageRaw {
  const version = readStoredSchemaVersion(raw[STORAGE_KEY_SCHEMA_VERSION], 0);
  if (version >= SETTINGS_SCHEMA_VERSION) {
    return raw;
  }

  return {
    ...raw,
    [STORAGE_KEY_SCHEMA_VERSION]: SETTINGS_SCHEMA_VERSION,
  };
}

export function vera5SettingsToStoragePayload(
  settings: Vera5Settings
): Record<string, unknown> {
  return {
    [STORAGE_KEY_EXTENSION_ENABLED]: settings.extensionEnabled,
    [STORAGE_KEY_HIGHLIGHT_ENABLED]: settings.highlightEnabled,
    [STORAGE_KEY_SCHEMA_VERSION]: settings.settingsSchemaVersion,
    [STORAGE_KEY_AUTO_SCAN_ENABLED]: settings.autoScanEnabled,
    [STORAGE_KEY_MANUAL_ONLY_MODE]: settings.manualOnlyMode,
    [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]: settings.includePrivateIpv4,
    [STORAGE_KEY_API_KEYS]: settings.apiKeys,
    [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: settings.enrichmentSourceEnabled,
    [STORAGE_KEY_IOC_TYPE_ENABLED]: settings.iocTypeEnabled,
    [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]:
      settings.enrichmentCacheTtlSeconds,
    [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]:
      settings.enrichmentSourceCacheTtlSeconds,
  };
}

export function needsStorageMigration(raw: Vera5StorageRaw): boolean {
  if (
    readStoredSchemaVersion(raw[STORAGE_KEY_SCHEMA_VERSION], 0) !==
    SETTINGS_SCHEMA_VERSION
  ) {
    return true;
  }

  if (
    raw[STORAGE_KEY_API_KEYS] !== undefined &&
    !isApiKeysRecord(raw[STORAGE_KEY_API_KEYS])
  ) {
    return true;
  }

  if (
    raw[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] !== undefined &&
    !isEnrichmentSourceEnabledRecord(raw[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED])
  ) {
    return true;
  }

  if (
    raw[STORAGE_KEY_IOC_TYPE_ENABLED] !== undefined &&
    !isIocTypeEnabledRecord(raw[STORAGE_KEY_IOC_TYPE_ENABLED])
  ) {
    return true;
  }

  for (const key of VERA5_SETTINGS_STORAGE_KEYS) {
    if (raw[key as keyof Vera5StorageRaw] === undefined) {
      return true;
    }
  }

  return false;
}

export async function getVera5Settings(): Promise<Vera5Settings> {
  const raw = (await chrome.storage.local.get(
    VERA5_SETTINGS_READ_KEYS
  )) as Vera5StorageRaw;
  const migrated = migrateVera5StorageRaw(raw);
  const settings = normalizeVera5Settings(migrated);

  if (needsStorageMigration(raw)) {
    const payload = vera5SettingsToStoragePayload({
      ...settings,
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    });
    await chrome.storage.local.set(payload);
  }

  return {
    ...settings,
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  };
}

export async function getExtensionEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.extensionEnabled;
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_EXTENSION_ENABLED]: enabled,
  });
}

export async function getHighlightEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.highlightEnabled;
}

export async function setHighlightEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_HIGHLIGHT_ENABLED]: enabled,
  });
}

export async function getAutoScanEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.autoScanEnabled;
}

export async function setAutoScanEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_AUTO_SCAN_ENABLED]: enabled,
  });
}

export async function getManualOnlyMode(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.manualOnlyMode;
}

export async function setManualOnlyMode(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_MANUAL_ONLY_MODE]: enabled,
  });
}

export async function getEnrichmentSourceEnabled(): Promise<EnrichmentSourceEnabledRecord> {
  const settings = await getVera5Settings();
  return settings.enrichmentSourceEnabled;
}

export async function setEnrichmentSourceEnabled(
  sourceId: ApiKeySlot,
  enabled: boolean
): Promise<void> {
  const settings = await getVera5Settings();
  const enrichmentSourceEnabled: EnrichmentSourceEnabledRecord = {
    ...settings.enrichmentSourceEnabled,
    [sourceId]: enabled,
  };

  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: enrichmentSourceEnabled,
  });
}

export async function getIocTypeEnabled(): Promise<IocTypeEnabledRecord> {
  const settings = await getVera5Settings();
  return settings.iocTypeEnabled;
}

export async function setIocTypeEnabled(
  iocType: IocType,
  enabled: boolean
): Promise<void> {
  const settings = await getVera5Settings();
  const iocTypeEnabled: IocTypeEnabledRecord = {
    ...settings.iocTypeEnabled,
    [iocType]: enabled,
  };

  await chrome.storage.local.set({
    [STORAGE_KEY_IOC_TYPE_ENABLED]: iocTypeEnabled,
  });
}

export async function getIncludePrivateIpv4(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.includePrivateIpv4;
}

export async function setIncludePrivateIpv4(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]: enabled,
  });
}

export async function getEnrichmentCacheTtlSecondsFromSettings(): Promise<number> {
  const settings = await getVera5Settings();
  return settings.enrichmentCacheTtlSeconds;
}

export async function setEnrichmentCacheTtlSeconds(
  ttlSeconds: number
): Promise<void> {
  const settings = await getVera5Settings();
  const normalized = readStoredCacheTtlSeconds(
    ttlSeconds,
    settings.enrichmentCacheTtlSeconds
  );
  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]: normalized,
  });
}

export async function getEnrichmentSourceCacheTtlSeconds(): Promise<EnrichmentSourceCacheTtlRecord> {
  const settings = await getVera5Settings();
  return settings.enrichmentSourceCacheTtlSeconds;
}

export function listDisabledEnrichmentSources(
  sources: EnrichmentSourceEnabledRecord
): ApiKeySlot[] {
  return API_KEY_SLOTS.filter((sourceId) => sources[sourceId] !== true);
}

export function maskApiKeyForDisplay(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 4) {
    return "•".repeat(trimmed.length);
  }
  return `${"•".repeat(8)}${trimmed.slice(-4)}`;
}

export function isMaskedApiKeyDisplay(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^•+[A-Za-z0-9]{0,4}$/.test(trimmed);
}

export async function hasApiKey(slot: ApiKeySlot): Promise<boolean> {
  const settings = await getVera5Settings();
  const value = settings.apiKeys[slot];
  return typeof value === "string" && value.trim().length > 0;
}

export async function getApiKey(slot: ApiKeySlot): Promise<string> {
  const settings = await getVera5Settings();
  return settings.apiKeys[slot] ?? "";
}

export async function setEnrichmentSourceCacheTtlSeconds(
  sourceId: ApiKeySlot,
  ttlSeconds: number | null
): Promise<void> {
  const settings = await getVera5Settings();
  const enrichmentSourceCacheTtlSeconds: EnrichmentSourceCacheTtlRecord = {
    ...settings.enrichmentSourceCacheTtlSeconds,
  };

  if (ttlSeconds === null) {
    delete enrichmentSourceCacheTtlSeconds[sourceId];
  } else {
    enrichmentSourceCacheTtlSeconds[sourceId] = readStoredCacheTtlSeconds(
      ttlSeconds,
      settings.enrichmentCacheTtlSeconds
    );
  }

  await chrome.storage.local.set({
    [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]:
      enrichmentSourceCacheTtlSeconds,
  });
}

export async function setApiKey(slot: ApiKeySlot, value: string): Promise<void> {
  const settings = await getVera5Settings();
  const apiKeys: ApiKeysRecord = { ...settings.apiKeys };
  const trimmed = value.trim();

  if (trimmed) {
    apiKeys[slot] = trimmed;
  } else {
    delete apiKeys[slot];
  }

  await chrome.storage.local.set({
    [STORAGE_KEY_API_KEYS]: apiKeys,
  });
}
