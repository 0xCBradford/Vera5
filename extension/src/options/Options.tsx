import { useEffect, useRef, useState } from "react";
import { clearEnrichmentCache } from "../lib/cache";
import { ENRICHMENT_SOURCE_OPS_POPUP_GUIDANCE } from "../lib/enrichmentSourceOps";
import { prefersReducedMotion } from "../lib/motionPreference";
import {
  downloadVera5SettingsExport,
  exportVera5SettingsJson,
  importVera5SettingsJson,
} from "../lib/settingsExport";
import type {
  ApiKeySlot,
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
  getDomainAllowlist,
  getDomainDenylist,
  getDomainPolicyEnrichGateEnabled,
  getDomainPolicyMode,
  getEnrichmentCacheTtlSecondsFromSettings,
  getEnrichmentSourceCacheTtlSeconds,
  getEnrichmentSourceEnabled,
  getIncludePrivateIpv4,
  getInstallQuickStartCompleted,
  getLocalBackendEnabled,
  getInternalAssetCidrRanges,
  getInternalAssetDomains,
  getInternalAssetEnrichGateEnabled,
  getInternalAssetVendorLabels,
  getIocTypeEnabled,
  getManualOnlyMode,
  getPreQueryNoticePreferenceConfigured,
  getShowDisabledSourcesInWorkspace,
  getShowPreQueryNotices,
  hasApiKey,
  completeInstallQuickStart,
  IOC_TYPE_SETTINGS_ORDER,
  isMaskedApiKeyDisplay,
  maskApiKeyForDisplay,
  readStoredCacheTtlSeconds,
  setApiKey,
  setAutoScanEnabled,
  setDomainAllowlist,
  setDomainDenylist,
  setDomainPolicyEnrichGateEnabled,
  setDomainPolicyMode,
  setEnrichmentCacheTtlSeconds,
  setEnrichmentSourceCacheTtlSeconds,
  setEnrichmentSourceEnabled,
  setIncludePrivateIpv4,
  setLocalBackendEnabled,
  setInternalAssetCidrRanges,
  setInternalAssetDomains,
  setInternalAssetEnrichGateEnabled,
  setInternalAssetVendorLabels,
  setIocTypeEnabled,
  setManualOnlyMode,
  setPreQueryNoticePreference,
  setShowDisabledSourcesInWorkspace,
} from "../lib/storage";
import {
  DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  DOMAIN_POLICY_PRESETS,
  applyDomainPolicyPresetToLists,
  getDomainPolicyPresetById,
  normalizeDomainPolicyEntry,
  type DomainPolicyMode,
} from "../lib/domainPolicy";
import {
  ANALYST_MODE_PRESETS,
  type AnalystModePresetId,
} from "../lib/analystModePresets";
import { normalizeInternalAssetCidrRange } from "../lib/internalAssetPolicy";

const API_KEY_FIELD_SLOTS: ApiKeySlot[] = [
  ...OPTIONS_API_KEY_SLOTS,
  CENSYS_SECRET_API_KEY_SLOT,
];

const INSTALL_QUICK_START_KEY_SLOTS = LIVE_ENRICHMENT_SOURCE_ORDER.filter(
  (sourceId): sourceId is ApiKeySlot => OPTIONS_API_KEY_SLOTS.includes(sourceId)
);

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
};

const IOC_TYPE_SHORT_LABELS: Record<IocType, string> = {
  ipv4: "IPv4",
  domain: "Domain",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  cve: "CVE",
};

const IOC_TYPE_CODES: Record<IocType, string> = {
  ipv4: "IPV4",
  domain: "DOM",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "256",
  cve: "CVE",
};

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scanning", label: "Scanning" },
  { id: "indicators", label: "Indicators" },
  { id: "sources", label: "Enrichment Sources" },
  { id: "trust", label: "Trust & Consent" },
  { id: "cache", label: "Cache" },
  { id: "backup", label: "Backup" },
  { id: "api-keys", label: "API Keys" },
];

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
  return Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [sourceId, ""])
  ) as Record<EnrichmentSourceId, string>;
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
    typeof window !== "undefined" && prefersReducedMotion(window)
      ? "auto"
      : "smooth";
  element.scrollIntoView({ behavior, block: "start" });
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
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
      <rect
        x="3"
        y="7"
        width="10"
        height="6.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
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

