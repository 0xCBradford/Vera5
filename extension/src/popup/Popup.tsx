import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  navigateToIocAnchorMessage,
  enrichIocMessage,
  enrichSelectionMessage,
  getSelectionActionStateMessage,
  reopenInvestigationHistoryMessage,
  runOperatorMacroMessage,
  scanPageMessage,
  scanSelectionMessage,
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
import { getTabScanTrayFilter, saveTabScanTrayFilter } from "../lib/tabScanSnapshotStorage";
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
  findTabScanSummaryEntryForCollectionMember,
  findTabScanSummaryEntryForIndicatorValue,
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
  formatNoiseRulesTraySuppressedSummary,
  NOISE_RULES_TRAY_SUPPRESSED_SECTION_HINT,
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
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  buildInvestigationSessionActivitySummaryText,
  INVESTIGATION_SESSION_EMPTY_STATE_TEXT,
  listInvestigationSessionIocMembers,
  normalizeInvestigationSessionIocTimelineKey,
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
  INVESTIGATION_SESSION_EXPORT_IOC_ONLY_DESCRIPTION,
  INVESTIGATION_SESSION_EXPORT_IOC_ONLY_LABEL,
  INVESTIGATION_SESSION_EXPORT_SCOPE,
  type InvestigationSessionExportFormat,
} from "../lib/investigationSessionExport";
import {
  copyInvestigationTimelineExportAppendixToClipboard,
  copyInvestigationTimelineExportJsonToClipboard,
  downloadInvestigationTimelineExportAppendixFile,
  downloadInvestigationTimelineExportJsonFile,
  INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS,
  resolveInvestigationTimelineExportCopyFeedback,
  resolveInvestigationTimelineExportDownloadFeedback,
  resolveInvestigationTimelineJsonExportCopyFeedback,
  resolveInvestigationTimelineJsonExportDownloadFeedback,
  SESSION_TIMELINE_COPY_APPENDIX_LABEL,
  SESSION_TIMELINE_COPY_JSON_LABEL,
  SESSION_TIMELINE_DOWNLOAD_APPENDIX_LABEL,
  SESSION_TIMELINE_DOWNLOAD_JSON_LABEL,
  SESSION_TIMELINE_EXPORT_GROUP_ARIA_LABEL,
  SESSION_TIMELINE_EXPORT_SECTION_LABEL,
  SESSION_TIMELINE_EXPORT_TEMPLATE_LABEL,
  SESSION_TIMELINE_JSON_EXPORT_GROUP_ARIA_LABEL,
  type InvestigationTimelineMarkdownTemplateId,
  type InvestigationTimelineExportInput,
} from "../lib/investigationTimelineExport";
import {
  listStoredInvestigationSessions,
  recordActiveInvestigationSessionExportEvent,
} from "../lib/investigationSessionStorage";
import { getExportTemplateLabel } from "../lib/exportTemplates";
import {
  NOTEBOOK_FRAGMENT_ADD_LABEL,
  NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL,
  NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER,
  NOTEBOOK_FRAGMENT_BODY_REQUIRED_ERROR,
  NOTEBOOK_FRAGMENT_CANCEL_LABEL,
  NOTEBOOK_FRAGMENT_DELETE_CONFIRM_TEXT,
  NOTEBOOK_FRAGMENT_DELETE_LABEL,
  NOTEBOOK_FRAGMENT_DELETED_FEEDBACK,
  NOTEBOOK_FRAGMENT_EDIT_LABEL,
  NOTEBOOK_FRAGMENT_SAVE_LABEL,
  NOTEBOOK_FRAGMENT_SAVED_FEEDBACK,
  NOTEBOOK_FRAGMENT_TEXT_ONLY_EMPTY_HINT,
  NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL,
  POPUP_SESSION_NOTEBOOK_EMPTY_TEXT,
  POPUP_SESSION_NOTEBOOK_LIST_ARIA_LABEL,
  POPUP_SESSION_NOTEBOOK_SEARCH_LABEL,
  POPUP_SESSION_NOTEBOOK_SEARCH_NO_MATCHES_TEXT,
  POPUP_SESSION_NOTEBOOK_SEARCH_PLACEHOLDER,
  POPUP_SESSION_NOTEBOOK_SECTION_LABEL,
  addNotebookFragmentForSession,
  buildNotebookFragmentEmptyStateView,
  defaultNotebookFragmentType,
  deleteNotebookFragment,
  editNotebookFragment,
  filterPopupSessionNotebookTimelineRowsBySearchText,
  listNotebookFragmentTypeOptions,
  loadPopupSessionNotebookFragmentTimeline,
  type PopupSessionNotebookTimelineRow,
} from "../lib/hoverCardNotebook";
import {
  STORAGE_KEY_NOTEBOOK_FRAGMENTS,
  getNotebookFragmentsStore,
  type NotebookFragmentsStore,
} from "../lib/notebookFragmentStorage";
import {
  appendNotebookFragmentMarkdownLite,
  type NotebookFragmentType,
} from "../lib/notebookFragment";
import {
  buildTimelineEventNavigationAriaLabel,
  buildTimelineEventRowAriaLabel,
  createDefaultTimelineEventFilter,
  filterTimelineEvents,
  formatTimelineEventIocLabel,
  formatTimelineEventTimestamp,
  formatTimelineEventTypeLabel,
  isTimelineEventNavigable,
  listTimelineEventIocFilterOptions,
  readTimelineEventFilterDateTimeLocal,
  SESSION_TIMELINE_EMPTY_TEXT,
  SESSION_TIMELINE_FILTER_ALL_IOCS_LABEL,
  SESSION_TIMELINE_FILTER_ALL_TYPES_LABEL,
  SESSION_TIMELINE_FILTER_GROUP_ARIA_LABEL,
  SESSION_TIMELINE_FILTER_NO_MATCHES_TEXT,
  SESSION_TIMELINE_IOC_FILTER_LABEL,
  SESSION_TIMELINE_LIST_ARIA_LABEL,
  SESSION_TIMELINE_SECTION_LABEL,
  SESSION_TIMELINE_TIME_RANGE_END_LABEL,
  SESSION_TIMELINE_TIME_RANGE_START_LABEL,
  SESSION_TIMELINE_TYPE_FILTER_LABEL,
  sortTimelineEventsChronologically,
  TIMELINE_EVENT_IOC_FILTER_ALL,
  TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE,
  TIMELINE_EVENT_TYPE_FILTER_ALL,
  TIMELINE_EVENT_TYPE_ORDER,
  timelineEventHasSessionScopeEntries,
  type TimelineEvent,
  type TimelineEventTypeFilter,
} from "../lib/timelineEvent";
import {
  buildReplaySegmentDetailView,
  buildReplayStepJumpAriaLabel,
  clampReplayStepIndex,
  copyInvestigationReplayTranscriptToClipboard,
  downloadInvestigationReplayTranscriptFile,
  formatReplayStepListLabel,
  formatReplayStepPositionLabel,
  ingestReplaySegmentsFromInvestigationSession,
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
import type { NormalizedEnrichmentRecord } from "../lib/enrichmentExport";
import {
  buildInvestigationHistoryRowAriaLabel,
  buildInvestigationHistorySessionLinkSummary,
  countInvestigationHistoryEntriesForSession,
  formatInvestigationHistoryTimestamp,
  INVESTIGATION_HISTORY_CLEAR_CONFIRM_MESSAGE,
  isInvestigationHistoryEntryLinkedToActiveSession,
  resolveInvestigationHistoryClearFeedback,
  resolveInvestigationHistoryReopenFeedback,
  resolveInvestigationHistorySessionTitle,
  type InvestigationHistoryEntry,
} from "../lib/investigationHistory";
import {
  listInvestigationHistoryEntries,
  clearInvestigationHistory,
} from "../lib/investigationHistoryStorage";
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
import {
  clearEnrichmentCacheForSource,
  readStoredEnrichmentSourceResult,
  STORAGE_KEY_ENRICHMENT_CACHE,
} from "../lib/cache";
import { requestEnrichmentSourceOps } from "../lib/enrichmentSourceOpsClient";
import {
  formatEnrichmentCacheClearedAtLabel,
  formatEnrichmentSourceCacheEntryCountLabel,
  formatEnrichmentSourceLastErrorLabel,
  formatEnrichmentSourceLastStatusLabel,
  formatEnrichmentSourceOpsCooldownLabel,
  resolveEnrichmentSourceClearCacheFeedback,
  ENRICHMENT_SOURCE_OPS_SECTION_TITLE,
  type EnrichmentSourceOpsRow,
  type EnrichmentSourceOpsSnapshot,
} from "../lib/enrichmentSourceOps";
import { clearPopupPanelFocus, POPUP_PANEL, readPopupPanelFocus } from "../lib/popupPanelFocus";
import { VERA5_COLOR, VERA5_FONT, VERA5_RADIUS, VERA5_SPACE } from "../lib/theme";
import {
  resolveWorkspaceTrayView,
  resolveCollectionMemberOpenFeedback,
  resolveTrayNavigationFeedback,
} from "../lib/workspaceTrayState";
import {
  ENRICHMENT_ASSESSMENT_KIND,
  ENRICHMENT_SOURCE_ORDER,
  enrichmentSourceSupportsIocType,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import type { EnrichmentSourceResult } from "../lib/enrichment";
import { buildHoverCardRiskScoreView, formatCompositeRiskLabelDisplay } from "../lib/scoring";
import { getPivotLinks, type PivotLink } from "../lib/pivots";

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
  entries: TabScanSummaryEntry[];
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
      onFeedback(
        formatPromoteSessionToCollectionFeedback({
          collectionName: collectionName.trim() || session.title,
          addedCount: 0,
          duplicateCount: 0,
          totalCount: 0,
        })
      );
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

function InvestigationSessionTimelinePanel({
  sessionId,
  sessionTitle,
  sessionPageUrl,
  events,
  onActivateEvent,
  navigationMessage,
}: {
  sessionId: string;
  sessionTitle: string;
  sessionPageUrl: string;
  events: readonly TimelineEvent[];
  onActivateEvent?: (event: TimelineEvent) => void;
  navigationMessage?: string | null;
}) {
  const [filter, setFilter] = useState(createDefaultTimelineEventFilter);
  const [timeRangeStartInput, setTimeRangeStartInput] = useState("");
  const [timeRangeEndInput, setTimeRangeEndInput] = useState("");
  const [exportTemplateId, setExportTemplateId] =
    useState<InvestigationTimelineMarkdownTemplateId>("markdown-report");
  const [timelineExportMessage, setTimelineExportMessage] = useState<string | null>(null);

  useEffect(() => {
    setFilter(createDefaultTimelineEventFilter());
    setTimeRangeStartInput("");
    setTimeRangeEndInput("");
    setExportTemplateId("markdown-report");
    setTimelineExportMessage(null);
  }, [sessionId]);

  const iocOptions = useMemo(() => listTimelineEventIocFilterOptions(events), [events]);
  const showSessionScopeOption = useMemo(
    () => timelineEventHasSessionScopeEntries(events),
    [events]
  );
  const filteredEvents = useMemo(() => filterTimelineEvents(events, filter), [events, filter]);

  const buildTimelineExportInput = (): InvestigationTimelineExportInput => ({
    session: {
      id: sessionId,
      title: sessionTitle,
      pageUrl: sessionPageUrl,
    },
    events: filteredEvents,
  });

  const handleCopyTimelineAppendix = () => {
    const exportInput = buildTimelineExportInput();

    void (async () => {
      const copied = await copyInvestigationTimelineExportAppendixToClipboard(
        exportTemplateId,
        exportInput
      );
      setTimelineExportMessage(
        resolveInvestigationTimelineExportCopyFeedback({
          copied,
          eventCount: filteredEvents.length,
          templateId: exportTemplateId,
        })
      );
    })();
  };

  const handleDownloadTimelineAppendix = () => {
    const exportInput = buildTimelineExportInput();

    const downloaded = downloadInvestigationTimelineExportAppendixFile(
      exportTemplateId,
      exportInput
    );
    setTimelineExportMessage(
      resolveInvestigationTimelineExportDownloadFeedback({
        downloaded,
        eventCount: filteredEvents.length,
        templateId: exportTemplateId,
      })
    );
  };

  const handleCopyTimelineJson = () => {
    const exportInput = buildTimelineExportInput();

    void (async () => {
      const copied = await copyInvestigationTimelineExportJsonToClipboard(exportInput);
      setTimelineExportMessage(
        resolveInvestigationTimelineJsonExportCopyFeedback({
          copied,
          eventCount: filteredEvents.length,
        })
      );
    })();
  };

  const handleDownloadTimelineJson = () => {
    const exportInput = buildTimelineExportInput();

    const downloaded = downloadInvestigationTimelineExportJsonFile(exportInput);
    setTimelineExportMessage(
      resolveInvestigationTimelineJsonExportDownloadFeedback({
        downloaded,
        eventCount: filteredEvents.length,
      })
    );
  };

  const filterFieldStyle: CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${POPUP_THEME.border}`,
    backgroundColor: POPUP_THEME.buttonBg,
    color: POPUP_THEME.text,
    boxSizing: "border-box",
    fontSize: 12,
  };

  const renderTimelineEvent = (event: TimelineEvent, index: number) => {
    const navigable = isTimelineEventNavigable(event) && onActivateEvent !== undefined;

    return (
      <li
        key={`${event.timestamp}-${event.type}-${event.iocKey}-${index}`}
        role={navigable ? "button" : undefined}
        tabIndex={navigable ? 0 : undefined}
        aria-label={
          navigable
            ? buildTimelineEventNavigationAriaLabel(event)
            : buildTimelineEventRowAriaLabel(event)
        }
        onClick={
          navigable
            ? () => {
                onActivateEvent?.(event);
              }
            : undefined
        }
        onKeyDown={
          navigable
            ? (keyboardEvent) => {
                if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
                  return;
                }
                keyboardEvent.preventDefault();
                onActivateEvent?.(event);
              }
            : undefined
        }
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "6px 8px",
          borderRadius: 6,
          backgroundColor: POPUP_THEME.trayRowBg,
          fontSize: 12,
          lineHeight: 1.4,
          cursor: navigable ? "pointer" : "default",
        }}
      >
        <span style={{ color: POPUP_THEME.muted }}>
          {formatTimelineEventTimestamp(event.timestamp)}
        </span>
        <span style={{ color: POPUP_THEME.text }}>
          {formatTimelineEventTypeLabel(event.type)} ·{" "}
          <span style={{ fontFamily: VERA5_FONT.mono, wordBreak: "break-all" }}>
            {formatTimelineEventIocLabel(event.iocKey)}
          </span>
        </span>
        {event.sourceAttributionSummary ? (
          <span style={{ color: POPUP_THEME.muted }}>{event.sourceAttributionSummary}</span>
        ) : null}
        {event.templateId ? (
          <span style={{ color: POPUP_THEME.muted }}>
            Template: {getExportTemplateLabel(event.templateId)}
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          margin: "0 0 8px",
          color: POPUP_THEME.accentText,
        }}
      >
        {SESSION_TIMELINE_SECTION_LABEL}
      </h3>
      {events.length === 0 ? (
        <p style={{ ...trayStatusStyle(), margin: 0 }} aria-live="polite">
          {SESSION_TIMELINE_EMPTY_TEXT}
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label={SESSION_TIMELINE_FILTER_GROUP_ARIA_LABEL}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
              }}
            >
              {SESSION_TIMELINE_IOC_FILTER_LABEL}
              <select
                value={filter.iocKey}
                aria-label={SESSION_TIMELINE_IOC_FILTER_LABEL}
                onChange={(event) => {
                  setFilter((current) => ({
                    ...current,
                    iocKey: event.target.value,
                  }));
                }}
                style={filterFieldStyle}
              >
                <option value={TIMELINE_EVENT_IOC_FILTER_ALL}>
                  {SESSION_TIMELINE_FILTER_ALL_IOCS_LABEL}
                </option>
                {showSessionScopeOption ? (
                  <option value={TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE}>Session scope</option>
                ) : null}
                {iocOptions.map((iocKey) => (
                  <option key={iocKey} value={iocKey}>
                    {iocKey}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
              }}
            >
              {SESSION_TIMELINE_TYPE_FILTER_LABEL}
              <select
                value={filter.eventType}
                aria-label={SESSION_TIMELINE_TYPE_FILTER_LABEL}
                onChange={(event) => {
                  setFilter((current) => ({
                    ...current,
                    eventType: event.target.value as TimelineEventTypeFilter,
                  }));
                }}
                style={filterFieldStyle}
              >
                <option value={TIMELINE_EVENT_TYPE_FILTER_ALL}>
                  {SESSION_TIMELINE_FILTER_ALL_TYPES_LABEL}
                </option>
                {TIMELINE_EVENT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {formatTimelineEventTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
              }}
            >
              {SESSION_TIMELINE_TIME_RANGE_START_LABEL}
              <input
                type="datetime-local"
                value={timeRangeStartInput}
                aria-label={SESSION_TIMELINE_TIME_RANGE_START_LABEL}
                onChange={(event) => {
                  const value = event.target.value;
                  setTimeRangeStartInput(value);
                  setFilter((current) => ({
                    ...current,
                    timeRangeStart: readTimelineEventFilterDateTimeLocal(value),
                  }));
                }}
                style={filterFieldStyle}
              />
            </label>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
              }}
            >
              {SESSION_TIMELINE_TIME_RANGE_END_LABEL}
              <input
                type="datetime-local"
                value={timeRangeEndInput}
                aria-label={SESSION_TIMELINE_TIME_RANGE_END_LABEL}
                onChange={(event) => {
                  const value = event.target.value;
                  setTimeRangeEndInput(value);
                  setFilter((current) => ({
                    ...current,
                    timeRangeEnd: readTimelineEventFilterDateTimeLocal(value),
                  }));
                }}
                style={filterFieldStyle}
              />
            </label>
          </div>
          {filteredEvents.length === 0 ? (
            <p style={{ ...trayStatusStyle(), margin: 0 }} aria-live="polite">
              {SESSION_TIMELINE_FILTER_NO_MATCHES_TEXT}
            </p>
          ) : (
            <>
              <ol
                aria-label={SESSION_TIMELINE_LIST_ARIA_LABEL}
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
                {filteredEvents.map((event, index) => renderTimelineEvent(event, index))}
              </ol>
              {navigationMessage ? (
                <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "8px 0 0" }}>
                  {navigationMessage}
                </p>
              ) : null}
            </>
          )}
          <div style={{ marginTop: 10 }}>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                margin: "0 0 8px",
                color: POPUP_THEME.accentText,
              }}
            >
              {SESSION_TIMELINE_EXPORT_SECTION_LABEL}
            </h4>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: POPUP_THEME.text,
                marginBottom: 8,
              }}
            >
              {SESSION_TIMELINE_EXPORT_TEMPLATE_LABEL}
              <select
                value={exportTemplateId}
                aria-label={SESSION_TIMELINE_EXPORT_TEMPLATE_LABEL}
                onChange={(event) => {
                  setTimelineExportMessage(null);
                  setExportTemplateId(
                    event.target.value as InvestigationTimelineMarkdownTemplateId
                  );
                }}
                style={filterFieldStyle}
              >
                {INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS.map((templateId) => (
                  <option key={templateId} value={templateId}>
                    {getExportTemplateLabel(templateId)}
                  </option>
                ))}
              </select>
            </label>
            <div
              role="group"
              aria-label={SESSION_TIMELINE_EXPORT_GROUP_ARIA_LABEL}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: timelineExportMessage ? 8 : 0,
              }}
            >
              <button
                type="button"
                disabled={filteredEvents.length === 0}
                onClick={handleCopyTimelineAppendix}
                style={sessionActionButtonStyle()}
              >
                {SESSION_TIMELINE_COPY_APPENDIX_LABEL}
              </button>
              <button
                type="button"
                disabled={filteredEvents.length === 0}
                onClick={handleDownloadTimelineAppendix}
                style={sessionActionButtonStyle()}
              >
                {SESSION_TIMELINE_DOWNLOAD_APPENDIX_LABEL}
              </button>
            </div>
            <div
              role="group"
              aria-label={SESSION_TIMELINE_JSON_EXPORT_GROUP_ARIA_LABEL}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
                marginBottom: timelineExportMessage ? 8 : 0,
              }}
            >
              <button
                type="button"
                disabled={filteredEvents.length === 0}
                onClick={handleCopyTimelineJson}
                style={sessionActionButtonStyle()}
              >
                {SESSION_TIMELINE_COPY_JSON_LABEL}
              </button>
              <button
                type="button"
                disabled={filteredEvents.length === 0}
                onClick={handleDownloadTimelineJson}
                style={sessionActionButtonStyle()}
              >
                {SESSION_TIMELINE_DOWNLOAD_JSON_LABEL}
              </button>
            </div>
            {timelineExportMessage ? (
              <p aria-live="polite" style={{ ...trayStatusStyle(), margin: 0 }}>
                {timelineExportMessage}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function NotebookFragmentMarkdownBody({ body, title }: { body: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    appendNotebookFragmentMarkdownLite(container, body, document);
  }, [body]);

  return (
    <div
      ref={containerRef}
      title={title}
      style={{
        color: POPUP_THEME.text,
        wordBreak: "break-word",
        fontSize: 12,
        lineHeight: 1.45,
      }}
    />
  );
}

function InvestigationSessionNotebookTimelinePanel({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<PopupSessionNotebookTimelineRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draftType, setDraftType] = useState<NotebookFragmentType>(defaultNotebookFragmentType);
  const [draftBody, setDraftBody] = useState("");
  const [editingFragmentId, setEditingFragmentId] = useState<string | null>(null);
  const [editType, setEditType] = useState<NotebookFragmentType>(defaultNotebookFragmentType);
  const [editBody, setEditBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSearchQuery("");
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void loadPopupSessionNotebookFragmentTimeline(sessionId)
        .then((view) => {
          if (cancelled) {
            return;
          }
          setRows(view.fragments);
          setLoaded(true);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setRows([]);
          setLoaded(true);
        });
    };

    setLoaded(false);
    refresh();

    const onChanged = chrome.storage?.onChanged;
    if (!onChanged?.addListener) {
      return () => {
        cancelled = true;
      };
    }

    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local" || !changes[STORAGE_KEY_NOTEBOOK_FRAGMENTS]) {
        return;
      }
      refresh();
    };
    onChanged.addListener(listener);
    return () => {
      cancelled = true;
      onChanged.removeListener?.(listener);
    };
  }, [sessionId]);

  const reloadRows = async (): Promise<void> => {
    try {
      const view = await loadPopupSessionNotebookFragmentTimeline(sessionId);
      setRows(view.fragments);
      setLoaded(true);
    } catch {
      setRows([]);
      setLoaded(true);
    }
  };

  const handleAdd = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    void (async () => {
      const result = await addNotebookFragmentForSession({
        sessionId,
        type: draftType,
        body: draftBody,
      });
      setBusy(false);
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }
      setDraftBody("");
      setDraftType(defaultNotebookFragmentType());
      setFeedback(NOTEBOOK_FRAGMENT_SAVED_FEEDBACK);
      await reloadRows();
    })();
  };

  const handleSaveEdit = () => {
    if (!editingFragmentId || busy) {
      return;
    }
    setBusy(true);
    void (async () => {
      const result = await editNotebookFragment({
        fragmentId: editingFragmentId,
        type: editType,
        body: editBody,
      });
      setBusy(false);
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }
      setEditingFragmentId(null);
      setFeedback(NOTEBOOK_FRAGMENT_SAVED_FEEDBACK);
      await reloadRows();
    })();
  };

  const handleDelete = (row: PopupSessionNotebookTimelineRow) => {
    if (busy) {
      return;
    }
    const confirmed =
      typeof window.confirm === "function"
        ? window.confirm(NOTEBOOK_FRAGMENT_DELETE_CONFIRM_TEXT)
        : true;
    if (!confirmed) {
      return;
    }
    setBusy(true);
    void (async () => {
      const result = await deleteNotebookFragment(row.fragmentId);
      setBusy(false);
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }
      if (editingFragmentId === row.fragmentId) {
        setEditingFragmentId(null);
      }
      setFeedback(NOTEBOOK_FRAGMENT_DELETED_FEEDBACK);
      await reloadRows();
    })();
  };

  const typeOptions = listNotebookFragmentTypeOptions();
  const filteredRows = filterPopupSessionNotebookTimelineRowsBySearchText(rows, searchQuery);
  const searchActive = searchQuery.trim().length > 0;
  const filterFieldStyle: CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    boxSizing: "border-box",
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${POPUP_THEME.border}`,
    backgroundColor: POPUP_THEME.surface,
    color: POPUP_THEME.text,
  };

  return (
    <div id="popup-session-notebook" style={{ marginTop: 10, marginBottom: 10 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          margin: "0 0 8px",
          color: POPUP_THEME.accentText,
        }}
      >
        {POPUP_SESSION_NOTEBOOK_SECTION_LABEL}
      </h3>
      {loaded && rows.length > 0 ? (
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: POPUP_THEME.text,
            marginBottom: 8,
          }}
        >
          {POPUP_SESSION_NOTEBOOK_SEARCH_LABEL}
          <input
            type="search"
            value={searchQuery}
            placeholder={POPUP_SESSION_NOTEBOOK_SEARCH_PLACEHOLDER}
            aria-label={POPUP_SESSION_NOTEBOOK_SEARCH_LABEL}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={filterFieldStyle}
          />
        </label>
      ) : null}
      {!loaded ? null : rows.length === 0 ? (
        <div
          role="status"
          data-vera5-notebook-empty="true"
          aria-live="polite"
          style={{ margin: 0 }}
        >
          <p style={{ ...trayStatusStyle(), margin: 0 }}>{POPUP_SESSION_NOTEBOOK_EMPTY_TEXT}</p>
          <p style={{ ...trayStatusStyle(), margin: "4px 0 0" }}>
            {NOTEBOOK_FRAGMENT_TEXT_ONLY_EMPTY_HINT}
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <p
          role="status"
          data-vera5-notebook-empty={searchActive ? "search" : "true"}
          style={{ ...trayStatusStyle(), margin: 0 }}
          aria-live="polite"
        >
          {searchActive
            ? POPUP_SESSION_NOTEBOOK_SEARCH_NO_MATCHES_TEXT
            : buildNotebookFragmentEmptyStateView({
                primaryText: POPUP_SESSION_NOTEBOOK_EMPTY_TEXT,
              }).composedText}
        </p>
      ) : (
        <ol
          aria-label={POPUP_SESSION_NOTEBOOK_LIST_ARIA_LABEL}
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
          {filteredRows.map((row) => (
            <li
              key={row.fragmentId}
              title={row.hint}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "6px 8px",
                border: `1px solid ${POPUP_THEME.border}`,
                borderRadius: 6,
                backgroundColor: POPUP_THEME.surface,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {editingFragmentId === row.fragmentId ? (
                <>
                  <label style={{ color: POPUP_THEME.text }}>
                    {NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL}
                    <select
                      aria-label={NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL}
                      value={editType}
                      onChange={(event) => setEditType(event.target.value as NotebookFragmentType)}
                      style={filterFieldStyle}
                    >
                      {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ color: POPUP_THEME.text, marginTop: 6 }}>
                    {NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL}
                    <textarea
                      aria-label={NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL}
                      value={editBody}
                      rows={3}
                      onChange={(event) => setEditBody(event.target.value)}
                      style={{ ...filterFieldStyle, resize: "vertical" }}
                    />
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSaveEdit}
                      style={sessionActionButtonStyle()}
                    >
                      {NOTEBOOK_FRAGMENT_SAVE_LABEL}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingFragmentId(null)}
                      style={sessionActionButtonStyle()}
                    >
                      {NOTEBOOK_FRAGMENT_CANCEL_LABEL}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ color: POPUP_THEME.muted }}>{row.createdAtLabel}</span>
                  <span style={{ color: POPUP_THEME.text }}>
                    {row.typeLabel}
                    {row.showStatusBadge && row.statusBadgeLabel ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          color: POPUP_THEME.accentText,
                        }}
                      >
                        {row.statusBadgeLabel}
                      </span>
                    ) : null}
                  </span>
                  <NotebookFragmentMarkdownBody body={row.fullBody} title={row.fullBody} />
                  {row.authorLabel ? (
                    <span style={{ color: POPUP_THEME.muted }}>{row.authorLabel}</span>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${NOTEBOOK_FRAGMENT_EDIT_LABEL} ${row.typeLabel}`}
                      onClick={() => {
                        setEditingFragmentId(row.fragmentId);
                        setEditType(row.type);
                        setEditBody(row.fullBody);
                        setFeedback(null);
                      }}
                      style={sessionActionButtonStyle()}
                    >
                      {NOTEBOOK_FRAGMENT_EDIT_LABEL}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${NOTEBOOK_FRAGMENT_DELETE_LABEL} ${row.typeLabel}`}
                      onClick={() => handleDelete(row)}
                      style={sessionActionButtonStyle()}
                    >
                      {NOTEBOOK_FRAGMENT_DELETE_LABEL}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <div role="group" aria-label="Add notebook fragment" style={{ marginTop: 10 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: POPUP_THEME.text,
            marginBottom: 8,
          }}
        >
          {NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL}
          <select
            aria-label={NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL}
            value={draftType}
            onChange={(event) => setDraftType(event.target.value as NotebookFragmentType)}
            style={filterFieldStyle}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: POPUP_THEME.text,
            marginBottom: 8,
          }}
        >
          {NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL}
          <textarea
            aria-label={NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL}
            value={draftBody}
            rows={3}
            placeholder={NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER}
            onChange={(event) => setDraftBody(event.target.value)}
            style={{ ...filterFieldStyle, resize: "vertical" }}
          />
        </label>
        <button
          type="button"
          disabled={busy || draftBody.trim().length === 0}
          onClick={handleAdd}
          style={sessionActionButtonStyle()}
          title={draftBody.trim().length === 0 ? NOTEBOOK_FRAGMENT_BODY_REQUIRED_ERROR : undefined}
        >
          {NOTEBOOK_FRAGMENT_ADD_LABEL}
        </button>
      </div>
      {feedback ? (
        <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "8px 0 0" }}>
          {feedback}
        </p>
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

function CollectionsManagerPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [collections, setCollections] = useState<IocCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [collectionsCollapsed, setCollectionsCollapsed] = useState(true);

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

  const handleRemoveMember = (collectionId: string, member: IocCollectionMember) => {
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
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
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
      const entry = summary ? findTabScanSummaryEntryForCollectionMember(summary, member) : null;
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
        marginTop: 10,
        borderTop: `1px solid ${POPUP_THEME.border}`,
        paddingTop: 10,
      }}
    >
      <h2
        className={embedded ? "vera5-visually-hidden" : "vera5-casework-panel-title"}
        style={{ margin: "0 0 6px" }}
      >
        {embedded ? (
          IOC_COLLECTION_MANAGER_SECTION_LABEL
        ) : (
          <button
            type="button"
            onClick={() => setCollectionsCollapsed((value) => !value)}
            aria-expanded={!collectionsCollapsed}
            aria-controls="popup-collections-body"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              width: "100%",
              padding: 0,
              border: "none",
              background: "transparent",
              color: POPUP_THEME.text,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span>{IOC_COLLECTION_MANAGER_SECTION_LABEL}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{
                flex: "0 0 auto",
                color: POPUP_THEME.muted,
                transform: collectionsCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </h2>
      <div id="popup-collections-body" hidden={!embedded && collectionsCollapsed}>
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
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
                      >
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
                        <details style={{ width: "100%" }}>
                          <summary style={trayDemotedDetailsSummaryStyle()}>Export</summary>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              marginTop: 6,
                            }}
                          >
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
                        </details>
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
                                    onClick={() => handleRemoveMember(collection.id, member)}
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
      </div>
    </section>
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

function IndicatorDetailPane({
  entry,
  enrichmentStatus,
  note,
  noteStatus,
  enrichState,
  onNoteChange,
  onShowOnPage,
  onEnrich,
  onClear,
}: {
  entry: TabScanSummaryEntry;
  enrichmentStatus: TrayEntryEnrichmentStatus | undefined;
  note: string;
  noteStatus: AnalystNoteSaveStatus;
  enrichState: DetailEnrichState;
  onNoteChange: (value: string) => void;
  onShowOnPage: () => void;
  onEnrich: () => void;
  onClear: () => void;
}) {
  const noteStatusLabel =
    noteStatus === "saving" ? "Saving…" : noteStatus === "saved" ? "Saved" : "";

  return (
    <section
      aria-label="Indicator details"
      data-vera5-detail-pane="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 10,
        padding: 10,
        borderRadius: 8,
        border: `1px solid ${POPUP_THEME.border}`,
        backgroundColor: POPUP_THEME.surface,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span
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
        <span style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <TrayIndicatorValue entry={entry} />
        </span>
        <button
          type="button"
          aria-label="Close indicator details"
          onClick={onClear}
          style={{
            flexShrink: 0,
            border: "none",
            background: "transparent",
            color: POPUP_THEME.muted,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: POPUP_THEME.muted }}>
          {enrichmentStatus ? (
            <span style={trayEnrichmentHintStyle(enrichmentStatus.badgeText)}>
              {formatTrayRowEnrichmentHint(enrichmentStatus)}
            </span>
          ) : (
            "Not enriched yet"
          )}
        </span>
        <button
          type="button"
          onClick={onEnrich}
          disabled={enrichState === "enriching"}
          style={{
            flexShrink: 0,
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.buttonBg,
            color: POPUP_THEME.text,
            fontSize: 11,
            fontWeight: 600,
            cursor: enrichState === "enriching" ? "default" : "pointer",
          }}
        >
          {enrichState === "enriching" ? "Enriching…" : "Enrich"}
        </button>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: POPUP_THEME.muted }}>
          {HOVER_CARD_ANALYST_NOTES_LABEL}
        </span>
        <textarea
          data-vera5-analyst-note="true"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={HOVER_CARD_ANALYST_NOTES_PLACEHOLDER}
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            boxSizing: "border-box",
            padding: 6,
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.page,
            color: POPUP_THEME.text,
            fontFamily: VERA5_FONT.sans,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        />
        <span aria-live="polite" style={{ fontSize: 10, color: POPUP_THEME.muted, minHeight: 12 }}>
          {noteStatusLabel}
        </span>
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onShowOnPage}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${POPUP_THEME.border}`,
            backgroundColor: POPUP_THEME.buttonBg,
            color: POPUP_THEME.text,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Show on page
        </button>
      </div>
    </section>
  );
}

type IntelSourceAvailability = {
  enabled: boolean;
  configured: boolean;
};

type IntelSourceAvailabilityRecord = Partial<Record<EnrichmentSourceId, IntelSourceAvailability>>;

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
  if (typeof chrome.tabs?.create === "function") {
    void chrome.tabs.create({ url: link.href });
    return;
  }
  window.open(link.href, "_blank", "noopener,noreferrer");
}

function IntelFeedPanel({
  entry,
  loading,
  sourceEntries,
  availability,
  onEnrich,
}: {
  entry: TabScanSummaryEntry | null;
  loading: boolean;
  sourceEntries: readonly HoverCardSourceEntry[];
  availability: IntelSourceAvailabilityRecord;
  onEnrich: () => void;
}) {
  if (!entry) {
    return (
      <section className="vera5-intel-feed-section" aria-label="Intel feed">
        <h2 className="vera5-intel-feed-heading">Intel Feed</h2>
        <p className="vera5-intel-feed-subheading">
          Real-time intelligence, scoring, and vendor evidence.
        </p>
        <div className="vera5-intel-feed vera5-intel-feed--empty">
          <p>Select an indicator to assemble vendor evidence, scoring, and pivots.</p>
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
  const applicableSourceIds = ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
    enrichmentSourceSupportsIocType(sourceId, entry.type)
  );
  const riskView = buildHoverCardRiskScoreView(sourceEntries);
  const pivotLinks = getPivotLinks(entry.type, entry.value, {
    showDisabledSources: true,
  });
  const riskLabel =
    riskView.score.compositeSignal === null
      ? "Pending"
      : `${Math.round(riskView.score.compositeSignal)}/100`;

  return (
    <section className="vera5-intel-feed-section" aria-label="Intel feed">
      <h2 className="vera5-intel-feed-heading">Intel Feed</h2>
      <p className="vera5-intel-feed-subheading">
        Real-time intelligence, scoring, and vendor evidence.
      </p>
      <div className="vera5-intel-feed" data-vera5-intel-value={entry.value}>
        <div className="vera5-intel-feed-summary-row">
          <div className="vera5-intel-feed-command">
            <span className="vera5-intel-feed-type">{IOC_TYPE_TRAY_LABEL[entry.type]}</span>
            <strong title={entry.value}>{entry.value}</strong>
            <button
              type="button"
              onClick={onEnrich}
              disabled={loading}
              className="vera5-intel-feed-enrich"
            >
              {loading ? "Enriching…" : "Enrich"}
            </button>
          </div>

          <div className="vera5-intel-feed-score" data-vera5-risk-label={riskView.score.label}>
            <span>VERA5 score</span>
            <strong>{riskLabel}</strong>
            <small>{formatCompositeRiskLabelDisplay(riskView.score.label)}</small>
          </div>

          <p className="vera5-intel-feed-summary" aria-live="polite">
            {loading ? "Refreshing vendor intelligence…" : buildGroundedIntelSummary(sourceEntries)}
          </p>
        </div>

        <div className="vera5-intel-feed-sources" aria-label="Vendor assessments">
          {applicableSourceIds.map((sourceId) => {
            const definition = getEnrichmentSourceDefinition(sourceId);
            const source = sourceEntryById.get(sourceId);
            const sourceAvailability = availability[sourceId];
            const status = source
              ? source.status
              : !definition.liveConnector
                ? "pivot-only"
                : sourceAvailability?.enabled === false
                  ? "disabled"
                  : sourceAvailability?.configured === false
                    ? "not-configured"
                    : "not-enriched";
            const assessment = source?.assessment;
            const score =
              assessment?.kind === ENRICHMENT_ASSESSMENT_KIND.RISK &&
              typeof assessment.signal === "number"
                ? `${Math.round(assessment.signal)}/100`
                : null;
            const detail =
              source?.status === "ok"
                ? (assessment?.verdict ?? source.detail)
                : (source?.detail ??
                  (status === "pivot-only"
                    ? "Pivot only"
                    : status === "disabled"
                      ? "Disabled"
                      : status === "not-configured"
                        ? "Not configured"
                        : "Not enriched"));
            return (
              <article
                key={sourceId}
                className="vera5-intel-source-card"
                data-vera5-source-id={sourceId}
                data-vera5-source-status={status}
                data-vera5-assessment-kind={definition.assessmentKind}
                title={source?.detail ?? definition.description}
              >
                <div>
                  <strong>{definition.displayName}</strong>
                  {score ? <span>{score}</span> : null}
                </div>
                <p>{detail}</p>
                {source?.lastUpdatedLine ? <small>{source.lastUpdatedLine}</small> : null}
              </article>
            );
          })}

          <details className="vera5-intel-feed-pivots">
            <summary>
              <span className="vera5-intel-pivot-mark" aria-hidden="true">
                ◎
              </span>
              <span className="vera5-intel-pivot-label">Pivot</span>
              <span className="vera5-intel-pivot-hint">External tools</span>
            </summary>
            <div role="group" aria-label={`Pivot ${entry.value} to an intelligence source`}>
              {pivotLinks.map((link) => (
                <button key={link.provider} type="button" onClick={() => openIntelPivot(link)}>
                  {link.label}
                </button>
              ))}
            </div>
          </details>
        </div>
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
export const POPUP_TRAY_CASE_TOOLS_SUMMARY = "Collections & macros";
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
    borderRadius: 999,
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
    borderRadius: 999,
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

function sourceOpsStatusColor(statusLabel: string): string {
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

type CaseworkView = "session" | "history" | "collections" | "sources";

const POPUP_SIDE_PANEL_SPLIT_MIN_PX = 560;
const SELECTED_INTEL_ANCHOR_BY_TAB = new Map<number, string>();

export function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [highlightEnabled, setHighlightEnabledState] = useState(true);
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
  const [timelineNavigationMessage, setTimelineNavigationMessage] = useState<string | null>(null);
  const [replayNavigationMessage, setReplayNavigationMessage] = useState<string | null>(null);
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
  const [selectionEnrichMessage, setSelectionEnrichMessage] = useState<string | null>(null);
  const [textSelectionAvailable, setTextSelectionAvailable] = useState(false);
  const [selectionEnrichAvailable, setSelectionEnrichAvailable] = useState(false);
  const [sessionTitle, setSessionTitle] = useState(DEFAULT_INVESTIGATION_SESSION_TITLE);
  const [sessionTitleReady, setSessionTitleReady] = useState(false);
  const [activeSession, setActiveSession] = useState<InvestigationSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<InvestigationSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sessionExportMessage, setSessionExportMessage] = useState<string | null>(null);
  const [sessionExportIocOnly, setSessionExportIocOnly] = useState(false);
  const [sourceOps, setSourceOps] = useState<EnrichmentSourceOpsSnapshot | null>(null);
  const [sourceOpsReady, setSourceOpsReady] = useState(false);
  const [clearingSourceCacheId, setClearingSourceCacheId] = useState<string | null>(null);
  const [sourceOpsClearFeedback, setSourceOpsClearFeedback] = useState<string | null>(null);
  const [caseworkView, setCaseworkView] = useState<CaseworkView>("session");
  const [sessionTimelineOpen, setSessionTimelineOpen] = useState(false);
  const [sessionNotebookOpen, setSessionNotebookOpen] = useState(false);
  const [sessionReplayOpen, setSessionReplayOpen] = useState(false);
  const [sessionExportOpen, setSessionExportOpen] = useState(false);
  const [recentSessionsOpen, setRecentSessionsOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<InvestigationHistoryEntry[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyNavigationMessage, setHistoryNavigationMessage] = useState<string | null>(null);
  const [historyClearConfirmOpen, setHistoryClearConfirmOpen] = useState(false);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [historyClearFeedback, setHistoryClearFeedback] = useState<string | null>(null);
  const [saveToCollectionAnchorId, setSaveToCollectionAnchorId] = useState<string | null>(null);
  const [saveToCollectionFeedback, setSaveToCollectionFeedback] = useState<string | null>(null);
  const [addFilteredToCollectionOpen, setAddFilteredToCollectionOpen] = useState(false);
  const [addFilteredToCollectionFeedback, setAddFilteredToCollectionFeedback] = useState<
    string | null
  >(null);
  const [runMacroTrayAnchorId, setRunMacroTrayAnchorId] = useState<string | null>(null);
  const [runMacroTrayFeedback, setRunMacroTrayFeedback] = useState<string | null>(null);
  const [runMacroOnFilteredOpen, setRunMacroOnFilteredOpen] = useState(false);
  const [runMacroOnFilteredFeedback, setRunMacroOnFilteredFeedback] = useState<string | null>(null);
  const [promoteSessionToCollectionOpen, setPromoteSessionToCollectionOpen] = useState(false);
  const [promoteSessionToCollectionFeedback, setPromoteSessionToCollectionFeedback] = useState<
    string | null
  >(null);
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
    if (!entry) {
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
      setIntelSourceAvailability(availability);
      setIntelSourceResults(
        stored.filter((result): result is EnrichmentSourceResult => result !== null)
      );
    } catch {
      setIntelSourceResults([]);
    } finally {
      setIntelFeedLoading(false);
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
    void Promise.all([getExtensionEnabled(), getHighlightEnabled(), getQuietMode()]).then(
      ([extensionValue, highlightValue, quietModeValue]) => {
        setEnabled(extensionValue);
        setHighlightEnabledState(highlightValue);
        setQuietModeActive(quietModeValue);
        setReady(true);
      }
    );
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
    void readPopupPanelFocus().then((panel) => {
      if (panel === POPUP_PANEL.INVESTIGATION_HISTORY) {
        setCaseworkView("history");
      } else if (panel === POPUP_PANEL.SOURCE_OPERATIONS) {
        setCaseworkView("sources");
      }
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
  const whyStillVisibleTooltip = useMemo(
    () => buildWhyStillVisibleTooltip(suppressedTrayEntries.map(({ entry }) => entry)),
    [suppressedTrayEntries]
  );

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

  const sessionTimelineEvents = useMemo(() => {
    if (!activeSession?.timelineEvents?.length) {
      return [];
    }
    return sortTimelineEventsChronologically(activeSession.timelineEvents);
  }, [activeSession]);

  const sessionReplaySegments = useMemo(() => {
    if (!activeSession) {
      return [];
    }
    return ingestReplaySegmentsFromInvestigationSession(activeSession);
  }, [activeSession]);

  const intelSourceEntries = useMemo(
    () => buildHoverCardSourceEntries(intelSourceResults),
    [intelSourceResults]
  );

  const investigationSessionTitlesById = useMemo(() => {
    const titlesById = new Map<string, string>();
    for (const session of recentSessions) {
      titlesById.set(session.id, session.title);
    }
    if (activeSession) {
      titlesById.set(activeSession.id, activeSession.title);
    }
    return titlesById;
  }, [recentSessions, activeSession]);

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

  const activeSessionHistoryLinkSummary = useMemo(() => {
    if (!activeSession) {
      return null;
    }
    return buildInvestigationHistorySessionLinkSummary(
      countInvestigationHistoryEntriesForSession(historyEntries, activeSession.id)
    );
  }, [activeSession, historyEntries]);

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

  const handleNewSession = () => {
    if (!ready) {
      return;
    }

    void (async () => {
      const pageUrl = await resolveActiveTabPageUrl();
      const normalizedTitle =
        normalizeInvestigationSessionTitle(sessionTitle) ?? DEFAULT_INVESTIGATION_SESSION_TITLE;
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
      exportScope: sessionExportIocOnly
        ? INVESTIGATION_SESSION_EXPORT_SCOPE.IOC_ONLY
        : INVESTIGATION_SESSION_EXPORT_SCOPE.FULL,
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
            value: record.ioc,
            type: record.iocType,
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
            value: record.ioc,
            type: record.iocType,
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

  const handleOpenRelationshipPriorSession = (sessionId: string) => {
    setCaseworkView("session");
    handleReopenSession(sessionId);
    window.requestAnimationFrame(() => {
      document
        .getElementById("popup-investigation-session")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const handleOpenRelationshipPriorSessionReplay = (sessionId: string) => {
    setCaseworkView("session");
    setSessionReplayOpen(true);
    handleReopenSession(sessionId);
    window.requestAnimationFrame(() => {
      document
        .getElementById("popup-investigation-replay")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
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

  const handleHistoryRowActivate = (entry: InvestigationHistoryEntry) => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setHistoryNavigationMessage(
          resolveInvestigationHistoryReopenFeedback({
            tabId: undefined,
            ioc: entry.ioc,
            pageOrigin: entry.pageOrigin,
          })
        );
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(
          tab.id,
          reopenInvestigationHistoryMessage({
            ioc: entry.ioc,
            iocType: entry.iocType,
            pageOrigin: entry.pageOrigin,
          })
        );
        setHistoryNavigationMessage(
          resolveInvestigationHistoryReopenFeedback({
            tabId: tab.id,
            response,
            ioc: entry.ioc,
            pageOrigin: entry.pageOrigin,
          })
        );
      } catch {
        setHistoryNavigationMessage(
          resolveInvestigationHistoryReopenFeedback({
            tabId: tab.id,
            sendFailed: true,
            ioc: entry.ioc,
            pageOrigin: entry.pageOrigin,
          })
        );
      }
    });
  };

  const handleRequestClearHistory = () => {
    setHistoryClearConfirmOpen(true);
    setHistoryClearFeedback(null);
  };

  const handleCancelClearHistory = () => {
    setHistoryClearConfirmOpen(false);
  };

  const handleConfirmClearHistory = () => {
    void (async () => {
      setHistoryClearing(true);
      const cleared = await clearInvestigationHistory();
      setHistoryClearing(false);
      setHistoryClearConfirmOpen(false);
      if (cleared) {
        await refreshInvestigationHistoryState();
        setHistoryClearFeedback(resolveInvestigationHistoryClearFeedback(true));
        setHistoryNavigationMessage(null);
        return;
      }
      setHistoryClearFeedback(resolveInvestigationHistoryClearFeedback(false));
    })();
  };

  const handleClearSourceCache = (row: EnrichmentSourceOpsRow) => {
    void (async () => {
      setClearingSourceCacheId(row.sourceId);
      setSourceOpsClearFeedback(null);
      try {
        const removedCount = await clearEnrichmentCacheForSource(row.sourceId);
        await refreshSourceOps();
        setSourceOpsClearFeedback(
          resolveEnrichmentSourceClearCacheFeedback({
            sourceDisplayName: row.displayName,
            removedCount,
          })
        );
      } catch {
        setSourceOpsClearFeedback(`Could not clear cache for ${row.displayName}. Try again.`);
      } finally {
        setClearingSourceCacheId(null);
      }
    })();
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
      setCaseworkView("session");
      setSessionNotebookOpen(true);
      handleReopenSession(action.sessionId);
      window.requestAnimationFrame(() => {
        document
          .getElementById("popup-session-notebook")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
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
      return;
    }

    setCaseworkView("session");
    setSessionNotebookOpen(true);
    window.requestAnimationFrame(() => {
      document
        .getElementById("popup-session-notebook")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const navigateToTrayEntry = (entry: TabScanSummaryEntry) => {
    sendNavigateToIocAnchor({
      anchorId: entry.anchorId,
      value: entry.value,
      iocType: entry.type,
    });
  };

  const navigateToTimelineEntry = (entry: TabScanSummaryEntry) => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setTimelineNavigationMessage(
          resolveTrayNavigationFeedback({ tabId: undefined, indicatorValue: entry.value })
        );
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(
          tab.id,
          navigateToIocAnchorMessage(entry.anchorId)
        );
        setTimelineNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            response,
            indicatorValue: entry.value,
          })
        );
      } catch {
        setTimelineNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            sendFailed: true,
            indicatorValue: entry.value,
          })
        );
      }
    });
  };

  // Activating a tray row both opens the detail pane (the side panel's primary
  // analyst surface) and highlights the indicator on the page.
  const handleTrayRowActivate = (entry: TabScanSummaryEntry) => {
    setSelectedDetailEntry(entry);
    navigateToTrayEntry(entry);
  };

  const handleTimelineEventActivate = (event: TimelineEvent) => {
    if (!isTimelineEventNavigable(event)) {
      return;
    }

    const entry = findTabScanSummaryEntryForIndicatorValue(scanSummary, event.iocKey);
    if (!entry) {
      setTimelineNavigationMessage(
        scanSummary
          ? `${event.iocKey} is not on the current page. Scan again to refresh the list.`
          : `Scan this page to locate ${event.iocKey} on the page.`
      );
      return;
    }

    setSelectedDetailEntry(entry);
    navigateToTimelineEntry(entry);
  };

  const navigateToReplayEntry = (entry: TabScanSummaryEntry) => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        setReplayNavigationMessage(
          resolveTrayNavigationFeedback({ tabId: undefined, indicatorValue: entry.value })
        );
        return;
      }
      try {
        const response = await chrome.tabs.sendMessage(
          tab.id,
          navigateToIocAnchorMessage(entry.anchorId, {
            iocType: entry.type,
            value: entry.value,
            enrichmentTrigger: "none",
          })
        );
        setReplayNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            response,
            indicatorValue: entry.value,
          })
        );
      } catch {
        setReplayNavigationMessage(
          resolveTrayNavigationFeedback({
            tabId: tab.id,
            sendFailed: true,
            indicatorValue: entry.value,
          })
        );
      }
    });
  };

  const handleReplaySegmentActivate = (segment: ReplaySegment) => {
    if (!isReplaySegmentNavigable(segment)) {
      return;
    }

    const entry = findTabScanSummaryEntryForIndicatorValue(scanSummary, segment.iocKey);
    if (!entry) {
      setReplayNavigationMessage(
        scanSummary
          ? `${segment.iocKey} is not on the current page. Scan again to refresh the list.`
          : `Scan this page to locate ${segment.iocKey} on the page.`
      );
      return;
    }

    navigateToReplayEntry(entry);
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

  const handleClearSelectedDetail = () => {
    if (scanSummary) {
      SELECTED_INTEL_ANCHOR_BY_TAB.delete(scanSummary.tabId);
    }
    setSelectedDetailEntry(null);
  };

  // Force a fresh enrichment for the selected indicator, then refresh the tray
  // badges from cache. Routed through the background service worker so the side
  // panel never touches the page DOM directly.
  const handleEnrichSelectedDetail = () => {
    const entry = selectedDetailEntry;
    if (!entry || detailEnrichState === "enriching") {
      return;
    }
    setDetailEnrichState("enriching");
    void (async () => {
      try {
        await chrome.runtime.sendMessage(
          enrichIocMessage({ value: entry.value, iocType: entry.type, bypassCache: true })
        );
      } catch {
        // Background unreachable; surface stays on the last known status.
      }
      try {
        if (scanSummary && scanSummary.entries.length > 0) {
          const statuses = await loadTrayEntryEnrichmentStatuses(scanSummary.entries);
          setTrayEnrichmentStatuses(statuses);
        }
      } catch {
        // Leave existing statuses in place on refresh failure.
      }
      await refreshIntelFeed(entry);
      await refreshInvestigationSessionState();
      setDetailEnrichState("idle");
    })();
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
        const response = await chrome.tabs.sendMessage(tab.id, scanPageMessage());
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

  const renderTrayEntryRow = (
    entry: TabScanSummaryEntry,
    options?: { noiseSuppressed?: boolean }
  ) => {
    const enrichmentStatus = trayEnrichmentStatuses[entry.anchorId];
    const provenance = resolveTrayEntryMatchProvenance(entry);
    const noiseSuppressed = options?.noiseSuppressed === true;
    const knownGoodMatch = findMatchingKnownGoodEntry(knownGoodEntries, entry.value);
    const knownGoodBadge = knownGoodMatch ? buildKnownGoodMatchBadgeView(knownGoodMatch) : null;

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
        data-vera5-noise-suppressed={noiseSuppressed ? "true" : undefined}
        data-vera5-known-good-entry-id={knownGoodBadge?.entryId}
        data-vera5-known-good-category={knownGoodBadge?.category}
        data-vera5-known-good-match-type={knownGoodBadge?.matchType}
        data-vera5-known-good-pattern={knownGoodBadge?.pattern}
        data-vera5-selected={selectedDetailEntry?.anchorId === entry.anchorId ? "true" : undefined}
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
          flexDirection: "column",
          gap: 6,
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
              color: POPUP_THEME.muted,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {IOC_TYPE_TRAY_LABEL[entry.type]}
          </span>
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
              <span aria-hidden="true" style={trayEnrichmentHintStyle(enrichmentStatus.badgeText)}>
                {formatTrayRowEnrichmentHint(enrichmentStatus)}
              </span>
            ) : null}
          </span>
        </div>
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
      </li>
    );
  };

  return (
    <main
      className="vera5-popup"
      data-host="sidepanel"
      style={{
        minWidth: 280,
        maxWidth: "none",
        width: "100%",
        boxSizing: "border-box",
        padding: VERA5_SPACE.lg,
        fontFamily: VERA5_FONT.sans,
        backgroundColor: POPUP_THEME.page,
        color: POPUP_THEME.text,
        // Permanent three-panel workspace; container queries only compact density.
        containerType: "inline-size",
        containerName: "vera5-workspace",
        ["--vera5-workspace-split-min" as string]: `${POPUP_SIDE_PANEL_SPLIT_MIN_PX}px`,
      }}
    >
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
              href="https://www.vera5.io/how-to"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the Vera5 How-To guide in a new tab"
              style={headerGlassButtonStyle}
            >
              <svg
                width="13"
                height="13"
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
          </div>
        </h1>
      </header>
      {quietModeActive || activeSession ? (
        <div
          className="vera5-status-strip"
          role="status"
          aria-label={POPUP_STATUS_STRIP_ARIA_LABEL}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            margin: `0 0 ${VERA5_SPACE.md}px`,
          }}
        >
          {quietModeActive ? (
            <span
              aria-label="Quiet mode active. Live vendor enrichment is blocked."
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                borderRadius: 999,
                border: `1px solid ${POPUP_THEME.accent}`,
                background: "rgba(255, 178, 36, 0.12)",
                color: POPUP_THEME.accent,
                fontFamily: VERA5_FONT.sans,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.2,
              }}
            >
              {POPUP_QUIET_MODE_STATUS_LABEL}
            </span>
          ) : null}
          {activeSession ? (
            <span
              aria-label={`Investigation session active: ${activeSession.title}`}
              title={activeSession.title}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                borderRadius: 999,
                border: `1px solid ${POPUP_THEME.border}`,
                background: POPUP_THEME.secondaryBg,
                color: POPUP_THEME.text,
                fontFamily: VERA5_FONT.sans,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                maxWidth: "100%",
              }}
            >
              {POPUP_STATUS_SESSION_ACTIVE_LABEL}
            </span>
          ) : null}
        </div>
      ) : null}
      <section className="vera5-command-section" aria-label="Scan and extension controls">
        <div className="vera5-command-utilities">
          <div className="vera5-operator-controls">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Extension enabled"
              disabled={!ready}
              onClick={() => handleToggle(!enabled)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: "1 1 0",
                minWidth: 0,
                padding: "6px 8px 6px 10px",
                borderRadius: 999,
                border: `1px solid ${POPUP_THEME.border}`,
                background: POPUP_THEME.buttonBg,
                color: POPUP_THEME.muted,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: ready ? "pointer" : "not-allowed",
                opacity: ready ? 1 : 0.65,
                textAlign: "left",
              }}
            >
              <span style={{ flex: "1 1 auto", minWidth: 0, lineHeight: 1.2 }}>
                Extension enabled
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: 30,
                  height: 16,
                  borderRadius: 999,
                  background: enabled ? POPUP_THEME.accent : POPUP_THEME.buttonBg,
                  border: `1px solid ${enabled ? POPUP_THEME.accent : POPUP_THEME.border}`,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: enabled ? POPUP_THEME.onAccent : POPUP_THEME.muted,
                    transform: enabled ? "translateX(14px)" : "translateX(0)",
                    transition: "transform 0.15s ease, background 0.15s ease",
                  }}
                />
              </span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={highlightEnabled}
              aria-label="Highlight indicators"
              disabled={!ready || !enabled}
              onClick={() => handleHighlightToggle(!highlightEnabled)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: "1 1 0",
                minWidth: 0,
                padding: "6px 8px 6px 10px",
                borderRadius: 999,
                border: `1px solid ${POPUP_THEME.border}`,
                background: POPUP_THEME.buttonBg,
                color: POPUP_THEME.muted,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: ready && enabled ? "pointer" : "not-allowed",
                opacity: ready && enabled ? 1 : 0.65,
                textAlign: "left",
              }}
            >
              <span style={{ flex: "1 1 auto", minWidth: 0, lineHeight: 1.2 }}>
                Highlight indicators
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: 30,
                  height: 16,
                  borderRadius: 999,
                  background: highlightEnabled ? POPUP_THEME.accent : POPUP_THEME.buttonBg,
                  border: `1px solid ${highlightEnabled ? POPUP_THEME.accent : POPUP_THEME.border}`,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: highlightEnabled ? POPUP_THEME.onAccent : POPUP_THEME.muted,
                    transform: highlightEnabled ? "translateX(14px)" : "translateX(0)",
                    transition: "transform 0.15s ease, background 0.15s ease",
                  }}
                />
              </span>
            </button>
          </div>
          <div className="vera5-command-admin">
            <button
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
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </button>
            <button
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
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Permissions
            </button>
          </div>
        </div>
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
            {scanState === "scanning" ? "Scanning…" : "Scan page"}
          </button>
          <p className="vera5-scan-primary-hint">Detect IOCs on this page</p>
        </div>
        <div className="vera5-scan-secondary" style={scanSecondaryActionsStyle}>
          <button
            type="button"
            disabled={scanSelectionDisabled}
            className="v5-btn"
            onClick={handleScanSelection}
            style={{
              ...buttonStyle,
              flex: "1 1 0",
              width: "auto",
              cursor: scanSelectionDisabled ? "not-allowed" : "pointer",
              opacity: scanSelectionDisabled ? 0.65 : 1,
            }}
          >
            {scanState === "scanning" ? "Scanning…" : "Scan selection"}
          </button>
          <button
            type="button"
            disabled={enrichSelectionDisabled}
            className="v5-btn"
            onClick={handleEnrichSelection}
            style={{
              ...buttonStyle,
              flex: "1 1 0",
              width: "auto",
              cursor: enrichSelectionDisabled ? "not-allowed" : "pointer",
              opacity: enrichSelectionDisabled ? 0.65 : 1,
            }}
          >
            Enrich selection
          </button>
        </div>
        {scanState === "error" ? (
          <p style={{ fontSize: 12, margin: 0, color: POPUP_THEME.error }}>
            Scan failed. Reload the tab and try again.
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
          onEnrich={handleEnrichSelectedDetail}
        />
        <div className="vera5-popup-triage" aria-label="Triage">
          {trayView ? (
            <section
              className="vera5-triage-section"
              aria-label="Detected indicators"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: 0,
                    color: POPUP_THEME.accentText,
                  }}
                >
                  Detected indicators
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                    gap: 6,
                    maxWidth: "62%",
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
              </div>
              {trayView === "prompt" ? (
                <p style={trayStatusStyle()}>Scan this page to list detected indicators.</p>
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
                  <div
                    role="group"
                    aria-label={`Filter by indicator type. ${buildTabScanCountSummaryText(
                      scanSummary,
                      activePageContextType
                    )}`}
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
                    {listIocTypesPresentInSummaryForPageContext(
                      scanSummary,
                      activePageContextType
                    ).map((type) => (
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
                  <details className="vera5-tray-case-tools" style={{ marginBottom: 10 }}>
                    <summary style={trayDemotedDetailsSummaryStyle()}>
                      {POPUP_TRAY_CASE_TOOLS_SUMMARY}
                    </summary>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
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
                      <RunMacroOnFilteredPanel
                        entries={filteredEntries}
                        open={runMacroOnFilteredOpen}
                        onToggle={() => {
                          setRunMacroOnFilteredFeedback(null);
                          setRunMacroOnFilteredOpen((current) => !current);
                        }}
                        feedback={runMacroOnFilteredFeedback}
                        onFeedback={setRunMacroOnFilteredFeedback}
                      />
                    </div>
                  </details>
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
                    <>
                      {activeTrayEntries.length > 0 ? (
                        <ul
                          className="vera5-ioc-queue"
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
                          {activeTrayEntries.map((entry) => renderTrayEntryRow(entry))}
                        </ul>
                      ) : (
                        <p style={trayStatusStyle()}>
                          All matching indicators are listed under Suppressed.
                        </p>
                      )}
                      {suppressedTrayEntries.length > 0 ? (
                        <details
                          data-vera5-tray-suppressed-section="true"
                          style={{
                            marginTop: activeTrayEntries.length > 0 ? 8 : 0,
                            borderRadius: 6,
                            border: `1px solid ${POPUP_THEME.border}`,
                            padding: "6px 8px",
                            backgroundColor: POPUP_THEME.trayRowBg,
                          }}
                        >
                          <summary
                            data-vera5-why-still-visible-tooltip="true"
                            title={whyStillVisibleTooltip}
                            style={{
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              color: POPUP_THEME.muted,
                              listStylePosition: "outside",
                            }}
                          >
                            {formatNoiseRulesTraySuppressedSummary(suppressedTrayEntries.length)}
                          </summary>
                          <p
                            style={{
                              fontSize: 11,
                              margin: "6px 0 8px",
                              color: POPUP_THEME.muted,
                              lineHeight: 1.4,
                            }}
                          >
                            {NOISE_RULES_TRAY_SUPPRESSED_SECTION_HINT}
                          </p>
                          <ul
                            className="vera5-ioc-queue vera5-ioc-queue--suppressed"
                            style={{
                              listStyle: "none",
                              margin: 0,
                              padding: 0,
                              maxHeight: 160,
                              overflowY: "auto",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {suppressedTrayEntries.map(({ entry }) =>
                              renderTrayEntryRow(entry, { noiseSuppressed: true })
                            )}
                          </ul>
                        </details>
                      ) : null}
                    </>
                  ) : (
                    <p style={trayStatusStyle()}>No indicators match this filter.</p>
                  )}
                </>
              ) : null}
            </section>
          ) : null}
        </div>
        <div className="vera5-popup-detail" aria-label="Indicator detail and casework">
          {selectedDetailEntry ? (
            <aside className="vera5-popup-inspector" aria-label="Selected indicator inspector">
              <IndicatorDetailPane
                entry={selectedDetailEntry}
                enrichmentStatus={trayEnrichmentStatuses[selectedDetailEntry.anchorId]}
                note={analystNote}
                noteStatus={analystNoteStatus}
                enrichState={detailEnrichState}
                onNoteChange={handleAnalystNoteChange}
                onShowOnPage={() => navigateToTrayEntry(selectedDetailEntry)}
                onEnrich={handleEnrichSelectedDetail}
                onClear={handleClearSelectedDetail}
              />
            </aside>
          ) : null}
          <div className="vera5-popup-casework" aria-label="Casework">
            <div className="vera5-casework-header">
              <div className="vera5-section-kicker">Casework</div>
              <div className="vera5-casework-tabs" role="tablist" aria-label="Casework tools">
                {(
                  [
                    ["session", "Session", "popup-investigation-body"],
                    ["history", "History", "popup-history-body"],
                    ["collections", "Collections", "popup-collections-body"],
                    ["sources", "Sources", "popup-source-ops-body"],
                  ] as const
                ).map(([view, label, controls]) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={caseworkView === view}
                    aria-controls={controls}
                    onClick={() => setCaseworkView(view)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <section
              className="vera5-casework-panel"
              id="popup-investigation-session"
              aria-label="Investigation session"
              hidden={caseworkView !== "session"}
              style={{
                marginTop: 14,
                borderTop: `1px solid ${POPUP_THEME.border}`,
                paddingTop: 12,
              }}
            >
              <h2 className="vera5-visually-hidden">Investigation session</h2>
              <div id="popup-investigation-body">
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
                      className="vera5-session-facts"
                      style={{
                        fontSize: 12,
                        margin: "0 0 10px",
                        color: POPUP_THEME.text,
                        lineHeight: 1.5,
                      }}
                    >
                      {[sessionIocCountText, sessionTypeBreakdownText, sessionActivitySummaryText]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
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
                    <details
                      className="vera5-session-disclosure"
                      open={sessionTimelineOpen}
                      onToggle={(event) => setSessionTimelineOpen(event.currentTarget.open)}
                    >
                      <summary>Timeline · {sessionTimelineEvents.length}</summary>
                      <div className="vera5-session-disclosure-body">
                        <InvestigationSessionTimelinePanel
                          sessionId={activeSession.id}
                          sessionTitle={activeSession.title}
                          sessionPageUrl={activeSession.pageUrl}
                          events={sessionTimelineEvents}
                          onActivateEvent={handleTimelineEventActivate}
                          navigationMessage={timelineNavigationMessage}
                        />
                      </div>
                    </details>
                    <details
                      className="vera5-session-disclosure"
                      open={sessionNotebookOpen}
                      onToggle={(event) => setSessionNotebookOpen(event.currentTarget.open)}
                    >
                      <summary>Notebook</summary>
                      <div className="vera5-session-disclosure-body">
                        <InvestigationSessionNotebookTimelinePanel sessionId={activeSession.id} />
                      </div>
                    </details>
                    <details
                      className="vera5-session-disclosure vera5-session-disclosure--intel"
                      open={sessionReplayOpen}
                      onToggle={(event) => setSessionReplayOpen(event.currentTarget.open)}
                    >
                      <summary>Replay · {sessionReplaySegments.length}</summary>
                      <div className="vera5-session-disclosure-body">
                        <InvestigationReplayPanel
                          sessionId={activeSession.id}
                          sessionTitle={activeSession.title}
                          sessionPageUrl={activeSession.pageUrl}
                          segments={sessionReplaySegments}
                          onActivateSegment={handleReplaySegmentActivate}
                          navigationMessage={replayNavigationMessage}
                          resolveSessionMemoryRecords={async () => {
                            const input = await resolveActiveSessionExportInput();
                            return input?.records ?? [];
                          }}
                        />
                      </div>
                    </details>
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
                  <details
                    className="vera5-session-disclosure"
                    open={sessionExportOpen}
                    onToggle={(event) => setSessionExportOpen(event.currentTarget.open)}
                  >
                    <summary>Export</summary>
                    <div className="vera5-session-disclosure-body">
                      <label
                        title={INVESTIGATION_SESSION_EXPORT_IOC_ONLY_DESCRIPTION}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 8,
                          fontSize: 12,
                          color: POPUP_THEME.text,
                          cursor: ready && sessionTitleReady ? "pointer" : "not-allowed",
                          opacity: ready && sessionTitleReady ? 1 : 0.65,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sessionExportIocOnly}
                          disabled={!ready || !sessionTitleReady}
                          onChange={(event) => {
                            setSessionExportIocOnly(event.target.checked);
                          }}
                          aria-label={INVESTIGATION_SESSION_EXPORT_IOC_ONLY_LABEL}
                          style={{ marginTop: 2 }}
                        />
                        <span style={{ fontWeight: 600 }}>
                          {INVESTIGATION_SESSION_EXPORT_IOC_ONLY_LABEL}
                        </span>
                      </label>
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
                    </div>
                  </details>
                ) : null}
                {recentSessions.length > 0 ? (
                  <details
                    className="vera5-session-disclosure"
                    open={recentSessionsOpen}
                    onToggle={(event) => setRecentSessionsOpen(event.currentTarget.open)}
                  >
                    <summary>Recent · {recentSessions.length}</summary>
                    <div className="vera5-session-disclosure-body">
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
                                border: `1px solid ${isActive ? POPUP_THEME.accent : POPUP_THEME.border}`,
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
                    </div>
                  </details>
                ) : (
                  <p style={{ ...trayStatusStyle(), marginTop: 12 }}>No saved sessions yet.</p>
                )}
              </div>
            </section>
            <div id="popup-advanced-body" className="vera5-casework-tools">
              <section
                className="vera5-casework-panel"
                aria-label="Investigation history"
                hidden={caseworkView !== "history"}
                style={{
                  marginTop: 0,
                  borderTop: "none",
                  paddingTop: 0,
                }}
              >
                <h2 className="vera5-visually-hidden">Investigation history</h2>
                <div id="popup-history-body">
                  {!historyReady ? (
                    <p style={trayStatusStyle()} aria-live="polite">
                      Loading history…
                    </p>
                  ) : historyEntries.length === 0 ? (
                    <p style={trayStatusStyle()} aria-live="polite">
                      No enriched indicators yet.
                    </p>
                  ) : (
                    <>
                      {historyNavigationMessage ? (
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
                          {historyNavigationMessage}
                        </p>
                      ) : null}
                      {activeSessionHistoryLinkSummary ? (
                        <p style={{ ...trayStatusStyle(), margin: "0 0 10px" }} aria-live="polite">
                          {activeSessionHistoryLinkSummary}
                        </p>
                      ) : null}
                      <ul
                        aria-label="Recent investigation history"
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          maxHeight: 180,
                          overflowY: "auto",
                        }}
                      >
                        {historyEntries.map((entry) => {
                          const sessionTitle = resolveInvestigationHistorySessionTitle(
                            entry,
                            investigationSessionTitlesById
                          );
                          const linkedToActiveSession =
                            isInvestigationHistoryEntryLinkedToActiveSession(
                              entry,
                              activeSession?.id
                            );

                          return (
                            <li
                              key={entry.id}
                              role="button"
                              tabIndex={0}
                              data-vera5-history-entry="true"
                              data-vera5-type={entry.iocType}
                              data-vera5-value={entry.ioc}
                              data-vera5-session-id={entry.sessionId ?? undefined}
                              aria-label={buildInvestigationHistoryRowAriaLabel(
                                entry,
                                sessionTitle
                              )}
                              onClick={() => handleHistoryRowActivate(entry)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") {
                                  return;
                                }
                                event.preventDefault();
                                handleHistoryRowActivate(entry);
                              }}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: linkedToActiveSession
                                  ? `1px solid ${POPUP_THEME.accent}`
                                  : "1px solid transparent",
                                backgroundColor: POPUP_THEME.trayRowBg,
                                fontSize: 12,
                                lineHeight: 1.4,
                                cursor: "pointer",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  wordBreak: "break-all",
                                  color: POPUP_THEME.text,
                                }}
                              >
                                {entry.ioc}
                              </span>
                              <span style={{ color: POPUP_THEME.muted, fontSize: 11 }}>
                                {entry.pageOrigin}
                              </span>
                              {sessionTitle ? (
                                <span
                                  style={{
                                    color: linkedToActiveSession
                                      ? POPUP_THEME.accentText
                                      : POPUP_THEME.muted,
                                    fontSize: 11,
                                  }}
                                >
                                  {linkedToActiveSession
                                    ? "Linked to this session"
                                    : `Session: ${sessionTitle}`}
                                </span>
                              ) : null}
                              <span style={{ color: POPUP_THEME.muted, fontSize: 11 }}>
                                {formatInvestigationHistoryTimestamp(entry.enrichedAt)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {historyClearFeedback ? (
                        <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "10px 0 0" }}>
                          {historyClearFeedback}
                        </p>
                      ) : null}
                      {historyClearConfirmOpen ? (
                        <div
                          role="group"
                          aria-label="Confirm clear investigation history"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          <p style={{ ...trayStatusStyle(), margin: 0 }}>
                            {INVESTIGATION_HISTORY_CLEAR_CONFIRM_MESSAGE}
                          </p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              disabled={historyClearing}
                              onClick={handleConfirmClearHistory}
                              style={sessionActionButtonStyle()}
                            >
                              {historyClearing ? "Clearing…" : "Confirm clear"}
                            </button>
                            <button
                              type="button"
                              disabled={historyClearing}
                              onClick={handleCancelClearHistory}
                              style={sessionActionButtonStyle()}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!historyReady || historyClearing}
                          onClick={handleRequestClearHistory}
                          style={{
                            ...sessionActionButtonStyle(),
                            marginTop: 10,
                          }}
                        >
                          Clear history
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
              <div className="vera5-casework-panel" hidden={caseworkView !== "collections"}>
                <CollectionsManagerPanel embedded />
              </div>
              <section
                className="vera5-casework-panel"
                aria-label={ENRICHMENT_SOURCE_OPS_SECTION_TITLE}
                hidden={caseworkView !== "sources"}
                style={{
                  marginTop: 10,
                  borderTop: `1px solid ${POPUP_THEME.border}`,
                  paddingTop: 10,
                }}
              >
                <h2 className="vera5-visually-hidden">{ENRICHMENT_SOURCE_OPS_SECTION_TITLE}</h2>
                <div id="popup-source-ops-body">
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
                      <div className="vera5-source-overview" aria-live="polite">
                        <span
                          data-vera5-source-health={
                            sourceOps.globalCooldownActive ? "error" : "healthy"
                          }
                        >
                          {formatEnrichmentSourceOpsCooldownLabel(sourceOps)}
                        </span>
                        <span>
                          Cleared {formatEnrichmentCacheClearedAtLabel(sourceOps.lastCacheClearAt)}
                        </span>
                        <span>{sourceOps.totalCacheEntryCount} cached</span>
                      </div>
                      <details className="vera5-source-guidance">
                        <summary>Quota guidance</summary>
                        <p>
                          Vendor quota hints are orientation only; confirm effective limits in each
                          vendor account.
                        </p>
                      </details>
                      {sourceOpsClearFeedback ? (
                        <p aria-live="polite" style={{ ...trayStatusStyle(), margin: "0 0 10px" }}>
                          {sourceOpsClearFeedback}
                        </p>
                      ) : null}
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
                          const statusLabel = formatEnrichmentSourceLastStatusLabel(row.lastStatus);
                          const lastErrorLabel = formatEnrichmentSourceLastErrorLabel(
                            row.lastStatus
                          );
                          const sourceHealth =
                            lastErrorLabel || statusLabel === "Rate limited"
                              ? "error"
                              : statusLabel === "OK" || statusLabel === "Cached"
                                ? "healthy"
                                : "neutral";
                          return (
                            <li
                              key={row.sourceId}
                              className="vera5-source-row"
                              data-vera5-source-health={sourceHealth}
                              title={`Vendor quota: ${row.quotaHint}`}
                              style={{
                                border: `1px solid ${POPUP_THEME.border}`,
                                borderRadius: 6,
                                padding: "6px 8px",
                                backgroundColor: POPUP_THEME.trayRowBg,
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) auto",
                                gap: 8,
                                alignItems: "start",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  className="vera5-source-status"
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
                                {lastErrorLabel ? (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: POPUP_THEME.error,
                                      marginTop: 2,
                                    }}
                                  >
                                    Error: {lastErrorLabel}
                                  </div>
                                ) : null}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-end",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    flexShrink: 0,
                                    fontSize: 11,
                                    color: POPUP_THEME.muted,
                                    whiteSpace: "nowrap",
                                    textAlign: "right",
                                  }}
                                >
                                  {formatEnrichmentSourceCacheEntryCountLabel(row.cacheEntryCount)}
                                </span>
                                <button
                                  type="button"
                                  disabled={
                                    !sourceOpsReady ||
                                    row.cacheEntryCount === 0 ||
                                    clearingSourceCacheId === row.sourceId
                                  }
                                  onClick={() => handleClearSourceCache(row)}
                                  aria-label={`Clear cache for ${row.displayName}`}
                                  style={sessionActionButtonStyle()}
                                >
                                  {clearingSourceCacheId === row.sourceId
                                    ? "Clearing…"
                                    : "Clear cache"}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <footer className="vera5-workspace-footer" role="contentinfo" aria-label="Workspace status">
        <div className="vera5-workspace-footer-meta">
          <span className="vera5-workspace-footer-version">Vera5 v0.1.0</span>
          <span
            className="vera5-workspace-footer-pill"
            data-vera5-footer-state={ready ? "ready" : "loading"}
          >
            {ready ? "Ready" : "Loading…"}
          </span>
          <span
            className="vera5-workspace-footer-pill"
            data-vera5-footer-state={quietModeActive ? "quiet" : "live"}
          >
            {quietModeActive ? "Quiet mode" : "Threat feeds: Live"}
          </span>
          <span
            className="vera5-workspace-footer-pill"
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
