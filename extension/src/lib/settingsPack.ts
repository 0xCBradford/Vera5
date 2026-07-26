import {
  getAnalystModePresetById,
  normalizeAnalystModePresetId,
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
  applyAnalystModePresetToSettings,
  ANALYST_MODE_PRESET_CTI_ID,
  ANALYST_MODE_PRESET_SOC_ID,
  type AnalystModePresetId,
} from "./analystModePresets";
import {
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  normalizeDomainPolicyList,
  normalizeDomainPolicyMode,
  type DomainPolicyMode,
} from "./domainPolicy";
import {
  validateImportedConnectorConfidenceMetadataOverridesRecord,
  type ConnectorConfidenceMetadataOverridesRecord,
} from "./connectorDefinition";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  isEnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { ExportTemplateId } from "./exportTemplates";
import { PIVOT_PROVIDER, type PivotProvider } from "./pivots";
import {
  getPageContextPivotRecipeOrder,
  PAGE_CONTEXT_TYPE,
} from "./pageContext";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  getVera5Settings,
  normalizeEnrichmentSourceCacheTtlRecord,
  normalizeEnrichmentSourceEnabledRecord,
  readStoredCacheTtlSeconds,
  STORAGE_KEY_API_KEYS,
  createDefaultVera5Settings,
  vera5SettingsToStoragePayload,
  type EnrichmentSourceCacheTtlRecord,
  type EnrichmentSourceEnabledRecord,
  type Vera5Settings,
} from "./storage";
import type { ConnectorProfilePreferences } from "./connectorProfileExport";

export const SETTINGS_PACK_SCHEMA_VERSION = 1;

export const SETTINGS_PACK_EXPORT_FILENAME = "vera5-settings-pack.json";

export const SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE =
  "When an active threat profile and a settings pack both define the same preference, the threat profile wins for overlapping workflow fields (connectors, analyst mode, export template, pivot emphasis, quiet mode). Settings packs still apply cache TTL and domain policy unless a profile defines those fields. Neither overwrites stored API keys.";

export const THREAT_PROFILE_SCHEMA_VERSION = 1;

export const THREAT_PROFILE_EXPORT_FILENAME = "vera5-threat-profile.json";

/** Id/name used when exporting the current local settings as a portable profile. */
export const ACTIVE_THREAT_PROFILE_ID = "active";
export const ACTIVE_THREAT_PROFILE_NAME = "Active profile";
export const ACTIVE_THREAT_PROFILE_DESCRIPTION =
  "Snapshot of current local workflow preferences. Does not include API keys.";

/** Fallback analystMode / pivotRecipeSetId when no analyst preset is active. */
export const ACTIVE_THREAT_PROFILE_CUSTOM_MODE_ID = "custom";

/** Built-in portable threat profile ids (shipped constants; no API keys). */
export const BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE = "soc-triage";
export const BUILT_IN_THREAT_PROFILE_ID_CTI = "cti-research";
export const BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH = "malware-research";

export const BUILT_IN_THREAT_PROFILE_IDS = [
  BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE,
  BUILT_IN_THREAT_PROFILE_ID_CTI,
  BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH,
] as const;

export type BuiltInThreatProfileId = (typeof BUILT_IN_THREAT_PROFILE_IDS)[number];

const BUILT_IN_THREAT_PROFILE_ID_SET = new Set<string>(BUILT_IN_THREAT_PROFILE_IDS);

export function isBuiltInThreatProfileId(
  value: unknown
): value is BuiltInThreatProfileId {
  return typeof value === "string" && BUILT_IN_THREAT_PROFILE_ID_SET.has(value);
}

export function listBuiltInThreatProfileIds(): readonly BuiltInThreatProfileId[] {
  return BUILT_IN_THREAT_PROFILE_IDS;
}

/**
 * Domain-forward pivot ordering for the Malware Research built-in profile
 * (reputation and web infrastructure before IP abuse lists).
 */
export const BUILT_IN_MALWARE_RESEARCH_DOMAIN_FORWARD_PIVOTS: readonly PivotProvider[] =
  [
    PIVOT_PROVIDER.VIRUSTOTAL,
    PIVOT_PROVIDER.URLSCAN,
    PIVOT_PROVIDER.OTX,
    PIVOT_PROVIDER.SHODAN,
    PIVOT_PROVIDER.PULSEDIVE,
    PIVOT_PROVIDER.CENSYS,
    PIVOT_PROVIDER.URLHAUS,
    PIVOT_PROVIDER.MALWAREBAZAAR,
    PIVOT_PROVIDER.THREATFOX,
    PIVOT_PROVIDER.ABUSEIPDB,
    PIVOT_PROVIDER.GREYNOISE,
    PIVOT_PROVIDER.RDAP_WHOIS,
  ];

/** Shipped Malware Research portable profile (no API keys). */
export const BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH: ThreatProfile = {
  threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
  id: BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH,
  name: "Malware Research",
  description:
    "Domain-forward pivots, CTI markdown export template, and enrich-friendly connector defaults for malware and infrastructure research. Does not include API keys.",
  enabledConnectors: [
    ENRICHMENT_SOURCE.OTX,
    ENRICHMENT_SOURCE.VIRUSTOTAL,
    ENRICHMENT_SOURCE.URLSCAN,
    ENRICHMENT_SOURCE.MALWAREBAZAAR,
    ENRICHMENT_SOURCE.THREATFOX,
    ENRICHMENT_SOURCE.URLHAUS,
    ENRICHMENT_SOURCE.ABUSEIPDB,
    ENRICHMENT_SOURCE.RDAP_WHOIS,
  ],
  pivotRecipeSetId: BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH,
  defaultExportTemplateId: "markdown-report",
  analystMode: ANALYST_MODE_PRESET_CTI_ID,
  quietModeDefault: false,
};

/** Shipped SOC Triage portable profile (no API keys). */
export const BUILT_IN_THREAT_PROFILE_SOC_TRIAGE: ThreatProfile = {
  threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
  id: BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE,
  name: "SOC Triage",
  description:
    "SOC analyst mode with Splunk-oriented CSV export, abuse-first pivots, and conservative auto-scan defaults (manual enrich, auto-scan off). Does not include API keys.",
  enabledConnectors: [
    ENRICHMENT_SOURCE.ABUSEIPDB,
    ENRICHMENT_SOURCE.OTX,
  ],
  pivotRecipeSetId: BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE,
  defaultExportTemplateId: "csv-row",
  analystMode: ANALYST_MODE_PRESET_SOC_ID,
  quietModeDefault: false,
};

/**
 * Pivot emphasis for CTI Hunting — same ordering as the CTI platform
 * page-context layout profile (tray/hover pivot recipe hints).
 */
export const BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS: readonly PivotProvider[] =
  getPageContextPivotRecipeOrder(PAGE_CONTEXT_TYPE.CTI_PLATFORM);

