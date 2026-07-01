import {
  applyAnalystModePresetToSettings,
  getAnalystModePresetById,
  normalizeAnalystModePresetId,
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
  type AnalystModePresetId,
} from "./analystModePresets";
import type { ExportTemplateId } from "./exportTemplates";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";
import type { PivotProvider } from "./pivots";
import {
  createDefaultDomainPolicy,
  DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES,
  normalizeDomainPolicyEntry,
  normalizeDomainPolicyList,
  normalizeDomainPolicyMode,
  type DomainPolicy,
  type DomainPolicyMode,
} from "./domainPolicy";
import {
  normalizeInternalAssetCidrList,
  normalizeInternalAssetVendorLabels,
  type InternalAssetPolicy,
  type InternalAssetVendorLabelEntry,
} from "./internalAssetPolicy";
import type { IocType } from "./iocRegex";
import {
  API_KEY_STORAGE_SLOTS,
  ENRICHMENT_SOURCE_DEFINITIONS,
  ENRICHMENT_SOURCE_ORDER,
  isApiKeyStorageSlot,
  type ApiKeyStorageSlot,
} from "./enrichmentSourceRegistry";

export const SETTINGS_SCHEMA_VERSION = 8;

export const STORAGE_SCHEMA_VERSION = SETTINGS_SCHEMA_VERSION;

export const DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS = 3600;

export const STORAGE_KEY_EXTENSION_ENABLED = "extensionEnabled";
export const STORAGE_KEY_HIGHLIGHT_ENABLED = "highlightEnabled";
export const STORAGE_KEY_STORAGE_SCHEMA_VERSION = "storageSchemaVersion";
/** @deprecated Legacy settings key; read for migration only. */
export const STORAGE_KEY_SCHEMA_VERSION = "settingsSchemaVersion";
export const STORAGE_KEY_AUTO_SCAN_ENABLED = "autoScanEnabled";
export const STORAGE_KEY_MANUAL_ONLY_MODE = "manualOnlyMode";
export const STORAGE_KEY_INCLUDE_PRIVATE_IPV4 = "includePrivateIpv4";
export const STORAGE_KEY_LOCAL_BACKEND_ENABLED = "localBackendEnabled";
export const STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED = "localLlmSummaryEnabled";
export const STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED =
  "attributeHrefExtractionEnabled";
export const STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED =
  "attributeHrefExtractionConsentAcknowledged";
export const STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES =
  "attributeHrefExtractionRememberSiteChoices";
export const STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES =
  "attributeHrefExtractionSitePreferences";
export const STORAGE_KEY_API_KEYS = "apiKeys";
export const STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED = "enrichmentSourceEnabled";
export const STORAGE_KEY_IOC_TYPE_ENABLED = "iocTypeEnabled";
export const STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS =
  "enrichmentCacheTtlSeconds";
export const STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS =
  "enrichmentSourceCacheTtlSeconds";
export const STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE =
  "showDisabledSourcesInWorkspace";
export const STORAGE_KEY_SHOW_PRE_QUERY_NOTICES = "showPreQueryNotices";
export const STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED =
  "preQueryNoticePreferenceConfigured";
export const STORAGE_KEY_INSTALL_QUICK_START_COMPLETED =
  "installQuickStartCompleted";
export const STORAGE_KEY_DOMAIN_POLICY_MODE = "domainPolicyMode";
export const STORAGE_KEY_DOMAIN_ALLOWLIST = "domainAllowlist";
export const STORAGE_KEY_DOMAIN_DENYLIST = "domainDenylist";
export const STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED =
  "domainPolicyEnrichGateEnabled";
export const STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED =
  "internalAssetEnrichGateEnabled";
export const STORAGE_KEY_INTERNAL_ASSET_DOMAINS = "internalAssetDomains";
export const STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES = "internalAssetCidrRanges";
export const STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS = "internalAssetVendorLabels";
export const STORAGE_KEY_ANALYST_MODE_PRESET_ID = "analystModePresetId";
export const STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID = "defaultExportTemplateId";
export const STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS = "pivotEmphasisProviders";

