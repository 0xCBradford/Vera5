import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  navigateToIocAnchorMessage,
  enrichIocMessage,
  enrichSelectionMessage,
  getSelectionActionStateMessage,
  runOperatorMacroMessage,
  scanPageMessage,
  scanSelectionMessage,
  resetWorkspacePageMessage,
  type MessageResponse,
} from "../lib/messages";
import type { OperatorMacro } from "../lib/operatorMacro";
import {
  OPERATOR_MACRO_TRAY_NO_MACROS_TEXT,
  OPERATOR_MACRO_TRAY_RUN_ACTION_LABEL,
  OPERATOR_MACRO_TRAY_RUN_FILTERED_ACTION_LABEL,
  OPERATOR_MACRO_TRAY_RUN_FILTERED_PICKER_HEADING,
  OPERATOR_MACRO_TRAY_RUN_PICKER_HEADING,
} from "../lib/operatorMacro";
import { ensureBuiltInOperatorMacros, listStoredOperatorMacros } from "../lib/operatorMacroStorage";
import { getTabScanTrayFilter, saveTabScanTrayFilter, clearTabScanSnapshot, clearTabScanTrayFilter } from "../lib/tabScanSnapshotStorage";
import {
  DEFAULT_ON_PAGE_POPOUT_ENABLED,
  STORAGE_KEY_ON_PAGE_POPOUT_ENABLED,
  getOnPagePopoutEnabled,
  setOnPagePopoutEnabled,
} from "../lib/onPagePopoutPreference";
import { requestTabPageContextForActiveTab } from "../lib/pageContextClient";
import {
  PAGE_CONTEXT_TYPE,
  PAGE_CONTEXT_TYPE_LABEL,
  normalizePageContextType,
  resolveActivePageContextDisplay,
  resolvePageContextSourceStatusLabel,
  type PageContextSiteModeOverridesRecord,
  type PageContextSource,
  type PageContextType,
} from "../lib/pageContext";
import { requestTabScanSummaryForActiveTab } from "../lib/tabScanSummaryClient";
import {
  buildTabScanCountSummaryText,
  buildTrayRowNavigationAriaLabel,
  filterTabScanSummaryEntries,
  formatTrayRowEnrichmentHint,
  IOC_TYPE_TRAY_LABEL,
  listIocTypesPresentInSummaryForPageContext,
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
  buildHoverCardSourceEntries,
  buildWhyStillVisibleTooltip,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_ANALYST_NOTES_PLACEHOLDER,
  HOVER_CARD_REFANGED_VALUE_LABEL,
  HOVER_CARD_WHY_DETECTED_HEADING,
  HOVER_CARD_CO_OCCURRENCE_LABEL,
  resolveIndicatorValuePresentation,
  type HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import {
  buildCoOccurrenceEntryDisplaysForView,
  buildHoverCardCoOccurrencePanelView,
  formatCoOccurrenceEntryDisplayLine,
  formatCoOccurrenceEntryNavigateAriaLabel,
  handleCoOccurrenceListItemKeyDown,
  shouldShowTrayCoOccurrenceExpander,
} from "../lib/hoverCardCoOccurrence";
import {
  buildHoverCardRelationshipPanelView,
  buildRelationshipEntryDisplay,
  buildRelationshipNotebookFragmentLinksForEntry,
  buildRelationshipPriorSessionDrilldownsForEntry,
  buildTrayRelationshipDetailsElementId,
  formatRelationshipCorrelationClusterLinkAriaLabel,
  formatRelationshipEntryAccessibleLabel,
  formatRelationshipNotebookFragmentLinkAriaLabel,
  formatRelationshipPriorSessionDrilldownLine,
  formatRelationshipPriorSessionOpenAriaLabel,
  formatRelationshipPriorSessionPageContextLine,
  formatRelationshipPriorSessionReplayAriaLabel,
  formatTrayRelationshipExpanderSummary,
  listRelatedEntityKeysFromRelationshipPanelView,
  RELATIONSHIP_CORRELATION_CLUSTER_LINK_LABEL,
  RELATIONSHIP_HOVER_UI_LAYOUT,
  RELATIONSHIP_MEMORY_DISCLAIMER_TEXT,
  RELATIONSHIP_NOTEBOOK_FRAGMENTS_LABEL,
  RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL,
  RELATIONSHIP_PRIOR_SESSIONS_LABEL,
  RELATIONSHIP_TRAY_DISCLAIMER_CLASS,
  RELATIONSHIP_TRAY_NOTEBOOK_LINK_CLASS,
  RELATIONSHIP_TRAY_NOTEBOOK_LINKS_CLASS,
  RELATIONSHIP_TRAY_PRIOR_SESSION_CLASS,
  RELATIONSHIP_TRAY_PRIOR_SESSION_PAGE_CONTEXT_CLASS,
  RELATIONSHIP_TRAY_PRIOR_SESSION_REPLAY_CLASS,
  RELATIONSHIP_TRAY_PRIOR_SESSIONS_LIST_CLASS,
  relationshipEntitiesOverlapCorrelationClusters,
  shouldShowRelationshipCorrelationClusterLink,
  shouldShowRelationshipNotebookLinks,
  shouldShowRelationshipPriorSessionReplayLink,
  shouldShowTrayRelationshipExpander,
  type RelationshipNotebookFragmentLink,
  type RelationshipSessionLookup,
} from "../lib/hoverCardRelationship";
import {
  getRelationshipEdgesStore,
  type RelationshipEdgesStore,
} from "../lib/relationshipEdgeStorage";
import { getPageIocCoOccurrenceIndexForSession } from "../lib/iocCoOccurrenceStorage";
import type { PageIocCoOccurrenceIndex } from "../lib/iocCoOccurrence";
import {
  buildCorrelationClusterTrayPanelView,
  buildTrayCoOccurrenceDetailsElementId,
  buildTrayCorrelationClusterDetailsElementId,
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
  CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LINK_LABEL,
  CORRELATION_CLUSTER_TRAY_EMPTY_STATE_TEXT,
  CORRELATION_CLUSTER_TRAY_LABEL,
  formatCorrelationClusterSamePageCoOccurrenceLinkAriaLabel,
  formatCorrelationClusterTrayClusterAriaLabel,
  formatCorrelationClusterTrayClusterLine,
  formatCorrelationClusterTraySessionDrilldownAriaLabel,
  formatCorrelationClusterTraySessionDrilldownLine,
  isCorrelationClusterTrayPanelEmpty,
  openTrayCorrelationClusterDetails,
  openTraySamePageCoOccurrenceDetails,
  shouldShowCorrelationClusterSamePageCoOccurrenceLink,
  shouldShowTrayCorrelationClusterExpander,
  type CorrelationCluster,
  type CorrelationClusterSessionLookup,
} from "../lib/correlationCluster";
import { buildStoredCorrelationClustersFromInvestigationMemory } from "../lib/correlationClusterStorage";
import {
  partitionTrayEntriesByNoiseRules,
  type NoiseRule,
} from "../lib/noiseRule";
import { listStoredNoiseRules, STORAGE_KEY_NOISE_RULES } from "../lib/noiseRuleStorage";
import {
  buildKnownGoodMatchBadgeView,
  findMatchingKnownGoodEntry,
  sortTrayEntriesDeprioritizingKnownGoodMatches,
  type KnownGoodEntry,
} from "../lib/knownGood";
import {
  listStoredKnownGoodEntriesForMatching,
  STORAGE_KEY_KNOWN_GOOD_LIST,
} from "../lib/knownGoodStorage";
import {
  getStoredAnalystNote,
  normalizeAnalystNotesRecord,
  normalizeIocNoteKey,
  setStoredAnalystNote,
  STORAGE_KEY_ANALYST_NOTES,
} from "../lib/analystNotesStorage";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  getPageContextSiteModeOverrides,
  getQuietMode,
  getVera5Settings,
  POPUP_QUIET_MODE_STATUS_LABEL,
  POPUP_STATUS_SESSION_ACTIVE_LABEL,
  POPUP_STATUS_STRIP_ARIA_LABEL,
  removePageContextSiteModeOverrideForOrigin,
  setExtensionEnabled,
  setHighlightEnabled,
  STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES,
  STORAGE_KEY_QUIET_MODE,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
} from "../lib/storage";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";
import {
  DEFAULT_INVESTIGATION_SESSION_TITLE,
  listInvestigationSessionIocMembers,
  normalizeInvestigationSessionIocTimelineKey,
  type InvestigationSession,
} from "../lib/investigationSession";
import {
  requestActiveInvestigationSession,
  requestRecentInvestigationSessions,
  requestReopenInvestigationSession,
  resolveActiveTabPageUrl,
} from "../lib/investigationSessionClient";
import {
  listStoredInvestigationSessions,
} from "../lib/investigationSessionStorage";
import {
  copyTrayTemplateExportToClipboard,
  downloadTrayTemplateExportFile,
  getExportTemplateLabel,
  type ExportTemplateId,
} from "../lib/exportTemplates";
import {
  getNotebookFragmentsStore,
  type NotebookFragmentsStore,
} from "../lib/notebookFragmentStorage";
import {
  buildReplaySegmentDetailView,
  buildReplayStepJumpAriaLabel,
  clampReplayStepIndex,
  copyInvestigationReplayTranscriptToClipboard,
  downloadInvestigationReplayTranscriptFile,
  formatReplayStepListLabel,
  formatReplayStepPositionLabel,
  INVESTIGATION_REPLAY_COPY_TRANSCRIPT_LABEL,
  INVESTIGATION_REPLAY_DETAIL_ARIA_LABEL,
  INVESTIGATION_REPLAY_DETAIL_ACTION_LABEL,
  INVESTIGATION_REPLAY_DETAIL_ATTRIBUTION_LABEL,
  INVESTIGATION_REPLAY_DETAIL_IOC_LABEL,
  INVESTIGATION_REPLAY_DETAIL_TEMPLATE_LABEL,
  INVESTIGATION_REPLAY_DOWNLOAD_TRANSCRIPT_LABEL,
  INVESTIGATION_REPLAY_EMPTY_TEXT,
  INVESTIGATION_REPLAY_EXPORT_GROUP_ARIA_LABEL,
  INVESTIGATION_REPLAY_EXPORT_SECTION_LABEL,
  INVESTIGATION_REPLAY_EXPORT_TEMPLATE_LABEL,
  INVESTIGATION_REPLAY_INCLUDE_MEMORY_APPENDIX_LABEL,
  INVESTIGATION_REPLAY_LIST_ARIA_LABEL,
  INVESTIGATION_REPLAY_NAV_GROUP_ARIA_LABEL,
  INVESTIGATION_REPLAY_NEXT_LABEL,
  INVESTIGATION_REPLAY_PREVIOUS_LABEL,
  INVESTIGATION_REPLAY_SECTION_LABEL,
  INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS,
  isReplaySegmentNavigable,
  jumpToReplayStepIndex,
  resolveInvestigationReplayTranscriptCopyFeedback,
  resolveInvestigationReplayTranscriptDownloadFeedback,
  resolveReplayNextStepIndex,
  resolveReplayPreviousStepIndex,
  type InvestigationReplayTranscriptExportInput,
  type InvestigationReplayTranscriptTemplateId,
  type ReplaySegment,
} from "../lib/replaySegment";
import {
  buildNormalizedEnrichmentRecord,
  copyEnrichmentExportJsonToClipboard,
  copyEnrichmentExportMarkdownToClipboard,
  copyEnrichmentExportTxtToClipboard,
  downloadEnrichmentExportFile,
  type EnrichmentExportFileFormat,
  type NormalizedEnrichmentRecord,
} from "../lib/enrichmentExport";
import { copyTextToClipboard } from "../lib/copyText";
import {
  resolveConditionalIntelligenceChannels,
  type ConditionalIntelligenceChannel,
} from "../lib/conditionalIntelligence";
import {
  listSandboxDestinationResolutions,
  SANDBOX_NO_SELECTION_GUIDANCE,
  SANDBOX_PUBLIC_SUBMISSION_NOTICE_LABEL,
  SANDBOX_PUBLIC_SUBMISSION_WARNING,
  type SandboxDestinationResolution,
} from "../lib/sandboxPivotRegistry";
import {
  type InvestigationHistoryEntry,
} from "../lib/investigationHistory";
import {
  listInvestigationHistoryEntries,
} from "../lib/investigationHistoryStorage";
import {
  buildAddFilteredToCollectionActionLabel,
  formatAddFilteredToCollectionFeedback,
  formatSaveToCollectionFeedback,
  IOC_COLLECTION_ADD_FILTERED_HEADING,
  IOC_COLLECTION_CREATE_NEW_LABEL,
  IOC_COLLECTION_NEW_NAME_PLACEHOLDER,
  IOC_COLLECTION_NO_COLLECTIONS_TEXT,
  IOC_COLLECTION_PICKER_HEADING,
  IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL,
  IOC_COLLECTION_SAVE_TO_NEW_LABEL,
  buildIocCollectionMemberDedupeKey,
  normalizeIocCollectionName,
  type IocCollection,
} from "../lib/iocCollection";
import {
  requestAddIocToCollection,
  requestAddIocsToCollection,
  requestCreateIocCollection,
  requestListIocCollections,
} from "../lib/iocCollectionClient";
import {
  readStoredEnrichmentSourceResult,
  STORAGE_KEY_ENRICHMENT_CACHE,
} from "../lib/cache";
import { requestEnrichmentSourceOps } from "../lib/enrichmentSourceOpsClient";
import {
  type EnrichmentSourceOpsSnapshot,
} from "../lib/enrichmentSourceOps";
import { clearPopupPanelFocus, readPopupPanelFocus } from "../lib/popupPanelFocus";
import { VERA5_COLOR, VERA5_FONT, VERA5_RADIUS, VERA5_SPACE } from "../lib/theme";
import {
  resolveWorkspaceTrayView,
  resolveTrayNavigationFeedback,
} from "../lib/workspaceTrayState";
import {
  WORKSPACE_STATE_COPY,
  resolveCanonicalDetectedCount,
  resolveCompositeScorePresentation,
  resolveDetectedIndicatorsStatusCopy,
  resolveEnrichmentPresentation,
  resolveEnrichmentStatusLine,
  resolveIntelFeedUnselectedCopy,
  resolveInvestigationPathsSelectionCopy,
  resolveScanPresentation,
} from "../lib/workspacePresentationState";
import {
  ENRICHMENT_SOURCE_ORDER,
  enrichmentSourceSupportsIocType,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import { liveEnrichmentSupportsIocType } from "../lib/enrichmentSourceSelection";
import type { EnrichmentSourceResult } from "../lib/enrichment";
import { buildHoverCardRiskScoreView, formatCompositeRiskLabelDisplay } from "../lib/scoring";
import { getPivotLinks, type PivotLink } from "../lib/pivots";
import { InvestigationGlyph, VeraIcon, VeraUiIcons, VERA_ICON_WEIGHT } from "../lib/veraIcons";
import { VendorEvidenceMatrix } from "./VendorEvidenceMatrix";
import {
  orderIntelFeedVendorSourceIds,
  type IntelSourceAvailabilityRecord,
} from "./intelVendorOrdering";

export type {
  IntelSourceAvailability,
  IntelSourceAvailabilityRecord,
  IntelVendorSortGroup,
} from "./intelVendorOrdering";
export {
  orderIntelFeedVendorSourceIds,
  resolveIntelVendorCardStatus,
  resolveIntelVendorNumericScore,
  resolveIntelVendorSortGroup,
} from "./intelVendorOrdering";

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
          fontFamily: VERA5_FONT.mono,
          fontSize: 13,
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
      <span
        style={{
          color: POPUP_THEME.text,
          fontFamily: VERA5_FONT.mono,
          fontSize: 13,
          wordBreak: "break-all",
        }}
      >
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
          color: POPUP_THEME.muted,
          cursor: "pointer",
          fontSize: 11,
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
  entries: readonly TabScanSummaryEntry[];
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

async function sendRunOperatorMacroToActiveTab(
  message: ReturnType<typeof runOperatorMacroMessage>
): Promise<MessageResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab." };
  }
  try {
    return (await chrome.tabs.sendMessage(tab.id, message)) as MessageResponse;
  } catch {
    return { ok: false, error: "Could not reach the page. Scan the page first." };
  }
}

function formatOperatorMacroRunFeedback(
  response: MessageResponse,
  successMessage: string,
  failureFallback: string
): string {
  if (!response.ok) {
    return response.error || failureFallback;
  }
  const payload = response.payload as { warning?: unknown } | undefined;
  if (typeof payload?.warning === "string" && payload.warning.trim().length > 0) {
    return `${successMessage} ${payload.warning.trim()}`;
  }
  return successMessage;
}

function toOperatorMacroTrayTargetEntry(entry: TabScanSummaryEntry) {
  return {
    value: entry.value,
    iocType: entry.type,
    anchorId: entry.anchorId,
  };
}