/** Shipped CTI Hunting portable profile (no API keys). */
export const BUILT_IN_THREAT_PROFILE_CTI_HUNTING: ThreatProfile = {
  threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
  id: BUILT_IN_THREAT_PROFILE_ID_CTI,
  name: "CTI Hunting",
  description:
    "CTI hunting with community-intel pivot emphasis aligned to CTI platform page-context layout, markdown export, and tray-first workspace layout (show disabled sources in the tray). Does not include API keys.",
  enabledConnectors: [
    ENRICHMENT_SOURCE.OTX,
    ENRICHMENT_SOURCE.VIRUSTOTAL,
    ENRICHMENT_SOURCE.PULSEDIVE,
    ENRICHMENT_SOURCE.THREATFOX,
    ENRICHMENT_SOURCE.URLSCAN,
    ENRICHMENT_SOURCE.MALWAREBAZAAR,
    ENRICHMENT_SOURCE.ABUSEIPDB,
    ENRICHMENT_SOURCE.URLHAUS,
  ],
  pivotRecipeSetId: BUILT_IN_THREAT_PROFILE_ID_CTI,
  defaultExportTemplateId: "markdown-report",
  analystMode: ANALYST_MODE_PRESET_CTI_ID,
  quietModeDefault: false,
};

/** Built-in profiles that are fully defined and available to apply in Options. */
export function listShippedBuiltInThreatProfiles(): readonly ThreatProfile[] {
  return [
    BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH,
    BUILT_IN_THREAT_PROFILE_SOC_TRIAGE,
    BUILT_IN_THREAT_PROFILE_CTI_HUNTING,
  ];
}

export function getBuiltInThreatProfileById(
  id: string
): ThreatProfile | undefined {
  return listShippedBuiltInThreatProfiles().find((profile) => profile.id === id);
}

export function serializeBuiltInThreatProfile(
  profile: ThreatProfile,
  pretty = true
): string {
  return JSON.stringify(profile, null, pretty ? 2 : undefined);
}

/**
 * Versioned portable workflow profile (no API keys or vendor credentials).
 * Optional `noiseListRef` points at a local noise-rule list id or starter ref.
 * Parse/normalize rejects documents whose keys look like apiKey, tokens, or credentials.
 */
export type ThreatProfile = {
  threatProfileSchemaVersion: typeof THREAT_PROFILE_SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  enabledConnectors: readonly string[];
  pivotRecipeSetId: string;
  defaultExportTemplateId: ExportTemplateId;
  analystMode: string;
  quietModeDefault: boolean;
  noiseListRef?: string;
};

/**
 * Threat profile JSON accepted on import. Fields may be omitted for partial apply.
 * Legacy `label` is normalized into `name` when present.
 */
export type ThreatProfileDocument = {
  threatProfileSchemaVersion: typeof THREAT_PROFILE_SCHEMA_VERSION;
  id?: string;
  name?: string;
  description?: string;
  /** @deprecated Prefer `name`. Normalized into `name` on parse. */
  label?: string;
  quietModeDefault?: boolean;
  enabledConnectors?: readonly string[];
  pivotRecipeSetId?: string;
  defaultExportTemplateId?: ExportTemplateId;
  analystMode?: string;
  noiseListRef?: string;
  connectorConfidenceMetadataOverrides?: ConnectorConfidenceMetadataOverridesRecord;
};

export type ThreatProfileImportPreview = {
  profile: ThreatProfileDocument;
  changes: SettingsPackImportDiffEntry[];
  mergeMode: ThreatProfileImportMergeMode;
};

export const THREAT_PROFILE_IMPORT_MERGE_MODE = {
  MERGE_INTO_CURRENT: "merge-into-current",
  APPLY_AS_NEW_ACTIVE: "apply-as-new-active",
} as const;

export type ThreatProfileImportMergeMode =
  (typeof THREAT_PROFILE_IMPORT_MERGE_MODE)[keyof typeof THREAT_PROFILE_IMPORT_MERGE_MODE];

export const THREAT_PROFILE_IMPORT_MERGE_MODE_LABEL: Record<
  ThreatProfileImportMergeMode,
  string
> = {
  [THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT]:
    "Merge into current settings",
  [THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE]:
    "Apply as new active profile",
};

export function isThreatProfileImportMergeMode(
  value: unknown
): value is ThreatProfileImportMergeMode {
  return (
    value === THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT ||
    value === THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
  );
}

/** Local metadata for Options active-profile indicator (never includes API keys). */
export const STORAGE_KEY_ACTIVE_THREAT_PROFILE = "activeThreatProfile";

export type ActiveThreatProfileState = {
  id: string | null;
  name: string | null;
  lastImportedAt: string | null;
  lastImportMergeMode: ThreatProfileImportMergeMode | null;
};

export function createEmptyActiveThreatProfileState(): ActiveThreatProfileState {
  return {
    id: null,
    name: null,
    lastImportedAt: null,
    lastImportMergeMode: null,
  };
}

export function normalizeActiveThreatProfileState(
  value: unknown
): ActiveThreatProfileState {
  if (!isRecord(value)) {
    return createEmptyActiveThreatProfileState();
  }

  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim()
      : null;
  const name =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim()
      : null;
  const lastImportedAt =
    typeof value.lastImportedAt === "string" && value.lastImportedAt.trim().length > 0
      ? value.lastImportedAt.trim()
      : null;
  const lastImportMergeMode = isThreatProfileImportMergeMode(
    value.lastImportMergeMode
  )
    ? value.lastImportMergeMode
    : null;

  return {
    id,
    name,
    lastImportedAt,
    lastImportMergeMode,
  };
}

export async function getActiveThreatProfileState(): Promise<ActiveThreatProfileState> {
  const raw = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_THREAT_PROFILE);
  return normalizeActiveThreatProfileState(
    raw[STORAGE_KEY_ACTIVE_THREAT_PROFILE]
  );
}

export function buildActiveThreatProfileStateAfterImport(
  previous: ActiveThreatProfileState,
  profile: ThreatProfileDocument,
  mergeMode: ThreatProfileImportMergeMode,
  importedAt: string = new Date().toISOString()
): ActiveThreatProfileState {
  const profileId =
    typeof profile.id === "string" && profile.id.trim().length > 0
      ? profile.id.trim()
      : null;
  const profileName =
    typeof profile.name === "string" && profile.name.trim().length > 0
      ? profile.name.trim()
      : typeof profile.label === "string" && profile.label.trim().length > 0
        ? profile.label.trim()
        : null;

  if (mergeMode === THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE) {
    return {
      id: profileId ?? ACTIVE_THREAT_PROFILE_ID,
      name: profileName ?? ACTIVE_THREAT_PROFILE_NAME,
      lastImportedAt: importedAt,
      lastImportMergeMode: mergeMode,
    };
  }

  return {
    id: profileId ?? previous.id,
    name: profileName ?? previous.name ?? profileId ?? previous.id,
    lastImportedAt: importedAt,
    lastImportMergeMode: mergeMode,
  };
}

export async function recordThreatProfileImport(
  profile: ThreatProfileDocument,
  mergeMode: ThreatProfileImportMergeMode,
  importedAt: string = new Date().toISOString()
): Promise<ActiveThreatProfileState> {
  const previous = await getActiveThreatProfileState();
  const next = buildActiveThreatProfileStateAfterImport(
    previous,
    profile,
    mergeMode,
    importedAt
  );
  await chrome.storage.local.set({
    [STORAGE_KEY_ACTIVE_THREAT_PROFILE]: next,
  });
  return next;
}

