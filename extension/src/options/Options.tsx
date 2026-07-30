import { useEffect, useMemo, useRef, useState } from "react";
import { clearEnrichmentCache } from "../lib/cache";
import {
  DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
  DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
  DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
  MAX_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
  MAX_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
  MAX_CORRELATION_CLUSTER_RETENTION_DAYS,
  MIN_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
  MIN_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
  MIN_CORRELATION_CLUSTER_RETENTION_DAYS,
  type CorrelationClusterOverlapMode,
} from "../lib/correlationCluster";
import {
  clearStoredCorrelationClusters,
  getCorrelationClustersStore,
  setCorrelationClusterOverlapMerge,
  setCorrelationClusterRetentionDays,
} from "../lib/correlationClusterStorage";
import {
  DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS,
  MAX_RELATIONSHIP_EDGE_RETENTION_DAYS,
  MIN_RELATIONSHIP_EDGE_RETENTION_DAYS,
} from "../lib/relationshipEdge";
import {
  clearStoredRelationshipEdges,
  getRelationshipEdgesStore,
  setRelationshipEdgeRetentionDays,
} from "../lib/relationshipEdgeStorage";
import {
  buildNoiseRuleDetailView,
  filterNoiseRulesBySearch,
  HIDE_SUPPRESSED_FROM_SCAN_DEFAULT,
  HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_HINT,
  HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_LABEL,
  NOISE_RULE_PATTERN_TYPE_DISPLAY,
  NOISE_RULE_PATTERN_TYPES,
  NOISE_RULE_SOURCE_ACTION_DISPLAY,
  NOISE_RULE_SOURCE_ACTIONS,
  NOISE_RULES_OPTIONS_CANCEL_EDIT_LABEL,
  NOISE_RULES_OPTIONS_CLEAR_LABEL,
  NOISE_RULES_OPTIONS_DELETE_LABEL,
  NOISE_RULES_OPTIONS_EDIT_LABEL,
  NOISE_RULES_OPTIONS_EMPTY_TEXT,
  NOISE_RULES_OPTIONS_ENABLE_LABEL,
  NOISE_RULES_OPTIONS_EXPORT_HINT,
  NOISE_RULES_OPTIONS_EXPORT_LABEL,
  NOISE_RULES_OPTIONS_IMPORT_HINT,
  NOISE_RULES_OPTIONS_IMPORT_LABEL,
  NOISE_RULES_OPTIONS_IMPORT_STARTER_HINT,
  NOISE_RULES_OPTIONS_IMPORT_STARTER_LABEL,
  NOISE_RULES_IMPORT_APPLY_LABEL,
  NOISE_RULES_IMPORT_CANCEL_LABEL,
  NOISE_RULES_IMPORT_MERGE_MODE,
  NOISE_RULES_IMPORT_MERGE_MODE_LABEL,
  NOISE_RULES_IMPORT_REPLACE_CONFIRM_LABEL,
  NOISE_RULES_IMPORT_REVIEW_TITLE,
  NOISE_RULES_OPTIONS_NO_SEARCH_MATCHES,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_ARIA_LABEL,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_CLEAR_LABEL,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_EMPTY_MATCHES,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_HINT,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_LABEL,
  NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_SUMMARY,
  NOISE_RULES_OPTIONS_SAVE_LABEL,
  NOISE_RULES_OPTIONS_SEARCH_LABEL,
  NOISE_RULES_OPTIONS_SEARCH_PLACEHOLDER,
  NOISE_RULES_OPTIONS_SECTION_DESC,
  NOISE_RULES_OPTIONS_SECTION_ID,
  NOISE_RULES_OPTIONS_SECTION_TITLE,
  NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_ARIA_LABEL,
  NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_DONE,
  NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_EMPTY,
  NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_HINT,
  NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_LABEL,
  buildNoiseRuleSampleAlertMatchPreview,
  parseNoiseRulesOptionsHash,
  SOC_DASHBOARD_NOISE_STARTER_EXAMPLES_PATH,
  type NoiseRule,
  type NoiseRulePatternType,
  type NoiseRuleSampleAlertMatchPreview,
  type NoiseRuleSourceAction,
  type NoiseRulesImportMergeMode,
} from "../lib/noiseRule";
import {
  buildNoiseRulesImportPreview,
  clearStoredNoiseRules,
  deleteStoredNoiseRule,
  detectNoiseRulesImportFormat,
  downloadNoiseRulesExportJson,
  exportStoredNoiseRulesJson,
  formatNoiseRulesImportStatus,
  getStoredLastLearnedNoiseRuleUndo,
  importNoiseRulesFromText,
  listStoredNoiseRules,
  NoiseRulesImportError,
  serializeSocDashboardNoiseStarterExportJson,
  setStoredNoiseRuleEnabled,
  undoLastLearnedNoiseRule,
  updateStoredNoiseRule,
  type NoiseRulesImportFormat,
  type NoiseRulesImportPreview,
} from "../lib/noiseRuleStorage";
import {
  createDefaultKnownGoodCategoryEnabled,
  createKnownGoodEntry,
  formatKnownGoodCategoryDisplay,
  formatKnownGoodEntrySummary,
  formatKnownGoodMatchTypeDisplay,
  KNOWN_GOOD_CATEGORIES,
  KNOWN_GOOD_DISCLAIMER_TEXT,
  KNOWN_GOOD_MATCH_TYPES,
  KNOWN_GOOD_OPTIONS_CANCEL_LABEL,
  KNOWN_GOOD_OPTIONS_CATEGORIES_HEADING,
  KNOWN_GOOD_OPTIONS_CATEGORIES_HINT,
  KNOWN_GOOD_OPTIONS_DELETE_LABEL,
  KNOWN_GOOD_OPTIONS_EDIT_LABEL,
  KNOWN_GOOD_OPTIONS_ENABLE_CATEGORY_LABEL,
  KNOWN_GOOD_OPTIONS_ENTRIES_HEADING,
  KNOWN_GOOD_OPTIONS_EMPTY_TEXT,
  KNOWN_GOOD_OPTIONS_EXPORT_ERROR,
  KNOWN_GOOD_OPTIONS_EXPORT_HINT,
  KNOWN_GOOD_OPTIONS_EXPORT_LABEL,
  KNOWN_GOOD_OPTIONS_EXPORT_SUCCESS,
  KNOWN_GOOD_OPTIONS_SAVE_LABEL,
  KNOWN_GOOD_OPTIONS_SECTION_DESC,
  KNOWN_GOOD_OPTIONS_SECTION_ID,
  KNOWN_GOOD_OPTIONS_SECTION_TITLE,
  SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_DEFAULT,
  SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_HINT,
  SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_LABEL,
  parseKnownGoodOptionsHash,
  type KnownGoodCategory,
  type KnownGoodCategoryEnabledRecord,
  type KnownGoodEntry,
  type KnownGoodMatchType,
} from "../lib/knownGood";
import {
  deleteStoredKnownGoodEntry,
  downloadKnownGoodExportJson,
  exportStoredKnownGoodListJson,
  getKnownGoodListStore,
  setStoredKnownGoodCategoryEnabled,
  updateStoredKnownGoodEntry,
} from "../lib/knownGoodStorage";
import { ENRICHMENT_SOURCE_OPS_WORKSPACE_GUIDANCE } from "../lib/enrichmentSourceOps";
import { prefersReducedMotion } from "../lib/motionPreference";
import {
  downloadVera5SettingsExport,
  exportVera5SettingsJson,
  importVera5SettingsJson,
} from "../lib/settingsExport";
import {
  buildSettingsPackImportPreview,
  buildThreatProfileImportPreview,
  createEmptyActiveThreatProfileState,
  downloadSettingsPackExport,
  downloadThreatProfileExport,
  exportSettingsPackJson,
  exportThreatProfileJson,
  formatActiveThreatProfileIndicator,
  formatThreatProfileLastImportedAt,
  getActiveThreatProfileState,
  getBuiltInThreatProfileById,
  importSettingsPackJson,
  importThreatProfileJson,
  listShippedBuiltInThreatProfiles,
  serializeBuiltInThreatProfile,
  SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE,
  THREAT_PROFILE_IMPORT_MERGE_MODE,
  THREAT_PROFILE_IMPORT_MERGE_MODE_LABEL,
  type ActiveThreatProfileState,
  type SettingsPackImportPreview,
  type ThreatProfileImportMergeMode,
  type ThreatProfileImportPreview,
} from "../lib/settingsPack";
import type { OperatorMacro, OperatorMacroStep, OperatorMacroTriggers } from "../lib/operatorMacro";
import {
  buildOperatorMacroPackImportPreview,
  downloadOperatorMacroPackExport,
  MAX_OPERATOR_MACRO_STEPS,
  MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH,
  MAX_OPERATOR_MACRO_ID_LENGTH,
  MAX_OPERATOR_MACRO_NAME_LENGTH,
  normalizeOperatorMacroId,
  normalizeOperatorMacroName,
  serializeOperatorMacroEditorSteps,
  validateOperatorMacroEditorSteps,
  type OperatorMacroPackImportPreview,
} from "../lib/operatorMacro";
import {
  createDefaultOperatorMacroStep,
  DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
  isOperatorMacroStepTypeV1,
  MAX_OPERATOR_MACRO_NOTE_TEMPLATE_TEXT_LENGTH,
  MAX_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
  normalizeOperatorMacroStepV1,
  OPERATOR_MACRO_EXPORT_DESTINATION,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_NOTE_TEMPLATE_MODE,
  OPERATOR_MACRO_PIVOT_OPEN_MODE,
  OPERATOR_MACRO_QUEUE_SOURCE,
  OPERATOR_MACRO_STEP_TYPE,
  OPERATOR_MACRO_STEP_TYPE_LABEL,
  OPERATOR_MACRO_STEP_TYPE_V1_ORDER,
  type OperatorMacroStepTypeV1,
} from "../lib/operatorMacroStepTypes";
import { EXPORT_TEMPLATE_IDS, getExportTemplateLabel } from "../lib/exportTemplates";
import {
  createStoredOperatorMacro,
  deleteStoredOperatorMacro,
  duplicateStoredOperatorMacro,
  ensureBuiltInOperatorMacros,
  exportUserOperatorMacroPackJson,
  importUserOperatorMacroPackJson,
  listStoredOperatorMacros,
  reorderStoredOperatorMacros,
  saveStoredOperatorMacro,
} from "../lib/operatorMacroStorage";
import type {
  ApiKeySlot,
  AttributeHrefSitePreference,
  AttributeHrefSitePreferencesRecord,
  EnrichmentSourceCacheTtlRecord,
  EnrichmentSourceEnabledRecord,
  InternalAssetVendorLabelEntry,
  IocTypeEnabledRecord,
} from "../lib/storage";
import type { IocType } from "../lib/iocRegex";
import {
  CENSYS_SECRET_API_KEY_SLOT,
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_DESCRIPTIONS,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  isEnrichmentSourceId,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  OPTIONS_API_KEY_SLOTS,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  applyAnalystModePreset,
  getAnalystModePresetId,
  getApiKey,
  getAutoScanEnabled,
  getAttributeHrefExtractionEnabled,
  getAttributeHrefExtractionConsentAcknowledged,
  getAttributeHrefExtractionRememberSiteChoices,
  getAttributeHrefExtractionSitePreferences,
  getDomainAllowlist,
  getDomainDenylist,
  getDomainPolicyEnrichGateEnabled,
  getDomainPolicyMode,
  getEnrichmentCacheTtlSecondsFromSettings,
  getEnrichmentSourceCacheTtlSeconds,
  getEnrichmentSourceEnabled,
  getIncludePrivateIpv4,
  getHideSuppressedFromScan,
  getSkipEnrichOnKnownGoodMatch,
  getInstallQuickStartCompleted,
  getVera5Settings,
  getLocalBackendEnabled,
  getLocalLlmSummaryEnabled,
  getInternalAssetCidrRanges,
  getInternalAssetDomains,
  getInternalAssetEnrichGateEnabled,
  getInternalAssetVendorLabels,
  getIocTypeEnabled,
  getManualOnlyMode,
  getPivotContextMenuCategoryEnabled,
  getPivotContextMenuSiteEnabled,
  getPreQueryNoticePreferenceConfigured,
  getQuietMode,
  getShowDisabledSourcesInWorkspace,
  getShowPreQueryNotices,
  getPageContextSiteModeOverrides,
  hasApiKey,
  completeInstallQuickStart,
  IOC_TYPE_SETTINGS_ORDER,
  isMaskedApiKeyDisplay,
  maskApiKeyForDisplay,
  readStoredCacheTtlSeconds,
  createDefaultPivotContextMenuCategoryEnabledRecord,
  createDefaultPivotContextMenuSiteEnabledRecord,
  setApiKey,
  setAutoScanEnabled,
  setAttributeHrefExtractionEnabled,
  setAttributeHrefExtractionConsentAcknowledged,
  setAttributeHrefExtractionRememberSiteChoices,
  setAttributeHrefExtractionSitePreferences,
  setDomainAllowlist,
  setDomainDenylist,
  setDomainPolicyEnrichGateEnabled,
  setDomainPolicyMode,
  setEnrichmentCacheTtlSeconds,
  setEnrichmentSourceCacheTtlSeconds,
  setEnrichmentSourceEnabled,
  setIncludePrivateIpv4,
  setHideSuppressedFromScan,
  setSkipEnrichOnKnownGoodMatch,
  setLocalBackendEnabled,
  setLocalLlmSummaryEnabled,
  setInternalAssetCidrRanges,
  setInternalAssetDomains,
  setInternalAssetEnrichGateEnabled,
  setInternalAssetVendorLabels,
  setIocTypeEnabled,
  setManualOnlyMode,
  setPivotContextMenuCategoryEnabled,
  setPivotContextMenuSiteEnabled,
  setPreQueryNoticePreference,
  setQuietMode,
  setShowDisabledSourcesInWorkspace,
  type PivotContextMenuCategoryEnabledRecord,
  type PivotContextMenuSiteEnabledRecord,
  setPageContextSiteModeOverrides,
  clearPageContextSiteModeOverrides,
} from "../lib/storage";
import {
  PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_BY_TYPE,
  PAGE_CONTEXT_TYPE,
  PAGE_CONTEXT_TYPE_LABEL,
  PAGE_CONTEXT_TYPE_ORDER,
  normalizePageContextSiteModeOverrideHost,
  type PageContextSiteModeOverridesRecord,
  type PageContextType,
} from "../lib/pageContext";
import {
  DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  DOMAIN_POLICY_PRESETS,
  applyDomainPolicyPresetToLists,
  getDomainPolicyPresetById,
  normalizeDomainPolicyEntry,
  type DomainPolicyMode,
} from "../lib/domainPolicy";
import { ANALYST_MODE_PRESETS, type AnalystModePresetId } from "../lib/analystModePresets";
import { normalizeInternalAssetCidrRange } from "../lib/internalAssetPolicy";
import {
  CONNECTOR_SOURCE_CLASS,
  getConnectorSourceClassLabel,
  type ConnectorSourceClass,
} from "../lib/connectorDefinition";
import {
  listPivotContextMenuCategories,
  pivotContextMenuSiteTitle,
  type PivotProvider,
} from "../lib/pivots";

const API_KEY_FIELD_SLOTS: ApiKeySlot[] = [...OPTIONS_API_KEY_SLOTS, CENSYS_SECRET_API_KEY_SLOT];

const INSTALL_QUICK_START_KEY_SLOTS = LIVE_ENRICHMENT_SOURCE_ORDER.filter(
  (sourceId): sourceId is ApiKeySlot => OPTIONS_API_KEY_SLOTS.includes(sourceId)
);

const ATTRIBUTE_HREF_EXTRACTION_SECURITY_DOC_URL =
  "https://github.com/0xCBradford/Vera5/blob/main/docs/security-model.md#opt-in-attribute-and-href-extraction";

type InstallQuickStartStep = 0 | 1 | 2 | 3;

const INSTALL_QUICK_START_STEP_LABELS = [
  "Welcome",
  "API keys",
  "Enrichment control",
  "Trust defaults",
] as const;

const IOC_TYPE_OPTION_LABELS: Record<IocType, string> = {
  ipv4: "IPv4 addresses",
  domain: "Domain names",
  url: "URLs",
  md5: "MD5 hashes",
  sha1: "SHA1 hashes",
  sha256: "SHA256 hashes",
  cve: "CVE identifiers",
  email: "Email addresses",
  asn: "ASNs",
  cidr: "IPv4 CIDR ranges",
  filepath: "File paths",
  onion: "Onion domains",
};

const IOC_TYPE_SHORT_LABELS: Record<IocType, string> = {
  ipv4: "IPv4",
  domain: "Domain",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  cve: "CVE",
  email: "Email",
  asn: "ASN",
  cidr: "CIDR",
  filepath: "Path",
  onion: "Onion",
};

const IOC_TYPE_CODES: Record<IocType, string> = {
  ipv4: "IPV4",
  domain: "DOM",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "256",
  cve: "CVE",
  email: "EML",
  asn: "ASN",
  cidr: "CIDR",
  filepath: "PATH",
  onion: "ONION",
};

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scanning", label: "Scanning" },
  { id: "indicators", label: "Indicator Types" },
  { id: "sources", label: "Enrichment Sources" },
  { id: "pivots", label: "Pivots" },
  { id: "api-keys", label: "API Keys" },
  { id: "local-ai-summary", label: "Local AI Summary" },
  { id: "trust", label: "Trust & Consent" },
  { id: "operator-macros", label: "Operator Macros" },
  { id: "cache", label: "Enrichment Cache" },
  { id: "correlation", label: "Cross-session correlation" },
  { id: "relationship-memory", label: "Relationship memory" },
  { id: "noise-rules", label: "Noise rules" },
  { id: "known-good", label: "Known-good lists" },
  { id: "backup", label: "Settings Backup" },
];

type CorrelationOverlapModeDraft = "off" | CorrelationClusterOverlapMode;

const CACHE_PRESETS: { label: string; seconds: number }[] = [
  { label: "15 min", seconds: 900 },
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 21600 },
  { label: "24 hours", seconds: 86400 },
];

function formatCacheTtl(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "No caching";
  }
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} min`;
  }
  return `${seconds} sec`;
}

function createDefaultIocTypeEnabledState(): IocTypeEnabledRecord {
  const record: IocTypeEnabledRecord = {};
  for (const iocType of IOC_TYPE_SETTINGS_ORDER) {
    record[iocType] = true;
  }
  return record;
}

function createDefaultSourceEnabledState(): EnrichmentSourceEnabledRecord {
  return Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [sourceId, false])
  ) as EnrichmentSourceEnabledRecord;
}

function createDefaultSourceCacheTtlDrafts(): Record<EnrichmentSourceId, string> {
  return Object.fromEntries(ENRICHMENT_SOURCE_ORDER.map((sourceId) => [sourceId, ""])) as Record<
    EnrichmentSourceId,
    string
  >;
}

function formatSourceCacheTtlDrafts(
  overrides: EnrichmentSourceCacheTtlRecord
): Record<EnrichmentSourceId, string> {
  return Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [
      sourceId,
      overrides[sourceId] !== undefined ? String(overrides[sourceId]) : "",
    ])
  ) as Record<EnrichmentSourceId, string>;
}

function scrollToSection(id: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  const behavior: ScrollBehavior =
    typeof window !== "undefined" && prefersReducedMotion(window) ? "auto" : "smooth";
  element.scrollIntoView({ behavior, block: "start" });
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.3 5 8.6l4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type SwitchProps = {
  ariaLabel: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

function Switch({ ariaLabel, checked, disabled, onChange }: SwitchProps) {
  return (
    <span className={`v5-toggle${disabled ? " v5-toggle--disabled" : ""}`}>
      <input
        type="checkbox"
        className="v5-toggle__input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="v5-toggle__track" aria-hidden="true">
        <span className="v5-toggle__thumb" />
      </span>
    </span>
  );
}

type ToggleRowProps = {
  label: string;
  hint?: string;
  ariaLabel: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ label, hint, ariaLabel, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className="v5-row" style={{ cursor: disabled ? "wait" : "pointer" }}>
      <span className="v5-row__text">
        <span className="v5-row__label">{label}</span>
        {hint ? <span className="v5-row__hint">{hint}</span> : null}
      </span>
      <Switch ariaLabel={ariaLabel} checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}

type OperatorMacroStepDraft = {
  clientId: string;
  type: string;
  params: Record<string, unknown>;
};

type OperatorMacroEditorDraft = {
  id: string;
  name: string;
  description: string;
  triggers: OperatorMacroTriggers;
  steps: OperatorMacroStepDraft[];
};

function createOperatorMacroStepDraftId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function operatorMacroStepDraftFromStep(
  step: OperatorMacroStep,
  clientId: string
): OperatorMacroStepDraft {
  return {
    clientId,
    type: step.type,
    params: { ...step.params },
  };
}

function createEmptyOperatorMacroEditorDraft(): OperatorMacroEditorDraft {
  const defaultEnrich = createDefaultOperatorMacroStep(OPERATOR_MACRO_STEP_TYPE.ENRICH);
  return {
    id: "",
    name: "",
    description: "",
    triggers: {
      palette: true,
      tray: false,
      context: false,
    },
    steps: [
      operatorMacroStepDraftFromStep(
        {
          type: defaultEnrich.type,
          params: defaultEnrich.params as Record<string, unknown>,
        },
        createOperatorMacroStepDraftId()
      ),
    ],
  };
}

function operatorMacroEditorDraftFromMacro(macro: OperatorMacro): OperatorMacroEditorDraft {
  return {
    id: macro.id,
    name: macro.name,
    description: macro.metadata.description,
    triggers: { ...macro.triggers },
    steps: macro.steps.map((step, index) =>
      operatorMacroStepDraftFromStep(step, `${macro.id}-step-${index}`)
    ),
  };
}

function suggestOperatorMacroIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_OPERATOR_MACRO_ID_LENGTH);
  if (slug.length > 0 && normalizeOperatorMacroId(slug)) {
    return slug;
  }
  return `macro-${Date.now()}`;
}

function formatOperatorMacroTriggerSummary(triggers: OperatorMacroTriggers): string {
  const labels: string[] = [];
  if (triggers.palette) {
    labels.push("Palette");
  }
  if (triggers.tray) {
    labels.push("Tray");
  }
  if (triggers.context) {
    labels.push("Context menu");
  }
  return labels.length > 0 ? labels.join(", ") : "None";
}

const OPERATOR_MACRO_IOC_SCOPE_LABEL: Record<string, string> = {
  [OPERATOR_MACRO_IOC_SCOPE.SELECTION]: "Selection",
  [OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC]: "Active IOC",
  [OPERATOR_MACRO_IOC_SCOPE.TRAY_FILTERED]: "Tray filtered",
};

function readOperatorMacroStepProviders(params: Record<string, unknown>): EnrichmentSourceId[] {
  if (!Array.isArray(params.providers)) {
    return [];
  }
  return params.providers.filter(
    (provider): provider is EnrichmentSourceId =>
      typeof provider === "string" && isEnrichmentSourceId(provider)
  );
}

function operatorMacroStepDraftValidationError(
  step: OperatorMacroStepDraft,
  index: number
): string | null {
  if (!isOperatorMacroStepTypeV1(step.type)) {
    return `Step ${index + 1} uses an unsupported step type.`;
  }
  if (normalizeOperatorMacroStepV1(step) === null) {
    return `Step ${index + 1} has invalid parameters.`;
  }
  return null;
}

type OperatorMacroStepFieldsEditorProps = {
  step: OperatorMacroStepDraft;
  disabled: boolean;
  onParamsChange: (params: Record<string, unknown>) => void;
};

function OperatorMacroStepFieldsEditor({
  step,
  disabled,
  onParamsChange,
}: OperatorMacroStepFieldsEditorProps) {
  const patchParams = (patch: Record<string, unknown>) => {
    onParamsChange({ ...step.params, ...patch });
  };

  switch (step.type) {
    case OPERATOR_MACRO_STEP_TYPE.ENRICH:
      return (
        <>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-enrich-scope`}>
              IOC scope
            </label>
            <select
              id={`${step.clientId}-enrich-scope`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.scope === "string"
                  ? step.params.scope
                  : OPERATOR_MACRO_IOC_SCOPE.SELECTION
              }
              onChange={(event) => patchParams({ scope: event.target.value })}
            >
              <option value={OPERATOR_MACRO_IOC_SCOPE.SELECTION}>
                {OPERATOR_MACRO_IOC_SCOPE_LABEL[OPERATOR_MACRO_IOC_SCOPE.SELECTION]}
              </option>
              <option value={OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC}>
                {OPERATOR_MACRO_IOC_SCOPE_LABEL[OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC]}
              </option>
            </select>
          </div>
          <ToggleRow
            label="Force refresh"
            hint="Bypass enrichment cache for this step."
            ariaLabel="Force refresh enrichment"
            checked={step.params.forceRefresh === true}
            disabled={disabled}
            onChange={(checked) => patchParams({ forceRefresh: checked })}
          />
        </>
      );
    case OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN:
      return (
        <>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-export-template`}>
              Export template
            </label>
            <select
              id={`${step.clientId}-export-template`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.templateId === "string"
                  ? step.params.templateId
                  : EXPORT_TEMPLATE_IDS[0]
              }
              onChange={(event) => patchParams({ templateId: event.target.value })}
            >
              {EXPORT_TEMPLATE_IDS.map((templateId) => (
                <option key={templateId} value={templateId}>
                  {getExportTemplateLabel(templateId)}
                </option>
              ))}
            </select>
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-export-destination`}>
              Destination
            </label>
            <select
              id={`${step.clientId}-export-destination`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.destination === "string"
                  ? step.params.destination
                  : OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD
              }
              onChange={(event) => patchParams({ destination: event.target.value })}
            >
              <option value={OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD}>Clipboard</option>
              <option value={OPERATOR_MACRO_EXPORT_DESTINATION.DOWNLOAD}>Download</option>
            </select>
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-export-scope`}>
              IOC scope
            </label>
            <select
              id={`${step.clientId}-export-scope`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.scope === "string"
                  ? step.params.scope
                  : OPERATOR_MACRO_IOC_SCOPE.SELECTION
              }
              onChange={(event) => patchParams({ scope: event.target.value })}
            >
              {Object.values(OPERATOR_MACRO_IOC_SCOPE).map((scope) => (
                <option key={scope} value={scope}>
                  {OPERATOR_MACRO_IOC_SCOPE_LABEL[scope]}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    case OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT: {
      const selectedProviders = readOperatorMacroStepProviders(step.params);
      return (
        <>
          <div className="v5-field">
            <span className="v5-field__label">Pivot providers</span>
            <div className="v5-chips" style={{ marginBottom: 8 }}>
              {selectedProviders.length > 0 ? (
                selectedProviders.map((providerId) => (
                  <span key={providerId} className="v5-chip">
                    {ENRICHMENT_SOURCE_LABELS[providerId]}
                  </span>
                ))
              ) : (
                <span className="v5-chip v5-chip--muted">None selected</span>
              )}
            </div>
            <ul className="v5-domain-list" aria-label="Pivot providers">
              {ENRICHMENT_SOURCE_ORDER.map((providerId) => {
                const checked = selectedProviders.includes(providerId);
                return (
                  <li key={providerId} className="v5-domain-list__item">
                    <label className="v5-row" style={{ cursor: disabled ? "wait" : "pointer" }}>
                      <span className="v5-row__text">
                        <span className="v5-row__label">
                          {ENRICHMENT_SOURCE_LABELS[providerId]}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedProviders, providerId]
                            : selectedProviders.filter((entry) => entry !== providerId);
                          patchParams({ providers: next });
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-pivot-open-mode`}>
              Open mode
            </label>
            <select
              id={`${step.clientId}-pivot-open-mode`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.openMode === "string"
                  ? step.params.openMode
                  : OPERATOR_MACRO_PIVOT_OPEN_MODE.FIRST
              }
              onChange={(event) => patchParams({ openMode: event.target.value })}
            >
              <option value={OPERATOR_MACRO_PIVOT_OPEN_MODE.FIRST}>First provider</option>
              <option value={OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL}>All providers</option>
            </select>
          </div>
        </>
      );
    }
    case OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE:
      return (
        <>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-note-template-text`}>
              Template text
            </label>
            <textarea
              id={`${step.clientId}-note-template-text`}
              className="v5-input"
              rows={4}
              disabled={disabled}
              maxLength={MAX_OPERATOR_MACRO_NOTE_TEMPLATE_TEXT_LENGTH}
              value={typeof step.params.templateText === "string" ? step.params.templateText : ""}
              onChange={(event) => patchParams({ templateText: event.target.value })}
            />
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-note-template-mode`}>
              Mode
            </label>
            <select
              id={`${step.clientId}-note-template-mode`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.mode === "string"
                  ? step.params.mode
                  : OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND
              }
              onChange={(event) => patchParams({ mode: event.target.value })}
            >
              <option value={OPERATOR_MACRO_NOTE_TEMPLATE_MODE.REPLACE}>Replace</option>
              <option value={OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND}>Append</option>
            </select>
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-note-template-scope`}>
              IOC scope
            </label>
            <select
              id={`${step.clientId}-note-template-scope`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.scope === "string"
                  ? step.params.scope
                  : OPERATOR_MACRO_IOC_SCOPE.SELECTION
              }
              onChange={(event) => patchParams({ scope: event.target.value })}
            >
              <option value={OPERATOR_MACRO_IOC_SCOPE.SELECTION}>
                {OPERATOR_MACRO_IOC_SCOPE_LABEL[OPERATOR_MACRO_IOC_SCOPE.SELECTION]}
              </option>
              <option value={OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC}>
                {OPERATOR_MACRO_IOC_SCOPE_LABEL[OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC]}
              </option>
            </select>
          </div>
        </>
      );
    case OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS:
      return (
        <>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-queue-source`}>
              Queue source
            </label>
            <select
              id={`${step.clientId}-queue-source`}
              className="v5-input"
              disabled={disabled}
              value={
                typeof step.params.source === "string"
                  ? step.params.source
                  : OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN
              }
              onChange={(event) => patchParams({ source: event.target.value })}
            >
              <option value={OPERATOR_MACRO_QUEUE_SOURCE.APPEARED_ALONGSIDE}>
                Appeared alongside
              </option>
              <option value={OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN}>Tray scan</option>
            </select>
          </div>
          <div className="v5-field">
            <label className="v5-field__label" htmlFor={`${step.clientId}-queue-limit`}>
              Limit
            </label>
            <input
              id={`${step.clientId}-queue-limit`}
              type="number"
              className="v5-input"
              min={1}
              max={MAX_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT}
              disabled={disabled}
              value={
                typeof step.params.limit === "number"
                  ? step.params.limit
                  : DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT
              }
              onChange={(event) => {
                const parsed = Number(event.target.value);
                patchParams({
                  limit: Number.isFinite(parsed)
                    ? Math.min(
                        MAX_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
                        Math.max(1, Math.trunc(parsed))
                      )
                    : DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
                });
              }}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}

