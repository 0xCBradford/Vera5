import { useEffect, useRef, useState } from "react";
import { clearEnrichmentCache } from "../lib/cache";
import {
  downloadVera5SettingsExport,
  exportVera5SettingsJson,
  importVera5SettingsJson,
} from "../lib/settingsExport";
import type { ApiKeySlot, EnrichmentSourceEnabledRecord } from "../lib/storage";
import {
  API_KEY_SLOTS,
  getApiKey,
  getAutoScanEnabled,
  getEnrichmentSourceEnabled,
  getManualOnlyMode,
  hasApiKey,
  isMaskedApiKeyDisplay,
  maskApiKeyForDisplay,
  setApiKey,
  setAutoScanEnabled,
  setEnrichmentSourceEnabled,
  setManualOnlyMode,
} from "../lib/storage";

const OPTIONS_API_KEY_SLOTS: ApiKeySlot[] = ["abuseipdb", "otx"];

const ENRICHMENT_SOURCE_LABELS: Record<ApiKeySlot, string> = {
  abuseipdb: "AbuseIPDB",
  otx: "OTX",
  urlscan: "URLScan.io",
  greynoise: "GreyNoise",
};

function createDefaultSourceEnabledState(): EnrichmentSourceEnabledRecord {
  return Object.fromEntries(
    API_KEY_SLOTS.map((sourceId) => [sourceId, false])
  ) as EnrichmentSourceEnabledRecord;
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
    <label
      style={{
        display: "block",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label} API key
      </span>
      <input
        type="password"
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
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
        }}
      />
      {fieldState.configured && !fieldState.editing ? (
        <span style={{ display: "block", fontSize: 12, marginTop: 4, color: "#555" }}>
          Key saved. Only the last four characters are shown.
        </span>
      ) : null}
      {saveState === "saved" ? (
        <span style={{ display: "block", fontSize: 12, marginTop: 4, color: "#0d6b0d" }}>
          Saved locally.
        </span>
      ) : null}
      {saveState === "error" ? (
        <span style={{ display: "block", fontSize: 12, marginTop: 4, color: "#b00020" }}>
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
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const [autoScanEnabled, setAutoScanEnabledState] = useState(false);
  const [manualOnlyMode, setManualOnlyModeState] = useState(true);
  const [enrichmentSourceEnabled, setEnrichmentSourceEnabledState] =
    useState<EnrichmentSourceEnabledRecord>(createDefaultSourceEnabledState());
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
      .then(([autoScanValue, manualOnlyValue, sourceEnabledValue, ...entries]) => {
        setAutoScanEnabledState(autoScanValue);
        setManualOnlyModeState(manualOnlyValue);
        setEnrichmentSourceEnabledState(sourceEnabledValue);
        setFieldStates(
          Object.fromEntries(entries) as Record<ApiKeySlot, ApiKeyFieldState>
        );
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, [settingsReloadToken]);

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

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "24px auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Vera5 Settings</h1>
      <p style={{ margin: "0 0 24px", color: "#333" }}>
        Configure threat intelligence sources and extension preferences.
      </p>
      <section aria-labelledby="scanning-heading" style={{ marginBottom: 32 }}>
        <h2 id="scanning-heading" style={{ fontSize: 18, margin: "0 0 8px" }}>
          Scanning
        </h2>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            cursor: ready ? "pointer" : "wait",
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={autoScanEnabled}
            disabled={!ready}
            onChange={(event) => handleAutoScanToggle(event.target.checked)}
            aria-label="Automatically scan when the page changes"
          />
          <span style={{ fontSize: 14 }}>
            Automatically scan when the page changes
          </span>
        </label>
        <p style={{ margin: 0, fontSize: 14, color: "#444" }}>
          When off, scan only with Scan page in the popup or the keyboard shortcut.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            cursor: ready ? "pointer" : "wait",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={manualOnlyMode}
            disabled={!ready}
            onChange={(event) => handleManualOnlyToggle(event.target.checked)}
            aria-label="Manual-only enrichment"
          />
          <span style={{ fontSize: 14 }}>Manual-only enrichment</span>
        </label>
        <p style={{ margin: 0, fontSize: 14, color: "#444" }}>
          When on, threat intelligence loads only when you use the enrich control on
          a highlight. When off, Vera5 may request enrichment automatically when you
          open an indicator card.
        </p>
      </section>
      <section
        aria-labelledby="enrichment-sources-heading"
        style={{ marginBottom: 32 }}
      >
        <h2
          id="enrichment-sources-heading"
          style={{ fontSize: 18, margin: "0 0 8px" }}
        >
          Enrichment sources
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444" }}>
          Choose which threat intelligence sources Vera5 may use when enrichment is
          available. Disabled sources stay off the hover card and are not queried.
        </p>
        {API_KEY_SLOTS.map((sourceId) => (
          <label
            key={sourceId}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              cursor: ready ? "pointer" : "wait",
              marginBottom: 12,
            }}
          >
            <input
              type="checkbox"
              checked={enrichmentSourceEnabled[sourceId] === true}
              disabled={!ready}
              onChange={(event) =>
                handleSourceToggle(sourceId, event.target.checked)
              }
              aria-label={`Enable ${ENRICHMENT_SOURCE_LABELS[sourceId]}`}
            />
            <span style={{ fontSize: 14 }}>{ENRICHMENT_SOURCE_LABELS[sourceId]}</span>
          </label>
        ))}
      </section>
      <section aria-labelledby="cache-heading" style={{ marginBottom: 32 }}>
        <h2 id="cache-heading" style={{ fontSize: 18, margin: "0 0 8px" }}>
          Enrichment cache
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444" }}>
          Vera5 stores recent threat intelligence responses locally to reduce API
          usage. Clearing the cache removes saved responses; your settings and API
          keys are not affected.
        </p>
        <button
          type="button"
          disabled={!ready || clearCacheState === "clearing"}
          onClick={handleClearCache}
          aria-label="Clear enrichment cache"
          style={{
            padding: "8px 14px",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            cursor: ready && clearCacheState !== "clearing" ? "pointer" : "wait",
          }}
        >
          {clearCacheState === "clearing" ? "Clearing…" : "Clear cache"}
        </button>
        {clearCacheState === "cleared" ? (
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#0d6b0d" }}
          >
            Enrichment cache cleared.
          </span>
        ) : null}
        {clearCacheState === "error" ? (
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#b00020" }}
          >
            Could not clear the cache. Try again.
          </span>
        ) : null}
      </section>
      <section
        aria-labelledby="settings-backup-heading"
        style={{ marginBottom: 32 }}
      >
        <h2
          id="settings-backup-heading"
          style={{ fontSize: 18, margin: "0 0 8px" }}
        >
          Settings backup
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444" }}>
          Export your preferences as JSON to move them between profiles or keep a
          backup. API keys are excluded unless you choose to include them.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            cursor: ready ? "pointer" : "wait",
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={includeApiKeysInExport}
            disabled={!ready}
            onChange={(event) => setIncludeApiKeysInExport(event.target.checked)}
            aria-label="Include API keys in export"
          />
          <span style={{ fontSize: 14 }}>Include API keys in export</span>
        </label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            disabled={!ready || exportState === "exporting"}
            onClick={handleExportSettings}
            aria-label="Export settings JSON"
            style={{
              padding: "8px 14px",
              fontFamily: "system-ui, sans-serif",
              fontSize: 14,
              cursor: ready && exportState !== "exporting" ? "pointer" : "wait",
            }}
          >
            {exportState === "exporting" ? "Exporting…" : "Export settings"}
          </button>
          <button
            type="button"
            disabled={!ready || importState === "importing"}
            onClick={handleImportClick}
            aria-label="Import settings JSON"
            style={{
              padding: "8px 14px",
              fontFamily: "system-ui, sans-serif",
              fontSize: 14,
              cursor: ready && importState !== "importing" ? "pointer" : "wait",
            }}
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
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#0d6b0d" }}
          >
            Settings exported.
          </span>
        ) : null}
        {exportState === "error" ? (
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#b00020" }}
          >
            Could not export settings. Try again.
          </span>
        ) : null}
        {importState === "imported" ? (
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#0d6b0d" }}
          >
            Settings imported.
          </span>
        ) : null}
        {importState === "error" ? (
          <span
            role="status"
            style={{ display: "block", fontSize: 12, marginTop: 8, color: "#b00020" }}
          >
            Could not import settings. Check the file and try again.
          </span>
        ) : null}
      </section>
      <section aria-labelledby="api-keys-heading">
        <h2 id="api-keys-heading" style={{ fontSize: 18, margin: "0 0 8px" }}>
          API keys
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444" }}>
          Keys are stored locally in your browser. Vera5 does not operate a shared
          enrichment service or receive your credentials.
        </p>
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
      </section>
    </main>
  );
}