export type { DomainPolicy, DomainPolicyMode };
export type { InternalAssetPolicy, InternalAssetVendorLabelEntry };

export const STORAGE_KEYS = {
  EXTENSION_ENABLED: STORAGE_KEY_EXTENSION_ENABLED,
  HIGHLIGHT_ENABLED: STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_SCHEMA_VERSION: STORAGE_KEY_STORAGE_SCHEMA_VERSION,
  AUTO_SCAN_ENABLED: STORAGE_KEY_AUTO_SCAN_ENABLED,
  MANUAL_ONLY_MODE: STORAGE_KEY_MANUAL_ONLY_MODE,
  INCLUDE_PRIVATE_IPV4: STORAGE_KEY_INCLUDE_PRIVATE_IPV4,
  LOCAL_BACKEND_ENABLED: STORAGE_KEY_LOCAL_BACKEND_ENABLED,
  LOCAL_LLM_SUMMARY_ENABLED: STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED,
  ATTRIBUTE_HREF_EXTRACTION_ENABLED:
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED:
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED,
  ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES:
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
  ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES:
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
  API_KEYS: STORAGE_KEY_API_KEYS,
  ENRICHMENT_SOURCE_ENABLED: STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  IOC_TYPE_ENABLED: STORAGE_KEY_IOC_TYPE_ENABLED,
  ENRICHMENT_CACHE_TTL_SECONDS: STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  ENRICHMENT_SOURCE_CACHE_TTL_SECONDS:
    STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
  SHOW_DISABLED_SOURCES_IN_WORKSPACE:
    STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE,
  SHOW_PRE_QUERY_NOTICES: STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED:
    STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  INSTALL_QUICK_START_COMPLETED: STORAGE_KEY_INSTALL_QUICK_START_COMPLETED,
  DOMAIN_POLICY_MODE: STORAGE_KEY_DOMAIN_POLICY_MODE,
  DOMAIN_ALLOWLIST: STORAGE_KEY_DOMAIN_ALLOWLIST,
  DOMAIN_DENYLIST: STORAGE_KEY_DOMAIN_DENYLIST,
  DOMAIN_POLICY_ENRICH_GATE_ENABLED:
    STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  INTERNAL_ASSET_ENRICH_GATE_ENABLED:
    STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
  INTERNAL_ASSET_DOMAINS: STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
  INTERNAL_ASSET_CIDR_RANGES: STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  INTERNAL_ASSET_VENDOR_LABELS: STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
  ANALYST_MODE_PRESET_ID: STORAGE_KEY_ANALYST_MODE_PRESET_ID,
  DEFAULT_EXPORT_TEMPLATE_ID: STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  PIVOT_EMPHASIS_PROVIDERS: STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
} as const;

export type ApiKeySlot = ApiKeyStorageSlot;

export type ApiKeysRecord = Partial<Record<ApiKeySlot, string>>;

export type EnrichmentSourceEnabledRecord = Partial<
  Record<EnrichmentSourceId, boolean>
>;

export type IocTypeEnabledRecord = Partial<Record<IocType, boolean>>;

export type EnrichmentSourceCacheTtlRecord = Partial<
  Record<EnrichmentSourceId, number>
>;

export type AttributeHrefSitePreference = "on" | "off";

export type AttributeHrefSitePreferencesRecord = Record<
  string,
  AttributeHrefSitePreference
>;