type OperatorMacroStepsEditorProps = {
  steps: OperatorMacroStepDraft[];
  disabled: boolean;
  onChange: (steps: OperatorMacroStepDraft[]) => void;
};

function OperatorMacroStepsEditor({ steps, disabled, onChange }: OperatorMacroStepsEditorProps) {
  const [stepTypeToAdd, setStepTypeToAdd] = useState<OperatorMacroStepTypeV1>(
    OPERATOR_MACRO_STEP_TYPE.ENRICH
  );

  const updateStep = (
    clientId: string,
    patch: Partial<Pick<OperatorMacroStepDraft, "type" | "params">>
  ) => {
    onChange(
      steps.map((step) => {
        if (step.clientId !== clientId) {
          return step;
        }
        if (patch.type && patch.type !== step.type && isOperatorMacroStepTypeV1(patch.type)) {
          const defaults = createDefaultOperatorMacroStep(patch.type);
          return {
            clientId: step.clientId,
            type: defaults.type,
            params: { ...defaults.params },
          };
        }
        return {
          ...step,
          ...patch,
          params: patch.params ?? step.params,
        };
      })
    );
  };

  const moveStep = (clientId: string, direction: -1 | 1) => {
    const index = steps.findIndex((step) => step.clientId === clientId);
    if (index < 0) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }
    const nextSteps = [...steps];
    const [item] = nextSteps.splice(index, 1);
    if (!item) {
      return;
    }
    nextSteps.splice(nextIndex, 0, item);
    onChange(nextSteps);
  };

  const removeStep = (clientId: string) => {
    onChange(steps.filter((step) => step.clientId !== clientId));
  };

  const addStep = () => {
    if (steps.length >= MAX_OPERATOR_MACRO_STEPS) {
      return;
    }
    const defaults = createDefaultOperatorMacroStep(stepTypeToAdd);
    onChange([
      ...steps,
      operatorMacroStepDraftFromStep(
        {
          type: defaults.type,
          params: defaults.params as Record<string, unknown>,
        },
        createOperatorMacroStepDraftId()
      ),
    ]);
  };

  return (
    <fieldset className="v5-field" disabled={disabled}>
      <legend className="v5-field__label">Steps</legend>
      {steps.length === 0 ? (
        <span className="v5-status v5-status--muted">Add at least one step.</span>
      ) : (
        <ul className="v5-domain-list" aria-label="Macro steps">
          {steps.map((step, index) => {
            const stepError = operatorMacroStepDraftValidationError(step, index);
            const stepType = isOperatorMacroStepTypeV1(step.type)
              ? step.type
              : OPERATOR_MACRO_STEP_TYPE.ENRICH;
            return (
              <li key={step.clientId} className="v5-domain-list__item">
                <div style={{ display: "grid", gap: 12, flex: 1 }}>
                  <div className="v5-field" style={{ margin: 0 }}>
                    <label className="v5-field__label" htmlFor={`${step.clientId}-step-type`}>
                      Step {index + 1}
                    </label>
                    <select
                      id={`${step.clientId}-step-type`}
                      className="v5-input"
                      disabled={disabled}
                      value={stepType}
                      onChange={(event) => {
                        const nextType = event.target.value;
                        if (isOperatorMacroStepTypeV1(nextType)) {
                          updateStep(step.clientId, { type: nextType });
                        }
                      }}
                    >
                      {OPERATOR_MACRO_STEP_TYPE_V1_ORDER.map((type) => (
                        <option key={type} value={type}>
                          {OPERATOR_MACRO_STEP_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <OperatorMacroStepFieldsEditor
                    step={step}
                    disabled={disabled}
                    onParamsChange={(params) => updateStep(step.clientId, { params })}
                  />
                  {stepError ? (
                    <span className="v5-status v5-status--error" role="alert">
                      {stepError}
                    </span>
                  ) : null}
                </div>
                <div className="v5-actions" style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || index === 0}
                    onClick={() => moveStep(step.clientId, -1)}
                    aria-label={`Move step ${index + 1} up`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || index === steps.length - 1}
                    onClick={() => moveStep(step.clientId, 1)}
                    aria-label={`Move step ${index + 1} down`}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || steps.length <= 1}
                    onClick={() => removeStep(step.clientId)}
                    aria-label={`Remove step ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="v5-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <select
          className="v5-input"
          aria-label="Step type to add"
          disabled={disabled || steps.length >= MAX_OPERATOR_MACRO_STEPS}
          value={stepTypeToAdd}
          onChange={(event) => {
            const nextType = event.target.value;
            if (isOperatorMacroStepTypeV1(nextType)) {
              setStepTypeToAdd(nextType);
            }
          }}
        >
          {OPERATOR_MACRO_STEP_TYPE_V1_ORDER.map((type) => (
            <option key={type} value={type}>
              {OPERATOR_MACRO_STEP_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="v5-btn"
          disabled={disabled || steps.length >= MAX_OPERATOR_MACRO_STEPS}
          onClick={addStep}
        >
          Add step
        </button>
      </div>
      <span className="v5-row__hint" style={{ display: "block", marginTop: 8 }}>
        {steps.length} / {MAX_OPERATOR_MACRO_STEPS} steps
      </span>
    </fieldset>
  );
}

type OperatorMacrosListEditorProps = {
  macros: readonly OperatorMacro[];
  disabled: boolean;
  onCreate: () => void;
  onEdit: (macroId: string) => void;
  onDuplicate: (macroId: string) => void;
  onDelete: (macroId: string) => void;
  onMoveUp: (macroId: string) => void;
  onMoveDown: (macroId: string) => void;
};

function OperatorMacrosListEditor({
  macros,
  disabled,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: OperatorMacrosListEditorProps) {
  return (
    <div className="v5-field">
      <div className="v5-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="v5-btn v5-btn--primary"
          disabled={disabled}
          onClick={onCreate}
        >
          Create macro
        </button>
      </div>
      {macros.length === 0 ? (
        <span className="v5-status v5-status--muted">No macros stored yet.</span>
      ) : (
        <ul className="v5-domain-list" aria-label="Operator macros">
          {macros.map((macro, index) => {
            const builtIn = macro.metadata.builtIn;
            const stepLabel = macro.steps.length === 1 ? "1 step" : `${macro.steps.length} steps`;
            return (
              <li key={macro.id} className="v5-domain-list__item">
                <div style={{ display: "grid", gap: 4, flex: 1 }}>
                  <span>
                    <strong>{macro.name}</strong> <code>{macro.id}</code>
                    {builtIn ? <span className="v5-status v5-status--muted"> Built-in</span> : null}
                  </span>
                  <span className="v5-row__hint" style={{ margin: 0 }}>
                    {stepLabel} · {formatOperatorMacroTriggerSummary(macro.triggers)}
                    {macro.metadata.description ? ` · ${macro.metadata.description}` : ""}
                  </span>
                </div>
                <div className="v5-actions" style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || index === 0}
                    onClick={() => onMoveUp(macro.id)}
                    aria-label={`Move ${macro.name} up`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || index === macros.length - 1}
                    onClick={() => onMoveDown(macro.id)}
                    aria-label={`Move ${macro.name} down`}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled || builtIn}
                    onClick={() => onEdit(macro.id)}
                    aria-label={`Edit ${macro.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="v5-btn v5-btn--link"
                    disabled={disabled}
                    onClick={() => onDuplicate(macro.id)}
                    aria-label={`Duplicate ${macro.name}`}
                  >
                    Duplicate
                  </button>
                  {!builtIn ? (
                    <button
                      type="button"
                      className="v5-btn v5-btn--link"
                      disabled={disabled}
                      onClick={() => onDelete(macro.id)}
                      aria-label={`Delete ${macro.name}`}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type DomainPolicyListEditorProps = {
  label: string;
  hint: string;
  inputAriaLabel: string;
  addButtonAriaLabel: string;
  entries: readonly string[];
  draft: string;
  disabled: boolean;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (entry: string) => void;
};

function DomainPolicyListEditor({
  label,
  hint,
  inputAriaLabel,
  addButtonAriaLabel,
  entries,
  draft,
  disabled,
  onDraftChange,
  onAdd,
  onRemove,
}: DomainPolicyListEditorProps) {
  return (
    <div className="v5-field">
      <span className="v5-field__label">{label}</span>
      <span className="v5-status v5-status--muted" style={{ display: "block", marginBottom: 8 }}>
        {hint}
      </span>
      <form
        className="v5-actions"
        style={{ marginBottom: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <input
          type="text"
          className="v5-input v5-input--sm"
          value={draft}
          disabled={disabled}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-label={inputAriaLabel}
          placeholder="mail.* or hr.company.com"
        />
        <button
          type="submit"
          className="v5-btn v5-btn--primary"
          disabled={disabled}
          aria-label={addButtonAriaLabel}
        >
          Add
        </button>
      </form>
      {entries.length === 0 ? (
        <span className="v5-status v5-status--muted">No entries yet.</span>
      ) : (
        <ul className="v5-domain-list" aria-label={`${label} entries`}>
          {entries.map((entry) => (
            <li key={entry} className="v5-domain-list__item">
              <code>{entry}</code>
              <button
                type="button"
                className="v5-btn v5-btn--link"
                disabled={disabled}
                onClick={() => onRemove(entry)}
                aria-label={`Remove ${entry} from ${label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type InternalAssetVendorLabelListEditorProps = {
  label: string;
  hint: string;
  entries: InternalAssetVendorLabelEntry[];
  labelDraft: string;
  patternDraft: string;
  disabled: boolean;
  onLabelDraftChange: (value: string) => void;
  onPatternDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (entry: InternalAssetVendorLabelEntry) => void;
};

function InternalAssetVendorLabelListEditor({
  label,
  hint,
  entries,
  labelDraft,
  patternDraft,
  disabled,
  onLabelDraftChange,
  onPatternDraftChange,
  onAdd,
  onRemove,
}: InternalAssetVendorLabelListEditorProps) {
  return (
    <div className="v5-field">
      <span className="v5-field__label">{label}</span>
      <span className="v5-status v5-status--muted" style={{ display: "block", marginBottom: 8 }}>
        {hint}
      </span>
      <form
        className="v5-actions"
        style={{ marginBottom: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <input
          type="text"
          className="v5-input v5-input--sm"
          value={labelDraft}
          disabled={disabled}
          onChange={(event) => onLabelDraftChange(event.target.value)}
          aria-label="Vendor or SaaS label"
          placeholder="Corporate VPN"
        />
        <input
          type="text"
          className="v5-input v5-input--sm"
          value={patternDraft}
          disabled={disabled}
          onChange={(event) => onPatternDraftChange(event.target.value)}
          aria-label="Vendor hostname pattern"
          placeholder="*.okta.com or vpn.corp.example"
        />
        <button
          type="submit"
          className="v5-btn v5-btn--primary"
          disabled={disabled}
          aria-label="Add vendor or SaaS label"
        >
          Add
        </button>
      </form>
      {entries.length === 0 ? (
        <span className="v5-status v5-status--muted">No entries yet.</span>
      ) : (
        <ul className="v5-domain-list" aria-label={`${label} entries`}>
          {entries.map((entry) => (
            <li key={`${entry.label}::${entry.pattern}`} className="v5-domain-list__item">
              <code>
                {entry.label} ({entry.pattern})
              </code>
              <button
                type="button"
                className="v5-btn v5-btn--link"
                disabled={disabled}
                onClick={() => onRemove(entry)}
                aria-label={`Remove ${entry.label} from ${label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ApiKeyFieldState = {
  configured: boolean;
  editing: boolean;
  draft: string;
  maskedPreview: string;
};

type ApiKeyFieldProps = {
  slot: ApiKeySlot;
  label: string;
  ready: boolean;
  fieldState: ApiKeyFieldState;
  onDraftChange: (slot: ApiKeySlot, draft: string) => void;
  onEditingChange: (slot: ApiKeySlot, editing: boolean) => void;
  onPersist: (slot: ApiKeySlot, value: string) => Promise<void>;
  onSaved: (slot: ApiKeySlot, value: string) => void;
};

function ApiKeyField({
  slot,
  label,
  ready,
  fieldState,
  onDraftChange,
  onEditingChange,
  onPersist,
  onSaved,
}: ApiKeyFieldProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [revealed, setRevealed] = useState(false);
  const latestDraftRef = useRef(fieldState.draft);
  const latestEditingRef = useRef(fieldState.editing);
  const latestConfiguredRef = useRef(fieldState.configured);

  latestDraftRef.current = fieldState.draft;
  latestEditingRef.current = fieldState.editing;
  latestConfiguredRef.current = fieldState.configured;

  useEffect(() => {
    return () => {
      const trimmed = latestDraftRef.current.trim();
      if (!trimmed || isMaskedApiKeyDisplay(trimmed)) {
        return;
      }
      if (latestConfiguredRef.current && !latestEditingRef.current) {
        return;
      }
      void onPersist(slot, trimmed);
    };
  }, [slot, onPersist]);

  const displayValue = fieldState.editing
    ? fieldState.draft
    : fieldState.configured
      ? fieldState.maskedPreview
      : fieldState.draft;

  const handleFocus = () => {
    if (!ready) {
      return;
    }
    if (fieldState.configured && !fieldState.editing) {
      onEditingChange(slot, true);
      onDraftChange(slot, "");
      setSaveState("idle");
      return;
    }
    if (!fieldState.editing) {
      onEditingChange(slot, true);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!ready) {
      return;
    }

    if (fieldState.configured && !fieldState.editing) {
      return;
    }

    const trimmed = event.currentTarget.value.trim();

    if (!trimmed) {
      if (fieldState.editing) {
        onEditingChange(slot, false);
        onDraftChange(slot, "");
      }
      return;
    }

    if (isMaskedApiKeyDisplay(trimmed)) {
      return;
    }

    setSaveState("saving");
    void onPersist(slot, trimmed)
      .then(() => {
        onSaved(slot, trimmed);
        setSaveState("saved");
      })
      .catch(() => {
        setSaveState("error");
      });
  };

  const handleChange = (value: string) => {
    onDraftChange(slot, value);
    if (!fieldState.editing && value.trim().length > 0) {
      onEditingChange(slot, true);
    }
  };

  return (
    <label className="v5-field">
      <span
        className="v5-field__label"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{label} API key</span>
        {fieldState.configured && !fieldState.editing ? (
          <span className="v5-badge v5-badge--on">
            <span className="v5-badge__dot" />
            Key saved
          </span>
        ) : (
          <span className="v5-badge v5-badge--off">No key</span>
        )}
      </span>
      <span className="v5-key">
        <input
          className="v5-input v5-input--mono"
          type={revealed ? "text" : "password"}
          name={`api-key-${slot}`}
          value={displayValue}
          disabled={!ready}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            fieldState.configured && !fieldState.editing
              ? "Click to replace the saved key"
              : "Paste your API key"
          }
          onFocus={handleFocus}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          aria-label={`${label} API key`}
        />
        <button
          type="button"
          className="v5-key__toggle"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? `Hide ${label} API key` : `Show ${label} API key`}
          aria-pressed={revealed}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </span>
      {fieldState.configured && !fieldState.editing ? (
        <span className="v5-status v5-status--muted">
          Key saved. Only the last four characters are shown.
        </span>
      ) : null}
      {saveState === "saved" ? (
        <span className="v5-status v5-status--success" role="status">
          <CheckIcon />
          Saved locally.
        </span>
      ) : null}
      {saveState === "error" ? (
        <span className="v5-status v5-status--error" role="status">
          Could not save this key. Try again.
        </span>
      ) : null}
    </label>
  );
}

function createEmptyFieldState(): ApiKeyFieldState {
  return {
    configured: false,
    editing: false,
    draft: "",
    maskedPreview: "",
  };
}

function createEmptyApiKeyFieldStates(): Record<ApiKeySlot, ApiKeyFieldState> {
  return Object.fromEntries(
    API_KEY_FIELD_SLOTS.map((slot) => [slot, createEmptyFieldState()])
  ) as Record<ApiKeySlot, ApiKeyFieldState>;
}

export function Options() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const settingsPackImportInputRef = useRef<HTMLInputElement>(null);
  const threatProfileImportInputRef = useRef<HTMLInputElement>(null);
  const noiseRulesImportInputRef = useRef<HTMLInputElement>(null);
  const operatorMacroPackImportInputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => ({
    overview: true,
    scanning: true,
    indicators: true,
    "private-ipv4": true,
    sources: true,
    pivots: true,
    "local-ai-summary": true,
    trust: true,
    "operator-macros": true,
    cache: true,
    correlation: true,
    "relationship-memory": true,
    "noise-rules": true,
    "known-good": true,
    backup: true,
    "api-keys": true,
  }));
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const [autoScanEnabled, setAutoScanEnabledState] = useState(false);
  const [manualOnlyMode, setManualOnlyModeState] = useState(true);
  const [quietModeActive, setQuietModeActiveState] = useState(false);
  const [enrichmentSourceEnabled, setEnrichmentSourceEnabledState] =
    useState<EnrichmentSourceEnabledRecord>(createDefaultSourceEnabledState());
  const [pivotContextMenuCategoryEnabled, setPivotContextMenuCategoryEnabledState] =
    useState<PivotContextMenuCategoryEnabledRecord>(
      createDefaultPivotContextMenuCategoryEnabledRecord()
    );
  const [pivotContextMenuSiteEnabled, setPivotContextMenuSiteEnabledState] =
    useState<PivotContextMenuSiteEnabledRecord>(createDefaultPivotContextMenuSiteEnabledRecord());
  const [iocTypeEnabled, setIocTypeEnabledState] = useState<IocTypeEnabledRecord>(
    createDefaultIocTypeEnabledState()
  );
  const [includePrivateIpv4, setIncludePrivateIpv4State] = useState(false);
  const [hideSuppressedFromScan, setHideSuppressedFromScanState] = useState(
    HIDE_SUPPRESSED_FROM_SCAN_DEFAULT
  );
  const [skipEnrichOnKnownGoodMatch, setSkipEnrichOnKnownGoodMatchState] = useState(
    SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_DEFAULT
  );
  const [localBackendEnabled, setLocalBackendEnabledState] = useState(false);
  const [localLlmSummaryEnabled, setLocalLlmSummaryEnabledState] = useState(false);
  const [attributeHrefExtractionEnabled, setAttributeHrefExtractionEnabledState] = useState(false);
  const [
    attributeHrefExtractionConsentAcknowledged,
    setAttributeHrefExtractionConsentAcknowledgedState,
  ] = useState(false);
  const [showAttributeHrefConsentDialog, setShowAttributeHrefConsentDialog] = useState(false);
  const [rememberSiteChoicesOnConfirm, setRememberSiteChoicesOnConfirm] = useState(false);
  const [
    attributeHrefExtractionRememberSiteChoices,
    setAttributeHrefExtractionRememberSiteChoicesState,
  ] = useState(false);
  const [attributeHrefExtractionSitePreferences, setAttributeHrefExtractionSitePreferencesState] =
    useState<AttributeHrefSitePreferencesRecord>({});
  const [attributeHrefSitePreferenceHostDraft, setAttributeHrefSitePreferenceHostDraft] =
    useState("");
  const [attributeHrefSitePreferenceModeDraft, setAttributeHrefSitePreferenceModeDraft] =
    useState<AttributeHrefSitePreference>("off");
  const [pageContextSiteModeOverrides, setPageContextSiteModeOverridesState] =
    useState<PageContextSiteModeOverridesRecord>({});
  const [pageContextSiteModeOverrideHostDraft, setPageContextSiteModeOverrideHostDraft] =
    useState("");
  const [pageContextSiteModeOverrideTypeDraft, setPageContextSiteModeOverrideTypeDraft] =
    useState<PageContextType>(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
  const [activeTabPageContextOverrideHost, setActiveTabPageContextOverrideHost] = useState<
    string | null
  >(null);
  const [showDisabledSourcesInWorkspace, setShowDisabledSourcesInWorkspaceState] = useState(false);
  const [showPreQueryNotices, setShowPreQueryNoticesState] = useState(true);
  const [, setPreQueryNoticePreferenceConfiguredState] = useState(false);
  const [installQuickStartCompleted, setInstallQuickStartCompletedState] = useState(true);
  const [quickStartStep, setQuickStartStep] = useState<InstallQuickStartStep>(0);
  const [domainPolicyMode, setDomainPolicyModeState] = useState<DomainPolicyMode>(
    DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
  );
  const [domainAllowlist, setDomainAllowlistState] = useState<string[]>([]);
  const [domainDenylist, setDomainDenylistState] = useState<string[]>([]);
  const [domainPolicyEnrichGateEnabled, setDomainPolicyEnrichGateEnabledState] = useState(true);
  const [internalAssetEnrichGateEnabled, setInternalAssetEnrichGateEnabledState] = useState(true);
  const [internalAssetDomains, setInternalAssetDomainsState] = useState<string[]>([]);
  const [internalAssetCidrRanges, setInternalAssetCidrRangesState] = useState<string[]>([]);
  const [internalAssetVendorLabels, setInternalAssetVendorLabelsState] = useState<
    InternalAssetVendorLabelEntry[]
  >([]);
  const [internalAssetDomainDraft, setInternalAssetDomainDraft] = useState("");
  const [internalAssetCidrDraft, setInternalAssetCidrDraft] = useState("");
  const [internalAssetVendorLabelDraft, setInternalAssetVendorLabelDraft] = useState("");
  const [internalAssetVendorPatternDraft, setInternalAssetVendorPatternDraft] = useState("");
  const [analystModePresetId, setAnalystModePresetIdState] = useState("");
  const [allowlistDraft, setAllowlistDraft] = useState("");
  const [denylistDraft, setDenylistDraft] = useState("");
  const [globalCacheTtlSeconds, setGlobalCacheTtlSecondsState] = useState(
    String(DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS)
  );
  const [sourceCacheTtlDrafts, setSourceCacheTtlDraftsState] = useState<
    Record<EnrichmentSourceId, string>
  >(createDefaultSourceCacheTtlDrafts());
  const [includeApiKeysInExport, setIncludeApiKeysInExport] = useState(false);
  const [clearCacheState, setClearCacheState] = useState<"idle" | "clearing" | "cleared" | "error">(
    "idle"
  );
  const [correlationRetentionDays, setCorrelationRetentionDays] = useState(
    String(DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS)
  );
  const [correlationOverlapMode, setCorrelationOverlapMode] =
    useState<CorrelationOverlapModeDraft>("off");
  const [correlationJaccardThreshold, setCorrelationJaccardThreshold] = useState(
    String(DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD)
  );
  const [correlationMinSharedCount, setCorrelationMinSharedCount] = useState(
    String(DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT)
  );
  const [correlationClusterCount, setCorrelationClusterCount] = useState(0);
  const [clearCorrelationClustersState, setClearCorrelationClustersState] = useState<
    "idle" | "clearing" | "cleared" | "error"
  >("idle");
  const [relationshipRetentionDays, setRelationshipRetentionDays] = useState(
    String(DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS)
  );
  const [relationshipEdgeCount, setRelationshipEdgeCount] = useState(0);
  const [clearRelationshipEdgesState, setClearRelationshipEdgesState] = useState<
    "idle" | "clearing" | "cleared" | "error"
  >("idle");
  const [noiseRules, setNoiseRules] = useState<NoiseRule[]>([]);
  const [noiseRulesExportState, setNoiseRulesExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [noiseRulesImportState, setNoiseRulesImportState] = useState<
    "idle" | "importing" | "imported" | "error"
  >("idle");
  const [noiseRulesImportStatus, setNoiseRulesImportStatus] = useState<string | null>(null);
  const [noiseRulesImportDraft, setNoiseRulesImportDraft] = useState<{
    raw: string;
    format: NoiseRulesImportFormat;
  } | null>(null);
  const [noiseRulesImportMergeMode, setNoiseRulesImportMergeMode] =
    useState<NoiseRulesImportMergeMode>(NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY);
  const [noiseRulesImportPreview, setNoiseRulesImportPreview] =
    useState<NoiseRulesImportPreview | null>(null);
  const [noiseRulesReplaceConfirmed, setNoiseRulesReplaceConfirmed] = useState(false);
  const [clearNoiseRulesState, setClearNoiseRulesState] = useState<
    "idle" | "clearing" | "cleared" | "error"
  >("idle");
  const [focusedNoiseRuleId, setFocusedNoiseRuleId] = useState<string | null>(null);
  const [focusedKnownGoodEntryId, setFocusedKnownGoodEntryId] = useState<string | null>(null);
  const [noiseRulesSearchQuery, setNoiseRulesSearchQuery] = useState("");
  const [knownGoodEntries, setKnownGoodEntries] = useState<KnownGoodEntry[]>([]);
  const [knownGoodCategoryEnabled, setKnownGoodCategoryEnabled] =
    useState<KnownGoodCategoryEnabledRecord>(createDefaultKnownGoodCategoryEnabled);
  const [knownGoodExportState, setKnownGoodExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [knownGoodManageStatus, setKnownGoodManageStatus] = useState<string | null>(null);
  const [editingKnownGoodEntryId, setEditingKnownGoodEntryId] = useState<string | null>(null);
  const [knownGoodEditDraft, setKnownGoodEditDraft] = useState<{
    category: KnownGoodCategory;
    matchType: KnownGoodMatchType;
    pattern: string;
    labelText: string;
  } | null>(null);
  const [editingNoiseRuleId, setEditingNoiseRuleId] = useState<string | null>(null);
  const [noiseRuleEditDraft, setNoiseRuleEditDraft] = useState<{
    patternType: NoiseRulePatternType;
    pattern: string;
    sourceAction: NoiseRuleSourceAction;
  } | null>(null);
  const [noiseRuleManageStatus, setNoiseRuleManageStatus] = useState<string | null>(null);
  const [noiseRuleSampleAlertPreview, setNoiseRuleSampleAlertPreview] =
    useState<NoiseRuleSampleAlertMatchPreview | null>(null);
  const [lastLearnedNoiseRuleUndo, setLastLearnedNoiseRuleUndo] = useState<NoiseRule | null>(null);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "exported" | "error">(
    "idle"
  );
  const [settingsPackExportState, setSettingsPackExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [threatProfileExportState, setThreatProfileExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [threatProfileImportState, setThreatProfileImportState] = useState<
    "idle" | "importing" | "imported" | "error"
  >("idle");
  const [threatProfileImportPreview, setThreatProfileImportPreview] =
    useState<ThreatProfileImportPreview | null>(null);
  const [threatProfileImportRawJson, setThreatProfileImportRawJson] = useState<string | null>(null);
  const [threatProfileImportMergeMode, setThreatProfileImportMergeMode] =
    useState<ThreatProfileImportMergeMode>(THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT);
  const [activeThreatProfileState, setActiveThreatProfileState] =
    useState<ActiveThreatProfileState>(createEmptyActiveThreatProfileState);
  const [settingsPackImportPreview, setSettingsPackImportPreview] =
    useState<SettingsPackImportPreview | null>(null);
  const [settingsPackImportRawJson, setSettingsPackImportRawJson] = useState<string | null>(null);
  const [settingsPackImportState, setSettingsPackImportState] = useState<
    "idle" | "importing" | "imported" | "error"
  >("idle");
  const [importState, setImportState] = useState<"idle" | "importing" | "imported" | "error">(
    "idle"
  );
  const [fieldStates, setFieldStates] = useState<Record<ApiKeySlot, ApiKeyFieldState>>(
    createEmptyApiKeyFieldStates()
  );
  const [operatorMacros, setOperatorMacros] = useState<OperatorMacro[]>([]);
  const [operatorMacroEditorMode, setOperatorMacroEditorMode] = useState<"create" | "edit" | null>(
    null
  );
  const [operatorMacroEditorTargetId, setOperatorMacroEditorTargetId] = useState<string | null>(
    null
  );
  const [operatorMacroEditorDraft, setOperatorMacroEditorDraft] =
    useState<OperatorMacroEditorDraft>(createEmptyOperatorMacroEditorDraft());
  const [operatorMacroEditorError, setOperatorMacroEditorError] = useState<string | null>(null);
  const [operatorMacroActionState, setOperatorMacroActionState] = useState<
    "idle" | "busy" | "error"
  >("idle");
  const [operatorMacroFeedback, setOperatorMacroFeedback] = useState<string | null>(null);
  const [operatorMacroPackExportState, setOperatorMacroPackExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [operatorMacroPackImportPreview, setOperatorMacroPackImportPreview] =
    useState<OperatorMacroPackImportPreview | null>(null);
  const [operatorMacroPackImportRawJson, setOperatorMacroPackImportRawJson] = useState<
    string | null
  >(null);
  const [operatorMacroPackImportState, setOperatorMacroPackImportState] = useState<
    "idle" | "importing" | "imported" | "error"
  >("idle");

  const reloadOperatorMacros = async (): Promise<void> => {
    await ensureBuiltInOperatorMacros();
    const macros = await listStoredOperatorMacros();
    setOperatorMacros(macros);
  };

  useEffect(() => {
    void reloadOperatorMacros().catch(() => {
      setOperatorMacros([]);
    });
  }, [settingsReloadToken]);

  useEffect(() => {
    void getCorrelationClustersStore()
      .then((store) => {
        setCorrelationRetentionDays(String(store.retentionDays));
        setCorrelationClusterCount(store.clusters.length);
        if (store.overlapMerge === null) {
          setCorrelationOverlapMode("off");
          setCorrelationJaccardThreshold(String(DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD));
          setCorrelationMinSharedCount(String(DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT));
          return;
        }
        setCorrelationOverlapMode(store.overlapMerge.mode);
        setCorrelationJaccardThreshold(
          String(
            store.overlapMerge.jaccardThreshold ?? DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD
          )
        );
        setCorrelationMinSharedCount(
          String(
            store.overlapMerge.minSharedIocCount ?? DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT
          )
        );
      })
      .catch(() => {
        setCorrelationRetentionDays(String(DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS));
        setCorrelationOverlapMode("off");
        setCorrelationClusterCount(0);
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    void getRelationshipEdgesStore()
      .then((store) => {
        setRelationshipRetentionDays(String(store.retentionDays));
        setRelationshipEdgeCount(store.edges.length);
      })
      .catch(() => {
        setRelationshipRetentionDays(String(DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS));
        setRelationshipEdgeCount(0);
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    void Promise.all([listStoredNoiseRules(), getStoredLastLearnedNoiseRuleUndo()])
      .then(([rules, undoRule]) => {
        setNoiseRules(rules);
        setLastLearnedNoiseRuleUndo(undoRule);
      })
      .catch(() => {
        setNoiseRules([]);
        setLastLearnedNoiseRuleUndo(null);
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    void getKnownGoodListStore()
      .then((store) => {
        setKnownGoodEntries(store.entries);
        setKnownGoodCategoryEnabled(store.categoryEnabled);
      })
      .catch(() => {
        setKnownGoodEntries([]);
        setKnownGoodCategoryEnabled(createDefaultKnownGoodCategoryEnabled());
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    void getActiveThreatProfileState()
      .then((state) => {
        setActiveThreatProfileState(state);
      })
      .catch(() => {
        setActiveThreatProfileState(createEmptyActiveThreatProfileState());
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return;
    }
    const noiseParsed = parseNoiseRulesOptionsHash(window.location.hash);
    if (noiseParsed) {
      setActiveSection(NOISE_RULES_OPTIONS_SECTION_ID);
      setCollapsedSections((prev) => ({
        ...prev,
        [NOISE_RULES_OPTIONS_SECTION_ID]: false,
      }));
      setFocusedNoiseRuleId(noiseParsed.ruleId);
      scrollToSection(NOISE_RULES_OPTIONS_SECTION_ID);
      return;
    }
    const knownGoodParsed = parseKnownGoodOptionsHash(window.location.hash);
    if (!knownGoodParsed) {
      return;
    }
    setActiveSection(KNOWN_GOOD_OPTIONS_SECTION_ID);
    setCollapsedSections((prev) => ({
      ...prev,
      [KNOWN_GOOD_OPTIONS_SECTION_ID]: false,
    }));
    setFocusedKnownGoodEntryId(knownGoodParsed.entryId);
    scrollToSection(KNOWN_GOOD_OPTIONS_SECTION_ID);
  }, [ready]);

  useEffect(() => {
    if (!ready || !focusedNoiseRuleId || typeof document === "undefined") {
      return;
    }
    const target = document.querySelector(
      `[data-noise-rule-id="${CSS.escape(focusedNoiseRuleId)}"]`
    );
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const behavior: ScrollBehavior =
      typeof window !== "undefined" && prefersReducedMotion(window) ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "nearest" });
  }, [ready, focusedNoiseRuleId, noiseRules]);

  useEffect(() => {
    if (!ready || !focusedKnownGoodEntryId || typeof document === "undefined") {
      return;
    }
    const target = document.querySelector(
      `[data-known-good-entry-id="${CSS.escape(focusedKnownGoodEntryId)}"]`
    );
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const behavior: ScrollBehavior =
      typeof window !== "undefined" && prefersReducedMotion(window) ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "nearest" });
    target.classList.add("v5-domain-list__item--noise-rule-focus");
  }, [ready, focusedKnownGoodEntryId, knownGoodEntries]);

  useEffect(() => {
    void Promise.all([getPivotContextMenuCategoryEnabled(), getPivotContextMenuSiteEnabled()]).then(
      ([categoryEnabledValue, siteEnabledValue]) => {
        setPivotContextMenuCategoryEnabledState(categoryEnabledValue);
        setPivotContextMenuSiteEnabledState(siteEnabledValue);
      }
    );
  }, [settingsReloadToken]);

  useEffect(() => {
    setReady(false);
    void Promise.all([
      getAutoScanEnabled(),
      getManualOnlyMode(),
      getQuietMode(),
      getEnrichmentSourceEnabled(),
      getIocTypeEnabled(),
      getIncludePrivateIpv4(),
      getHideSuppressedFromScan(),
      getSkipEnrichOnKnownGoodMatch(),
      getLocalBackendEnabled(),
      getLocalLlmSummaryEnabled(),
      getAttributeHrefExtractionEnabled(),
      getAttributeHrefExtractionConsentAcknowledged(),
      getAttributeHrefExtractionRememberSiteChoices(),
      getAttributeHrefExtractionSitePreferences(),
      getPageContextSiteModeOverrides(),
      getShowDisabledSourcesInWorkspace(),
      getShowPreQueryNotices(),
      getPreQueryNoticePreferenceConfigured(),
      getInstallQuickStartCompleted(),
      getDomainPolicyMode(),
      getDomainAllowlist(),
      getDomainDenylist(),
      getDomainPolicyEnrichGateEnabled(),
      getInternalAssetEnrichGateEnabled(),
      getInternalAssetDomains(),
      getInternalAssetCidrRanges(),
      getInternalAssetVendorLabels(),
      getAnalystModePresetId(),
      getEnrichmentCacheTtlSecondsFromSettings(),
      getEnrichmentSourceCacheTtlSeconds(),
      ...API_KEY_FIELD_SLOTS.map(async (slot) => {
        const configured = await hasApiKey(slot);
        if (!configured) {
          return [slot, createEmptyFieldState()] as const;
        }

        const storedKey = await getApiKey(slot);
        return [
          slot,
          {
            configured: true,
            editing: false,
            draft: "",
            maskedPreview: maskApiKeyForDisplay(storedKey),
          },
        ] as const;
      }),
    ])
      .then(
        ([
          autoScanValue,
          manualOnlyValue,
          quietModeValue,
          sourceEnabledValue,
          iocTypeEnabledValue,
          includePrivateIpv4Value,
          hideSuppressedFromScanValue,
          skipEnrichOnKnownGoodMatchValue,
          localBackendEnabledValue,
          localLlmSummaryEnabledValue,
          attributeHrefExtractionEnabledValue,
          attributeHrefExtractionConsentAcknowledgedValue,
          attributeHrefExtractionRememberSiteChoicesValue,
          attributeHrefExtractionSitePreferencesValue,
          pageContextSiteModeOverridesValue,
          showDisabledSourcesValue,
          showPreQueryNoticesValue,
          preQueryNoticePreferenceConfiguredValue,
          installQuickStartCompletedValue,
          domainPolicyModeValue,
          domainAllowlistValue,
          domainDenylistValue,
          domainPolicyEnrichGateEnabledValue,
          internalAssetEnrichGateEnabledValue,
          internalAssetDomainsValue,
          internalAssetCidrRangesValue,
          internalAssetVendorLabelsValue,
          analystModePresetIdValue,
          globalCacheTtlValue,
          sourceCacheTtlValue,
          ...entries
        ]) => {
          setAutoScanEnabledState(autoScanValue);
          setManualOnlyModeState(manualOnlyValue);
          setQuietModeActiveState(quietModeValue);
          setEnrichmentSourceEnabledState(sourceEnabledValue);
          setIocTypeEnabledState(iocTypeEnabledValue);
          setIncludePrivateIpv4State(includePrivateIpv4Value);
          setHideSuppressedFromScanState(hideSuppressedFromScanValue);
          setSkipEnrichOnKnownGoodMatchState(skipEnrichOnKnownGoodMatchValue);
          setLocalBackendEnabledState(localBackendEnabledValue);
          setLocalLlmSummaryEnabledState(localLlmSummaryEnabledValue);
          setAttributeHrefExtractionEnabledState(attributeHrefExtractionEnabledValue);
          setAttributeHrefExtractionConsentAcknowledgedState(
            attributeHrefExtractionConsentAcknowledgedValue
          );
          setAttributeHrefExtractionRememberSiteChoicesState(
            attributeHrefExtractionRememberSiteChoicesValue
          );
          setAttributeHrefExtractionSitePreferencesState(
            attributeHrefExtractionSitePreferencesValue
          );
          setPageContextSiteModeOverridesState(pageContextSiteModeOverridesValue);
          setShowDisabledSourcesInWorkspaceState(showDisabledSourcesValue);
          setShowPreQueryNoticesState(showPreQueryNoticesValue);
          setPreQueryNoticePreferenceConfiguredState(preQueryNoticePreferenceConfiguredValue);
          setInstallQuickStartCompletedState(installQuickStartCompletedValue);
          setDomainPolicyModeState(domainPolicyModeValue);
          setDomainAllowlistState(domainAllowlistValue);
          setDomainDenylistState(domainDenylistValue);
          setDomainPolicyEnrichGateEnabledState(domainPolicyEnrichGateEnabledValue);
          setInternalAssetEnrichGateEnabledState(internalAssetEnrichGateEnabledValue);
          setInternalAssetDomainsState(internalAssetDomainsValue);
          setInternalAssetCidrRangesState(internalAssetCidrRangesValue);
          setInternalAssetVendorLabelsState(internalAssetVendorLabelsValue);
          setAnalystModePresetIdState(analystModePresetIdValue);
          setGlobalCacheTtlSecondsState(String(globalCacheTtlValue));
          setSourceCacheTtlDraftsState(formatSourceCacheTtlDrafts(sourceCacheTtlValue));
          setFieldStates(Object.fromEntries(entries) as Record<ApiKeySlot, ApiKeyFieldState>);
          setReady(true);
        }
      )
      .catch(() => {
        setReady(true);
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    if (!ready || typeof chrome === "undefined" || !chrome.tabs?.query) {
      return;
    }

    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const host = tab?.url ? normalizePageContextSiteModeOverrideHost(tab.url) : "";
      setActiveTabPageContextOverrideHost(host.length > 0 ? host : null);
    });
  }, [ready, pageContextSiteModeOverrides]);

  useEffect(() => {
    if (
      !ready ||
      showAttributeHrefConsentDialog ||
      !attributeHrefExtractionEnabled ||
      attributeHrefExtractionConsentAcknowledged
    ) {
      return;
    }
    setShowAttributeHrefConsentDialog(true);
  }, [
    ready,
    showAttributeHrefConsentDialog,
    attributeHrefExtractionEnabled,
    attributeHrefExtractionConsentAcknowledged,
  ]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof document === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (observerEntries) => {
        const visible = observerEntries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
    );
    for (const section of NAV_SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, []);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setCollapsedSections((prev) => (id in prev ? { ...prev, [id]: false } : prev));
    scrollToSection(id);
  };

  const handleAutoScanToggle = (checked: boolean) => {
    setAutoScanEnabledState(checked);
    void setAutoScanEnabled(checked);
  };

  const handleManualOnlyToggle = (checked: boolean) => {
    setManualOnlyModeState(checked);
    void setManualOnlyMode(checked);
  };

  const handleQuietModeToggle = (checked: boolean) => {
    setQuietModeActiveState(checked);
    void setQuietMode(checked);
  };

  const handleSourceToggle = (sourceId: EnrichmentSourceId, checked: boolean) => {
    setEnrichmentSourceEnabledState((current) => ({
      ...current,
      [sourceId]: checked,
    }));
    void setEnrichmentSourceEnabled(sourceId, checked);
  };

  const handlePivotContextMenuCategoryToggle = (
    sourceClass: ConnectorSourceClass,
    checked: boolean
  ) => {
    setPivotContextMenuCategoryEnabledState((current) => ({
      ...current,
      [sourceClass]: checked,
    }));
    void setPivotContextMenuCategoryEnabled(sourceClass, checked);
  };

  const handlePivotContextMenuSiteToggle = (provider: PivotProvider, checked: boolean) => {
    setPivotContextMenuSiteEnabledState((current) => ({
      ...current,
      [provider]: checked,
    }));
    void setPivotContextMenuSiteEnabled(provider, checked);
  };

  const handleIocTypeToggle = (iocType: IocType, checked: boolean) => {
    setIocTypeEnabledState((current) => ({
      ...current,
      [iocType]: checked,
    }));
    void setIocTypeEnabled(iocType, checked);
  };

  const handleIncludePrivateIpv4Toggle = (checked: boolean) => {
    setIncludePrivateIpv4State(checked);
    void setIncludePrivateIpv4(checked);
  };

  const handleHideSuppressedFromScanToggle = (checked: boolean) => {
    setHideSuppressedFromScanState(checked);
    void setHideSuppressedFromScan(checked);
  };

  const handleSkipEnrichOnKnownGoodMatchToggle = (checked: boolean) => {
    setSkipEnrichOnKnownGoodMatchState(checked);
    void setSkipEnrichOnKnownGoodMatch(checked);
  };

  const handleLocalBackendToggle = (checked: boolean) => {
    setLocalBackendEnabledState(checked);
    void setLocalBackendEnabled(checked);
  };

  const handleLocalLlmSummaryToggle = (checked: boolean) => {
    setLocalLlmSummaryEnabledState(checked);
    void setLocalLlmSummaryEnabled(checked);
  };

  const handleAttributeHrefExtractionToggle = (checked: boolean) => {
    if (!checked) {
      setAttributeHrefExtractionEnabledState(false);
      void setAttributeHrefExtractionEnabled(false);
      return;
    }
    if (attributeHrefExtractionConsentAcknowledged) {
      setAttributeHrefExtractionEnabledState(true);
      void setAttributeHrefExtractionEnabled(true);
      return;
    }
    setShowAttributeHrefConsentDialog(true);
  };

  const handleAttributeHrefConsentCancel = () => {
    setShowAttributeHrefConsentDialog(false);
    setRememberSiteChoicesOnConfirm(false);
    setAttributeHrefExtractionEnabledState(false);
    void setAttributeHrefExtractionEnabled(false);
  };

  const handleAttributeHrefConsentConfirm = () => {
    setShowAttributeHrefConsentDialog(false);
    setAttributeHrefExtractionConsentAcknowledgedState(true);
    setAttributeHrefExtractionEnabledState(true);
    void setAttributeHrefExtractionConsentAcknowledged(true);
    void setAttributeHrefExtractionEnabled(true);
    if (rememberSiteChoicesOnConfirm) {
      setAttributeHrefExtractionRememberSiteChoicesState(true);
      void setAttributeHrefExtractionRememberSiteChoices(true);
    }
    setRememberSiteChoicesOnConfirm(false);
  };

  const handleAttributeHrefRememberSiteChoicesToggle = (checked: boolean) => {
    setAttributeHrefExtractionRememberSiteChoicesState(checked);
    void setAttributeHrefExtractionRememberSiteChoices(checked);
  };

  const handleAddAttributeHrefSitePreference = () => {
    const host = normalizeDomainPolicyEntry(attributeHrefSitePreferenceHostDraft);
    if (!host || attributeHrefExtractionSitePreferences[host]) {
      setAttributeHrefSitePreferenceHostDraft("");
      return;
    }
    const next = {
      ...attributeHrefExtractionSitePreferences,
      [host]: attributeHrefSitePreferenceModeDraft,
    };
    setAttributeHrefExtractionSitePreferencesState(next);
    setAttributeHrefSitePreferenceHostDraft("");
    void setAttributeHrefExtractionSitePreferences(next);
  };

  const handleRemoveAttributeHrefSitePreference = (host: string) => {
    const next = { ...attributeHrefExtractionSitePreferences };
    delete next[host];
    setAttributeHrefExtractionSitePreferencesState(next);
    void setAttributeHrefExtractionSitePreferences(next);
  };

  const handleAddPageContextSiteModeOverride = () => {
    const host = normalizePageContextSiteModeOverrideHost(pageContextSiteModeOverrideHostDraft);
    if (!host || pageContextSiteModeOverrides[host]) {
      setPageContextSiteModeOverrideHostDraft("");
      return;
    }
    const next = {
      ...pageContextSiteModeOverrides,
      [host]: pageContextSiteModeOverrideTypeDraft,
    };
    setPageContextSiteModeOverridesState(next);
    setPageContextSiteModeOverrideHostDraft("");
    void setPageContextSiteModeOverrides(next);
  };

  const handleRemovePageContextSiteModeOverride = (host: string) => {
    const next = { ...pageContextSiteModeOverrides };
    delete next[host];
    setPageContextSiteModeOverridesState(next);
    void setPageContextSiteModeOverrides(next);
  };

  const handleClearAllPageContextSiteModeOverrides = () => {
    setPageContextSiteModeOverridesState({});
    void clearPageContextSiteModeOverrides();
  };

  const handleShowDisabledSourcesToggle = (checked: boolean) => {
    setShowDisabledSourcesInWorkspaceState(checked);
    void setShowDisabledSourcesInWorkspace(checked);
  };

  const handleShowPreQueryNoticesToggle = (checked: boolean) => {
    setShowPreQueryNoticesState(checked);
    setPreQueryNoticePreferenceConfiguredState(true);
    void setPreQueryNoticePreference(checked);
  };

  const handleDomainPolicyModeChange = (mode: DomainPolicyMode) => {
    setDomainPolicyModeState(mode);
    void setDomainPolicyMode(mode);
  };

  const handleDomainPolicyEnrichGateToggle = (checked: boolean) => {
    setDomainPolicyEnrichGateEnabledState(checked);
    void setDomainPolicyEnrichGateEnabled(checked);
  };

  const handleInternalAssetEnrichGateToggle = (checked: boolean) => {
    setInternalAssetEnrichGateEnabledState(checked);
    void setInternalAssetEnrichGateEnabled(checked);
  };

  const handleAddInternalAssetDomain = () => {
    const normalized = normalizeDomainPolicyEntry(internalAssetDomainDraft);
    if (!normalized || internalAssetDomains.includes(normalized)) {
      setInternalAssetDomainDraft("");
      return;
    }
    const next = [...internalAssetDomains, normalized];
    setInternalAssetDomainsState(next);
    setInternalAssetDomainDraft("");
    void setInternalAssetDomains(next);
  };

  const handleRemoveInternalAssetDomain = (entry: string) => {
    const next = internalAssetDomains.filter((item) => item !== entry);
    setInternalAssetDomainsState(next);
    void setInternalAssetDomains(next);
  };

  const handleAddInternalAssetCidr = () => {
    const normalized = normalizeInternalAssetCidrRange(internalAssetCidrDraft);
    if (!normalized || internalAssetCidrRanges.includes(normalized)) {
      setInternalAssetCidrDraft("");
      return;
    }
    const next = [...internalAssetCidrRanges, normalized];
    setInternalAssetCidrRangesState(next);
    setInternalAssetCidrDraft("");
    void setInternalAssetCidrRanges(next);
  };

  const handleRemoveInternalAssetCidr = (entry: string) => {
    const next = internalAssetCidrRanges.filter((item) => item !== entry);
    setInternalAssetCidrRangesState(next);
    void setInternalAssetCidrRanges(next);
  };

  const handleAddInternalAssetVendorLabel = () => {
    const label = internalAssetVendorLabelDraft.trim();
    const pattern = normalizeDomainPolicyEntry(internalAssetVendorPatternDraft);
    if (!label || !pattern) {
      setInternalAssetVendorLabelDraft("");
      setInternalAssetVendorPatternDraft("");
      return;
    }
    if (
      internalAssetVendorLabels.some((entry) => entry.label === label && entry.pattern === pattern)
    ) {
      setInternalAssetVendorLabelDraft("");
      setInternalAssetVendorPatternDraft("");
      return;
    }
    const next = [...internalAssetVendorLabels, { label, pattern }];
    setInternalAssetVendorLabelsState(next);
    setInternalAssetVendorLabelDraft("");
    setInternalAssetVendorPatternDraft("");
    void setInternalAssetVendorLabels(next);
  };

  const handleRemoveInternalAssetVendorLabel = (entry: InternalAssetVendorLabelEntry) => {
    const next = internalAssetVendorLabels.filter(
      (item) => !(item.label === entry.label && item.pattern === entry.pattern)
    );
    setInternalAssetVendorLabelsState(next);
    void setInternalAssetVendorLabels(next);
  };

  const handleApplyAnalystModePreset = (presetId: AnalystModePresetId) => {
    void applyAnalystModePreset(presetId).then(() => {
      setSettingsReloadToken((token) => token + 1);
    });
  };

  const handleAddAllowlistEntry = () => {
    const normalized = normalizeDomainPolicyEntry(allowlistDraft);
    if (!normalized || domainAllowlist.includes(normalized)) {
      setAllowlistDraft("");
      return;
    }
    const next = [...domainAllowlist, normalized];
    setDomainAllowlistState(next);
    setAllowlistDraft("");
    void setDomainAllowlist(next);
  };

  const handleRemoveAllowlistEntry = (entry: string) => {
    const next = domainAllowlist.filter((item) => item !== entry);
    setDomainAllowlistState(next);
    void setDomainAllowlist(next);
  };

  const handleAddDenylistEntry = () => {
    const normalized = normalizeDomainPolicyEntry(denylistDraft);
    if (!normalized || domainDenylist.includes(normalized)) {
      setDenylistDraft("");
      return;
    }
    const next = [...domainDenylist, normalized];
    setDomainDenylistState(next);
    setDenylistDraft("");
    void setDomainDenylist(next);
  };

  const handleRemoveDenylistEntry = (entry: string) => {
    const next = domainDenylist.filter((item) => item !== entry);
    setDomainDenylistState(next);
    void setDomainDenylist(next);
  };

  const handleOpenCreateOperatorMacro = () => {
    setOperatorMacroEditorMode("create");
    setOperatorMacroEditorTargetId(null);
    setOperatorMacroEditorDraft(createEmptyOperatorMacroEditorDraft());
    setOperatorMacroEditorError(null);
  };

  const handleOpenEditOperatorMacro = (macroId: string) => {
    const macro = operatorMacros.find((entry) => entry.id === macroId);
    if (!macro) {
      return;
    }
    setOperatorMacroEditorMode("edit");
    setOperatorMacroEditorTargetId(macro.id);
    setOperatorMacroEditorDraft(operatorMacroEditorDraftFromMacro(macro));
    setOperatorMacroEditorError(null);
  };

  const handleCloseOperatorMacroEditor = () => {
    setOperatorMacroEditorMode(null);
    setOperatorMacroEditorTargetId(null);
    setOperatorMacroEditorDraft(createEmptyOperatorMacroEditorDraft());
    setOperatorMacroEditorError(null);
  };

  const handleSaveOperatorMacroEditor = () => {
    const name = normalizeOperatorMacroName(operatorMacroEditorDraft.name);
    if (!name) {
      setOperatorMacroEditorError("Macro name is required.");
      return;
    }

    const triggers = operatorMacroEditorDraft.triggers;
    if (!triggers.palette && !triggers.tray && !triggers.context) {
      setOperatorMacroEditorError("Enable at least one trigger surface.");
      return;
    }

    const editorSteps = operatorMacroEditorDraft.steps.map(({ type, params }) => ({
      type,
      params,
    }));
    const stepsError = validateOperatorMacroEditorSteps(editorSteps);
    if (stepsError) {
      setOperatorMacroEditorError(stepsError);
      return;
    }

    let serializedSteps: OperatorMacroStep[];
    try {
      serializedSteps = serializeOperatorMacroEditorSteps(editorSteps);
    } catch {
      setOperatorMacroEditorError("Macro steps could not be saved.");
      return;
    }

    setOperatorMacroActionState("busy");
    setOperatorMacroEditorError(null);

    if (operatorMacroEditorMode === "create") {
      const id =
        normalizeOperatorMacroId(operatorMacroEditorDraft.id) ??
        suggestOperatorMacroIdFromName(name);
      if (!id) {
        setOperatorMacroActionState("error");
        setOperatorMacroEditorError(
          "Macro id must start with a letter and use lowercase letters, numbers, and hyphens only."
        );
        return;
      }
      if (operatorMacros.some((macro) => macro.id === id)) {
        setOperatorMacroActionState("error");
        setOperatorMacroEditorError("A macro with this id already exists.");
        return;
      }

      void createStoredOperatorMacro({
        id,
        name,
        steps: serializedSteps,
        triggers,
        metadata: {
          description: operatorMacroEditorDraft.description.trim(),
          builtIn: false,
        },
      })
        .then(async (created) => {
          if (!created) {
            setOperatorMacroActionState("error");
            setOperatorMacroEditorError("Macro could not be created.");
            return;
          }
          await reloadOperatorMacros();
          setOperatorMacroActionState("idle");
          setOperatorMacroFeedback(`Created macro ${created.name}.`);
          handleCloseOperatorMacroEditor();
        })
        .catch(() => {
          setOperatorMacroActionState("error");
          setOperatorMacroEditorError("Macro could not be created.");
        });
      return;
    }

    if (operatorMacroEditorMode !== "edit" || !operatorMacroEditorTargetId) {
      setOperatorMacroActionState("idle");
      return;
    }

    const existing = operatorMacros.find((macro) => macro.id === operatorMacroEditorTargetId);
    if (!existing || existing.metadata.builtIn) {
      setOperatorMacroActionState("error");
      setOperatorMacroEditorError("Macro could not be found.");
      return;
    }

    void saveStoredOperatorMacro({
      ...existing,
      name,
      steps: serializedSteps,
      triggers,
      metadata: {
        ...existing.metadata,
        description: operatorMacroEditorDraft.description.trim(),
        updatedAt: Date.now(),
      },
    })
      .then(async (saved) => {
        if (!saved) {
          setOperatorMacroActionState("error");
          setOperatorMacroEditorError("Macro could not be saved.");
          return;
        }
        await reloadOperatorMacros();
        setOperatorMacroActionState("idle");
        setOperatorMacroFeedback(`Saved macro ${name}.`);
        handleCloseOperatorMacroEditor();
      })
      .catch(() => {
        setOperatorMacroActionState("error");
        setOperatorMacroEditorError("Macro could not be saved.");
      });
  };

  const handleDuplicateOperatorMacro = (macroId: string) => {
    setOperatorMacroActionState("busy");
    setOperatorMacroFeedback(null);
    void duplicateStoredOperatorMacro(macroId)
      .then(async (duplicate) => {
        if (!duplicate) {
          setOperatorMacroActionState("error");
          setOperatorMacroFeedback("Macro could not be duplicated.");
          return;
        }
        await reloadOperatorMacros();
        setOperatorMacroActionState("idle");
        setOperatorMacroFeedback(`Duplicated macro as ${duplicate.name}.`);
      })
      .catch(() => {
        setOperatorMacroActionState("error");
        setOperatorMacroFeedback("Macro could not be duplicated.");
      });
  };

  const handleDeleteOperatorMacro = (macroId: string) => {
    setOperatorMacroActionState("busy");
    setOperatorMacroFeedback(null);
    void deleteStoredOperatorMacro(macroId)
      .then(async (deleted) => {
        if (!deleted) {
          setOperatorMacroActionState("error");
          setOperatorMacroFeedback("Macro could not be deleted.");
          return;
        }
        await reloadOperatorMacros();
        setOperatorMacroActionState("idle");
        setOperatorMacroFeedback("Macro deleted.");
      })
      .catch(() => {
        setOperatorMacroActionState("error");
        setOperatorMacroFeedback("Macro could not be deleted.");
      });
  };

  const persistOperatorMacroOrder = (nextMacros: OperatorMacro[]) => {
    setOperatorMacroActionState("busy");
    setOperatorMacroFeedback(null);
    void reorderStoredOperatorMacros(nextMacros.map((macro) => macro.id))
      .then(async (reordered) => {
        if (!reordered) {
          setOperatorMacroActionState("error");
          setOperatorMacroFeedback("Macro order could not be saved.");
          return;
        }
        await reloadOperatorMacros();
        setOperatorMacroActionState("idle");
      })
      .catch(() => {
        setOperatorMacroActionState("error");
        setOperatorMacroFeedback("Macro order could not be saved.");
      });
  };

  const handleMoveOperatorMacroUp = (macroId: string) => {
    const index = operatorMacros.findIndex((macro) => macro.id === macroId);
    if (index <= 0) {
      return;
    }
    const nextMacros = [...operatorMacros];
    const [entry] = nextMacros.splice(index, 1);
    if (!entry) {
      return;
    }
    nextMacros.splice(index - 1, 0, entry);
    setOperatorMacros(nextMacros);
    persistOperatorMacroOrder(nextMacros);
  };

  const handleMoveOperatorMacroDown = (macroId: string) => {
    const index = operatorMacros.findIndex((macro) => macro.id === macroId);
    if (index === -1 || index >= operatorMacros.length - 1) {
      return;
    }
    const nextMacros = [...operatorMacros];
    const [entry] = nextMacros.splice(index, 1);
    if (!entry) {
      return;
    }
    nextMacros.splice(index + 1, 0, entry);
    setOperatorMacros(nextMacros);
    persistOperatorMacroOrder(nextMacros);
  };

  const handleExportOperatorMacroPack = () => {
    setOperatorMacroPackExportState("exporting");
    setOperatorMacroFeedback(null);
    void exportUserOperatorMacroPackJson()
      .then((json) => {
        downloadOperatorMacroPackExport(json);
        setOperatorMacroPackExportState("exported");
        setOperatorMacroFeedback("Exported user macros.");
      })
      .catch(() => {
        setOperatorMacroPackExportState("error");
        setOperatorMacroFeedback("Macro pack could not be exported.");
        setOperatorMacroActionState("error");
      });
  };

  const handleOperatorMacroPackImportClick = () => {
    operatorMacroPackImportInputRef.current?.click();
  };

  const clearOperatorMacroPackImportPreview = () => {
    setOperatorMacroPackImportPreview(null);
    setOperatorMacroPackImportRawJson(null);
  };

  const handleOperatorMacroPackImportCancel = () => {
    clearOperatorMacroPackImportPreview();
    setOperatorMacroPackImportState("idle");
  };

  const handleOperatorMacroPackImportConfirm = () => {
    if (!operatorMacroPackImportRawJson) {
      return;
    }

    setOperatorMacroPackImportState("importing");
    setOperatorMacroActionState("busy");
    setOperatorMacroFeedback(null);
    void importUserOperatorMacroPackJson(operatorMacroPackImportRawJson)
      .then(async () => {
        clearOperatorMacroPackImportPreview();
        setOperatorMacroPackImportState("imported");
        setOperatorMacroActionState("idle");
        setOperatorMacroFeedback("Imported user macros.");
        await reloadOperatorMacros();
      })
      .catch(() => {
        setOperatorMacroPackImportState("error");
        setOperatorMacroActionState("error");
        setOperatorMacroFeedback("Macro pack could not be imported.");
      });
  };

  const handleOperatorMacroPackImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setOperatorMacroPackImportState("idle");
    setOperatorMacroActionState("idle");
    const reader = new FileReader();
    reader.onload = () => {
      const rawJson = typeof reader.result === "string" ? reader.result : "";
      try {
        const preview = buildOperatorMacroPackImportPreview(operatorMacros, rawJson);
        setOperatorMacroPackImportPreview(preview);
        setOperatorMacroPackImportRawJson(rawJson);
      } catch {
        clearOperatorMacroPackImportPreview();
        setOperatorMacroPackImportState("error");
        setOperatorMacroFeedback("Macro pack could not be imported.");
        setOperatorMacroActionState("error");
      }
    };
    reader.onerror = () => {
      clearOperatorMacroPackImportPreview();
      setOperatorMacroPackImportState("error");
      setOperatorMacroFeedback("Macro pack could not be imported.");
      setOperatorMacroActionState("error");
    };
    reader.readAsText(file);
  };

  const handleApplyDomainPolicyPreset = (presetId: string) => {
    const preset = getDomainPolicyPresetById(presetId);
    if (!preset) {
      return;
    }

    const applied = applyDomainPolicyPresetToLists({
      mode: domainPolicyMode,
      allowlist: domainAllowlist,
      denylist: domainDenylist,
      preset,
    });
    setDomainPolicyModeState(applied.mode);
    setDomainAllowlistState(applied.allowlist);
    setDomainDenylistState(applied.denylist);
    void setDomainPolicyMode(applied.mode);
    void setDomainAllowlist(applied.allowlist);
    void setDomainDenylist(applied.denylist);
  };

  const handlePreQueryNoticeFirstRunChoice = (showNotices: boolean) => {
    setShowPreQueryNoticesState(showNotices);
    setPreQueryNoticePreferenceConfiguredState(true);
    setInstallQuickStartCompletedState(true);
    void completeInstallQuickStart(showNotices);
  };

  const handleQuickStartKeySaved = (slot: ApiKeySlot, value: string) => {
    handleSaved(slot, value);
    const trimmed = value.trim();
    if (trimmed.length > 0 && INSTALL_QUICK_START_KEY_SLOTS.includes(slot)) {
      setEnrichmentSourceEnabledState((current) => ({
        ...current,
        [slot]: true,
      }));
      void setEnrichmentSourceEnabled(slot, true);
    }
  };

  const showInstallQuickStart = ready && !installQuickStartCompleted;

  const handleGlobalCacheTtlBlur = () => {
    const parsed = readStoredCacheTtlSeconds(
      globalCacheTtlSeconds,
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS
    );
    setGlobalCacheTtlSecondsState(String(parsed));
    void setEnrichmentCacheTtlSeconds(parsed);
  };

  const applyGlobalCachePreset = (seconds: number) => {
    setGlobalCacheTtlSecondsState(String(seconds));
    void setEnrichmentCacheTtlSeconds(seconds);
  };

  const handleSourceCacheTtlBlur = (sourceId: EnrichmentSourceId) => {
    const raw = sourceCacheTtlDrafts[sourceId].trim();
    if (raw === "") {
      setSourceCacheTtlDraftsState((current) => ({
        ...current,
        [sourceId]: "",
      }));
      void setEnrichmentSourceCacheTtlSeconds(sourceId, null);
      return;
    }

    const parsed = readStoredCacheTtlSeconds(raw, DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS);
    setSourceCacheTtlDraftsState((current) => ({
      ...current,
      [sourceId]: String(parsed),
    }));
    void setEnrichmentSourceCacheTtlSeconds(sourceId, parsed);
  };

  const handleClearCache = () => {
    setClearCacheState("clearing");
    void clearEnrichmentCache({ recordClearTimestamp: true })
      .then(() => {
        setClearCacheState("cleared");
      })
      .catch(() => {
        setClearCacheState("error");
      });
  };

  const handleCorrelationRetentionBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const parsed = Number(event.currentTarget.value);
    const normalized = Number.isFinite(parsed)
      ? Math.min(
          MAX_CORRELATION_CLUSTER_RETENTION_DAYS,
          Math.max(MIN_CORRELATION_CLUSTER_RETENTION_DAYS, Math.trunc(parsed))
        )
      : DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS;
    setCorrelationRetentionDays(String(normalized));
    void setCorrelationClusterRetentionDays(normalized).then((store) => {
      setCorrelationClusterCount(store.clusters.length);
    });
  };

  const handleRelationshipRetentionBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const parsed = Number(event.currentTarget.value);
    const normalized = Number.isFinite(parsed)
      ? Math.min(
          MAX_RELATIONSHIP_EDGE_RETENTION_DAYS,
          Math.max(MIN_RELATIONSHIP_EDGE_RETENTION_DAYS, Math.trunc(parsed))
        )
      : DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS;
    setRelationshipRetentionDays(String(normalized));
    void setRelationshipEdgeRetentionDays(normalized).then((store) => {
      setRelationshipEdgeCount(store.edges.length);
    });
  };

  const handleClearRelationshipEdges = () => {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(
            "Clear all relationship memory? This removes Previously appeared with edges from this browser profile. Investigation sessions are not deleted. Retention and policy settings are kept."
          )
        : true;
    if (!confirmed) {
      return;
    }
    setClearRelationshipEdgesState("clearing");
    void clearStoredRelationshipEdges()
      .then((store) => {
        setRelationshipEdgeCount(store.edges.length);
        setClearRelationshipEdgesState("cleared");
      })
      .catch(() => {
        setClearRelationshipEdgesState("error");
      });
  };

  const persistCorrelationOverlapDraft = (
    mode: CorrelationOverlapModeDraft,
    jaccardDraft: string,
    minSharedDraft: string
  ) => {
    if (mode === "off") {
      void setCorrelationClusterOverlapMerge(null);
      return;
    }
    const jaccardParsed = Number(jaccardDraft);
    const minSharedParsed = Number(minSharedDraft);
    const jaccardThreshold = Number.isFinite(jaccardParsed)
      ? Math.min(
          MAX_CORRELATION_CLUSTER_JACCARD_THRESHOLD,
          Math.max(MIN_CORRELATION_CLUSTER_JACCARD_THRESHOLD, jaccardParsed)
        )
      : DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD;
    const minSharedIocCount = Number.isFinite(minSharedParsed)
      ? Math.min(
          MAX_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT,
          Math.max(MIN_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT, Math.trunc(minSharedParsed))
        )
      : DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT;
    setCorrelationJaccardThreshold(String(jaccardThreshold));
    setCorrelationMinSharedCount(String(minSharedIocCount));
    void setCorrelationClusterOverlapMerge({
      mode,
      jaccardThreshold,
      minSharedIocCount,
    });
  };

  const handleCorrelationOverlapModeChange = (mode: CorrelationOverlapModeDraft) => {
    setCorrelationOverlapMode(mode);
    persistCorrelationOverlapDraft(mode, correlationJaccardThreshold, correlationMinSharedCount);
  };

  const handleCorrelationJaccardThresholdBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    persistCorrelationOverlapDraft(
      correlationOverlapMode,
      event.currentTarget.value,
      correlationMinSharedCount
    );
  };

  const handleCorrelationMinSharedBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    persistCorrelationOverlapDraft(
      correlationOverlapMode,
      correlationJaccardThreshold,
      event.currentTarget.value
    );
  };

  const handleClearCorrelationClusters = () => {
    setClearCorrelationClustersState("clearing");
    void clearStoredCorrelationClusters()
      .then((ok) => {
        if (!ok) {
          setClearCorrelationClustersState("error");
          return;
        }
        setCorrelationClusterCount(0);
        setClearCorrelationClustersState("cleared");
      })
      .catch(() => {
        setClearCorrelationClustersState("error");
      });
  };

  const handleExportNoiseRules = () => {
    setNoiseRulesExportState("exporting");
    void exportStoredNoiseRulesJson()
      .then((json) => {
        downloadNoiseRulesExportJson(json);
        setNoiseRulesExportState("exported");
      })
      .catch(() => {
        setNoiseRulesExportState("error");
      });
  };

  const handleExportKnownGoodList = () => {
    setKnownGoodExportState("exporting");
    void exportStoredKnownGoodListJson()
      .then((json) => {
        downloadKnownGoodExportJson(json);
        setKnownGoodExportState("exported");
      })
      .catch(() => {
        setKnownGoodExportState("error");
      });
  };

  const handleToggleKnownGoodCategory = (category: KnownGoodCategory, enabled: boolean) => {
    void setStoredKnownGoodCategoryEnabled(category, enabled)
      .then((next) => {
        setKnownGoodCategoryEnabled(next);
        setKnownGoodManageStatus(
          enabled
            ? `${formatKnownGoodCategoryDisplay(category)} matching enabled.`
            : `${formatKnownGoodCategoryDisplay(category)} matching disabled.`
        );
      })
      .catch(() => {
        setKnownGoodManageStatus("Could not update category matching.");
      });
  };

  const beginEditKnownGoodEntry = (entry: KnownGoodEntry) => {
    setEditingKnownGoodEntryId(entry.id);
    setKnownGoodEditDraft({
      category: entry.category,
      matchType: entry.matchType,
      pattern: entry.pattern,
      labelText: entry.labelText,
    });
    setKnownGoodManageStatus(null);
  };

  const cancelEditKnownGoodEntry = () => {
    setEditingKnownGoodEntryId(null);
    setKnownGoodEditDraft(null);
  };

  const handleSaveKnownGoodEntryEdit = () => {
    if (!editingKnownGoodEntryId || !knownGoodEditDraft) {
      return;
    }
    const pattern = knownGoodEditDraft.pattern.trim();
    const labelText = knownGoodEditDraft.labelText.trim();
    if (!pattern) {
      setKnownGoodManageStatus("Pattern cannot be empty.");
      return;
    }
    if (!labelText) {
      setKnownGoodManageStatus("Label text cannot be empty.");
      return;
    }
    let nextEntry: KnownGoodEntry;
    try {
      nextEntry = createKnownGoodEntry({
        id: editingKnownGoodEntryId,
        category: knownGoodEditDraft.category,
        matchType: knownGoodEditDraft.matchType,
        pattern,
        labelText,
      });
    } catch {
      setKnownGoodManageStatus("Could not validate known-good entry.");
      return;
    }
    void updateStoredKnownGoodEntry(nextEntry)
      .then((saved) => {
        setKnownGoodEntries((current) =>
          current
            .map((entry) => (entry.id === saved.id ? saved : entry))
            .sort((left, right) =>
              left.category !== right.category
                ? left.category < right.category
                  ? -1
                  : 1
                : left.pattern < right.pattern
                  ? -1
                  : left.pattern > right.pattern
                    ? 1
                    : 0
            )
        );
        cancelEditKnownGoodEntry();
        setKnownGoodManageStatus("Known-good entry saved.");
      })
      .catch(() => {
        setKnownGoodManageStatus("Could not save known-good entry.");
      });
  };

  const handleDeleteKnownGoodEntry = (entry: KnownGoodEntry) => {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`Delete known-good entry ${entry.pattern}?`)
        : true;
    if (!confirmed) {
      return;
    }
    void deleteStoredKnownGoodEntry(entry.id)
      .then((ok) => {
        if (!ok) {
          setKnownGoodManageStatus("Could not delete known-good entry.");
          return;
        }
        setKnownGoodEntries((current) => current.filter((item) => item.id !== entry.id));
        if (editingKnownGoodEntryId === entry.id) {
          cancelEditKnownGoodEntry();
        }
        setKnownGoodManageStatus("Known-good entry deleted.");
      })
      .catch(() => {
        setKnownGoodManageStatus("Could not delete known-good entry.");
      });
  };

  const handleNoiseRulesImportClick = () => {
    noiseRulesImportInputRef.current?.click();
  };

  const openNoiseRulesImportReview = (raw: string, format: NoiseRulesImportFormat) => {
    setNoiseRulesImportState("idle");
    setNoiseRulesImportStatus(null);
    setNoiseRulesReplaceConfirmed(false);
    setNoiseRulesImportMergeMode(NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY);
    void listStoredNoiseRules()
      .then((existing) => {
        try {
          const preview = buildNoiseRulesImportPreview(
            raw,
            format,
            existing,
            NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY
          );
          setNoiseRulesImportDraft({ raw, format });
          setNoiseRulesImportPreview(preview);
        } catch (error) {
          setNoiseRulesImportDraft(null);
          setNoiseRulesImportPreview(null);
          setNoiseRulesImportState("error");
          setNoiseRulesImportStatus(
            error instanceof NoiseRulesImportError
              ? error.message
              : "Could not prepare noise rules import. Check the file schema and try again."
          );
        }
      })
      .catch((error) => {
        setNoiseRulesImportDraft(null);
        setNoiseRulesImportPreview(null);
        setNoiseRulesImportState("error");
        setNoiseRulesImportStatus(
          error instanceof NoiseRulesImportError
            ? error.message
            : "Could not prepare noise rules import. Check the file schema and try again."
        );
      });
  };

  const handleNoiseRulesImportMergeModeChange = (mergeMode: NoiseRulesImportMergeMode) => {
    if (!noiseRulesImportDraft) {
      return;
    }
    setNoiseRulesImportMergeMode(mergeMode);
    setNoiseRulesReplaceConfirmed(false);
    void listStoredNoiseRules()
      .then((existing) => {
        setNoiseRulesImportPreview(
          buildNoiseRulesImportPreview(
            noiseRulesImportDraft.raw,
            noiseRulesImportDraft.format,
            existing,
            mergeMode
          )
        );
      })
      .catch(() => {
        setNoiseRulesImportState("error");
        setNoiseRulesImportStatus("Could not refresh the import preview.");
      });
  };

  const clearNoiseRulesImportReview = () => {
    setNoiseRulesImportDraft(null);
    setNoiseRulesImportPreview(null);
    setNoiseRulesReplaceConfirmed(false);
    setNoiseRulesImportMergeMode(NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY);
  };

  const handleNoiseRulesImportCancel = () => {
    clearNoiseRulesImportReview();
    setNoiseRulesImportState("idle");
  };

  const handleNoiseRulesImportConfirm = () => {
    if (!noiseRulesImportDraft || !noiseRulesImportPreview) {
      return;
    }
    if (
      noiseRulesImportMergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL &&
      !noiseRulesReplaceConfirmed
    ) {
      return;
    }

    setNoiseRulesImportState("importing");
    void importNoiseRulesFromText(
      noiseRulesImportDraft.raw,
      noiseRulesImportDraft.format,
      noiseRulesImportMergeMode,
      {
        confirmReplace: () =>
          noiseRulesImportMergeMode === NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY
            ? true
            : noiseRulesReplaceConfirmed,
      }
    )
      .then((result) => {
        clearNoiseRulesImportReview();
        setNoiseRulesImportStatus(formatNoiseRulesImportStatus(result));
        setNoiseRulesImportState("imported");
        return listStoredNoiseRules();
      })
      .then((rules) => {
        setNoiseRules(rules);
      })
      .catch((error) => {
        setNoiseRulesImportState("error");
        setNoiseRulesImportStatus(
          error instanceof NoiseRulesImportError
            ? error.message
            : "Could not import noise rules. Check the file schema and try again."
        );
      });
  };

  const handleNoiseRulesImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const format = detectNoiseRulesImportFormat(`${file.name};${file.type}`, raw);
      try {
        openNoiseRulesImportReview(raw, format);
      } catch (error) {
        setNoiseRulesImportState("error");
        setNoiseRulesImportStatus(
          error instanceof NoiseRulesImportError
            ? error.message
            : "Could not import noise rules. Check the file schema and try again."
        );
      }
    };
    reader.onerror = () => {
      setNoiseRulesImportState("error");
      setNoiseRulesImportStatus("Could not read the selected file.");
    };
    reader.readAsText(file);
  };

  const handleImportSocDashboardNoiseStarter = () => {
    try {
      openNoiseRulesImportReview(serializeSocDashboardNoiseStarterExportJson(), "json");
    } catch (error) {
      setNoiseRulesImportState("error");
      setNoiseRulesImportStatus(
        error instanceof NoiseRulesImportError
          ? error.message
          : "Could not import the SOC dashboard starter list. Try again."
      );
    }
  };

  const handleClearNoiseRules = () => {
    setClearNoiseRulesState("clearing");
    void clearStoredNoiseRules()
      .then(() => {
        setNoiseRules([]);
        setLastLearnedNoiseRuleUndo(null);
        setEditingNoiseRuleId(null);
        setNoiseRuleEditDraft(null);
        setClearNoiseRulesState("cleared");
      })
      .catch(() => {
        setClearNoiseRulesState("error");
      });
  };

  const filteredNoiseRules = useMemo(
    () => filterNoiseRulesBySearch(noiseRules, noiseRulesSearchQuery),
    [noiseRules, noiseRulesSearchQuery]
  );

  const beginEditNoiseRule = (rule: NoiseRule) => {
    setEditingNoiseRuleId(rule.id);
    setNoiseRuleEditDraft({
      patternType: rule.patternType,
      pattern: rule.pattern,
      sourceAction: rule.sourceAction,
    });
    setNoiseRuleManageStatus(null);
  };

  const cancelEditNoiseRule = () => {
    setEditingNoiseRuleId(null);
    setNoiseRuleEditDraft(null);
  };

  const handleSaveNoiseRuleEdit = () => {
    if (!editingNoiseRuleId || !noiseRuleEditDraft) {
      return;
    }
    const existing = noiseRules.find((rule) => rule.id === editingNoiseRuleId);
    if (!existing) {
      return;
    }
    const pattern = noiseRuleEditDraft.pattern.trim();
    if (!pattern) {
      setNoiseRuleManageStatus("Pattern cannot be empty.");
      return;
    }
    void updateStoredNoiseRule({
      ...existing,
      patternType: noiseRuleEditDraft.patternType,
      pattern,
      sourceAction: noiseRuleEditDraft.sourceAction,
    })
      .then((saved) => {
        setNoiseRules((current) =>
          current
            .map((rule) => (rule.id === saved.id ? saved : rule))
            .sort((left, right) =>
              left.createdAt !== right.createdAt
                ? left.createdAt - right.createdAt
                : left.id < right.id
                  ? -1
                  : left.id > right.id
                    ? 1
                    : 0
            )
        );
        cancelEditNoiseRule();
        setNoiseRuleManageStatus("Noise rule saved.");
      })
      .catch(() => {
        setNoiseRuleManageStatus("Could not save noise rule.");
      });
  };

  const handleToggleNoiseRuleEnabled = (rule: NoiseRule, enabled: boolean) => {
    void setStoredNoiseRuleEnabled(rule.id, enabled)
      .then((saved) => {
        if (!saved) {
          setNoiseRuleManageStatus("Could not update noise rule.");
          return;
        }
        setNoiseRules((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
        setNoiseRuleManageStatus(enabled ? "Noise rule enabled." : "Noise rule disabled.");
      })
      .catch(() => {
        setNoiseRuleManageStatus("Could not update noise rule.");
      });
  };

  const handleDeleteNoiseRule = (rule: NoiseRule) => {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`Delete noise rule ${rule.pattern}?`)
        : true;
    if (!confirmed) {
      return;
    }
    void deleteStoredNoiseRule(rule.id)
      .then((ok) => {
        if (!ok) {
          setNoiseRuleManageStatus("Could not delete noise rule.");
          return;
        }
        setNoiseRules((current) => current.filter((entry) => entry.id !== rule.id));
        if (editingNoiseRuleId === rule.id) {
          cancelEditNoiseRule();
        }
        if (lastLearnedNoiseRuleUndo?.id === rule.id) {
          setLastLearnedNoiseRuleUndo(null);
        }
        setNoiseRuleManageStatus("Noise rule deleted.");
      })
      .catch(() => {
        setNoiseRuleManageStatus("Could not delete noise rule.");
      });
  };

  const handlePreviewNoiseRulesOnSampleAlert = () => {
    const preview = buildNoiseRuleSampleAlertMatchPreview(noiseRules);
    setNoiseRuleSampleAlertPreview(preview);
    setNoiseRuleManageStatus(
      NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_SUMMARY(
        preview.matched.length,
        preview.indicatorCount
      )
    );
  };

  const handleClearNoiseRuleSampleAlertPreview = () => {
    setNoiseRuleSampleAlertPreview(null);
    setNoiseRuleManageStatus(null);
  };

  const handleUndoLastLearnedNoiseRule = () => {
    if (!lastLearnedNoiseRuleUndo) {
      setNoiseRuleManageStatus(NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_EMPTY);
      return;
    }
    void undoLastLearnedNoiseRule()
      .then((undone) => {
        if (!undone) {
          setLastLearnedNoiseRuleUndo(null);
          setNoiseRuleManageStatus(NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_EMPTY);
          return;
        }
        setNoiseRules((current) => current.filter((entry) => entry.id !== undone.id));
        setLastLearnedNoiseRuleUndo(null);
        setNoiseRuleManageStatus(NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_DONE(undone.pattern));
      })
      .catch(() => {
        setNoiseRuleManageStatus("Could not undo last learned rule.");
      });
  };

  const handleExportSettings = () => {
    setExportState("exporting");
    void exportVera5SettingsJson(includeApiKeysInExport)
      .then((json) => {
        downloadVera5SettingsExport(json);
        setExportState("exported");
      })
      .catch(() => {
        setExportState("error");
      });
  };

  const handleExportSettingsPack = () => {
    setSettingsPackExportState("exporting");
    void exportSettingsPackJson()
      .then((json) => {
        downloadSettingsPackExport(json);
        setSettingsPackExportState("exported");
      })
      .catch(() => {
        setSettingsPackExportState("error");
      });
  };

  const handleExportThreatProfile = () => {
    setThreatProfileExportState("exporting");
    void exportThreatProfileJson()
      .then((json) => {
        downloadThreatProfileExport(json);
        setThreatProfileExportState("exported");
      })
      .catch(() => {
        setThreatProfileExportState("error");
      });
  };

  const handleThreatProfileImportClick = () => {
    threatProfileImportInputRef.current?.click();
  };

  const handleApplyBuiltInThreatProfile = (profileId: string) => {
    const profile = getBuiltInThreatProfileById(profileId);
    if (!profile) {
      setThreatProfileImportState("error");
      return;
    }

    const rawJson = serializeBuiltInThreatProfile(profile);
    setThreatProfileImportState("idle");
    void getVera5Settings()
      .then((current) => {
        const preview = buildThreatProfileImportPreview(
          current,
          rawJson,
          THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
        );
        setThreatProfileImportMergeMode(THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE);
        setThreatProfileImportPreview(preview);
        setThreatProfileImportRawJson(rawJson);
      })
      .catch(() => {
        clearThreatProfileImportPreview();
        setThreatProfileImportState("error");
      });
  };

  const clearThreatProfileImportPreview = () => {
    setThreatProfileImportPreview(null);
    setThreatProfileImportRawJson(null);
    setThreatProfileImportMergeMode(THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT);
  };

  const handleThreatProfileImportCancel = () => {
    clearThreatProfileImportPreview();
    setThreatProfileImportState("idle");
  };

  const handleThreatProfileImportMergeModeChange = (mergeMode: ThreatProfileImportMergeMode) => {
    if (!threatProfileImportRawJson || !threatProfileImportPreview) {
      setThreatProfileImportMergeMode(mergeMode);
      return;
    }
    setThreatProfileImportMergeMode(mergeMode);
    void getVera5Settings()
      .then((current) => {
        const preview = buildThreatProfileImportPreview(
          current,
          threatProfileImportRawJson,
          mergeMode
        );
        setThreatProfileImportPreview(preview);
      })
      .catch(() => {
        clearThreatProfileImportPreview();
        setThreatProfileImportState("error");
      });
  };

  const handleThreatProfileImportConfirm = () => {
    if (!threatProfileImportRawJson) {
      return;
    }

    setThreatProfileImportState("importing");
    void importThreatProfileJson(threatProfileImportRawJson, threatProfileImportMergeMode)
      .then(() => {
        clearThreatProfileImportPreview();
        setThreatProfileImportState("imported");
        setSettingsReloadToken((current) => current + 1);
      })
      .catch(() => {
        setThreatProfileImportState("error");
      });
  };

  const handleThreatProfileImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setThreatProfileImportState("idle");
    const reader = new FileReader();
    reader.onload = () => {
      const rawJson = typeof reader.result === "string" ? reader.result : "";
      void getVera5Settings()
        .then((current) => {
          const preview = buildThreatProfileImportPreview(
            current,
            rawJson,
            THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
          );
          setThreatProfileImportMergeMode(THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT);
          setThreatProfileImportPreview(preview);
          setThreatProfileImportRawJson(rawJson);
        })
        .catch(() => {
          clearThreatProfileImportPreview();
          setThreatProfileImportState("error");
        });
    };
    reader.onerror = () => {
      clearThreatProfileImportPreview();
      setThreatProfileImportState("error");
    };
    reader.readAsText(file);
  };

  const handleSettingsPackImportClick = () => {
    settingsPackImportInputRef.current?.click();
  };

  const clearSettingsPackImportPreview = () => {
    setSettingsPackImportPreview(null);
    setSettingsPackImportRawJson(null);
  };

  const handleSettingsPackImportCancel = () => {
    clearSettingsPackImportPreview();
    setSettingsPackImportState("idle");
  };

  const handleSettingsPackImportConfirm = () => {
    if (!settingsPackImportRawJson) {
      return;
    }

    setSettingsPackImportState("importing");
    void importSettingsPackJson(settingsPackImportRawJson)
      .then(() => {
        clearSettingsPackImportPreview();
        setSettingsPackImportState("imported");
        setSettingsReloadToken((current) => current + 1);
      })
      .catch(() => {
        setSettingsPackImportState("error");
      });
  };

  const handleSettingsPackImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setSettingsPackImportState("idle");
    const reader = new FileReader();
    reader.onload = () => {
      const rawJson = typeof reader.result === "string" ? reader.result : "";
      void getVera5Settings()
        .then((current) => {
          const preview = buildSettingsPackImportPreview(current, rawJson);
          setSettingsPackImportPreview(preview);
          setSettingsPackImportRawJson(rawJson);
        })
        .catch(() => {
          clearSettingsPackImportPreview();
          setSettingsPackImportState("error");
        });
    };
    reader.onerror = () => {
      clearSettingsPackImportPreview();
      setSettingsPackImportState("error");
    };
    reader.readAsText(file);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImportState("importing");
    const reader = new FileReader();
    reader.onload = () => {
      const rawJson = typeof reader.result === "string" ? reader.result : "";
      void importVera5SettingsJson(rawJson)
        .then(() => {
          setImportState("imported");
          setSettingsReloadToken((current) => current + 1);
        })
        .catch(() => {
          setImportState("error");
        });
    };
    reader.onerror = () => {
      setImportState("error");
    };
    reader.readAsText(file);
  };

  const handleDraftChange = (slot: ApiKeySlot, draft: string) => {
    setFieldStates((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        draft,
      },
    }));
  };

  const handleEditingChange = (slot: ApiKeySlot, editing: boolean) => {
    setFieldStates((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        editing,
      },
    }));
  };

  const handleSaved = (slot: ApiKeySlot, value: string) => {
    const trimmed = value.trim();
    setFieldStates((current) => ({
      ...current,
      [slot]: {
        configured: trimmed.length > 0,
        editing: false,
        draft: "",
        maskedPreview: trimmed ? maskApiKeyForDisplay(trimmed) : "",
      },
    }));
  };

  const handlePersist = async (slot: ApiKeySlot, value: string) => {
    await setApiKey(slot, value);
  };

  const enabledIocTypes = IOC_TYPE_SETTINGS_ORDER.filter(
    (iocType) => iocTypeEnabled[iocType] !== false
  );
  const enabledSources = ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) => enrichmentSourceEnabled[sourceId] === true
  );
  const parsedGlobalTtl = Number(globalCacheTtlSeconds);

  const sourceHasConfiguredKeys = (sourceId: EnrichmentSourceId): boolean => {
    if (!OPTIONS_API_KEY_SLOTS.includes(sourceId)) {
      return true;
    }
    if (sourceId === ENRICHMENT_SOURCE.CENSYS) {
      return (
        fieldStates[ENRICHMENT_SOURCE.CENSYS]?.configured === true &&
        fieldStates[CENSYS_SECRET_API_KEY_SLOT]?.configured === true
      );
    }
    return fieldStates[sourceId]?.configured === true;
  };

  const sourceStatus = (
    sourceId: EnrichmentSourceId
  ): { className: string; label: string; withDot: boolean } => {
    const enabled = enrichmentSourceEnabled[sourceId] === true;
    if (!enabled) {
      return { className: "v5-badge--off", label: "Disabled", withDot: false };
    }
    const keyed = OPTIONS_API_KEY_SLOTS.includes(sourceId);
    if (keyed && !sourceHasConfiguredKeys(sourceId)) {
      return { className: "v5-badge--warn", label: "No API key", withDot: true };
    }
    if (keyed) {
      return { className: "v5-badge--on", label: "Saved", withDot: true };
    }
    return { className: "v5-badge--on", label: "Enabled", withDot: true };
  };

  return (
    <main className="v5-app">
      <div className="v5-topbar">
        <div className="v5-topnav">
          <span className="v5-topnav__brand">
            VERA<span className="v5-brand__five">5</span>
          </span>
          <span className="v5-topnav__saved">
            <span className="v5-topnav__dot" aria-hidden="true" />
            Saved automatically (locally)
          </span>
          <nav className="v5-topnav__links" aria-label="Vera5 resources">
            <a
              className="v5-topnav__link"
              href="https://www.vera5.io/how-to"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 7v14" />
                <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
              </svg>
              How-To
            </a>
            <span className="v5-topnav__sep" aria-hidden="true" />
            <a
              className="v5-topnav__link"
              href="https://www.vera5.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
              </svg>
              Chrome Extension
            </a>
            <span className="v5-topnav__sep" aria-hidden="true" />
            <a
              className="v5-topnav__link"
              href="https://github.com/0xCBradford/Vera5"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.575.106.785-.25.785-.556 0-.274-.01-1-.015-1.964-3.196.695-3.87-1.54-3.87-1.54-.523-1.33-1.276-1.684-1.276-1.684-1.043-.713.08-.699.08-.699 1.153.081 1.76 1.184 1.76 1.184 1.026 1.758 2.69 1.25 3.345.956.104-.743.402-1.25.731-1.538-2.553-.29-5.236-1.276-5.236-5.68 0-1.255.448-2.28 1.183-3.085-.119-.29-.513-1.458.112-3.04 0 0 .965-.309 3.163 1.18a11 11 0 0 1 2.88-.388c.977.005 1.96.132 2.88.388 2.196-1.489 3.16-1.18 3.16-1.18.626 1.582.232 2.75.114 3.04.737.805 1.182 1.83 1.182 3.085 0 4.415-2.687 5.387-5.247 5.671.412.355.78 1.057.78 2.13 0 1.538-.014 2.778-.014 3.156 0 .309.207.668.79.555A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
              </svg>
              GitHub
            </a>
          </nav>
        </div>
      </div>
      <div className="v5-shell">
        <aside className="v5-sidebar">
          <div className="v5-brand">
            <span className="v5-brand__mark" aria-hidden="true">
              <img className="v5-brand__logo" src="icons/logo-mark.png" alt="" />
            </span>
            <span>
              <span className="v5-brand__name">
                VERA<span className="v5-brand__five">5</span>
              </span>
              <span className="v5-brand__sub">Threat intel settings</span>
            </span>
          </div>
          <nav className="v5-nav" aria-label="Settings sections">
            {NAV_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`v5-nav__item${
                  activeSection === section.id ? " v5-nav__item--active" : ""
                }`}
                aria-current={activeSection === section.id ? "true" : undefined}
                onClick={() => handleNavClick(section.id)}
              >
                <span className="v5-nav__dot" aria-hidden="true" />
                {section.label}
              </button>
            ))}
          </nav>
          <div className="v5-sidebar__footer">
            <div className="v5-info-note__title">Local-first by design</div>
            <div className="v5-lock">
              <span className="v5-lock__icon">
                <LockIcon />
              </span>
              <span className="v5-lock__text">
                Settings stored locally. VERA5 never receives your API keys.
              </span>
            </div>
          </div>
        </aside>

        <div className="v5-content">
          <header className="v5-page-head">
            <div>
              <h1 className="v5-page-title">Settings</h1>
              <p className="v5-page-sub">
                Configure threat intelligence sources and extension preferences.
              </p>
            </div>
          </header>

          {showInstallQuickStart ? (
            <section className="v5-card" aria-labelledby="install-quick-start-heading">
              <div className="v5-card__head">
                <p className="v5-card__desc" style={{ marginBottom: 8 }}>
                  Step {quickStartStep + 1} of {INSTALL_QUICK_START_STEP_LABELS.length}
                  {" · "}
                  {INSTALL_QUICK_START_STEP_LABELS[quickStartStep]}
                </p>
                <h2 id="install-quick-start-heading" className="v5-card__title">
                  Install quick start
                </h2>
                {quickStartStep === 0 ? (
                  <p className="v5-card__desc">
                    Vera5 runs locally in your browser—no Vera5-operated telemetry and no full-page
                    upload. Pin the toolbar action, open an <code>http://</code> or{" "}
                    <code>https://</code> page, and use <strong>Scan page</strong> from the
                    side-panel workspace or <strong>Ctrl+Shift+Y</strong> /{" "}
                    <strong>Cmd+Shift+Y</strong>. Detection and highlighting work without API keys;
                    live enrichment is optional. Serve the repository <code>examples/</code> folder
                    over HTTP to try fixture pages.
                  </p>
                ) : null}
                {quickStartStep === 1 ? (
                  <p className="v5-card__desc">
                    Bring your own API keys for live enrichment. Keys stay in{" "}
                    <code>chrome.storage.local</code> on this profile—Vera5 does not operate a
                    shared enrichment backend. Only detected indicator values are sent to vendors
                    you enable—not full page content. Only <strong>AbuseIPDB</strong>,{" "}
                    <strong>OTX</strong>, <strong>URLScan.io</strong>, and{" "}
                    <strong>GreyNoise</strong> perform live HTTPS queries today; add keys later
                    under <strong>API keys</strong> if you skip this step.
                  </p>
                ) : null}
                {quickStartStep === 2 ? (
                  <p className="v5-card__desc">
                    <strong>Manual-only enrichment</strong> is the recommended default and stays on
                    unless you turn it off below. Live threat intelligence runs only when you use
                    the enrich control on a highlight—not when you open a card or scan a page.
                    Auto-scan on page load stays off until you enable it under{" "}
                    <strong>Scanning</strong>.
                  </p>
                ) : null}
                {quickStartStep === 3 ? (
                  <p className="v5-card__desc">
                    Trust controls ship with conservative defaults: domain and internal-asset enrich
                    gates on, sensitive webmail patterns blocked, and auto-scan off. Choose whether
                    to show a short notice before each live vendor query. With manual-only
                    enrichment, queries still require your enrich action even when notices are
                    dismissed.
                  </p>
                ) : null}
              </div>
              <div className="v5-card__body">
                {quickStartStep === 0 ? (
                  <ul className="v5-domain-list" aria-label="Install checklist">
                    <li className="v5-domain-list__item">
                      Load unpacked from <code>extension/dist/</code>
                    </li>
                    <li className="v5-domain-list__item">Pin the Vera5 toolbar action</li>
                    <li className="v5-domain-list__item">
                      Open a page tab and run <strong>Scan page</strong>
                    </li>
                  </ul>
                ) : null}
                {quickStartStep === 1 ? (
                  <div>
                    {INSTALL_QUICK_START_KEY_SLOTS.map((slot) => (
                      <ApiKeyField
                        key={slot}
                        slot={slot}
                        label={ENRICHMENT_SOURCE_LABELS[slot]}
                        ready={ready}
                        fieldState={fieldStates[slot]}
                        onDraftChange={handleDraftChange}
                        onEditingChange={handleEditingChange}
                        onPersist={handlePersist}
                        onSaved={handleQuickStartKeySaved}
                      />
                    ))}
                  </div>
                ) : null}
                {quickStartStep === 2 ? (
                  <div>
                    <ToggleRow
                      label="Manual-only enrichment"
                      hint="Leave on to avoid automatic vendor calls when triaging. Turn off only when you want live enrichment each time you open an indicator card."
                      ariaLabel="Manual-only enrichment"
                      checked={manualOnlyMode}
                      disabled={!ready}
                      onChange={handleManualOnlyToggle}
                    />
                    <ul
                      className="v5-domain-list"
                      aria-label="Safe scanning defaults"
                      style={{ marginTop: 16 }}
                    >
                      <li className="v5-domain-list__item">
                        Auto-scan on page changes: {autoScanEnabled ? "on" : "off (recommended)"}
                      </li>
                      <li className="v5-domain-list__item">
                        Live enrichment sources: none enabled until you save a key and turn a source
                        on, or enable keyless <strong>RDAP/WHOIS</strong> for domain registration
                        lookups
                      </li>
                    </ul>
                  </div>
                ) : null}
                {quickStartStep === 3 ? (
                  <div>
                    <ul className="v5-domain-list" aria-label="Default trust settings">
                      <li className="v5-domain-list__item">
                        Domain policy: allow by default with a sensitive webmail denylist (
                        {domainDenylist.length} host patterns)
                      </li>
                      <li className="v5-domain-list__item">
                        Domain enrich gate: {domainPolicyEnrichGateEnabled ? "on" : "off"}
                      </li>
                      <li className="v5-domain-list__item">
                        Internal asset enrich gate: {internalAssetEnrichGateEnabled ? "on" : "off"}
                      </li>
                      <li className="v5-domain-list__item">
                        Auto-scan on page changes: {autoScanEnabled ? "on" : "off (default)"}
                      </li>
                    </ul>
                    <p className="v5-row__hint" style={{ marginTop: 16 }}>
                      Pre-query notices name enabled vendors and the indicator value before a live
                      fetch. Adjust domain policy, internal assets, and scanning under{" "}
                      <strong>Trust &amp; Consent</strong> and <strong>Scanning</strong>.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        marginTop: 12,
                      }}
                    >
                      <button
                        type="button"
                        className="v5-btn v5-btn--primary"
                        onClick={() => handlePreQueryNoticeFirstRunChoice(true)}
                      >
                        Show pre-query notices (recommended)
                      </button>
                      <button
                        type="button"
                        className="v5-btn v5-btn--ghost"
                        onClick={() => handlePreQueryNoticeFirstRunChoice(false)}
                      >
                        Skip pre-query notices
                      </button>
                    </div>
                  </div>
                ) : null}
                {quickStartStep < 3 ? (
                  <div className="v5-actions" style={{ marginTop: quickStartStep === 0 ? 16 : 0 }}>
                    {quickStartStep > 0 ? (
                      <button
                        type="button"
                        className="v5-btn v5-btn--ghost"
                        onClick={() =>
                          setQuickStartStep((current) => (current - 1) as InstallQuickStartStep)
                        }
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="v5-btn v5-btn--primary"
                      onClick={() =>
                        setQuickStartStep((current) => (current + 1) as InstallQuickStartStep)
                      }
                    >
                      {quickStartStep === 1 ? "Continue without keys" : "Continue"}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section id="overview" className="v5-card" aria-labelledby="overview-heading">
            <div className="v5-card__head">
              <h2 id="overview-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.overview}
                  aria-controls="overview-body"
                  onClick={() => toggleSection("overview")}
                >
                  <span className="v5-card__toggle-text">Overview</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                A snapshot of how VERA5 is currently scanning and enriching this browser.
              </p>
            </div>
            <div id="overview-body" className="v5-card__body" hidden={collapsedSections.overview}>
              <div className="v5-overview-grid">
                <div className="v5-stat">
                  <div className="v5-stat__label">Indicator types</div>
                  <div className="v5-stat__value">
                    {enabledIocTypes.length}
                    <small> / {IOC_TYPE_SETTINGS_ORDER.length} enabled</small>
                  </div>
                  <div className="v5-chips">
                    {enabledIocTypes.length > 0 ? (
                      enabledIocTypes.map((iocType) => (
                        <span key={iocType} className="v5-chip">
                          {IOC_TYPE_SHORT_LABELS[iocType]}
                        </span>
                      ))
                    ) : (
                      <span className="v5-chip v5-chip--muted">None</span>
                    )}
                  </div>
                </div>
                <div className="v5-stat">
                  <div className="v5-stat__label">Enrichment sources</div>
                  <div className="v5-stat__value">
                    {enabledSources.length}
                    <small> / {ENRICHMENT_SOURCE_ORDER.length} enabled</small>
                  </div>
                  <div className="v5-chips">
                    {enabledSources.length > 0 ? (
                      enabledSources.map((sourceId) => (
                        <span key={sourceId} className="v5-chip">
                          {ENRICHMENT_SOURCE_LABELS[sourceId]}
                        </span>
                      ))
                    ) : (
                      <span className="v5-chip v5-chip--muted">None</span>
                    )}
                  </div>
                </div>
                <div className="v5-stat">
                  <div className="v5-stat__label">Cache lifetime</div>
                  <div className="v5-stat__value">{formatCacheTtl(parsedGlobalTtl)}</div>
                  <div className="v5-chips">
                    <span className="v5-chip v5-chip--muted">
                      {autoScanEnabled ? "Auto-scan on" : "Auto-scan off"}
                    </span>
                    <span className="v5-chip v5-chip--muted">
                      {manualOnlyMode ? "Manual enrich" : "Auto enrich"}
                    </span>
                  </div>
                </div>
                <div className="v5-stat">
                  <div className="v5-stat__label">Security</div>
                  <div className="v5-stat__value" style={{ fontSize: 16 }}>
                    Local storage
                  </div>
                  <div className="v5-chips">
                    <span className="v5-chip">No shared service</span>
                    <span className="v5-chip">Keys never sent</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="scanning" className="v5-card" aria-labelledby="scanning-heading">
            <div className="v5-card__head">
              <h2 id="scanning-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.scanning}
                  aria-controls="scanning-body"
                  onClick={() => toggleSection("scanning")}
                >
                  <span className="v5-card__toggle-text">Scanning</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">Control when VERA5 inspects pages for indicators.</p>
            </div>
            <div id="scanning-body" className="v5-card__body" hidden={collapsedSections.scanning}>
              <ToggleRow
                label="Automatically scan when the page changes"
                hint="When off, scan only with Scan page in the side-panel workspace or the keyboard shortcut."
                ariaLabel="Automatically scan when the page changes"
                checked={autoScanEnabled}
                disabled={!ready}
                onChange={handleAutoScanToggle}
              />
            </div>
          </section>

          <section id="indicators" className="v5-card" aria-labelledby="indicators-heading">
            <div className="v5-card__head">
              <h2 id="indicators-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.indicators}
                  aria-controls="indicators-body"
                  onClick={() => toggleSection("indicators")}
                >
                  <span className="v5-card__toggle-text">Indicator Types</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Choose which indicator types Vera5 detects during page scans. Disabled types are
                omitted from highlights and scan counts.
              </p>
            </div>
            <div
              id="indicators-body"
              className="v5-card__body"
              hidden={collapsedSections.indicators}
            >
              <div className="v5-ioc-grid">
                {IOC_TYPE_SETTINGS_ORDER.map((iocType) => (
                  <label key={iocType} className="v5-ioc-card">
                    <input
                      type="checkbox"
                      className="v5-ioc-card__input"
                      checked={iocTypeEnabled[iocType] !== false}
                      disabled={!ready}
                      onChange={(event) => handleIocTypeToggle(iocType, event.target.checked)}
                      aria-label={`Enable ${IOC_TYPE_OPTION_LABELS[iocType]}`}
                    />
                    <span className="v5-ioc-card__badge">{IOC_TYPE_CODES[iocType]}</span>
                    <span className="v5-ioc-card__text">
                      <span className="v5-ioc-card__name">{IOC_TYPE_SHORT_LABELS[iocType]}</span>
                    </span>
                    <span className="v5-ioc-card__check">
                      <CheckIcon />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section id="sources" className="v5-card" aria-labelledby="sources-heading">
            <div className="v5-card__head">
              <h2 id="sources-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.sources}
                  aria-controls="sources-body"
                  onClick={() => toggleSection("sources")}
                >
                  <span className="v5-card__toggle-text">Enrichment Sources</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Choose which threat intelligence sources Vera5 may use when enrichment is available.
                Disabled sources stay off the hover card and are not queried.
              </p>
            </div>
            <div id="sources-body" className="v5-card__body" hidden={collapsedSections.sources}>
              <ToggleRow
                label="Use local backend"
                hint="When on, Vera5 routes enrichment through an optional FastAPI server on this machine (127.0.0.1). When off, enrichment runs inside the extension."
                ariaLabel="Use local backend"
                checked={localBackendEnabled}
                disabled={!ready}
                onChange={handleLocalBackendToggle}
              />
              <ToggleRow
                label="Manual-only enrichment"
                hint="When on, threat intelligence loads only when you use the enrich control on a highlight. When off, Vera5 may request enrichment automatically when you open an indicator card."
                ariaLabel="Manual-only enrichment"
                checked={manualOnlyMode}
                disabled={!ready}
                onChange={handleManualOnlyToggle}
              />
              <ToggleRow
                label="Show disabled sources in workspace"
                hint="When off, disabled enrichment sources are hidden from workspace Sources and Recommended pivots."
                ariaLabel="Show disabled sources in workspace"
                checked={showDisabledSourcesInWorkspace}
                disabled={!ready}
                onChange={handleShowDisabledSourcesToggle}
              />
              <div className="v5-sources">
                {ENRICHMENT_SOURCE_ORDER.map((sourceId) => {
                  const status = sourceStatus(sourceId);
                  const keyed = OPTIONS_API_KEY_SLOTS.includes(sourceId);
                  return (
                    <div key={sourceId} className="v5-source">
                      <div className="v5-source__head">
                        <span className="v5-source__title">
                          <span className="v5-source__name">
                            {ENRICHMENT_SOURCE_LABELS[sourceId]}
                          </span>
                          <span className={`v5-badge ${status.className}`}>
                            {status.withDot ? <span className="v5-badge__dot" /> : null}
                            {status.label}
                          </span>
                        </span>
                        <span className="v5-source__spacer" />
                        <Switch
                          ariaLabel={`Enable ${ENRICHMENT_SOURCE_LABELS[sourceId]}`}
                          checked={enrichmentSourceEnabled[sourceId] === true}
                          disabled={!ready}
                          onChange={(checked) => handleSourceToggle(sourceId, checked)}
                        />
                      </div>
                      <div className="v5-source__body">
                        <p className="v5-row__hint" style={{ margin: 0 }}>
                          {ENRICHMENT_SOURCE_DESCRIPTIONS[sourceId]}
                        </p>
                        <div className="v5-source__row">
                          <label style={{ display: "block" }}>
                            <span className="v5-field__label" style={{ marginBottom: 6 }}>
                              Cache lifetime (seconds, optional)
                            </span>
                            <input
                              type="number"
                              min={0}
                              className="v5-input v5-input--sm"
                              value={sourceCacheTtlDrafts[sourceId]}
                              disabled={!ready}
                              placeholder="Use default"
                              onChange={(event) =>
                                setSourceCacheTtlDraftsState((current) => ({
                                  ...current,
                                  [sourceId]: event.target.value,
                                }))
                              }
                              onBlur={() => handleSourceCacheTtlBlur(sourceId)}
                              aria-label={`${ENRICHMENT_SOURCE_LABELS[sourceId]} cache lifetime in seconds`}
                            />
                          </label>
                          {keyed ? (
                            <button
                              type="button"
                              className="v5-btn v5-btn--link"
                              onClick={() => handleNavClick("api-keys")}
                            >
                              Manage API key →
                            </button>
                          ) : (
                            <span
                              className="v5-status v5-status--muted"
                              style={{ marginTop: 0, alignSelf: "center" }}
                            >
                              No API key required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="v5-status v5-status--muted" style={{ marginTop: 12, marginBottom: 0 }}>
                {ENRICHMENT_SOURCE_OPS_WORKSPACE_GUIDANCE}
              </p>
            </div>
          </section>

          <section id="pivots" className="v5-card" aria-labelledby="pivots-heading">
            <div className="v5-card__head">
              <h2 id="pivots-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.pivots}
                  aria-controls="pivots-body"
                  onClick={() => toggleSection("pivots")}
                >
                  <span className="v5-card__toggle-text">Pivots</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Choose which categories and intel sites appear under right-click → Pivots. This does
                not enable or disable live enrichment queries.
              </p>
            </div>
            <div id="pivots-body" className="v5-card__body" hidden={collapsedSections.pivots}>
              <ToggleRow
                label={getConnectorSourceClassLabel(CONNECTOR_SOURCE_CLASS.AUTHORITATIVE)}
                hint="Show the Authoritative submenu (AbuseIPDB, VirusTotal, RDAP WHOIS, and related sites)."
                ariaLabel="Show Authoritative pivots category"
                checked={
                  pivotContextMenuCategoryEnabled[CONNECTOR_SOURCE_CLASS.AUTHORITATIVE] !== false
                }
                disabled={!ready}
                onChange={(checked) =>
                  handlePivotContextMenuCategoryToggle(
                    CONNECTOR_SOURCE_CLASS.AUTHORITATIVE,
                    checked
                  )
                }
              />
              <ToggleRow
                label={getConnectorSourceClassLabel(CONNECTOR_SOURCE_CLASS.COMMUNITY)}
                hint="Show the Community submenu (OTX, MalwareBazaar, URLHaus, and related sites)."
                ariaLabel="Show Community pivots category"
                checked={
                  pivotContextMenuCategoryEnabled[CONNECTOR_SOURCE_CLASS.COMMUNITY] !== false
                }
                disabled={!ready}
                onChange={(checked) =>
                  handlePivotContextMenuCategoryToggle(CONNECTOR_SOURCE_CLASS.COMMUNITY, checked)
                }
              />
              {listPivotContextMenuCategories().map((category) => (
                <div key={category.id} className="v5-sources" style={{ marginTop: 16 }}>
                  <p className="v5-field__label" style={{ marginBottom: 8 }}>
                    {category.title} sites
                  </p>
                  {category.providers.map((provider) => (
                    <div key={provider} className="v5-source">
                      <div className="v5-source__head">
                        <span className="v5-source__title">
                          <span className="v5-source__name">
                            {pivotContextMenuSiteTitle(provider)}
                          </span>
                        </span>
                        <span className="v5-source__spacer" />
                        <Switch
                          ariaLabel={`Show ${pivotContextMenuSiteTitle(provider)} in Pivots menu`}
                          checked={pivotContextMenuSiteEnabled[provider] !== false}
                          disabled={
                            !ready ||
                            pivotContextMenuCategoryEnabled[category.sourceClass] === false
                          }
                          onChange={(checked) =>
                            handlePivotContextMenuSiteToggle(provider, checked)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section id="api-keys" className="v5-card" aria-labelledby="api-keys-heading">
            <div className="v5-card__head">
              <h2 id="api-keys-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["api-keys"]}
                  aria-controls="api-keys-body"
                  onClick={() => toggleSection("api-keys")}
                >
                  <span className="v5-card__toggle-text">API Keys</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Keys are stored locally in your browser. Vera5 does not operate a shared enrichment
                service or receive your credentials.
              </p>
            </div>
            <div
              id="api-keys-body"
              className="v5-card__body"
              hidden={collapsedSections["api-keys"]}
            >
              {OPTIONS_API_KEY_SLOTS.map((slot) => (
                <ApiKeyField
                  key={slot}
                  slot={slot}
                  label={ENRICHMENT_SOURCE_LABELS[slot]}
                  ready={ready}
                  fieldState={fieldStates[slot]}
                  onDraftChange={handleDraftChange}
                  onEditingChange={handleEditingChange}
                  onPersist={handlePersist}
                  onSaved={handleSaved}
                />
              ))}
              <ApiKeyField
                slot={CENSYS_SECRET_API_KEY_SLOT}
                label="Censys API secret"
                ready={ready}
                fieldState={fieldStates[CENSYS_SECRET_API_KEY_SLOT]}
                onDraftChange={handleDraftChange}
                onEditingChange={handleEditingChange}
                onPersist={handlePersist}
                onSaved={handleSaved}
              />
            </div>
          </section>

          <section
            id="local-ai-summary"
            className="v5-card"
            aria-labelledby="local-ai-summary-heading"
          >
            <div className="v5-card__head">
              <h2 id="local-ai-summary-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["local-ai-summary"]}
                  aria-controls="local-ai-summary-body"
                  onClick={() => toggleSection("local-ai-summary")}
                >
                  <span className="v5-card__toggle-text">Local AI Summary</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Optional narrative summaries from a model you run on this machine. Vera5 sends
                normalized enrichment JSON only—never page content or API keys.
              </p>
            </div>
            <div
              id="local-ai-summary-body"
              className="v5-card__body"
              hidden={collapsedSections["local-ai-summary"]}
            >
              <ToggleRow
                label="Enable local AI summary"
                hint="When on, Vera5 can request markdown summaries from an OpenAI-compatible endpoint on 127.0.0.1. Off by default until you opt in."
                ariaLabel="Enable local AI summary"
                checked={localLlmSummaryEnabled}
                disabled={!ready}
                onChange={handleLocalLlmSummaryToggle}
              />
            </div>
          </section>

          <section id="trust" className="v5-card" aria-labelledby="trust-heading">
            <div className="v5-card__head">
              <h2 id="trust-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.trust}
                  aria-controls="trust-body"
                  onClick={() => toggleSection("trust")}
                >
                  <span className="v5-card__toggle-text">Trust &amp; Consent</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Control transparency before live enrichment queries leave this browser.
              </p>
            </div>
            <div id="trust-body" className="v5-card__body" hidden={collapsedSections.trust}>
              <ToggleRow
                label="Quiet mode"
                hint="When on, Vera5 blocks outbound live vendor enrichment. Use this in sensitive environments where threat-intel API calls must not leave the browser."
                ariaLabel="Quiet mode"
                checked={quietModeActive}
                disabled={!ready}
                onChange={handleQuietModeToggle}
              />
              <ul
                className="v5-domain-list"
                aria-label="Quiet mode blocked and allowed actions"
                style={{ marginBottom: 16 }}
              >
                <li className="v5-domain-list__item">
                  <strong>Blocked while on:</strong> live vendor enrichment, bulk enrich queues, and
                  macro enrich steps that would call vendors.
                </li>
                <li className="v5-domain-list__item">
                  <strong>Still available:</strong> local indicator detection and highlights, cached
                  enrichment on hover cards, and opening attributed pivot links you choose in a new
                  tab.
                </li>
              </ul>
              <ToggleRow
                label="Scan link attributes for IOCs"
                hint="Off by default. When on, Vera5 reads allowlisted link and attribute values (for example href and src) on pages you scan—in addition to visible text. Password fields and hidden inputs are never scanned."
                ariaLabel="Scan link attributes for IOCs"
                checked={attributeHrefExtractionEnabled}
                disabled={!ready}
                onChange={handleAttributeHrefExtractionToggle}
              />
              <ToggleRow
                label="Remember per-site attribute scan choices"
                hint="Optional. When on, you can save always-on or always-off choices per hostname. Per-site rules never enable attribute scanning when the global toggle above is off."
                ariaLabel="Remember per-site attribute scan choices"
                checked={attributeHrefExtractionRememberSiteChoices}
                disabled={!ready || !attributeHrefExtractionEnabled}
                onChange={handleAttributeHrefRememberSiteChoicesToggle}
              />
              {attributeHrefExtractionEnabled && attributeHrefExtractionRememberSiteChoices ? (
                <fieldset className="v5-field" disabled={!ready}>
                  <legend className="v5-field__label">Per-site attribute scan overrides</legend>
                  <span
                    className="v5-status v5-status--muted"
                    style={{ display: "block", marginBottom: 8 }}
                  >
                    Hostnames saved here apply only when link attribute scanning is enabled
                    globally. Use <strong>Never scan attributes</strong> on sensitive sites or{" "}
                    <strong>Always scan attributes</strong> on trusted CTI paste hosts.
                  </span>
                  <form
                    className="v5-actions"
                    style={{ marginBottom: 8 }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddAttributeHrefSitePreference();
                    }}
                  >
                    <input
                      className="v5-input v5-input--sm"
                      type="text"
                      aria-label="Per-site attribute scan hostname"
                      placeholder="example.com"
                      value={attributeHrefSitePreferenceHostDraft}
                      onChange={(event) =>
                        setAttributeHrefSitePreferenceHostDraft(event.target.value)
                      }
                    />
                    <select
                      className="v5-input v5-input--sm"
                      aria-label="Per-site attribute scan choice"
                      value={attributeHrefSitePreferenceModeDraft}
                      onChange={(event) =>
                        setAttributeHrefSitePreferenceModeDraft(
                          event.target.value as AttributeHrefSitePreference
                        )
                      }
                    >
                      <option value="off">Never scan attributes</option>
                      <option value="on">Always scan attributes</option>
                    </select>
                    <button
                      type="submit"
                      className="v5-btn v5-btn--primary"
                      aria-label="Add per-site attribute scan override"
                    >
                      Add
                    </button>
                  </form>
                  <ul className="v5-domain-list" aria-label="Per-site overrides">
                    {Object.entries(attributeHrefExtractionSitePreferences)
                      .sort(([leftHost], [rightHost]) => leftHost.localeCompare(rightHost))
                      .map(([host, preference]) => (
                        <li key={host} className="v5-domain-list__item">
                          <span>
                            <code>{host}</code>
                            {" — "}
                            {preference === "off"
                              ? "Never scan attributes"
                              : "Always scan attributes"}
                          </span>
                          <button
                            type="button"
                            className="v5-btn v5-btn--link"
                            aria-label={`Remove ${host} attribute scan override`}
                            onClick={() => handleRemoveAttributeHrefSitePreference(host)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                  </ul>
                </fieldset>
              ) : null}
              <ToggleRow
                label="Show pre-query notices"
                hint="When on, Vera5 shows a notice before sending an indicator value to a vendor you enabled during live enrichment."
                ariaLabel="Show pre-query notices"
                checked={showPreQueryNotices}
                disabled={!ready}
                onChange={handleShowPreQueryNoticesToggle}
              />
              <fieldset className="v5-field" disabled={!ready}>
                <legend className="v5-field__label">Domain policy mode</legend>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Controls auto-scan and live enrichment on the current tab hostname. Pattern syntax
                  supports exact hosts, prefix wildcards such as <code>mail.*</code>, and suffix
                  wildcards such as <code>*.corp.example</code>.
                </span>
                <div className="v5-domain-mode">
                  <label className="v5-domain-mode__option">
                    <input
                      type="radio"
                      name="domainPolicyMode"
                      checked={domainPolicyMode === DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT}
                      onChange={() =>
                        handleDomainPolicyModeChange(DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT)
                      }
                    />
                    <span className="v5-row__text">
                      <span className="v5-row__label">Allow by default</span>
                      <span className="v5-row__hint">
                        Scan and enrich on all hosts except those on the denylist.
                      </span>
                    </span>
                  </label>
                  <label className="v5-domain-mode__option">
                    <input
                      type="radio"
                      name="domainPolicyMode"
                      checked={domainPolicyMode === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT}
                      onChange={() =>
                        handleDomainPolicyModeChange(DOMAIN_POLICY_MODE_DENY_BY_DEFAULT)
                      }
                    />
                    <span className="v5-row__text">
                      <span className="v5-row__label">Deny by default</span>
                      <span className="v5-row__hint">
                        Scan and enrich only on hosts in the allowlist.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
              <ToggleRow
                label="Apply domain policy to live enrichment"
                hint="When on, denylisted hosts (or hosts outside the allowlist in deny-by-default mode) block vendor calls before pre-query disclosure."
                ariaLabel="Apply domain policy to live enrichment"
                checked={domainPolicyEnrichGateEnabled}
                disabled={!ready}
                onChange={handleDomainPolicyEnrichGateToggle}
              />
              <div className="v5-field">
                <span className="v5-field__label">Default-safe presets</span>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Vera5 ships <strong>allow by default</strong> as the product default with a
                  built-in sensitive webmail denylist. Presets merge additional patterns into your
                  lists without removing entries you added manually.
                </span>
                <div className="v5-presets">
                  {DOMAIN_POLICY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="v5-preset"
                      disabled={!ready}
                      aria-label={`Apply ${preset.label} preset`}
                      onClick={() => handleApplyDomainPolicyPreset(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {DOMAIN_POLICY_PRESETS.map((preset) => (
                  <p
                    key={`${preset.id}-description`}
                    className="v5-row__hint"
                    style={{ marginTop: 8, marginBottom: 0 }}
                  >
                    {preset.label}: {preset.description} Sets policy mode to{" "}
                    {preset.recommendedMode === DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
                      ? "allow by default"
                      : "deny by default"}
                    .
                  </p>
                ))}
              </div>
              <DomainPolicyListEditor
                label="Denylist"
                hint={
                  domainPolicyMode === DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
                    ? "Hosts that must not auto-scan or receive live enrichment. Default installs include sensitive webmail patterns; add banking, health, or HR entries here or via a preset."
                    : "Optional extra blocks even when a host is allowlisted."
                }
                inputAriaLabel="Denylist entry pattern"
                addButtonAriaLabel="Add domain to denylist"
                entries={domainDenylist}
                draft={denylistDraft}
                disabled={!ready}
                onDraftChange={setDenylistDraft}
                onAdd={handleAddDenylistEntry}
                onRemove={handleRemoveDenylistEntry}
              />
              <DomainPolicyListEditor
                label="Allowlist"
                hint={
                  domainPolicyMode === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT
                    ? "Only these hosts may auto-scan or receive live enrichment."
                    : "Ignored while allow-by-default is selected; entries are kept for export and for switching to deny-by-default."
                }
                inputAriaLabel="Allowlist entry pattern"
                addButtonAriaLabel="Add domain to allowlist"
                entries={domainAllowlist}
                draft={allowlistDraft}
                disabled={!ready}
                onDraftChange={setAllowlistDraft}
                onAdd={handleAddAllowlistEntry}
                onRemove={handleRemoveAllowlistEntry}
              />
              <div className="v5-field">
                <span className="v5-field__label">Internal asset lists</span>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Block live enrichment when an indicator matches your known internal domains, IPv4
                  CIDR ranges, or labeled vendor/SaaS hostname patterns. Lists apply to the
                  indicator value, not the page hostname.
                </span>
              </div>
              <ToggleRow
                label="Block external enrich for internal asset matches"
                hint="When on, matching indicators skip vendor calls before pre-query disclosure."
                ariaLabel="Block external enrich for internal asset matches"
                checked={internalAssetEnrichGateEnabled}
                disabled={!ready}
                onChange={handleInternalAssetEnrichGateToggle}
              />
              <DomainPolicyListEditor
                label="Internal domains"
                hint="Exact hosts or wildcard patterns for domain and URL indicators."
                inputAriaLabel="Internal domain pattern"
                addButtonAriaLabel="Add internal domain"
                entries={internalAssetDomains}
                draft={internalAssetDomainDraft}
                disabled={!ready}
                onDraftChange={setInternalAssetDomainDraft}
                onAdd={handleAddInternalAssetDomain}
                onRemove={handleRemoveInternalAssetDomain}
              />
              <DomainPolicyListEditor
                label="Internal IPv4 CIDR ranges"
                hint="IPv4 addresses in these ranges block enrichment for matching IPv4 indicators (for example 10.0.0.0/8)."
                inputAriaLabel="Internal IPv4 CIDR range"
                addButtonAriaLabel="Add internal CIDR range"
                entries={internalAssetCidrRanges}
                draft={internalAssetCidrDraft}
                disabled={!ready}
                onDraftChange={setInternalAssetCidrDraft}
                onAdd={handleAddInternalAssetCidr}
                onRemove={handleRemoveInternalAssetCidr}
              />
              <InternalAssetVendorLabelListEditor
                label="Vendor and SaaS labels"
                hint="Named patterns for corporate SaaS or VPN hosts on domain and URL indicators."
                entries={internalAssetVendorLabels}
                labelDraft={internalAssetVendorLabelDraft}
                patternDraft={internalAssetVendorPatternDraft}
                disabled={!ready}
                onLabelDraftChange={setInternalAssetVendorLabelDraft}
                onPatternDraftChange={setInternalAssetVendorPatternDraft}
                onAdd={handleAddInternalAssetVendorLabel}
                onRemove={handleRemoveInternalAssetVendorLabel}
              />
              <fieldset className="v5-field" disabled={!ready}>
                <legend className="v5-field__label">Treat this site as …</legend>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Save a page-type override per hostname. Overrides persist locally and adjust IOC
                  priority, tray layout, and export defaults for that site.
                </span>
                {activeTabPageContextOverrideHost &&
                pageContextSiteModeOverrides[activeTabPageContextOverrideHost] ? (
                  <div
                    className="v5-status"
                    role="status"
                    style={{ display: "block", marginBottom: 8 }}
                  >
                    Active tab override:{" "}
                    <strong>
                      {
                        PAGE_CONTEXT_TYPE_LABEL[
                          pageContextSiteModeOverrides[activeTabPageContextOverrideHost]!
                        ]
                      }
                    </strong>{" "}
                    for <code>{activeTabPageContextOverrideHost}</code>.{" "}
                    <button
                      type="button"
                      className="v5-btn v5-btn--link"
                      aria-label={`Reset ${activeTabPageContextOverrideHost} to auto-detect`}
                      onClick={() =>
                        handleRemovePageContextSiteModeOverride(activeTabPageContextOverrideHost)
                      }
                    >
                      Reset to auto-detect
                    </button>
                  </div>
                ) : null}
                <form
                  className="v5-actions"
                  style={{ marginBottom: 8 }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleAddPageContextSiteModeOverride();
                  }}
                >
                  <input
                    className="v5-input v5-input--sm"
                    type="text"
                    aria-label="Page context override hostname"
                    placeholder="example.com"
                    value={pageContextSiteModeOverrideHostDraft}
                    onChange={(event) =>
                      setPageContextSiteModeOverrideHostDraft(event.target.value)
                    }
                  />
                  <select
                    className="v5-input v5-input--sm"
                    aria-label="Page context override type"
                    value={pageContextSiteModeOverrideTypeDraft}
                    onChange={(event) =>
                      setPageContextSiteModeOverrideTypeDraft(event.target.value as PageContextType)
                    }
                  >
                    {PAGE_CONTEXT_TYPE_ORDER.map((pageContextType) => (
                      <option key={pageContextType} value={pageContextType}>
                        {PAGE_CONTEXT_TYPE_LABEL[pageContextType]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="v5-btn v5-btn--primary"
                    aria-label="Add page context site override"
                  >
                    Add
                  </button>
                </form>
                {Object.keys(pageContextSiteModeOverrides).length > 0 ? (
                  <div className="v5-actions" style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className="v5-btn"
                      aria-label="Clear all page context site overrides"
                      onClick={handleClearAllPageContextSiteModeOverrides}
                    >
                      Clear all overrides
                    </button>
                  </div>
                ) : null}
                <ul className="v5-domain-list" aria-label="Page context site overrides">
                  {Object.entries(pageContextSiteModeOverrides)
                    .sort(([leftHost], [rightHost]) => leftHost.localeCompare(rightHost))
                    .map(([host, pageContextType]) => (
                      <li
                        key={host}
                        className={`v5-domain-list__item${
                          host === activeTabPageContextOverrideHost
                            ? " v5-domain-list__item--override-active"
                            : ""
                        }`}
                      >
                        <span>
                          <code>{host}</code>
                          {" — "}
                          {PAGE_CONTEXT_TYPE_LABEL[pageContextType]}
                          {host === activeTabPageContextOverrideHost ? (
                            <>
                              {" "}
                              <strong>(active tab)</strong>
                            </>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          className="v5-btn v5-btn--link"
                          aria-label={`Reset ${host} to auto-detect`}
                          onClick={() => handleRemovePageContextSiteModeOverride(host)}
                        >
                          Reset to auto-detect
                        </button>
                      </li>
                    ))}
                </ul>
              </fieldset>
              <div className="v5-field">
                <span className="v5-field__label">Analyst workflow presets</span>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Apply SOC, CTI, or DFIR defaults for enrichment toggles, quiet mode where
                  recommended, the default export template, and recommended pivot ordering.
                </span>
                <div className="v5-presets">
                  {ANALYST_MODE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`v5-preset${
                        analystModePresetId === preset.id ? " v5-preset--active" : ""
                      }`}
                      disabled={!ready}
                      aria-label={`Apply ${preset.label} preset`}
                      aria-pressed={analystModePresetId === preset.id}
                      onClick={() => handleApplyAnalystModePreset(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {ANALYST_MODE_PRESETS.map((preset) => (
                  <p
                    key={`${preset.id}-description`}
                    className="v5-row__hint"
                    style={{ marginTop: 8, marginBottom: 0 }}
                  >
                    {preset.label}: {preset.description} Default export template:{" "}
                    {preset.defaultExportTemplateId.replace(/-/g, " ")}.
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section
            id="operator-macros"
            className="v5-card"
            aria-labelledby="operator-macros-heading"
          >
            <div className="v5-card__head">
              <h2 id="operator-macros-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["operator-macros"]}
                  aria-controls="operator-macros-body"
                  onClick={() => toggleSection("operator-macros")}
                >
                  <span className="v5-card__toggle-text">Operator Macros</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Create local-only step sequences for repeatable analyst playbooks. Macros stay on
                this browser profile and never sync through Vera5 cloud infrastructure.
              </p>
            </div>
            <div
              id="operator-macros-body"
              className="v5-card__body"
              hidden={collapsedSections["operator-macros"]}
            >
              <span
                className="v5-status v5-status--muted"
                style={{ display: "block", marginBottom: 12 }}
              >
                Built-in playbooks ship with the extension. Create, duplicate, reorder, and delete
                your own macros here. Configure individual steps from the macro editor.
              </span>
              <ul
                className="v5-domain-list"
                aria-label="Suggested macros by page profile"
                style={{ marginBottom: 12 }}
              >
                {PAGE_CONTEXT_TYPE_ORDER.filter(
                  (pageContextType) => PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_BY_TYPE[pageContextType]
                ).map((pageContextType) => (
                  <li key={pageContextType} className="v5-domain-list__item">
                    <span className="v5-row__hint" style={{ margin: 0 }}>
                      {PAGE_CONTEXT_TYPE_LABEL[pageContextType]} suggests{" "}
                      <code>{PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_BY_TYPE[pageContextType]}</code>{" "}
                      unless a per-site page profile override is active.
                    </span>
                  </li>
                ))}
              </ul>
              {operatorMacroFeedback ? (
                <span
                  className={`v5-status${
                    operatorMacroActionState === "error"
                      ? " v5-status--error"
                      : " v5-status--success"
                  }`}
                  role="status"
                  style={{ display: "block", marginBottom: 12 }}
                >
                  {operatorMacroActionState === "error" ? null : <CheckIcon />}
                  {operatorMacroFeedback}
                </span>
              ) : null}
              <OperatorMacrosListEditor
                macros={operatorMacros}
                disabled={!ready || operatorMacroActionState === "busy"}
                onCreate={handleOpenCreateOperatorMacro}
                onEdit={handleOpenEditOperatorMacro}
                onDuplicate={handleDuplicateOperatorMacro}
                onDelete={handleDeleteOperatorMacro}
                onMoveUp={handleMoveOperatorMacroUp}
                onMoveDown={handleMoveOperatorMacroDown}
              />
              <div className="v5-actions" style={{ marginTop: 16, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="v5-btn"
                  disabled={
                    !ready ||
                    operatorMacroActionState === "busy" ||
                    operatorMacroPackExportState === "exporting"
                  }
                  onClick={handleExportOperatorMacroPack}
                  aria-label="Export user macro pack JSON"
                >
                  {operatorMacroPackExportState === "exporting"
                    ? "Exporting…"
                    : "Export macro pack"}
                </button>
                <button
                  type="button"
                  className="v5-btn"
                  disabled={
                    !ready ||
                    operatorMacroActionState === "busy" ||
                    operatorMacroPackImportState === "importing"
                  }
                  onClick={handleOperatorMacroPackImportClick}
                  aria-label="Import user macro pack JSON"
                >
                  {operatorMacroPackImportState === "importing"
                    ? "Importing…"
                    : "Import macro pack"}
                </button>
                <input
                  ref={operatorMacroPackImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import user macro pack JSON file"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{ display: "none" }}
                  onChange={handleOperatorMacroPackImportFileChange}
                />
              </div>
              <span className="v5-row__hint" style={{ display: "block", marginTop: 8 }}>
                Export or import your custom macros as JSON for backup across browser profiles.
                Built-in playbooks and API keys are never included.
              </span>
            </div>
          </section>

          <section id="cache" className="v5-card" aria-labelledby="cache-heading">
            <div className="v5-card__head">
              <h2 id="cache-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.cache}
                  aria-controls="cache-body"
                  onClick={() => toggleSection("cache")}
                >
                  <span className="v5-card__toggle-text">Enrichment Cache</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Vera5 stores recent threat intelligence responses locally to reduce API usage.
                Clearing the cache removes saved responses; your settings and API keys are not
                affected.
              </p>
            </div>
            <div id="cache-body" className="v5-card__body" hidden={collapsedSections.cache}>
              <div className="v5-field">
                <span className="v5-field__label">Default cache lifetime</span>
                <div className="v5-presets">
                  {CACHE_PRESETS.map((preset) => (
                    <button
                      key={preset.seconds}
                      type="button"
                      className={`v5-preset${
                        parsedGlobalTtl === preset.seconds ? " v5-preset--active" : ""
                      }`}
                      disabled={!ready}
                      onClick={() => applyGlobalCachePreset(preset.seconds)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  className="v5-input v5-input--sm"
                  value={globalCacheTtlSeconds}
                  disabled={!ready}
                  onChange={(event) => setGlobalCacheTtlSecondsState(event.target.value)}
                  onBlur={handleGlobalCacheTtlBlur}
                  aria-label="Default cache lifetime in seconds"
                />
                <span className="v5-status v5-status--muted">
                  Custom value in seconds. Per-source overrides use this default when left blank.
                </span>
              </div>
              <div className="v5-actions">
                <button
                  type="button"
                  className="v5-btn v5-btn--danger"
                  disabled={!ready || clearCacheState === "clearing"}
                  onClick={handleClearCache}
                  aria-label="Clear enrichment cache"
                >
                  {clearCacheState === "clearing" ? "Clearing…" : "Clear cache"}
                </button>
                {clearCacheState === "cleared" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    Enrichment cache cleared.
                  </span>
                ) : null}
                {clearCacheState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    Could not clear the cache. Try again.
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section id="correlation" className="v5-card" aria-labelledby="correlation-heading">
            <div className="v5-card__head">
              <h2 id="correlation-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.correlation}
                  aria-controls="correlation-body"
                  onClick={() => toggleSection("correlation")}
                >
                  <span className="v5-card__toggle-text">Cross-session correlation</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Local Appeared across sessions clusters and pack settings. Correlation ≠ causation;
                co-occurrence is not a detection verdict. Clearing clusters does not delete
                investigation session history.
              </p>
            </div>
            <div
              id="correlation-body"
              className="v5-card__body"
              hidden={collapsedSections.correlation}
            >
              <div className="v5-field">
                <label className="v5-field__label" htmlFor="correlation-retention-days">
                  Retention window (days)
                </label>
                <input
                  id="correlation-retention-days"
                  type="number"
                  min={MIN_CORRELATION_CLUSTER_RETENTION_DAYS}
                  max={MAX_CORRELATION_CLUSTER_RETENTION_DAYS}
                  className="v5-input v5-input--sm"
                  value={correlationRetentionDays}
                  disabled={!ready}
                  onChange={(event) => setCorrelationRetentionDays(event.target.value)}
                  onBlur={handleCorrelationRetentionBlur}
                  aria-label="Correlation cluster retention window in days"
                />
                <span className="v5-status v5-status--muted">
                  Default {DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS} days. Clusters whose last
                  seen timestamp is older than this window are pruned from local storage.
                </span>
              </div>
              <div className="v5-field">
                <label className="v5-field__label" htmlFor="correlation-overlap-mode">
                  Overlap merge
                </label>
                <select
                  id="correlation-overlap-mode"
                  className="v5-input"
                  disabled={!ready}
                  value={correlationOverlapMode}
                  onChange={(event) =>
                    handleCorrelationOverlapModeChange(
                      event.target.value as CorrelationOverlapModeDraft
                    )
                  }
                  aria-label="Correlation cluster overlap merge mode"
                >
                  <option value="off">Exact IOC sets only (no overlap merge)</option>
                  <option value="jaccard">Jaccard index threshold</option>
                  <option value="minShared">Minimum shared indicators</option>
                </select>
                <span className="v5-status v5-status--muted">
                  Optional merge when indicator sets partly overlap across sessions. Advisory
                  only—not a verdict.
                </span>
              </div>
              {correlationOverlapMode === "jaccard" ? (
                <div className="v5-field">
                  <label className="v5-field__label" htmlFor="correlation-jaccard-threshold">
                    Jaccard threshold
                  </label>
                  <input
                    id="correlation-jaccard-threshold"
                    type="number"
                    min={MIN_CORRELATION_CLUSTER_JACCARD_THRESHOLD}
                    max={MAX_CORRELATION_CLUSTER_JACCARD_THRESHOLD}
                    step={0.05}
                    className="v5-input v5-input--sm"
                    value={correlationJaccardThreshold}
                    disabled={!ready}
                    onChange={(event) => setCorrelationJaccardThreshold(event.target.value)}
                    onBlur={handleCorrelationJaccardThresholdBlur}
                    aria-label="Correlation cluster Jaccard overlap threshold"
                  />
                  <span className="v5-status v5-status--muted">
                    Inclusive 0–1. Default {DEFAULT_CORRELATION_CLUSTER_JACCARD_THRESHOLD}.
                  </span>
                </div>
              ) : null}
              {correlationOverlapMode === "minShared" ? (
                <div className="v5-field">
                  <label className="v5-field__label" htmlFor="correlation-min-shared">
                    Minimum shared indicators
                  </label>
                  <input
                    id="correlation-min-shared"
                    type="number"
                    min={MIN_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT}
                    max={MAX_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT}
                    className="v5-input v5-input--sm"
                    value={correlationMinSharedCount}
                    disabled={!ready}
                    onChange={(event) => setCorrelationMinSharedCount(event.target.value)}
                    onBlur={handleCorrelationMinSharedBlur}
                    aria-label="Correlation cluster minimum shared indicator count"
                  />
                  <span className="v5-status v5-status--muted">
                    Default {DEFAULT_CORRELATION_CLUSTER_MIN_SHARED_IOC_COUNT}.
                  </span>
                </div>
              ) : null}
              <div className="v5-actions">
                <button
                  type="button"
                  className="v5-btn v5-btn--danger"
                  disabled={!ready || clearCorrelationClustersState === "clearing"}
                  onClick={handleClearCorrelationClusters}
                  aria-label="Clear all correlation clusters"
                >
                  {clearCorrelationClustersState === "clearing"
                    ? "Clearing…"
                    : "Clear all clusters"}
                </button>
                <span className="v5-status v5-status--muted">
                  {correlationClusterCount} stored cluster
                  {correlationClusterCount === 1 ? "" : "s"}
                </span>
                {clearCorrelationClustersState === "cleared" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    Correlation clusters cleared.
                  </span>
                ) : null}
                {clearCorrelationClustersState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    Could not clear correlation clusters. Try again.
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section
            id="relationship-memory"
            className="v5-card"
            aria-labelledby="relationship-memory-heading"
          >
            <div className="v5-card__head">
              <h2 id="relationship-memory-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["relationship-memory"]}
                  aria-controls="relationship-memory-body"
                  onClick={() => toggleSection("relationship-memory")}
                >
                  <span className="v5-card__toggle-text">Relationship memory</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Local Previously appeared with entity relationships. Correlation ≠ causation;
                co-occurrence is not a detection verdict. Clearing relationship memory does not
                delete investigation session history.
              </p>
            </div>
            <div
              id="relationship-memory-body"
              className="v5-card__body"
              hidden={collapsedSections["relationship-memory"]}
            >
              <div className="v5-field">
                <label className="v5-field__label" htmlFor="relationship-retention-days">
                  Retention window (days)
                </label>
                <input
                  id="relationship-retention-days"
                  type="number"
                  min={MIN_RELATIONSHIP_EDGE_RETENTION_DAYS}
                  max={MAX_RELATIONSHIP_EDGE_RETENTION_DAYS}
                  className="v5-input v5-input--sm"
                  value={relationshipRetentionDays}
                  disabled={!ready}
                  onChange={(event) => setRelationshipRetentionDays(event.target.value)}
                  onBlur={handleRelationshipRetentionBlur}
                  aria-label="Relationship memory retention window in days"
                />
                <span className="v5-status v5-status--muted">
                  Default {DEFAULT_RELATIONSHIP_EDGE_RETENTION_DAYS} days. Edges whose last seen
                  timestamp is older than this window are pruned from local storage.
                </span>
              </div>
              <div className="v5-actions">
                <button
                  type="button"
                  className="v5-btn v5-btn--danger"
                  disabled={!ready || clearRelationshipEdgesState === "clearing"}
                  onClick={handleClearRelationshipEdges}
                  aria-label="Clear all relationship memory"
                >
                  {clearRelationshipEdgesState === "clearing"
                    ? "Clearing…"
                    : "Clear all relationship memory"}
                </button>
                <span className="v5-status v5-status--muted">
                  {relationshipEdgeCount} stored edge
                  {relationshipEdgeCount === 1 ? "" : "s"}. Clears relationship edges
                  only—investigation sessions stay. Combined wipe of edges and sessions is not
                  offered on this control.
                </span>
                {clearRelationshipEdgesState === "cleared" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    Relationship memory cleared.
                  </span>
                ) : null}
                {clearRelationshipEdgesState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    Could not clear relationship memory. Try again.
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section id="noise-rules" className="v5-card" aria-labelledby="noise-rules-heading">
            <div className="v5-card__head">
              <h2 id="noise-rules-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["noise-rules"]}
                  aria-controls="noise-rules-body"
                  onClick={() => toggleSection("noise-rules")}
                >
                  <span className="v5-card__toggle-text">{NOISE_RULES_OPTIONS_SECTION_TITLE}</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">{NOISE_RULES_OPTIONS_SECTION_DESC}</p>
            </div>
            <div
              id="noise-rules-body"
              className="v5-card__body"
              hidden={collapsedSections["noise-rules"]}
            >
              <ToggleRow
                label={HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_LABEL}
                hint={HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_HINT}
                ariaLabel={HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_LABEL}
                checked={hideSuppressedFromScan}
                disabled={!ready}
                onChange={handleHideSuppressedFromScanToggle}
              />
              {noiseRules.length === 0 ? (
                <p className="v5-status v5-status--muted" role="status">
                  {NOISE_RULES_OPTIONS_EMPTY_TEXT}
                </p>
              ) : (
                <>
                  <div className="v5-field">
                    <label className="v5-field__label" htmlFor="noise-rules-search">
                      {NOISE_RULES_OPTIONS_SEARCH_LABEL}
                    </label>
                    <input
                      id="noise-rules-search"
                      type="search"
                      className="v5-input"
                      value={noiseRulesSearchQuery}
                      disabled={!ready}
                      placeholder={NOISE_RULES_OPTIONS_SEARCH_PLACEHOLDER}
                      onChange={(event) => setNoiseRulesSearchQuery(event.target.value)}
                      aria-label={NOISE_RULES_OPTIONS_SEARCH_LABEL}
                    />
                  </div>
                  {filteredNoiseRules.length === 0 ? (
                    <p className="v5-status v5-status--muted" role="status">
                      {NOISE_RULES_OPTIONS_NO_SEARCH_MATCHES}
                    </p>
                  ) : (
                    <ul className="v5-domain-list" aria-label="Stored noise rules">
                      {filteredNoiseRules.map((rule) => {
                        const detail = buildNoiseRuleDetailView(rule);
                        const focused = focusedNoiseRuleId === rule.id;
                        const editing = editingNoiseRuleId === rule.id;
                        return (
                          <li
                            key={rule.id}
                            className={`v5-domain-list__item${
                              focused ? " v5-domain-list__item--noise-rule-focus" : ""
                            }`}
                            data-noise-rule-id={rule.id}
                          >
                            <div className="v5-row__text" style={{ flex: 1 }}>
                              <span className="v5-row__label">{detail.summary}</span>
                              <span className="v5-row__hint">Status: {detail.enabledLabel}</span>
                              <span className="v5-row__hint">
                                Action: {detail.sourceActionLabel}
                              </span>
                              <span className="v5-row__hint">
                                Pattern type: {detail.patternTypeLabel}
                              </span>
                              <span className="v5-row__hint">Pattern: {detail.pattern}</span>
                              <span className="v5-row__hint">Hits: {detail.hitCountLabel}</span>
                              <span className="v5-row__hint">Created: {detail.createdAtLabel}</span>
                              <span className="v5-row__hint">Id: {detail.id}</span>
                              {editing && noiseRuleEditDraft ? (
                                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                                  <label className="v5-field__label">
                                    Pattern type
                                    <select
                                      className="v5-input"
                                      value={noiseRuleEditDraft.patternType}
                                      disabled={!ready}
                                      aria-label={`Edit pattern type for ${rule.id}`}
                                      onChange={(event) =>
                                        setNoiseRuleEditDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                patternType: event.target
                                                  .value as NoiseRulePatternType,
                                              }
                                            : current
                                        )
                                      }
                                    >
                                      {NOISE_RULE_PATTERN_TYPES.map((patternType) => (
                                        <option key={patternType} value={patternType}>
                                          {NOISE_RULE_PATTERN_TYPE_DISPLAY[patternType]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="v5-field__label">
                                    Pattern
                                    <input
                                      className="v5-input"
                                      value={noiseRuleEditDraft.pattern}
                                      disabled={!ready}
                                      aria-label={`Edit pattern for ${rule.id}`}
                                      onChange={(event) =>
                                        setNoiseRuleEditDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                pattern: event.target.value,
                                              }
                                            : current
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="v5-field__label">
                                    Action
                                    <select
                                      className="v5-input"
                                      value={noiseRuleEditDraft.sourceAction}
                                      disabled={!ready}
                                      aria-label={`Edit action for ${rule.id}`}
                                      onChange={(event) =>
                                        setNoiseRuleEditDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                sourceAction: event.target
                                                  .value as NoiseRuleSourceAction,
                                              }
                                            : current
                                        )
                                      }
                                    >
                                      {NOISE_RULE_SOURCE_ACTIONS.map((sourceAction) => (
                                        <option key={sourceAction} value={sourceAction}>
                                          {NOISE_RULE_SOURCE_ACTION_DISPLAY[sourceAction]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ) : null}
                              <div className="v5-actions" style={{ marginTop: 8 }}>
                                <label className="v5-row" style={{ borderBottom: "none" }}>
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    disabled={!ready}
                                    aria-label={`${NOISE_RULES_OPTIONS_ENABLE_LABEL}: ${rule.pattern}`}
                                    onChange={(event) =>
                                      handleToggleNoiseRuleEnabled(
                                        rule,
                                        event.currentTarget.checked
                                      )
                                    }
                                  />
                                  <span className="v5-row__hint">
                                    {NOISE_RULES_OPTIONS_ENABLE_LABEL}
                                  </span>
                                </label>
                                {editing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="v5-btn"
                                      disabled={!ready}
                                      onClick={handleSaveNoiseRuleEdit}
                                      aria-label={`${NOISE_RULES_OPTIONS_SAVE_LABEL}: ${rule.id}`}
                                    >
                                      {NOISE_RULES_OPTIONS_SAVE_LABEL}
                                    </button>
                                    <button
                                      type="button"
                                      className="v5-btn"
                                      disabled={!ready}
                                      onClick={cancelEditNoiseRule}
                                      aria-label={`${NOISE_RULES_OPTIONS_CANCEL_EDIT_LABEL}: ${rule.id}`}
                                    >
                                      {NOISE_RULES_OPTIONS_CANCEL_EDIT_LABEL}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="v5-btn"
                                    disabled={!ready}
                                    onClick={() => beginEditNoiseRule(rule)}
                                    aria-label={`${NOISE_RULES_OPTIONS_EDIT_LABEL}: ${rule.pattern}`}
                                  >
                                    {NOISE_RULES_OPTIONS_EDIT_LABEL}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="v5-btn v5-btn--danger"
                                  disabled={!ready}
                                  onClick={() => handleDeleteNoiseRule(rule)}
                                  aria-label={`${NOISE_RULES_OPTIONS_DELETE_LABEL}: ${rule.pattern}`}
                                >
                                  {NOISE_RULES_OPTIONS_DELETE_LABEL}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              {noiseRuleManageStatus ? (
                <p className="v5-status v5-status--muted" role="status">
                  {noiseRuleManageStatus}
                </p>
              ) : null}
              {noiseRuleSampleAlertPreview ? (
                <div
                  className="v5-field"
                  style={{ marginTop: 8 }}
                  aria-label="Sample alert noise rule match preview"
                >
                  <p className="v5-row__hint">
                    Offline preview for <code>{noiseRuleSampleAlertPreview.fixturePath}</code>. Does
                    not open, scan, or change any live page.
                  </p>
                  {noiseRuleSampleAlertPreview.matched.length === 0 ? (
                    <p className="v5-status v5-status--muted" role="status">
                      {NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_EMPTY_MATCHES}
                    </p>
                  ) : (
                    <ul
                      className="v5-domain-list"
                      aria-label="Sample alert indicators matching noise rules"
                    >
                      {noiseRuleSampleAlertPreview.matched.map((row) => (
                        <li
                          key={`${row.matchedRule.id}:${row.value}`}
                          className="v5-domain-list__item"
                        >
                          <div className="v5-row__text" style={{ flex: 1 }}>
                            <span className="v5-row__label">{row.value}</span>
                            <span className="v5-row__hint">{row.ruleSummary}</span>
                            <span className="v5-row__hint">Rule id: {row.matchedRule.id}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
              <div className="v5-actions">
                <input
                  ref={noiseRulesImportInputRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv,text/plain"
                  hidden
                  aria-label="Import noise rules JSON or CSV file"
                  onChange={handleNoiseRulesImportFileChange}
                />
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready}
                  onClick={handlePreviewNoiseRulesOnSampleAlert}
                  aria-label={NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_ARIA_LABEL}
                  title={NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_HINT}
                >
                  {NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_LABEL}
                </button>
                {noiseRuleSampleAlertPreview ? (
                  <button
                    type="button"
                    className="v5-btn"
                    disabled={!ready}
                    onClick={handleClearNoiseRuleSampleAlertPreview}
                    aria-label={NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_CLEAR_LABEL}
                  >
                    {NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_CLEAR_LABEL}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready || !lastLearnedNoiseRuleUndo}
                  onClick={handleUndoLastLearnedNoiseRule}
                  aria-label={NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_ARIA_LABEL}
                  title={
                    lastLearnedNoiseRuleUndo
                      ? `${NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_HINT} Last: ${lastLearnedNoiseRuleUndo.pattern}`
                      : NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_EMPTY
                  }
                >
                  {NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_LABEL}
                </button>
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready || noiseRulesExportState === "exporting"}
                  onClick={handleExportNoiseRules}
                  aria-label={NOISE_RULES_OPTIONS_EXPORT_LABEL}
                  title={NOISE_RULES_OPTIONS_EXPORT_HINT}
                >
                  {noiseRulesExportState === "exporting"
                    ? "Exporting…"
                    : NOISE_RULES_OPTIONS_EXPORT_LABEL}
                </button>
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready || noiseRulesImportState === "importing"}
                  onClick={handleNoiseRulesImportClick}
                  aria-label={NOISE_RULES_OPTIONS_IMPORT_LABEL}
                  title={NOISE_RULES_OPTIONS_IMPORT_HINT}
                >
                  {noiseRulesImportState === "importing"
                    ? "Importing…"
                    : NOISE_RULES_OPTIONS_IMPORT_LABEL}
                </button>
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready || noiseRulesImportState === "importing"}
                  onClick={handleImportSocDashboardNoiseStarter}
                  aria-label={NOISE_RULES_OPTIONS_IMPORT_STARTER_LABEL}
                  title={NOISE_RULES_OPTIONS_IMPORT_STARTER_HINT}
                >
                  {noiseRulesImportState === "importing"
                    ? "Importing…"
                    : NOISE_RULES_OPTIONS_IMPORT_STARTER_LABEL}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--danger"
                  disabled={
                    !ready || clearNoiseRulesState === "clearing" || noiseRules.length === 0
                  }
                  onClick={handleClearNoiseRules}
                  aria-label={NOISE_RULES_OPTIONS_CLEAR_LABEL}
                >
                  {clearNoiseRulesState === "clearing"
                    ? "Clearing…"
                    : NOISE_RULES_OPTIONS_CLEAR_LABEL}
                </button>
                <span className="v5-status v5-status--muted">
                  {noiseRules.length} stored rule{noiseRules.length === 1 ? "" : "s"}
                </span>
                {noiseRulesExportState === "exported" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    Noise rules exported.
                  </span>
                ) : null}
                {noiseRulesExportState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    Could not export noise rules. Try again.
                  </span>
                ) : null}
                {noiseRulesImportState === "imported" && noiseRulesImportStatus ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    {noiseRulesImportStatus}
                  </span>
                ) : null}
                {noiseRulesImportState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    {noiseRulesImportStatus ??
                      "Could not import noise rules. Check the file schema and try again."}
                  </span>
                ) : null}
                {clearNoiseRulesState === "cleared" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    Noise rules cleared.
                  </span>
                ) : null}
                {clearNoiseRulesState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    Could not clear noise rules. Try again.
                  </span>
                ) : null}
              </div>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_HINT}
              </p>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_HINT}
              </p>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {NOISE_RULES_OPTIONS_EXPORT_HINT}
              </p>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {NOISE_RULES_OPTIONS_IMPORT_HINT}
              </p>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {NOISE_RULES_OPTIONS_IMPORT_STARTER_HINT} File copy:{" "}
                <code>{SOC_DASHBOARD_NOISE_STARTER_EXAMPLES_PATH}</code>.
              </p>
            </div>
          </section>

          <section
            id={KNOWN_GOOD_OPTIONS_SECTION_ID}
            className="v5-card"
            aria-labelledby="known-good-heading"
          >
            <div className="v5-card__head">
              <h2 id="known-good-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections[KNOWN_GOOD_OPTIONS_SECTION_ID]}
                  aria-controls="known-good-body"
                  onClick={() => toggleSection(KNOWN_GOOD_OPTIONS_SECTION_ID)}
                >
                  <span className="v5-card__toggle-text">{KNOWN_GOOD_OPTIONS_SECTION_TITLE}</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">{KNOWN_GOOD_OPTIONS_SECTION_DESC}</p>
            </div>
            <div
              id="known-good-body"
              className="v5-card__body"
              hidden={collapsedSections[KNOWN_GOOD_OPTIONS_SECTION_ID]}
            >
              <p className="v5-row__hint">{KNOWN_GOOD_DISCLAIMER_TEXT}</p>
              <ToggleRow
                label={SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_LABEL}
                hint={SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_HINT}
                ariaLabel={SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_LABEL}
                checked={skipEnrichOnKnownGoodMatch}
                disabled={!ready}
                onChange={handleSkipEnrichOnKnownGoodMatchToggle}
              />
              <p className="v5-field__label" style={{ marginTop: 8 }}>
                {KNOWN_GOOD_OPTIONS_CATEGORIES_HEADING}
              </p>
              <p className="v5-row__hint">{KNOWN_GOOD_OPTIONS_CATEGORIES_HINT}</p>
              {KNOWN_GOOD_CATEGORIES.map((category) => (
                <ToggleRow
                  key={category}
                  label={formatKnownGoodCategoryDisplay(category)}
                  hint={`${KNOWN_GOOD_OPTIONS_ENABLE_CATEGORY_LABEL} (${category})`}
                  ariaLabel={`${KNOWN_GOOD_OPTIONS_ENABLE_CATEGORY_LABEL}: ${formatKnownGoodCategoryDisplay(category)}`}
                  checked={knownGoodCategoryEnabled[category]}
                  disabled={!ready}
                  onChange={(enabled) => handleToggleKnownGoodCategory(category, enabled)}
                />
              ))}
              <p className="v5-field__label" style={{ marginTop: 12 }}>
                {KNOWN_GOOD_OPTIONS_ENTRIES_HEADING}
              </p>
              {knownGoodEntries.length === 0 ? (
                <p className="v5-status v5-status--muted" role="status">
                  {KNOWN_GOOD_OPTIONS_EMPTY_TEXT}
                </p>
              ) : (
                <ul className="v5-domain-list" aria-label="Stored known-good entries">
                  {knownGoodEntries.map((entry) => {
                    const editing = editingKnownGoodEntryId === entry.id;
                    return (
                      <li
                        key={entry.id}
                        className="v5-domain-list__item"
                        data-known-good-entry-id={entry.id}
                      >
                        <div className="v5-row__text" style={{ flex: 1 }}>
                          <span className="v5-row__label">
                            {formatKnownGoodEntrySummary(entry)}
                          </span>
                          <span className="v5-row__hint">Label: {entry.labelText}</span>
                          <span className="v5-row__hint">Id: {entry.id}</span>
                          <span className="v5-row__hint">
                            Category matching:{" "}
                            {knownGoodCategoryEnabled[entry.category] ? "enabled" : "disabled"}
                          </span>
                          {editing && knownGoodEditDraft ? (
                            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                              <label className="v5-field__label">
                                Category
                                <select
                                  className="v5-input"
                                  value={knownGoodEditDraft.category}
                                  disabled={!ready}
                                  aria-label={`Edit category for ${entry.id}`}
                                  onChange={(event) =>
                                    setKnownGoodEditDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            category: event.target.value as KnownGoodCategory,
                                          }
                                        : current
                                    )
                                  }
                                >
                                  {KNOWN_GOOD_CATEGORIES.map((category) => (
                                    <option key={category} value={category}>
                                      {formatKnownGoodCategoryDisplay(category)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="v5-field__label">
                                Match type
                                <select
                                  className="v5-input"
                                  value={knownGoodEditDraft.matchType}
                                  disabled={!ready}
                                  aria-label={`Edit match type for ${entry.id}`}
                                  onChange={(event) =>
                                    setKnownGoodEditDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            matchType: event.target.value as KnownGoodMatchType,
                                          }
                                        : current
                                    )
                                  }
                                >
                                  {KNOWN_GOOD_MATCH_TYPES.map((matchType) => (
                                    <option key={matchType} value={matchType}>
                                      {formatKnownGoodMatchTypeDisplay(matchType)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="v5-field__label">
                                Pattern
                                <input
                                  className="v5-input"
                                  value={knownGoodEditDraft.pattern}
                                  disabled={!ready}
                                  aria-label={`Edit pattern for ${entry.id}`}
                                  onChange={(event) =>
                                    setKnownGoodEditDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            pattern: event.target.value,
                                          }
                                        : current
                                    )
                                  }
                                />
                              </label>
                              <label className="v5-field__label">
                                Label text
                                <input
                                  className="v5-input"
                                  value={knownGoodEditDraft.labelText}
                                  disabled={!ready}
                                  aria-label={`Edit label text for ${entry.id}`}
                                  onChange={(event) =>
                                    setKnownGoodEditDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            labelText: event.target.value,
                                          }
                                        : current
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ) : null}
                          <div className="v5-actions" style={{ marginTop: 8 }}>
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  className="v5-btn"
                                  disabled={!ready}
                                  onClick={handleSaveKnownGoodEntryEdit}
                                  aria-label={`${KNOWN_GOOD_OPTIONS_SAVE_LABEL} ${entry.id}`}
                                >
                                  {KNOWN_GOOD_OPTIONS_SAVE_LABEL}
                                </button>
                                <button
                                  type="button"
                                  className="v5-btn"
                                  disabled={!ready}
                                  onClick={cancelEditKnownGoodEntry}
                                  aria-label={`${KNOWN_GOOD_OPTIONS_CANCEL_LABEL} ${entry.id}`}
                                >
                                  {KNOWN_GOOD_OPTIONS_CANCEL_LABEL}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="v5-btn"
                                disabled={!ready}
                                onClick={() => beginEditKnownGoodEntry(entry)}
                                aria-label={`${KNOWN_GOOD_OPTIONS_EDIT_LABEL} ${entry.id}`}
                              >
                                {KNOWN_GOOD_OPTIONS_EDIT_LABEL}
                              </button>
                            )}
                            <button
                              type="button"
                              className="v5-btn v5-btn--danger"
                              disabled={!ready}
                              onClick={() => handleDeleteKnownGoodEntry(entry)}
                              aria-label={`${KNOWN_GOOD_OPTIONS_DELETE_LABEL} ${entry.id}`}
                            >
                              {KNOWN_GOOD_OPTIONS_DELETE_LABEL}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {knownGoodManageStatus ? (
                <p className="v5-status v5-status--muted" role="status">
                  {knownGoodManageStatus}
                </p>
              ) : null}
              <div className="v5-actions">
                <button
                  type="button"
                  className="v5-btn"
                  disabled={!ready || knownGoodExportState === "exporting"}
                  onClick={handleExportKnownGoodList}
                  aria-label={KNOWN_GOOD_OPTIONS_EXPORT_LABEL}
                  title={KNOWN_GOOD_OPTIONS_EXPORT_HINT}
                >
                  {knownGoodExportState === "exporting"
                    ? "Exporting…"
                    : KNOWN_GOOD_OPTIONS_EXPORT_LABEL}
                </button>
                <span className="v5-status v5-status--muted">
                  {knownGoodEntries.length} stored entr
                  {knownGoodEntries.length === 1 ? "y" : "ies"}
                </span>
                {knownGoodExportState === "exported" ? (
                  <span className="v5-status v5-status--success" role="status">
                    <CheckIcon />
                    {KNOWN_GOOD_OPTIONS_EXPORT_SUCCESS}
                  </span>
                ) : null}
                {knownGoodExportState === "error" ? (
                  <span className="v5-status v5-status--error" role="status">
                    {KNOWN_GOOD_OPTIONS_EXPORT_ERROR}
                  </span>
                ) : null}
              </div>
              <p className="v5-row__hint" style={{ marginTop: 8 }}>
                {KNOWN_GOOD_OPTIONS_EXPORT_HINT}
              </p>
            </div>
          </section>

          <section id="backup" className="v5-card" aria-labelledby="settings-backup-heading">
            <div className="v5-card__head">
              <h2 id="settings-backup-heading" className="v5-card__title">
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections.backup}
                  aria-controls="backup-body"
                  onClick={() => toggleSection("backup")}
                >
                  <span className="v5-card__toggle-text">Settings Backup</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                Export your preferences as JSON to move them between profiles or keep a backup.
                Export a settings pack to share connector toggles, cache TTL, domain policy, and
                analyst mode without API keys. Export an active threat profile for portable workflow
                preferences (connectors, analyst mode, export template, quiet mode) without API
                keys. API keys are excluded from settings packs, threat profiles, and from full
                settings exports unless you choose to include them.
              </p>
            </div>
            <div id="backup-body" className="v5-card__body" hidden={collapsedSections.backup}>
              <div className="v5-row" role="status" aria-label="Active threat profile status">
                <span className="v5-row__text">
                  Active threat profile:{" "}
                  {formatActiveThreatProfileIndicator(activeThreatProfileState)}
                </span>
                <span className="v5-row__hint">
                  Last imported: {formatThreatProfileLastImportedAt(activeThreatProfileState)}
                </span>
              </div>
              {listShippedBuiltInThreatProfiles().length > 0 ? (
                <div className="v5-actions">
                  {listShippedBuiltInThreatProfiles().map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      className="v5-btn"
                      disabled={!ready || threatProfileImportState === "importing"}
                      onClick={() => handleApplyBuiltInThreatProfile(profile.id)}
                      aria-label={`Apply ${profile.name} built-in threat profile`}
                      title={profile.description}
                    >
                      Apply {profile.name} profile
                    </button>
                  ))}
                </div>
              ) : null}
              <ToggleRow
                label="Include API keys in export"
                hint="Off by default. Only enable when exporting to a trusted location."
                ariaLabel="Include API keys in export"
                checked={includeApiKeysInExport}
                disabled={!ready}
                onChange={setIncludeApiKeysInExport}
              />
              <div className="v5-actions">
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || exportState === "exporting"}
                  onClick={handleExportSettings}
                  aria-label="Export settings JSON"
                >
                  {exportState === "exporting" ? "Exporting…" : "Export settings"}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || settingsPackExportState === "exporting"}
                  onClick={handleExportSettingsPack}
                  aria-label="Export settings pack JSON"
                >
                  {settingsPackExportState === "exporting" ? "Exporting…" : "Export settings pack"}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || threatProfileExportState === "exporting"}
                  onClick={handleExportThreatProfile}
                  aria-label="Export threat profile JSON"
                >
                  {threatProfileExportState === "exporting"
                    ? "Exporting…"
                    : "Export threat profile"}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || threatProfileImportState === "importing"}
                  onClick={handleThreatProfileImportClick}
                  aria-label="Import threat profile JSON"
                >
                  {threatProfileImportState === "importing"
                    ? "Importing…"
                    : "Import threat profile"}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || settingsPackImportState === "importing"}
                  onClick={handleSettingsPackImportClick}
                  aria-label="Import settings pack JSON"
                >
                  {settingsPackImportState === "importing" ? "Importing…" : "Import settings pack"}
                </button>
                <button
                  type="button"
                  className="v5-btn v5-btn--primary"
                  disabled={!ready || importState === "importing"}
                  onClick={handleImportClick}
                  aria-label="Import settings JSON"
                >
                  {importState === "importing" ? "Importing…" : "Import settings"}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{ display: "none" }}
                  onChange={handleImportFileChange}
                />
                <input
                  ref={settingsPackImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import settings pack JSON file"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{ display: "none" }}
                  onChange={handleSettingsPackImportFileChange}
                />
                <input
                  ref={threatProfileImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import threat profile JSON file"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{ display: "none" }}
                  onChange={handleThreatProfileImportFileChange}
                />
              </div>
              {exportState === "exported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Settings exported.
                </span>
              ) : null}
              {settingsPackExportState === "exported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Settings pack exported.
                </span>
              ) : null}
              {threatProfileExportState === "exported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Threat profile exported.
                </span>
              ) : null}
              {exportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not export settings. Try again.
                </span>
              ) : null}
              {settingsPackExportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not export settings pack. Try again.
                </span>
              ) : null}
              {threatProfileExportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not export threat profile. Try again.
                </span>
              ) : null}
              {settingsPackImportState === "imported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Settings pack imported.
                </span>
              ) : null}
              {settingsPackImportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not import settings pack. Check the file and try again.
                </span>
              ) : null}
              {threatProfileImportState === "imported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Threat profile imported.
                </span>
              ) : null}
              {threatProfileImportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not import threat profile. Check the file and try again.
                </span>
              ) : null}
              {importState === "imported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Settings imported.
                </span>
              ) : null}
              {importState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not import settings. Check the file and try again.
                </span>
              ) : null}
            </div>
          </section>

          <section className="v5-card" aria-labelledby="private-ipv4-heading">
            <div className="v5-card__head">
              <h2 id="private-ipv4-heading" className="v5-card__title" style={{ fontSize: 18 }}>
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["private-ipv4"]}
                  aria-controls="private-ipv4-body"
                  onClick={() => toggleSection("private-ipv4")}
                >
                  <span className="v5-card__toggle-text">Private-Space IPv4 Addresses</span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                A core control for SOC and lab workflows. When off, RFC1918, loopback, and
                link-local IPv4 literals are omitted from page scans so internal network addresses
                are never treated as indicators.
              </p>
            </div>
            <div
              id="private-ipv4-body"
              className="v5-card__body"
              hidden={collapsedSections["private-ipv4"]}
            >
              <label
                className="v5-row"
                style={{
                  borderBottom: "none",
                  paddingTop: 6,
                  cursor: ready ? "pointer" : "wait",
                }}
              >
                <span className="v5-row__text">
                  <span className="v5-row__label" style={{ fontSize: 15 }}>
                    Detect private-space IPv4 addresses
                  </span>
                  <span className="v5-row__hint">
                    Enable for lab or internal SOC pages that use private ranges.
                  </span>
                </span>
                <Switch
                  ariaLabel="Include private-space IPv4 addresses"
                  checked={includePrivateIpv4}
                  disabled={!ready}
                  onChange={handleIncludePrivateIpv4Toggle}
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      {operatorMacroPackImportPreview ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleOperatorMacroPackImportCancel();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-macro-pack-import-title"
            aria-describedby="operator-macro-pack-import-body"
          >
            <h2 id="operator-macro-pack-import-title" className="v5-consent-dialog__title">
              Review macro pack import
            </h2>
            <div id="operator-macro-pack-import-body" className="v5-consent-dialog__body">
              <p>
                Applying this pack adds or updates your custom macros. Built-in playbooks on this
                profile stay unchanged.
              </p>
              {operatorMacroPackImportPreview.entries.length === 0 ? (
                <p>This pack does not include any macros.</p>
              ) : (
                <ul className="v5-settings-pack-diff">
                  {operatorMacroPackImportPreview.entries.map((entry) => (
                    <li key={entry.macroId} className="v5-settings-pack-diff__item">
                      <span className="v5-settings-pack-diff__label">
                        {entry.macroName} <code>{entry.macroId}</code>
                      </span>
                      <span className="v5-settings-pack-diff__values">
                        {entry.action === "add"
                          ? "Add"
                          : entry.action === "update"
                            ? "Update"
                            : "Skip"}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="v5-consent-dialog__actions">
              <button
                type="button"
                className="v5-btn"
                disabled={operatorMacroPackImportState === "importing"}
                onClick={handleOperatorMacroPackImportCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                disabled={operatorMacroPackImportState === "importing"}
                onClick={handleOperatorMacroPackImportConfirm}
                aria-label="Apply macro pack import"
              >
                {operatorMacroPackImportState === "importing" ? "Applying…" : "Apply pack"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {noiseRulesImportPreview && noiseRulesImportDraft ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleNoiseRulesImportCancel();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="noise-rules-import-title"
            aria-describedby="noise-rules-import-body"
          >
            <h2 id="noise-rules-import-title" className="v5-consent-dialog__title">
              {NOISE_RULES_IMPORT_REVIEW_TITLE}
            </h2>
            <div id="noise-rules-import-body" className="v5-consent-dialog__body">
              <p>
                Choose how to merge this import with your local noise rules. API keys are never
                included.
              </p>
              <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                <legend className="v5-row__label">Merge mode</legend>
                {(
                  Object.keys(NOISE_RULES_IMPORT_MERGE_MODE) as Array<
                    keyof typeof NOISE_RULES_IMPORT_MERGE_MODE
                  >
                ).map((key) => {
                  const mode = NOISE_RULES_IMPORT_MERGE_MODE[key];
                  return (
                    <label
                      key={mode}
                      className="v5-row"
                      style={{ borderBottom: "none", paddingTop: 4, paddingBottom: 4 }}
                    >
                      <input
                        type="radio"
                        name="noise-rules-import-merge-mode"
                        value={mode}
                        checked={noiseRulesImportMergeMode === mode}
                        disabled={noiseRulesImportState === "importing"}
                        onChange={() => handleNoiseRulesImportMergeModeChange(mode)}
                        aria-label={NOISE_RULES_IMPORT_MERGE_MODE_LABEL[mode]}
                      />
                      <span className="v5-row__text">
                        <span className="v5-row__label">
                          {NOISE_RULES_IMPORT_MERGE_MODE_LABEL[mode]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <ul className="v5-settings-pack-diff">
                <li className="v5-settings-pack-diff__item">
                  <span className="v5-settings-pack-diff__label">Will import</span>
                  <span className="v5-settings-pack-diff__values">
                    {noiseRulesImportPreview.wouldImportCount}
                  </span>
                </li>
                <li className="v5-settings-pack-diff__item">
                  <span className="v5-settings-pack-diff__label">Duplicates skipped</span>
                  <span className="v5-settings-pack-diff__values">
                    {noiseRulesImportPreview.analysis.duplicates.length}
                  </span>
                </li>
                <li className="v5-settings-pack-diff__item">
                  <span className="v5-settings-pack-diff__label">Invalid rows</span>
                  <span className="v5-settings-pack-diff__values">
                    {noiseRulesImportPreview.analysis.invalid.length}
                  </span>
                </li>
                {noiseRulesImportPreview.wouldRemoveExistingCount > 0 ? (
                  <li className="v5-settings-pack-diff__item">
                    <span className="v5-settings-pack-diff__label">Will remove stored</span>
                    <span className="v5-settings-pack-diff__values">
                      {noiseRulesImportPreview.wouldRemoveExistingCount}
                    </span>
                  </li>
                ) : null}
              </ul>
              {noiseRulesImportMergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL ? (
                <label className="v5-row" style={{ borderBottom: "none", paddingTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={noiseRulesReplaceConfirmed}
                    disabled={noiseRulesImportState === "importing"}
                    onChange={(event) => setNoiseRulesReplaceConfirmed(event.currentTarget.checked)}
                    aria-label={NOISE_RULES_IMPORT_REPLACE_CONFIRM_LABEL}
                  />
                  <span className="v5-row__text">
                    <span className="v5-row__hint">{NOISE_RULES_IMPORT_REPLACE_CONFIRM_LABEL}</span>
                  </span>
                </label>
              ) : null}
            </div>
            <div className="v5-consent-dialog__actions">
              <button
                type="button"
                className="v5-btn"
                disabled={noiseRulesImportState === "importing"}
                onClick={handleNoiseRulesImportCancel}
              >
                {NOISE_RULES_IMPORT_CANCEL_LABEL}
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                disabled={
                  noiseRulesImportState === "importing" ||
                  (noiseRulesImportMergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL &&
                    !noiseRulesReplaceConfirmed)
                }
                onClick={handleNoiseRulesImportConfirm}
                aria-label={NOISE_RULES_IMPORT_APPLY_LABEL}
              >
                {noiseRulesImportState === "importing"
                  ? "Applying…"
                  : NOISE_RULES_IMPORT_APPLY_LABEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsPackImportPreview ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleSettingsPackImportCancel();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-pack-import-title"
            aria-describedby="settings-pack-import-body"
          >
            <h2 id="settings-pack-import-title" className="v5-consent-dialog__title">
              Review settings pack import
            </h2>
            <div id="settings-pack-import-body" className="v5-consent-dialog__body">
              <p>
                Applying this pack updates connector toggles, cache TTL, domain policy, and analyst
                mode. API keys on this profile stay unchanged.
              </p>
              <p>{SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE}</p>
              {settingsPackImportPreview.changes.length === 0 ? (
                <p>This pack matches your current settings.</p>
              ) : (
                <ul className="v5-settings-pack-diff">
                  {settingsPackImportPreview.changes.map((change) => (
                    <li key={change.field} className="v5-settings-pack-diff__item">
                      <span className="v5-settings-pack-diff__label">{change.label}</span>
                      <span className="v5-settings-pack-diff__values">
                        {change.currentValue} → {change.incomingValue}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="v5-consent-dialog__actions">
              <button
                type="button"
                className="v5-btn"
                disabled={settingsPackImportState === "importing"}
                onClick={handleSettingsPackImportCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                disabled={settingsPackImportState === "importing"}
                onClick={handleSettingsPackImportConfirm}
                aria-label="Apply settings pack import"
              >
                {settingsPackImportState === "importing" ? "Applying…" : "Apply pack"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {threatProfileImportPreview ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleThreatProfileImportCancel();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="threat-profile-import-title"
            aria-describedby="threat-profile-import-body"
          >
            <h2 id="threat-profile-import-title" className="v5-consent-dialog__title">
              Review threat profile import
            </h2>
            <div id="threat-profile-import-body" className="v5-consent-dialog__body">
              <p role="note">
                Warning: This profile can change enabled connectors, export templates, and analyst
                modes (including pivots and quiet-mode defaults). It does not import or change your
                API keys.
              </p>
              <p>
                Choose how to apply this profile. Merge updates only fields present in the file.
                Apply as new active resets overlapping workflow preferences to defaults, then
                applies the profile. API keys stay unchanged.
              </p>
              <p>{SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE}</p>
              <div className="v5-actions" role="radiogroup" aria-label="Threat profile import mode">
                {(
                  Object.keys(THREAT_PROFILE_IMPORT_MERGE_MODE) as Array<
                    keyof typeof THREAT_PROFILE_IMPORT_MERGE_MODE
                  >
                ).map((key) => {
                  const mode = THREAT_PROFILE_IMPORT_MERGE_MODE[key];
                  return (
                    <label key={mode} className="v5-row">
                      <input
                        type="radio"
                        name="threat-profile-import-merge-mode"
                        checked={threatProfileImportMergeMode === mode}
                        disabled={threatProfileImportState === "importing"}
                        onChange={() => handleThreatProfileImportMergeModeChange(mode)}
                        aria-label={THREAT_PROFILE_IMPORT_MERGE_MODE_LABEL[mode]}
                      />
                      <span className="v5-row__text">
                        <span className="v5-row__hint">
                          {THREAT_PROFILE_IMPORT_MERGE_MODE_LABEL[mode]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {threatProfileImportPreview.changes.length === 0 ? (
                <p>This profile matches your current settings for the selected mode.</p>
              ) : (
                <ul className="v5-settings-pack-diff">
                  {threatProfileImportPreview.changes.map((change) => (
                    <li key={change.field} className="v5-settings-pack-diff__item">
                      <span className="v5-settings-pack-diff__label">{change.label}</span>
                      <span className="v5-settings-pack-diff__values">
                        {change.currentValue} → {change.incomingValue}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="v5-consent-dialog__actions">
              <button
                type="button"
                className="v5-btn"
                disabled={threatProfileImportState === "importing"}
                onClick={handleThreatProfileImportCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                disabled={threatProfileImportState === "importing"}
                onClick={handleThreatProfileImportConfirm}
                aria-label="Apply threat profile import"
              >
                {threatProfileImportState === "importing" ? "Applying…" : "Apply profile"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAttributeHrefConsentDialog ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleAttributeHrefConsentCancel();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attribute-href-consent-title"
            aria-describedby="attribute-href-consent-body"
          >
            <h2 id="attribute-href-consent-title" className="v5-consent-dialog__title">
              Enable link attribute scanning?
            </h2>
            <div id="attribute-href-consent-body" className="v5-consent-dialog__body">
              <p>
                Vera5 will read allowlisted link and attribute values (for example <code>href</code>{" "}
                and <code>src</code>) on pages you scan—not only visible text. Processing stays on
                this device; Vera5 does not upload full pages or attribute dumps.
              </p>
              <p>
                Live enrichment still sends only indicator values you explicitly enrich to
                threat-intel vendors you configure. Password fields and hidden inputs are never
                scanned.
              </p>
              <p>
                Use domain denylist presets on sensitive hosts if your policy requires visible-text
                scanning only.
              </p>
              <p>
                <a
                  className="v5-consent-dialog__link"
                  href={ATTRIBUTE_HREF_EXTRACTION_SECURITY_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read the Vera5 security model — attribute and href extraction
                </a>
              </p>
              <label className="v5-consent-dialog__remember">
                <input
                  type="checkbox"
                  checked={rememberSiteChoicesOnConfirm}
                  onChange={(event) => setRememberSiteChoicesOnConfirm(event.target.checked)}
                />
                <span>Remember always-on or always-off choices per website (optional)</span>
              </label>
            </div>
            <div className="v5-consent-dialog__actions">
              <button type="button" className="v5-btn" onClick={handleAttributeHrefConsentCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                onClick={handleAttributeHrefConsentConfirm}
              >
                Enable attribute scan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {operatorMacroEditorMode ? (
        <div
          className="v5-consent-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseOperatorMacroEditor();
            }
          }}
        >
          <div
            className="v5-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-macro-editor-title"
            aria-describedby="operator-macro-editor-body"
          >
            <h2 id="operator-macro-editor-title" className="v5-consent-dialog__title">
              {operatorMacroEditorMode === "create" ? "Create macro" : "Edit macro"}
            </h2>
            <div id="operator-macro-editor-body" className="v5-consent-dialog__body">
              <div className="v5-field">
                <label className="v5-field__label" htmlFor="operator-macro-name">
                  Name
                </label>
                <input
                  id="operator-macro-name"
                  type="text"
                  className="v5-input"
                  value={operatorMacroEditorDraft.name}
                  maxLength={MAX_OPERATOR_MACRO_NAME_LENGTH}
                  disabled={operatorMacroActionState === "busy"}
                  onChange={(event) => {
                    const name = event.target.value;
                    setOperatorMacroEditorDraft((draft) => ({
                      ...draft,
                      name,
                      id:
                        operatorMacroEditorMode === "create" && draft.id.trim().length === 0
                          ? suggestOperatorMacroIdFromName(name)
                          : draft.id,
                    }));
                  }}
                />
              </div>
              {operatorMacroEditorMode === "create" ? (
                <div className="v5-field">
                  <label className="v5-field__label" htmlFor="operator-macro-id">
                    Macro id
                  </label>
                  <input
                    id="operator-macro-id"
                    type="text"
                    className="v5-input"
                    value={operatorMacroEditorDraft.id}
                    maxLength={MAX_OPERATOR_MACRO_ID_LENGTH}
                    disabled={operatorMacroActionState === "busy"}
                    onChange={(event) =>
                      setOperatorMacroEditorDraft((draft) => ({
                        ...draft,
                        id: event.target.value,
                      }))
                    }
                  />
                  <span className="v5-row__hint" style={{ display: "block", marginTop: 8 }}>
                    Lowercase letters, numbers, and hyphens. Must start with a letter.
                  </span>
                </div>
              ) : (
                <div className="v5-field">
                  <span className="v5-field__label">Macro id</span>
                  <code>{operatorMacroEditorDraft.id}</code>
                </div>
              )}
              <div className="v5-field">
                <label className="v5-field__label" htmlFor="operator-macro-description">
                  Description
                </label>
                <textarea
                  id="operator-macro-description"
                  className="v5-input"
                  rows={3}
                  value={operatorMacroEditorDraft.description}
                  maxLength={MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH}
                  disabled={operatorMacroActionState === "busy"}
                  onChange={(event) =>
                    setOperatorMacroEditorDraft((draft) => ({
                      ...draft,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <OperatorMacroStepsEditor
                steps={operatorMacroEditorDraft.steps}
                disabled={operatorMacroActionState === "busy"}
                onChange={(steps) =>
                  setOperatorMacroEditorDraft((draft) => ({
                    ...draft,
                    steps,
                  }))
                }
              />
              <fieldset className="v5-field" disabled={operatorMacroActionState === "busy"}>
                <legend className="v5-field__label">Triggers</legend>
                <ToggleRow
                  label="Command palette"
                  ariaLabel="Register macro in command palette"
                  checked={operatorMacroEditorDraft.triggers.palette}
                  disabled={operatorMacroActionState === "busy"}
                  onChange={(checked) =>
                    setOperatorMacroEditorDraft((draft) => ({
                      ...draft,
                      triggers: { ...draft.triggers, palette: checked },
                    }))
                  }
                />
                <ToggleRow
                  label="IOC tray"
                  ariaLabel="Register macro in IOC tray"
                  checked={operatorMacroEditorDraft.triggers.tray}
                  disabled={operatorMacroActionState === "busy"}
                  onChange={(checked) =>
                    setOperatorMacroEditorDraft((draft) => ({
                      ...draft,
                      triggers: { ...draft.triggers, tray: checked },
                    }))
                  }
                />
                <ToggleRow
                  label="Context menu"
                  ariaLabel="Register macro in context menu"
                  checked={operatorMacroEditorDraft.triggers.context}
                  disabled={operatorMacroActionState === "busy"}
                  onChange={(checked) =>
                    setOperatorMacroEditorDraft((draft) => ({
                      ...draft,
                      triggers: { ...draft.triggers, context: checked },
                    }))
                  }
                />
              </fieldset>
              {operatorMacroEditorError ? (
                <span className="v5-status v5-status--error" role="alert">
                  {operatorMacroEditorError}
                </span>
              ) : null}
            </div>
            <div className="v5-consent-dialog__actions">
              <button
                type="button"
                className="v5-btn"
                disabled={operatorMacroActionState === "busy"}
                onClick={handleCloseOperatorMacroEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                className="v5-btn v5-btn--primary"
                disabled={operatorMacroActionState === "busy"}
                onClick={handleSaveOperatorMacroEditor}
              >
                {operatorMacroActionState === "busy" ? "Saving…" : "Save macro"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