export function formatActiveThreatProfileIndicator(
  state: ActiveThreatProfileState
): string {
  if (state.name && state.id && state.name !== state.id) {
    return `${state.name} (${state.id})`;
  }
  if (state.name) {
    return state.name;
  }
  if (state.id) {
    return state.id;
  }
  if (state.lastImportedAt) {
    return "Imported profile";
  }
  return "No imported profile";
}

export function formatThreatProfileLastImportedAt(
  state: ActiveThreatProfileState
): string {
  if (!state.lastImportedAt) {
    return "Never";
  }
  const parsed = Date.parse(state.lastImportedAt);
  if (!Number.isFinite(parsed)) {
    return state.lastImportedAt;
  }
  return new Date(parsed).toLocaleString();
}

export type SettingsPackDomainPolicy = {
  mode: DomainPolicyMode;
  allowlist: string[];
  denylist: string[];
  enrichGateEnabled: boolean;
};

export type SettingsPackAnalystMode = {
  presetId: string;
  defaultExportTemplateId: ExportTemplateId;
  pivotEmphasisProviders: PivotProvider[];
  manualOnlyMode: boolean;
  showPreQueryNotices: boolean;
  showDisabledSourcesInWorkspace: boolean;
  includePrivateIpv4: boolean;
};

export type SettingsPackDocument = {
  schemaVersion: typeof SETTINGS_PACK_SCHEMA_VERSION;
  exportedAt: string;
  enrichmentSourceEnabled: EnrichmentSourceEnabledRecord;
  enrichmentCacheTtlSeconds: number;
  enrichmentSourceCacheTtlSeconds: EnrichmentSourceCacheTtlRecord;
  domainPolicy: SettingsPackDomainPolicy;
  analystMode: SettingsPackAnalystMode;
  connectorConfidenceMetadataOverrides?: ConnectorConfidenceMetadataOverridesRecord;
};

export type SettingsPackImportDiffEntry = {
  field: string;
  label: string;
  currentValue: string;
  incomingValue: string;
};

export type SettingsPackImportPreview = {
  pack: SettingsPackDocument;
  changes: SettingsPackImportDiffEntry[];
};

export class SettingsPackImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsPackImportError";
  }
}

const FORBIDDEN_SETTINGS_PACK_KEY_FRAGMENTS = [
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "credential",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return Boolean(value);
}

function isForbiddenSettingsPackKey(key: string): boolean {
  if (key === STORAGE_KEY_API_KEYS || key === "apiKeys") {
    return true;
  }
  const normalized = key.trim().toLowerCase().replace(/[-_\s]/g, "");
  return FORBIDDEN_SETTINGS_PACK_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment.replace(/[-_\s]/g, ""))
  );
}

export function assertNoSecretsInSettingsPack(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenSettingsPackKey(key)) {
      throw new SettingsPackImportError(
        "Must not include API keys, tokens, raw credentials, or secrets."
      );
    }
    assertNoSecretsInSettingsPack(child);
  }
}

export function validateSettingsPackExport(
  document: SettingsPackDocument
): SettingsPackDocument {
  assertNoSecretsInSettingsPack(document);
  return document;
}

export function isThreatProfileDocument(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (isSettingsPackDocument(value)) {
    return false;
  }
  if (typeof value.threatProfileSchemaVersion === "number") {
    return true;
  }
  if (
    isRecord(value.connectorConfidenceMetadataOverrides) &&
    Object.keys(value.connectorConfidenceMetadataOverrides).length > 0
  ) {
    return true;
  }
  if (
    typeof value.name === "string" ||
    typeof value.description === "string" ||
    typeof value.defaultExportTemplateId === "string" ||
    typeof value.analystMode === "string"
  ) {
    return true;
  }
  if (!Array.isArray(value.enabledConnectors)) {
    return false;
  }
  return (
    typeof value.pivotRecipeSetId === "string" ||
    typeof value.quietModeDefault === "boolean" ||
    value.noiseListRef !== undefined
  );
}

export function assertSettingsPackNotThreatProfile(value: unknown): void {
  if (isThreatProfileDocument(value)) {
    throw new SettingsPackImportError(
      "This file is a threat profile, not a settings pack. Use threat profile import instead."
    );
  }
}

function normalizeThreatProfileEnabledConnectors(
  value: unknown
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const connectors: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed.length > 0) {
      connectors.push(trimmed);
    }
  }
  return connectors.length > 0 ? connectors : [];
}

export function normalizeThreatProfileDocument(value: unknown): ThreatProfileDocument {
  if (!isRecord(value)) {
    throw new SettingsPackImportError("Threat profile must be a JSON object.");
  }

  if (!isThreatProfileDocument(value)) {
    throw new SettingsPackImportError("Unsupported threat profile format.");
  }

  assertNoSecretsInSettingsPack(value);

  if (
    value.threatProfileSchemaVersion !== undefined &&
    value.threatProfileSchemaVersion !== THREAT_PROFILE_SCHEMA_VERSION
  ) {
    throw new SettingsPackImportError("Unsupported threat profile format.");
  }

  const profile: ThreatProfileDocument = {
    threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
  };

  if (typeof value.id === "string" && value.id.trim().length > 0) {
    profile.id = value.id.trim();
  }

  const nameFromName =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim()
      : null;
  const nameFromLabel =
    typeof value.label === "string" && value.label.trim().length > 0
      ? value.label.trim()
      : null;
  if (nameFromName) {
    profile.name = nameFromName;
  } else if (nameFromLabel) {
    profile.name = nameFromLabel;
  }

  if (typeof value.description === "string" && value.description.trim().length > 0) {
    profile.description = value.description.trim();
  }

  if (typeof value.pivotRecipeSetId === "string" && value.pivotRecipeSetId.trim()) {
    profile.pivotRecipeSetId = value.pivotRecipeSetId.trim();
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "defaultExportTemplateId") &&
    value.defaultExportTemplateId !== undefined &&
    value.defaultExportTemplateId !== null &&
    value.defaultExportTemplateId !== ""
  ) {
    profile.defaultExportTemplateId = normalizeDefaultExportTemplateId(
      value.defaultExportTemplateId
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "analystMode") &&
    value.analystMode !== undefined &&
    value.analystMode !== null &&
    value.analystMode !== ""
  ) {
    const analystMode = normalizeAnalystModePresetId(value.analystMode);
    if (analystMode) {
      profile.analystMode = analystMode;
    }
  }

  if (typeof value.noiseListRef === "string" && value.noiseListRef.trim()) {
    profile.noiseListRef = value.noiseListRef.trim();
  }

  const enabledConnectors = normalizeThreatProfileEnabledConnectors(
    value.enabledConnectors
  );
  if (enabledConnectors !== undefined) {
    profile.enabledConnectors = enabledConnectors;
  }

  if (typeof value.quietModeDefault === "boolean") {
    profile.quietModeDefault = value.quietModeDefault;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      value,
      "connectorConfidenceMetadataOverrides"
    )
  ) {
    profile.connectorConfidenceMetadataOverrides =
      normalizeImportedConfidenceMetadataOverrides(
        value.connectorConfidenceMetadataOverrides
      );
  }

  return profile;
}