export type Vera5Settings = {
  extensionEnabled: boolean;
  highlightEnabled: boolean;
  storageSchemaVersion: number;
  autoScanEnabled: boolean;
  manualOnlyMode: boolean;
  includePrivateIpv4: boolean;
  localBackendEnabled: boolean;
  localLlmSummaryEnabled: boolean;
  attributeHrefExtractionEnabled: boolean;
  attributeHrefExtractionConsentAcknowledged: boolean;
  attributeHrefExtractionRememberSiteChoices: boolean;
  attributeHrefExtractionSitePreferences: AttributeHrefSitePreferencesRecord;
  apiKeys: ApiKeysRecord;
  enrichmentSourceEnabled: EnrichmentSourceEnabledRecord;
  iocTypeEnabled: IocTypeEnabledRecord;
  enrichmentCacheTtlSeconds: number;
  enrichmentSourceCacheTtlSeconds: EnrichmentSourceCacheTtlRecord;
  showDisabledSourcesInWorkspace: boolean;
  showPreQueryNotices: boolean;
  preQueryNoticePreferenceConfigured: boolean;
  installQuickStartCompleted: boolean;
  domainPolicyMode: DomainPolicyMode;
  domainAllowlist: string[];
  domainDenylist: string[];
  domainPolicyEnrichGateEnabled: boolean;
  internalAssetEnrichGateEnabled: boolean;
  internalAssetDomains: string[];
  internalAssetCidrRanges: string[];
  internalAssetVendorLabels: InternalAssetVendorLabelEntry[];
  analystModePresetId: string;
  defaultExportTemplateId: ExportTemplateId;
  pivotEmphasisProviders: PivotProvider[];
};

export type Vera5StorageRaw = {
  [STORAGE_KEY_EXTENSION_ENABLED]?: unknown;
  [STORAGE_KEY_HIGHLIGHT_ENABLED]?: unknown;
  [STORAGE_KEY_STORAGE_SCHEMA_VERSION]?: unknown;
  [STORAGE_KEY_SCHEMA_VERSION]?: unknown;
  [STORAGE_KEY_AUTO_SCAN_ENABLED]?: unknown;
  [STORAGE_KEY_MANUAL_ONLY_MODE]?: unknown;
  [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]?: unknown;
  [STORAGE_KEY_LOCAL_BACKEND_ENABLED]?: unknown;
  [STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED]?: unknown;
  [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]?: unknown;
  [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED]?: unknown;
  [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES]?: unknown;
  [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]?: unknown;
  [STORAGE_KEY_API_KEYS]?: unknown;
  [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]?: unknown;
  [STORAGE_KEY_IOC_TYPE_ENABLED]?: unknown;
  [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]?: unknown;
  [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]?: unknown;
  [STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE]?: unknown;
  [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]?: unknown;
  [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]?: unknown;
  [STORAGE_KEY_INSTALL_QUICK_START_COMPLETED]?: unknown;
  [STORAGE_KEY_DOMAIN_POLICY_MODE]?: unknown;
  [STORAGE_KEY_DOMAIN_ALLOWLIST]?: unknown;
  [STORAGE_KEY_DOMAIN_DENYLIST]?: unknown;
  [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]?: unknown;
  [STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED]?: unknown;
  [STORAGE_KEY_INTERNAL_ASSET_DOMAINS]?: unknown;
  [STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES]?: unknown;
  [STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS]?: unknown;
  [STORAGE_KEY_ANALYST_MODE_PRESET_ID]?: unknown;
  [STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]?: unknown;
  [STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS]?: unknown;
};

export const VERA5_SETTINGS_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_KEY_STORAGE_SCHEMA_VERSION,
  STORAGE_KEY_AUTO_SCAN_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
  STORAGE_KEY_INCLUDE_PRIVATE_IPV4,
  STORAGE_KEY_LOCAL_BACKEND_ENABLED,
  STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  STORAGE_KEY_INSTALL_QUICK_START_COMPLETED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
  STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
  STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
  STORAGE_KEY_ANALYST_MODE_PRESET_ID,
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
];

export const VERA5_SETTINGS_READ_KEYS: readonly string[] = [
  ...VERA5_SETTINGS_STORAGE_KEYS,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
];

export const API_KEY_SLOTS: readonly ApiKeySlot[] = API_KEY_STORAGE_SLOTS;

export const IOC_TYPE_SETTINGS_ORDER: readonly IocType[] = [
  "ipv4",
  "domain",
  "url",
  "md5",
  "sha1",
  "sha256",
  "cve",
  "email",
  "asn",
  "cidr",
  "filepath",
  "onion",
];

const IOC_TYPE_SET = new Set<string>(IOC_TYPE_SETTINGS_ORDER);

