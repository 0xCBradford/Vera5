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
  findTabScanSummaryEntryForCollectionMember,
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
  listInvestigationSessionIocMembers,
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
import {
  buildInvestigationSessionExportInput,
  copyInvestigationSessionExportToClipboard,
  downloadInvestigationSessionExportFile,
  type InvestigationSessionExportFormat,
} from "../lib/investigationSessionExport";
import { recordActiveInvestigationSessionExportEvent } from "../lib/investigationSessionStorage";
import {
  buildAddFilteredToCollectionActionLabel,
  buildIocCollectionSummaryLine,
  buildPromoteSessionToCollectionActionLabel,
  formatAddFilteredToCollectionFeedback,
  formatPromoteSessionToCollectionFeedback,
  formatSaveToCollectionFeedback,
  IOC_COLLECTION_ADD_FILTERED_HEADING,
  IOC_COLLECTION_CREATE_NEW_LABEL,
  IOC_COLLECTION_MANAGER_EMPTY_TEXT,
  IOC_COLLECTION_MANAGER_LIST_ARIA_LABEL,
  IOC_COLLECTION_MANAGER_SECTION_LABEL,
  IOC_COLLECTION_MEMBERS_EMPTY_TEXT,
  IOC_COLLECTION_MEMBERS_HEADING,
  IOC_COLLECTION_DELETE_LABEL,
  IOC_COLLECTION_HIDE_MEMBERS_LABEL,
  IOC_COLLECTION_NEW_NAME_PLACEHOLDER,
  IOC_COLLECTION_NO_COLLECTIONS_TEXT,
  IOC_COLLECTION_PICKER_HEADING,
  IOC_COLLECTION_PROMOTE_SESSION_BUTTON_LABEL,
  IOC_COLLECTION_PROMOTE_SESSION_HEADING,
  IOC_COLLECTION_REMOVE_MEMBER_LABEL,
  IOC_COLLECTION_RENAME_LABEL,
  IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL,
  IOC_COLLECTION_SAVE_TO_NEW_LABEL,
  IOC_COLLECTION_VIEW_MEMBERS_LABEL,
  normalizeIocCollectionName,
  sortIocCollectionsForDisplay,
  type IocCollection,
  type IocCollectionMember,
} from "../lib/iocCollection";
import {
  buildIocCollectionExportInput,
  downloadIocCollectionExportCsvFile,
  downloadIocCollectionExportJsonFile,
  downloadIocCollectionExportMarkdownFile,
  formatIocCollectionExportCsvFeedback,
  formatIocCollectionExportJsonFeedback,
  formatIocCollectionExportMarkdownFeedback,
  IOC_COLLECTION_EXPORT_CSV_LABEL,
  IOC_COLLECTION_EXPORT_JSON_LABEL,
  IOC_COLLECTION_EXPORT_MARKDOWN_LABEL,
} from "../lib/iocCollectionExport";
import {
  requestAddIocToCollection,
  requestAddIocsToCollection,
  requestCreateIocCollection,
  requestDeleteIocCollection,
  requestListIocCollections,
  requestRemoveIocFromCollection,
  requestRenameIocCollection,
} from "../lib/iocCollectionClient";
import { requestEnrichmentSourceOps } from "../lib/enrichmentSourceOpsClient";
import {
  formatEnrichmentCacheClearedAtLabel,
  formatEnrichmentSourceLastStatusLabel,
  formatEnrichmentSourceOpsCooldownLabel,
  ENRICHMENT_SOURCE_OPS_SECTION_TITLE,
  type EnrichmentSourceOpsSnapshot,
} from "../lib/enrichmentSourceOps";
import { VERA5_COLOR } from "../lib/theme";
import {
  resolveWorkspaceTrayView,
  resolveCollectionMemberOpenFeedback,
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

function SaveToCollectionTrayPanel({
  entry,
  open,
  onToggle,
  feedback,
  onFeedback,
}: {
  entry: TabScanSummaryEntry;
  open: boolean;
  onToggle: () => void;
  feedback: string | null;
  onFeedback: (message: string | null) => void;
}) {
  const [collections, setCollections] = useState<IocCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void requestListIocCollections().then((list) => {
      if (!cancelled) {
        setCollections(list);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const member = { iocType: entry.type, value: entry.value };

  const handleAddToExisting = async (collection: IocCollection) => {
    const result = await requestAddIocToCollection({
      collectionId: collection.id,
      member,
    });
    if (!result) {
      onFeedback("Could not save to collection.");
      return;
    }
    onFeedback(
      formatSaveToCollectionFeedback({
        collectionName: result.collection.name,
        added: result.added,
      })
    );
  };

  const handleCreateAndAdd = async () => {
    const created = await requestCreateIocCollection({ name: newName });
    if (!created) {
      onFeedback("Could not create collection.");
      return;
    }

    const result = await requestAddIocToCollection({
      collectionId: created.id,
      member,
    });
    if (!result) {
      onFeedback("Collection created, but indicator was not saved.");
      return;
    }

    setCollections((previous) => [
      result.collection,
      ...previous.filter((collection) => collection.id !== result.collection.id),
    ]);
    setNewName("");
    onFeedback(
      formatSaveToCollectionFeedback({
        collectionName: result.collection.name,
        added: result.added,
      })
    );
  };

  const canCreate = normalizeIocCollectionName(newName) !== null;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ marginTop: 4 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          border: "none",
          background: "transparent",
          color: POPUP_THEME.accent,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          padding: 0,
        }}
      >
        {IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL}
      </button>
      {open ? (
        <div
          role="group"
          aria-label={IOC_COLLECTION_PICKER_HEADING}
          style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.surface,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 700,
              color: POPUP_THEME.accentText,
            }}
          >
            {IOC_COLLECTION_PICKER_HEADING}
          </p>
          {loading ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: POPUP_THEME.muted }}>
              Loading collections…
            </p>
          ) : collections.length === 0 ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: POPUP_THEME.muted }}>
              {IOC_COLLECTION_NO_COLLECTIONS_TEXT}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 8,
              }}
            >
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => void handleAddToExisting(collection)}
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          )}
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: POPUP_THEME.text,
              marginBottom: 6,
            }}
          >
            {IOC_COLLECTION_CREATE_NEW_LABEL}
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              aria-label={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${POPUP_THEME.border}`,
                backgroundColor: POPUP_THEME.buttonBg,
                color: POPUP_THEME.text,
                boxSizing: "border-box",
              }}
            />
          </label>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void handleCreateAndAdd()}
            style={{
              ...buttonStyle,
              width: "100%",
              cursor: canCreate ? "pointer" : "not-allowed",
              opacity: canCreate ? 1 : 0.65,
            }}
          >
            {IOC_COLLECTION_SAVE_TO_NEW_LABEL}
          </button>
          {feedback ? (
            <p
              aria-live="polite"
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: POPUP_THEME.muted,
                lineHeight: 1.4,
              }}
            >
              {feedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddFilteredToCollectionPanel({
  entries,
  open,
  onToggle,
  feedback,
  onFeedback,
}: {
  entries: TabScanSummaryEntry[];
  open: boolean;
  onToggle: () => void;
  feedback: string | null;
  onFeedback: (message: string | null) => void;
}) {
  const [collections, setCollections] = useState<IocCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const members = entries.map((entry) => ({
    iocType: entry.type,
    value: entry.value,
  }));

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void requestListIocCollections().then((list) => {
      if (!cancelled) {
        setCollections(list);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleAddToExisting = async (collection: IocCollection) => {
    const result = await requestAddIocsToCollection({
      collectionId: collection.id,
      members,
    });
    if (!result) {
      onFeedback("Could not add filtered indicators to collection.");
      return;
    }
    onFeedback(
      formatAddFilteredToCollectionFeedback({
        collectionName: result.collection.name,
        addedCount: result.addedCount,
        duplicateCount: result.duplicateCount,
        totalCount: result.totalCount,
      })
    );
  };

  const handleCreateAndAdd = async () => {
    const created = await requestCreateIocCollection({ name: newName });
    if (!created) {
      onFeedback("Could not create collection.");
      return;
    }

    const result = await requestAddIocsToCollection({
      collectionId: created.id,
      members,
    });
    if (!result) {
      onFeedback("Collection created, but filtered indicators were not saved.");
      return;
    }

    setCollections((previous) => [
      result.collection,
      ...previous.filter((collection) => collection.id !== result.collection.id),
    ]);
    setNewName("");
    onFeedback(
      formatAddFilteredToCollectionFeedback({
        collectionName: result.collection.name,
        addedCount: result.addedCount,
        duplicateCount: result.duplicateCount,
        totalCount: result.totalCount,
      })
    );
  };

  const canCreate = normalizeIocCollectionName(newName) !== null;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={entries.length === 0}
        style={{
          border: `1px solid ${POPUP_THEME.border}`,
          borderRadius: 6,
          backgroundColor: POPUP_THEME.buttonBg,
          color: POPUP_THEME.accent,
          cursor: entries.length === 0 ? "not-allowed" : "pointer",
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 10px",
          width: "100%",
          opacity: entries.length === 0 ? 0.65 : 1,
        }}
      >
        {buildAddFilteredToCollectionActionLabel(entries.length)}
      </button>
      {open ? (
        <div
          role="group"
          aria-label={IOC_COLLECTION_ADD_FILTERED_HEADING}
          style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.surface,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 700,
              color: POPUP_THEME.accentText,
            }}
          >
            {IOC_COLLECTION_ADD_FILTERED_HEADING}
          </p>
          {loading ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: POPUP_THEME.muted }}>
              Loading collections…
            </p>
          ) : collections.length === 0 ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: POPUP_THEME.muted }}>
              {IOC_COLLECTION_NO_COLLECTIONS_TEXT}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 8,
              }}
            >
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => void handleAddToExisting(collection)}
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          )}
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: POPUP_THEME.text,
              marginBottom: 6,
            }}
          >
            {IOC_COLLECTION_CREATE_NEW_LABEL}
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              aria-label={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${POPUP_THEME.border}`,
                backgroundColor: POPUP_THEME.buttonBg,
                color: POPUP_THEME.text,
                boxSizing: "border-box",
              }}
            />
          </label>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void handleCreateAndAdd()}
            style={{
              ...buttonStyle,
              width: "100%",
              cursor: canCreate ? "pointer" : "not-allowed",
              opacity: canCreate ? 1 : 0.65,
            }}
          >
            {IOC_COLLECTION_SAVE_TO_NEW_LABEL}
          </button>
          {feedback ? (
            <p
              aria-live="polite"
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: POPUP_THEME.muted,
                lineHeight: 1.4,
              }}
            >
              {feedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PromoteSessionToCollectionPanel({
  session,
  open,
  onToggle,
  feedback,
  onFeedback,
}: {
  session: InvestigationSession;
  open: boolean;
  onToggle: () => void;
  feedback: string | null;
  onFeedback: (message: string | null) => void;
}) {
  const sessionMembers = listInvestigationSessionIocMembers(session);
  const [collectionName, setCollectionName] = useState(session.title);

  useEffect(() => {
    setCollectionName(session.title);
  }, [session.id, session.title]);

  const handlePromote = async () => {
    if (sessionMembers.length === 0) {
      onFeedback(formatPromoteSessionToCollectionFeedback({
        collectionName: collectionName.trim() || session.title,
        addedCount: 0,
        duplicateCount: 0,
        totalCount: 0,
      }));
      return;
    }

    const created = await requestCreateIocCollection({ name: collectionName });
    if (!created) {
      onFeedback("Could not create collection.");
      return;
    }

    const result = await requestAddIocsToCollection({
      collectionId: created.id,
      members: sessionMembers,
    });
    if (!result) {
      onFeedback("Collection created, but session indicators were not saved.");
      return;
    }

    onFeedback(
      formatPromoteSessionToCollectionFeedback({
        collectionName: result.collection.name,
        addedCount: result.addedCount,
        duplicateCount: result.duplicateCount,
        totalCount: result.totalCount,
      })
    );
  };

  const canPromote = normalizeIocCollectionName(collectionName) !== null;

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={sessionMembers.length === 0}
        style={{
          border: `1px solid ${POPUP_THEME.border}`,
          borderRadius: 6,
          backgroundColor: POPUP_THEME.buttonBg,
          color: POPUP_THEME.accent,
          cursor: sessionMembers.length === 0 ? "not-allowed" : "pointer",
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 10px",
          width: "100%",
          opacity: sessionMembers.length === 0 ? 0.65 : 1,
        }}
      >
        {buildPromoteSessionToCollectionActionLabel(sessionMembers.length)}
      </button>
      {open ? (
        <div
          role="group"
          aria-label={IOC_COLLECTION_PROMOTE_SESSION_HEADING}
          style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.surface,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 700,
              color: POPUP_THEME.accentText,
            }}
          >
            {IOC_COLLECTION_PROMOTE_SESSION_HEADING}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: POPUP_THEME.muted }}>
            {buildInvestigationSessionIocCountText(sessionMembers.length)}
          </p>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: POPUP_THEME.text,
              marginBottom: 6,
            }}
          >
            {IOC_COLLECTION_CREATE_NEW_LABEL}
            <input
              type="text"
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              aria-label={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${POPUP_THEME.border}`,
                backgroundColor: POPUP_THEME.buttonBg,
                color: POPUP_THEME.text,
                boxSizing: "border-box",
              }}
            />
          </label>
          <button
            type="button"
            disabled={!canPromote}
            onClick={() => void handlePromote()}
            style={{
              ...buttonStyle,
              width: "100%",
              cursor: canPromote ? "pointer" : "not-allowed",
              opacity: canPromote ? 1 : 0.65,
            }}
          >
            {IOC_COLLECTION_PROMOTE_SESSION_BUTTON_LABEL}
          </button>
          {feedback ? (
            <p
              aria-live="polite"
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: POPUP_THEME.muted,
                lineHeight: 1.4,
              }}
            >
              {feedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CollectionsManagerPanel() {
  const [collections, setCollections] = useState<IocCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const refreshCollections = async () => {
    const list = await requestListIocCollections();
    setCollections(sortIocCollectionsForDisplay(list));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void requestListIocCollections().then((list) => {
      if (!cancelled) {
        setCollections(sortIocCollectionsForDisplay(list));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleMembers = (collectionId: string) => {
    setExpandedCollectionId((current) => (current === collectionId ? null : collectionId));
  };

  const handleStartRenameCollection = (collection: IocCollection) => {
    setRenamingCollectionId(collection.id);
    setRenameDraft(collection.name);
    setExpandedCollectionId(null);
  };

  const handleCancelRenameCollection = () => {
    setRenamingCollectionId(null);
    setRenameDraft("");
  };

  const handleSaveRenameCollection = (collectionId: string) => {
    const normalizedName = normalizeIocCollectionName(renameDraft);
    if (!normalizedName) {
      handleCancelRenameCollection();
      return;
    }

    void (async () => {
      const updated = await requestRenameIocCollection({
        collectionId,
        name: normalizedName,
      });
      handleCancelRenameCollection();
      if (updated) {
        await refreshCollections();
      }
    })();
  };

  const handleDeleteCollection = (collectionId: string) => {
    void (async () => {
      const deleted = await requestDeleteIocCollection(collectionId);
      if (!deleted) {
        return;
      }
      if (expandedCollectionId === collectionId) {
        setExpandedCollectionId(null);
      }
      if (renamingCollectionId === collectionId) {
        handleCancelRenameCollection();
      }
      await refreshCollections();
    })();
  };

  const handleRemoveMember = (
    collectionId: string,
    member: IocCollectionMember
  ) => {
    void (async () => {
      const result = await requestRemoveIocFromCollection({
        collectionId,
        member,
      });
      if (result) {
        await refreshCollections();
      }
    })();
  };

  const handleOpenCollectionMember = (member: IocCollectionMember) => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setNavigationMessage(
            resolveCollectionMemberOpenFeedback({
              tabId: undefined,
              summary: null,
              member,
              entryFound: false,
            })
          );
          return;
        }

        const summary = await requestTabScanSummaryForActiveTab();
        const entry = summary
          ? findTabScanSummaryEntryForCollectionMember(summary, member)
          : null;
        const preNavigationFeedback = resolveCollectionMemberOpenFeedback({
          tabId: tab.id,
          summary,
          member,
          entryFound: entry !== null,
        });
        if (preNavigationFeedback || !entry) {
          setNavigationMessage(preNavigationFeedback);
          return;
        }

        try {
          const response = await chrome.tabs.sendMessage(
            tab.id,
            navigateToIocAnchorMessage(entry.anchorId)
          );
          setNavigationMessage(
            resolveCollectionMemberOpenFeedback({
              tabId: tab.id,
              summary,
              member,
              entryFound: true,
              response,
            })
          );
        } catch {
          setNavigationMessage(
            resolveCollectionMemberOpenFeedback({
              tabId: tab.id,
              summary,
              member,
              entryFound: true,
              sendFailed: true,
            })
          );
        }
      });
  };

  const handleExportCollectionMarkdown = (collection: IocCollection) => {
    void (async () => {
      const input = await buildIocCollectionExportInput({ collection });
      const downloaded = downloadIocCollectionExportMarkdownFile(input, document);
      setExportMessage(
        formatIocCollectionExportMarkdownFeedback({
          collectionName: collection.name,
          success: downloaded,
        })
      );
    })();
  };

  const handleExportCollectionJson = (collection: IocCollection) => {
    void (async () => {
      const input = await buildIocCollectionExportInput({ collection });
      const downloaded = downloadIocCollectionExportJsonFile(input, document);
      setExportMessage(
        formatIocCollectionExportJsonFeedback({
          collectionName: collection.name,
          success: downloaded,
        })
      );
    })();
  };

  const handleExportCollectionCsv = (collection: IocCollection) => {
    void (async () => {
      const input = await buildIocCollectionExportInput({ collection });
      const downloaded = downloadIocCollectionExportCsvFile(input, document);
      setExportMessage(
        formatIocCollectionExportCsvFeedback({
          collectionName: collection.name,
          success: downloaded,
        })
      );
    })();
  };

  return (
    <section
      aria-label={IOC_COLLECTION_MANAGER_SECTION_LABEL}
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
        {IOC_COLLECTION_MANAGER_SECTION_LABEL}
      </h2>
      {loading ? (
        <p style={trayStatusStyle()} aria-live="polite">
          Loading collections…
        </p>
      ) : collections.length === 0 ? (
        <p style={trayStatusStyle()} aria-live="polite">
          {IOC_COLLECTION_MANAGER_EMPTY_TEXT}
        </p>
      ) : (
        <ul
          aria-label={IOC_COLLECTION_MANAGER_LIST_ARIA_LABEL}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {collections.map((collection) => {
            const isExpanded = expandedCollectionId === collection.id;
            const isRenaming = renamingCollectionId === collection.id;

            return (
              <li
                key={collection.id}
                style={{
                  border: `1px solid ${POPUP_THEME.border}`,
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
                      aria-label={`Rename ${collection.name}`}
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
                        onClick={() => handleSaveRenameCollection(collection.id)}
                        style={sessionActionButtonStyle()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRenameCollection}
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
                        fontSize: 12,
                        fontWeight: 600,
                        color: POPUP_THEME.text,
                        wordBreak: "break-word",
                        marginBottom: 4,
                      }}
                    >
                      {collection.name}
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        margin: "0 0 8px",
                        color: POPUP_THEME.muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {buildIocCollectionSummaryLine(collection)}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleMembers(collection.id)}
                        style={sessionActionButtonStyle()}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded
                          ? IOC_COLLECTION_HIDE_MEMBERS_LABEL
                          : IOC_COLLECTION_VIEW_MEMBERS_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRenameCollection(collection)}
                        style={sessionActionButtonStyle()}
                      >
                        {IOC_COLLECTION_RENAME_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(collection.id)}
                        style={sessionActionButtonStyle()}
                      >
                        {IOC_COLLECTION_DELETE_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCollectionMarkdown(collection)}
                        style={sessionActionButtonStyle()}
                      >
                        {IOC_COLLECTION_EXPORT_MARKDOWN_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCollectionJson(collection)}
                        style={sessionActionButtonStyle()}
                      >
                        {IOC_COLLECTION_EXPORT_JSON_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCollectionCsv(collection)}
                        style={sessionActionButtonStyle()}
                      >
                        {IOC_COLLECTION_EXPORT_CSV_LABEL}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: POPUP_THEME.accentText,
                            marginBottom: 6,
                          }}
                        >
                          {IOC_COLLECTION_MEMBERS_HEADING}
                        </div>
                        {collection.members.length === 0 ? (
                          <p style={{ ...trayStatusStyle(), margin: 0 }}>
                            {IOC_COLLECTION_MEMBERS_EMPTY_TEXT}
                          </p>
                        ) : (
                          <ul
                            style={{
                              listStyle: "none",
                              margin: 0,
                              padding: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {collection.members.map((member) => (
                              <li
                                key={`${member.iocType}:${member.value}`}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  borderTop: `1px solid ${POPUP_THEME.border}`,
                                  paddingTop: 6,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleOpenCollectionMember(member)}
                                  aria-label={buildTrayRowNavigationAriaLabel(member.value)}
                                  style={{
                                    fontSize: 11,
                                    color: POPUP_THEME.text,
                                    wordBreak: "break-all",
                                    flex: 1,
                                    textAlign: "left",
                                    padding: 0,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span style={{ color: POPUP_THEME.muted }}>
                                    {IOC_TYPE_TRAY_LABEL[member.iocType]}:{" "}
                                  </span>
                                  {member.value}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveMember(collection.id, member)
                                  }
                                  style={sessionActionButtonStyle()}
                                >
                                  {IOC_COLLECTION_REMOVE_MEMBER_LABEL}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {navigationMessage ? (
        <p
          role="alert"
          aria-live="polite"
          style={{
            fontSize: 12,
            margin: "8px 0 0",
            color: POPUP_THEME.error,
            lineHeight: 1.5,
          }}
        >
          {navigationMessage}
        </p>
      ) : null}
      {exportMessage ? (
        <p
          aria-live="polite"
          style={{
            fontSize: 12,
            margin: navigationMessage ? "6px 0 0" : "8px 0 0",
            color: POPUP_THEME.muted,
            lineHeight: 1.5,
          }}
        >
          {exportMessage}
        </p>
      ) : null}
    </section>
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

function sourceOpsStatusColor(
  statusLabel: string
): string {
  if (
    statusLabel === "OK" ||
    statusLabel === "Cached" ||
    statusLabel === "Disabled" ||
    statusLabel === "Skipped"
  ) {
    return POPUP_THEME.muted;
  }
  if (statusLabel === "Rate limited") {
    return POPUP_THEME.error;
  }
  if (statusLabel === "No recent activity") {
    return POPUP_THEME.muted;
  }
  return POPUP_THEME.error;
}

const INVESTIGATION_SESSION_EXPORT_ACTIONS: readonly {
  format: InvestigationSessionExportFormat;
  label: string;
}[] = [
  { format: "markdown", label: "Markdown" },
  { format: "json", label: "JSON" },
  { format: "csv", label: "CSV" },
];

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
  const [sessionExportMessage, setSessionExportMessage] = useState<string | null>(null);
  const [sourceOps, setSourceOps] = useState<EnrichmentSourceOpsSnapshot | null>(null);
  const [sourceOpsReady, setSourceOpsReady] = useState(false);
  const [saveToCollectionAnchorId, setSaveToCollectionAnchorId] = useState<string | null>(
    null
  );
  const [saveToCollectionFeedback, setSaveToCollectionFeedback] = useState<string | null>(
    null
  );
  const [addFilteredToCollectionOpen, setAddFilteredToCollectionOpen] = useState(false);
  const [addFilteredToCollectionFeedback, setAddFilteredToCollectionFeedback] = useState<
    string | null
  >(null);
  const [promoteSessionToCollectionOpen, setPromoteSessionToCollectionOpen] = useState(false);
  const [promoteSessionToCollectionFeedback, setPromoteSessionToCollectionFeedback] =
    useState<string | null>(null);

  const refreshSourceOps = async () => {
    const snapshot = await requestEnrichmentSourceOps();
    setSourceOps(snapshot);
  };

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
    void refreshSourceOps().finally(() => {
      setSourceOpsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!sourceOps?.globalCooldownActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSourceOps();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sourceOps?.globalCooldownActive]);

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

      const message = openWorkspaceMessage();
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Content script may be unavailable on restricted pages.
        }
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

  const resolveActiveSessionExportInput = async () => {
    if (!activeSession) {
      return null;
    }

    return buildInvestigationSessionExportInput({
      session: activeSession,
      entries: scanSummary?.entries ?? [],
    });
  };

  const handleCopySessionExport = (format: InvestigationSessionExportFormat) => {
    if (!ready || !sessionTitleReady || !activeSession) {
      return;
    }

    void (async () => {
      const input = await resolveActiveSessionExportInput();
      if (!input) {
        return;
      }

      const copied = await copyInvestigationSessionExportToClipboard(input, format);
      if (copied) {
        void recordActiveInvestigationSessionExportEvent({
          iocs: input.records.map((record) => ({
            value: record.value,
            type: record.type,
          })),
        });
      }

      const label = INVESTIGATION_SESSION_EXPORT_ACTIONS.find(
        (action) => action.format === format
      )?.label;
      setSessionExportMessage(
        copied
          ? `Copied session ${label ?? format} export.`
          : `Could not copy session ${label ?? format} export.`
      );
    })();
  };

  const handleDownloadSessionExport = (format: InvestigationSessionExportFormat) => {
    if (!ready || !sessionTitleReady || !activeSession) {
      return;
    }

    void (async () => {
      const input = await resolveActiveSessionExportInput();
      if (!input) {
        return;
      }

      const downloaded = downloadInvestigationSessionExportFile(input, format, document);
      if (downloaded) {
        void recordActiveInvestigationSessionExportEvent({
          iocs: input.records.map((record) => ({
            value: record.value,
            type: record.type,
          })),
        });
      }

      const label = INVESTIGATION_SESSION_EXPORT_ACTIONS.find(
        (action) => action.format === format
      )?.label;
      setSessionExportMessage(
        downloaded
          ? `Downloaded session ${label ?? format} export.`
          : `Could not download session ${label ?? format} export.`
      );
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
            <PromoteSessionToCollectionPanel
              session={activeSession}
              open={promoteSessionToCollectionOpen}
              onToggle={() => {
                setPromoteSessionToCollectionFeedback(null);
                setPromoteSessionToCollectionOpen((current) => !current);
              }}
              feedback={promoteSessionToCollectionFeedback}
              onFeedback={setPromoteSessionToCollectionFeedback}
            />
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
        {activeSession ? (
          <>
            <h3
              style={{
                fontSize: 12,
                fontWeight: 700,
                margin: "12px 0 8px",
                color: POPUP_THEME.accentText,
              }}
            >
              Export session
            </h3>
            <div
              role="group"
              aria-label="Copy session export"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {INVESTIGATION_SESSION_EXPORT_ACTIONS.map(({ format, label }) => (
                <button
                  key={`copy-${format}`}
                  type="button"
                  disabled={!ready || !sessionTitleReady}
                  onClick={() => handleCopySessionExport(format)}
                  style={sessionActionButtonStyle()}
                >
                  Copy {label}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label="Download session export"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: sessionExportMessage ? 8 : 0,
              }}
            >
              {INVESTIGATION_SESSION_EXPORT_ACTIONS.map(({ format, label }) => (
                <button
                  key={`download-${format}`}
                  type="button"
                  disabled={!ready || !sessionTitleReady}
                  onClick={() => handleDownloadSessionExport(format)}
                  style={sessionActionButtonStyle()}
                >
                  Download {label}
                </button>
              ))}
            </div>
            {sessionExportMessage ? (
              <p aria-live="polite" style={trayStatusStyle()}>
                {sessionExportMessage}
              </p>
            ) : null}
          </>
        ) : null}
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
      <CollectionsManagerPanel />
      <section
        aria-label={ENRICHMENT_SOURCE_OPS_SECTION_TITLE}
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
          {ENRICHMENT_SOURCE_OPS_SECTION_TITLE}
        </h2>
        {!sourceOpsReady ? (
          <p style={trayStatusStyle()} aria-live="polite">
            Loading source status…
          </p>
        ) : !sourceOps ? (
          <p style={trayStatusStyle()} aria-live="polite">
            Source status unavailable.
          </p>
        ) : (
          <>
            <p
              aria-live="polite"
              style={{
                fontSize: 12,
                margin: "0 0 4px",
                color: sourceOps.globalCooldownActive
                  ? POPUP_THEME.error
                  : POPUP_THEME.muted,
                lineHeight: 1.5,
              }}
            >
              {formatEnrichmentSourceOpsCooldownLabel(sourceOps)}
            </p>
            <p
              style={{
                fontSize: 12,
                margin: "0 0 4px",
                color: POPUP_THEME.muted,
                lineHeight: 1.5,
              }}
            >
              Last cache clear:{" "}
              {formatEnrichmentCacheClearedAtLabel(sourceOps.lastCacheClearAt)}
            </p>
            <p
              style={{
                fontSize: 12,
                margin: "0 0 10px",
                color: POPUP_THEME.text,
                lineHeight: 1.5,
              }}
            >
              Cache entries: {sourceOps.totalCacheEntryCount}
            </p>
            <ul
              aria-label="Enrichment source status"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {sourceOps.sources.map((row) => {
                const statusLabel = formatEnrichmentSourceLastStatusLabel(
                  row.lastStatus
                );
                return (
                  <li
                    key={row.sourceId}
                    style={{
                      border: `1px solid ${POPUP_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 8px",
                      backgroundColor: POPUP_THEME.trayRowBg,
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: POPUP_THEME.text,
                          wordBreak: "break-word",
                        }}
                      >
                        {row.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: sourceOpsStatusColor(statusLabel),
                          marginTop: 2,
                        }}
                      >
                        {statusLabel}
                      </div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 11,
                        color: POPUP_THEME.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.cacheEntryCount} cached
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
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
              <AddFilteredToCollectionPanel
                entries={filteredEntries}
                open={addFilteredToCollectionOpen}
                onToggle={() => {
                  setAddFilteredToCollectionFeedback(null);
                  setAddFilteredToCollectionOpen((current) => !current);
                }}
                feedback={addFilteredToCollectionFeedback}
                onFeedback={setAddFilteredToCollectionFeedback}
              />
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
                      <SaveToCollectionTrayPanel
                        entry={entry}
                        open={saveToCollectionAnchorId === entry.anchorId}
                        feedback={
                          saveToCollectionAnchorId === entry.anchorId
                            ? saveToCollectionFeedback
                            : null
                        }
                        onFeedback={setSaveToCollectionFeedback}
                        onToggle={() => {
                          setSaveToCollectionFeedback(null);
                          setSaveToCollectionAnchorId((current) =>
                            current === entry.anchorId ? null : entry.anchorId
                          );
                        }}
                      />
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