/** True when every required ThreatProfile field is present (noiseListRef remains optional). */
export function isCompleteThreatProfile(
  value: ThreatProfileDocument
): value is ThreatProfile {
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.description === "string" &&
    value.description.length > 0 &&
    Array.isArray(value.enabledConnectors) &&
    typeof value.pivotRecipeSetId === "string" &&
    value.pivotRecipeSetId.length > 0 &&
    typeof value.defaultExportTemplateId === "string" &&
    value.defaultExportTemplateId.length > 0 &&
    typeof value.analystMode === "string" &&
    value.analystMode.length > 0 &&
    typeof value.quietModeDefault === "boolean"
  );
}

export function parseThreatProfileDocument(rawJson: string): ThreatProfileDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new SettingsPackImportError("Invalid JSON.");
  }
  return normalizeThreatProfileDocument(parsed);
}

/**
 * Maps `pivotRecipeSetId` to an analyst preset whose `pivotEmphasis` fills
 * `pivotEmphasisProviders` storage (connector-adjacent pivot ordering).
 */
const THREAT_PROFILE_PIVOT_RECIPE_SET_TO_PRESET: Readonly<
  Record<string, AnalystModePresetId>
> = {
  soc: "soc",
  [BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE]: "soc",
  cti: "cti",
  "cti-hunt": "cti",
  [BUILT_IN_THREAT_PROFILE_ID_CTI]: "cti",
  [BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH]: "cti",
  dfir: "dfir",
  "dfir-investigation": "dfir",
};

export function resolvePivotRecipeSetPresetId(
  pivotRecipeSetId: string | undefined
): AnalystModePresetId | null {
  if (!pivotRecipeSetId) {
    return null;
  }
  const trimmed = pivotRecipeSetId.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  return THREAT_PROFILE_PIVOT_RECIPE_SET_TO_PRESET[trimmed] ?? null;
}

/** Maps profile `enabledConnectors` to connector-profile `enrichmentSourceEnabled`. */
export function mapThreatProfileEnabledConnectorsToEnrichmentSourceEnabled(
  enabledConnectors: readonly string[],
  current: EnrichmentSourceEnabledRecord
): EnrichmentSourceEnabledRecord {
  const next: EnrichmentSourceEnabledRecord = { ...current };
  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    next[sourceId] = false;
  }
  for (const entry of enabledConnectors) {
    if (isEnrichmentSourceId(entry)) {
      next[entry] = true;
    }
  }
  return next;
}

/**
 * Connector-profile preference slice derived from a threat profile
 * (`preferences.enrichmentSourceEnabled` + optional confidence overrides).
 */
export function mapThreatProfileToConnectorProfilePreferences(
  profile: ThreatProfileDocument,
  current: Vera5Settings
): Partial<
  Pick<
    ConnectorProfilePreferences,
    "enrichmentSourceEnabled" | "connectorConfidenceMetadataOverrides"
  >
> {
  const partial: Partial<
    Pick<
      ConnectorProfilePreferences,
      "enrichmentSourceEnabled" | "connectorConfidenceMetadataOverrides"
    >
  > = {};

  if (profile.enabledConnectors !== undefined) {
    partial.enrichmentSourceEnabled =
      mapThreatProfileEnabledConnectorsToEnrichmentSourceEnabled(
        profile.enabledConnectors,
        current.enrichmentSourceEnabled
      );
  }

  if (profile.connectorConfidenceMetadataOverrides !== undefined) {
    partial.connectorConfidenceMetadataOverrides = {
      ...profile.connectorConfidenceMetadataOverrides,
    };
  }

  return partial;
}

/**
 * Analyst-preset storage fields derived from a threat profile
 * (`analystModePresetId`, `defaultExportTemplateId`, `pivotEmphasisProviders`, `quietMode`).
 */
export function mapThreatProfileToAnalystModeStorage(
  profile: ThreatProfileDocument
): Partial<
  Pick<
    Vera5Settings,
    | "analystModePresetId"
    | "defaultExportTemplateId"
    | "pivotEmphasisProviders"
    | "quietMode"
  >
> {
  const partial: Partial<
    Pick<
      Vera5Settings,
      | "analystModePresetId"
      | "defaultExportTemplateId"
      | "pivotEmphasisProviders"
      | "quietMode"
    >
  > = {};

  const analystMode = normalizeAnalystModePresetId(profile.analystMode);
  if (analystMode) {
    partial.analystModePresetId = analystMode;
    const preset = getAnalystModePresetById(analystMode);
    if (preset) {
      partial.defaultExportTemplateId = preset.defaultExportTemplateId;
      partial.pivotEmphasisProviders = [...preset.pivotEmphasis];
      partial.quietMode = preset.settings.quietMode;
    }
  }

  if (profile.defaultExportTemplateId) {
    partial.defaultExportTemplateId = profile.defaultExportTemplateId;
  }

  const recipePresetId = resolvePivotRecipeSetPresetId(profile.pivotRecipeSetId);
  if (recipePresetId) {
    const recipePreset = getAnalystModePresetById(recipePresetId);
    if (recipePreset) {
      partial.pivotEmphasisProviders = [...recipePreset.pivotEmphasis];
    }
  }

  const usesMalwareResearchDomainForward =
    profile.pivotRecipeSetId === BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH ||
    profile.id === BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH;
  if (usesMalwareResearchDomainForward) {
    partial.pivotEmphasisProviders = [
      ...BUILT_IN_MALWARE_RESEARCH_DOMAIN_FORWARD_PIVOTS,
    ];
  }

  const usesCtiHuntingPivotEmphasis =
    profile.pivotRecipeSetId === BUILT_IN_THREAT_PROFILE_ID_CTI ||
    profile.id === BUILT_IN_THREAT_PROFILE_ID_CTI;
  if (usesCtiHuntingPivotEmphasis) {
    partial.pivotEmphasisProviders = [...BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS];
  }

  if (typeof profile.quietModeDefault === "boolean") {
    partial.quietMode = profile.quietModeDefault;
  }

  return partial;
}

export function mergeImportedThreatProfile(
  current: Vera5Settings,
  profile: ThreatProfileDocument
): Vera5Settings {
  let next: Vera5Settings = {
    ...current,
    apiKeys: { ...current.apiKeys },
  };

  const analystMode = normalizeAnalystModePresetId(profile.analystMode);
  if (analystMode) {
    const preset = getAnalystModePresetById(analystMode);
    if (preset) {
      next = applyAnalystModePresetToSettings(next, preset);
    } else {
      next = { ...next, analystModePresetId: analystMode };
    }
  }

  const connectorPartial = mapThreatProfileToConnectorProfilePreferences(
    profile,
    next
  );
  if (connectorPartial.enrichmentSourceEnabled) {
    next = {
      ...next,
      enrichmentSourceEnabled: connectorPartial.enrichmentSourceEnabled,
    };
  }
  if (connectorPartial.connectorConfidenceMetadataOverrides !== undefined) {
    next = {
      ...next,
      connectorConfidenceMetadataOverrides: {
        ...connectorPartial.connectorConfidenceMetadataOverrides,
      },
    };
  }

  const analystPartial = mapThreatProfileToAnalystModeStorage(profile);
  if (analystPartial.analystModePresetId !== undefined) {
    next = { ...next, analystModePresetId: analystPartial.analystModePresetId };
  }
  if (analystPartial.defaultExportTemplateId !== undefined) {
    next = {
      ...next,
      defaultExportTemplateId: analystPartial.defaultExportTemplateId,
    };
  }
  if (analystPartial.pivotEmphasisProviders !== undefined) {
    next = {
      ...next,
      pivotEmphasisProviders: [...analystPartial.pivotEmphasisProviders],
    };
  }
  if (typeof analystPartial.quietMode === "boolean") {
    next = { ...next, quietMode: analystPartial.quietMode };
  }

  // noiseListRef is an optional import slot only — not a Vera5Settings field.
  return next;
}