export function isApiKeysRecord(value: unknown): value is ApiKeysRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, entry]) =>
      isApiKeyStorageSlot(key) && typeof entry === "string"
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
      ENRICHMENT_SOURCE_ORDER.includes(key as EnrichmentSourceId) &&
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
      ENRICHMENT_SOURCE_ORDER.includes(key as EnrichmentSourceId) &&
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
  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    record[sourceId] = ENRICHMENT_SOURCE_DEFINITIONS[sourceId].enabledDefault;
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
    storageSchemaVersion: SETTINGS_SCHEMA_VERSION,
    autoScanEnabled: false,
    manualOnlyMode: true,
    includePrivateIpv4: false,
    localBackendEnabled: false,
    localLlmSummaryEnabled: false,
    attributeHrefExtractionEnabled: false,
    attributeHrefExtractionConsentAcknowledged: false,
    attributeHrefExtractionRememberSiteChoices: false,
    attributeHrefExtractionSitePreferences: {},
    apiKeys: createDefaultApiKeysRecord(),
    enrichmentSourceEnabled: createDefaultEnrichmentSourceEnabledRecord(),
    iocTypeEnabled: createDefaultIocTypeEnabledRecord(),
    enrichmentCacheTtlSeconds: DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
    enrichmentSourceCacheTtlSeconds:
      createDefaultEnrichmentSourceCacheTtlRecord(),
    showDisabledSourcesInWorkspace: false,
    showPreQueryNotices: true,
    preQueryNoticePreferenceConfigured: false,
    installQuickStartCompleted: false,
    domainPolicyMode: createDefaultDomainPolicy().mode,
    domainAllowlist: [],
    domainDenylist: [...createDefaultDomainPolicy().denylist],
    domainPolicyEnrichGateEnabled: true,
    internalAssetEnrichGateEnabled: true,
    internalAssetDomains: [],
    internalAssetCidrRanges: [],
    internalAssetVendorLabels: [],
    analystModePresetId: "",
    defaultExportTemplateId: "analyst-update",
    pivotEmphasisProviders: [],
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
    if (ENRICHMENT_SOURCE_ORDER.includes(key as EnrichmentSourceId)) {
      record[key as EnrichmentSourceId] = Math.floor(ttl as number);
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

export function readStorageSchemaVersion(raw: Vera5StorageRaw): number {
  if (raw[STORAGE_KEY_STORAGE_SCHEMA_VERSION] !== undefined) {
    return readStoredSchemaVersion(
      raw[STORAGE_KEY_STORAGE_SCHEMA_VERSION],
      0
    );
  }
  return readStoredSchemaVersion(raw[STORAGE_KEY_SCHEMA_VERSION], 0);
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

export function normalizeAttributeHrefSitePreferenceHost(
  hostname: string
): string {
  return normalizeDomainPolicyEntry(hostname);
}

export function normalizeAttributeHrefSitePreferencesRecord(
  value: unknown
): AttributeHrefSitePreferencesRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: AttributeHrefSitePreferencesRecord = {};
  for (const [rawHost, preference] of Object.entries(value)) {
    if (preference !== "on" && preference !== "off") {
      continue;
    }
    const host = normalizeAttributeHrefSitePreferenceHost(rawHost);
    if (host.length === 0) {
      continue;
    }
    record[host] = preference;
  }
  return record;
}

export function resolveAttributeHrefExtractionForHost(
  settings: Pick<
    Vera5Settings,
    | "attributeHrefExtractionEnabled"
    | "attributeHrefExtractionRememberSiteChoices"
    | "attributeHrefExtractionSitePreferences"
  >,
  hostname: string
): boolean {
  if (!settings.attributeHrefExtractionEnabled) {
    return false;
  }
  if (!settings.attributeHrefExtractionRememberSiteChoices) {
    return true;
  }
  const host = normalizeAttributeHrefSitePreferenceHost(hostname);
  if (host.length === 0) {
    return true;
  }
  const preference = settings.attributeHrefExtractionSitePreferences[host];
  if (preference === "off") {
    return false;
  }
  return true;
}

export function normalizeEnrichmentSourceEnabledRecord(
  value: unknown
): EnrichmentSourceEnabledRecord {
  const defaults = createDefaultEnrichmentSourceEnabledRecord();
  if (!isEnrichmentSourceEnabledRecord(value)) {
    return defaults;
  }

  const normalized: EnrichmentSourceEnabledRecord = { ...defaults };
  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
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
    storageSchemaVersion: readStorageSchemaVersion(raw),
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
    localBackendEnabled: readStoredBoolean(
      raw[STORAGE_KEY_LOCAL_BACKEND_ENABLED],
      defaults.localBackendEnabled
    ),
    localLlmSummaryEnabled: readStoredBoolean(
      raw[STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED],
      defaults.localLlmSummaryEnabled
    ),
    attributeHrefExtractionEnabled: readStoredBoolean(
      raw[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED],
      defaults.attributeHrefExtractionEnabled
    ),
    attributeHrefExtractionConsentAcknowledged: readStoredBoolean(
      raw[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED],
      defaults.attributeHrefExtractionConsentAcknowledged
    ),
    attributeHrefExtractionRememberSiteChoices: readStoredBoolean(
      raw[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES],
      defaults.attributeHrefExtractionRememberSiteChoices
    ),
    attributeHrefExtractionSitePreferences:
      normalizeAttributeHrefSitePreferencesRecord(
        raw[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]
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
    showDisabledSourcesInWorkspace: readStoredBoolean(
      raw[STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE],
      defaults.showDisabledSourcesInWorkspace
    ),
    showPreQueryNotices: readStoredBoolean(
      raw[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES],
      defaults.showPreQueryNotices
    ),
    preQueryNoticePreferenceConfigured: readStoredBoolean(
      raw[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED],
      defaults.preQueryNoticePreferenceConfigured
    ),
    installQuickStartCompleted: readStoredBoolean(
      raw[STORAGE_KEY_INSTALL_QUICK_START_COMPLETED],
      defaults.installQuickStartCompleted
    ),
    domainPolicyMode: normalizeDomainPolicyMode(
      raw[STORAGE_KEY_DOMAIN_POLICY_MODE]
    ),
    domainAllowlist: normalizeDomainPolicyList(
      raw[STORAGE_KEY_DOMAIN_ALLOWLIST]
    ),
    domainDenylist:
      raw[STORAGE_KEY_DOMAIN_DENYLIST] === undefined
        ? [...defaults.domainDenylist]
        : normalizeDomainPolicyList(raw[STORAGE_KEY_DOMAIN_DENYLIST]),
    domainPolicyEnrichGateEnabled: readStoredBoolean(
      raw[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED],
      defaults.domainPolicyEnrichGateEnabled
    ),
    internalAssetEnrichGateEnabled: readStoredBoolean(
      raw[STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED],
      defaults.internalAssetEnrichGateEnabled
    ),
    internalAssetDomains: normalizeDomainPolicyList(
      raw[STORAGE_KEY_INTERNAL_ASSET_DOMAINS]
    ),
    internalAssetCidrRanges: normalizeInternalAssetCidrList(
      raw[STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES]
    ),
    internalAssetVendorLabels: normalizeInternalAssetVendorLabels(
      raw[STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS]
    ),
    analystModePresetId: normalizeAnalystModePresetId(
      raw[STORAGE_KEY_ANALYST_MODE_PRESET_ID]
    ),
    defaultExportTemplateId: normalizeDefaultExportTemplateId(
      raw[STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]
    ),
    pivotEmphasisProviders: normalizePivotEmphasisProviders(
      raw[STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS]
    ),
  };
}

export function migrateVera5StorageRaw(raw: Vera5StorageRaw): Vera5StorageRaw {
  const version = readStorageSchemaVersion(raw);
  const migrated: Vera5StorageRaw = { ...raw };

  if (version < 2) {
    const denylist = migrated[STORAGE_KEY_DOMAIN_DENYLIST];
    if (
      denylist === undefined ||
      (Array.isArray(denylist) && denylist.length === 0)
    ) {
      migrated[STORAGE_KEY_DOMAIN_DENYLIST] = [
        ...DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES,
      ];
    }
    migrated[STORAGE_KEY_SCHEMA_VERSION] = 2;
  }

  if (readStorageSchemaVersion(migrated) < 3) {
    migrated[STORAGE_KEY_IOC_TYPE_ENABLED] = normalizeIocTypeEnabledRecord(
      migrated[STORAGE_KEY_IOC_TYPE_ENABLED]
    );
    migrated[STORAGE_KEY_SCHEMA_VERSION] = 3;
  }

  if (readStorageSchemaVersion(migrated) < 4) {
    migrated[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 4;
    delete migrated[STORAGE_KEY_SCHEMA_VERSION];
  }

  if (readStorageSchemaVersion(migrated) < 5) {
    migrated[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] =
      normalizeEnrichmentSourceEnabledRecord(
        migrated[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]
      );
    migrated[STORAGE_KEY_API_KEYS] = normalizeApiKeysRecord(
      migrated[STORAGE_KEY_API_KEYS]
    );
    migrated[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS] =
      normalizeEnrichmentSourceCacheTtlRecord(
        migrated[STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]
      );
    migrated[STORAGE_KEY_IOC_TYPE_ENABLED] = normalizeIocTypeEnabledRecord(
      migrated[STORAGE_KEY_IOC_TYPE_ENABLED]
    );
    const normalizedSettings = normalizeVera5Settings(migrated);
    Object.assign(
      migrated,
      vera5SettingsToStoragePayload({
        ...normalizedSettings,
        storageSchemaVersion: 5,
      })
    );
  }

  if (readStorageSchemaVersion(migrated) < 6) {
    if (migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] === undefined) {
      migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = false;
    }
    migrated[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 6;
  }

  if (readStorageSchemaVersion(migrated) < 7) {
    if (
      migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED] ===
      undefined
    ) {
      migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED] =
        false;
    }
    migrated[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 7;
  }

  if (readStorageSchemaVersion(migrated) < 8) {
    if (
      migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES] ===
      undefined
    ) {
      migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES] =
        false;
    }
    migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES] =
      normalizeAttributeHrefSitePreferencesRecord(
        migrated[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]
      );
    migrated[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 8;
  }

  if (readStorageSchemaVersion(migrated) >= SETTINGS_SCHEMA_VERSION) {
    return migrated;
  }

  return {
    ...migrated,
    [STORAGE_KEY_STORAGE_SCHEMA_VERSION]: SETTINGS_SCHEMA_VERSION,
  };
}