function RunMacroTrayPanel({
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
  const [macros, setMacros] = useState<OperatorMacro[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningMacroId, setRunningMacroId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void ensureBuiltInOperatorMacros()
      .then(() => listStoredOperatorMacros())
      .then((list) => {
        if (!cancelled) {
          setMacros(list.filter((macro) => macro.triggers.tray));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMacros([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleRun = async (macro: OperatorMacro) => {
    setRunningMacroId(macro.id);
    const response = await sendRunOperatorMacroToActiveTab(
      runOperatorMacroMessage({
        macroId: macro.id,
        target: {
          mode: "selection",
          entry: toOperatorMacroTrayTargetEntry(entry),
        },
      })
    );
    setRunningMacroId(null);
    onFeedback(
      formatOperatorMacroRunFeedback(
        response,
        `Ran ${macro.name} on ${entry.value}.`,
        `Could not run ${macro.name}.`
      )
    );
  };

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
        aria-label={`${OPERATOR_MACRO_TRAY_RUN_ACTION_LABEL} for ${entry.value}`}
        style={{
          border: "none",
          background: "transparent",
          color: POPUP_THEME.muted,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          padding: 0,
        }}
      >
        {OPERATOR_MACRO_TRAY_RUN_ACTION_LABEL}
      </button>
      {open ? (
        <div
          role="group"
          aria-label={OPERATOR_MACRO_TRAY_RUN_PICKER_HEADING}
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
            {OPERATOR_MACRO_TRAY_RUN_PICKER_HEADING}
          </p>
          {loading ? (
            <p style={{ margin: 0, fontSize: 12, color: POPUP_THEME.muted }}>Loading macros…</p>
          ) : macros.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: POPUP_THEME.muted }}>
              {OPERATOR_MACRO_TRAY_NO_MACROS_TEXT}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {macros.map((macro) => (
                <button
                  key={macro.id}
                  type="button"
                  disabled={runningMacroId !== null}
                  onClick={() => void handleRun(macro)}
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    textAlign: "left",
                    cursor: runningMacroId !== null ? "default" : "pointer",
                  }}
                >
                  {runningMacroId === macro.id ? `Running ${macro.name}…` : macro.name}
                </button>
              ))}
            </div>
          )}
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

function RunMacroOnFilteredPanel({
  entries,
  open,
  onToggle,
  feedback,
  onFeedback,
}: {
  entries: readonly TabScanSummaryEntry[];
  open: boolean;
  onToggle: () => void;
  feedback: string | null;
  onFeedback: (message: string | null) => void;
}) {
  const [macros, setMacros] = useState<OperatorMacro[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningMacroId, setRunningMacroId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void ensureBuiltInOperatorMacros()
      .then(() => listStoredOperatorMacros())
      .then((list) => {
        if (!cancelled) {
          setMacros(list.filter((macro) => macro.triggers.tray));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMacros([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleRun = async (macro: OperatorMacro) => {
    setRunningMacroId(macro.id);
    const response = await sendRunOperatorMacroToActiveTab(
      runOperatorMacroMessage({
        macroId: macro.id,
        target: {
          mode: "filtered",
          entries: entries.map(toOperatorMacroTrayTargetEntry),
        },
      })
    );
    setRunningMacroId(null);
    onFeedback(
      formatOperatorMacroRunFeedback(
        response,
        `Ran ${macro.name} on ${entries.length} filtered indicator${
          entries.length === 1 ? "" : "s"
        }.`,
        `Could not run ${macro.name}.`
      )
    );
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={entries.length === 0}
        style={{
          border: "none",
          background: "transparent",
          color: POPUP_THEME.muted,
          cursor: entries.length === 0 ? "default" : "pointer",
          fontSize: 11,
          fontWeight: 600,
          padding: 0,
          opacity: entries.length === 0 ? 0.65 : 1,
        }}
      >
        {`${OPERATOR_MACRO_TRAY_RUN_FILTERED_ACTION_LABEL} (${entries.length})`}
      </button>
      {open ? (
        <div
          role="group"
          aria-label={OPERATOR_MACRO_TRAY_RUN_FILTERED_PICKER_HEADING}
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
            {OPERATOR_MACRO_TRAY_RUN_FILTERED_PICKER_HEADING}
          </p>
          {loading ? (
            <p style={{ margin: 0, fontSize: 12, color: POPUP_THEME.muted }}>Loading macros…</p>
          ) : macros.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: POPUP_THEME.muted }}>
              {OPERATOR_MACRO_TRAY_NO_MACROS_TEXT}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {macros.map((macro) => (
                <button
                  key={macro.id}
                  type="button"
                  disabled={runningMacroId !== null || entries.length === 0}
                  onClick={() => void handleRun(macro)}
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    textAlign: "left",
                    cursor: runningMacroId !== null || entries.length === 0 ? "default" : "pointer",
                  }}
                >
                  {runningMacroId === macro.id ? `Running ${macro.name}…` : macro.name}
                </button>
              ))}
            </div>
          )}
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





export function InvestigationReplayPanel({
  sessionId,
  sessionTitle,
  sessionPageUrl,
  segments,
  onActivateSegment,
  navigationMessage,
  resolveSessionMemoryRecords,
}: {
  sessionId: string;
  sessionTitle: string;
  sessionPageUrl: string;
  segments: readonly ReplaySegment[];
  onActivateSegment?: (segment: ReplaySegment) => void;
  navigationMessage?: string | null;
  resolveSessionMemoryRecords?: () => Promise<readonly NormalizedEnrichmentRecord[]>;
}) {
  const [stepIndex, setStepIndex] = useState(() => clampReplayStepIndex(0, segments.length));
  const [transcriptExportMessage, setTranscriptExportMessage] = useState<string | null>(null);
  const [includeMemoryAppendix, setIncludeMemoryAppendix] = useState(true);
  const [transcriptTemplateId, setTranscriptTemplateId] =
    useState<InvestigationReplayTranscriptTemplateId>("markdown-report");

  useEffect(() => {
    setStepIndex(clampReplayStepIndex(0, segments.length));
    setTranscriptExportMessage(null);
    setIncludeMemoryAppendix(true);
    setTranscriptTemplateId("markdown-report");
  }, [sessionId, segments.length]);

  const previousStepIndex = resolveReplayPreviousStepIndex(stepIndex, segments.length);
  const nextStepIndex = resolveReplayNextStepIndex(stepIndex, segments.length);
  const positionLabel = formatReplayStepPositionLabel(stepIndex, segments.length);
  const currentSegment = stepIndex >= 0 ? segments[stepIndex] : undefined;
  const currentDetail = currentSegment ? buildReplaySegmentDetailView(currentSegment) : null;

  const transcriptTemplateSelectStyle: CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "4px 6px",
    borderRadius: 4,
    border: `1px solid ${POPUP_THEME.border}`,
    backgroundColor: POPUP_THEME.trayRowBg,
    color: POPUP_THEME.text,
    fontSize: 12,
  };

  const buildTranscriptExportInput =
    async (): Promise<InvestigationReplayTranscriptExportInput> => {
      const base: InvestigationReplayTranscriptExportInput = {
        session: {
          id: sessionId,
          title: sessionTitle,
          pageUrl: sessionPageUrl,
        },
        segments,
        includeMemoryAppendix,
        templateId: transcriptTemplateId,
      };
      if (!includeMemoryAppendix || !resolveSessionMemoryRecords) {
        return base;
      }
      const records = await resolveSessionMemoryRecords();
      return {
        ...base,
        records,
      };
    };

  const handleCopyTranscript = () => {
    void (async () => {
      const exportInput = await buildTranscriptExportInput();
      const copied = await copyInvestigationReplayTranscriptToClipboard(exportInput);
      setTranscriptExportMessage(
        resolveInvestigationReplayTranscriptCopyFeedback({
          copied,
          stepCount: segments.length,
          templateId: transcriptTemplateId,
        })
      );
    })();
  };

  const handleDownloadTranscript = () => {
    void (async () => {
      const exportInput = await buildTranscriptExportInput();
      const downloaded = downloadInvestigationReplayTranscriptFile(exportInput);
      setTranscriptExportMessage(
        resolveInvestigationReplayTranscriptDownloadFeedback({
          downloaded,
          stepCount: segments.length,
          templateId: transcriptTemplateId,
        })
      );
    })();
  };

  const goToStep = (targetStepIndex: number) => {
    const jumped = jumpToReplayStepIndex(targetStepIndex, segments.length);
    if (jumped === null) {
      return;
    }
    setStepIndex(jumped);
    const segment = segments[jumped];
    if (segment && isReplaySegmentNavigable(segment)) {
      onActivateSegment?.(segment);
    }
  };

  return (
    <div id="popup-investigation-replay" style={{ marginTop: 10, marginBottom: 10 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          margin: "0 0 8px",
          color: POPUP_THEME.accentText,
        }}
      >
        {INVESTIGATION_REPLAY_SECTION_LABEL}
      </h3>
      {segments.length === 0 ? (
        <p style={{ ...trayStatusStyle(), margin: 0 }} aria-live="polite">
          {INVESTIGATION_REPLAY_EMPTY_TEXT}
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label={INVESTIGATION_REPLAY_NAV_GROUP_ARIA_LABEL}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              aria-label={INVESTIGATION_REPLAY_PREVIOUS_LABEL}
              disabled={previousStepIndex === null}
              onClick={() => {
                if (previousStepIndex !== null) {
                  goToStep(previousStepIndex);
                }
              }}
              style={sessionActionButtonStyle()}
            >
              {INVESTIGATION_REPLAY_PREVIOUS_LABEL}
            </button>
            <span
              aria-live="polite"
              style={{
                fontSize: 12,
                color: POPUP_THEME.muted,
                minWidth: 88,
              }}
            >
              {positionLabel}
            </span>
            <button
              type="button"
              aria-label={INVESTIGATION_REPLAY_NEXT_LABEL}
              disabled={nextStepIndex === null}
              onClick={() => {
                if (nextStepIndex !== null) {
                  goToStep(nextStepIndex);
                }
              }}
              style={sessionActionButtonStyle()}
            >
              {INVESTIGATION_REPLAY_NEXT_LABEL}
            </button>
          </div>
          {currentDetail ? (
            <div
              aria-label={INVESTIGATION_REPLAY_DETAIL_ARIA_LABEL}
              aria-live="polite"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px",
                marginBottom: 8,
                borderRadius: 6,
                backgroundColor: POPUP_THEME.trayRowBg,
                border: `1px solid ${POPUP_THEME.border}`,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: POPUP_THEME.text }}>
                <span style={{ color: POPUP_THEME.muted }}>
                  {INVESTIGATION_REPLAY_DETAIL_ACTION_LABEL}:{" "}
                </span>
                {currentDetail.actionLabel}
              </span>
              <span style={{ color: POPUP_THEME.text }}>
                <span style={{ color: POPUP_THEME.muted }}>
                  {INVESTIGATION_REPLAY_DETAIL_IOC_LABEL}:{" "}
                </span>
                <span
                  title={currentDetail.iocFull}
                  style={{ fontFamily: VERA5_FONT.mono, wordBreak: "break-all" }}
                >
                  {currentDetail.iocDisplay}
                </span>
              </span>
              {currentDetail.sourceAttributionSummary ? (
                <span style={{ color: POPUP_THEME.muted }}>
                  <span>{INVESTIGATION_REPLAY_DETAIL_ATTRIBUTION_LABEL}: </span>
                  {currentDetail.sourceAttributionSummary}
                </span>
              ) : null}
              {currentDetail.templateLabel ? (
                <span style={{ color: POPUP_THEME.muted }}>
                  <span>{INVESTIGATION_REPLAY_DETAIL_TEMPLATE_LABEL}: </span>
                  {currentDetail.templateLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          <ol
            aria-label={INVESTIGATION_REPLAY_LIST_ARIA_LABEL}
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
            {segments.map((segment, index) => {
              const selected = index === stepIndex;
              return (
                <li
                  key={segment.id}
                  role="button"
                  tabIndex={0}
                  aria-current={selected ? "step" : undefined}
                  aria-label={buildReplayStepJumpAriaLabel(segment, index, selected)}
                  onClick={() => goToStep(index)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
                      return;
                    }
                    keyboardEvent.preventDefault();
                    goToStep(index);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    padding: "6px 8px",
                    borderRadius: 6,
                    backgroundColor: selected ? POPUP_THEME.filterActiveBg : POPUP_THEME.trayRowBg,
                    border: selected ? `1px solid ${POPUP_THEME.accent}` : `1px solid transparent`,
                    fontSize: 12,
                    lineHeight: 1.4,
                    cursor: "pointer",
                    color: POPUP_THEME.text,
                  }}
                >
                  {formatReplayStepListLabel(segment, index)}
                </li>
              );
            })}
          </ol>
          <div style={{ marginTop: 10 }}>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                margin: "0 0 8px",
                color: POPUP_THEME.accentText,
              }}
            >
              {INVESTIGATION_REPLAY_EXPORT_SECTION_LABEL}
            </h4>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
                marginBottom: 8,
              }}
            >
              {INVESTIGATION_REPLAY_EXPORT_TEMPLATE_LABEL}
              <select
                value={transcriptTemplateId}
                aria-label={INVESTIGATION_REPLAY_EXPORT_TEMPLATE_LABEL}
                onChange={(event) => {
                  setTranscriptExportMessage(null);
                  setTranscriptTemplateId(
                    event.target.value as InvestigationReplayTranscriptTemplateId
                  );
                }}
                style={transcriptTemplateSelectStyle}
              >
                {INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS.map((templateId) => (
                  <option key={templateId} value={templateId}>
                    {getExportTemplateLabel(templateId)}
                  </option>
                ))}
              </select>
            </label>
            {resolveSessionMemoryRecords ? (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: POPUP_THEME.text,
                  marginBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeMemoryAppendix}
                  aria-label={INVESTIGATION_REPLAY_INCLUDE_MEMORY_APPENDIX_LABEL}
                  onChange={(event) => {
                    setTranscriptExportMessage(null);
                    setIncludeMemoryAppendix(event.target.checked);
                  }}
                />
                {INVESTIGATION_REPLAY_INCLUDE_MEMORY_APPENDIX_LABEL}
              </label>
            ) : null}
            <div
              role="group"
              aria-label={INVESTIGATION_REPLAY_EXPORT_GROUP_ARIA_LABEL}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <button
                type="button"
                aria-label={INVESTIGATION_REPLAY_COPY_TRANSCRIPT_LABEL}
                onClick={handleCopyTranscript}
                style={sessionActionButtonStyle()}
              >
                {INVESTIGATION_REPLAY_COPY_TRANSCRIPT_LABEL}
              </button>
              <button
                type="button"
                aria-label={INVESTIGATION_REPLAY_DOWNLOAD_TRANSCRIPT_LABEL}
                onClick={handleDownloadTranscript}
                style={sessionActionButtonStyle()}
              >
                {INVESTIGATION_REPLAY_DOWNLOAD_TRANSCRIPT_LABEL}
              </button>
            </div>
            {transcriptExportMessage ? (
              <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "8px 0 0" }}>
                {transcriptExportMessage}
              </p>
            ) : null}
          </div>
          {navigationMessage ? (
            <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "8px 0 0" }}>
              {navigationMessage}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}


function WhyDetectedTrayDetails({ entry }: { entry: TabScanSummaryEntry }) {
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
          color: POPUP_THEME.muted,
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

function CoOccurrenceTrayDetails({
  entry,
  pageIndex,
  onNavigateToRelated,
}: {
  entry: TabScanSummaryEntry;
  pageIndex: PageIocCoOccurrenceIndex | null;
  onNavigateToRelated: (input: {
    anchorId: string;
    value: string;
    iocType: TabScanSummaryEntry["type"];
  }) => void;
}) {
  const view = buildHoverCardCoOccurrencePanelView({
    iocType: entry.type,
    value: entry.value,
    pageIndex,
  });
  if (!shouldShowTrayCoOccurrenceExpander(view)) {
    return null;
  }

  return (
    <details
      id={buildTrayCoOccurrenceDetailsElementId(entry.anchorId)}
      className="vera5-tray-co-occurrence"
      style={trayWhyDetectedDetailsStyle()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        style={{
          cursor: "pointer",
          color: POPUP_THEME.muted,
          fontWeight: 600,
        }}
      >
        {HOVER_CARD_CO_OCCURRENCE_LABEL}
      </summary>
      <div style={{ marginTop: 4 }}>
        {view.contextLabel ? <p style={{ margin: "0 0 4px" }}>{view.contextLabel}</p> : null}
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {buildCoOccurrenceEntryDisplaysForView(view).map((display) => (
            <li key={`${display.anchorId}-${display.typeLabel}`}>
              <button
                type="button"
                className="vera5-tray-co-occurrence-item"
                aria-label={formatCoOccurrenceEntryNavigateAriaLabel(display)}
                title={display.displayValue !== display.fullValue ? display.fullValue : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  onNavigateToRelated({
                    anchorId: display.anchorId,
                    value: display.fullValue,
                    iocType: display.iocType,
                  });
                }}
                onKeyDown={(event) => {
                  handleCoOccurrenceListItemKeyDown(event, ".vera5-tray-co-occurrence-item");
                }}
              >
                {formatCoOccurrenceEntryDisplayLine(display)}
              </button>
            </li>
          ))}
        </ul>
        <p
          className="vera5-tray-co-occurrence-disclaimer"
          style={{
            ...trayStatusStyle(),
            margin: "8px 0 0",
            fontSize: 11,
            lineHeight: 1.4,
          }}
          role="note"
        >
          {CORRELATION_CLUSTER_DISCLAIMER_TEXT}
        </p>
      </div>
    </details>
  );
}

function RelationshipTrayDetails({
  entry,
  store,
  knownGoodEntries,
  clusters,
  activeSessionId,
  sessionsById,
  notebookStore,
  siteModeOverrides,
  onOpenPriorSession,
  onOpenPriorSessionReplay,
  onOpenNotebookLink,
}: {
  entry: TabScanSummaryEntry;
  store: RelationshipEdgesStore | null;
  knownGoodEntries: readonly KnownGoodEntry[];
  clusters: readonly CorrelationCluster[];
  activeSessionId: string | null;
  sessionsById: ReadonlyMap<string, RelationshipSessionLookup>;
  notebookStore: NotebookFragmentsStore | null;
  siteModeOverrides: PageContextSiteModeOverridesRecord;
  onOpenPriorSession: (sessionId: string) => void;
  onOpenPriorSessionReplay: (sessionId: string) => void;
  onOpenNotebookLink: (link: RelationshipNotebookFragmentLink) => void;
}) {
  if (!store) {
    return null;
  }

  const view = buildHoverCardRelationshipPanelView({
    iocType: entry.type,
    value: entry.value,
    edges: store.edges,
    knownGoodPolicy: store.knownGoodPolicy,
    knownGoodEntries,
    minCoOccurrenceCount: store.minCoOccurrenceCount,
  });
  if (!shouldShowTrayRelationshipExpander(view)) {
    return null;
  }

  const hasOverlappingCorrelationCluster = relationshipEntitiesOverlapCorrelationClusters({
    focusEntityKey: view.focusEntityKey,
    relatedEntityKeys: listRelatedEntityKeysFromRelationshipPanelView(view),
    clusters,
  });
  const showCorrelationLink = shouldShowRelationshipCorrelationClusterLink({
    hasRelationshipEntries: view.entries.length > 0,
    hasOverlappingCorrelationCluster,
  });
  const correlationDetailsId = buildTrayCorrelationClusterDetailsElementId(entry.anchorId);

  return (
    <details
      id={buildTrayRelationshipDetailsElementId(entry.anchorId)}
      className="vera5-tray-relationship"
      data-vera5-relationship-layout={RELATIONSHIP_HOVER_UI_LAYOUT}
      style={trayWhyDetectedDetailsStyle()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        style={{
          cursor: "pointer",
          color: POPUP_THEME.muted,
          fontWeight: 600,
        }}
      >
        {formatTrayRelationshipExpanderSummary(view.entries.length)}
      </summary>
      <div style={{ marginTop: 4 }}>
        <ul
          className="vera5-tray-relationship-list"
          style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}
        >
          {view.entries.map((relationshipEntry) => {
            const display = buildRelationshipEntryDisplay(relationshipEntry);
            const priorSessions = buildRelationshipPriorSessionDrilldownsForEntry({
              entry: relationshipEntry,
              sessionsById,
              activeSessionId,
              siteModeOverrides,
            });
            const notebookLinks = buildRelationshipNotebookFragmentLinksForEntry({
              entry: relationshipEntry,
              notebookStore,
              activeSessionId,
              sessionsById,
            });
            const showNotebookLinks = shouldShowRelationshipNotebookLinks(notebookLinks);
            return (
              <li
                key={relationshipEntry.edgeId}
                className="vera5-tray-relationship-item"
                aria-label={formatRelationshipEntryAccessibleLabel(display)}
                title={display.displayValue !== display.fullValue ? display.fullValue : undefined}
              >
                {display.lineText}
                {priorSessions.length > 0 ? (
                  <ul
                    className={RELATIONSHIP_TRAY_PRIOR_SESSIONS_LIST_CLASS}
                    aria-label={RELATIONSHIP_PRIOR_SESSIONS_LABEL}
                    style={{
                      margin: "4px 0 0",
                      paddingLeft: 16,
                      listStyle: "circle",
                    }}
                  >
                    {priorSessions.map((session) => (
                      <li key={session.sessionId}>
                        <button
                          type="button"
                          className={RELATIONSHIP_TRAY_PRIOR_SESSION_CLASS}
                          aria-label={formatRelationshipPriorSessionOpenAriaLabel(session)}
                          title={session.pageUrl || undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenPriorSession(session.sessionId);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            color: POPUP_THEME.accent,
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                          }}
                        >
                          <div style={{ color: POPUP_THEME.text, fontWeight: 600 }}>
                            {session.title}
                          </div>
                          <div
                            className={RELATIONSHIP_TRAY_PRIOR_SESSION_PAGE_CONTEXT_CLASS}
                            style={{
                              color: POPUP_THEME.muted,
                              fontSize: 12,
                              lineHeight: 1.4,
                            }}
                          >
                            {formatRelationshipPriorSessionPageContextLine(session)}
                          </div>
                          <div
                            style={{
                              color: POPUP_THEME.muted,
                              fontSize: 12,
                              lineHeight: 1.4,
                            }}
                          >
                            {formatRelationshipPriorSessionDrilldownLine(session)}
                          </div>
                        </button>
                        {shouldShowRelationshipPriorSessionReplayLink(session) ? (
                          <p style={{ margin: "4px 0 0" }}>
                            <button
                              type="button"
                              className={RELATIONSHIP_TRAY_PRIOR_SESSION_REPLAY_CLASS}
                              aria-label={formatRelationshipPriorSessionReplayAriaLabel(session)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenPriorSessionReplay(session.sessionId);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                color: POPUP_THEME.accent,
                                cursor: "pointer",
                                textAlign: "left",
                                font: "inherit",
                                fontSize: 12,
                                textDecoration: "underline",
                              }}
                            >
                              {RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL}
                            </button>
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {showNotebookLinks ? (
                  <ul
                    className={RELATIONSHIP_TRAY_NOTEBOOK_LINKS_CLASS}
                    aria-label={RELATIONSHIP_NOTEBOOK_FRAGMENTS_LABEL}
                    style={{
                      margin: "4px 0 0",
                      paddingLeft: 16,
                      listStyle: "circle",
                    }}
                  >
                    {notebookLinks.map((link) => (
                      <li key={link.fragmentId}>
                        <button
                          type="button"
                          className={RELATIONSHIP_TRAY_NOTEBOOK_LINK_CLASS}
                          aria-label={formatRelationshipNotebookFragmentLinkAriaLabel(link)}
                          title={link.bodyPreview}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenNotebookLink(link);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            color: POPUP_THEME.accent,
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                            fontSize: 12,
                            lineHeight: 1.4,
                          }}
                        >
                          {link.lineText}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
        {showCorrelationLink ? (
          <p style={{ margin: "8px 0 0" }}>
            <button
              type="button"
              className="vera5-tray-relationship-correlation-link"
              aria-controls={correlationDetailsId}
              aria-label={formatRelationshipCorrelationClusterLinkAriaLabel()}
              onClick={(event) => {
                event.stopPropagation();
                openTrayCorrelationClusterDetails(event.currentTarget);
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: POPUP_THEME.accent,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              {RELATIONSHIP_CORRELATION_CLUSTER_LINK_LABEL}
            </button>
          </p>
        ) : null}
        <p
          className={RELATIONSHIP_TRAY_DISCLAIMER_CLASS}
          style={{
            ...trayStatusStyle(),
            margin: "8px 0 0",
            fontSize: 11,
            lineHeight: 1.4,
          }}
          role="note"
        >
          {RELATIONSHIP_MEMORY_DISCLAIMER_TEXT}
        </p>
      </div>
    </details>
  );
}

function CorrelationClusterTrayDetails({
  entry,
  clusters,
  activeSessionId,
  sessionsById,
  pageIndex,
  viewingCurrentTabScan,
  ready,
}: {
  entry: TabScanSummaryEntry;
  clusters: readonly CorrelationCluster[];
  activeSessionId: string | null;
  sessionsById: ReadonlyMap<string, CorrelationClusterSessionLookup>;
  pageIndex: PageIocCoOccurrenceIndex | null;
  viewingCurrentTabScan: boolean;
  ready: boolean;
}) {
  const view = buildCorrelationClusterTrayPanelView({
    iocType: entry.type,
    value: entry.value,
    clusters,
    activeSessionId,
    sessionsById,
  });
  if (!shouldShowTrayCorrelationClusterExpander(view, { ready })) {
    return null;
  }

  const isEmpty = isCorrelationClusterTrayPanelEmpty(view);
  const samePageCoOccurrenceView = buildHoverCardCoOccurrencePanelView({
    iocType: entry.type,
    value: entry.value,
    pageIndex,
  });
  const showSamePageLink = shouldShowCorrelationClusterSamePageCoOccurrenceLink({
    viewingCurrentTabScan,
    hasSamePageCoOccurrence: shouldShowTrayCoOccurrenceExpander(samePageCoOccurrenceView),
  });
  const samePageDetailsId = buildTrayCoOccurrenceDetailsElementId(entry.anchorId);

  return (
    <details
      id={buildTrayCorrelationClusterDetailsElementId(entry.anchorId)}
      className="vera5-tray-correlation-clusters"
      data-vera5-correlation-layout={view.layout}
      data-vera5-correlation-empty={isEmpty ? "true" : "false"}
      style={trayWhyDetectedDetailsStyle()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        style={{
          cursor: "pointer",
          color: POPUP_THEME.muted,
          fontWeight: 600,
        }}
      >
        {CORRELATION_CLUSTER_TRAY_LABEL}
      </summary>
      <div style={{ marginTop: 4 }}>
        {isEmpty ? (
          <p
            className="vera5-tray-correlation-clusters-empty"
            style={{ ...trayStatusStyle(), margin: 0 }}
            aria-live="polite"
          >
            {CORRELATION_CLUSTER_TRAY_EMPTY_STATE_TEXT}
          </p>
        ) : (
          <ul
            className="vera5-tray-correlation-clusters-list"
            style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}
          >
            {view.clusters.map((row) => (
              <li
                key={row.clusterId}
                className="vera5-tray-correlation-clusters-item"
                aria-label={formatCorrelationClusterTrayClusterAriaLabel(row)}
              >
                <div style={{ color: POPUP_THEME.text, fontWeight: 600 }}>
                  {formatCorrelationClusterTrayClusterLine(row)}
                </div>
                <ul
                  className="vera5-tray-correlation-clusters-drilldown"
                  style={{ margin: "4px 0 0", paddingLeft: 16, listStyle: "circle" }}
                >
                  {row.otherSessions.map((session) => (
                    <li
                      key={`${row.clusterId}-${session.sessionId}`}
                      className="vera5-tray-correlation-clusters-drilldown-item"
                      aria-label={formatCorrelationClusterTraySessionDrilldownAriaLabel(session)}
                      title={session.pageUrl || undefined}
                    >
                      <div style={{ color: POPUP_THEME.text, fontWeight: 600 }}>
                        {session.title}
                      </div>
                      <div style={{ color: POPUP_THEME.muted, fontSize: 12, lineHeight: 1.4 }}>
                        {formatCorrelationClusterTraySessionDrilldownLine(session)}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {showSamePageLink ? (
          <p style={{ margin: "8px 0 0" }}>
            <button
              type="button"
              className="vera5-tray-correlation-same-page-link"
              aria-controls={samePageDetailsId}
              aria-label={formatCorrelationClusterSamePageCoOccurrenceLinkAriaLabel()}
              onClick={(event) => {
                event.stopPropagation();
                openTraySamePageCoOccurrenceDetails(event.currentTarget);
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: POPUP_THEME.accent,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 12,
                textDecoration: "underline",
              }}
            >
              {CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LINK_LABEL}
            </button>
          </p>
        ) : null}
        <p
          className="vera5-tray-correlation-disclaimer"
          style={{
            ...trayStatusStyle(),
            margin: "8px 0 0",
            fontSize: 11,
            lineHeight: 1.4,
          }}
          role="note"
        >
          {CORRELATION_CLUSTER_DISCLAIMER_TEXT}
        </p>
      </div>
    </details>
  );
}

type AnalystNoteSaveStatus = "idle" | "saving" | "saved";
type DetailEnrichState = "idle" | "enriching";

function buildGroundedIntelSummary(sourceEntries: readonly HoverCardSourceEntry[]): string {
  const successful = sourceEntries.filter((source) => source.status === "ok");
  if (successful.length === 0) {
    return "No stored vendor evidence for this indicator. Enrich it to populate the feed.";
  }
  const riskView = buildHoverCardRiskScoreView(successful);
  const contributors = successful.map((source) => source.label).join(", ");
  if (riskView.score.compositeSignal !== null) {
    const label = formatCompositeRiskLabelDisplay(riskView.score.label);
    const disagreement = riskView.score.disagreement
      ? " Source disagreement requires analyst review."
      : "";
    return `${label} composite signal from ${contributors}.${disagreement}`;
  }
  const evidence = successful
    .slice(0, 3)
    .map((source) => `${source.label}: ${source.detail}`)
    .join(" · ");
  return `${evidence}. Context-only and exposure sources are excluded from the risk blend.`;
}

function openIntelPivot(link: PivotLink): void {
  openExternalWorkspaceUrl(link.href);
}

function openExternalWorkspaceUrl(url: string): void {
  if (typeof chrome.tabs?.create === "function") {
    void chrome.tabs.create({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Malware-intelligence pivot sources, in the priority order used to pick a
 * default when "Search malware intelligence" is activated. Values are
 * EnrichmentSourceId literals so this stays valid without extra imports.
 */
const INVESTIGATION_MALWARE_INTEL_SOURCE_IDS: readonly EnrichmentSourceId[] = [
  "virustotal",
  "otx",
  "threatfox",
  "malwarebazaar",
  "urlhaus",
];

type InvestigationRelatedLine = { id: string; tone: "info" | "muted"; text: string };

type InvestigationSourceButton = {
  sourceId: EnrichmentSourceId;
  label: string;
  link: PivotLink;
  configured: boolean;
};

function InvestigationWorkflowRow({
  step,
  glyph,
  label,
  support,
  stateLabel,
  disabled,
  reason,
  onActivate,
}: {
  step: string;
  glyph: string;
  label: string;
  support?: string;
  stateLabel: string;
  disabled: boolean;
  reason?: string;
  onActivate?: () => void;
}) {
  const supportText =
    support && support !== label && support !== stateLabel ? support : undefined;
  return (
    <li className="vera5-ip-workflow-item">
      <button
        type="button"
        className="vera5-ip-action vera5-ip-workflow-row"
        data-vera5-disabled={disabled ? "true" : undefined}
        data-vera5-workflow-step={step}
        disabled={disabled}
        onClick={disabled ? undefined : onActivate}
        title={disabled ? reason : undefined}
        aria-label={disabled && reason ? `${label} — ${reason}` : label}
      >
        <span className="vera5-ip-workflow-rail" aria-hidden="true" />
        <span className="vera5-ip-workflow-index" aria-hidden="true">
          {step}
        </span>
        <span className="vera5-ip-action-icon" aria-hidden="true">
          <InvestigationGlyph name={glyph} />
        </span>
        <span className="vera5-ip-workflow-copy">
          <span className="vera5-ip-action-label">{label}</span>
          {supportText ? (
            <span className="vera5-ip-workflow-support">{supportText}</span>
          ) : null}
        </span>
        <span className="vera5-ip-workflow-state">{stateLabel}</span>
        <span className="vera5-ip-workflow-affordance" aria-hidden="true">
          <InvestigationGlyph name="chevron" />
        </span>
      </button>
    </li>
  );
}

function InvestigationConditionalRow({
  channel,
}: {
  channel: ConditionalIntelligenceChannel;
}) {
  const bodyId = `vera5-ci-body-${channel.id}`;
  const findingCount = channel.findings.length;
  const statusText =
    findingCount > 0
      ? `${findingCount} finding${findingCount === 1 ? "" : "s"}`
      : channel.stateLabel;
  const interactive = channel.isExpandable;

  const rowInner = (
    <>
      <span className="vera5-ip-cond-icon" aria-hidden="true">
        <InvestigationGlyph name={channel.glyph} />
      </span>
      <span className="vera5-ip-cond-copy">
        <span className="vera5-ip-cond-label">{channel.label}</span>
        <span className="vera5-ip-cond-desc">{channel.description}</span>
      </span>
      <span className="vera5-ip-cond-status">{statusText}</span>
      {interactive ? (
        <span className="vera5-ip-cond-chevron" aria-hidden="true">
          <InvestigationGlyph name="chevron" />
        </span>
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <div
        className="vera5-ip-cond-row"
        data-vera5-channel={channel.id}
        data-vera5-channel-state={channel.state}
        data-vera5-available="false"
      >
        {rowInner}
      </div>
    );
  }

  return (
    <details
      className="vera5-ip-cond-row vera5-ip-cond-row--interactive"
      data-vera5-channel={channel.id}
      data-vera5-channel-state={channel.state}
      data-vera5-available="true"
    >
      <summary aria-controls={bodyId}>
        {rowInner}
      </summary>
      <div className="vera5-ip-cond-body" id={bodyId}>
        {channel.detailNote ? (
          <p className="vera5-ip-cond-note">{channel.detailNote}</p>
        ) : null}
        {channel.error ? <p className="vera5-ip-cond-note">{channel.error}</p> : null}
        {channel.findings.length > 0 ? (
          <ul className="vera5-ip-cond-findings">
            {channel.findings.map((finding) => (
              <li key={finding.id} className="vera5-ip-cond-finding">
                <strong className="vera5-ip-cond-finding-title">{finding.title}</strong>
                {finding.primaryValue ? (
                  <span className="vera5-ip-cond-finding-value">{finding.primaryValue}</span>
                ) : null}
                {finding.sourceAttribution ? (
                  <span className="vera5-ip-cond-finding-source">{finding.sourceAttribution}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

/**
 * INVESTIGATION PATHS — the single lower-right analyst module. It reads the
 * shared selected-IOC state, reuses the existing pivot/research utilities, the
 * Show-on-page handler, vendor-enablement availability, and derives Related
 * Context strictly from real local data. It never triggers enrichment.
 */
function InvestigationPaths({
  entry,
  loading: _loading,
  availability,
  pageIndicatorCount,
  priorSightingCount,
  suppressed,
  scanPresentation,
  onReviewDetections,
}: {
  entry: TabScanSummaryEntry | null;
  loading: boolean;
  availability: IntelSourceAvailabilityRecord;
  pageIndicatorCount: number;
  priorSightingCount: number;
  suppressed: boolean;
  scanPresentation: ReturnType<typeof resolveScanPresentation>;
  onReviewDetections: () => void;
}) {
  const [collectionMembership, setCollectionMembership] = useState<number | null>(null);
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [recommendedPathExpanded, setRecommendedPathExpanded] = useState(false);
  const [sandboxFeedback, setSandboxFeedback] = useState<string | null>(null);
  const selectionCopy = resolveInvestigationPathsSelectionCopy({
    scan: scanPresentation,
    hasSelection: Boolean(entry),
  });
  const sandboxDestinations = useMemo(
    () => listSandboxDestinationResolutions(entry?.type ?? null, entry?.value ?? null),
    [entry?.type, entry?.value]
  );
  const conditionalConsole = useMemo(
    () =>
      resolveConditionalIntelligenceChannels({
        iocType: entry?.type ?? null,
        iocValue: entry?.value ?? null,
      }),
    [entry?.type, entry?.value]
  );

  useEffect(() => {
    setSandboxFeedback(null);
  }, [entry?.anchorId, entry?.value]);

  const handleSandboxActivate = (destination: SandboxDestinationResolution) => {
    if (destination.kind === "unsupported" || !destination.href) {
      return;
    }
    if (destination.kind === "copy_and_open" && destination.clipboardText) {
      void copyTextToClipboard(destination.clipboardText).then((copied) => {
        setSandboxFeedback(
          copied
            ? destination.feedback
            : "Could not copy indicator. Opened sandbox landing page."
        );
        openExternalWorkspaceUrl(destination.href!);
      });
      return;
    }
    setSandboxFeedback(null);
    openExternalWorkspaceUrl(destination.href);
  };

  useEffect(() => {
    if (!entry) {
      setCollectionMembership(null);
      return;
    }
    let cancelled = false;
    const key = buildIocCollectionMemberDedupeKey({ iocType: entry.type, value: entry.value });
    void requestListIocCollections()
      .then((list) => {
        if (cancelled) {
          return;
        }
        const count = list.filter((collection) =>
          collection.members.some((member) => buildIocCollectionMemberDedupeKey(member) === key)
        ).length;
        setCollectionMembership(count);
      })
      .catch(() => {
        if (!cancelled) {
          setCollectionMembership(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const sourceButtons = useMemo<InvestigationSourceButton[]>(() => {
    if (!entry) {
      return [];
    }
    const pivotByProvider = new Map(
      getPivotLinks(entry.type, entry.value, { showDisabledSources: true }).map((link) => [
        link.provider,
        link,
      ])
    );
    return ENRICHMENT_SOURCE_ORDER.reduce<InvestigationSourceButton[]>((acc, sourceId) => {
      const avail = availability[sourceId];
      if (!avail?.enabled) {
        return acc;
      }
      const link = pivotByProvider.get(sourceId);
      if (!link) {
        return acc;
      }
      acc.push({ sourceId, label: link.label, link, configured: avail.configured !== false });
      return acc;
    }, []);
  }, [entry, availability]);

  const malwareIntelActionable = useMemo(
    () =>
      sourceButtons.filter(
        (source) =>
          source.configured && INVESTIGATION_MALWARE_INTEL_SOURCE_IDS.includes(source.sourceId)
      ),
    [sourceButtons]
  );

  const relatedLines = useMemo<InvestigationRelatedLine[]>(() => {
    if (!entry) {
      return [];
    }
    const lines: InvestigationRelatedLine[] = [];
    const additionalOnPage = Math.max(pageIndicatorCount - 1, 0);
    if (additionalOnPage > 0) {
      lines.push({
        id: "cooccurrence",
        tone: "info",
        text: `Appears with ${additionalOnPage} other indicator${
          additionalOnPage === 1 ? "" : "s"
        } on this page`,
      });
    }
    if (priorSightingCount > 0) {
      lines.push({
        id: "sightings",
        tone: "info",
        text: `Previously enriched ${priorSightingCount} time${
          priorSightingCount === 1 ? "" : "s"
        } locally`,
      });
    }
    if (collectionMembership && collectionMembership > 0) {
      lines.push({
        id: "collections",
        tone: "info",
        text: `Member of ${collectionMembership} collection${
          collectionMembership === 1 ? "" : "s"
        }`,
      });
    }
    if (suppressed) {
      lines.push({
        id: "suppressed",
        tone: "muted",
        text: "Suppressed by a noise rule on this page",
      });
    }
    // Structured relationship analysis does not exist in the data model yet.
    // Report unavailable only when no factual lines exist — never a confirmed negative.
    if (lines.length === 0) {
      lines.push({
        id: "infra",
        tone: "muted",
        text: WORKSPACE_STATE_COPY.related.unavailable,
      });
    }
    return lines.slice(0, 3);
  }, [entry, pageIndicatorCount, priorSightingCount, collectionMembership, suppressed]);

  const malwareDisabled = !entry || malwareIntelActionable.length === 0;
  const malwareReason = !entry
    ? selectionCopy.actionDisabledReason
    : "No enabled malware-intelligence source for this indicator";
  const reviewDisabled = !entry;
  const infraReason = entry
    ? WORKSPACE_STATE_COPY.related.unavailable
    : selectionCopy.actionDisabledReason;
  const campaignReason = entry
    ? "Campaign context unavailable"
    : selectionCopy.actionDisabledReason;

  return (
    <section
      className="vera5-investigation-paths vera5-section-frame"
      aria-label="Investigation paths"
      data-ioc-type={entry?.type}
      data-vera5-section-expanded={sectionExpanded ? "true" : "false"}
    >
      <header className="vera5-section-header vera5-ip-header">
        <div className="vera5-section-identity">
          <h2 className="vera5-section-title vera5-ip-title" id="vera5-investigation-paths-title">
            <span className="vera5-section-icon" aria-hidden="true">
              <VeraIcon icon={VeraUiIcons.investigationSection} size="sm" />
            </span>
            Investigation Paths
          </h2>
        </div>
        <button
          type="button"
          className="vera5-section-utilities vera5-section-collapse"
          aria-expanded={sectionExpanded}
          aria-controls="vera5-investigation-paths-body"
          aria-label={
            sectionExpanded ? "Collapse Investigation Paths" : "Expand Investigation Paths"
          }
          onClick={() => setSectionExpanded((open) => !open)}
        >
          <VeraIcon
            icon={sectionExpanded ? VeraUiIcons.chevron : VeraUiIcons.chevronRight}
            size="xs"
          />
        </button>
      </header>
      {sectionExpanded ? (
        <>
          <hr className="vera5-section-divider" aria-hidden="true" />
          <div className="vera5-ip-scroll" id="vera5-investigation-paths-body">
            <section
              className="vera5-ip-group vera5-ip-group--open vera5-ip-group--conditional"
              aria-label="Conditional intelligence"
            >
              <div className="vera5-ip-group-heading">
                <div className="vera5-ip-group-label">Conditional Intelligence</div>
                {conditionalConsole.headerSummary ? (
                  <span className="vera5-ip-group-summary">{conditionalConsole.headerSummary}</span>
                ) : null}
              </div>
              <div
                className="vera5-ip-conditional vera5-ip-conditional--console"
                role="list"
                aria-label="Intelligence channels"
              >
                {conditionalConsole.channels.map((channel) => (
                  <InvestigationConditionalRow key={channel.id} channel={channel} />
                ))}
              </div>
            </section>

            <section className="vera5-ip-group vera5-ip-group--open vera5-ip-group--related" aria-label="Related context">
              <div className="vera5-ip-group-label">Related Context</div>
              {!entry ? (
                <p className="vera5-ip-empty">{selectionCopy.contextPlaceholder}</p>
              ) : (
                <ul className="vera5-ip-context">
                  {relatedLines.map((line) => (
                    <li key={line.id} className="vera5-ip-context-line" data-vera5-tone={line.tone}>
                      <span className="vera5-ip-context-rail" aria-hidden="true" />
                      <span className="vera5-ip-context-dot" aria-hidden="true">
                        <InvestigationGlyph name="dot" />
                      </span>
                      <span className="vera5-ip-context-text">{line.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="vera5-ip-group vera5-ip-group--open vera5-ip-group--sandbox"
              aria-label="Sandbox analysis"
            >
              <div className="vera5-ip-group-heading">
                <div className="vera5-ip-group-label">Sandbox Analysis</div>
                <span className="vera5-ip-group-summary">External</span>
              </div>
              <div className="vera5-ip-sandbox-target" aria-label="Analysis target">
                <span className="vera5-ip-sandbox-target-label">Analysis target</span>
                {entry ? (
                  <div className="vera5-ip-sandbox-target-value" data-ioc-type={entry.type}>
                    <span className="vera5-ioc-type-badge" aria-hidden="true">
                      {IOC_TYPE_TRAY_LABEL[entry.type]}
                    </span>
                    <span className="vera5-ip-sandbox-target-type">{IOC_TYPE_TRAY_LABEL[entry.type]}</span>
                    <strong className="vera5-ip-sandbox-target-ioc">{entry.value}</strong>
                  </div>
                ) : (
                  <p className="vera5-ip-sandbox-guidance">{SANDBOX_NO_SELECTION_GUIDANCE}</p>
                )}
              </div>
              <div
                className="vera5-ip-sandbox-privacy"
                role="note"
                aria-label={SANDBOX_PUBLIC_SUBMISSION_NOTICE_LABEL}
              >
                <span className="vera5-ip-sandbox-privacy-rail" aria-hidden="true" />
                <span className="vera5-ip-sandbox-privacy-icon" aria-hidden="true">
                  <VeraIcon icon={VeraUiIcons.warning} size="xs" />
                </span>
                <div className="vera5-ip-sandbox-privacy-copy">
                  <span className="vera5-ip-sandbox-privacy-title">
                    {SANDBOX_PUBLIC_SUBMISSION_NOTICE_LABEL}
                  </span>
                  <p className="vera5-ip-sandbox-privacy-text">{SANDBOX_PUBLIC_SUBMISSION_WARNING}</p>
                </div>
              </div>
              <div
                className="vera5-ip-sandbox-console"
                role="group"
                aria-label="Sandbox launch console"
              >
                <div className="vera5-ip-sandbox-console-label">Sandbox launch console</div>
                {sandboxDestinations.map((destination) => {
                  const disabled = destination.kind === "unsupported";
                  return (
                    <button
                      key={destination.sandboxId}
                      type="button"
                      className="vera5-ip-sandbox-destination vera5-ip-sandbox-row"
                      data-vera5-sandbox={destination.sandboxId}
                      data-vera5-sandbox-state={destination.availabilityLabel.toLowerCase()}
                      disabled={disabled}
                      title={destination.disabledReason ?? undefined}
                      aria-label={destination.ariaLabel}
                      onClick={() => handleSandboxActivate(destination)}
                    >
                      <span className="vera5-ip-sandbox-row-rail" aria-hidden="true" />
                      <span className="vera5-ip-sandbox-row-index" aria-hidden="true">
                        {destination.indexLabel}
                      </span>
                      <span className="vera5-ip-sandbox-row-icon" aria-hidden="true">
                        <InvestigationGlyph name="sandbox" />
                      </span>
                      <span className="vera5-ip-sandbox-row-copy">
                        <span className="vera5-ip-sandbox-destination-label">
                          {destination.displayName}
                        </span>
                        <span className="vera5-ip-sandbox-row-desc">
                          {destination.actionDescription}
                        </span>
                      </span>
                      <span className="vera5-ip-sandbox-row-state">
                        {destination.availabilityLabel}
                      </span>
                      {!disabled ? (
                        <span className="vera5-ip-sandbox-destination-external" aria-hidden="true">
                          <VeraIcon icon={VeraUiIcons.external} size="xs" />
                        </span>
                      ) : (
                        <span className="vera5-ip-sandbox-destination-external vera5-ip-sandbox-destination-external--muted" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
              {sandboxFeedback ? (
                <p className="vera5-ip-sandbox-feedback" aria-live="polite">
                  {sandboxFeedback}
                </p>
              ) : null}
            </section>

            <section
              className="vera5-ip-group vera5-ip-group--open vera5-ip-group--recommended"
              aria-label="Recommended path"
            >
              <button
                type="button"
                className="vera5-ip-disclosure-header"
                aria-expanded={recommendedPathExpanded}
                aria-controls="vera5-recommended-path-body"
                onClick={() => setRecommendedPathExpanded((open) => !open)}
              >
                <span className="vera5-ip-group-label">Recommended Path</span>
                <span className="vera5-ip-disclosure-icon" aria-hidden="true">
                  <VeraIcon
                    icon={recommendedPathExpanded ? VeraUiIcons.minus : VeraUiIcons.plus}
                    size="xs"
                  />
                </span>
              </button>
              {recommendedPathExpanded ? (
                <ol className="vera5-ip-workflow" id="vera5-recommended-path-body">
                  <InvestigationWorkflowRow
                    step="01"
                    glyph="malware"
                    label="Search malware intelligence"
                    support={
                      malwareDisabled
                        ? undefined
                        : "Opens attributed malware research pivots"
                    }
                    stateLabel={malwareDisabled ? "Unavailable" : "External"}
                    disabled={malwareDisabled}
                    reason={malwareReason}
                    onActivate={() => {
                      if (malwareIntelActionable[0]) {
                        openIntelPivot(malwareIntelActionable[0].link);
                      }
                    }}
                  />
                  <InvestigationWorkflowRow
                    step="02"
                    glyph="detections"
                    label="Review detections"
                    support={
                      reviewDisabled ? undefined : "Locate this IOC among page detections"
                    }
                    stateLabel={reviewDisabled ? "Unavailable" : "Page action"}
                    disabled={reviewDisabled}
                    reason={selectionCopy.actionDisabledReason}
                    onActivate={onReviewDetections}
                  />
                  <InvestigationWorkflowRow
                    step="03"
                    glyph="infra"
                    label="Find related infrastructure"
                    stateLabel="Unavailable"
                    disabled
                    reason={infraReason}
                  />
                  <InvestigationWorkflowRow
                    step="04"
                    glyph="campaign"
                    label="Check campaign associations"
                    stateLabel="Unavailable"
                    disabled
                    reason={campaignReason}
                  />
                </ol>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}

function IntelFeedPanel({
  entry,
  loading,
  sourceEntries,
  availability,
  scanPresentation,
  detectedCount,
  onEnrich,
  note,
  noteStatus,
  onNoteChange,
  filteredEntries,
  collectionsMenuOpen,
  onCollectionsMenuOpenChange,
  addFilteredToCollectionOpen,
  onAddFilteredToCollectionToggle,
  addFilteredToCollectionFeedback,
  onAddFilteredToCollectionFeedback,
  runMacroOnFilteredOpen,
  onRunMacroOnFilteredToggle,
  runMacroOnFilteredFeedback,
  onRunMacroOnFilteredFeedback,
  canResetWorkspace,
  onResetWorkspace,
}: {
  entry: TabScanSummaryEntry | null;
  loading: boolean;
  sourceEntries: readonly HoverCardSourceEntry[];
  availability: IntelSourceAvailabilityRecord;
  scanPresentation: ReturnType<typeof resolveScanPresentation>;
  detectedCount: number;
  onEnrich: () => void;
  note: string;
  noteStatus: AnalystNoteSaveStatus;
  onNoteChange: (value: string) => void;
  filteredEntries: readonly TabScanSummaryEntry[];
  collectionsMenuOpen: boolean;
  onCollectionsMenuOpenChange: (open: boolean) => void;
  addFilteredToCollectionOpen: boolean;
  onAddFilteredToCollectionToggle: () => void;
  addFilteredToCollectionFeedback: string | null;
  onAddFilteredToCollectionFeedback: (message: string | null) => void;
  runMacroOnFilteredOpen: boolean;
  onRunMacroOnFilteredToggle: () => void;
  runMacroOnFilteredFeedback: string | null;
  onRunMacroOnFilteredFeedback: (message: string | null) => void;
  canResetWorkspace: boolean;
  onResetWorkspace: () => void;
}) {
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [moreFormatsOpen, setMoreFormatsOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [selectedCopyFeedback, setSelectedCopyFeedback] = useState<string | null>(null);
  const exportOverlayRef = useRef<HTMLDivElement | null>(null);
  const collectionsOverlayRef = useRef<HTMLDivElement | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const collectionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOpenInfoId(null);
    setMoreFormatsOpen(false);
    onCollectionsMenuOpenChange(false);
    setExportMessage(null);
    setSelectedCopyFeedback(null);
  }, [entry?.value, onCollectionsMenuOpenChange]);

  useEffect(() => {
    if (!moreFormatsOpen && !collectionsMenuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreFormatsOpen) {
        if (
          exportOverlayRef.current?.contains(target) ||
          exportTriggerRef.current?.contains(target)
        ) {
          return;
        }
        setMoreFormatsOpen(false);
      }
      if (collectionsMenuOpen) {
        if (
          collectionsOverlayRef.current?.contains(target) ||
          collectionsTriggerRef.current?.contains(target)
        ) {
          return;
        }
        onCollectionsMenuOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (moreFormatsOpen) {
        setMoreFormatsOpen(false);
        exportTriggerRef.current?.focus();
        return;
      }
      if (collectionsMenuOpen) {
        onCollectionsMenuOpenChange(false);
        collectionsTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreFormatsOpen, collectionsMenuOpen, onCollectionsMenuOpenChange]);

  const toggleExportMenu = () => {
    if (moreFormatsOpen) {
      setMoreFormatsOpen(false);
      return;
    }
    onCollectionsMenuOpenChange(false);
    setMoreFormatsOpen(true);
  };

  const toggleCollectionsMenu = () => {
    if (collectionsMenuOpen) {
      onCollectionsMenuOpenChange(false);
      return;
    }
    setMoreFormatsOpen(false);
    onCollectionsMenuOpenChange(true);
  };

  const closeExportAfterAction = () => {
    setMoreFormatsOpen(false);
  };

  if (!entry) {
    const unselected = resolveIntelFeedUnselectedCopy({
      scan: scanPresentation,
      detectedCount,
    });
    return (
      <section className="vera5-intel-feed-section" aria-label="Intel feed">
        <div className="vera5-intel-feed vera5-intel-feed--empty vera5-section-frame">
          <header className="vera5-section-header vera5-intel-feed-header">
            <div className="vera5-section-identity">
              <h2 className="vera5-section-title vera5-intel-feed-heading">
                <span className="vera5-section-icon" aria-hidden="true">
                  <VeraIcon icon={VeraUiIcons.intelSection} size="sm" />
                </span>
                Intel Feed
              </h2>
              <p className="vera5-section-subtitle vera5-intel-feed-subheading">
                Real-time intelligence, scoring, and vendor evidence.
              </p>
            </div>
            <div className="vera5-section-utilities vera5-intel-feed-title-row">
              <button
                type="button"
                className="vera5-intel-info-button vera5-intel-reset-button"
                aria-label="Reset current workspace"
                title="Reset current workspace"
                disabled={!canResetWorkspace}
                onClick={onResetWorkspace}
              >
                <VeraIcon icon={VeraUiIcons.reset} size="xs" />
              </button>
              <button
                type="button"
                className="vera5-intel-info-button"
                aria-label="View composite score details"
                disabled
              >
                <VeraIcon icon={VeraUiIcons.info} size="xs" />
              </button>
            </div>
          </header>
          <hr className="vera5-section-divider" aria-hidden="true" />
          <div
            className="vera5-intel-feed-body--empty"
            data-vera5-scan-presentation={scanPresentation}
            aria-live="polite"
          >
            <div className="vera5-intel-empty-copy">
              <p>{unselected.primary}</p>
              {unselected.secondary ? <p>{unselected.secondary}</p> : null}
            </div>
            <div className="vera5-intel-empty-actions" aria-label="Unavailable intelligence exports">
              <button type="button" disabled>
                <VeraIcon icon={VeraUiIcons.copy} size="xs" />
                Copy Summary
              </button>
              <button type="button" disabled>
                <VeraIcon icon={VeraUiIcons.copy} size="xs" />
                Copy IOC
              </button>
              <button type="button" disabled>
                <VeraIcon icon={VeraUiIcons.exportMarkdown} size="xs" />
                Export [Multi-Format]
              </button>
              <button type="button" disabled>
                <VeraIcon icon={VeraUiIcons.collections} size="xs" />
                {POPUP_TRAY_CASE_TOOLS_SUMMARY}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const sourceEntryById = new Map(
    sourceEntries.map((source): [EnrichmentSourceId, HoverCardSourceEntry] => [
      source.sourceId,
      source,
    ])
  );
  const applicableSourceIds = ENRICHMENT_SOURCE_ORDER.filter((sourceId) => {
    const definition = getEnrichmentSourceDefinition(sourceId);
    if (!definition.liveConnector) {
      return false;
    }
    if (!liveEnrichmentSupportsIocType(sourceId, entry.type)) {
      return false;
    }
    return availability[sourceId]?.enabled === true;
  });
  const orderedSourceIds = orderIntelFeedVendorSourceIds(
    applicableSourceIds,
    sourceEntryById,
    availability
  );
  const riskView = buildHoverCardRiskScoreView(
    sourceEntries.filter((source) => applicableSourceIds.includes(source.sourceId))
  );
  const pivotLinks = getPivotLinks(entry.type, entry.value, {
    showDisabledSources: true,
  });
  const hasDirectEnrichmentSources = applicableSourceIds.length > 0;
  const enrichDisabled = loading || !hasDirectEnrichmentSources;
  const enrichDisabledReason = !hasDirectEnrichmentSources
    ? "No applicable enrichment sources are enabled"
    : undefined;
  const researchDisabled = pivotLinks.length === 0;
  const pivotBySourceId = new Map(
    pivotLinks.map((link): [EnrichmentSourceId, PivotLink] => [link.provider, link])
  );
  const compositeScore =
    riskView.score.compositeSignal === null ? null : Math.round(riskView.score.compositeSignal);
  const enrichmentPresentation = resolveEnrichmentPresentation({
    hasSelection: true,
    loading,
    applicableSourceIds,
    sourceEntryById,
    availability,
  });
  const compositePresentation = resolveCompositeScorePresentation({
    compositeScore,
    enrichment: enrichmentPresentation,
  });
  const enrichmentStatusLine = resolveEnrichmentStatusLine(enrichmentPresentation);
  const compositeScoreBand = compositePresentation.scoreBand;
  const compositeVerdict = compositePresentation.verdict;
  const sourceDisagreement = riskView.score.disagreement;
  const successfulSources = sourceEntries.filter((source) => source.status === "ok");
  const intelligenceAvailable = successfulSources.length > 0;
  const disabledSourceIds = applicableSourceIds.filter(
    (sourceId) => availability[sourceId]?.enabled === false
  );
  const compositeUpdateLines = sourceEntries
    .map((source) => source.lastUpdatedLine)
    .filter((line): line is string => typeof line === "string" && line.length > 0);
  const buildIntelExportRecord = () =>
    buildNormalizedEnrichmentRecord({
      value: entry.value,
      iocType: entry.type,
      disabledSources: disabledSourceIds,
      sourceResults: sourceEntries,
      analystNotes: note,
    });
  const handleCopySummary = () => {
    void copyEnrichmentExportMarkdownToClipboard(buildIntelExportRecord()).then((copied) => {
      setExportMessage(copied ? "Copied intelligence summary." : "Could not copy summary.");
    });
  };
  const handleCopyIoc = () => {
    void copyTextToClipboard(entry.value).then((copied) => {
      setExportMessage(copied ? "Copied IOC." : "Could not copy IOC.");
    });
  };
  const handleCopySelectedIoc = () => {
    void copyTextToClipboard(entry.value).then((copied) => {
      setSelectedCopyFeedback(copied ? "Copied selected IOC." : "Could not copy IOC.");
    });
  };
  const handleDownloadExport = (format: EnrichmentExportFileFormat) => {
    downloadEnrichmentExportFile(buildIntelExportRecord(), format, document);
    setExportMessage(
      format === "markdown"
        ? "Downloaded Markdown export."
        : format === "json"
          ? "Downloaded JSON export."
          : "Downloaded TXT export."
    );
    closeExportAfterAction();
  };
  const handleCopyFormat = (
    format: Exclude<EnrichmentExportFileFormat, "markdown">
  ) => {
    const record = buildIntelExportRecord();
    const copy =
      format === "json"
        ? copyEnrichmentExportJsonToClipboard(record)
        : copyEnrichmentExportTxtToClipboard(record);
    void copy.then((copied) => {
      setExportMessage(
        copied
          ? `Copied ${format.toUpperCase()} export.`
          : `Could not copy ${format.toUpperCase()} export.`
      );
      closeExportAfterAction();
    });
  };
  const handleCopyTemplate = (templateId: ExportTemplateId) => {
    void copyTrayTemplateExportToClipboard(templateId, [buildIntelExportRecord()]).then(
      (copied) => {
        setExportMessage(
          copied
            ? `Copied ${getExportTemplateLabel(templateId)}.`
            : `Could not copy ${getExportTemplateLabel(templateId)}.`
        );
        closeExportAfterAction();
      }
    );
  };
  const handleDownloadTemplate = (templateId: ExportTemplateId) => {
    downloadTrayTemplateExportFile(templateId, [buildIntelExportRecord()], document);
    setExportMessage(`Downloaded ${getExportTemplateLabel(templateId)}.`);
    closeExportAfterAction();
  };
  const compositeDetailsOpen = openInfoId === "composite";

  return (
    <section className="vera5-intel-feed-section" aria-label="Intel feed">
      <div className="vera5-intel-feed vera5-section-frame" data-vera5-intel-value={entry.value}>
        <header className="vera5-section-header vera5-intel-feed-header">
          <div className="vera5-section-identity">
            <h2 className="vera5-section-title vera5-intel-feed-heading">
              <span className="vera5-section-icon" aria-hidden="true">
                <VeraIcon icon={VeraUiIcons.intelSection} size="sm" />
              </span>
              Intel Feed
            </h2>
            <p className="vera5-section-subtitle vera5-intel-feed-subheading">
              Real-time intelligence, scoring, and vendor evidence.
            </p>
          </div>
          <div className="vera5-section-utilities vera5-intel-feed-title-row">
            <button
              type="button"
              className="vera5-intel-info-button vera5-intel-reset-button"
              aria-label="Reset current workspace"
              title="Reset current workspace"
              disabled={!canResetWorkspace}
              onClick={onResetWorkspace}
            >
              <VeraIcon icon={VeraUiIcons.reset} size="xs" />
            </button>
            {sourceDisagreement ? (
              <span
                className="vera5-intel-warning"
                role="img"
                aria-label="Source disagreement requires analyst review"
                title="Source disagreement requires analyst review"
              >
                <VeraIcon icon={VeraUiIcons.warning} size="sm" />
              </span>
            ) : null}
            <button
              type="button"
              className="vera5-intel-info-button"
              aria-label="View composite score details"
              aria-expanded={compositeDetailsOpen}
              aria-controls="vera5-intel-composite-details"
              onClick={() => setOpenInfoId(compositeDetailsOpen ? null : "composite")}
            >
              <VeraIcon icon={VeraUiIcons.info} size="xs" />
            </button>
            <div
              id="vera5-intel-composite-details"
              className="vera5-intel-info-surface vera5-intel-composite-details"
              role="dialog"
              aria-label="Composite score details"
              hidden={!compositeDetailsOpen}
            >
              <strong>Composite assessment</strong>
              <p>
                {loading
                  ? "Refreshing vendor intelligence…"
                  : buildGroundedIntelSummary(sourceEntries)}
              </p>
              <dl>
                <div>
                  <dt>Score classification</dt>
                  <dd>{compositeVerdict}</dd>
                </div>
                <div>
                  <dt>Contributing vendors</dt>
                  <dd>
                    {successfulSources.length > 0
                      ? successfulSources.map((source) => source.label).join(", ")
                      : "No contributing vendor results"}
                  </dd>
                </div>
              </dl>
              {riskView.chain.sourceLines.length > 0 ? (
                <ul>
                  {riskView.chain.sourceLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {compositeUpdateLines.length > 0 ? (
                <p>{compositeUpdateLines.join(" · ")}</p>
              ) : null}
            </div>
          </div>
        </header>
        <hr className="vera5-section-divider" aria-hidden="true" />
        <div className="vera5-intel-feed-summary-row">
          <div className="vera5-intel-feed-command" data-ioc-type={entry.type}>
            <div className="vera5-intel-feed-command-top">
              <div className="vera5-intel-feed-identity">
                <span
                  className="vera5-ioc-type-badge"
                  aria-hidden="true"
                >
                  {IOC_TYPE_TRAY_LABEL[entry.type]}
                </span>
                <div className="vera5-intel-feed-identity-text">
                  <span className="vera5-intel-feed-type">{IOC_TYPE_TRAY_LABEL[entry.type]}</span>
                  <strong title={entry.value}>{entry.value}</strong>
                </div>
              </div>
              <button
                type="button"
                className="vera5-intel-selected-copy"
                aria-label={`Copy selected ${IOC_TYPE_TRAY_LABEL[entry.type]}`}
                title={`Copy selected ${IOC_TYPE_TRAY_LABEL[entry.type]}`}
                onClick={handleCopySelectedIoc}
              >
                <VeraIcon icon={VeraUiIcons.copy} size="xs" />
                <span className="vera5-intel-selected-copy-label">Copy</span>
              </button>
            </div>
            <span aria-live="polite" className="vera5-intel-selected-copy-feedback">
              {selectedCopyFeedback ?? ""}
            </span>
            <details className="vera5-intel-analyst-note" key={entry.value}>
              <summary>+ Add analyst note</summary>
              <label>
                <span>{HOVER_CARD_ANALYST_NOTES_LABEL}</span>
                <textarea
                  value={note}
                  rows={3}
                  placeholder={HOVER_CARD_ANALYST_NOTES_PLACEHOLDER}
                  aria-label={`${HOVER_CARD_ANALYST_NOTES_LABEL} for ${entry.value}`}
                  data-vera5-analyst-note="true"
                  onChange={(event) => onNoteChange(event.currentTarget.value)}
                />
              </label>
              <small aria-live="polite">
                {noteStatus === "saving"
                  ? "Saving…"
                  : noteStatus === "saved"
                    ? "Saved locally"
                    : "Stored locally"}
              </small>
            </details>
          </div>

          <div
            className="vera5-intel-feed-score"
            data-vera5-risk-label={riskView.score.label}
            data-vera5-score-band={compositeScoreBand}
            data-vera5-composite-state={compositePresentation.kind}
            data-vera5-enrichment-state={enrichmentPresentation}
            aria-label={compositePresentation.ariaLabel}
            aria-busy={loading || undefined}
          >
            <span>VERA5 SCORE</span>
            <div
              className="vera5-intel-score-meter"
              aria-hidden="true"
              style={
                {
                  "--vera5-score-angle":
                    compositePresentation.meterValue === null
                      ? "0deg"
                      : `${compositePresentation.meterValue * 1.8}deg`,
                } as CSSProperties
              }
            >
              <span />
            </div>
            <strong>
              {compositePresentation.meterValue === null ? "—" : compositePresentation.meterValue}
              {compositePresentation.meterValue === null ? null : <span>/100</span>}
            </strong>
            <small>{compositeVerdict}</small>
            {enrichmentStatusLine ? (
              <p className="vera5-intel-enrichment-status" aria-live="polite">
                {enrichmentStatusLine}
              </p>
            ) : null}
          </div>

          <section className="vera5-intel-findings-card" aria-label="Actions and export">
            <h3>Actions &amp; Export</h3>
            <div className="vera5-intel-export-actions vera5-intel-export-actions--deck">
              <button
                type="button"
                className="vera5-export-action vera5-intel-feed-enrich vera5-export-action--enrich"
                data-vera5-action="enrich"
                onClick={onEnrich}
                disabled={enrichDisabled}
                title={enrichDisabledReason}
                aria-label={
                  enrichDisabledReason ? `Enrich — ${enrichDisabledReason}` : "Enrich"
                }
              >
                <VeraIcon icon={VeraUiIcons.enrich} size="xs" />
                {loading ? "Enriching…" : "Enrich"}
              </button>
              <details
                className="vera5-intel-feed-pivots vera5-export-action vera5-export-action--research"
                data-vera5-action="research"
              >
                <summary
                  aria-disabled={researchDisabled || undefined}
                  className={researchDisabled ? "vera5-export-action--disabled-summary" : undefined}
                >
                  <span className="vera5-intel-pivot-mark" aria-hidden="true">
                    <VeraIcon icon={VeraUiIcons.research} size="xs" />
                  </span>
                  <span className="vera5-intel-pivot-label">Research</span>
                </summary>
                {!researchDisabled ? (
                  <div role="group" aria-label={`Pivot ${entry.value} to an intelligence source`}>
                    {pivotLinks.map((link) => (
                      <button key={link.provider} type="button" onClick={() => openIntelPivot(link)}>
                        {link.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </details>
              <button
                type="button"
                className="vera5-export-action vera5-export-action--copy"
                data-vera5-action="copy"
                onClick={handleCopySummary}
                disabled={!intelligenceAvailable}
              >
                <VeraIcon icon={VeraUiIcons.copy} size="xs" />
                Copy Summary
              </button>
              <button
                type="button"
                className="vera5-export-action vera5-export-action--copy"
                data-vera5-action="copy"
                onClick={handleCopyIoc}
              >
                <VeraIcon icon={VeraUiIcons.copy} size="xs" />
                Copy IOC
              </button>
              <button
                type="button"
                ref={exportTriggerRef}
                className="vera5-export-action vera5-export-action--more vera5-export-action--export"
                data-vera5-action="export"
                aria-haspopup="menu"
                aria-expanded={moreFormatsOpen}
                aria-controls="vera5-intel-more-formats"
                onClick={toggleExportMenu}
                disabled={!intelligenceAvailable}
              >
                <VeraIcon icon={VeraUiIcons.exportMarkdown} size="xs" />
                Export [Multi-Format]
              </button>
              <button
                type="button"
                ref={collectionsTriggerRef}
                className="vera5-export-action vera5-export-action--collections"
                data-vera5-action="collections"
                aria-haspopup="menu"
                aria-expanded={collectionsMenuOpen}
                aria-controls="vera5-intel-collections-menu"
                onClick={toggleCollectionsMenu}
              >
                <VeraIcon icon={VeraUiIcons.collections} size="xs" />
                {POPUP_TRAY_CASE_TOOLS_SUMMARY}
              </button>
              <div
                ref={exportOverlayRef}
                id="vera5-intel-more-formats"
                className="vera5-intel-more-formats"
                role="menu"
                hidden={!moreFormatsOpen}
              >
              <span className="vera5-intel-more-format-heading" role="presentation">
                Case templates
              </span>
              {(
                [
                  "jira-comment",
                  "thehive-case-note",
                  "analyst-update",
                  "obsidian-note",
                ] as const
              ).flatMap((templateId) => {
                const label = getExportTemplateLabel(templateId);
                return [
                  <button
                    key={`copy-${templateId}`}
                    type="button"
                    role="menuitem"
                    onClick={() => handleCopyTemplate(templateId)}
                  >
                    Copy {label}
                  </button>,
                  <button
                    key={`download-${templateId}`}
                    type="button"
                    role="menuitem"
                    onClick={() => handleDownloadTemplate(templateId)}
                  >
                    Export {label}
                  </button>,
                ];
              })}
              <span className="vera5-intel-more-format-heading" role="presentation">
                Report formats
              </span>
              {(["markdown-report", "csv-row"] as const).flatMap((templateId) => {
                const label = getExportTemplateLabel(templateId);
                return [
                  <button
                    key={`copy-${templateId}`}
                    type="button"
                    role="menuitem"
                    onClick={() => handleCopyTemplate(templateId)}
                  >
                    Copy {label}
                  </button>,
                  <button
                    key={`download-${templateId}`}
                    type="button"
                    role="menuitem"
                    onClick={() => handleDownloadTemplate(templateId)}
                  >
                    Export {label}
                  </button>,
                ];
              })}
              <span className="vera5-intel-more-format-heading" role="presentation">
                Raw formats
              </span>
              <button type="button" role="menuitem" onClick={() => handleCopyFormat("txt")}>
                Copy TXT
              </button>
              <button type="button" role="menuitem" onClick={() => handleDownloadExport("txt")}>
                Export TXT
              </button>
              <button type="button" role="menuitem" onClick={() => handleCopyFormat("json")}>
                Copy JSON
              </button>
              <button type="button" role="menuitem" onClick={() => handleDownloadExport("json")}>
                Export JSON
              </button>
              </div>
              <div
                ref={collectionsOverlayRef}
                id="vera5-intel-collections-menu"
                className="vera5-intel-collections-menu"
                role="menu"
                hidden={!collectionsMenuOpen}
              >
                <AddFilteredToCollectionPanel
                  entries={filteredEntries}
                  open={addFilteredToCollectionOpen}
                  onToggle={() => {
                    onAddFilteredToCollectionFeedback(null);
                    onAddFilteredToCollectionToggle();
                  }}
                  feedback={addFilteredToCollectionFeedback}
                  onFeedback={(message) => {
                    onAddFilteredToCollectionFeedback(message);
                    if (message) {
                      onCollectionsMenuOpenChange(false);
                    }
                  }}
                />
                <RunMacroOnFilteredPanel
                  entries={filteredEntries}
                  open={runMacroOnFilteredOpen}
                  onToggle={() => {
                    onRunMacroOnFilteredFeedback(null);
                    onRunMacroOnFilteredToggle();
                  }}
                  feedback={runMacroOnFilteredFeedback}
                  onFeedback={(message) => {
                    onRunMacroOnFilteredFeedback(message);
                    if (message) {
                      onCollectionsMenuOpenChange(false);
                    }
                  }}
                />
              </div>
            </div>
            {exportMessage ? (
              <p className="vera5-intel-export-message" aria-live="polite">
                {exportMessage}
              </p>
            ) : null}
          </section>
        </div>

        <hr className="vera5-section-divider vera5-section-divider--content" aria-hidden="true" />

        <VendorEvidenceMatrix
          orderedSourceIds={orderedSourceIds}
          sourceEntryById={sourceEntryById}
          availability={availability}
          loading={loading}
          enrichment={enrichmentPresentation}
          openInfoId={openInfoId}
          onOpenInfoIdChange={setOpenInfoId}
          pivotBySourceId={pivotBySourceId}
          onOpenPivot={openIntelPivot}
          emptyStateMessage={
            !hasDirectEnrichmentSources
              ? "No applicable enrichment sources are enabled."
              : undefined
          }
          emptyStateSupport={
            !hasDirectEnrichmentSources
              ? "Configure Enrichment Sources in Settings or use Research for external pivots."
              : undefined
          }
        />
      </div>
    </section>
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
  page: VERA5_COLOR.bg,
  surface: VERA5_COLOR.surface,
  text: VERA5_COLOR.text,
  muted: VERA5_COLOR.textMuted,
  border: VERA5_COLOR.border,
  accent: VERA5_COLOR.accent,
  accentText: VERA5_COLOR.accentText,
  onAccent: VERA5_COLOR.onAccent,
  buttonBg: VERA5_COLOR.surfaceRaised,
  secondaryBg: VERA5_COLOR.surfaceSunken,
  error: VERA5_COLOR.dangerText,
  trayRowBg: VERA5_COLOR.surfaceSunken,
  filterActiveBg: VERA5_COLOR.accentActiveBg,
  success: VERA5_COLOR.successText,
};

/** Batch collection/macro controls — collapsed so filters stay primary. */
export const POPUP_TRAY_CASE_TOOLS_SUMMARY = "Collections & Macros";
/** Per-row Save/Run macro — collapsed so Why detected / Appeared stay primary. */
export const POPUP_TRAY_ROW_ACTIONS_SUMMARY = "Actions";

function trayDemotedDetailsSummaryStyle(): CSSProperties {
  return {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: POPUP_THEME.muted,
    listStylePosition: "outside",
  };
}

/** Header utility — amber 3D glass chip (How-To / Settings / Permissions). */
const headerGlassButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: "4px 10px",
  borderRadius: VERA5_RADIUS.sm,
  border: "1px solid rgba(255, 194, 77, 0.55)",
  backgroundImage:
    "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 42%, rgba(0,0,0,0.14) 100%), linear-gradient(135deg, #FFC24D, #FFB224)",
  backgroundColor: POPUP_THEME.accent,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.32), 0 1px 3px rgba(0,0,0,0.35), 0 2px 8px rgba(255, 178, 36, 0.18)",
  color: POPUP_THEME.onAccent,
  fontFamily: VERA5_FONT.sans,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "normal",
  textDecoration: "none",
  lineHeight: 1.2,
  cursor: "pointer",
  margin: 0,
  boxSizing: "border-box",
};

/** Primary action — amber gradient glass, square corners. */
const primaryButtonStyle = {
  width: "100%",
  padding: `${VERA5_SPACE.sm}px ${VERA5_SPACE.md}px`,
  borderRadius: VERA5_RADIUS.sm,
  border: "1px solid rgba(255, 194, 77, 0.55)",
  backgroundImage:
    "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.12) 100%), linear-gradient(135deg, #FFC24D, #FFB224)",
  backgroundColor: POPUP_THEME.accent,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px rgba(255, 178, 36, 0.18)",
  color: POPUP_THEME.onAccent,
  fontWeight: 700 as const,
  cursor: "pointer" as const,
  margin: 0,
  boxSizing: "border-box" as const,
};

/** Secondary / neutral action — surface fill, no accent. */
const buttonStyle = {
  width: "100%",
  padding: `${VERA5_SPACE.sm}px ${VERA5_SPACE.md}px`,
  borderRadius: VERA5_RADIUS.md,
  border: `1px solid ${POPUP_THEME.border}`,
  backgroundColor: POPUP_THEME.secondaryBg,
  color: POPUP_THEME.text,
  fontWeight: 600 as const,
  cursor: "pointer" as const,
  margin: 0,
  boxSizing: "border-box" as const,
};

const scanSecondaryActionsStyle = {
  display: "flex",
  gap: VERA5_SPACE.sm,
  minWidth: 0,
};

type SelectionActionState = {
  textSelectionAvailable: boolean;
  selectionEnrichAvailable: boolean;
};

const EMPTY_SELECTION_ACTION_STATE: SelectionActionState = {
  textSelectionAvailable: false,
  selectionEnrichAvailable: false,
};

function parseSelectionActionStateResponse(
  response: MessageResponse | undefined
): SelectionActionState {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return EMPTY_SELECTION_ACTION_STATE;
  }

  const payload = response.payload as Record<string, unknown>;
  return {
    textSelectionAvailable: payload.textSelectionAvailable === true,
    selectionEnrichAvailable: payload.selectionEnrichAvailable === true,
  };
}

async function requestSelectionActionStateForActiveTab(): Promise<SelectionActionState> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return EMPTY_SELECTION_ACTION_STATE;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return EMPTY_SELECTION_ACTION_STATE;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, getSelectionActionStateMessage())) as
      | MessageResponse
      | undefined;
    return parseSelectionActionStateResponse(response);
  } catch {
    return EMPTY_SELECTION_ACTION_STATE;
  }
}

function filterChipStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${active ? POPUP_THEME.filterActiveBg : POPUP_THEME.border}`,
    backgroundColor: active ? POPUP_THEME.filterActiveBg : POPUP_THEME.buttonBg,
    color: active ? POPUP_THEME.onAccent : POPUP_THEME.accentText,
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

export function pageContextBadgeStyle(options?: { isOverride?: boolean }): CSSProperties {
  const isOverride = options?.isOverride === true;
  return {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
    border: `1px solid ${isOverride ? POPUP_THEME.accentText : POPUP_THEME.border}`,
    backgroundColor: isOverride ? POPUP_THEME.buttonBg : POPUP_THEME.trayRowBg,
    color: POPUP_THEME.accentText,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  };
}

export function resolveActivePageContextBadgeLabel(
  pageContextType: PageContextType | null
): string {
  return PAGE_CONTEXT_TYPE_LABEL[normalizePageContextType(pageContextType)];
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



const POPUP_SIDE_PANEL_SPLIT_MIN_PX = 560;
/** Phase 12B — measured usable panel width modes (sync with tokens.css breakpoints). */
const WS_COMPACT_MAX_PX = 679;
const WS_EXPANDED_MIN_PX = 1050;
type WorkspaceWidthMode = "compact" | "standard" | "expanded";

export function resolveWorkspaceWidthMode(widthPx: number): WorkspaceWidthMode {
  if (widthPx <= WS_COMPACT_MAX_PX) {
    return "compact";
  }
  if (widthPx >= WS_EXPANDED_MIN_PX) {
    return "expanded";
  }
  return "standard";
}

const SELECTED_INTEL_ANCHOR_BY_TAB = new Map<number, string>();

function readExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

export function Popup() {
  const extensionVersion = useMemo(() => readExtensionVersion(), []);
  const [enabled, setEnabled] = useState(true);
  const [highlightEnabled, setHighlightEnabledState] = useState(true);
  const [onPagePopoutEnabled, setOnPagePopoutEnabledState] = useState(
    DEFAULT_ON_PAGE_POPOUT_ENABLED
  );
  const [onPagePopoutUnavailableOnPage, setOnPagePopoutUnavailableOnPage] = useState(false);
  const [quietModeActive, setQuietModeActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [scanSummary, setScanSummary] = useState<TabScanSummary | null>(null);
  const [activePageContextType, setActivePageContextType] = useState<PageContextType | null>(null);
  const [activePageContextSource, setActivePageContextSource] =
    useState<PageContextSource>("auto_detect");
  const [activePageContextPageOrigin, setActivePageContextPageOrigin] = useState<string | null>(
    null
  );
  const [pageContextSiteModeOverrides, setPageContextSiteModeOverrides] =
    useState<PageContextSiteModeOverridesRecord>({});
  const [typeFilter, setTypeFilter] = useState<IocTypeFilter>("all");
  const [trayFilterReady, setTrayFilterReady] = useState(false);
  const [trayNavigationMessage, setTrayNavigationMessage] = useState<string | null>(null);
  const [trayEnrichmentStatuses, setTrayEnrichmentStatuses] = useState<
    Record<string, TrayEntryEnrichmentStatus>
  >({});
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<TabScanSummaryEntry | null>(null);
  const [analystNote, setAnalystNote] = useState("");
  const [analystNoteStatus, setAnalystNoteStatus] = useState<AnalystNoteSaveStatus>("idle");
  const [detailEnrichState, setDetailEnrichState] = useState<DetailEnrichState>("idle");
  const [intelSourceResults, setIntelSourceResults] = useState<EnrichmentSourceResult[]>([]);
  const [intelSourceAvailability, setIntelSourceAvailability] =
    useState<IntelSourceAvailabilityRecord>({});
  const [intelFeedLoading, setIntelFeedLoading] = useState(false);
  const analystNoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceGenerationRef = useRef(0);
  const [workspaceGeneration, setWorkspaceGeneration] = useState(0);
  const iocQueueRef = useRef<HTMLUListElement | null>(null);
  const [selectionEnrichMessage, setSelectionEnrichMessage] = useState<string | null>(null);
  const [textSelectionAvailable, setTextSelectionAvailable] = useState(false);
  const [selectionEnrichAvailable, setSelectionEnrichAvailable] = useState(false);
  const [, setSessionTitle] = useState(DEFAULT_INVESTIGATION_SESSION_TITLE);
  const [sessionTitleReady, setSessionTitleReady] = useState(false);
  const [activeSession, setActiveSession] = useState<InvestigationSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<InvestigationSession[]>([]);
  const [sourceOps, setSourceOps] = useState<EnrichmentSourceOpsSnapshot | null>(null);
  const [, setSourceOpsReady] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<InvestigationHistoryEntry[]>([]);
  const [, setHistoryReady] = useState(false);
  const [saveToCollectionAnchorId, setSaveToCollectionAnchorId] = useState<string | null>(null);
  const [saveToCollectionFeedback, setSaveToCollectionFeedback] = useState<string | null>(null);
  const [addFilteredToCollectionOpen, setAddFilteredToCollectionOpen] = useState(false);
  const [addFilteredToCollectionFeedback, setAddFilteredToCollectionFeedback] = useState<
    string | null
  >(null);
  const [collectionsMenuOpen, setCollectionsMenuOpen] = useState(false);
  const [detectedIndicatorsExpanded, setDetectedIndicatorsExpanded] = useState(true);
  const [iocSearchQuery, setIocSearchQuery] = useState("");
  const [trayShowSuppressed, setTrayShowSuppressed] = useState(false);
  const [runMacroTrayAnchorId, setRunMacroTrayAnchorId] = useState<string | null>(null);
  const [runMacroTrayFeedback, setRunMacroTrayFeedback] = useState<string | null>(null);
  const [runMacroOnFilteredOpen, setRunMacroOnFilteredOpen] = useState(false);
  const [runMacroOnFilteredFeedback, setRunMacroOnFilteredFeedback] = useState<string | null>(null);
  const [trayPageCoOccurrenceIndex, setTrayPageCoOccurrenceIndex] =
    useState<PageIocCoOccurrenceIndex | null>(null);
  const [trayCorrelationClusters, setTrayCorrelationClusters] = useState<CorrelationCluster[]>([]);
  const [trayCorrelationSessions, setTrayCorrelationSessions] = useState<InvestigationSession[]>(
    []
  );
  const [trayCorrelationReady, setTrayCorrelationReady] = useState(false);
  const [trayRelationshipStore, setTrayRelationshipStore] = useState<RelationshipEdgesStore | null>(
    null
  );
  const [trayNotebookStore, setTrayNotebookStore] = useState<NotebookFragmentsStore | null>(null);
  const [noiseRules, setNoiseRules] = useState<NoiseRule[]>([]);
  const [knownGoodEntries, setKnownGoodEntries] = useState<KnownGoodEntry[]>([]);

  const refreshActivePageContext = async () => {
    const [context, overrides] = await Promise.all([
      requestTabPageContextForActiveTab(),
      getPageContextSiteModeOverrides(),
    ]);
    const classifiedType = context?.pageContextType ?? PAGE_CONTEXT_TYPE.GENERIC;
    const pageOrigin = context?.pageUrl || (await resolveActiveTabPageUrl()) || null;
    const normalizedOrigin =
      typeof pageOrigin === "string" && pageOrigin.trim().length > 0 ? pageOrigin : null;
    const display = resolveActivePageContextDisplay({
      classifiedPageContextType: classifiedType,
      siteModeOverrides: overrides,
      pageOrigin: normalizedOrigin,
    });
    setPageContextSiteModeOverrides(overrides);
    setActivePageContextType(display.pageContextType);
    setActivePageContextSource(display.source);
    setActivePageContextPageOrigin(normalizedOrigin);
  };

  const handleResetActivePageContextOverride = () => {
    if (!activePageContextPageOrigin) {
      return;
    }
    void removePageContextSiteModeOverrideForOrigin(activePageContextPageOrigin).then(() =>
      refreshActivePageContext()
    );
  };

  const refreshSourceOps = async () => {
    const snapshot = await requestEnrichmentSourceOps();
    setSourceOps(snapshot);
  };

  const refreshIntelFeed = useCallback(async (entry: TabScanSummaryEntry | null) => {
    const generation = workspaceGenerationRef.current;
    if (!entry) {
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      setIntelSourceResults([]);
      setIntelSourceAvailability({});
      setIntelFeedLoading(false);
      return;
    }
    setIntelFeedLoading(true);
    try {
      const settings = await getVera5Settings();
      const applicableSourceIds = ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
        enrichmentSourceSupportsIocType(sourceId, entry.type)
      );
      const availability = Object.fromEntries(
        applicableSourceIds.map((sourceId) => {
          const definition = getEnrichmentSourceDefinition(sourceId);
          const primaryConfigured =
            !definition.requiresApiKey || Boolean(settings.apiKeys[sourceId]?.trim());
          const secondaryConfigured =
            !definition.secondaryApiKeySlot ||
            Boolean(settings.apiKeys[definition.secondaryApiKeySlot]?.trim());
          return [
            sourceId,
            {
              enabled: settings.enrichmentSourceEnabled[sourceId] === true,
              configured: primaryConfigured && secondaryConfigured,
            },
          ];
        })
      ) as IntelSourceAvailabilityRecord;
      const stored = await Promise.all(
        applicableSourceIds.map((sourceId) =>
          readStoredEnrichmentSourceResult(entry.value, sourceId)
        )
      );
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      setIntelSourceAvailability(availability);
      setIntelSourceResults(
        stored.filter((result): result is EnrichmentSourceResult => result !== null)
      );
    } catch {
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      setIntelSourceResults([]);
    } finally {
      if (workspaceGenerationRef.current === generation) {
        setIntelFeedLoading(false);
      }
    }
  }, []);

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

  const refreshInvestigationHistoryState = async () => {
    const entries = await listInvestigationHistoryEntries();
    setHistoryEntries(entries);
  };

  useEffect(() => {
    void Promise.all([
      getExtensionEnabled(),
      getHighlightEnabled(),
      getQuietMode(),
      getOnPagePopoutEnabled(),
    ]).then(([extensionValue, highlightValue, quietModeValue, popoutValue]) => {
      setEnabled(extensionValue);
      setHighlightEnabledState(highlightValue);
      setQuietModeActive(quietModeValue);
      setOnPagePopoutEnabledState(popoutValue);
      setReady(true);
    });
    void requestTabScanSummaryForActiveTab().then((summary) => {
      if (summary) {
        setScanSummary(summary);
        setScanState("done");
      }
    });
    void refreshActivePageContext();
    void refreshInvestigationSessionState().finally(() => {
      setSessionTitleReady(true);
    });
    void refreshInvestigationHistoryState().finally(() => {
      setHistoryReady(true);
    });
    void refreshSourceOps().finally(() => {
      setSourceOpsReady(true);
    });
    void listStoredNoiseRules()
      .then((rules) => {
        setNoiseRules(rules);
      })
      .catch(() => {
        setNoiseRules([]);
      });
    void listStoredKnownGoodEntriesForMatching()
      .then((entries) => {
        setKnownGoodEntries(entries);
      })
      .catch(() => {
        setKnownGoodEntries([]);
      });
    // Casework tabs were removed from the side panel; still consume any stored
    // panel-focus request so it does not persist across opens.
    void readPopupPanelFocus().then((panel) => {
      if (panel) {
        void clearPopupPanelFocus();
      }
    });
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return;
    }

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") {
        return;
      }
      const change = changes[STORAGE_KEY_QUIET_MODE];
      if (change) {
        setQuietModeActive(Boolean(change.newValue));
      }
      if (STORAGE_KEY_ON_PAGE_POPOUT_ENABLED in changes) {
        const popoutChange = changes[STORAGE_KEY_ON_PAGE_POPOUT_ENABLED];
        setOnPagePopoutEnabledState(
          popoutChange.newValue === undefined
            ? DEFAULT_ON_PAGE_POPOUT_ENABLED
            : Boolean(popoutChange.newValue)
        );
      }
      if (changes[STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]) {
        void refreshActivePageContext();
      }
      if (changes[STORAGE_KEY_NOISE_RULES]) {
        void listStoredNoiseRules()
          .then((rules) => {
            setNoiseRules(rules);
          })
          .catch(() => {
            setNoiseRules([]);
          });
      }
      if (changes[STORAGE_KEY_KNOWN_GOOD_LIST]) {
        void listStoredKnownGoodEntriesForMatching()
          .then((entries) => {
            setKnownGoodEntries(entries);
          })
          .catch(() => {
            setKnownGoodEntries([]);
          });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshSelectionActionState = () => {
      void requestSelectionActionStateForActiveTab().then((state) => {
        if (cancelled) {
          return;
        }
        setTextSelectionAvailable(state.textSelectionAvailable);
        setSelectionEnrichAvailable(state.selectionEnrichAvailable);
      });
      void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (cancelled) {
          return;
        }
        const url = tab?.url ?? "";
        setOnPagePopoutUnavailableOnPage(
          url.startsWith("chrome://") ||
            url.startsWith("chrome-extension://") ||
            url.startsWith("edge://") ||
            url.startsWith("about:") ||
            url.includes("chrome.google.com/webstore") ||
            url.includes("chromewebstore.google.com")
        );
      });
    };

    refreshSelectionActionState();
    const intervalId = window.setInterval(refreshSelectionActionState, 400);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
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

  // Drop the open detail pane when its indicator is no longer in the active
  // tab's scan (re-scan, navigation, or tab switch in the side panel).
  useEffect(() => {
    if (!selectedDetailEntry || !scanSummary) {
      return;
    }
    const stillPresent = scanSummary?.entries.some(
      (candidate) => candidate.anchorId === selectedDetailEntry.anchorId
    );
    if (!stillPresent) {
      SELECTED_INTEL_ANCHOR_BY_TAB.delete(scanSummary.tabId);
      setSelectedDetailEntry(null);
    }
  }, [scanSummary, selectedDetailEntry]);

  useEffect(() => {
    if (!scanSummary) {
      return;
    }
    if (selectedDetailEntry) {
      SELECTED_INTEL_ANCHOR_BY_TAB.set(scanSummary.tabId, selectedDetailEntry.anchorId);
      return;
    }
    const selectedAnchor = SELECTED_INTEL_ANCHOR_BY_TAB.get(scanSummary.tabId);
    if (!selectedAnchor) {
      return;
    }
    const restored = scanSummary.entries.find((entry) => entry.anchorId === selectedAnchor);
    if (restored) {
      setSelectedDetailEntry(restored);
    } else {
      SELECTED_INTEL_ANCHOR_BY_TAB.delete(scanSummary.tabId);
    }
  }, [scanSummary, selectedDetailEntry]);

  useEffect(() => {
    void refreshIntelFeed(selectedDetailEntry);
  }, [refreshIntelFeed, selectedDetailEntry]);

  useEffect(() => {
    if (iocQueueRef.current) {
      iocQueueRef.current.scrollTop = 0;
    }
  }, [typeFilter, trayShowSuppressed, iocSearchQuery]);

  useEffect(() => {
    const onChanged = chrome.storage?.onChanged;
    if (!onChanged?.addListener || !selectedDetailEntry) {
      return;
    }
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (
        areaName !== "local" ||
        (!changes[STORAGE_KEY_ENRICHMENT_CACHE] &&
          !changes[STORAGE_KEY_API_KEYS] &&
          !changes[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED])
      ) {
        return;
      }
      void refreshIntelFeed(selectedDetailEntry);
    };
    onChanged.addListener(listener);
    return () => {
      onChanged.removeListener?.(listener);
    };
  }, [refreshIntelFeed, selectedDetailEntry]);

  // Load the persisted analyst note for the selected indicator.
  useEffect(() => {
    if (!selectedDetailEntry) {
      setAnalystNote("");
      setAnalystNoteStatus("idle");
      return;
    }
    let cancelled = false;
    setAnalystNoteStatus("idle");
    void getStoredAnalystNote(selectedDetailEntry.value).then((stored) => {
      if (!cancelled) {
        setAnalystNote(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDetailEntry]);

  // Keep the note editor in sync when the same indicator is annotated elsewhere
  // (e.g. the in-page hover card). Guarded because chrome.storage.onChanged is
  // absent in some contexts/tests. Never clobber text the analyst is typing.
  useEffect(() => {
    const onChanged = chrome.storage?.onChanged;
    if (!onChanged?.addListener || !selectedDetailEntry) {
      return;
    }
    const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
      if (areaName !== "local" || !changes[STORAGE_KEY_ANALYST_NOTES]) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement && active.dataset.vera5AnalystNote === "true") {
        return;
      }
      const record = normalizeAnalystNotesRecord(changes[STORAGE_KEY_ANALYST_NOTES].newValue);
      setAnalystNote(record[normalizeIocNoteKey(selectedDetailEntry.value)] ?? "");
    };
    onChanged.addListener(listener);
    return () => {
      onChanged.removeListener?.(listener);
    };
  }, [selectedDetailEntry]);

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
    if (!activeSession || !scanSummary?.pageUrl) {
      setTrayPageCoOccurrenceIndex(null);
      return;
    }

    let cancelled = false;
    void getPageIocCoOccurrenceIndexForSession({
      sessionId: activeSession.id,
      pageUrl: scanSummary.pageUrl,
    }).then((pageIndex) => {
      if (!cancelled) {
        setTrayPageCoOccurrenceIndex(pageIndex);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSession, scanSummary?.pageUrl, scanSummary?.scannedAt]);

  useEffect(() => {
    if (!scanSummary) {
      setTrayCorrelationClusters([]);
      setTrayCorrelationSessions([]);
      setTrayCorrelationReady(false);
      return;
    }

    let cancelled = false;
    setTrayCorrelationReady(false);
    void Promise.all([
      buildStoredCorrelationClustersFromInvestigationMemory(),
      listStoredInvestigationSessions(),
    ]).then(([clusters, sessions]) => {
      if (!cancelled) {
        setTrayCorrelationClusters(clusters);
        setTrayCorrelationSessions(sessions);
        setTrayCorrelationReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, scanSummary?.pageUrl, scanSummary?.scannedAt]);

  useEffect(() => {
    if (!scanSummary) {
      setTrayRelationshipStore(null);
      setTrayNotebookStore(null);
      return;
    }

    let cancelled = false;
    void getRelationshipEdgesStore().then((store) => {
      if (!cancelled) {
        setTrayRelationshipStore(store);
      }
    });
    void getNotebookFragmentsStore().then((store) => {
      if (!cancelled) {
        setTrayNotebookStore(store);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, scanSummary?.pageUrl, scanSummary?.scannedAt]);

  useEffect(() => {
    if (!scanSummary || !trayFilterReady) {
      return;
    }
    void saveTabScanTrayFilter(scanSummary.tabId, typeFilter);
  }, [scanSummary, typeFilter, trayFilterReady]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.backgroundColor = POPUP_THEME.page;
    document.body.style.color = POPUP_THEME.text;
    document.body.style.fontFamily = VERA5_FONT.sans;
  }, []);

  const trayView = resolvePopupTrayView({ enabled, scanState, scanSummary });
  const scanPresentation = resolveScanPresentation({ scanState, trayView, scanSummary });
  const detectedCount = resolveCanonicalDetectedCount(scanSummary);
  const activePageContextBadgeLabel = resolveActivePageContextBadgeLabel(activePageContextType);
  const activePageContextSourceLabel = resolvePageContextSourceStatusLabel(activePageContextSource);
  const activePageContextOverrideActive = activePageContextSource === "override";

  const filteredEntries = useMemo(() => {
    if (!scanSummary) {
      return [];
    }
    return filterTabScanSummaryEntries(scanSummary.entries, typeFilter);
  }, [scanSummary, typeFilter]);

  const trayNoisePartition = useMemo(
    () => partitionTrayEntriesByNoiseRules(filteredEntries, noiseRules),
    [filteredEntries, noiseRules]
  );
  const activeTrayEntries = useMemo(() => {
    const investigationKeys = new Set(
      activeSession
        ? listInvestigationSessionIocMembers(activeSession).map((member) =>
            normalizeInvestigationSessionIocTimelineKey(member.value)
          )
        : []
    );
    return sortTrayEntriesDeprioritizingKnownGoodMatches(
      trayNoisePartition.active,
      knownGoodEntries,
      {
        isActiveInvestigationIoc: (value) =>
          investigationKeys.has(normalizeInvestigationSessionIocTimelineKey(value)),
      }
    );
  }, [trayNoisePartition.active, knownGoodEntries, activeSession]);
  const suppressedTrayEntries = trayNoisePartition.suppressed;
  const iocSearchNeedle = iocSearchQuery.trim().toLowerCase();
  const visibleTrayEntries = useMemo(() => {
    if (trayShowSuppressed) {
      const suppressed = suppressedTrayEntries.map(({ entry }) => entry);
      if (!iocSearchNeedle) {
        return suppressed.map((entry) => ({ entry, noiseSuppressed: true as const }));
      }
      return suppressed
        .filter((entry) => entry.value.toLowerCase().includes(iocSearchNeedle))
        .map((entry) => ({ entry, noiseSuppressed: true as const }));
    }
    if (!iocSearchNeedle) {
      return activeTrayEntries.map((entry) => ({ entry, noiseSuppressed: false as const }));
    }
    return activeTrayEntries
      .filter((entry) => entry.value.toLowerCase().includes(iocSearchNeedle))
      .map((entry) => ({ entry, noiseSuppressed: false as const }));
  }, [trayShowSuppressed, suppressedTrayEntries, activeTrayEntries, iocSearchNeedle]);
  // INVESTIGATION PATHS — derived strictly from real local state.
  const investigationPageIndicatorCount = scanSummary?.entries.length ?? 0;
  const investigationPriorSightingCount = useMemo(() => {
    if (!selectedDetailEntry) {
      return 0;
    }
    return historyEntries.filter(
      (candidate) =>
        candidate.iocType === selectedDetailEntry.type &&
        candidate.ioc === selectedDetailEntry.value
    ).length;
  }, [historyEntries, selectedDetailEntry]);
  const investigationSelectedSuppressed = useMemo(() => {
    if (!selectedDetailEntry) {
      return false;
    }
    return suppressedTrayEntries.some(
      ({ entry }) => entry.anchorId === selectedDetailEntry.anchorId
    );
  }, [suppressedTrayEntries, selectedDetailEntry]);
  const whyStillVisibleTooltip = useMemo(
    () => buildWhyStillVisibleTooltip(suppressedTrayEntries.map(({ entry }) => entry)),
    [suppressedTrayEntries]
  );






  const intelSourceEntries = useMemo(
    () => buildHoverCardSourceEntries(intelSourceResults),
    [intelSourceResults]
  );


  const trayCorrelationSessionsById = useMemo(() => {
    const byId = new Map<string, CorrelationClusterSessionLookup>();
    for (const session of trayCorrelationSessions) {
      byId.set(session.id, session);
    }
    for (const session of recentSessions) {
      byId.set(session.id, session);
    }
    if (activeSession) {
      byId.set(activeSession.id, activeSession);
    }
    return byId;
  }, [trayCorrelationSessions, recentSessions, activeSession]);

  const trayRelationshipSessionsById = useMemo(() => {
    const byId = new Map<string, RelationshipSessionLookup>();
    for (const session of trayCorrelationSessions) {
      byId.set(session.id, session);
    }
    for (const session of recentSessions) {
      byId.set(session.id, session);
    }
    if (activeSession) {
      byId.set(activeSession.id, activeSession);
    }
    return byId;
  }, [trayCorrelationSessions, recentSessions, activeSession]);


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

  const handleOnPagePopoutToggle = (checked: boolean) => {
    setOnPagePopoutEnabledState(checked);
    void setOnPagePopoutEnabled(checked);
  };

  const handleOpenSettings = () => {
    void chrome.runtime.openOptionsPage();
  };

  const handleOpenPermissions = () => {
    openExtensionSitePermissionsPage();
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

  // Casework's visible session/replay panels were removed from the side panel.
  // Relationship links still reopen the prior session in state for future
  // Workspace views; the dead scroll-to-panel behavior is dropped.
  const handleOpenRelationshipPriorSession = (sessionId: string) => {
    handleReopenSession(sessionId);
  };

  const handleOpenRelationshipPriorSessionReplay = (sessionId: string) => {
    handleReopenSession(sessionId);
  };











  const sendNavigateToIocAnchor = (input: {
    anchorId: string;
    value: string;
    iocType?: TabScanSummaryEntry["type"];
  }) => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setTrayNavigationMessage(
          resolveTrayNavigationFeedback({ tabId: undefined, indicatorValue: input.value })
        );
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(
          tab.id,
          navigateToIocAnchorMessage(
            input.anchorId,
            input.iocType ? { iocType: input.iocType, value: input.value } : undefined
          )
        );
        setTrayNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            response,
            indicatorValue: input.value,
          })
        );
      } catch {
        setTrayNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            sendFailed: true,
            indicatorValue: input.value,
          })
        );
      }
    });
  };

  const handleOpenRelationshipNotebookLink = (link: RelationshipNotebookFragmentLink) => {
    const action = link.action;
    if (action.kind === "open_session_notebook") {
      // Notebook panel was removed from the side panel; still reopen the session
      // so its data is active for future Workspace views.
      handleReopenSession(action.sessionId);
      return;
    }

    const relatedEntry = scanSummary?.entries.find(
      (candidate) => candidate.type === action.iocType && candidate.value === action.value
    );
    if (relatedEntry) {
      sendNavigateToIocAnchor({
        anchorId: relatedEntry.anchorId,
        value: relatedEntry.value,
        iocType: relatedEntry.type,
      });
    }
  };

  const navigateToTrayEntry = (entry: TabScanSummaryEntry) => {
    sendNavigateToIocAnchor({
      anchorId: entry.anchorId,
      value: entry.value,
      iocType: entry.type,
    });
  };


  // Activating a tray row both opens the detail pane (the side panel's primary
  // analyst surface) and highlights the indicator on the page.
  const handleTrayRowActivate = (entry: TabScanSummaryEntry) => {
    setSelectedDetailEntry(entry);
    navigateToTrayEntry(entry);
  };




  const handleAnalystNoteChange = (value: string) => {
    const entry = selectedDetailEntry;
    if (!entry) {
      return;
    }
    setAnalystNote(value);
    setAnalystNoteStatus("saving");
    if (analystNoteSaveTimerRef.current) {
      clearTimeout(analystNoteSaveTimerRef.current);
    }
    analystNoteSaveTimerRef.current = setTimeout(() => {
      void setStoredAnalystNote(entry.value, value).then(() => {
        setAnalystNoteStatus("saved");
      });
    }, 300);
  };


  // Force a fresh enrichment for the selected indicator, then refresh the tray
  // badges from cache. Routed through the background service worker so the side
  // panel never touches the page DOM directly.
  const handleEnrichSelectedDetail = () => {
    const entry = selectedDetailEntry;
    if (!entry || detailEnrichState === "enriching") {
      return;
    }
    const generation = workspaceGenerationRef.current;
    setDetailEnrichState("enriching");
    void (async () => {
      try {
        await chrome.runtime.sendMessage(
          enrichIocMessage({ value: entry.value, iocType: entry.type, bypassCache: true })
        );
      } catch {
        // Background unreachable; surface stays on the last known status.
      }
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      try {
        if (scanSummary && scanSummary.entries.length > 0) {
          const statuses = await loadTrayEntryEnrichmentStatuses(scanSummary.entries);
          if (workspaceGenerationRef.current !== generation) {
            return;
          }
          setTrayEnrichmentStatuses(statuses);
        }
      } catch {
        // Leave existing statuses in place on refresh failure.
      }
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      await refreshIntelFeed(entry);
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      await refreshInvestigationSessionState();
      if (workspaceGenerationRef.current !== generation) {
        return;
      }
      setDetailEnrichState("idle");
    })();
  };

  const handleResetWorkspace = () => {
    const hasUnsavedNoteDraft =
      analystNoteStatus === "saving" || analystNoteSaveTimerRef.current !== null;
    if (hasUnsavedNoteDraft) {
      const confirmed = window.confirm(
        "Reset this workspace? Unsaved analyst-note changes will be discarded."
      );
      if (!confirmed) {
        return;
      }
    }

    if (analystNoteSaveTimerRef.current) {
      clearTimeout(analystNoteSaveTimerRef.current);
      analystNoteSaveTimerRef.current = null;
    }

    workspaceGenerationRef.current += 1;
    setWorkspaceGeneration(workspaceGenerationRef.current);

    setScanState("idle");
    setScanSummary(null);
    setSelectedDetailEntry(null);
    setTypeFilter("all");
    setTrayFilterReady(false);
    setTrayNavigationMessage(null);
    setTrayEnrichmentStatuses({});
    setIntelSourceResults([]);
    setIntelSourceAvailability({});
    setIntelFeedLoading(false);
    setDetailEnrichState("idle");
    setAnalystNote("");
    setAnalystNoteStatus("idle");
    setIocSearchQuery("");
    setTrayShowSuppressed(false);
    setCollectionsMenuOpen(false);
    setAddFilteredToCollectionOpen(false);
    setAddFilteredToCollectionFeedback(null);
    setRunMacroOnFilteredOpen(false);
    setRunMacroOnFilteredFeedback(null);
    setSaveToCollectionAnchorId(null);
    setSaveToCollectionFeedback(null);
    setRunMacroTrayAnchorId(null);
    setRunMacroTrayFeedback(null);
    setSelectionEnrichMessage(null);
    if (iocQueueRef.current) {
      iocQueueRef.current.scrollTop = 0;
    }

    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        return;
      }
      SELECTED_INTEL_ANCHOR_BY_TAB.delete(tab.id);
      try {
        await clearTabScanSnapshot(tab.id);
      } catch {
        // Snapshot clear is best-effort for the bound tab.
      }
      try {
        await clearTabScanTrayFilter(tab.id);
      } catch {
        // Filter clear is best-effort for the bound tab.
      }
      try {
        await chrome.tabs.sendMessage(tab.id, resetWorkspacePageMessage());
      } catch {
        // Restricted pages and unbound tabs fail safely.
      }
    });
  };

  const canResetWorkspace =
    scanState !== "idle" ||
    scanSummary !== null ||
    selectedDetailEntry !== null ||
    typeFilter !== "all" ||
    trayShowSuppressed ||
    iocSearchQuery.trim().length > 0 ||
    collectionsMenuOpen ||
    addFilteredToCollectionOpen ||
    runMacroOnFilteredOpen ||
    intelSourceResults.length > 0 ||
    detailEnrichState === "enriching" ||
    intelFeedLoading ||
    analystNoteStatus === "saving" ||
    analystNoteSaveTimerRef.current !== null;

  const handleScanPage = () => {
    if (!enabled) {
      return;
    }
    const generation = workspaceGenerationRef.current;
    setScanState("scanning");
    setScanSummary(null);
    setTypeFilter("all");
    setTrayFilterReady(false);
    setTrayNavigationMessage(null);
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void saveTabScanTrayFilter(tab.id, "all");
      }
    });
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        if (workspaceGenerationRef.current === generation) {
          setScanState("error");
        }
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(tab.id, scanPageMessage());
        if (workspaceGenerationRef.current !== generation) {
          return;
        }
        if (response && typeof response === "object" && "ok" in response && response.ok === true) {
          const summary = await requestTabScanSummaryForActiveTab();
          if (workspaceGenerationRef.current !== generation) {
            return;
          }
          if (summary !== null) {
            setScanSummary(summary);
            setScanState("done");
            await refreshActivePageContext();
            await refreshInvestigationSessionState();
            return;
          }
        }
        if (workspaceGenerationRef.current === generation) {
          setScanState("error");
        }
      } catch {
        if (workspaceGenerationRef.current === generation) {
          setScanState("error");
        }
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
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void saveTabScanTrayFilter(tab.id, "all");
      }
    });
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setScanState("error");
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(tab.id, scanSelectionMessage());
        if (response && typeof response === "object" && "ok" in response && response.ok === true) {
          const summary = await requestTabScanSummaryForActiveTab();
          if (summary !== null) {
            setScanSummary(summary);
            setScanState("done");
            await refreshActivePageContext();
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
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setSelectionEnrichMessage("Could not reach this page. Reload the tab and try again.");
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(tab.id, enrichSelectionMessage());
        if (response && typeof response === "object" && "ok" in response && response.ok === true) {
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
        setSelectionEnrichMessage("Could not reach this page. Reload the tab and try again.");
      }
    });
  };

  const scanSelectionDisabled =
    !ready || !enabled || scanState === "scanning" || !textSelectionAvailable;
  const enrichSelectionDisabled = !ready || !enabled || !selectionEnrichAvailable;
  const popupHost =
    typeof chrome !== "undefined" && typeof chrome.sidePanel === "object"
      ? "sidepanel"
      : "firefox-sidebar";
  const compactIndicatorQueue = popupHost === "sidepanel";
  const popupRootRef = useRef<HTMLElement | null>(null);
  const [workspaceWidthMode, setWorkspaceWidthMode] =
    useState<WorkspaceWidthMode>("standard");

  useEffect(() => {
    if (popupHost !== "sidepanel") {
      return;
    }
    const root = popupRootRef.current;
    if (!root || typeof ResizeObserver === "undefined") {
      return;
    }
    const updateMode = () => {
      const width = root.getBoundingClientRect().width;
      setWorkspaceWidthMode(resolveWorkspaceWidthMode(width));
    };
    updateMode();
    const observer = new ResizeObserver(() => {
      updateMode();
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [popupHost]);

  const renderTrayEntryRow = (
    entry: TabScanSummaryEntry,
    options?: { noiseSuppressed?: boolean }
  ) => {
    const enrichmentStatus = trayEnrichmentStatuses[entry.anchorId];
    const provenance = resolveTrayEntryMatchProvenance(entry);
    const noiseSuppressed = options?.noiseSuppressed === true;
    const knownGoodMatch = findMatchingKnownGoodEntry(knownGoodEntries, entry.value);
    const knownGoodBadge = knownGoodMatch ? buildKnownGoodMatchBadgeView(knownGoodMatch) : null;
    const indicatorPresentation = resolveIndicatorValuePresentation({
      value: entry.value,
      displayValue: entry.displayValue,
    });
    const selected = selectedDetailEntry?.anchorId === entry.anchorId;
    const showInlineAnalystDetails = !compactIndicatorQueue;

    return (
      <li
        key={entry.anchorId}
        className="vera5-ioc-queue-row"
        role="button"
        tabIndex={0}
        data-vera5-tray-entry="true"
        data-vera5-type={entry.type}
        data-ioc-type={entry.type}
        data-vera5-value={entry.value}
        data-vera5-anchor-id={entry.anchorId}
        data-vera5-rule-id={provenance?.ruleId}
        data-vera5-source-text-hint={provenance?.sourceTextHint}
        data-vera5-noise-suppressed={noiseSuppressed ? "true" : undefined}
        data-vera5-known-good-entry-id={knownGoodBadge?.entryId}
        data-vera5-known-good-category={knownGoodBadge?.category}
        data-vera5-known-good-match-type={knownGoodBadge?.matchType}
        data-vera5-known-good-pattern={knownGoodBadge?.pattern}
        data-vera5-selected={selected ? "true" : undefined}
        aria-pressed={selected}
        aria-label={buildTrayRowNavigationAriaLabel(entry.value, enrichmentStatus)}
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
          flexDirection: compactIndicatorQueue ? "row" : "column",
          alignItems: compactIndicatorQueue ? "center" : undefined,
          gap: compactIndicatorQueue ? 8 : 6,
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid transparent",
          backgroundColor: POPUP_THEME.trayRowBg,
          fontSize: 12,
          lineHeight: 1.4,
          cursor: "pointer",
          opacity: noiseSuppressed ? 0.85 : 1,
        }}
      >
        {compactIndicatorQueue ? (
          <>
            <span
              className="vera5-ioc-type-badge"
              aria-hidden="true"
              style={{
                flexShrink: 0,
                padding: "1px 6px",
                borderRadius: 4,
                backgroundColor: POPUP_THEME.buttonBg,
                color: POPUP_THEME.muted,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {IOC_TYPE_TRAY_LABEL[entry.type]}
            </span>
            <span
              className="vera5-ioc-queue-value"
              title={entry.value}
              style={{
                flex: 1,
                minWidth: 0,
                color: POPUP_THEME.text,
                fontFamily: VERA5_FONT.mono,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {indicatorPresentation.onPageValue}
            </span>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span
              className="vera5-ioc-type-badge"
              aria-hidden="true"
              style={{
                flexShrink: 0,
                padding: "1px 6px",
                borderRadius: 4,
                backgroundColor: POPUP_THEME.buttonBg,
                color: POPUP_THEME.muted,
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
                  className="vera5-ioc-status-badge"
                  data-vera5-status-tone={enrichmentStatus.status}
                  aria-hidden="true"
                  style={trayEnrichmentHintStyle(enrichmentStatus.badgeText)}
                >
                  {formatTrayRowEnrichmentHint(enrichmentStatus)}
                </span>
              ) : null}
            </span>
          </div>
        )}
        {showInlineAnalystDetails ? (
          <>
            {knownGoodBadge ? (
              <span
                data-vera5-known-good-badge="true"
                title={knownGoodBadge.entrySummary}
                style={{
                  flexShrink: 0,
                  padding: "1px 6px",
                  borderRadius: 4,
                  border: `1px solid ${POPUP_THEME.border}`,
                  backgroundColor: POPUP_THEME.buttonBg,
                  color: POPUP_THEME.muted,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {knownGoodBadge.badgeLabel}
              </span>
            ) : null}
            <details className="vera5-tray-row-actions" style={{ width: "100%", margin: 0 }}>
              <summary style={trayDemotedDetailsSummaryStyle()}>
                {POPUP_TRAY_ROW_ACTIONS_SUMMARY}
              </summary>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <SaveToCollectionTrayPanel
                  entry={entry}
                  open={saveToCollectionAnchorId === entry.anchorId}
                  feedback={
                    saveToCollectionAnchorId === entry.anchorId ? saveToCollectionFeedback : null
                  }
                  onFeedback={setSaveToCollectionFeedback}
                  onToggle={() => {
                    setSaveToCollectionFeedback(null);
                    setSaveToCollectionAnchorId((current) =>
                      current === entry.anchorId ? null : entry.anchorId
                    );
                  }}
                />
                <RunMacroTrayPanel
                  entry={entry}
                  open={runMacroTrayAnchorId === entry.anchorId}
                  feedback={runMacroTrayAnchorId === entry.anchorId ? runMacroTrayFeedback : null}
                  onFeedback={setRunMacroTrayFeedback}
                  onToggle={() => {
                    setRunMacroTrayFeedback(null);
                    setRunMacroTrayAnchorId((current) =>
                      current === entry.anchorId ? null : entry.anchorId
                    );
                  }}
                />
              </div>
            </details>
            <details
              className="vera5-tray-context"
              style={{ width: "100%", margin: 0 }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <summary style={trayDemotedDetailsSummaryStyle()}>Context</summary>
              <div className="vera5-tray-context-body">
                <WhyDetectedTrayDetails entry={entry} />
                <CoOccurrenceTrayDetails
                  entry={entry}
                  pageIndex={trayPageCoOccurrenceIndex}
                  onNavigateToRelated={sendNavigateToIocAnchor}
                />
                <RelationshipTrayDetails
                  entry={entry}
                  store={trayRelationshipStore}
                  knownGoodEntries={knownGoodEntries}
                  clusters={trayCorrelationClusters}
                  activeSessionId={activeSession?.id ?? null}
                  sessionsById={trayRelationshipSessionsById}
                  notebookStore={trayNotebookStore}
                  siteModeOverrides={pageContextSiteModeOverrides}
                  onOpenPriorSession={handleOpenRelationshipPriorSession}
                  onOpenPriorSessionReplay={handleOpenRelationshipPriorSessionReplay}
                  onOpenNotebookLink={handleOpenRelationshipNotebookLink}
                />
                <CorrelationClusterTrayDetails
                  entry={entry}
                  clusters={trayCorrelationClusters}
                  activeSessionId={activeSession?.id ?? null}
                  sessionsById={trayCorrelationSessionsById}
                  pageIndex={trayPageCoOccurrenceIndex}
                  viewingCurrentTabScan={scanSummary !== null}
                  ready={trayCorrelationReady}
                />
              </div>
            </details>
          </>
        ) : null}
      </li>
    );
  };

  return (
    <main
      ref={popupRootRef}
      className="vera5-popup"
      data-host={popupHost}
      data-ws-mode={popupHost === "sidepanel" ? workspaceWidthMode : undefined}
      style={{
        minWidth: 280,
        maxWidth: "none",
        width: "100%",
        boxSizing: "border-box",
        padding: VERA5_SPACE.lg,
        fontFamily: VERA5_FONT.sans,
        backgroundColor: POPUP_THEME.page,
        color: POPUP_THEME.text,
        // Phase 6/12B: workspace container + measured width-mode tokens.
        containerType: "inline-size",
        containerName: "vera5-workspace",
        ["--vera5-workspace-split-min" as string]: `${POPUP_SIDE_PANEL_SPLIT_MIN_PX}px`,
      }}
    >
      {popupHost === "sidepanel" ? (
        <span className="vera5-sidepanel-resize-grip" aria-hidden="true" />
      ) : null}
      <header className="vera5-command-header" aria-label="Vera5 workspace header">
        <h1
          style={{
            display: "flex",
            alignItems: "center",
            gap: VERA5_SPACE.sm,
            fontFamily: VERA5_FONT.wordmark,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: POPUP_THEME.text,
            margin: `0 0 ${VERA5_SPACE.sm}px`,
          }}
        >
          <img
            aria-hidden="true"
            src="icons/logo-mark.png"
            alt=""
            style={{ width: 24, height: 24, flex: "0 0 auto" }}
          />
          <span>
            Vera
            <span
              style={{
                color: POPUP_THEME.accent,
                textShadow: "0 0 26px rgba(255, 178, 36, 0.22)",
              }}
            >
              5
            </span>
          </span>
          <div
            className="vera5-header-utilities"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <a
              className="vera5-header-action vera5-howto-button"
              href="https://www.vera5.io/how-to"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the Vera5 How-To guide in a new tab"
              style={headerGlassButtonStyle}
            >
              <VeraIcon icon={VeraUiIcons.howTo} size="xs" className="vera5-ui-icon" />
              How-To
            </a>
            <button
              className="vera5-header-action vera5-command-utility-button"
              type="button"
              disabled={!ready}
              onClick={handleOpenSettings}
              aria-label="Open Vera5 Settings"
              style={{
                ...headerGlassButtonStyle,
                cursor: ready ? "pointer" : "not-allowed",
                opacity: ready ? 1 : 0.65,
              }}
            >
              <VeraIcon icon={VeraUiIcons.settings} size="xs" className="vera5-ui-icon" />
              Settings
            </button>
            <button
              className="vera5-header-action vera5-command-utility-button"
              type="button"
              disabled={!ready}
              onClick={handleOpenPermissions}
              aria-label="Open site permissions"
              style={{
                ...headerGlassButtonStyle,
                cursor: ready ? "pointer" : "not-allowed",
                opacity: ready ? 1 : 0.65,
              }}
            >
              <VeraIcon icon={VeraUiIcons.permissions} size="xs" className="vera5-ui-icon" />
              Permissions
            </button>
          </div>
        </h1>
      </header>
      {quietModeActive || activeSession ? (
        <div
          className="vera5-status-strip"
          role="status"
          aria-label={POPUP_STATUS_STRIP_ARIA_LABEL}
        >
          {quietModeActive ? (
            <span
              className="vera5-status-chip vera5-status-chip--warning"
              aria-label="Quiet mode active. Live vendor enrichment is blocked."
            >
              {POPUP_QUIET_MODE_STATUS_LABEL}
            </span>
          ) : null}
          {activeSession ? (
            <span
              className="vera5-status-chip"
              aria-label={`Investigation session active: ${activeSession.title}`}
              title={activeSession.title}
            >
              {POPUP_STATUS_SESSION_ACTIVE_LABEL}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="vera5-workspace-chassis">
      <section className="vera5-command-section vera5-section-frame" aria-label="Scan and extension controls">
        <div className="vera5-scan-primary">
          <button
            type="button"
            disabled={!ready || !enabled || scanState === "scanning"}
            className="v5-btn v5-btn--primary vera5-scan-page-cta"
            onClick={handleScanPage}
            style={{
              ...primaryButtonStyle,
              cursor: !ready || !enabled ? "not-allowed" : "pointer",
              opacity: !ready || !enabled ? 0.65 : 1,
            }}
          >
            <VeraIcon
              icon={VeraUiIcons.scanPage}
              size="xl"
              weight={VERA_ICON_WEIGHT.primary}
              className="vera5-scan-page-icon"
            />
            <span className="vera5-scan-page-copy">
              <strong>{scanState === "scanning" ? "SCANNING…" : "SCAN PAGE"}</strong>
              <small>[Detect IOCs on this page]</small>
            </span>
          </button>
        </div>
        <div className="vera5-scan-secondary" style={scanSecondaryActionsStyle}>
          <button
            type="button"
            disabled={scanSelectionDisabled}
            className="v5-btn vera5-secondary-command vera5-secondary-command--scan"
            onClick={handleScanSelection}
            style={{
              ...buttonStyle,
              flex: "1 1 0",
              width: "auto",
              cursor: scanSelectionDisabled ? "not-allowed" : "pointer",
            }}
          >
            <span className="vera5-secondary-command-icon" aria-hidden="true">
              <VeraIcon icon={VeraUiIcons.scanSelection} size="md" />
            </span>
            <span className="vera5-secondary-command-copy">
              <strong>{scanState === "scanning" ? "SCANNING…" : "SCAN SELECTION"}</strong>
              <small>Scan highlighted text</small>
            </span>
          </button>
          <button
            type="button"
            disabled={enrichSelectionDisabled}
            className="v5-btn vera5-secondary-command vera5-secondary-command--enrich"
            onClick={handleEnrichSelection}
            style={{
              ...buttonStyle,
              flex: "1 1 0",
              width: "auto",
              cursor: enrichSelectionDisabled ? "not-allowed" : "pointer",
            }}
          >
            <span
              className="vera5-secondary-command-icon vera5-secondary-command-icon--enrich"
              aria-hidden="true"
            >
              <VeraIcon icon={VeraUiIcons.enrichSelection} size="md" />
            </span>
            <span className="vera5-secondary-command-copy">
              <strong>ENRICH SELECTION</strong>
              <small>Enrich selected indicator</small>
            </span>
          </button>
        </div>
        <div
          className="vera5-command-toggle-rail vera5-operator-controls"
          role="group"
          aria-label="Workspace display controls"
        >
          <button
            className="vera5-command-toggle vera5-command-toggle--extension"
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Extension enabled"
            disabled={!ready}
            onClick={() => handleToggle(!enabled)}
          >
            <span className="vera5-command-toggle-label">Extension enabled</span>
            <span className="vera5-command-toggle-track" aria-hidden="true">
              <span className="vera5-command-toggle-thumb" />
            </span>
          </button>
          <button
            className="vera5-command-toggle vera5-command-toggle--highlight"
            type="button"
            role="switch"
            aria-checked={highlightEnabled}
            aria-label="Highlight indicators"
            disabled={!ready || !enabled}
            onClick={() => handleHighlightToggle(!highlightEnabled)}
          >
            <span className="vera5-command-toggle-label">Highlight indicators</span>
            <span className="vera5-command-toggle-track" aria-hidden="true">
              <span className="vera5-command-toggle-thumb" />
            </span>
          </button>
          <button
            className="vera5-command-toggle vera5-command-toggle--popout"
            type="button"
            role="switch"
            aria-checked={onPagePopoutEnabled}
            aria-label="On-Page Popout"
            title={
              onPagePopoutUnavailableOnPage
                ? "On-page popout is unavailable on this page."
                : undefined
            }
            disabled={!ready || !enabled}
            onClick={() => handleOnPagePopoutToggle(!onPagePopoutEnabled)}
          >
            <span className="vera5-command-toggle-label">On-Page Popout</span>
            <span className="vera5-command-toggle-track" aria-hidden="true">
              <span className="vera5-command-toggle-thumb" />
            </span>
          </button>
        </div>
        {scanState === "error" ? (
          <p style={{ fontSize: 12, margin: 0, color: POPUP_THEME.error }} role="status">
            {WORKSPACE_STATE_COPY.scan.error} {WORKSPACE_STATE_COPY.scan.errorDetail}
          </p>
        ) : null}
        {selectionEnrichMessage ? (
          <p style={{ fontSize: 12, margin: 0, color: POPUP_THEME.error }}>
            {selectionEnrichMessage}
          </p>
        ) : null}
      </section>
      <div className="vera5-popup-workspace">
        <IntelFeedPanel
          entry={selectedDetailEntry}
          loading={intelFeedLoading || detailEnrichState === "enriching"}
          sourceEntries={intelSourceEntries}
          availability={intelSourceAvailability}
          scanPresentation={scanPresentation}
          detectedCount={detectedCount}
          onEnrich={handleEnrichSelectedDetail}
          note={analystNote}
          noteStatus={analystNoteStatus}
          onNoteChange={handleAnalystNoteChange}
          filteredEntries={filteredEntries}
          collectionsMenuOpen={collectionsMenuOpen}
          onCollectionsMenuOpenChange={setCollectionsMenuOpen}
          addFilteredToCollectionOpen={addFilteredToCollectionOpen}
          onAddFilteredToCollectionToggle={() => {
            setAddFilteredToCollectionFeedback(null);
            setAddFilteredToCollectionOpen((current) => !current);
          }}
          addFilteredToCollectionFeedback={addFilteredToCollectionFeedback}
          onAddFilteredToCollectionFeedback={setAddFilteredToCollectionFeedback}
          runMacroOnFilteredOpen={runMacroOnFilteredOpen}
          onRunMacroOnFilteredToggle={() => {
            setRunMacroOnFilteredFeedback(null);
            setRunMacroOnFilteredOpen((current) => !current);
          }}
          runMacroOnFilteredFeedback={runMacroOnFilteredFeedback}
          onRunMacroOnFilteredFeedback={setRunMacroOnFilteredFeedback}
          canResetWorkspace={canResetWorkspace}
          onResetWorkspace={handleResetWorkspace}
        />
        <div className="vera5-popup-triage" aria-label="Triage">
          {trayView ? (
            <section
              className="vera5-triage-section vera5-section-frame"
              aria-label="Detected indicators"
              data-vera5-section-expanded={detectedIndicatorsExpanded ? "true" : "false"}
            >
              <div className="vera5-section-header vera5-triage-heading-row">
                <div className="vera5-section-identity">
                  <h2 className="vera5-section-title" id="vera5-detected-indicators-title">
                    <span className="vera5-section-icon" aria-hidden="true">
                      <VeraIcon icon={VeraUiIcons.detectedSection} size="sm" />
                    </span>
                    Detected indicators
                  </h2>
                </div>
                <div className="vera5-section-utilities vera5-triage-header-utilities">
                  {!compactIndicatorQueue ? (
                    <div
                      className="vera5-triage-profile"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <span
                        aria-label={`Page profile: ${activePageContextBadgeLabel}. ${activePageContextSourceLabel}.`}
                        title={`Active page profile: ${activePageContextBadgeLabel} (${activePageContextSourceLabel.toLowerCase()})`}
                        style={pageContextBadgeStyle({
                          isOverride: activePageContextOverrideActive,
                        })}
                      >
                        {activePageContextBadgeLabel}
                      </span>
                      {activePageContextOverrideActive ? (
                        <button
                          type="button"
                          aria-label="Reset page profile to auto-detect"
                          title="Profile override active. Reset to auto-detect."
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            border: `1px solid ${POPUP_THEME.border}`,
                            borderRadius: 4,
                            background: POPUP_THEME.secondaryBg,
                            color: POPUP_THEME.accent,
                            fontSize: 13,
                            lineHeight: 1,
                            cursor: "pointer",
                          }}
                          onClick={handleResetActivePageContextOverride}
                        >
                          ↺
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="vera5-section-collapse"
                    aria-expanded={detectedIndicatorsExpanded}
                    aria-controls="vera5-detected-indicators-body"
                    aria-label={
                      detectedIndicatorsExpanded
                        ? "Collapse Detected Indicators"
                        : "Expand Detected Indicators"
                    }
                    onClick={() => setDetectedIndicatorsExpanded((open) => !open)}
                  >
                    <VeraIcon
                      icon={
                        detectedIndicatorsExpanded
                          ? VeraUiIcons.chevron
                          : VeraUiIcons.chevronRight
                      }
                      size="xs"
                    />
                  </button>
                </div>
              </div>
              {detectedIndicatorsExpanded ? (
                <>
                  <hr className="vera5-section-divider" aria-hidden="true" />
                  <div id="vera5-detected-indicators-body">
                    {trayView === "prompt" || trayView === "scanning" || trayView === "empty" ? (
                      <p style={trayStatusStyle()} aria-live="polite">
                        {resolveDetectedIndicatorsStatusCopy(scanPresentation)}
                      </p>
                    ) : null}
                    {trayView === "results" && scanSummary ? (
                      <>
                        <div
                          className="vera5-triage-filters vera5-segmented"
                          role="group"
                          aria-label={`Filter by indicator type. ${buildTabScanCountSummaryText(
                            scanSummary,
                            activePageContextType
                          )}`}
                          style={{
                            marginBottom: 10,
                          }}
                        >
                          <button
                            type="button"
                            data-ioc-type="all"
                            aria-pressed={!trayShowSuppressed && typeFilter === "all"}
                            onClick={() => {
                              setTrayShowSuppressed(false);
                              setTypeFilter("all");
                            }}
                            style={filterChipStyle(!trayShowSuppressed && typeFilter === "all")}
                          >
                            All ({scanSummary.totalCount})
                          </button>
                          {listIocTypesPresentInSummaryForPageContext(
                            scanSummary,
                            activePageContextType
                          ).map((type) => (
                            <button
                              key={type}
                              type="button"
                              data-ioc-type={type}
                              aria-pressed={!trayShowSuppressed && typeFilter === type}
                              onClick={() => {
                                setTrayShowSuppressed(false);
                                setTypeFilter(type);
                              }}
                              style={filterChipStyle(!trayShowSuppressed && typeFilter === type)}
                            >
                              {IOC_TYPE_TRAY_LABEL[type]} ({scanSummary.countByType[type] ?? 0})
                            </button>
                          ))}
                          <button
                            type="button"
                            data-ioc-type="suppressed"
                            data-vera5-tray-suppressed-filter="true"
                            aria-pressed={trayShowSuppressed}
                            title={whyStillVisibleTooltip}
                            onClick={() => setTrayShowSuppressed(true)}
                            style={filterChipStyle(trayShowSuppressed)}
                          >
                            SUPPRESSED ({suppressedTrayEntries.length})
                          </button>
                        </div>
                        <label className="vera5-ioc-search">
                          <span className="vera5-ioc-search-icon" aria-hidden="true">
                            <VeraIcon icon={VeraUiIcons.search} size="xs" />
                          </span>
                          <span className="vera5-visually-hidden">Search indicators</span>
                          <input
                            type="search"
                            value={iocSearchQuery}
                            placeholder="Search indicators…"
                            aria-label="Search indicators"
                            onChange={(event) => setIocSearchQuery(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape" && iocSearchQuery) {
                                event.preventDefault();
                                setIocSearchQuery("");
                              }
                            }}
                          />
                          {iocSearchQuery ? (
                            <button
                              type="button"
                              className="vera5-ioc-search-clear"
                              aria-label="Clear indicator search"
                              onClick={() => setIocSearchQuery("")}
                            >
                              <VeraIcon icon={VeraUiIcons.clear} size="xs" />
                            </button>
                          ) : null}
                        </label>
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
                        {visibleTrayEntries.length > 0 ? (
                          <ul
                            ref={iocQueueRef}
                            className={
                              trayShowSuppressed
                                ? "vera5-ioc-queue vera5-ioc-queue--suppressed"
                                : "vera5-ioc-queue"
                            }
                            style={{
                              listStyle: "none",
                              margin: 0,
                              padding: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {visibleTrayEntries.map(({ entry, noiseSuppressed }) =>
                              renderTrayEntryRow(entry, { noiseSuppressed })
                            )}
                          </ul>
                        ) : iocSearchNeedle ? (
                          <p style={trayStatusStyle()}>
                            No indicators match “{iocSearchQuery.trim()}”.
                          </p>
                        ) : trayShowSuppressed ? (
                          <p style={trayStatusStyle()}>No suppressed indicators.</p>
                        ) : filteredEntries.length > 0 ? (
                          <p style={trayStatusStyle()}>
                            All matching indicators are listed under Suppressed.
                          </p>
                        ) : (
                          <p style={trayStatusStyle()}>No indicators match this filter.</p>
                        )}
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
        </div>
        <div className="vera5-popup-detail" aria-label="Investigation paths">
          <InvestigationPaths
            key={workspaceGeneration}
            entry={selectedDetailEntry}
            loading={intelFeedLoading || detailEnrichState === "enriching"}
            availability={intelSourceAvailability}
            pageIndicatorCount={investigationPageIndicatorCount}
            priorSightingCount={investigationPriorSightingCount}
            suppressed={investigationSelectedSuppressed}
            scanPresentation={scanPresentation}
            onReviewDetections={() => {
              if (selectedDetailEntry) {
                navigateToTrayEntry(selectedDetailEntry);
              }
            }}
          />
        </div>
      </div>
      </div>
      <footer className="vera5-workspace-footer" role="contentinfo" aria-label="Workspace status">
        <div className="vera5-workspace-footer-meta">
          <span className="vera5-workspace-footer-version">Vera5 v{extensionVersion}</span>
          <span
            className="vera5-workspace-footer-status"
            data-vera5-footer-state={ready ? "ready" : "loading"}
          >
            {ready ? "Ready" : "Loading…"}
          </span>
          <span
            className="vera5-workspace-footer-status"
            data-vera5-footer-state={quietModeActive ? "quiet" : "live"}
          >
            {quietModeActive ? "Quiet mode" : "Threat feeds: Live"}
          </span>
          <span
            className="vera5-workspace-footer-status"
            data-vera5-footer-state={enabled ? "enabled" : "disabled"}
          >
            {enabled ? "Extension: Enabled" : "Extension: Disabled"}
          </span>
        </div>
        <span className="vera5-workspace-footer-privacy">All data cached locally</span>
      </footer>
    </main>
  );
}
