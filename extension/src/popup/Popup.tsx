import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  navigateToIocAnchorMessage,
  openWorkspaceMessage,
  enrichSelectionMessage,
  scanPageMessage,
  scanSelectionMessage,
} from "../lib/messages";
import {
  getTabScanTrayFilter,
  saveTabScanTrayFilter,
} from "../lib/tabScanSnapshotStorage";
import { requestTabScanSummaryForActiveTab } from "../lib/tabScanSummaryClient";
import {
  buildTabScanCountSummaryText,
  buildTrayRowNavigationAriaLabel,
  filterTabScanSummaryEntries,
  formatTrayRowEnrichmentHint,
  IOC_TYPE_TRAY_LABEL,
  listIocTypesPresentInSummary,
  loadTrayEntryEnrichmentStatuses,
  resolveTrayCopyFeedback,
  resolveTrayExportFeedback,
  resolveTraySubsetCopyFeedback,
  resolveTrayTemplateCopyFeedback,
  resolveTrayTemplateExportFeedback,
  type IocTypeFilter,
  resolveTrayEntryMatchProvenance,
  type TabScanSummary,
  type TabScanSummaryEntry,
  type TrayEntryEnrichmentStatus,
} from "../lib/tabScanSummary";
import {
  buildWhyDetectedView,
  HOVER_CARD_REFANGED_VALUE_LABEL,
  HOVER_CARD_WHY_DETECTED_HEADING,
  resolveIndicatorValuePresentation,
} from "../lib/hoverCardEnrichment";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  setExtensionEnabled,
  setHighlightEnabled,
} from "../lib/storage";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";
import {
  DEFAULT_INVESTIGATION_SESSION_TITLE,
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  buildInvestigationSessionActivitySummaryText,
  INVESTIGATION_SESSION_EMPTY_STATE_TEXT,
  normalizeInvestigationSessionTitle,
  type InvestigationSession,
} from "../lib/investigationSession";
import {
  requestActiveInvestigationSession,
  requestArchiveInvestigationSession,
  requestCreateInvestigationSession,
  requestDeleteInvestigationSession,
  requestRecentInvestigationSessions,
  requestRenameInvestigationSession,
  requestReopenInvestigationSession,
  requestUpdateInvestigationSessionTitle,
  resolveActiveTabPageUrl,
} from "../lib/investigationSessionClient";
import { VERA5_COLOR } from "../lib/theme";
import {
  resolveWorkspaceTrayView,
  resolveTrayNavigationFeedback,
} from "../lib/workspaceTrayState";

export type PopupTrayView = "prompt" | "scanning" | "empty" | "results";

function trayWhyDetectedDetailsStyle(): CSSProperties {
  return {
    width: "100%",
    marginTop: 4,
    fontSize: 11,
    lineHeight: 1.45,
    color: POPUP_THEME.muted,
  };
}

function TrayIndicatorValue({ entry }: { entry: TabScanSummaryEntry }) {
  const presentation = resolveIndicatorValuePresentation({
    value: entry.value,
    displayValue: entry.displayValue,
  });

  if (!presentation.showRefangedPair) {
    return (
      <span
        style={{
          color: POPUP_THEME.text,
          wordBreak: "break-all",
          flex: 1,
        }}
      >
        {presentation.refangedValue}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1,
        minWidth: 0,
      }}
    >
      <span style={{ color: POPUP_THEME.text, wordBreak: "break-all" }}>
        {presentation.onPageValue}
      </span>
      <span
        style={{
          color: POPUP_THEME.muted,
          wordBreak: "break-all",
          fontSize: 11,
        }}
      >
        {HOVER_CARD_REFANGED_VALUE_LABEL} {presentation.refangedValue}
      </span>
    </span>
  );
}