export function vera5SettingsToStoragePayload(
  settings: Vera5Settings
): Record<string, unknown> {
  return {
    [STORAGE_KEY_EXTENSION_ENABLED]: settings.extensionEnabled,
    [STORAGE_KEY_HIGHLIGHT_ENABLED]: settings.highlightEnabled,
    [STORAGE_KEY_STORAGE_SCHEMA_VERSION]: settings.storageSchemaVersion,
    [STORAGE_KEY_AUTO_SCAN_ENABLED]: settings.autoScanEnabled,
    [STORAGE_KEY_MANUAL_ONLY_MODE]: settings.manualOnlyMode,
    [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]: settings.includePrivateIpv4,
    [STORAGE_KEY_LOCAL_BACKEND_ENABLED]: settings.localBackendEnabled,
    [STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED]: settings.localLlmSummaryEnabled,
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]:
      settings.attributeHrefExtractionEnabled,
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED]:
      settings.attributeHrefExtractionConsentAcknowledged,
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES]:
      settings.attributeHrefExtractionRememberSiteChoices,
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]:
      settings.attributeHrefExtractionSitePreferences,
    [STORAGE_KEY_API_KEYS]: settings.apiKeys,
    [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: settings.enrichmentSourceEnabled,
    [STORAGE_KEY_IOC_TYPE_ENABLED]: settings.iocTypeEnabled,
    [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]:
      settings.enrichmentCacheTtlSeconds,
    [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS]:
      settings.enrichmentSourceCacheTtlSeconds,
    [STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE]:
      settings.showDisabledSourcesInWorkspace,
    [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: settings.showPreQueryNotices,
    [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]:
      settings.preQueryNoticePreferenceConfigured,
    [STORAGE_KEY_INSTALL_QUICK_START_COMPLETED]:
      settings.installQuickStartCompleted,
    [STORAGE_KEY_DOMAIN_POLICY_MODE]: settings.domainPolicyMode,
    [STORAGE_KEY_DOMAIN_ALLOWLIST]: settings.domainAllowlist,
    [STORAGE_KEY_DOMAIN_DENYLIST]: settings.domainDenylist,
    [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]:
      settings.domainPolicyEnrichGateEnabled,
    [STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED]:
      settings.internalAssetEnrichGateEnabled,
    [STORAGE_KEY_INTERNAL_ASSET_DOMAINS]: settings.internalAssetDomains,
    [STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES]: settings.internalAssetCidrRanges,
    [STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS]:
      settings.internalAssetVendorLabels,
    [STORAGE_KEY_ANALYST_MODE_PRESET_ID]: settings.analystModePresetId,
    [STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]: settings.defaultExportTemplateId,
    [STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS]: settings.pivotEmphasisProviders,
  };
}