function ToggleRow({
  label,
  hint,
  ariaLabel,
  checked,
  disabled,
  onChange,
}: ToggleRowProps) {
  return (
    <label className="v5-row" style={{ cursor: disabled ? "wait" : "pointer" }}>
      <span className="v5-row__text">
        <span className="v5-row__label">{label}</span>
        {hint ? <span className="v5-row__hint">{hint}</span> : null}
      </span>
      <Switch
        ariaLabel={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
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
      <span
        className="v5-status v5-status--muted"
        style={{ display: "block", marginBottom: 8 }}
      >
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
      <span
        className="v5-status v5-status--muted"
        style={{ display: "block", marginBottom: 8 }}
      >
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
            <li
              key={`${entry.label}::${entry.pattern}`}
              className="v5-domain-list__item"
            >
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
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
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >(() => ({
    overview: true,
    scanning: true,
    indicators: true,
    "private-ipv4": true,
    sources: true,
    trust: true,
    cache: true,
    backup: true,
    "api-keys": true,
  }));
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const [autoScanEnabled, setAutoScanEnabledState] = useState(false);
  const [manualOnlyMode, setManualOnlyModeState] = useState(true);
  const [enrichmentSourceEnabled, setEnrichmentSourceEnabledState] =
    useState<EnrichmentSourceEnabledRecord>(createDefaultSourceEnabledState());
  const [iocTypeEnabled, setIocTypeEnabledState] =
    useState<IocTypeEnabledRecord>(createDefaultIocTypeEnabledState());
  const [includePrivateIpv4, setIncludePrivateIpv4State] = useState(false);
  const [localBackendEnabled, setLocalBackendEnabledState] = useState(false);
  const [showDisabledSourcesInWorkspace, setShowDisabledSourcesInWorkspaceState] =
    useState(false);
  const [showPreQueryNotices, setShowPreQueryNoticesState] = useState(true);
  const [, setPreQueryNoticePreferenceConfiguredState] =
    useState(false);
  const [installQuickStartCompleted, setInstallQuickStartCompletedState] =
    useState(true);
  const [quickStartStep, setQuickStartStep] = useState<InstallQuickStartStep>(0);
  const [domainPolicyMode, setDomainPolicyModeState] = useState<DomainPolicyMode>(
    DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
  );
  const [domainAllowlist, setDomainAllowlistState] = useState<string[]>([]);
  const [domainDenylist, setDomainDenylistState] = useState<string[]>([]);
  const [domainPolicyEnrichGateEnabled, setDomainPolicyEnrichGateEnabledState] =
    useState(true);
  const [internalAssetEnrichGateEnabled, setInternalAssetEnrichGateEnabledState] =
    useState(true);
  const [internalAssetDomains, setInternalAssetDomainsState] = useState<string[]>(
    []
  );
  const [internalAssetCidrRanges, setInternalAssetCidrRangesState] = useState<
    string[]
  >([]);
  const [internalAssetVendorLabels, setInternalAssetVendorLabelsState] = useState<
    InternalAssetVendorLabelEntry[]
  >([]);
  const [internalAssetDomainDraft, setInternalAssetDomainDraft] = useState("");
  const [internalAssetCidrDraft, setInternalAssetCidrDraft] = useState("");
  const [internalAssetVendorLabelDraft, setInternalAssetVendorLabelDraft] =
    useState("");
  const [internalAssetVendorPatternDraft, setInternalAssetVendorPatternDraft] =
    useState("");
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
  const [clearCacheState, setClearCacheState] = useState<
    "idle" | "clearing" | "cleared" | "error"
  >("idle");
  const [exportState, setExportState] = useState<
    "idle" | "exporting" | "exported" | "error"
  >("idle");
  const [importState, setImportState] = useState<
    "idle" | "importing" | "imported" | "error"
  >("idle");
  const [fieldStates, setFieldStates] = useState<Record<ApiKeySlot, ApiKeyFieldState>>(
    createEmptyApiKeyFieldStates()
  );

  useEffect(() => {
    setReady(false);
    void Promise.all([
      getAutoScanEnabled(),
      getManualOnlyMode(),
      getEnrichmentSourceEnabled(),
      getIocTypeEnabled(),
      getIncludePrivateIpv4(),
      getLocalBackendEnabled(),
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
          sourceEnabledValue,
          iocTypeEnabledValue,
          includePrivateIpv4Value,
          localBackendEnabledValue,
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
          setEnrichmentSourceEnabledState(sourceEnabledValue);
          setIocTypeEnabledState(iocTypeEnabledValue);
          setIncludePrivateIpv4State(includePrivateIpv4Value);
          setLocalBackendEnabledState(localBackendEnabledValue);
          setShowDisabledSourcesInWorkspaceState(showDisabledSourcesValue);
          setShowPreQueryNoticesState(showPreQueryNoticesValue);
          setPreQueryNoticePreferenceConfiguredState(
            preQueryNoticePreferenceConfiguredValue
          );
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
          setSourceCacheTtlDraftsState(
            formatSourceCacheTtlDrafts(sourceCacheTtlValue)
          );
          setFieldStates(
            Object.fromEntries(entries) as Record<ApiKeySlot, ApiKeyFieldState>
          );
          setReady(true);
        }
      )
      .catch(() => {
        setReady(true);
      });
  }, [settingsReloadToken]);

  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (observerEntries) => {
        const visible = observerEntries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
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

  const handleSourceToggle = (sourceId: EnrichmentSourceId, checked: boolean) => {
    setEnrichmentSourceEnabledState((current) => ({
      ...current,
      [sourceId]: checked,
    }));
    void setEnrichmentSourceEnabled(sourceId, checked);
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

  const handleLocalBackendToggle = (checked: boolean) => {
    setLocalBackendEnabledState(checked);
    void setLocalBackendEnabled(checked);
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
      internalAssetVendorLabels.some(
        (entry) => entry.label === label && entry.pattern === pattern
      )
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

  const handleRemoveInternalAssetVendorLabel = (
    entry: InternalAssetVendorLabelEntry
  ) => {
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
    if (
      trimmed.length > 0 &&
      INSTALL_QUICK_START_KEY_SLOTS.includes(slot)
    ) {
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

    const parsed = readStoredCacheTtlSeconds(
      raw,
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS
    );
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

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
        <span className="v5-topbar__saved">
          <span className="v5-topbar__dot" aria-hidden="true" />
          Saved automatically
        </span>
      </div>
      <div className="v5-shell">
        <aside className="v5-sidebar">
          <div className="v5-brand">
            <span className="v5-brand__mark" aria-hidden="true" />
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
            <section
              className="v5-card"
              aria-labelledby="install-quick-start-heading"
            >
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
                    Vera5 runs locally in your browser—no Vera5-operated
                    telemetry and no full-page upload. Pin the toolbar action,
                    open an <code>http://</code> or <code>https://</code> page,
                    and use <strong>Scan page</strong> from the popup or{" "}
                    <strong>Ctrl+Shift+Y</strong> / <strong>Cmd+Shift+Y</strong>.
                    Detection and highlighting work without API keys; live
                    enrichment is optional. Serve the repository{" "}
                    <code>examples/</code> folder over HTTP to try fixture pages.
                  </p>
                ) : null}
                {quickStartStep === 1 ? (
                  <p className="v5-card__desc">
                    Bring your own API keys for live enrichment. Keys stay in{" "}
                    <code>chrome.storage.local</code> on this profile—Vera5 does
                    not operate a shared enrichment backend. Only detected
                    indicator values are sent to vendors you enable—not full page
                    content. Only <strong>AbuseIPDB</strong>,{" "}
                    <strong>OTX</strong>, <strong>URLScan.io</strong>, and{" "}
                    <strong>GreyNoise</strong> perform live HTTPS queries today;
                    add keys later under <strong>API keys</strong> if you skip
                    this step.
                  </p>
                ) : null}
                {quickStartStep === 2 ? (
                  <p className="v5-card__desc">
                    <strong>Manual-only enrichment</strong> is the recommended
                    default and stays on unless you turn it off below. Live threat
                    intelligence runs only when you use the enrich control on a
                    highlight—not when you open a card or scan a page.
                    Auto-scan on page load stays off until you enable it under{" "}
                    <strong>Scanning</strong>.
                  </p>
                ) : null}
                {quickStartStep === 3 ? (
                  <p className="v5-card__desc">
                    Trust controls ship with conservative defaults: domain and
                    internal-asset enrich gates on, sensitive webmail patterns
                    blocked, and auto-scan off. Choose whether to show a short
                    notice before each live vendor query. With manual-only
                    enrichment, queries still require your enrich action even
                    when notices are dismissed.
                  </p>
                ) : null}
              </div>
              <div className="v5-card__body">
                {quickStartStep === 0 ? (
                  <ul className="v5-domain-list" aria-label="Install checklist">
                    <li className="v5-domain-list__item">
                      Load unpacked from <code>extension/dist/</code>
                    </li>
                    <li className="v5-domain-list__item">
                      Pin the Vera5 toolbar action
                    </li>
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
                        Auto-scan on page changes:{" "}
                        {autoScanEnabled ? "on" : "off (recommended)"}
                      </li>
                      <li className="v5-domain-list__item">
                        Live enrichment sources: none enabled until you save a
                        key and turn a source on
                      </li>
                    </ul>
                  </div>
                ) : null}
                {quickStartStep === 3 ? (
                  <div>
                    <ul
                      className="v5-domain-list"
                      aria-label="Default trust settings"
                    >
                      <li className="v5-domain-list__item">
                        Domain policy: allow by default with a sensitive webmail
                        denylist ({domainDenylist.length} host patterns)
                      </li>
                      <li className="v5-domain-list__item">
                        Domain enrich gate:{" "}
                        {domainPolicyEnrichGateEnabled ? "on" : "off"}
                      </li>
                      <li className="v5-domain-list__item">
                        Internal asset enrich gate:{" "}
                        {internalAssetEnrichGateEnabled ? "on" : "off"}
                      </li>
                      <li className="v5-domain-list__item">
                        Auto-scan on page changes:{" "}
                        {autoScanEnabled ? "on" : "off (default)"}
                      </li>
                    </ul>
                    <p className="v5-row__hint" style={{ marginTop: 16 }}>
                      Pre-query notices name enabled vendors and the indicator
                      value before a live fetch. Adjust domain policy, internal
                      assets, and scanning under{" "}
                      <strong>Trust &amp; Consent</strong> and{" "}
                      <strong>Scanning</strong>.
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
                        onClick={() =>
                          handlePreQueryNoticeFirstRunChoice(true)
                        }
                      >
                        Show pre-query notices (recommended)
                      </button>
                      <button
                        type="button"
                        className="v5-btn v5-btn--ghost"
                        onClick={() =>
                          handlePreQueryNoticeFirstRunChoice(false)
                        }
                      >
                        Skip pre-query notices
                      </button>
                    </div>
                  </div>
                ) : null}
                {quickStartStep < 3 ? (
                  <div
                    className="v5-actions"
                    style={{ marginTop: quickStartStep === 0 ? 16 : 0 }}
                  >
                    {quickStartStep > 0 ? (
                      <button
                        type="button"
                        className="v5-btn v5-btn--ghost"
                        onClick={() =>
                          setQuickStartStep(
                            (current) =>
                              (current - 1) as InstallQuickStartStep
                          )
                        }
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="v5-btn v5-btn--primary"
                      onClick={() =>
                        setQuickStartStep(
                          (current) =>
                            (current + 1) as InstallQuickStartStep
                        )
                      }
                    >
                      {quickStartStep === 1 ? "Continue without keys" : "Continue"}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section
            id="overview"
            className="v5-card"
            aria-labelledby="overview-heading"
          >
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
                A snapshot of how VERA5 is currently scanning and enriching this
                browser.
              </p>
            </div>
            <div
              id="overview-body"
              className="v5-card__body"
              hidden={collapsedSections.overview}
            >
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
                  <div className="v5-stat__value">
                    {formatCacheTtl(parsedGlobalTtl)}
                  </div>
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

          <section
            id="scanning"
            className="v5-card"
            aria-labelledby="scanning-heading"
          >
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
              <p className="v5-card__desc">
                Control when VERA5 inspects pages for indicators.
              </p>
            </div>
            <div
              id="scanning-body"
              className="v5-card__body"
              hidden={collapsedSections.scanning}
            >
              <ToggleRow
                label="Automatically scan when the page changes"
                hint="When off, scan only with Scan page in the popup or the keyboard shortcut."
                ariaLabel="Automatically scan when the page changes"
                checked={autoScanEnabled}
                disabled={!ready}
                onChange={handleAutoScanToggle}
              />
            </div>
          </section>

          <section
            id="indicators"
            className="v5-card"
            aria-labelledby="indicators-heading"
          >
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
                Choose which indicator types Vera5 detects during page scans.
                Disabled types are omitted from highlights and scan counts.
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
                      onChange={(event) =>
                        handleIocTypeToggle(iocType, event.target.checked)
                      }
                      aria-label={`Enable ${IOC_TYPE_OPTION_LABELS[iocType]}`}
                    />
                    <span className="v5-ioc-card__badge">
                      {IOC_TYPE_CODES[iocType]}
                    </span>
                    <span className="v5-ioc-card__text">
                      <span className="v5-ioc-card__name">
                        {IOC_TYPE_SHORT_LABELS[iocType]}
                      </span>
                    </span>
                    <span className="v5-ioc-card__check">
                      <CheckIcon />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section
            className="v5-card"
            aria-labelledby="private-ipv4-heading"
          >
            <div className="v5-card__head">
              <h2
                id="private-ipv4-heading"
                className="v5-card__title"
                style={{ fontSize: 18 }}
              >
                <button
                  type="button"
                  className="v5-card__toggle"
                  aria-expanded={!collapsedSections["private-ipv4"]}
                  aria-controls="private-ipv4-body"
                  onClick={() => toggleSection("private-ipv4")}
                >
                  <span className="v5-card__toggle-text">
                    Private-Space IPv4 Addresses
                  </span>
                  <span className="v5-card__chevron" aria-hidden="true" />
                </button>
              </h2>
              <p className="v5-card__desc">
                A core control for SOC and lab workflows. When off, RFC1918,
                loopback, and link-local IPv4 literals are omitted from page scans
                so internal network addresses are never treated as indicators.
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

          <section
            id="sources"
            className="v5-card"
            aria-labelledby="sources-heading"
          >
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
                Choose which threat intelligence sources Vera5 may use when
                enrichment is available. Disabled sources stay off the hover card
                and are not queried.
              </p>
            </div>
            <div
              id="sources-body"
              className="v5-card__body"
              hidden={collapsedSections.sources}
            >
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
                            {status.withDot ? (
                              <span className="v5-badge__dot" />
                            ) : null}
                            {status.label}
                          </span>
                        </span>
                        <span className="v5-source__spacer" />
                        <Switch
                          ariaLabel={`Enable ${ENRICHMENT_SOURCE_LABELS[sourceId]}`}
                          checked={enrichmentSourceEnabled[sourceId] === true}
                          disabled={!ready}
                          onChange={(checked) =>
                            handleSourceToggle(sourceId, checked)
                          }
                        />
                      </div>
                      <div className="v5-source__body">
                        <p className="v5-row__hint" style={{ margin: 0 }}>
                          {ENRICHMENT_SOURCE_DESCRIPTIONS[sourceId]}
                        </p>
                        <div className="v5-source__row">
                          <label style={{ display: "block" }}>
                            <span
                              className="v5-field__label"
                              style={{ marginBottom: 6 }}
                            >
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
              <p
                className="v5-status v5-status--muted"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                {ENRICHMENT_SOURCE_OPS_POPUP_GUIDANCE}
              </p>
            </div>
          </section>

          <section
            id="trust"
            className="v5-card"
            aria-labelledby="trust-heading"
          >
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
                Control transparency before live enrichment queries leave this
                browser.
              </p>
            </div>
            <div
              id="trust-body"
              className="v5-card__body"
              hidden={collapsedSections.trust}
            >
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
                  Controls auto-scan and live enrichment on the current tab
                  hostname. Pattern syntax supports exact hosts, prefix wildcards
                  such as <code>mail.*</code>, and suffix wildcards such as{" "}
                  <code>*.corp.example</code>.
                </span>
                <div className="v5-domain-mode">
                  <label className="v5-domain-mode__option">
                    <input
                      type="radio"
                      name="domainPolicyMode"
                      checked={
                        domainPolicyMode === DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
                      }
                      onChange={() =>
                        handleDomainPolicyModeChange(
                          DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
                        )
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
                      checked={
                        domainPolicyMode === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT
                      }
                      onChange={() =>
                        handleDomainPolicyModeChange(
                          DOMAIN_POLICY_MODE_DENY_BY_DEFAULT
                        )
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
                  Vera5 ships <strong>allow by default</strong> as the product
                  default with a built-in sensitive webmail denylist. Presets
                  merge additional patterns into your lists without removing
                  entries you added manually.
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
                  Block live enrichment when an indicator matches your known
                  internal domains, IPv4 CIDR ranges, or labeled vendor/SaaS
                  hostname patterns. Lists apply to the indicator value, not
                  the page hostname.
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
              <div className="v5-field">
                <span className="v5-field__label">Analyst workflow presets</span>
                <span
                  className="v5-status v5-status--muted"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Apply SOC, CTI, or DFIR defaults for enrichment toggles, the
                  default export template, and recommended pivot ordering.
                </span>
                <div className="v5-presets">
                  {ANALYST_MODE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`v5-preset${
                        analystModePresetId === preset.id
                          ? " v5-preset--active"
                          : ""
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
                Vera5 stores recent threat intelligence responses locally to reduce
                API usage. Clearing the cache removes saved responses; your settings
                and API keys are not affected.
              </p>
            </div>
            <div
              id="cache-body"
              className="v5-card__body"
              hidden={collapsedSections.cache}
            >
              <div className="v5-field">
                <span className="v5-field__label">Default cache lifetime</span>
                <div className="v5-presets">
                  {CACHE_PRESETS.map((preset) => (
                    <button
                      key={preset.seconds}
                      type="button"
                      className={`v5-preset${
                        parsedGlobalTtl === preset.seconds
                          ? " v5-preset--active"
                          : ""
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
                  onChange={(event) =>
                    setGlobalCacheTtlSecondsState(event.target.value)
                  }
                  onBlur={handleGlobalCacheTtlBlur}
                  aria-label="Default cache lifetime in seconds"
                />
                <span className="v5-status v5-status--muted">
                  Custom value in seconds. Per-source overrides use this default
                  when left blank.
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

          <section
            id="backup"
            className="v5-card"
            aria-labelledby="settings-backup-heading"
          >
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
                Export your preferences as JSON to move them between profiles or
                keep a backup. API keys are excluded unless you choose to include
                them.
              </p>
            </div>
            <div
              id="backup-body"
              className="v5-card__body"
              hidden={collapsedSections.backup}
            >
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
              </div>
              {exportState === "exported" ? (
                <span className="v5-status v5-status--success" role="status">
                  <CheckIcon />
                  Settings exported.
                </span>
              ) : null}
              {exportState === "error" ? (
                <span className="v5-status v5-status--error" role="status">
                  Could not export settings. Try again.
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

          <section
            id="api-keys"
            className="v5-card"
            aria-labelledby="api-keys-heading"
          >
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
                Keys are stored locally in your browser. Vera5 does not operate a
                shared enrichment service or receive your credentials.
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
        </div>
      </div>
    </main>
  );
}
