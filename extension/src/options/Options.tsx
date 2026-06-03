import { useEffect, useRef, useState } from "react";
import { clearEnrichmentCache } from "../lib/cache";
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
  IocTypeEnabledRecord,
} from "../lib/storage";
import type { IocType } from "../lib/iocRegex";
import {
  API_KEY_SLOTS,
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  getApiKey,
  getAutoScanEnabled,
  getEnrichmentCacheTtlSecondsFromSettings,
  getEnrichmentSourceCacheTtlSeconds,
  getEnrichmentSourceEnabled,
  getIncludePrivateIpv4,
  getIocTypeEnabled,
  getManualOnlyMode,
  hasApiKey,
  IOC_TYPE_SETTINGS_ORDER,
  isMaskedApiKeyDisplay,
  maskApiKeyForDisplay,
  readStoredCacheTtlSeconds,
  setApiKey,
  setAutoScanEnabled,
  setEnrichmentCacheTtlSeconds,
  setEnrichmentSourceCacheTtlSeconds,
  setEnrichmentSourceEnabled,
  setIncludePrivateIpv4,
  setIocTypeEnabled,
  setManualOnlyMode,
} from "../lib/storage";

const OPTIONS_API_KEY_SLOTS: ApiKeySlot[] = ["abuseipdb", "otx"];

const ENRICHMENT_SOURCE_LABELS: Record<ApiKeySlot, string> = {
  abuseipdb: "AbuseIPDB",
  otx: "OTX",
  urlscan: "URLScan.io",
  greynoise: "GreyNoise",
};

const ENRICHMENT_SOURCE_DESCRIPTIONS: Record<ApiKeySlot, string> = {
  abuseipdb: "IP reputation and abuse confidence scoring.",
  otx: "AlienVault Open Threat Exchange pulses.",
  urlscan: "URL and domain scan intelligence.",
  greynoise: "Internet background-noise context.",
};

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
    API_KEY_SLOTS.map((sourceId) => [sourceId, false])
  ) as EnrichmentSourceEnabledRecord;
}

function createDefaultSourceCacheTtlDrafts(): Record<ApiKeySlot, string> {
  return Object.fromEntries(
    API_KEY_SLOTS.map((sourceId) => [sourceId, ""])
  ) as Record<ApiKeySlot, string>;
}