export function needsStorageMigration(raw: Vera5StorageRaw): boolean {
  if (raw[STORAGE_KEY_SCHEMA_VERSION] !== undefined) {
    return true;
  }

  if (readStorageSchemaVersion(raw) !== SETTINGS_SCHEMA_VERSION) {
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

export type StorageMigrationResult = {
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
};

export async function runStorageMigrationIfNeeded(): Promise<StorageMigrationResult> {
  const { runStorageMigrationIfNeeded: runMigration } = await import(
    "./storageMigration"
  );
  return runMigration();
}

export async function getVera5Settings(): Promise<Vera5Settings> {
  await runStorageMigrationIfNeeded();
  const raw = (await chrome.storage.local.get(
    VERA5_SETTINGS_READ_KEYS
  )) as Vera5StorageRaw;
  const settings = normalizeVera5Settings(migrateVera5StorageRaw(raw));

  return {
    ...settings,
    storageSchemaVersion: SETTINGS_SCHEMA_VERSION,
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

export async function getLocalBackendEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.localBackendEnabled;
}

export async function setLocalBackendEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_LOCAL_BACKEND_ENABLED]: enabled,
  });
}

export async function getLocalLlmSummaryEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.localLlmSummaryEnabled;
}

export async function setLocalLlmSummaryEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_LOCAL_LLM_SUMMARY_ENABLED]: enabled,
  });
}

export async function getAttributeHrefExtractionEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.attributeHrefExtractionEnabled;
}

export async function setAttributeHrefExtractionEnabled(
  enabled: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]: enabled,
  });
}

export async function getAttributeHrefExtractionConsentAcknowledged(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.attributeHrefExtractionConsentAcknowledged;
}

export async function setAttributeHrefExtractionConsentAcknowledged(
  acknowledged: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED]: acknowledged,
  });
}

export async function getAttributeHrefExtractionRememberSiteChoices(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.attributeHrefExtractionRememberSiteChoices;
}

export async function setAttributeHrefExtractionRememberSiteChoices(
  enabled: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES]: enabled,
  });
}

export async function getAttributeHrefExtractionSitePreferences(): Promise<AttributeHrefSitePreferencesRecord> {
  const settings = await getVera5Settings();
  return settings.attributeHrefExtractionSitePreferences;
}

export async function setAttributeHrefExtractionSitePreferences(
  preferences: AttributeHrefSitePreferencesRecord
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]:
      normalizeAttributeHrefSitePreferencesRecord(preferences),
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
): EnrichmentSourceId[] {
  return ENRICHMENT_SOURCE_ORDER.filter((sourceId) => sources[sourceId] !== true);
}

export async function getShowDisabledSourcesInWorkspace(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.showDisabledSourcesInWorkspace;
}

export async function setShowDisabledSourcesInWorkspace(
  enabled: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE]: enabled,
  });
}

export async function getShowPreQueryNotices(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.showPreQueryNotices;
}

export async function getPreQueryNoticePreferenceConfigured(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.preQueryNoticePreferenceConfigured;
}