function WhyDetectedTrayDetails({
  entry,
}: {
  entry: TabScanSummaryEntry;
}) {
  const view = buildWhyDetectedView({
    type: entry.type,
    ruleId: entry.ruleId,
    sourceTextHint: entry.sourceTextHint,
    ignoredOverlaps: entry.ignoredOverlaps,
  });
  if (!view) {
    return null;
  }

  return (
    <details
      className="vera5-tray-why-detected"
      style={trayWhyDetectedDetailsStyle()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        style={{
          cursor: "pointer",
          color: POPUP_THEME.accent,
          fontWeight: 600,
        }}
      >
        {HOVER_CARD_WHY_DETECTED_HEADING}
      </summary>
      <div style={{ marginTop: 4 }}>
        <p style={{ margin: "0 0 4px" }}>Type: {view.typeLabel}</p>
        <p style={{ margin: "0 0 4px" }}>Reason: {view.reason}</p>
        <p style={{ margin: "0 0 4px", wordBreak: "break-word" }}>
          Source context: {view.sourceTextHint}
        </p>
        {view.ignoredOverlaps.length > 0 ? (
          <>
            <p style={{ margin: "0 0 4px" }}>Ignored overlaps:</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {view.ignoredOverlaps.map((overlap) => (
                <li key={`${overlap.typeLabel}-${overlap.value}`}>
                  {overlap.typeLabel} {overlap.value} — {overlap.reason}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ margin: 0 }}>Ignored overlaps: none</p>
        )}
      </div>
    </details>
  );
}

export function resolvePopupTrayView(input: {
  enabled: boolean;
  scanState: "idle" | "scanning" | "done" | "error";
  scanSummary: TabScanSummary | null;
}): PopupTrayView | null {
  return resolveWorkspaceTrayView(input);
}

export { resolveTrayNavigationFeedback };
export {
  resolveTrayCopyFeedback,
  resolveTrayExportFeedback,
  resolveTraySubsetCopyFeedback,
  resolveTrayTemplateCopyFeedback,
  resolveTrayTemplateExportFeedback,
};

const POPUP_THEME = {
  surface: VERA5_COLOR.surface,
  text: VERA5_COLOR.text,
  muted: VERA5_COLOR.textMuted,
  border: VERA5_COLOR.border,
  accent: VERA5_COLOR.accent,
  accentText: VERA5_COLOR.accentText,
  buttonBg: VERA5_COLOR.surfaceRaised,
  error: VERA5_COLOR.dangerText,
  trayRowBg: VERA5_COLOR.surfaceSunken,
  filterActiveBg: VERA5_COLOR.accentActiveBg,
  success: VERA5_COLOR.successText,
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

function trayStatusStyle(): CSSProperties {
  return {
    fontSize: 12,
    margin: 0,
    color: POPUP_THEME.muted,
    lineHeight: 1.5,
  };
}

export function trayEnrichmentHintStyle(
  badgeText: TrayEntryEnrichmentStatus["badgeText"]
): CSSProperties {
  const base: CSSProperties = {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 4,
    backgroundColor: POPUP_THEME.buttonBg,
    lineHeight: 1.4,
    pointerEvents: "none",
    userSelect: "none",
  };

  if (badgeText === "Live") {
    return { ...base, color: POPUP_THEME.success };
  }
  if (badgeText === "Error") {
    return { ...base, color: POPUP_THEME.error };
  }
  return { ...base, color: POPUP_THEME.muted };
}

function sessionActionButtonStyle(): CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${POPUP_THEME.border}`,
    backgroundColor: POPUP_THEME.buttonBg,
    color: POPUP_THEME.accentText,
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
  const [trayFilterReady, setTrayFilterReady] = useState(false);
  const [trayNavigationMessage, setTrayNavigationMessage] = useState<string | null>(
    null
  );
  const [trayEnrichmentStatuses, setTrayEnrichmentStatuses] = useState<
    Record<string, TrayEntryEnrichmentStatus>
  >({});
  const [selectionEnrichMessage, setSelectionEnrichMessage] = useState<string | null>(
    null
  );
  const [sessionTitle, setSessionTitle] = useState(DEFAULT_INVESTIGATION_SESSION_TITLE);
  const [sessionTitleReady, setSessionTitleReady] = useState(false);
  const [activeSession, setActiveSession] = useState<InvestigationSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<InvestigationSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const applyActiveInvestigationSession = (session: InvestigationSession | null) => {
    setActiveSession(session);
    if (session) {
      setSessionTitle(session.title);
      return;
    }
    setSessionTitle(DEFAULT_INVESTIGATION_SESSION_TITLE);
  };

  const refreshInvestigationSessionState = async () => {
    const [session, sessions] = await Promise.all([
      requestActiveInvestigationSession(),
      requestRecentInvestigationSessions(),
    ]);
    applyActiveInvestigationSession(session);
    setRecentSessions(sessions);
  };

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
    void refreshInvestigationSessionState().finally(() => {
      setSessionTitleReady(true);
    });
  }, []);

  useEffect(() => {
    if (!scanSummary || scanSummary.entries.length === 0) {
      setTrayEnrichmentStatuses({});
      return;
    }

    let cancelled = false;
    void loadTrayEntryEnrichmentStatuses(scanSummary.entries).then((statuses) => {
      if (!cancelled) {
        setTrayEnrichmentStatuses(statuses);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [scanSummary]);

  useEffect(() => {
    if (!scanSummary) {
      setTrayFilterReady(false);
      return;
    }

    let cancelled = false;
    void getTabScanTrayFilter(scanSummary.tabId).then((storedFilter) => {
      if (!cancelled) {
        setTypeFilter(storedFilter);
        setTrayFilterReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [scanSummary]);

  useEffect(() => {
    if (!scanSummary || !trayFilterReady) {
      return;
    }
    void saveTabScanTrayFilter(scanSummary.tabId, typeFilter);
  }, [scanSummary, typeFilter, trayFilterReady]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.backgroundColor = POPUP_THEME.surface;
    document.body.style.color = POPUP_THEME.text;
  }, []);

  const trayView = resolvePopupTrayView({ enabled, scanState, scanSummary });

  const filteredEntries = useMemo(() => {
    if (!scanSummary) {
      return [];
    }
    return filterTabScanSummaryEntries(scanSummary.entries, typeFilter);
  }, [scanSummary, typeFilter]);

  const sessionIocCountText = useMemo(
    () => buildInvestigationSessionIocCountText(activeSession?.totalIocCount ?? 0),
    [activeSession]
  );

  const sessionTypeBreakdownText = useMemo(() => {
    if (!activeSession) {
      return "";
    }
    return buildInvestigationSessionTypeBreakdownText(activeSession);
  }, [activeSession]);

  const sessionActivitySummaryText = useMemo(() => {
    if (!activeSession) {
      return "";
    }
    return buildInvestigationSessionActivitySummaryText(activeSession);
  }, [activeSession]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    void setExtensionEnabled(checked);
    if (!checked) {
      setScanState("idle");
      setScanSummary(null);
      setTypeFilter("all");
      setTrayFilterReady(false);
      setTrayNavigationMessage(null);
      setTrayEnrichmentStatuses({});
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

  const handleOpenSidebar = () => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        return;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, openWorkspaceMessage());
      } catch {
        // Content script may be unavailable on restricted pages.
      }
      window.close();
    });
  };

  const handleNewSession = () => {
    if (!ready) {
      return;
    }

    void (async () => {
      const pageUrl = await resolveActiveTabPageUrl();
      const normalizedTitle =
        normalizeInvestigationSessionTitle(sessionTitle) ??
        DEFAULT_INVESTIGATION_SESSION_TITLE;
      const session = await requestCreateInvestigationSession({
        title: normalizedTitle,
        pageUrl,
      });
      if (session) {
        applyActiveInvestigationSession(session);
        await refreshInvestigationSessionState();
      }
    })();
  };

  const handleSessionTitleBlur = () => {
    if (!ready || !sessionTitleReady) {
      return;
    }

    const normalizedTitle = normalizeInvestigationSessionTitle(sessionTitle);
    if (!normalizedTitle) {
      void refreshInvestigationSessionState();
      return;
    }

    void (async () => {
      if (!activeSession || activeSession.title === normalizedTitle) {
        if (!activeSession) {
          setSessionTitle(normalizedTitle);
        }
        return;
      }

      const updated = await requestUpdateInvestigationSessionTitle(normalizedTitle);
      if (updated) {
        await refreshInvestigationSessionState();
        return;
      }
      applyActiveInvestigationSession(activeSession);
    })();
  };

  const handleReopenSession = (sessionId: string) => {
    if (!ready || !sessionTitleReady) {
      return;
    }

    void (async () => {
      const session = await requestReopenInvestigationSession(sessionId);
      if (session) {
        await refreshInvestigationSessionState();
      }
    })();
  };

  const handleStartRenameSession = (session: InvestigationSession) => {
    setRenamingSessionId(session.id);
    setRenameDraft(session.title);
  };

  const handleCancelRenameSession = () => {
    setRenamingSessionId(null);
    setRenameDraft("");
  };

  const handleSaveRenameSession = (sessionId: string) => {
    const normalizedTitle = normalizeInvestigationSessionTitle(renameDraft);
    if (!normalizedTitle) {
      handleCancelRenameSession();
      return;
    }

    void (async () => {
      const session = await requestRenameInvestigationSession({
        sessionId,
        title: normalizedTitle,
      });
      handleCancelRenameSession();
      if (session) {
        await refreshInvestigationSessionState();
      }
    })();
  };

  const handleArchiveSession = (sessionId: string) => {
    if (!ready || !sessionTitleReady) {
      return;
    }

    void (async () => {
      await requestArchiveInvestigationSession(sessionId);
      await refreshInvestigationSessionState();
    })();
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!ready || !sessionTitleReady) {
      return;
    }

    void (async () => {
      await requestDeleteInvestigationSession(sessionId);
      await refreshInvestigationSessionState();
    })();
  };

  const handleTrayRowActivate = (entry: TabScanSummaryEntry) => {    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setTrayNavigationMessage(
            resolveTrayNavigationFeedback({ tabId: undefined, indicatorValue: entry.value })
          );
          return;
        }
        try {
          const response = await chrome.tabs.sendMessage(
            tab.id,
            navigateToIocAnchorMessage(entry.anchorId)
          );
          setTrayNavigationMessage(
            resolveTrayNavigationFeedback({
              tabId: tab.id,
              response,
              indicatorValue: entry.value,
            })
          );
        } catch {
          setTrayNavigationMessage(
            resolveTrayNavigationFeedback({
              tabId: tab.id,
              sendFailed: true,
              indicatorValue: entry.value,
            })
          );
        }
      });
  };

  const handleScanPage = () => {
    if (!enabled) {
      return;
    }
    setScanState("scanning");
    setScanSummary(null);
    setTypeFilter("all");
    setTrayFilterReady(false);
    setTrayNavigationMessage(null);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id) {
          void saveTabScanTrayFilter(tab.id, "all");
        }
      });
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
            if (summary !== null) {
              setScanSummary(summary);
              setScanState("done");
              await refreshInvestigationSessionState();
              return;
            }
          }
          setScanState("error");
        } catch {
          setScanState("error");
        }
      });
  };

  const handleScanSelection = () => {
    if (!enabled) {
      return;
    }
    setSelectionEnrichMessage(null);
    setScanState("scanning");
    setScanSummary(null);
    setTypeFilter("all");
    setTrayFilterReady(false);
    setTrayNavigationMessage(null);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id) {
          void saveTabScanTrayFilter(tab.id, "all");
        }
      });
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setScanState("error");
          return;
        }
        try {
          const response = await chrome.tabs.sendMessage(tab.id, scanSelectionMessage());
          if (
            response &&
            typeof response === "object" &&
            "ok" in response &&
            response.ok === true
          ) {
            const summary = await requestTabScanSummaryForActiveTab();
            if (summary !== null) {
              setScanSummary(summary);
              setScanState("done");
              await refreshInvestigationSessionState();
              return;
            }
          }
          setScanState("error");
        } catch {
          setScanState("error");
        }
      });
  };

  const handleEnrichSelection = () => {
    if (!enabled) {
      return;
    }
    setSelectionEnrichMessage(null);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setSelectionEnrichMessage("Could not reach this page. Reload the tab and try again.");
          return;
        }
        try {
          const response = await chrome.tabs.sendMessage(tab.id, enrichSelectionMessage());
          if (
            response &&
            typeof response === "object" &&
            "ok" in response &&
            response.ok === true
          ) {
            return;
          }
          const errorMessage =
            response &&
            typeof response === "object" &&
            "error" in response &&
            typeof response.error === "string"
              ? response.error
              : "Enrichment failed. Reload the tab and try again.";
          setSelectionEnrichMessage(errorMessage);
        } catch {
          setSelectionEnrichMessage(
            "Could not reach this page. Reload the tab and try again."
          );
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
        disabled={!ready || !enabled || scanState === "scanning"}
        onClick={handleScanSelection}
        style={{
          ...buttonStyle,
          marginBottom: 8,
          cursor: !ready || !enabled ? "not-allowed" : "pointer",
          opacity: !ready || !enabled ? 0.65 : 1,
        }}
      >
        {scanState === "scanning" ? "Scanning…" : "Scan selection"}
      </button>
      <button
        type="button"
        disabled={!ready || !enabled}
        onClick={handleEnrichSelection}
        style={{
          ...buttonStyle,
          marginBottom: 8,
          cursor: !ready || !enabled ? "not-allowed" : "pointer",
          opacity: !ready || !enabled ? 0.65 : 1,
        }}
      >
        Enrich selection
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
      <button
        type="button"
        disabled={!ready}
        onClick={handleOpenSidebar}
        style={{
          ...buttonStyle,
          marginBottom: 8,
          cursor: ready ? "pointer" : "not-allowed",
          opacity: ready ? 1 : 0.65,
        }}
      >
        Open sidebar
      </button>
      <section
        aria-label="Investigation session"
        style={{
          marginTop: 14,
          borderTop: `1px solid ${POPUP_THEME.border}`,
          paddingTop: 12,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            margin: "0 0 8px",
            color: POPUP_THEME.accentText,
          }}
        >
          Investigation session
        </h2>
        {!activeSession && sessionTitleReady ? (
          <p style={trayStatusStyle()} aria-live="polite">
            {INVESTIGATION_SESSION_EMPTY_STATE_TEXT}
          </p>
        ) : null}
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: POPUP_THEME.text,
            marginBottom: 8,
          }}
        >
          Session title
          <input
            type="text"
            value={sessionTitle}
            disabled={!ready || !sessionTitleReady}
            onChange={(event) => setSessionTitle(event.target.value)}
            onBlur={handleSessionTitleBlur}
            aria-label="Session title"
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: 6,
              border: `1px solid ${POPUP_THEME.border}`,
              backgroundColor: POPUP_THEME.buttonBg,
              color: POPUP_THEME.text,
              boxSizing: "border-box",
            }}
          />
        </label>
        {activeSession ? (
          <>
            <p
              aria-live="polite"
              style={{
                fontSize: 12,
                margin: "0 0 4px",
                color: POPUP_THEME.muted,
                lineHeight: 1.5,
              }}
            >
              {sessionIocCountText}
            </p>
            {sessionTypeBreakdownText ? (
              <p
                style={{
                  fontSize: 12,
                  margin: "0 0 4px",
                  color: POPUP_THEME.text,
                  lineHeight: 1.5,
                }}
              >
                {sessionTypeBreakdownText}
              </p>
            ) : null}
            {sessionActivitySummaryText ? (
              <p
                style={{
                  fontSize: 12,
                  margin: "0 0 10px",
                  color: POPUP_THEME.muted,
                  lineHeight: 1.5,
                }}
              >
                {sessionActivitySummaryText}
              </p>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}
          </>
        ) : null}
        <button
          type="button"
          disabled={!ready || !sessionTitleReady}
          onClick={handleNewSession}
          style={{
            ...buttonStyle,
            marginBottom: 0,
            cursor: ready && sessionTitleReady ? "pointer" : "not-allowed",
            opacity: ready && sessionTitleReady ? 1 : 0.65,
          }}
        >
          New session
        </button>
        {recentSessions.length > 0 ? (
          <>
            <h3
              style={{
                fontSize: 12,
                fontWeight: 700,
                margin: "12px 0 8px",
                color: POPUP_THEME.accentText,
              }}
            >
              Recent sessions
            </h3>
            <ul
              aria-label="Recent investigation sessions"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {recentSessions.map((session) => {
                const isActive = activeSession?.id === session.id;
                const breakdown = buildInvestigationSessionTypeBreakdownText(session);
                const isRenaming = renamingSessionId === session.id;

                return (
                  <li
                    key={session.id}
                    style={{
                      border: `1px solid ${
                        isActive ? POPUP_THEME.accent : POPUP_THEME.border
                      }`,
                      borderRadius: 6,
                      padding: 8,
                      backgroundColor: POPUP_THEME.trayRowBg,
                    }}
                  >
                    {isRenaming ? (
                      <>
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          aria-label={`Rename ${session.title}`}
                          style={{
                            display: "block",
                            width: "100%",
                            marginBottom: 8,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: `1px solid ${POPUP_THEME.border}`,
                            backgroundColor: POPUP_THEME.buttonBg,
                            color: POPUP_THEME.text,
                            boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => handleSaveRenameSession(session.id)}
                            style={sessionActionButtonStyle()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRenameSession}
                            style={sessionActionButtonStyle()}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <strong
                            style={{
                              fontSize: 12,
                              color: POPUP_THEME.text,
                              wordBreak: "break-word",
                            }}
                          >
                            {session.title}
                          </strong>
                          {isActive ? (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 10,
                                fontWeight: 700,
                                color: POPUP_THEME.accent,
                              }}
                            >
                              Active
                            </span>
                          ) : null}
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            margin: "0 0 4px",
                            color: POPUP_THEME.muted,
                            lineHeight: 1.45,
                          }}
                        >
                          {buildInvestigationSessionIocCountText(session.totalIocCount)}
                        </p>
                        {breakdown ? (
                          <p
                            style={{
                              fontSize: 11,
                              margin: "0 0 8px",
                              color: POPUP_THEME.text,
                              lineHeight: 1.45,
                            }}
                          >
                            {breakdown}
                          </p>
                        ) : null}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => handleReopenSession(session.id)}
                              style={sessionActionButtonStyle()}
                            >
                              Reopen
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleStartRenameSession(session)}
                            style={sessionActionButtonStyle()}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveSession(session.id)}
                            style={sessionActionButtonStyle()}
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(session.id)}
                            style={sessionActionButtonStyle()}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p style={{ ...trayStatusStyle(), marginTop: 12 }}>No saved sessions yet.</p>
        )}
      </section>
      {scanState === "error" ? (        <p style={{ fontSize: 12, margin: "10px 0 0", color: POPUP_THEME.error }}>
          Scan failed. Reload the tab and try again.
        </p>
      ) : null}
      {selectionEnrichMessage ? (
        <p style={{ fontSize: 12, margin: "10px 0 0", color: POPUP_THEME.error }}>
          {selectionEnrichMessage}
        </p>
      ) : null}
      {trayView ? (
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
          {trayView === "prompt" ? (
            <p style={trayStatusStyle()}>
              Scan this page to list detected indicators.
            </p>
          ) : null}
          {trayView === "scanning" ? (
            <p style={trayStatusStyle()} aria-live="polite">
              Scanning page…
            </p>
          ) : null}
          {trayView === "empty" ? (
            <p style={trayStatusStyle()} aria-live="polite">
              No indicators detected on this page.
            </p>
          ) : null}
          {trayView === "results" && scanSummary ? (
            <>
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
              {trayNavigationMessage ? (
                <p
                  role="alert"
                  aria-live="polite"
                  style={{
                    fontSize: 12,
                    margin: "0 0 10px",
                    color: POPUP_THEME.error,
                    lineHeight: 1.5,
                  }}
                >
                  {trayNavigationMessage}
                </p>
              ) : null}
              {filteredEntries.length > 0 ? (
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
                  {filteredEntries.map((entry) => {
                    const enrichmentStatus = trayEnrichmentStatuses[entry.anchorId];
                    const provenance = resolveTrayEntryMatchProvenance(entry);

                    return (
                    <li
                      key={entry.anchorId}
                      role="button"
                      tabIndex={0}
                      data-vera5-tray-entry="true"
                      data-vera5-type={entry.type}
                      data-vera5-value={entry.value}
                      data-vera5-anchor-id={entry.anchorId}
                      data-vera5-rule-id={provenance?.ruleId}
                      data-vera5-source-text-hint={provenance?.sourceTextHint}
                      aria-label={buildTrayRowNavigationAriaLabel(
                        entry.value,
                        enrichmentStatus
                      )}
                      onClick={() => handleTrayRowActivate(entry)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        handleTrayRowActivate(entry);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: `1px solid ${POPUP_THEME.border}`,
                        backgroundColor: POPUP_THEME.trayRowBg,
                        fontSize: 12,
                        lineHeight: 1.4,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
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
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <TrayIndicatorValue entry={entry} />
                        {enrichmentStatus ? (
                          <span
                            aria-hidden="true"
                            style={trayEnrichmentHintStyle(enrichmentStatus.badgeText)}
                          >
                            {formatTrayRowEnrichmentHint(enrichmentStatus)}
                          </span>
                        ) : null}
                      </span>
                      </div>
                      <WhyDetectedTrayDetails entry={entry} />
                    </li>
                    );
                  })}
                </ul>
              ) : (
                <p style={trayStatusStyle()}>
                  No indicators match this filter.
                </p>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