/**
 * Baseline for apply-as-new-active: reset profile-overlapping workflow fields to
 * defaults while preserving API keys and pack-only settings (cache TTL, domain policy).
 */
export function buildThreatProfileApplyAsNewActiveBase(
  current: Vera5Settings
): Vera5Settings {
  const defaults = createDefaultVera5Settings();
  return {
    ...current,
    apiKeys: { ...current.apiKeys },
    enrichmentSourceEnabled: { ...defaults.enrichmentSourceEnabled },
    connectorConfidenceMetadataOverrides: {},
    analystModePresetId: defaults.analystModePresetId,
    defaultExportTemplateId: defaults.defaultExportTemplateId,
    pivotEmphasisProviders: [...defaults.pivotEmphasisProviders],
    quietMode: defaults.quietMode,
    manualOnlyMode: defaults.manualOnlyMode,
    showPreQueryNotices: defaults.showPreQueryNotices,
    showDisabledSourcesInWorkspace: defaults.showDisabledSourcesInWorkspace,
    includePrivateIpv4: defaults.includePrivateIpv4,
  };
}

export function resolveThreatProfileImportBase(
  current: Vera5Settings,
  mergeMode: ThreatProfileImportMergeMode
): Vera5Settings {
  if (mergeMode === THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE) {
    return buildThreatProfileApplyAsNewActiveBase(current);
  }
  return current;
}

export function applyImportedThreatProfile(
  current: Vera5Settings,
  profile: ThreatProfileDocument,
  mergeMode: ThreatProfileImportMergeMode = THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
): Vera5Settings {
  if (!isThreatProfileImportMergeMode(mergeMode)) {
    throw new SettingsPackImportError("Unsupported threat profile import merge mode.");
  }
  const base = resolveThreatProfileImportBase(current, mergeMode);
  return mergeImportedThreatProfile(base, profile);
}

function pushThreatProfileSettingsDiff(
  changes: SettingsPackImportDiffEntry[],
  current: Vera5Settings,
  merged: Vera5Settings
): void {
  if (current.quietMode !== merged.quietMode) {
    changes.push({
      field: "quietMode",
      label: "Quiet mode",
      currentValue: formatSettingsPackBoolean(current.quietMode),
      incomingValue: formatSettingsPackBoolean(merged.quietMode),
    });
  }

  if (current.analystModePresetId !== merged.analystModePresetId) {
    changes.push({
      field: "analystModePresetId",
      label: "Analyst mode preset",
      currentValue: current.analystModePresetId || "(none)",
      incomingValue: merged.analystModePresetId || "(none)",
    });
  }

  if (current.defaultExportTemplateId !== merged.defaultExportTemplateId) {
    changes.push({
      field: "defaultExportTemplateId",
      label: "Default export template",
      currentValue: current.defaultExportTemplateId,
      incomingValue: merged.defaultExportTemplateId,
    });
  }

  if (
    current.pivotEmphasisProviders.join(",") !==
    merged.pivotEmphasisProviders.join(",")
  ) {
    changes.push({
      field: "pivotEmphasisProviders",
      label: "Pivot emphasis",
      currentValue: formatSettingsPackStringList(current.pivotEmphasisProviders),
      incomingValue: formatSettingsPackStringList(merged.pivotEmphasisProviders),
    });
  }

  if (current.manualOnlyMode !== merged.manualOnlyMode) {
    changes.push({
      field: "manualOnlyMode",
      label: "Manual-only enrichment",
      currentValue: formatSettingsPackBoolean(current.manualOnlyMode),
      incomingValue: formatSettingsPackBoolean(merged.manualOnlyMode),
    });
  }

  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    const before = Boolean(current.enrichmentSourceEnabled[sourceId]);
    const after = Boolean(merged.enrichmentSourceEnabled[sourceId]);
    if (before === after) {
      continue;
    }
    changes.push({
      field: `enrichmentSourceEnabled.${sourceId}`,
      label: `${ENRICHMENT_SOURCE_LABELS[sourceId]} enabled`,
      currentValue: formatSettingsPackBoolean(before),
      incomingValue: formatSettingsPackBoolean(after),
    });
  }

  if (
    !confidenceMetadataOverridesEqual(
      current.connectorConfidenceMetadataOverrides,
      merged.connectorConfidenceMetadataOverrides
    )
  ) {
    changes.push({
      field: "connectorConfidenceMetadataOverrides",
      label: "Connector confidence metadata",
      currentValue: formatSettingsPackConfidenceMetadataOverrides(
        current.connectorConfidenceMetadataOverrides
      ),
      incomingValue: formatSettingsPackConfidenceMetadataOverrides(
        merged.connectorConfidenceMetadataOverrides
      ),
    });
  }
}

