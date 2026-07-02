import {
  getAnalystModePresetById,
  normalizeAnalystModePresetId,
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
} from "./analystModePresets";
import {
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  normalizeDomainPolicyList,
  normalizeDomainPolicyMode,
  type DomainPolicyMode,
} from "./domainPolicy";
import {
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
} from "./enrichmentSourceRegistry";
import type { ExportTemplateId } from "./exportTemplates";
import type { PivotProvider } from "./pivots";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  getVera5Settings,
  normalizeEnrichmentSourceCacheTtlRecord,
  normalizeEnrichmentSourceEnabledRecord,
  readStoredCacheTtlSeconds,
  STORAGE_KEY_API_KEYS,
  vera5SettingsToStoragePayload,
  type EnrichmentSourceCacheTtlRecord,
  type EnrichmentSourceEnabledRecord,
  type Vera5Settings,
} from "./storage";

export const SETTINGS_PACK_SCHEMA_VERSION = 1;

export const SETTINGS_PACK_EXPORT_FILENAME = "vera5-settings-pack.json";

export const SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE =
  "When an active threat profile and a settings pack both define the same preference, the threat profile wins for overlapping workflow fields (connectors, analyst mode, export template, pivot emphasis, quiet mode). Settings packs still apply cache TTL and domain policy unless a profile defines those fields. Neither overwrites stored API keys.";

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
        "Settings pack must not include API keys, tokens, or secrets."
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
  if (typeof value.threatProfileSchemaVersion === "number") {
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
  };
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