export async function getInstallQuickStartCompleted(): Promise<boolean> {
  const settings = await getVera5Settings();
  if (settings.installQuickStartCompleted) {
    return true;
  }
  return settings.preQueryNoticePreferenceConfigured;
}

export async function completeInstallQuickStart(
  showPreQueryNotices: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INSTALL_QUICK_START_COMPLETED]: true,
    [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: showPreQueryNotices,
    [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]: true,
    [STORAGE_KEY_AUTO_SCAN_ENABLED]: false,
  });
}

export async function setPreQueryNoticePreference(
  showNotices: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: showNotices,
    [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]: true,
  });
}

export async function setShowPreQueryNotices(enabled: boolean): Promise<void> {
  await setPreQueryNoticePreference(enabled);
}

export async function getDomainPolicyMode(): Promise<DomainPolicyMode> {
  const settings = await getVera5Settings();
  return settings.domainPolicyMode;
}

export async function setDomainPolicyMode(mode: DomainPolicyMode): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_DOMAIN_POLICY_MODE]: normalizeDomainPolicyMode(mode),
  });
}

export async function getDomainAllowlist(): Promise<string[]> {
  const settings = await getVera5Settings();
  return [...settings.domainAllowlist];
}

export async function setDomainAllowlist(entries: string[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_DOMAIN_ALLOWLIST]: normalizeDomainPolicyList(entries),
  });
}

export async function getDomainDenylist(): Promise<string[]> {
  const settings = await getVera5Settings();
  return [...settings.domainDenylist];
}

export async function setDomainDenylist(entries: string[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_DOMAIN_DENYLIST]: normalizeDomainPolicyList(entries),
  });
}

export async function getDomainPolicyEnrichGateEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.domainPolicyEnrichGateEnabled;
}

export async function setDomainPolicyEnrichGateEnabled(
  enabled: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]: enabled,
  });
}

export async function getInternalAssetEnrichGateEnabled(): Promise<boolean> {
  const settings = await getVera5Settings();
  return settings.internalAssetEnrichGateEnabled;
}

export async function setInternalAssetEnrichGateEnabled(
  enabled: boolean
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED]: enabled,
  });
}

export async function getInternalAssetDomains(): Promise<string[]> {
  const settings = await getVera5Settings();
  return [...settings.internalAssetDomains];
}

export async function setInternalAssetDomains(entries: string[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INTERNAL_ASSET_DOMAINS]: normalizeDomainPolicyList(entries),
  });
}

export async function getInternalAssetCidrRanges(): Promise<string[]> {
  const settings = await getVera5Settings();
  return [...settings.internalAssetCidrRanges];
}

export async function setInternalAssetCidrRanges(
  entries: string[]
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES]:
      normalizeInternalAssetCidrList(entries),
  });
}

export async function getInternalAssetVendorLabels(): Promise<
  InternalAssetVendorLabelEntry[]
> {
  const settings = await getVera5Settings();
  return settings.internalAssetVendorLabels.map((entry) => ({ ...entry }));
}

export async function setInternalAssetVendorLabels(
  entries: InternalAssetVendorLabelEntry[]
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS]:
      normalizeInternalAssetVendorLabels(entries),
  });
}

export async function getAnalystModePresetId(): Promise<string> {
  const settings = await getVera5Settings();
  return settings.analystModePresetId;
}

export async function getDefaultExportTemplateId(): Promise<ExportTemplateId> {
  const settings = await getVera5Settings();
  return settings.defaultExportTemplateId;
}

export async function setDefaultExportTemplateId(
  templateId: ExportTemplateId
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]:
      normalizeDefaultExportTemplateId(templateId),
  });
}

export async function getPivotEmphasisProviders(): Promise<PivotProvider[]> {
  const settings = await getVera5Settings();
  return [...settings.pivotEmphasisProviders];
}

export async function applyAnalystModePreset(
  presetId: AnalystModePresetId
): Promise<void> {
  const preset = getAnalystModePresetById(presetId);
  if (!preset) {
    return;
  }

  const settings = await getVera5Settings();
  const next = applyAnalystModePresetToSettings(settings, preset);
  await chrome.storage.local.set(vera5SettingsToStoragePayload(next));
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