export function buildThreatProfileImportDiff(
  current: Vera5Settings,
  profile: ThreatProfileDocument,
  mergeMode: ThreatProfileImportMergeMode = THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
): SettingsPackImportDiffEntry[] {
  const merged = applyImportedThreatProfile(current, profile, mergeMode);
  const changes: SettingsPackImportDiffEntry[] = [];

  if (mergeMode === THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE) {
    pushThreatProfileSettingsDiff(changes, current, merged);
    return changes;
  }

  if (
    typeof profile.quietModeDefault === "boolean" &&
    current.quietMode !== merged.quietMode
  ) {
    changes.push({
      field: "quietMode",
      label: "Quiet mode",
      currentValue: formatSettingsPackBoolean(current.quietMode),
      incomingValue: formatSettingsPackBoolean(merged.quietMode),
    });
  }

  if (
    profile.analystMode !== undefined &&
    current.analystModePresetId !== merged.analystModePresetId
  ) {
    changes.push({
      field: "analystModePresetId",
      label: "Analyst mode preset",
      currentValue: current.analystModePresetId || "(none)",
      incomingValue: merged.analystModePresetId || "(none)",
    });
  }

  if (
    (profile.defaultExportTemplateId !== undefined ||
      profile.analystMode !== undefined) &&
    current.defaultExportTemplateId !== merged.defaultExportTemplateId
  ) {
    changes.push({
      field: "defaultExportTemplateId",
      label: "Default export template",
      currentValue: current.defaultExportTemplateId,
      incomingValue: merged.defaultExportTemplateId,
    });
  }

  if (
    (profile.pivotRecipeSetId !== undefined || profile.analystMode !== undefined) &&
    current.pivotEmphasisProviders.join(",") !==
      merged.pivotEmphasisProviders.join(",")
  ) {
    changes.push({
      field: "pivotEmphasisProviders",
      label: "Pivot emphasis",
      currentValue: formatSettingsPackStringList(current.pivotEmphasisProviders),
      incomingValue: formatSettingsPackStringList(merged.pivotEmphasisProviders),
    });
  }

  if (profile.enabledConnectors !== undefined) {
    for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
      const before = Boolean(current.enrichmentSourceEnabled[sourceId]);
      const after = Boolean(merged.enrichmentSourceEnabled[sourceId]);
      if (before === after) {
        continue;
      }
      changes.push({
        field: `enrichmentSourceEnabled.${sourceId}`,
        label: `${ENRICHMENT_SOURCE_LABELS[sourceId]} enabled`,
        currentValue: formatSettingsPackBoolean(before),
        incomingValue: formatSettingsPackBoolean(after),
      });
    }
  }

  if (
    profile.connectorConfidenceMetadataOverrides !== undefined &&
    !confidenceMetadataOverridesEqual(
      current.connectorConfidenceMetadataOverrides,
      merged.connectorConfidenceMetadataOverrides
    )
  ) {
    changes.push({
      field: "connectorConfidenceMetadataOverrides",
      label: "Connector confidence metadata",
      currentValue: formatSettingsPackConfidenceMetadataOverrides(
        current.connectorConfidenceMetadataOverrides
      ),
      incomingValue: formatSettingsPackConfidenceMetadataOverrides(
        merged.connectorConfidenceMetadataOverrides
      ),
    });
  }

  return changes;
}

export function buildThreatProfileImportPreview(
  current: Vera5Settings,
  rawJson: string,
  mergeMode: ThreatProfileImportMergeMode = THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
): ThreatProfileImportPreview {
  if (!isThreatProfileImportMergeMode(mergeMode)) {
    throw new SettingsPackImportError("Unsupported threat profile import merge mode.");
  }
  const profile = parseThreatProfileDocument(rawJson);
  return {
    profile,
    mergeMode,
    changes: buildThreatProfileImportDiff(current, profile, mergeMode),
  };
}

export async function importThreatProfileJson(
  rawJson: string,
  mergeMode: ThreatProfileImportMergeMode = THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
): Promise<void> {
  const current = await getVera5Settings();
  const profile = parseThreatProfileDocument(rawJson);
  const merged = applyImportedThreatProfile(current, profile, mergeMode);
  await chrome.storage.local.set(vera5SettingsToStoragePayload(merged));
  await recordThreatProfileImport(profile, mergeMode);
}

export function validateThreatProfileExport(
  document: ThreatProfileDocument
): ThreatProfile {
  assertNoSecretsInSettingsPack(document);
  if (document.threatProfileSchemaVersion !== THREAT_PROFILE_SCHEMA_VERSION) {
    throw new SettingsPackImportError("Unsupported threat profile format.");
  }
  if (!isCompleteThreatProfile(document)) {
    throw new SettingsPackImportError("Threat profile export is incomplete.");
  }
  return document;
}

/**
 * Builds a portable threat profile from current settings (no API keys).
 * Uses id `active` for the live settings snapshot.
 */
export function buildThreatProfileDocumentFromSettings(
  settings: Vera5Settings
): ThreatProfile {
  const analystMode =
    normalizeAnalystModePresetId(settings.analystModePresetId) ||
    ACTIVE_THREAT_PROFILE_CUSTOM_MODE_ID;

  const enabledConnectors = ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
    Boolean(settings.enrichmentSourceEnabled[sourceId])
  );

  const profile: ThreatProfileDocument = {
    threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
    id: ACTIVE_THREAT_PROFILE_ID,
    name: ACTIVE_THREAT_PROFILE_NAME,
    description: ACTIVE_THREAT_PROFILE_DESCRIPTION,
    enabledConnectors,
    pivotRecipeSetId: analystMode,
    defaultExportTemplateId: settings.defaultExportTemplateId,
    analystMode,
    quietModeDefault: Boolean(settings.quietMode),
  };

  if (Object.keys(settings.connectorConfidenceMetadataOverrides).length > 0) {
    profile.connectorConfidenceMetadataOverrides = {
      ...settings.connectorConfidenceMetadataOverrides,
    };
  }

  return validateThreatProfileExport(profile);
}

export function serializeThreatProfile(
  settings: Vera5Settings,
  pretty = true
): string {
  return JSON.stringify(
    buildThreatProfileDocumentFromSettings(settings),
    null,
    pretty ? 2 : undefined
  );
}

export async function exportThreatProfileJson(): Promise<string> {
  const settings = await getVera5Settings();
  return serializeThreatProfile(settings);
}

export function downloadThreatProfileExport(
  json: string,
  filename = THREAT_PROFILE_EXPORT_FILENAME
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeSettingsPackDomainPolicy(value: unknown): SettingsPackDomainPolicy {
  if (!isRecord(value)) {
    throw new SettingsPackImportError("Settings pack is missing domain policy.");
  }
  return {
    mode: normalizeDomainPolicyMode(value.mode),
    allowlist: normalizeDomainPolicyList(value.allowlist),
    denylist: normalizeDomainPolicyList(value.denylist),
    enrichGateEnabled: readStoredBoolean(value.enrichGateEnabled, true),
  };
}

function normalizeSettingsPackAnalystMode(value: unknown): SettingsPackAnalystMode {
  if (!isRecord(value)) {
    throw new SettingsPackImportError("Settings pack is missing analyst mode.");
  }
  return {
    presetId: normalizeAnalystModePresetId(value.presetId),
    defaultExportTemplateId: normalizeDefaultExportTemplateId(
      value.defaultExportTemplateId
    ),
    pivotEmphasisProviders: normalizePivotEmphasisProviders(
      value.pivotEmphasisProviders
    ),
    manualOnlyMode: readStoredBoolean(value.manualOnlyMode, true),
    showPreQueryNotices: readStoredBoolean(value.showPreQueryNotices, true),
    showDisabledSourcesInWorkspace: readStoredBoolean(
      value.showDisabledSourcesInWorkspace,
      false
    ),
    includePrivateIpv4: readStoredBoolean(value.includePrivateIpv4, false),
  };
}

export function extractSettingsPackFromSettings(
  settings: Vera5Settings
): Omit<SettingsPackDocument, "schemaVersion" | "exportedAt"> {
  return {
    enrichmentSourceEnabled: { ...settings.enrichmentSourceEnabled },
    enrichmentCacheTtlSeconds: settings.enrichmentCacheTtlSeconds,
    enrichmentSourceCacheTtlSeconds: {
      ...settings.enrichmentSourceCacheTtlSeconds,
    },
    domainPolicy: {
      mode: settings.domainPolicyMode,
      allowlist: [...settings.domainAllowlist],
      denylist: [...settings.domainDenylist],
      enrichGateEnabled: settings.domainPolicyEnrichGateEnabled,
    },
    analystMode: {
      presetId: settings.analystModePresetId,
      defaultExportTemplateId: settings.defaultExportTemplateId,
      pivotEmphasisProviders: [...settings.pivotEmphasisProviders],
      manualOnlyMode: settings.manualOnlyMode,
      showPreQueryNotices: settings.showPreQueryNotices,
      showDisabledSourcesInWorkspace: settings.showDisabledSourcesInWorkspace,
      includePrivateIpv4: settings.includePrivateIpv4,
    },
    connectorConfidenceMetadataOverrides: {
      ...settings.connectorConfidenceMetadataOverrides,
    },
  };
}

export function buildSettingsPackDocument(
  settings: Vera5Settings,
  exportedAt: string = new Date().toISOString()
): SettingsPackDocument {
  return validateSettingsPackExport({
    schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
    exportedAt,
    ...extractSettingsPackFromSettings(settings),
  });
}

export function serializeSettingsPack(
  settings: Vera5Settings,
  pretty = true
): string {
  return JSON.stringify(
    buildSettingsPackDocument(settings),
    null,
    pretty ? 2 : undefined
  );
}

export function isSettingsPackDocument(
  value: unknown
): value is SettingsPackDocument {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schemaVersion !== SETTINGS_PACK_SCHEMA_VERSION) {
    return false;
  }
  if (typeof value.exportedAt !== "string" || value.exportedAt.trim() === "") {
    return false;
  }
  if (!isRecord(value.domainPolicy) || !isRecord(value.analystMode)) {
    return false;
  }
  return (
    value.enrichmentSourceEnabled !== undefined &&
    typeof value.enrichmentCacheTtlSeconds === "number" &&
    Number.isFinite(value.enrichmentCacheTtlSeconds) &&
    value.enrichmentSourceCacheTtlSeconds !== undefined
  );
}

