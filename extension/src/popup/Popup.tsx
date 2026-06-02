import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { scanPageMessage } from "../lib/messages";
import { requestTabScanSummaryForActiveTab } from "../lib/tabScanSummaryClient";
import {
  buildTabScanCountSummaryText,
  filterTabScanSummaryEntries,
  IOC_TYPE_TRAY_LABEL,
  listIocTypesPresentInSummary,
  type IocTypeFilter,
  type TabScanSummary,
} from "../lib/tabScanSummary";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  setExtensionEnabled,
  setHighlightEnabled,
} from "../lib/storage";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";

const POPUP_THEME = {
  surface: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
  border: "#475569",
  accent: "#60a5fa",
  accentText: "#dbeafe",
  buttonBg: "#334155",
  error: "#fca5a5",
  trayRowBg: "#0f172a",
  filterActiveBg: "#1d4ed8",
};

const buttonStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: `1px solid ${POPUP_THEME.border}`,
  backgroundColor: POPUP_THEME.buttonBg,
  color: POPUP_THEME.accentText,
  fontWeight: 600 as const,
  cursor: "pointer" as const,
};

function filterChipStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${active ? POPUP_THEME.filterActiveBg : POPUP_THEME.border}`,
    backgroundColor: active ? POPUP_THEME.filterActiveBg : POPUP_THEME.buttonBg,
    color: active ? "#ffffff" : POPUP_THEME.accentText,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [highlightEnabled, setHighlightEnabledState] = useState(true);
  const [ready, setReady] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error">(
    "idle"
  );
  const [scanSummary, setScanSummary] = useState<TabScanSummary | null>(null);
  const [typeFilter, setTypeFilter] = useState<IocTypeFilter>("all");

  useEffect(() => {
    void Promise.all([getExtensionEnabled(), getHighlightEnabled()]).then(
      ([extensionValue, highlightValue]) => {
        setEnabled(extensionValue);
        setHighlightEnabledState(highlightValue);
        setReady(true);
      }
    );
    void requestTabScanSummaryForActiveTab().then((summary) => {
      if (summary) {
        setScanSummary(summary);
        setScanState("done");
      }
    });
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.backgroundColor = POPUP_THEME.surface;
    document.body.style.color = POPUP_THEME.text;
  }, []);

  const filteredEntries = useMemo(() => {
    if (!scanSummary) {
      return [];
    }
    return filterTabScanSummaryEntries(scanSummary.entries, typeFilter);
  }, [scanSummary, typeFilter]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    void setExtensionEnabled(checked);
    if (!checked) {
      setScanState("idle");
      setScanSummary(null);
      setTypeFilter("all");
    }
  };

  const handleHighlightToggle = (checked: boolean) => {
    setHighlightEnabledState(checked);
    void setHighlightEnabled(checked);
  };

  const handleOpenSettings = () => {
    void chrome.runtime.openOptionsPage();
  };

  const handleOpenPermissions = () => {
    openExtensionSitePermissionsPage();
  };

  const handleScanPage = () => {
    if (!enabled) {
      return;
    }
    setScanState("scanning");
    setScanSummary(null);
    setTypeFilter("all");
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setScanState("error");
          return;
        }
        try {
          const response = await chrome.tabs.sendMessage(tab.id, scanPageMessage());
          if (
            response &&
            typeof response === "object" &&
            "ok" in response &&
            response.ok === true
          ) {
            const summary = await requestTabScanSummaryForActiveTab();
            if (summary) {
              setScanSummary(summary);
              setScanState("done");
              return;
            }
          }
          setScanState("error");
        } catch {
          setScanState("error");
        }
      });
  };

  return (
    <main
      style={{
        minWidth: 280,
        maxWidth: 360,
        padding: 14,
        fontFamily: "system-ui, sans-serif",
        backgroundColor: POPUP_THEME.surface,
        color: POPUP_THEME.text,
      }}
    >
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: POPUP_THEME.accent,
          margin: "0 0 14px",
        }}
      >
        VERA5
      </h1>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: ready ? "pointer" : "wait",
          marginBottom: 12,
          color: POPUP_THEME.text,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          onChange={(event) => handleToggle(event.target.checked)}
          aria-label="Extension enabled"
        />
        Extension enabled
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: ready && enabled ? "pointer" : "not-allowed",
          marginBottom: 12,
          color: POPUP_THEME.text,
        }}
      >
        <input
          type="checkbox"
          checked={highlightEnabled}
          disabled={!ready || !enabled}
          onChange={(event) => handleHighlightToggle(event.target.checked)}
          aria-label="Highlight indicators"
        />
        Highlight indicators
      </label>
      <button
        type="button"
        disabled={!ready || !enabled || scanState === "scanning"}
        onClick={handleScanPage}
        style={{
          ...buttonStyle,
          marginBottom: 8,
          cursor: !ready || !enabled ? "not-allowed" : "pointer",
          opacity: !ready || !enabled ? 0.65 : 1,
        }}
      >
        {scanState === "scanning" ? "Scanning…" : "Scan page"}
      </button>
      <button
        type="button"
        disabled={!ready}
        onClick={handleOpenSettings}
        style={{
          ...buttonStyle,
          marginBottom: 8,
          cursor: ready ? "pointer" : "not-allowed",
          opacity: ready ? 1 : 0.65,
        }}
      >
        Settings
      </button>
      <button
        type="button"
        disabled={!ready}
        onClick={handleOpenPermissions}
        style={{
          ...buttonStyle,
          cursor: ready ? "pointer" : "not-allowed",
          opacity: ready ? 1 : 0.65,
        }}
      >
        Permissions
      </button>
      {scanState === "error" ? (
        <p style={{ fontSize: 12, margin: "10px 0 0", color: POPUP_THEME.error }}>
          Scan failed. Reload the tab and try again.
        </p>
      ) : null}
      {scanSummary ? (
        <section
          aria-label="Detected indicators"
          style={{ marginTop: 14, borderTop: `1px solid ${POPUP_THEME.border}`, paddingTop: 12 }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: "0 0 8px",
              color: POPUP_THEME.accentText,
            }}
          >
            Detected indicators
          </h2>
          <p style={{ fontSize: 12, margin: "0 0 10px", color: POPUP_THEME.muted }}>
            {buildTabScanCountSummaryText(scanSummary)}
          </p>
          <div
            role="group"
            aria-label="Filter by indicator type"
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}
          >
            <button
              type="button"
              aria-pressed={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              style={filterChipStyle(typeFilter === "all")}
            >
              All ({scanSummary.totalCount})
            </button>
            {listIocTypesPresentInSummary(scanSummary).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
                style={filterChipStyle(typeFilter === type)}
              >
                {IOC_TYPE_TRAY_LABEL[type]} ({scanSummary.countByType[type] ?? 0})
              </button>
            ))}
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {filteredEntries.map((entry) => (
              <li
                key={entry.anchorId}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${POPUP_THEME.border}`,
                  backgroundColor: POPUP_THEME.trayRowBg,
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    padding: "1px 6px",
                    borderRadius: 4,
                    backgroundColor: POPUP_THEME.buttonBg,
                    color: POPUP_THEME.accent,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {IOC_TYPE_TRAY_LABEL[entry.type]}
                </span>
                <span
                  style={{
                    color: POPUP_THEME.text,
                    wordBreak: "break-all",
                  }}
                >
                  {entry.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