function formatSourceCacheTtlDrafts(
  overrides: EnrichmentSourceCacheTtlRecord
): Record<ApiKeySlot, string> {
  return Object.fromEntries(
    API_KEY_SLOTS.map((sourceId) => [
      sourceId,
      overrides[sourceId] !== undefined ? String(overrides[sourceId]) : "",
    ])
  ) as Record<ApiKeySlot, string>;
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
    }
  };

  const handleBlur = () => {
    if (!ready) {
      return;
    }

    const trimmed = fieldState.draft.trim();

    if (fieldState.editing && !trimmed) {
      onEditingChange(slot, false);
      onDraftChange(slot, "");
      return;
    }

    if (!fieldState.editing || !trimmed || isMaskedApiKeyDisplay(trimmed)) {
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
          onChange={(event) => onDraftChange(slot, event.target.value)}
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

export function Options() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const [autoScanEnabled, setAutoScanEnabledState] = useState(false);
  const [manualOnlyMode, setManualOnlyModeState] = useState(true);
  const [enrichmentSourceEnabled, setEnrichmentSourceEnabledState] =
    useState<EnrichmentSourceEnabledRecord>(createDefaultSourceEnabledState());
  const [iocTypeEnabled, setIocTypeEnabledState] =
    useState<IocTypeEnabledRecord>(createDefaultIocTypeEnabledState());
  const [includePrivateIpv4, setIncludePrivateIpv4State] = useState(false);
  const [globalCacheTtlSeconds, setGlobalCacheTtlSecondsState] = useState(
    String(DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS)
  );
  const [sourceCacheTtlDrafts, setSourceCacheTtlDraftsState] = useState<
    Record<ApiKeySlot, string>
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
  const [fieldStates, setFieldStates] = useState<
    Record<(typeof OPTIONS_API_KEY_SLOTS)[number], ApiKeyFieldState>
  >({
    abuseipdb: createEmptyFieldState(),
    otx: createEmptyFieldState(),
  });

  useEffect(() => {
    setReady(false);
    void Promise.all([
      getAutoScanEnabled(),
      getManualOnlyMode(),
      getEnrichmentSourceEnabled(),
      getIocTypeEnabled(),
      getIncludePrivateIpv4(),
      getEnrichmentCacheTtlSecondsFromSettings(),
      getEnrichmentSourceCacheTtlSeconds(),
      ...OPTIONS_API_KEY_SLOTS.map(async (slot) => {
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
          globalCacheTtlValue,
          sourceCacheTtlValue,
          ...entries
        ]) => {
          setAutoScanEnabledState(autoScanValue);
          setManualOnlyModeState(manualOnlyValue);
          setEnrichmentSourceEnabledState(sourceEnabledValue);
          setIocTypeEnabledState(iocTypeEnabledValue);
          setIncludePrivateIpv4State(includePrivateIpv4Value);
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

  const handleNavClick = (id: string) => {
    setActiveSection(id);
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

  const handleSourceToggle = (sourceId: ApiKeySlot, checked: boolean) => {
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

  const handleSourceCacheTtlBlur = (sourceId: ApiKeySlot) => {
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
    void clearEnrichmentCache()
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
  const enabledSources = API_KEY_SLOTS.filter(
    (sourceId) => enrichmentSourceEnabled[sourceId] === true
  );
  const parsedGlobalTtl = Number(globalCacheTtlSeconds);

  const sourceStatus = (
    sourceId: ApiKeySlot
  ): { className: string; label: string; withDot: boolean } => {
    const enabled = enrichmentSourceEnabled[sourceId] === true;
    if (!enabled) {
      return { className: "v5-badge--off", label: "Disabled", withDot: false };
    }
    const keyed = OPTIONS_API_KEY_SLOTS.includes(sourceId);
    if (keyed && !fieldStates[sourceId]?.configured) {
      return { className: "v5-badge--warn", label: "No API key", withDot: true };
    }
    if (keyed) {
      return { className: "v5-badge--on", label: "Connected", withDot: true };
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
              <span className="v5-brand__name">VERA5</span>
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

          <section
            id="overview"
            className="v5-card"
            aria-labelledby="overview-heading"
          >
            <div className="v5-card__head">
              <h2 id="overview-heading" className="v5-card__title">
                Overview
              </h2>
              <p className="v5-card__desc">
                A snapshot of how VERA5 is currently scanning and enriching this
                browser.
              </p>
            </div>
            <div className="v5-card__body">
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
                    <small> / {API_KEY_SLOTS.length} enabled</small>
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
                Scanning
              </h2>
              <p className="v5-card__desc">
                Control when VERA5 inspects pages for indicators.
              </p>
            </div>
            <div className="v5-card__body">
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
                Indicator types
              </h2>
              <p className="v5-card__desc">
                Choose which indicator types Vera5 detects during page scans.
                Disabled types are omitted from highlights and scan counts.
              </p>
            </div>
            <div className="v5-card__body">
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
                Private-space IPv4 addresses
              </h2>
              <p className="v5-card__desc">
                A core control for SOC and lab workflows. When off, RFC1918,
                loopback, and link-local IPv4 literals are omitted from page scans
                so internal network addresses are never treated as indicators.
              </p>
            </div>
            <div className="v5-card__body">
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
                Enrichment sources
              </h2>
              <p className="v5-card__desc">
                Choose which threat intelligence sources Vera5 may use when
                enrichment is available. Disabled sources stay off the hover card
                and are not queried.
              </p>
            </div>
            <div className="v5-card__body">
              <ToggleRow
                label="Manual-only enrichment"
                hint="When on, threat intelligence loads only when you use the enrich control on a highlight. When off, Vera5 may request enrichment automatically when you open an indicator card."
                ariaLabel="Manual-only enrichment"
                checked={manualOnlyMode}
                disabled={!ready}
                onChange={handleManualOnlyToggle}
              />
              <div className="v5-sources">
                {API_KEY_SLOTS.map((sourceId) => {
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
                        <div className="v5-source__health">
                          Source health monitoring coming soon.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="cache" className="v5-card" aria-labelledby="cache-heading">
            <div className="v5-card__head">
              <h2 id="cache-heading" className="v5-card__title">
                Enrichment cache
              </h2>
              <p className="v5-card__desc">
                Vera5 stores recent threat intelligence responses locally to reduce
                API usage. Clearing the cache removes saved responses; your settings
                and API keys are not affected.
              </p>
            </div>
            <div className="v5-card__body">
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
                Settings backup
              </h2>
              <p className="v5-card__desc">
                Export your preferences as JSON to move them between profiles or
                keep a backup. API keys are excluded unless you choose to include
                them.
              </p>
            </div>
            <div className="v5-card__body">
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
                API keys
              </h2>
              <p className="v5-card__desc">
                Keys are stored locally in your browser. Vera5 does not operate a
                shared enrichment service or receive your credentials.
              </p>
            </div>
            <div className="v5-card__body">
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
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