export function normalizeSettingsPackDocument(value: unknown): SettingsPackDocument {
  if (!isRecord(value)) {
    throw new SettingsPackImportError("Settings pack must be a JSON object.");
  }

  assertSettingsPackNotThreatProfile(value);
  assertNoSecretsInSettingsPack(value);

  if (value.schemaVersion !== SETTINGS_PACK_SCHEMA_VERSION) {
    throw new SettingsPackImportError("Unsupported settings pack format.");
  }

  if (typeof value.exportedAt !== "string" || value.exportedAt.trim() === "") {
    throw new SettingsPackImportError(
      "Settings pack is missing export metadata."
    );
  }

  return {
    schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
    exportedAt: value.exportedAt.trim(),
    enrichmentSourceEnabled: normalizeEnrichmentSourceEnabledRecord(
      value.enrichmentSourceEnabled
    ),
    enrichmentCacheTtlSeconds: readStoredCacheTtlSeconds(
      value.enrichmentCacheTtlSeconds,
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS
    ),
    enrichmentSourceCacheTtlSeconds: normalizeEnrichmentSourceCacheTtlRecord(
      value.enrichmentSourceCacheTtlSeconds
    ),
    domainPolicy: normalizeSettingsPackDomainPolicy(value.domainPolicy),
    analystMode: normalizeSettingsPackAnalystMode(value.analystMode),
    ...(Object.prototype.hasOwnProperty.call(
      value,
      "connectorConfidenceMetadataOverrides"
    )
      ? {
          connectorConfidenceMetadataOverrides:
            normalizeImportedConfidenceMetadataOverrides(
              value.connectorConfidenceMetadataOverrides
            ),
        }
      : {}),
  };
}

function normalizeImportedConfidenceMetadataOverrides(
  value: unknown
): ConnectorConfidenceMetadataOverridesRecord {
  try {
    return validateImportedConnectorConfidenceMetadataOverridesRecord(value);
  } catch (error) {
    throw new SettingsPackImportError(
      error instanceof Error
        ? error.message
        : "Invalid connector confidence metadata overrides."
    );
  }
}

function normalizeSettingsPackConfidenceMetadataOverrides(
  value: unknown
): ConnectorConfidenceMetadataOverridesRecord {
  return normalizeImportedConfidenceMetadataOverrides(value);
}

export function parseSettingsPackDocument(rawJson: string): SettingsPackDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new SettingsPackImportError("Invalid JSON.");
  }
  return normalizeSettingsPackDocument(parsed);
}

export function mergeImportedSettingsPack(
  current: Vera5Settings,
  pack: SettingsPackDocument
): Vera5Settings {
  return {
    ...current,
    enrichmentSourceEnabled: { ...pack.enrichmentSourceEnabled },
    enrichmentCacheTtlSeconds: pack.enrichmentCacheTtlSeconds,
    enrichmentSourceCacheTtlSeconds: {
      ...pack.enrichmentSourceCacheTtlSeconds,
    },
    domainPolicyMode: pack.domainPolicy.mode,
    domainAllowlist: [...pack.domainPolicy.allowlist],
    domainDenylist: [...pack.domainPolicy.denylist],
    domainPolicyEnrichGateEnabled: pack.domainPolicy.enrichGateEnabled,
    analystModePresetId: pack.analystMode.presetId,
    defaultExportTemplateId: pack.analystMode.defaultExportTemplateId,
    pivotEmphasisProviders: [...pack.analystMode.pivotEmphasisProviders],
    manualOnlyMode: pack.analystMode.manualOnlyMode,
    showPreQueryNotices: pack.analystMode.showPreQueryNotices,
    showDisabledSourcesInWorkspace: pack.analystMode.showDisabledSourcesInWorkspace,
    includePrivateIpv4: pack.analystMode.includePrivateIpv4,
    apiKeys: { ...current.apiKeys },
    connectorConfidenceMetadataOverrides:
      pack.connectorConfidenceMetadataOverrides !== undefined
        ? { ...pack.connectorConfidenceMetadataOverrides }
        : { ...current.connectorConfidenceMetadataOverrides },
  };
}

function formatSettingsPackBoolean(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

function formatSettingsPackDomainPolicyMode(mode: DomainPolicyMode): string {
  return mode === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT
    ? "Deny by default"
    : "Allow by default";
}

function formatSettingsPackStringList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "(empty)";
}

function formatSettingsPackSeconds(value: number): string {
  return `${value} seconds`;
}

function formatSettingsPackAnalystModePresetId(presetId: string): string {
  const preset = getAnalystModePresetById(presetId);
  if (preset) {
    return preset.label;
  }
  return presetId.trim() === "" ? "Custom" : presetId;
}

function formatSettingsPackExportTemplateId(id: ExportTemplateId): string {
  return id.replace(/-/g, " ");
}

function formatSettingsPackPivotProviders(
  providers: readonly PivotProvider[]
): string {
  return providers.length > 0 ? providers.join(", ") : "(none)";
}

function formatSettingsPackSourceCacheTtl(
  value: number | undefined
): string {
  return value === undefined ? "(default)" : formatSettingsPackSeconds(value);
}

function stringListsEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

function formatSettingsPackConfidenceMetadataOverrides(
  overrides: ConnectorConfidenceMetadataOverridesRecord
): string {
  const entries = ENRICHMENT_SOURCE_ORDER.flatMap((sourceId) => {
    const override = overrides[sourceId];
    if (!override) {
      return [];
    }
    const parts: string[] = [];
    if (override.reliabilityTier !== undefined) {
      parts.push(`tier=${override.reliabilityTier ?? "none"}`);
    }
    if (override.freshnessPolicy !== undefined) {
      parts.push(`freshness=${override.freshnessPolicy ?? "none"}`);
    }
    if (override.sourceClass !== undefined) {
      parts.push(`class=${override.sourceClass ?? "none"}`);
    }
    return parts.length > 0
      ? [`${ENRICHMENT_SOURCE_LABELS[sourceId]}: ${parts.join(", ")}`]
      : [];
  });
  return entries.length > 0 ? entries.join("; ") : "(none)";
}

function confidenceMetadataOverridesEqual(
  left: ConnectorConfidenceMetadataOverridesRecord,
  right: ConnectorConfidenceMetadataOverridesRecord
): boolean {
  return (
    JSON.stringify(left) === JSON.stringify(right)
  );
}

export function buildSettingsPackImportDiff(
  current: Vera5Settings,
  pack: SettingsPackDocument
): SettingsPackImportDiffEntry[] {
  const merged = mergeImportedSettingsPack(current, pack);
  const changes: SettingsPackImportDiffEntry[] = [];

  const pushChange = (
    field: string,
    label: string,
    currentValue: string,
    incomingValue: string
  ) => {
    if (currentValue !== incomingValue) {
      changes.push({ field, label, currentValue, incomingValue });
    }
  };

  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    pushChange(
      `enrichmentSourceEnabled.${sourceId}`,
      `${ENRICHMENT_SOURCE_LABELS[sourceId]} enrichment`,
      formatSettingsPackBoolean(Boolean(current.enrichmentSourceEnabled[sourceId])),
      formatSettingsPackBoolean(Boolean(merged.enrichmentSourceEnabled[sourceId]))
    );
  }

  pushChange(
    "enrichmentCacheTtlSeconds",
    "Global enrichment cache TTL",
    formatSettingsPackSeconds(current.enrichmentCacheTtlSeconds),
    formatSettingsPackSeconds(merged.enrichmentCacheTtlSeconds)
  );

  for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
    const currentTtl = current.enrichmentSourceCacheTtlSeconds[sourceId];
    const incomingTtl = merged.enrichmentSourceCacheTtlSeconds[sourceId];
    if (currentTtl !== incomingTtl) {
      pushChange(
        `enrichmentSourceCacheTtlSeconds.${sourceId}`,
        `${ENRICHMENT_SOURCE_LABELS[sourceId]} cache TTL`,
        formatSettingsPackSourceCacheTtl(currentTtl),
        formatSettingsPackSourceCacheTtl(incomingTtl)
      );
    }
  }

  pushChange(
    "domainPolicyMode",
    "Domain policy mode",
    formatSettingsPackDomainPolicyMode(current.domainPolicyMode),
    formatSettingsPackDomainPolicyMode(merged.domainPolicyMode)
  );

  if (!stringListsEqual(current.domainAllowlist, merged.domainAllowlist)) {
    pushChange(
      "domainAllowlist",
      "Domain allowlist",
      formatSettingsPackStringList(current.domainAllowlist),
      formatSettingsPackStringList(merged.domainAllowlist)
    );
  }

  if (!stringListsEqual(current.domainDenylist, merged.domainDenylist)) {
    pushChange(
      "domainDenylist",
      "Domain denylist",
      formatSettingsPackStringList(current.domainDenylist),
      formatSettingsPackStringList(merged.domainDenylist)
    );
  }

  pushChange(
    "domainPolicyEnrichGateEnabled",
    "Domain policy enrichment gate",
    formatSettingsPackBoolean(current.domainPolicyEnrichGateEnabled),
    formatSettingsPackBoolean(merged.domainPolicyEnrichGateEnabled)
  );

  pushChange(
    "analystModePresetId",
    "Analyst workflow preset",
    formatSettingsPackAnalystModePresetId(current.analystModePresetId),
    formatSettingsPackAnalystModePresetId(merged.analystModePresetId)
  );

  pushChange(
    "defaultExportTemplateId",
    "Default export template",
    formatSettingsPackExportTemplateId(current.defaultExportTemplateId),
    formatSettingsPackExportTemplateId(merged.defaultExportTemplateId)
  );

  if (
    !stringListsEqual(
      current.pivotEmphasisProviders,
      merged.pivotEmphasisProviders
    )
  ) {
    pushChange(
      "pivotEmphasisProviders",
      "Pivot emphasis providers",
      formatSettingsPackPivotProviders(current.pivotEmphasisProviders),
      formatSettingsPackPivotProviders(merged.pivotEmphasisProviders)
    );
  }

  pushChange(
    "manualOnlyMode",
    "Manual-only enrichment",
    formatSettingsPackBoolean(current.manualOnlyMode),
    formatSettingsPackBoolean(merged.manualOnlyMode)
  );

  pushChange(
    "showPreQueryNotices",
    "Pre-query notices",
    formatSettingsPackBoolean(current.showPreQueryNotices),
    formatSettingsPackBoolean(merged.showPreQueryNotices)
  );

  pushChange(
    "showDisabledSourcesInWorkspace",
    "Show disabled sources in workspace",
    formatSettingsPackBoolean(current.showDisabledSourcesInWorkspace),
    formatSettingsPackBoolean(merged.showDisabledSourcesInWorkspace)
  );

  pushChange(
    "includePrivateIpv4",
    "Include private-space IPv4",
    formatSettingsPackBoolean(current.includePrivateIpv4),
    formatSettingsPackBoolean(merged.includePrivateIpv4)
  );

  if (
    pack.connectorConfidenceMetadataOverrides !== undefined &&
    !confidenceMetadataOverridesEqual(
      current.connectorConfidenceMetadataOverrides,
      merged.connectorConfidenceMetadataOverrides
    )
  ) {
    pushChange(
      "connectorConfidenceMetadataOverrides",
      "Connector confidence metadata",
      formatSettingsPackConfidenceMetadataOverrides(
        current.connectorConfidenceMetadataOverrides
      ),
      formatSettingsPackConfidenceMetadataOverrides(
        merged.connectorConfidenceMetadataOverrides
      )
    );
  }

  return changes;
}

export function buildSettingsPackImportPreview(
  current: Vera5Settings,
  rawJson: string
): SettingsPackImportPreview {
  const pack = parseSettingsPackDocument(rawJson);
  return {
    pack,
    changes: buildSettingsPackImportDiff(current, pack),
  };
}

export async function importSettingsPackJson(rawJson: string): Promise<void> {
  const current = await getVera5Settings();
  const pack = parseSettingsPackDocument(rawJson);
  const merged = mergeImportedSettingsPack(current, pack);
  await chrome.storage.local.set(vera5SettingsToStoragePayload(merged));
}

export async function exportSettingsPackJson(): Promise<string> {
  const settings = await getVera5Settings();
  return serializeSettingsPack(settings);
}

export function downloadSettingsPackExport(
  json: string,
  filename = SETTINGS_PACK_EXPORT_FILENAME
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
