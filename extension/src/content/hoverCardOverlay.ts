import type { IgnoredOverlapMatch, IocRuleId, IocType } from "../lib/iocRegex";
import { resolveHoverCardAnalystNote, primeAnalystNoteForIoc, setSessionAnalystNote } from "../lib/analystNotesSession";
import { normalizeIocNoteKey } from "../lib/analystNotesStorage";
import { IOC_LABEL_IDS, formatIocLabelDisplay, type IocLabelId } from "../lib/iocLabel";
import {
  primeIocLabelForIoc,
  resolveHoverCardIocLabel,
  setSessionIocLabel,
} from "../lib/iocLabelSession";
import {
  buildNoiseRuleHoverMatchView,
  buildNoiseRulesOptionsHash,
  confirmLearnNoiseRule,
  findMatchingNoiseRule,
  shouldOfferNoiseRuleLearnForLabel,
} from "../lib/noiseRule";
import { listStoredNoiseRules } from "../lib/noiseRuleStorage";
import {
  buildKnownGoodMatchBadgeView,
  buildKnownGoodOptionsHash,
  findMatchingKnownGoodEntry,
  KNOWN_GOOD_ENRICH_SKIPPED_LABEL,
  KNOWN_GOOD_MATCH_SECTION_ARIA_LABEL,
} from "../lib/knownGood";
import { listStoredKnownGoodEntriesForMatching } from "../lib/knownGoodStorage";
import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildNormalizedEnrichmentRecord,
  buildEnrichmentExportDocument,
  copyEnrichmentExportJsonToClipboard,
  copyEnrichmentExportMarkdownToClipboard,
  copyEnrichmentExportTxtToClipboard,
  copyTraySubsetExportJsonToClipboard,
  downloadEnrichmentExportFile,
  downloadTraySubsetExportFile,
  type EnrichmentExportFileFormat,
  type NormalizedEnrichmentRecord,
  type TraySubsetExportFormat,
} from "../lib/enrichmentExport";
import {
  copyTrayTemplateExportToClipboard,
  downloadTrayTemplateExportFile,
  getExportTemplateLabel,
  isExportTemplateId,
  listExportTemplateIds,
  type ExportTemplateId,
} from "../lib/exportTemplates";
import { getTabScanTrayFilter } from "../lib/tabScanSnapshotStorage";
import {
  getActiveInvestigationSession,
  recordActiveInvestigationSessionExportEvent,
  toggleActiveInvestigationSessionIocPin,
} from "../lib/investigationSessionStorage";
import {
  buildInvestigationSessionIocTimelineSummaryLines,
  getInvestigationSessionIocTimeline,
  isInvestigationSessionIocPinned,
} from "../lib/investigationSession";
import {
  buildTabScanIocListClipboardText,
  buildTraySubsetEnrichmentRecords,
  filterTabScanSummaryEntries,
  resolveTrayCopyFeedback,
  resolveTrayExportFeedback,
  resolveTraySubsetCopyFeedback,
  resolveTrayTemplateCopyFeedback,
  resolveTrayTemplateExportFeedback,
  type IocTypeFilter,
  type TabScanSummary,
} from "../lib/tabScanSummary";
import { safeOpenOptionsPage, safeOpenOptionsPageWithHash } from "../lib/extensionContext";
import {
  buildSourceStatusBadgeClassName,
  buildSourceMetadataChipClassName,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
  HOVER_CARD_ANALYST_NOTES_INPUT_ID,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_ANALYST_NOTES_PLACEHOLDER,
  HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL,
  HOVER_CARD_IOC_LABEL_LABEL,
  HOVER_CARD_IOC_LABEL_NONE_VALUE,
  HOVER_CARD_IOC_LABEL_SECTION_ARIA_LABEL,
  HOVER_CARD_IOC_LABEL_SELECT_ID,
  HOVER_CARD_IOC_TIMELINE_EMPTY_TEXT,
  HOVER_CARD_IOC_TIMELINE_LABEL,
  HOVER_CARD_IOC_TIMELINE_SECTION_ARIA_LABEL,
  HOVER_CARD_CO_OCCURRENCE_EMPTY_TEXT,
  HOVER_CARD_CO_OCCURRENCE_LABEL,
  HOVER_CARD_CO_OCCURRENCE_SECTION_ARIA_LABEL,
  HOVER_CARD_IOC_PIN_ARIA_LABEL,
  HOVER_CARD_IOC_PIN_LABEL,
  HOVER_CARD_IOC_PINNED_LABEL,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_RAW_JSON_SUMMARY_LABEL,
  HOVER_CARD_WHY_DETECTED_HEADING,
  HOVER_CARD_WHY_DETECTED_SECTION_ARIA_LABEL,
  HOVER_CARD_ON_PAGE_VALUE_LABEL,
  HOVER_CARD_REFANGED_VALUE_LABEL,
  HOVER_CARD_COPY_COPIED_LABEL,
  HOVER_CARD_OPEN_LIVE_URL_LABEL,
  buildWhyDetectedView,
  confirmOpenLiveUrl,
  openLiveUrlInNewTab,
  resolveEffectiveSourceAttribution,
  resolveHoverCardDisplayView,
  resolveHoverCardDisclaimerAriaLabel,
  PRE_QUERY_DISCLOSURE_CANCEL_LABEL,
  PRE_QUERY_DISCLOSURE_HEADING,
  PRE_QUERY_DISCLOSURE_REMEMBER_LABEL,
  PRE_QUERY_DISCLOSURE_SECTION_ARIA_LABEL,
  PRE_QUERY_DISCLOSURE_SEND_LABEL,
  resolveIndicatorCopyActions,
  resolveIndicatorValuePresentation,
  shouldOfferLiveUrlOpen,
  type EnrichmentSourceAttribution,
  type EnrichmentSourceId,
  type HoverCardDisclaimerInput,
  type HoverCardEnrichmentState,
  type HoverCardSourceEntry,
  type WhyDetectedView,
} from "../lib/hoverCardEnrichment";
import {
  buildCoOccurrenceEntryDisplaysForView,
  formatCoOccurrenceEntryDisplayLine,
  formatCoOccurrenceEntryNavigateAriaLabel,
  handleCoOccurrenceListItemKeyDown,
  loadHoverCardCoOccurrencePanelView,
} from "../lib/hoverCardCoOccurrence";
import {
  HOVER_CARD_RELATIONSHIP_EMPTY_TEXT,
  HOVER_CARD_RELATIONSHIP_LABEL,
  HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL,
  RELATIONSHIP_HOVER_UI_LAYOUT,
  buildRelationshipEntryDisplaysForView,
  formatRelationshipEntryAccessibleLabel,
  loadHoverCardRelationshipPanelView,
} from "../lib/hoverCardRelationship";
import {
  appendNotebookFragmentMarkdownLite,
} from "../lib/notebookFragment";
import {
  HOVER_CARD_NOTEBOOK_LABEL,
  HOVER_CARD_NOTEBOOK_SECTION_ARIA_LABEL,
  NOTEBOOK_FRAGMENT_ADD_FORM_ARIA_LABEL,
  NOTEBOOK_FRAGMENT_ADD_LABEL,
  NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL,
  NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER,
  NOTEBOOK_FRAGMENT_CANCEL_LABEL,
  NOTEBOOK_FRAGMENT_DELETE_CONFIRM_TEXT,
  NOTEBOOK_FRAGMENT_DELETE_LABEL,
  NOTEBOOK_FRAGMENT_DELETED_FEEDBACK,
  NOTEBOOK_FRAGMENT_EDIT_FORM_ARIA_LABEL,
  NOTEBOOK_FRAGMENT_EDIT_LABEL,
  NOTEBOOK_FRAGMENT_SAVE_LABEL,
  NOTEBOOK_FRAGMENT_SAVED_FEEDBACK,
  NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL,
  NOTEBOOK_HOVER_TABS,
  addNotebookFragmentForScope,
  canAuthorNotebookFragmentsForScope,
  defaultNotebookFragmentType,
  deleteNotebookFragment,
  editNotebookFragment,
  formatNotebookTabLabel,
  listNotebookFragmentTypeOptions,
  loadHoverCardNotebookPanelView,
  type HoverCardNotebookFragmentRow,
  type HoverCardNotebookPanelView,
  type NotebookHoverTab,
} from "../lib/hoverCardNotebook";
import { resolveTrayNavigationFeedback } from "../lib/workspaceTrayState";
import { handleNavigateToIocAnchorRequest } from "./iocTrayNavigation";
import { getPivotRecipes } from "../lib/pivots";
import { getCachedAnalystModeDisplayContext, getCachedEffectiveDefaultExportTemplateId } from "./analystModeStorage";
import { scheduleCopyFeedbackReset } from "../lib/motionPreference";
import { ENRICHMENT_SOURCE_LABELS } from "../lib/enrichmentSourceRegistry";
import { buildPreQueryDisclosureMessage, cancelPreQueryDisclosure, resolvePreQueryDisclosure } from "../lib/enrichmentPolicy";
import {
  formatSaveToCollectionFeedback,
  IOC_COLLECTION_CREATE_NEW_LABEL,
  IOC_COLLECTION_NEW_NAME_PLACEHOLDER,
  IOC_COLLECTION_NO_COLLECTIONS_TEXT,
  IOC_COLLECTION_PICKER_HEADING,
  IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL,
  IOC_COLLECTION_SAVE_TO_NEW_LABEL,
  normalizeIocCollectionName,
  type IocCollection,
} from "../lib/iocCollection";
import {
  requestAddIocToCollection,
  requestCreateIocCollection,
  requestListIocCollections,
} from "../lib/iocCollectionClient";
import {
  buildEnrichmentSummaryClassName,
  ensureVera5UiStyles,
} from "../lib/vera5UiStyles";
import {
  applyHoverCardFixedPosition,
  computeHoverCardPosition,
  readViewportSize,
  type AxisPoint,
  type HoverCardViewport,
} from "./hoverCardPosition";
import {
  DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
  resolveLocalLlmSummaryRequest,
} from "../lib/aiSummaryService";
import { getCachedLocalBackendEnabled } from "./localBackendStorage";
import { getCachedLocalLlmSummaryEnabled } from "./localLlmSummaryStorage";
import { getTabScanSummaryForCurrentTab } from "./tabScanSummaryContent";
import { formatRawVendorJsonForDisplay } from "../lib/enrichmentRawResponse";
import {
  createHoverCardRiskReasoningSection,
  resolveHoverCardRiskScorePresentation,
  resolveRiskScoreReasoningPresentation,
} from "../lib/scoring";

export {
  RISK_SCORE_REASONING_SECTION_CLASS as HOVER_CARD_RISK_REASONING_CLASS,
  RISK_SCORE_REASONING_HEADING_CLASS as HOVER_CARD_RISK_REASONING_HEADING_CLASS,
  RISK_SCORE_REASONING_CHAIN_CLASS as HOVER_CARD_RISK_REASONING_CHAIN_CLASS,
  RISK_SCORE_REASONING_STEP_CLASS as HOVER_CARD_RISK_REASONING_STEP_CLASS,
} from "../lib/scoring";

export const HOVER_CARD_HOST_ID = "vera5-hover-card-host";

function notifyInvestigationSessionExportRecorded(
  iocs?: ReadonlyArray<{ value: string; type?: IocType }>,
  options?: { templateId?: ExportTemplateId }
): void {
  void recordActiveInvestigationSessionExportEvent(
    iocs && iocs.length > 0
      ? {
          iocs,
          ...(options?.templateId !== undefined
            ? { templateId: options.templateId }
            : {}),
        }
      : options?.templateId !== undefined
        ? { templateId: options.templateId }
        : undefined
  );
}

function mapEnrichmentRecordsToTimelineIocs(
  records: ReadonlyArray<{ value: string; type?: IocType }>
): ReadonlyArray<{ value: string; type?: IocType }> {
  return records.map((record) => ({
    value: record.value,
    type: record.type,
  }));
}

let lastHoverCardAnchor: Element | null = null;
let lastHoverCardPayload: HoverCardOverlayPayload | null = null;
let lastHoverCardFocusReturnTarget: HTMLElement | null = null;
let hoverCardSaveToCollectionOpen = false;
let hoverCardSaveToCollectionFeedback: string | null = null;
let hoverCardSaveToCollectionNewName = "";
let hoverCardSaveToCollectionOptions: IocCollection[] = [];
let hoverCardSaveToCollectionLoading = false;

type HoverCardLocalLlmSummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; markdown: string };

let hoverCardLocalLlmSummaryState: HoverCardLocalLlmSummaryState = {
  status: "idle",
};

const HOVER_CARD_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function setHoverCardFocusReturnTarget(target: HTMLElement | null): void {
  lastHoverCardFocusReturnTarget = target;
}

export function focusFirstHoverCardControl(panel: HTMLElement): boolean {
  const focusable = panel.querySelector<HTMLElement>(HOVER_CARD_FOCUSABLE_SELECTOR);
  if (!focusable) {
    return false;
  }
  focusable.focus();
  return true;
}

function restoreHoverCardFocusReturn(doc: Document): void {
  const returnTarget = lastHoverCardFocusReturnTarget;
  lastHoverCardFocusReturnTarget = null;
  if (returnTarget?.isConnected && doc.contains(returnTarget)) {
    returnTarget.focus();
  }
}

export type ShowHoverCardFocusOptions = {
  moveFocus?: boolean;
};

export function getLastHoverCardAnchor(): Element | null {
  return lastHoverCardAnchor;
}

export function getLastHoverCardPayload(): HoverCardOverlayPayload | null {
  return lastHoverCardPayload;
}
export const HOVER_CARD_PANEL_CLASS = "vera5-hover-card-panel";
export const HOVER_CARD_COPY_BUTTON_CLASS = "vera5-hover-card-copy";
export const HOVER_CARD_PIVOT_NAV_CLASS = "vera5-hover-card-pivots";
export const HOVER_CARD_PIVOT_RECIPES_CLASS = "vera5-hover-card-pivot-recipes";
export const HOVER_CARD_PIVOT_RECIPES_LIST_CLASS =
  "vera5-hover-card-pivot-recipes-list";
export const HOVER_CARD_PIVOT_RECIPE_CLASS = "vera5-hover-card-pivot-recipe";
export const HOVER_CARD_PIVOT_RECIPE_SOURCE_CLASS =
  "vera5-hover-card-pivot-recipe-source";
export const HOVER_CARD_PIVOT_RECIPE_GUIDANCE_CLASS =
  "vera5-hover-card-pivot-recipe-guidance";
export const HOVER_CARD_PIVOT_LINK_CLASS = "vera5-hover-card-pivot-link";
export const HOVER_CARD_ENRICHMENT_CLASS = "vera5-hover-card-enrichment";
export const HOVER_CARD_TAGS_CLASS = "vera5-hover-card-tags";
export const HOVER_CARD_TAG_CLASS = "vera5-hover-card-tag";
export const HOVER_CARD_ATTRIBUTION_CLASS = "vera5-hover-card-attribution";
export const HOVER_CARD_DISCLAIMER_CLASS = "vera5-hover-card-disclaimer";
export const HOVER_CARD_ACTION_CLASS = "vera5-hover-card-action";
export const HOVER_CARD_RETRY_HINT_CLASS = "vera5-hover-card-retry-hint";
export const HOVER_CARD_SOURCES_CLASS = "vera5-hover-card-sources";
export const HOVER_CARD_SOURCE_ITEM_CLASS = "vera5-hover-card-source-item";
export const HOVER_CARD_SOURCE_BADGE_CLASS = "vera5-hover-card-source-badge";
export const HOVER_CARD_SOURCE_DETAIL_CLASS = "vera5-hover-card-source-detail";
export const HOVER_CARD_SOURCE_METADATA_CLASS = "vera5-hover-card-source-metadata";
export const HOVER_CARD_SOURCE_METADATA_CHIP_CLASS =
  "vera5-hover-card-source-metadata-chip";
export const HOVER_CARD_SOURCE_TAGS_CLASS = "vera5-hover-card-source-tags";
export const HOVER_CARD_RAW_JSON_CLASS = "vera5-hover-card-raw-json";
export const HOVER_CARD_RAW_JSON_BODY_CLASS = "vera5-hover-card-raw-json-body";
export const HOVER_CARD_RISK_SCORE_CLASS = "vera5-hover-card-risk-score";
export const HOVER_CARD_RISK_SCORE_LABEL_CLASS = "vera5-hover-card-risk-score-label";
export const HOVER_CARD_RISK_DISAGREEMENT_CLASS = "vera5-hover-card-risk-disagreement";
export const HOVER_CARD_RISK_SCORE_UNAVAILABLE_CLASS =
  "vera5-hover-card-risk-score-unavailable";
export const HOVER_CARD_RISK_SCORE_UNAVAILABLE_DETAIL_CLASS =
  "vera5-hover-card-risk-score-unavailable-detail";
export const HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS =
  "vera5-hover-card-risk-score-insufficient";
export const HOVER_CARD_ANALYST_NOTES_CLASS = "vera5-hover-card-analyst-notes";
export const HOVER_CARD_ANALYST_NOTES_LABEL_CLASS =
  "vera5-hover-card-analyst-notes-label";
export const HOVER_CARD_ANALYST_NOTES_INPUT_CLASS =
  "vera5-hover-card-analyst-notes-input";
export const HOVER_CARD_IOC_LABEL_CLASS = "vera5-hover-card-ioc-label";
export const HOVER_CARD_IOC_LABEL_LABEL_CLASS = "vera5-hover-card-ioc-label-label";
export const HOVER_CARD_IOC_LABEL_SELECT_CLASS = "vera5-hover-card-ioc-label-select";
export const HOVER_CARD_SAVE_TO_COLLECTION_CLASS = "vera5-hover-card-save-collection";
export const HOVER_CARD_SAVE_TO_COLLECTION_TOGGLE_CLASS =
  "vera5-hover-card-save-collection-toggle";
export const HOVER_CARD_SAVE_TO_COLLECTION_PANEL_CLASS =
  "vera5-hover-card-save-collection-panel";
export const HOVER_CARD_SAVE_TO_COLLECTION_HEADING_CLASS =
  "vera5-hover-card-save-collection-heading";
export const HOVER_CARD_SAVE_TO_COLLECTION_LIST_CLASS =
  "vera5-hover-card-save-collection-list";
export const HOVER_CARD_SAVE_TO_COLLECTION_FEEDBACK_CLASS =
  "vera5-hover-card-save-collection-feedback";
export const HOVER_CARD_SAVE_TO_COLLECTION_FIELD_CLASS =
  "vera5-hover-card-save-collection-field";
export const HOVER_CARD_IOC_TIMELINE_CLASS = "vera5-hover-card-ioc-timeline";
export const HOVER_CARD_IOC_TIMELINE_LABEL_CLASS = "vera5-hover-card-ioc-timeline-label";
export const HOVER_CARD_IOC_TIMELINE_LIST_CLASS = "vera5-hover-card-ioc-timeline-list";
export const HOVER_CARD_IOC_TIMELINE_ITEM_CLASS = "vera5-hover-card-ioc-timeline-item";
export const HOVER_CARD_CO_OCCURRENCE_CLASS = "vera5-hover-card-co-occurrence";
export const HOVER_CARD_CO_OCCURRENCE_LABEL_CLASS = "vera5-hover-card-co-occurrence-label";
export const HOVER_CARD_CO_OCCURRENCE_CONTEXT_CLASS =
  "vera5-hover-card-co-occurrence-context";
export const HOVER_CARD_CO_OCCURRENCE_LIST_CLASS = "vera5-hover-card-co-occurrence-list";
export const HOVER_CARD_CO_OCCURRENCE_ITEM_CLASS = "vera5-hover-card-co-occurrence-item";
export const HOVER_CARD_CO_OCCURRENCE_ITEM_BUTTON_CLASS =
  "vera5-hover-card-co-occurrence-item-button";
export const HOVER_CARD_CO_OCCURRENCE_FEEDBACK_CLASS =
  "vera5-hover-card-co-occurrence-feedback";
export const HOVER_CARD_RELATIONSHIP_CLASS = "vera5-hover-card-relationship";
export const HOVER_CARD_RELATIONSHIP_LABEL_CLASS =
  "vera5-hover-card-relationship-label";
export const HOVER_CARD_RELATIONSHIP_LIST_CLASS =
  "vera5-hover-card-relationship-list";
export const HOVER_CARD_RELATIONSHIP_ITEM_CLASS =
  "vera5-hover-card-relationship-item";
export const HOVER_CARD_NOTEBOOK_CLASS = "vera5-hover-card-notebook";
export const HOVER_CARD_NOTEBOOK_LABEL_CLASS = "vera5-hover-card-notebook-label";
export const HOVER_CARD_NOTEBOOK_TABS_CLASS = "vera5-hover-card-notebook-tabs";
export const HOVER_CARD_NOTEBOOK_TAB_CLASS = "vera5-hover-card-notebook-tab";
export const HOVER_CARD_NOTEBOOK_TAB_ACTIVE_CLASS =
  "vera5-hover-card-notebook-tab--active";
export const HOVER_CARD_NOTEBOOK_LIST_CLASS = "vera5-hover-card-notebook-list";
export const HOVER_CARD_NOTEBOOK_ITEM_CLASS = "vera5-hover-card-notebook-item";
export const HOVER_CARD_NOTEBOOK_ITEM_TYPE_CLASS =
  "vera5-hover-card-notebook-item-type";
export const HOVER_CARD_NOTEBOOK_ITEM_BADGE_CLASS =
  "vera5-hover-card-notebook-item-badge";
export const HOVER_CARD_NOTEBOOK_ITEM_BODY_CLASS =
  "vera5-hover-card-notebook-item-body";
export const HOVER_CARD_NOTEBOOK_EMPTY_CLASS = "vera5-hover-card-notebook-empty";
export const HOVER_CARD_NOTEBOOK_FORM_CLASS = "vera5-hover-card-notebook-form";
export const HOVER_CARD_NOTEBOOK_ACTIONS_CLASS =
  "vera5-hover-card-notebook-actions";
export const HOVER_CARD_NOTEBOOK_FEEDBACK_CLASS =
  "vera5-hover-card-notebook-feedback";
export const HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS =
  "vera5-hover-card-notebook-action";
export const HOVER_CARD_NOTEBOOK_TEXTAREA_CLASS =
  "vera5-hover-card-notebook-textarea";
export const HOVER_CARD_NOTEBOOK_SELECT_CLASS =
  "vera5-hover-card-notebook-select";
export const HOVER_CARD_IOC_PIN_BUTTON_CLASS = "vera5-hover-card-ioc-pin";
export const HOVER_CARD_IOC_PIN_BUTTON_PINNED_CLASS = "vera5-hover-card-ioc-pin--pinned";
export const HOVER_CARD_NOISE_RULE_MATCH_CLASS = "vera5-hover-card-noise-rule-match";
export const HOVER_CARD_NOISE_RULE_BADGE_CLASS = "vera5-hover-card-noise-rule-badge";
export const HOVER_CARD_KNOWN_GOOD_BADGE_CLASS = "vera5-hover-card-known-good-badge";
export const HOVER_CARD_KNOWN_GOOD_MATCH_CLASS = "vera5-hover-card-known-good-match";
export const HOVER_CARD_KNOWN_GOOD_SUMMARY_CLASS = "vera5-hover-card-known-good-summary";
export const HOVER_CARD_KNOWN_GOOD_HINT_CLASS = "vera5-hover-card-known-good-hint";
export const HOVER_CARD_KNOWN_GOOD_ID_CLASS = "vera5-hover-card-known-good-id";
export const HOVER_CARD_NOISE_RULE_SUMMARY_CLASS = "vera5-hover-card-noise-rule-summary";
export const HOVER_CARD_NOISE_RULE_HINT_CLASS = "vera5-hover-card-noise-rule-hint";
export const HOVER_CARD_EXPORT_SECTION_CLASS = "vera5-hover-card-export";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS = "vera5-hover-card-local-llm-summary";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS =
  "vera5-hover-card-local-llm-summary-status";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_BODY_CLASS =
  "vera5-hover-card-local-llm-summary-body";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER_CLASS =
  "vera5-hover-card-local-llm-summary-disclaimer";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING =
  "AI summary (local, unverified)";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING_CLASS =
  "vera5-hover-card-local-llm-summary-heading";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_PANEL_CLASS =
  "vera5-hover-card-local-llm-summary-panel";
export const HOVER_CARD_GENERATE_SUMMARY_LABEL = "Generate summary";
export const HOVER_CARD_GENERATE_SUMMARY_LOADING_LABEL = "Generating summary…";
export const HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER =
  "This narrative is generated by a model you run on localhost from normalized enrichment JSON only. It is not a risk verdict and does not replace the local composite score or per-source vendor rows. Verify all claims against the enrichment card before acting.";
export const HOVER_CARD_EXPORT_ACTIONS_CLASS = "vera5-hover-card-export-actions";
export const HOVER_CARD_EXPORT_BUTTON_CLASS = "vera5-hover-card-export-button";
export const HOVER_CARD_EXPORT_DROPDOWN_CLASS = "vera5-hover-card-export-dropdown";
export const HOVER_CARD_EXPORT_DROPDOWN_MENU_CLASS =
  "vera5-hover-card-export-dropdown-menu";
export const HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS =
  "vera5-hover-card-export-dropdown-item";
export const HOVER_CARD_EXPORT_FOOTER_CLASS = "vera5-hover-card-export-footer";
export const HOVER_CARD_SCAN_EXPORT_STATUS_CLASS =
  "vera5-hover-card-scan-export-status";
export const HOVER_CARD_SCAN_EXPORT_CLASS = "vera5-hover-card-scan-export";
export const HOVER_CARD_SCAN_EXPORT_TEMPLATE_ROW_CLASS =
  "vera5-hover-card-scan-export-template-row";
export const HOVER_CARD_SCAN_EXPORT_TEMPLATE_LABEL_CLASS =
  "vera5-hover-card-scan-export-template-label";
export const HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_CLASS =
  "vera5-hover-card-scan-export-template-select";
export const HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID =
  "vera5-hover-card-scan-export-template-select";
export const HOVER_CARD_SECTION_HEADING_CLASS = "vera5-hover-card-section-heading";
export const HOVER_CARD_INTEL_SUMMARY_CLASS = "vera5-hover-card-intel-summary";
export const HOVER_CARD_WHY_DETECTED_CLASS = "vera5-why-detected";
export const HOVER_CARD_WHY_DETECTED_LIST_CLASS = "vera5-why-detected-list";
export const HOVER_CARD_WHY_DETECTED_ITEM_CLASS = "vera5-why-detected-item";
export const TRAY_WHY_DETECTED_CLASS = "vera5-tray-why-detected";

const TYPE_LABELS: Record<IocType, string> = {
  ipv4: "IPv4 address",
  domain: "Domain",
  url: "URL",
  md5: "MD5 hash",
  sha1: "SHA1 hash",
  sha256: "SHA256 hash",
  cve: "CVE ID",
  email: "Email address",
  asn: "ASN",
  cidr: "IPv4 CIDR",
  filepath: "File path",
  onion: "Onion domain",
};

export type HoverCardOverlayPayload = {
  value: string;
  type: IocType;
  displayValue?: string;
  ruleId?: IocRuleId;
  sourceTextHint?: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  enrichmentState?: HoverCardEnrichmentState;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  disabledSources?: readonly EnrichmentSourceId[];
  enabledEnrichmentSourceIds?: readonly EnrichmentSourceId[];
  showDisabledSourcesInWorkspace?: boolean;
  sourceResults?: readonly HoverCardSourceEntry[];
  analystNotes?: string;
  iocLabel?: IocLabelId;
  preQueryDisclosure?: {
    sourceIds: readonly EnrichmentSourceId[];
  };
};

function formatTypeLabel(type: IocType): string {
  return TYPE_LABELS[type];
}

function createSectionHeading(text: string, doc: Document): HTMLHeadingElement {
  const heading = doc.createElement("h2");
  heading.className = HOVER_CARD_SECTION_HEADING_CLASS;
  heading.textContent = text;
  return heading;
}

function createRiskScoreUnavailableSection(
  headline: string,
  detail: string,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_RISK_SCORE_CLASS;
  section.setAttribute("aria-label", "Risk score");

  const headlineRow = doc.createElement("p");
  headlineRow.className = HOVER_CARD_RISK_SCORE_UNAVAILABLE_CLASS;
  headlineRow.textContent = headline;
  section.appendChild(headlineRow);

  const detailRow = doc.createElement("p");
  detailRow.className = HOVER_CARD_RISK_SCORE_UNAVAILABLE_DETAIL_CLASS;
  detailRow.setAttribute("role", "note");
  detailRow.textContent = detail;
  section.appendChild(detailRow);

  return section;
}

function createRiskScoreSection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const disabledSources = payload.disabledSources ?? [];
  const sourceResults = payload.sourceResults ?? [];
  const presentation = resolveHoverCardRiskScorePresentation(
    disabledSources,
    sourceResults
  );
  if (!presentation) {
    return null;
  }

  if (presentation.mode === "unavailable") {
    return createRiskScoreUnavailableSection(
      presentation.headline,
      presentation.detail,
      doc
    );
  }

  const view = presentation.view;

  const section = doc.createElement("section");
  section.className = HOVER_CARD_RISK_SCORE_CLASS;
  section.setAttribute("aria-label", "Risk score");

  const labelRow = doc.createElement("p");
  labelRow.className = HOVER_CARD_RISK_SCORE_LABEL_CLASS;
  labelRow.textContent = "Risk score: ";
  const emphasis = doc.createElement("strong");
  emphasis.textContent = view.summaryText;
  labelRow.appendChild(emphasis);
  section.appendChild(labelRow);

  if (presentation.insufficientCompositeNotice) {
    const insufficient = doc.createElement("p");
    insufficient.className = HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS;
    insufficient.setAttribute("role", "note");
    insufficient.textContent = presentation.insufficientCompositeNotice;
    section.appendChild(insufficient);
  }

  section.appendChild(
    createHoverCardRiskReasoningSection(
      resolveRiskScoreReasoningPresentation(
        view,
        presentation.insufficientCompositeNotice
      ),
      doc
    )
  );

  if (view.chain.showDisagreement) {
    const disagreement = doc.createElement("p");
    disagreement.className = HOVER_CARD_RISK_DISAGREEMENT_CLASS;
    disagreement.setAttribute("role", "note");
    disagreement.textContent = view.chain.disagreementLine;
    section.appendChild(disagreement);
  }

  return section;
}

function createRawVendorJsonDetails(
  rawVendorJson: string,
  doc: Document,
  summaryLabel: string = HOVER_CARD_RAW_JSON_SUMMARY_LABEL
): HTMLDetailsElement {
  const details = doc.createElement("details");
  details.className = HOVER_CARD_RAW_JSON_CLASS;

  const summary = doc.createElement("summary");
  summary.textContent = summaryLabel;
  details.appendChild(summary);

  const pre = doc.createElement("pre");
  pre.className = HOVER_CARD_RAW_JSON_BODY_CLASS;
  pre.textContent = formatRawVendorJsonForDisplay(rawVendorJson);
  details.appendChild(pre);

  return details;
}

function createPivotRecipesPanel(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const displayContext = getCachedAnalystModeDisplayContext();
  const recipes = getPivotRecipes(payload.type, payload.value, {
    enabledSourceIds: payload.enabledEnrichmentSourceIds,
    showDisabledSources: payload.showDisabledSourcesInWorkspace,
    emphasisProviders: displayContext.pivotEmphasisProviders,
  });
  if (recipes.length === 0) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_PIVOT_RECIPES_CLASS;
  section.setAttribute("aria-label", "Recommended next pivots");

  section.appendChild(createSectionHeading("Recommended next pivots", doc));

  const list = doc.createElement("ul");
  list.className = HOVER_CARD_PIVOT_RECIPES_LIST_CLASS;

  for (const recipe of recipes) {
    const item = doc.createElement("li");
    item.className = HOVER_CARD_PIVOT_RECIPE_CLASS;

    const sourceBadge = doc.createElement("span");
    sourceBadge.className = HOVER_CARD_PIVOT_RECIPE_SOURCE_CLASS;
    sourceBadge.textContent = recipe.sourceLabel;

    const anchor = doc.createElement("a");
    anchor.className = HOVER_CARD_PIVOT_LINK_CLASS;
    anchor.href = recipe.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = recipe.label;

    const guidance = doc.createElement("span");
    guidance.className = HOVER_CARD_PIVOT_RECIPE_GUIDANCE_CLASS;
    guidance.textContent = recipe.guidance;

    item.append(sourceBadge, anchor, guidance);
    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function appendSourceMetadataChips(
  item: HTMLElement,
  chips: readonly { kind: "reliability" | "freshness" | "sourceClass"; label: string; tooltip: string }[],
  doc: Document
): void {
  if (!chips || chips.length === 0) {
    return;
  }

  const row = doc.createElement("div");
  row.className = HOVER_CARD_SOURCE_METADATA_CLASS;
  row.setAttribute("role", "list");
  row.setAttribute("aria-label", "Source metadata");
  row.title = HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP;

  for (const chip of chips) {
    const span = doc.createElement("span");
    span.className = buildSourceMetadataChipClassName(chip.kind);
    span.setAttribute("role", "listitem");
    span.title = chip.tooltip;
    span.textContent = chip.label;
    row.appendChild(span);
  }

  item.appendChild(row);
}

function createSourceResultsSection(
  sourceResults: readonly HoverCardSourceEntry[],
  doc: Document
): HTMLElement | null {
  if (sourceResults.length <= 1) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_SOURCES_CLASS;
  section.setAttribute("aria-label", "Enrichment source results");

  section.appendChild(createSectionHeading("Sources", doc));

  const list = doc.createElement("ul");
  list.className = "vera5-hover-card-sources-list";

  for (const entry of sourceResults) {
    const item = doc.createElement("li");
    item.className = HOVER_CARD_SOURCE_ITEM_CLASS;

    const badge = doc.createElement("span");
    badge.className = buildSourceStatusBadgeClassName(
      entry.status,
      entry.fromCache
    );
    badge.textContent = `${entry.label} · ${entry.badgeText}`;
    item.appendChild(badge);

    appendSourceMetadataChips(item, entry.metadataChips ?? [], doc);

    const detail = doc.createElement("span");
    detail.className = HOVER_CARD_SOURCE_DETAIL_CLASS;
    detail.textContent = entry.detail;
    item.appendChild(detail);

    if (entry.tags && entry.tags.length > 0) {
      const tagsRow = createEnrichmentTagsSection(entry.tags, doc);
      if (tagsRow) {
        tagsRow.classList.add(HOVER_CARD_SOURCE_TAGS_CLASS);
        item.appendChild(tagsRow);
      }
    }

    if (entry.lastUpdatedLine) {
      const lastUpdated = doc.createElement("span");
      lastUpdated.className = "vera5-hover-card-source-last-updated";
      lastUpdated.setAttribute("role", "note");
      lastUpdated.textContent = entry.lastUpdatedLine;
      item.appendChild(lastUpdated);
    }

    if (entry.retryHint) {
      const retry = doc.createElement("span");
      retry.className = HOVER_CARD_RETRY_HINT_CLASS;
      retry.setAttribute("role", "note");
      retry.textContent = entry.retryHint;
      item.appendChild(retry);
    }

    if (entry.rawVendorJson?.trim()) {
      item.appendChild(createRawVendorJsonDetails(entry.rawVendorJson, doc));
    }

    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function createDisabledSourcesSection(
  placeholders: ReturnType<
    typeof resolveHoverCardDisplayView
  >["disabledSourcePlaceholders"],
  doc: Document
): HTMLElement | null {
  if (placeholders.length === 0) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_SOURCES_CLASS;
  section.setAttribute("aria-label", "Enrichment sources");

  section.appendChild(createSectionHeading("Sources", doc));

  const list = doc.createElement("ul");
  list.className = "vera5-hover-card-sources-list";

  for (const entry of placeholders) {
    const item = doc.createElement("li");
    item.className = HOVER_CARD_SOURCE_ITEM_CLASS;
    item.textContent = `${entry.label} — ${entry.message}`;
    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function createEnrichmentTagsSection(
  tags: readonly string[],
  doc: Document
): HTMLElement | null {
  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  if (normalized.length === 0) {
    return null;
  }

  const row = doc.createElement("div");
  row.className = HOVER_CARD_TAGS_CLASS;
  row.setAttribute("role", "list");
  row.setAttribute("aria-label", "Threat intelligence tags");

  for (const tag of normalized) {
    const chip = doc.createElement("span");
    chip.className = HOVER_CARD_TAG_CLASS;
    chip.setAttribute("role", "listitem");
    chip.textContent = tag;
    row.appendChild(chip);
  }

  return row;
}

function createHoverCardDisclaimerFooter(
  disclaimerLines: readonly string[],
  disclaimerInput: HoverCardDisclaimerInput,
  doc: Document
): HTMLElement | null {
  if (disclaimerLines.length === 0) {
    return null;
  }

  const footer = doc.createElement("footer");
  footer.className = HOVER_CARD_DISCLAIMER_CLASS;
  footer.setAttribute(
    "aria-label",
    resolveHoverCardDisclaimerAriaLabel(disclaimerInput)
  );

  for (const line of disclaimerLines) {
    const paragraph = doc.createElement("p");
    paragraph.setAttribute("role", "note");
    paragraph.textContent = line;
    footer.appendChild(paragraph);
  }

  return footer;
}

function createSourceAttributionFooter(
  sourceAttribution: EnrichmentSourceAttribution,
  enrichmentState: HoverCardEnrichmentState,
  doc: Document
): HTMLElement {
  const footer = doc.createElement("p");
  footer.className = HOVER_CARD_ATTRIBUTION_CLASS;
  footer.setAttribute("role", "note");
  footer.textContent = formatEnrichmentSourceAttribution(
    sourceAttribution,
    enrichmentState
  );
  return footer;
}

function createMissingKeyAction(doc: Document): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_ACTION_CLASS;
  button.textContent = HOVER_CARD_OPEN_SETTINGS_LABEL;
  button.setAttribute("aria-label", "Open Vera5 Settings to add an API key");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    safeOpenOptionsPage();
  });
  return button;
}

function createKnownGoodMatchSection(
  iocValue: string,
  doc: Document,
  options?: {
    insertBadgeAfter?: HTMLElement;
    enrichSkippedByPolicy?: boolean;
  }
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_KNOWN_GOOD_MATCH_CLASS;
  section.hidden = true;
  section.setAttribute("aria-label", KNOWN_GOOD_MATCH_SECTION_ARIA_LABEL);

  void listStoredKnownGoodEntriesForMatching()
    .then((entries) => {
      const matched = findMatchingKnownGoodEntry(entries, iocValue);
      if (!matched || !section.isConnected) {
        return;
      }
      const view = buildKnownGoodMatchBadgeView(matched);
      section.hidden = false;
      section.dataset.vera5KnownGoodEntryId = view.entryId;
      section.dataset.vera5KnownGoodCategory = view.category;
      section.dataset.vera5KnownGoodMatchType = view.matchType;
      section.dataset.vera5KnownGoodPattern = view.pattern;

      if (options?.insertBadgeAfter?.isConnected) {
        const headerBadge = doc.createElement("span");
        headerBadge.className = HOVER_CARD_KNOWN_GOOD_BADGE_CLASS;
        headerBadge.textContent = view.badgeLabel;
        headerBadge.setAttribute("data-vera5-known-good-badge", "true");
        headerBadge.dataset.vera5KnownGoodEntryId = view.entryId;
        options.insertBadgeAfter.insertAdjacentElement("afterend", headerBadge);
      }

      const summary = doc.createElement("p");
      summary.className = HOVER_CARD_KNOWN_GOOD_SUMMARY_CLASS;
      summary.textContent = view.entrySummary;
      section.appendChild(summary);

      const hint = doc.createElement("p");
      hint.className = HOVER_CARD_KNOWN_GOOD_HINT_CLASS;
      hint.textContent = view.hint;
      section.appendChild(hint);

      const idLine = doc.createElement("p");
      idLine.className = HOVER_CARD_KNOWN_GOOD_ID_CLASS;
      idLine.textContent = `Entry id: ${view.entryId}`;
      section.appendChild(idLine);

      if (options?.enrichSkippedByPolicy === true) {
        const skipped = doc.createElement("p");
        skipped.className = "vera5-hover-card-known-good-enrich-skipped";
        skipped.setAttribute("data-vera5-known-good-enrich-skipped", "true");
        skipped.setAttribute("role", "status");
        skipped.textContent = KNOWN_GOOD_ENRICH_SKIPPED_LABEL;
        section.appendChild(skipped);
      }

      const link = doc.createElement("button");
      link.type = "button";
      link.className = HOVER_CARD_ACTION_CLASS;
      link.textContent = view.viewEntryLabel;
      link.setAttribute("aria-label", view.viewEntryAriaLabel);
      link.setAttribute("data-vera5-known-good-entry-link", "true");
      link.addEventListener("click", (event) => {
        event.stopPropagation();
        safeOpenOptionsPageWithHash(buildKnownGoodOptionsHash(view.entryId));
      });
      section.appendChild(link);
    })
    .catch(() => {
      /* keep panel without known-good provenance when list cannot load */
    });

  return section;
}

function createNoiseRuleDeprioritizedSection(
  iocValue: string,
  doc: Document,
  options?: { insertBadgeAfter?: HTMLElement }
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_NOISE_RULE_MATCH_CLASS;
  section.hidden = true;
  section.setAttribute("aria-label", "Matched noise rule");

  void listStoredNoiseRules()
    .then((rules) => {
      const matched = findMatchingNoiseRule(rules, iocValue);
      if (!matched || !section.isConnected) {
        return;
      }
      const view = buildNoiseRuleHoverMatchView(matched);
      section.hidden = false;
      section.dataset.vera5NoiseRuleId = view.ruleId;

      if (options?.insertBadgeAfter?.isConnected) {
        const headerBadge = doc.createElement("span");
        headerBadge.className = HOVER_CARD_NOISE_RULE_BADGE_CLASS;
        headerBadge.textContent = view.badgeLabel;
        headerBadge.setAttribute("data-vera5-noise-deprioritized-badge", "true");
        options.insertBadgeAfter.insertAdjacentElement("afterend", headerBadge);
      } else {
        const badge = doc.createElement("span");
        badge.className = HOVER_CARD_NOISE_RULE_BADGE_CLASS;
        badge.textContent = view.badgeLabel;
        badge.setAttribute("data-vera5-noise-deprioritized-badge", "true");
        section.appendChild(badge);
      }

      const summary = doc.createElement("p");
      summary.className = HOVER_CARD_NOISE_RULE_SUMMARY_CLASS;
      summary.textContent = view.ruleSummary;
      section.appendChild(summary);

      const hint = doc.createElement("p");
      hint.className = HOVER_CARD_NOISE_RULE_HINT_CLASS;
      hint.textContent = view.hint;
      section.appendChild(hint);

      const link = doc.createElement("button");
      link.type = "button";
      link.className = HOVER_CARD_ACTION_CLASS;
      link.textContent = view.viewRuleLabel;
      link.setAttribute("aria-label", view.viewRuleAriaLabel);
      link.setAttribute("data-vera5-noise-rule-link", "true");
      link.addEventListener("click", (event) => {
        event.stopPropagation();
        safeOpenOptionsPageWithHash(buildNoiseRulesOptionsHash(view.ruleId));
      });
      section.appendChild(link);
    })
    .catch(() => {
      /* keep section hidden when rules cannot load */
    });

  return section;
}

function createSingleSourceLastUpdated(
  line: string,
  doc: Document
): HTMLElement {
  const note = doc.createElement("p");
  note.className = "vera5-hover-card-source-last-updated";
  note.setAttribute("role", "note");
  note.textContent = line;
  return note;
}

function createRateLimitRetryHint(retryHint: string, doc: Document): HTMLElement {
  const hint = doc.createElement("p");
  hint.className = HOVER_CARD_RETRY_HINT_CLASS;
  hint.setAttribute("role", "note");
  hint.textContent = retryHint;
  return hint;
}

function createCopyIndicatorButton(
  copyValue: string,
  label: string,
  ariaLabel: string,
  doc: Document
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_COPY_BUTTON_CLASS;
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);

  button.addEventListener("click", () => {
    void copyTextToClipboard(copyValue).then((success) => {
      if (!success) {
        return;
      }
      button.textContent = HOVER_CARD_COPY_COPIED_LABEL;
      button.classList.add("vera5-hover-card-copy--copied");
      const docView = doc.defaultView ?? window;
      scheduleCopyFeedbackReset(() => {
        button.textContent = label;
        button.classList.remove("vera5-hover-card-copy--copied");
      }, docView);
    });
  });

  return button;
}

function createIndicatorCopyActions(
  payload: Pick<HoverCardOverlayPayload, "value" | "displayValue">,
  doc: Document
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const presentation = resolveIndicatorValuePresentation(payload);
  for (const action of resolveIndicatorCopyActions(presentation)) {
    fragment.appendChild(
      createCopyIndicatorButton(
        action.copyValue,
        action.label,
        action.ariaLabel,
        doc
      )
    );
  }
  return fragment;
}

export function createOpenLiveUrlButton(
  liveUrl: string,
  doc: Document
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_ACTION_CLASS;
  button.textContent = HOVER_CARD_OPEN_LIVE_URL_LABEL;
  button.setAttribute("aria-label", HOVER_CARD_OPEN_LIVE_URL_LABEL);
  button.addEventListener("click", () => {
    const docView = doc.defaultView ?? window;
    if (!confirmOpenLiveUrl(docView)) {
      return;
    }
    openLiveUrlInNewTab(liveUrl, docView);
  });
  return button;
}

function createPreQueryDisclosureSection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const disclosure = payload.preQueryDisclosure;
  if (!disclosure || disclosure.sourceIds.length === 0) {
    return null;
  }

  const sourceLabels = disclosure.sourceIds.map(
    (sourceId) => ENRICHMENT_SOURCE_LABELS[sourceId]
  );
  const message = buildPreQueryDisclosureMessage({
    sourceLabels,
    value: payload.displayValue ?? payload.value,
    typeLabel: formatTypeLabel(payload.type),
  });

  const section = doc.createElement("section");
  section.className = "vera5-pre-query-disclosure";
  section.setAttribute("aria-label", PRE_QUERY_DISCLOSURE_SECTION_ARIA_LABEL);

  section.appendChild(createSectionHeading(PRE_QUERY_DISCLOSURE_HEADING, doc));

  const body = doc.createElement("p");
  body.className = "vera5-pre-query-disclosure__message";
  body.setAttribute("role", "note");
  body.textContent = message;
  section.appendChild(body);

  const rememberLabel = doc.createElement("label");
  rememberLabel.className = "vera5-pre-query-disclosure__remember";
  const rememberCheckbox = doc.createElement("input");
  rememberCheckbox.type = "checkbox";
  rememberCheckbox.setAttribute(
    "aria-label",
    PRE_QUERY_DISCLOSURE_REMEMBER_LABEL
  );
  rememberLabel.appendChild(rememberCheckbox);
  rememberLabel.append(` ${PRE_QUERY_DISCLOSURE_REMEMBER_LABEL}`);
  section.appendChild(rememberLabel);

  const actions = doc.createElement("div");
  actions.className = "vera5-pre-query-disclosure__actions";

  const sendButton = doc.createElement("button");
  sendButton.type = "button";
  sendButton.className = HOVER_CARD_ACTION_CLASS;
  sendButton.textContent = PRE_QUERY_DISCLOSURE_SEND_LABEL;
  sendButton.setAttribute("aria-label", PRE_QUERY_DISCLOSURE_SEND_LABEL);
  sendButton.addEventListener("click", (event) => {
    event.stopPropagation();
    resolvePreQueryDisclosure({
      proceed: true,
      rememberDismiss: rememberCheckbox.checked,
    });
  });
  actions.appendChild(sendButton);

  const cancelButton = doc.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = HOVER_CARD_ACTION_CLASS;
  cancelButton.textContent = PRE_QUERY_DISCLOSURE_CANCEL_LABEL;
  cancelButton.setAttribute("aria-label", PRE_QUERY_DISCLOSURE_CANCEL_LABEL);
  cancelButton.addEventListener("click", (event) => {
    event.stopPropagation();
    resolvePreQueryDisclosure({
      proceed: false,
      rememberDismiss: false,
    });
  });
  actions.appendChild(cancelButton);

  section.appendChild(actions);
  return section;
}

export function buildExportRecordFromPayload(
  payload: HoverCardOverlayPayload
) {
  return buildNormalizedEnrichmentRecord({
    value: payload.value,
    iocType: payload.type,
    enrichmentState: payload.enrichmentState,
    summary: payload.summary,
    tags: payload.tags,
    disabledSources: payload.disabledSources,
    sourceResults: payload.sourceResults,
    analystNotes: resolveHoverCardAnalystNote(payload.value, payload.analystNotes),
  });
}

function closeExportDropdownMenus(doc: Document): void {
  for (const menu of doc.querySelectorAll(
    `.${HOVER_CARD_EXPORT_DROPDOWN_MENU_CLASS}`
  )) {
    (menu as HTMLElement).hidden = true;
  }
  for (const trigger of doc.querySelectorAll(
    `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS} .${HOVER_CARD_EXPORT_BUTTON_CLASS}`
  )) {
    trigger.setAttribute("aria-expanded", "false");
  }
}

function ensureExportDropdownDismiss(doc: Document): void {
  if (doc.documentElement.dataset.vera5ExportDropdownDismiss === "1") {
    return;
  }
  doc.documentElement.dataset.vera5ExportDropdownDismiss = "1";
  doc.addEventListener("click", () => {
    closeExportDropdownMenus(doc);
  });
}

type ExportDropdownItem = {
  label: string;
  action: () => void | Promise<void>;
};

function createActionDropdown(
  triggerLabel: string,
  ariaLabel: string,
  items: readonly ExportDropdownItem[],
  doc: Document
): HTMLElement {
  const container = doc.createElement("div");
  container.className = HOVER_CARD_EXPORT_DROPDOWN_CLASS;

  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.className = HOVER_CARD_EXPORT_BUTTON_CLASS;
  trigger.textContent = triggerLabel;
  trigger.setAttribute("aria-label", ariaLabel);
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");

  const menu = doc.createElement("ul");
  menu.className = HOVER_CARD_EXPORT_DROPDOWN_MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  for (const item of items) {
    const row = doc.createElement("li");
    row.setAttribute("role", "none");
    const button = doc.createElement("button");
    button.type = "button";
    button.className = HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS;
    button.textContent = item.label;
    button.setAttribute("role", "menuitem");
    button.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeExportDropdownMenus(doc);
      void Promise.resolve(item.action());
    });
    row.appendChild(button);
    menu.appendChild(row);
  }

  trigger.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeExportDropdownMenus(doc);
    menu.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  container.appendChild(trigger);
  container.appendChild(menu);
  return container;
}

function buildExportFormatActions(
  buildRecord: () => ReturnType<typeof buildExportRecordFromPayload>,
  doc: Document,
  mode: "export" | "copy"
): readonly ExportDropdownItem[] {
  const formats: readonly {
    format: EnrichmentExportFileFormat;
    exportLabel: string;
    copyLabel: string;
  }[] = [
    { format: "markdown", exportLabel: "Export Markdown", copyLabel: "Copy Markdown" },
    { format: "json", exportLabel: "Export JSON", copyLabel: "Copy JSON" },
    { format: "txt", exportLabel: "Export TXT", copyLabel: "Copy TXT" },
  ];

  return formats.map(({ format, exportLabel, copyLabel }) => ({
    label: mode === "export" ? exportLabel : copyLabel,
    action: () => {
      const record = buildRecord();
      const timelineIocs = [{ value: record.value, type: record.type }];
      if (mode === "export") {
        downloadEnrichmentExportFile(record, format, doc);
        notifyInvestigationSessionExportRecorded(timelineIocs);
        return;
      }
      if (format === "markdown") {
        void copyEnrichmentExportMarkdownToClipboard(record).then((copied) => {
          if (copied) {
            notifyInvestigationSessionExportRecorded(timelineIocs);
          }
        });
        return;
      }
      if (format === "json") {
        void copyEnrichmentExportJsonToClipboard(record).then((copied) => {
          if (copied) {
            notifyInvestigationSessionExportRecorded(timelineIocs);
          }
        });
        return;
      }
      void copyEnrichmentExportTxtToClipboard(record).then((copied) => {
        if (copied) {
          notifyInvestigationSessionExportRecorded(timelineIocs);
        }
      });
    },
  }));
}

function buildScanListCopyDropdownActions(
  doc: Document,
  statusEl: HTMLElement
): readonly ExportDropdownItem[] {
  const runCopyAll = (): void => {
    const syncContext = resolveScanListExportContextSync();
    if (syncContext && syncContext.summary.entries.length > 0) {
      void copyTextToClipboard(
        buildTabScanIocListClipboardText(syncContext.summary.entries)
      ).then((copied) => {
        setScanExportStatus(
          statusEl,
          resolveTrayCopyFeedback({
            copied,
            count: syncContext.summary.entries.length,
            filtered: false,
          }),
          copied
        );
      });
      return;
    }

    void loadScanListExportContext().then((context) => {
      if (!context || context.summary.entries.length === 0) {
        setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
        return;
      }
      void copyTextToClipboard(
        buildTabScanIocListClipboardText(context.summary.entries)
      ).then((copied) => {
        setScanExportStatus(
          statusEl,
          resolveTrayCopyFeedback({
            copied,
            count: context.summary.entries.length,
            filtered: false,
          }),
          copied
        );
      });
    });
  };

  const runCopyFiltered = (): void => {
    const syncContext = resolveScanListExportContextSync();
    if (syncContext) {
      const filteredEntries = filterTabScanSummaryEntries(
        syncContext.summary.entries,
        syncContext.filter
      );
      if (filteredEntries.length === 0) {
        setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
        return;
      }
      void copyTextToClipboard(
        buildTabScanIocListClipboardText(filteredEntries)
      ).then((copied) => {
        setScanExportStatus(
          statusEl,
          resolveTrayCopyFeedback({
            copied,
            count: filteredEntries.length,
            filtered: true,
          }),
          copied
        );
      });
      return;
    }

    void loadScanListExportContext().then((context) => {
      if (!context) {
        setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
        return;
      }
      const filteredEntries = filterTabScanSummaryEntries(
        context.summary.entries,
        context.filter
      );
      if (filteredEntries.length === 0) {
        setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
        return;
      }
      void copyTextToClipboard(
        buildTabScanIocListClipboardText(filteredEntries)
      ).then((copied) => {
        setScanExportStatus(
          statusEl,
          resolveTrayCopyFeedback({
            copied,
            count: filteredEntries.length,
            filtered: true,
          }),
          copied
        );
      });
    });
  };

  return [
    {
      label: "Copy all",
      action: runCopyAll,
    },
    {
      label: "Copy filtered",
      action: runCopyFiltered,
    },
  ];
}

function buildCopyDropdownActions(
  buildRecord: () => ReturnType<typeof buildExportRecordFromPayload>,
  doc: Document,
  statusEl: HTMLElement
): readonly ExportDropdownItem[] {
  return [
    ...buildScanListCopyDropdownActions(doc, statusEl),
    ...buildScanListTemplateCopyDropdownActions(statusEl),
    ...buildExportFormatActions(buildRecord, doc, "copy"),
  ];
}

function buildExportDropdownActions(
  buildRecord: () => ReturnType<typeof buildExportRecordFromPayload>,
  doc: Document,
  statusEl: HTMLElement
): readonly ExportDropdownItem[] {
  return [
    ...buildScanListExportDropdownActions(doc, statusEl),
    ...buildExportFormatActions(buildRecord, doc, "export"),
  ];
}

export type ScanListExportContext = {
  summary: TabScanSummary;
  filter: IocTypeFilter;
};

function setScanExportStatus(
  statusEl: HTMLElement,
  message: string,
  success: boolean
): void {
  statusEl.textContent = message;
  statusEl.hidden = message.length === 0;
  statusEl.classList.remove(
    "vera5-hover-card-scan-export-status--success",
    "vera5-hover-card-scan-export-status--error"
  );
  statusEl.classList.add(
    success
      ? "vera5-hover-card-scan-export-status--success"
      : "vera5-hover-card-scan-export-status--error"
  );
}

const SCAN_EXPORT_NO_DATA_MESSAGE =
  "Scan this page first to export detected indicators.";

const SCAN_EXPORT_PREPARING_MESSAGE = "Preparing export…";

type ScanExportCache = {
  context: ScanListExportContext | null;
  records: NormalizedEnrichmentRecord[];
};

let scanExportCache: ScanExportCache | null = null;
let scanExportCachePromise: Promise<ScanExportCache> | null = null;

type ScanListExportContextProvider = () => ScanListExportContext | null;
let scanListExportContextProvider: ScanListExportContextProvider | null = null;

export function setScanListExportContextProvider(
  provider: ScanListExportContextProvider | null
): void {
  scanListExportContextProvider = provider;
}

function resolveScanListExportContextSync(): ScanListExportContext | null {
  if (scanListExportContextProvider) {
    return scanListExportContextProvider();
  }
  return scanExportCache?.context ?? null;
}

export function getScanListExportContext(): ScanListExportContext | null {
  return resolveScanListExportContextSync();
}

async function refreshScanExportCache(): Promise<ScanExportCache> {
  try {
    const context = resolveScanListExportContextSync() ?? (await loadScanListExportContext());
    if (!context) {
      return { context: null, records: [] };
    }

    const filteredEntries = filterTabScanSummaryEntries(
      context.summary.entries,
      context.filter
    );
    if (filteredEntries.length === 0) {
      return { context, records: [] };
    }

    const records = await buildTraySubsetEnrichmentRecords(filteredEntries);
    return { context, records };
  } catch {
    return { context: null, records: [] };
  }
}

function warmScanExportCache(): void {
  scanExportCachePromise = refreshScanExportCache().then((cache) => {
    scanExportCache = cache;
    return cache;
  });
}

function resetScanExportCache(): void {
  scanExportCache = null;
  scanExportCachePromise = null;
}

function withScanExportRecords(
  statusEl: HTMLElement,
  run: (cache: ScanExportCache) => void | Promise<void>,
  onError?: () => void
): void {
  const execute = (cache: ScanExportCache): void => {
    void Promise.resolve(run(cache)).catch(() => {
      if (onError) {
        onError();
        return;
      }
      setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
    });
  };

  if (scanExportCache && scanExportCache.records.length > 0) {
    execute(scanExportCache);
    warmScanExportCache();
    return;
  }

  setScanExportStatus(statusEl, SCAN_EXPORT_PREPARING_MESSAGE, false);
  void (scanExportCachePromise ?? refreshScanExportCache())
    .then((cache) => {
      scanExportCache = cache;
      execute(cache);
      warmScanExportCache();
    })
    .catch(() => {
      if (onError) {
        onError();
        return;
      }
      setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
    });
}

function resolveActiveTrayExportTemplateId(): ExportTemplateId {
  return getCachedEffectiveDefaultExportTemplateId();
}

function runTraySubsetExport(
  cache: ScanExportCache,
  format: TraySubsetExportFormat,
  doc: Document
): boolean {
  if (!cache.context || cache.records.length === 0) {
    return false;
  }
  const templateId = resolveActiveTrayExportTemplateId();
  if (format === "markdown") {
    downloadTrayTemplateExportFile(templateId, cache.records, doc);
  } else {
    downloadTraySubsetExportFile(cache.records, format, doc);
  }
  notifyInvestigationSessionExportRecorded(
    mapEnrichmentRecordsToTimelineIocs(cache.records),
    format === "markdown" ? { templateId } : undefined
  );
  return true;
}

function buildScanListExportDropdownActions(
  doc: Document,
  statusEl: HTMLElement
): readonly ExportDropdownItem[] {
  const formats: readonly {
    format: TraySubsetExportFormat;
    label: string;
  }[] = [
    { format: "markdown", label: "Export filtered Markdown" },
    { format: "json", label: "Export filtered JSON" },
  ];

  return formats.map(({ format, label }) => ({
    label,
    action: () => {
      withScanExportRecords(
        statusEl,
        (cache) => {
          if (!runTraySubsetExport(cache, format, doc)) {
            setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
            return;
          }
          setScanExportStatus(
            statusEl,
            resolveTrayExportFeedback({
              success: true,
              count: cache.records.length,
              format,
            }),
            true
          );
        },
        () => {
          setScanExportStatus(
            statusEl,
            resolveTrayExportFeedback({
              success: false,
              count: 0,
              format,
            }),
            false
          );
        }
      );
    },
  }));
}

function buildScanListTemplateCopyDropdownActions(
  statusEl: HTMLElement
): readonly ExportDropdownItem[] {
  const formats: readonly {
    format: TraySubsetExportFormat;
    label: string;
  }[] = [
    { format: "markdown", label: "Copy filtered Markdown" },
    { format: "json", label: "Copy filtered JSON" },
  ];

  return formats.map(({ format, label }) => ({
    label,
    action: () => {
      withScanExportRecords(
        statusEl,
        async (cache) => {
          if (!cache.context || cache.records.length === 0) {
            setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
            return;
          }

          const templateId = resolveActiveTrayExportTemplateId();
          const copied =
            format === "markdown"
              ? await copyTrayTemplateExportToClipboard(
                  templateId,
                  cache.records
                )
              : await copyTraySubsetExportJsonToClipboard(cache.records);

          setScanExportStatus(
            statusEl,
            resolveTraySubsetCopyFeedback({
              success: copied,
              count: cache.records.length,
              format,
            }),
            copied
          );
          if (copied) {
            notifyInvestigationSessionExportRecorded(
              mapEnrichmentRecordsToTimelineIocs(cache.records),
              format === "markdown" ? { templateId } : undefined
            );
          }
        },
        () => {
          setScanExportStatus(
            statusEl,
            resolveTraySubsetCopyFeedback({
              success: false,
              count: 0,
              format,
            }),
            false
          );
        }
      );
    },
  }));
}

function createTemplateExportRow(
  doc: Document,
  statusEl: HTMLElement
): HTMLElement {
  const templateRow = doc.createElement("div");
  templateRow.className = HOVER_CARD_SCAN_EXPORT_TEMPLATE_ROW_CLASS;
  templateRow.setAttribute("role", "group");
  templateRow.setAttribute("aria-label", "Export ticket templates");

  const templateLabel = doc.createElement("label");
  templateLabel.className = HOVER_CARD_SCAN_EXPORT_TEMPLATE_LABEL_CLASS;
  templateLabel.htmlFor = HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID;
  templateLabel.textContent = "Template";

  const templateSelect = doc.createElement("select");
  templateSelect.id = HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID;
  templateSelect.className = HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_CLASS;
  for (const templateId of listExportTemplateIds()) {
    const option = doc.createElement("option");
    option.value = templateId;
    option.textContent = getExportTemplateLabel(templateId);
    templateSelect.appendChild(option);
  }
  templateSelect.value = getCachedEffectiveDefaultExportTemplateId();

  const exportTemplateButton = doc.createElement("button");
  exportTemplateButton.type = "button";
  exportTemplateButton.className = HOVER_CARD_EXPORT_BUTTON_CLASS;
  exportTemplateButton.textContent = "Export template";
  exportTemplateButton.setAttribute(
    "aria-label",
    "Export filtered indicators using the selected template"
  );

  exportTemplateButton.addEventListener("click", () => {
    const selectedTemplate = templateSelect.value;
    if (!isExportTemplateId(selectedTemplate)) {
      return;
    }

    withScanExportRecords(
      statusEl,
      (cache) => {
        if (!cache.context || cache.records.length === 0) {
          setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
          return;
        }

        downloadTrayTemplateExportFile(selectedTemplate, cache.records, doc);
        notifyInvestigationSessionExportRecorded(
          mapEnrichmentRecordsToTimelineIocs(cache.records),
          { templateId: selectedTemplate }
        );
        setScanExportStatus(
          statusEl,
          resolveTrayTemplateExportFeedback({
            success: true,
            count: cache.records.length,
            templateId: selectedTemplate,
          }),
          true
        );
      },
      () => {
        setScanExportStatus(
          statusEl,
          resolveTrayTemplateExportFeedback({
            success: false,
            count: 0,
            templateId: selectedTemplate,
          }),
          false
        );
      }
    );
  });

  const copyTemplateButton = doc.createElement("button");
  copyTemplateButton.type = "button";
  copyTemplateButton.className = HOVER_CARD_EXPORT_BUTTON_CLASS;
  copyTemplateButton.textContent = "Copy template";
  copyTemplateButton.setAttribute(
    "aria-label",
    "Copy filtered indicators using the selected template"
  );

  copyTemplateButton.addEventListener("click", () => {
    const selectedTemplate = templateSelect.value;
    if (!isExportTemplateId(selectedTemplate)) {
      return;
    }

    withScanExportRecords(
      statusEl,
      async (cache) => {
        if (!cache.context || cache.records.length === 0) {
          setScanExportStatus(statusEl, SCAN_EXPORT_NO_DATA_MESSAGE, false);
          return;
        }

        const copied = await copyTrayTemplateExportToClipboard(
          selectedTemplate,
          cache.records
        );
        setScanExportStatus(
          statusEl,
          resolveTrayTemplateCopyFeedback({
            success: copied,
            count: cache.records.length,
            templateId: selectedTemplate,
          }),
          copied
        );
        if (copied) {
          notifyInvestigationSessionExportRecorded(
            mapEnrichmentRecordsToTimelineIocs(cache.records),
            { templateId: selectedTemplate }
          );
        }
      },
      () => {
        setScanExportStatus(
          statusEl,
          resolveTrayTemplateCopyFeedback({
            success: false,
            count: 0,
            templateId: selectedTemplate,
          }),
          false
        );
      }
    );
  });

  templateRow.append(
    templateLabel,
    templateSelect,
    exportTemplateButton,
    copyTemplateButton
  );
  return templateRow;
}

export async function loadScanListExportContext(): Promise<ScanListExportContext | null> {
  const syncContext = resolveScanListExportContextSync();
  if (syncContext) {
    return syncContext;
  }

  const summary = await getTabScanSummaryForCurrentTab();
  if (!summary || summary.entries.length === 0) {
    return null;
  }
  const filter = await getTabScanTrayFilter(summary.tabId);
  return { summary, filter };
}

export async function getFilteredTrayEnrichmentRecords(): Promise<
  readonly NormalizedEnrichmentRecord[]
> {
  const context = await loadScanListExportContext();
  if (!context) {
    return [];
  }

  const filteredEntries = filterTabScanSummaryEntries(
    context.summary.entries,
    context.filter
  );
  if (filteredEntries.length === 0) {
    return [];
  }

  return buildTraySubsetEnrichmentRecords(filteredEntries);
}

function createExportSection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement {
  ensureExportDropdownDismiss(doc);
  resetScanExportCache();
  warmScanExportCache();

  const section = doc.createElement("section");
  section.className = HOVER_CARD_EXPORT_SECTION_CLASS;
  section.setAttribute("aria-label", "Export case artifacts");

  const statusEl = doc.createElement("p");
  statusEl.className = HOVER_CARD_SCAN_EXPORT_STATUS_CLASS;
  statusEl.hidden = true;
  statusEl.setAttribute("aria-live", "polite");

  const footer = doc.createElement("div");
  footer.className = HOVER_CARD_EXPORT_FOOTER_CLASS;

  const indicatorActions = doc.createElement("div");
  indicatorActions.className = HOVER_CARD_EXPORT_ACTIONS_CLASS;
  indicatorActions.setAttribute("role", "group");
  indicatorActions.setAttribute("aria-label", "Export and copy case artifacts");

  const buildRecord = () => buildExportRecordFromPayload(payload);

  indicatorActions.appendChild(
    createActionDropdown(
      "Export",
      "Export case artifacts as a file",
      buildExportDropdownActions(buildRecord, doc, statusEl),
      doc
    )
  );
  indicatorActions.appendChild(
    createActionDropdown(
      "Copy",
      "Copy case artifacts to the clipboard",
      buildCopyDropdownActions(buildRecord, doc, statusEl),
      doc
    )
  );

  footer.appendChild(indicatorActions);
  footer.appendChild(createTemplateExportRow(doc, statusEl));
  footer.appendChild(statusEl);

  section.appendChild(footer);

  return section;
}

function createIocLabelSection(
  value: string,
  initialLabel: IocLabelId | null,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_IOC_LABEL_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_IOC_LABEL_SECTION_ARIA_LABEL);

  const heading = createSectionHeading(HOVER_CARD_IOC_LABEL_LABEL, doc);
  heading.id = "vera5-ioc-label-heading";
  heading.className = HOVER_CARD_IOC_LABEL_LABEL_CLASS;

  const select = doc.createElement("select");
  select.id = HOVER_CARD_IOC_LABEL_SELECT_ID;
  select.className = HOVER_CARD_IOC_LABEL_SELECT_CLASS;
  select.setAttribute("aria-labelledby", heading.id);

  const noneOption = doc.createElement("option");
  noneOption.value = HOVER_CARD_IOC_LABEL_NONE_VALUE;
  noneOption.textContent = "None";
  select.appendChild(noneOption);

  for (const labelId of IOC_LABEL_IDS) {
    const option = doc.createElement("option");
    option.value = labelId;
    option.textContent = formatIocLabelDisplay(labelId);
    select.appendChild(option);
  }

  select.value = initialLabel ?? HOVER_CARD_IOC_LABEL_NONE_VALUE;

  select.addEventListener("change", () => {
    const nextLabel =
      select.value === HOVER_CARD_IOC_LABEL_NONE_VALUE
        ? null
        : (select.value as IocLabelId);
    const learnNoiseRule =
      shouldOfferNoiseRuleLearnForLabel(nextLabel) &&
      confirmLearnNoiseRule(doc.defaultView ?? window);
    setSessionIocLabel(value, nextLabel, { learnNoiseRule });
  });
  select.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });

  primeIocLabelForIoc(value, (label) => {
    if (select.value === HOVER_CARD_IOC_LABEL_NONE_VALUE && label) {
      select.value = label;
    }
  });

  section.appendChild(heading);
  section.appendChild(select);
  return section;
}

function createIocPinButton(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_IOC_PIN_BUTTON_CLASS;
  button.setAttribute("aria-label", HOVER_CARD_IOC_PIN_ARIA_LABEL);

  const syncButton = (pinned: boolean): void => {
    button.setAttribute("aria-pressed", pinned ? "true" : "false");
    button.textContent = pinned ? HOVER_CARD_IOC_PINNED_LABEL : HOVER_CARD_IOC_PIN_LABEL;
    button.classList.toggle(HOVER_CARD_IOC_PIN_BUTTON_PINNED_CLASS, pinned);
  };

  syncButton(false);

  void getActiveInvestigationSession().then((session) => {
    if (!session) {
      return;
    }
    syncButton(isInvestigationSessionIocPinned(session, payload.value));
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggleActiveInvestigationSessionIocPin({
      iocValue: payload.value,
      iocType: payload.type,
    }).then((session) => {
      if (!session) {
        return;
      }
      syncButton(isInvestigationSessionIocPinned(session, payload.value));
    });
  });

  return button;
}

function createIocTimelineSection(value: string, doc: Document): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_IOC_TIMELINE_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_IOC_TIMELINE_SECTION_ARIA_LABEL);

  const heading = createSectionHeading(HOVER_CARD_IOC_TIMELINE_LABEL, doc);
  heading.id = "vera5-ioc-timeline-heading";
  heading.className = HOVER_CARD_IOC_TIMELINE_LABEL_CLASS;

  const list = doc.createElement("ul");
  list.className = HOVER_CARD_IOC_TIMELINE_LIST_CLASS;
  list.setAttribute("aria-labelledby", heading.id);

  const emptyItem = doc.createElement("li");
  emptyItem.className = HOVER_CARD_IOC_TIMELINE_ITEM_CLASS;
  emptyItem.textContent = HOVER_CARD_IOC_TIMELINE_EMPTY_TEXT;
  list.appendChild(emptyItem);

  section.appendChild(heading);
  section.appendChild(list);

  void getActiveInvestigationSession().then((session) => {
    if (!session) {
      return;
    }
    const timeline = getInvestigationSessionIocTimeline(session, value);
    if (!timeline) {
      return;
    }

    list.replaceChildren();
    for (const line of buildInvestigationSessionIocTimelineSummaryLines(timeline)) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_IOC_TIMELINE_ITEM_CLASS;
      item.textContent = line;
      list.appendChild(item);
    }
  });

  return section;
}

function createCoOccurrenceSection(
  payload: Pick<HoverCardOverlayPayload, "type" | "value">,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_CO_OCCURRENCE_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_CO_OCCURRENCE_SECTION_ARIA_LABEL);

  const heading = createSectionHeading(HOVER_CARD_CO_OCCURRENCE_LABEL, doc);
  heading.id = "vera5-co-occurrence-heading";
  heading.className = HOVER_CARD_CO_OCCURRENCE_LABEL_CLASS;

  const context = doc.createElement("p");
  context.className = HOVER_CARD_CO_OCCURRENCE_CONTEXT_CLASS;
  context.hidden = true;

  const feedback = doc.createElement("p");
  feedback.className = HOVER_CARD_CO_OCCURRENCE_FEEDBACK_CLASS;
  feedback.hidden = true;
  feedback.setAttribute("aria-live", "polite");

  const list = doc.createElement("ul");
  list.className = HOVER_CARD_CO_OCCURRENCE_LIST_CLASS;
  list.setAttribute("aria-labelledby", heading.id);

  const emptyItem = doc.createElement("li");
  emptyItem.className = HOVER_CARD_CO_OCCURRENCE_ITEM_CLASS;
  emptyItem.textContent = HOVER_CARD_CO_OCCURRENCE_EMPTY_TEXT;
  list.appendChild(emptyItem);

  section.appendChild(heading);
  section.appendChild(context);
  section.appendChild(feedback);
  section.appendChild(list);

  void loadHoverCardCoOccurrencePanelView({
    iocType: payload.type,
    value: payload.value,
    pageUrl: doc.defaultView?.location.href ?? "",
  }).then((view) => {
    list.replaceChildren();
    if (view.contextLabel) {
      context.textContent = view.contextLabel;
      context.hidden = false;
    } else {
      context.hidden = true;
      context.textContent = "";
    }

    if (view.entries.length === 0) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_CO_OCCURRENCE_ITEM_CLASS;
      item.textContent = HOVER_CARD_CO_OCCURRENCE_EMPTY_TEXT;
      list.appendChild(item);
      return;
    }

    for (const display of buildCoOccurrenceEntryDisplaysForView(view)) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_CO_OCCURRENCE_ITEM_CLASS;

      const button = doc.createElement("button");
      button.type = "button";
      button.className = HOVER_CARD_CO_OCCURRENCE_ITEM_BUTTON_CLASS;
      button.textContent = formatCoOccurrenceEntryDisplayLine(display);
      button.setAttribute("aria-label", formatCoOccurrenceEntryNavigateAriaLabel(display));
      if (display.displayValue !== display.fullValue) {
        button.title = display.fullValue;
      }
      const activateNavigation = () => {
        feedback.hidden = true;
        feedback.textContent = "";
        const response = handleNavigateToIocAnchorRequest(
          {
            anchorId: display.anchorId,
            iocType: display.iocType,
            value: display.fullValue,
          },
          doc.body,
          doc
        );
        const navigationFeedback = resolveTrayNavigationFeedback({
          response,
          indicatorValue: display.fullValue,
        });
        if (navigationFeedback) {
          feedback.textContent = navigationFeedback;
          feedback.hidden = false;
        }
      };
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        activateNavigation();
      });
      button.addEventListener("keydown", (event) => {
        if (
          handleCoOccurrenceListItemKeyDown(
            event,
            `.${HOVER_CARD_CO_OCCURRENCE_ITEM_BUTTON_CLASS}`
          )
        ) {
          return;
        }
      });

      item.appendChild(button);
      list.appendChild(item);
    }
  });

  return section;
}

function createRelationshipSection(
  payload: Pick<HoverCardOverlayPayload, "type" | "value">,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_RELATIONSHIP_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL);
  section.dataset.vera5RelationshipLayout = RELATIONSHIP_HOVER_UI_LAYOUT;

  const heading = createSectionHeading(HOVER_CARD_RELATIONSHIP_LABEL, doc);
  heading.id = "vera5-relationship-heading";
  heading.className = HOVER_CARD_RELATIONSHIP_LABEL_CLASS;

  const list = doc.createElement("ul");
  list.className = HOVER_CARD_RELATIONSHIP_LIST_CLASS;
  list.setAttribute("aria-labelledby", heading.id);

  const emptyItem = doc.createElement("li");
  emptyItem.className = HOVER_CARD_RELATIONSHIP_ITEM_CLASS;
  emptyItem.textContent = HOVER_CARD_RELATIONSHIP_EMPTY_TEXT;
  list.appendChild(emptyItem);

  section.appendChild(heading);
  section.appendChild(list);

  void loadHoverCardRelationshipPanelView({
    iocType: payload.type,
    value: payload.value,
  }).then((view) => {
    list.replaceChildren();
    if (view.entries.length === 0) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_RELATIONSHIP_ITEM_CLASS;
      item.textContent = HOVER_CARD_RELATIONSHIP_EMPTY_TEXT;
      list.appendChild(item);
      return;
    }

    for (const display of buildRelationshipEntryDisplaysForView(view)) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_RELATIONSHIP_ITEM_CLASS;
      item.textContent = display.lineText;
      item.setAttribute(
        "aria-label",
        formatRelationshipEntryAccessibleLabel(display)
      );
      if (display.displayValue !== display.fullValue) {
        item.title = display.fullValue;
      }
      list.appendChild(item);
    }
  });

  return section;
}

function resetHoverCardSaveToCollectionState(): void {
  hoverCardSaveToCollectionOpen = false;
  hoverCardSaveToCollectionFeedback = null;
  hoverCardSaveToCollectionNewName = "";
  hoverCardSaveToCollectionOptions = [];
  hoverCardSaveToCollectionLoading = false;
}

function resetHoverCardLocalLlmSummaryState(): void {
  hoverCardLocalLlmSummaryState = { status: "idle" };
}

export function resetHoverCardLocalLlmSummaryStateForTests(): void {
  resetHoverCardLocalLlmSummaryState();
}

export async function runHoverCardLocalLlmSummaryGenerationForTests(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): Promise<void> {
  await runHoverCardLocalLlmSummaryGeneration(payload, doc);
}

export function resetHoverCardSaveToCollectionStateForTests(): void {
  resetHoverCardSaveToCollectionState();
}

async function runHoverCardLocalLlmSummaryGeneration(
  payload: HoverCardOverlayPayload,
  doc: Document
): Promise<void> {
  if (!getCachedLocalLlmSummaryEnabled()) {
    hoverCardLocalLlmSummaryState = {
      status: "error",
      message: "Enable local AI summary in Vera5 Settings.",
    };
    refreshHoverCardIfOpen(doc);
    return;
  }

  if (payload.enrichmentState !== "ready") {
    hoverCardLocalLlmSummaryState = {
      status: "error",
      message: "Complete enrichment before generating a summary.",
    };
    refreshHoverCardIfOpen(doc);
    return;
  }

  hoverCardLocalLlmSummaryState = { status: "loading" };
  refreshHoverCardIfOpen(doc);

  const exportDocument = buildEnrichmentExportDocument(
    buildExportRecordFromPayload(payload)
  );
  const result = await resolveLocalLlmSummaryRequest({
    exportDocument,
    useLocalBackend: getCachedLocalBackendEnabled(),
    endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
  });

  if (!result.ok) {
    hoverCardLocalLlmSummaryState = {
      status: "error",
      message: result.errorMessage,
    };
    refreshHoverCardIfOpen(doc);
    return;
  }

  hoverCardLocalLlmSummaryState = {
    status: "success",
    markdown: result.markdown,
  };
  refreshHoverCardIfOpen(doc);
}

function createLocalLlmSummarySection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  if (!getCachedLocalLlmSummaryEnabled()) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING);

  const heading = createSectionHeading(HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING, doc);
  heading.className = HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING_CLASS;
  heading.id = "vera5-local-llm-summary-heading";
  section.setAttribute("aria-labelledby", heading.id);
  section.appendChild(heading);

  const panel = doc.createElement("div");
  panel.className = HOVER_CARD_LOCAL_LLM_SUMMARY_PANEL_CLASS;
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_ACTION_CLASS;
  button.textContent = HOVER_CARD_GENERATE_SUMMARY_LABEL;
  button.setAttribute("aria-label", HOVER_CARD_GENERATE_SUMMARY_LABEL);
  button.disabled =
    payload.enrichmentState !== "ready" ||
    hoverCardLocalLlmSummaryState.status === "loading";
  button.addEventListener("click", () => {
    void runHoverCardLocalLlmSummaryGeneration(payload, doc);
  });
  panel.appendChild(button);

  if (hoverCardLocalLlmSummaryState.status === "loading") {
    const loading = doc.createElement("p");
    loading.className = `${HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS} vera5-hover-card-local-llm-summary-status--loading`;
    loading.textContent = HOVER_CARD_GENERATE_SUMMARY_LOADING_LABEL;
    loading.setAttribute("role", "status");
    loading.setAttribute("aria-live", "polite");
    loading.setAttribute("aria-busy", "true");
    panel.appendChild(loading);
  }

  if (hoverCardLocalLlmSummaryState.status === "error") {
    const error = doc.createElement("p");
    error.className = `${HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS} vera5-hover-card-local-llm-summary-status--error`;
    error.textContent = hoverCardLocalLlmSummaryState.message;
    error.setAttribute("role", "alert");
    panel.appendChild(error);
  }

  if (hoverCardLocalLlmSummaryState.status === "success") {
    const disclaimer = doc.createElement("p");
    disclaimer.className = HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER_CLASS;
    disclaimer.textContent = HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER;
    panel.appendChild(disclaimer);

    const body = doc.createElement("div");
    body.className = HOVER_CARD_LOCAL_LLM_SUMMARY_BODY_CLASS;
    body.textContent = hoverCardLocalLlmSummaryState.markdown;
    panel.appendChild(body);
  }

  section.appendChild(panel);

  return section;
}

async function openHoverCardSaveToCollectionPicker(doc: Document): Promise<void> {
  hoverCardSaveToCollectionOpen = true;
  hoverCardSaveToCollectionFeedback = null;
  hoverCardSaveToCollectionNewName = "";
  hoverCardSaveToCollectionLoading = true;
  hoverCardSaveToCollectionOptions = [];
  refreshHoverCardIfOpen(doc);
  hoverCardSaveToCollectionOptions = await requestListIocCollections();
  hoverCardSaveToCollectionLoading = false;
  refreshHoverCardIfOpen(doc);
}

function createSaveToCollectionSection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_SAVE_TO_COLLECTION_CLASS;
  section.setAttribute("aria-label", IOC_COLLECTION_PICKER_HEADING);
  section.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  section.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = HOVER_CARD_SAVE_TO_COLLECTION_TOGGLE_CLASS;
  toggle.textContent = IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL;
  toggle.setAttribute("aria-expanded", hoverCardSaveToCollectionOpen ? "true" : "false");
  toggle.addEventListener("click", () => {
    if (hoverCardSaveToCollectionOpen) {
      hoverCardSaveToCollectionOpen = false;
      hoverCardSaveToCollectionFeedback = null;
      refreshHoverCardIfOpen(doc);
      return;
    }
    void openHoverCardSaveToCollectionPicker(doc);
  });
  section.appendChild(toggle);

  if (!hoverCardSaveToCollectionOpen) {
    return section;
  }

  const panel = doc.createElement("div");
  panel.className = HOVER_CARD_SAVE_TO_COLLECTION_PANEL_CLASS;
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", IOC_COLLECTION_PICKER_HEADING);

  const heading = doc.createElement("p");
  heading.className = HOVER_CARD_SAVE_TO_COLLECTION_HEADING_CLASS;
  heading.textContent = IOC_COLLECTION_PICKER_HEADING;
  panel.appendChild(heading);

  if (hoverCardSaveToCollectionLoading) {
    const loading = doc.createElement("p");
    loading.className = "vera5-workspace-empty";
    loading.textContent = "Loading collections…";
    panel.appendChild(loading);
  } else if (hoverCardSaveToCollectionOptions.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "vera5-workspace-empty";
    empty.textContent = IOC_COLLECTION_NO_COLLECTIONS_TEXT;
    panel.appendChild(empty);
  } else {
    const list = doc.createElement("div");
    list.className = HOVER_CARD_SAVE_TO_COLLECTION_LIST_CLASS;
    for (const collection of hoverCardSaveToCollectionOptions) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = HOVER_CARD_ACTION_CLASS;
      button.textContent = collection.name;
      button.addEventListener("click", () => {
        void (async () => {
          const result = await requestAddIocToCollection({
            collectionId: collection.id,
            member: { iocType: payload.type, value: payload.value },
          });
          hoverCardSaveToCollectionFeedback = result
            ? formatSaveToCollectionFeedback({
                collectionName: result.collection.name,
                added: result.added,
              })
            : "Could not save to collection.";
          refreshHoverCardIfOpen(doc);
        })();
      });
      list.appendChild(button);
    }
    panel.appendChild(list);
  }

  const label = doc.createElement("label");
  label.className = HOVER_CARD_SAVE_TO_COLLECTION_FIELD_CLASS;
  label.textContent = IOC_COLLECTION_CREATE_NEW_LABEL;
  const input = doc.createElement("input");
  input.type = "text";
  input.value = hoverCardSaveToCollectionNewName;
  input.placeholder = IOC_COLLECTION_NEW_NAME_PLACEHOLDER;
  input.setAttribute("aria-label", IOC_COLLECTION_NEW_NAME_PLACEHOLDER);
  input.addEventListener("input", () => {
    hoverCardSaveToCollectionNewName = input.value;
    refreshHoverCardIfOpen(doc);
  });
  input.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  label.appendChild(input);
  panel.appendChild(label);

  const createButton = doc.createElement("button");
  createButton.type = "button";
  createButton.className = HOVER_CARD_ACTION_CLASS;
  createButton.textContent = IOC_COLLECTION_SAVE_TO_NEW_LABEL;
  createButton.disabled =
    normalizeIocCollectionName(hoverCardSaveToCollectionNewName) === null;
  createButton.addEventListener("click", () => {
    void (async () => {
      const created = await requestCreateIocCollection({
        name: hoverCardSaveToCollectionNewName,
      });
      if (!created) {
        hoverCardSaveToCollectionFeedback = "Could not create collection.";
        refreshHoverCardIfOpen(doc);
        return;
      }
      const result = await requestAddIocToCollection({
        collectionId: created.id,
        member: { iocType: payload.type, value: payload.value },
      });
      if (!result) {
        hoverCardSaveToCollectionFeedback =
          "Collection created, but indicator was not saved.";
        refreshHoverCardIfOpen(doc);
        return;
      }
      hoverCardSaveToCollectionOptions = [
        result.collection,
        ...hoverCardSaveToCollectionOptions.filter(
          (item) => item.id !== result.collection.id
        ),
      ];
      hoverCardSaveToCollectionNewName = "";
      hoverCardSaveToCollectionFeedback = formatSaveToCollectionFeedback({
        collectionName: result.collection.name,
        added: result.added,
      });
      refreshHoverCardIfOpen(doc);
    })();
  });
  panel.appendChild(createButton);

  if (hoverCardSaveToCollectionFeedback) {
    const feedback = doc.createElement("p");
    feedback.className = HOVER_CARD_SAVE_TO_COLLECTION_FEEDBACK_CLASS;
    feedback.setAttribute("aria-live", "polite");
    feedback.textContent = hoverCardSaveToCollectionFeedback;
    panel.appendChild(feedback);
  }

  section.appendChild(panel);
  return section;
}

function renderNotebookFragmentList(
  list: HTMLElement,
  empty: HTMLElement,
  view: HoverCardNotebookPanelView,
  doc: Document,
  options: {
    editingFragmentId: string | null;
    onEdit: (row: HoverCardNotebookFragmentRow) => void;
    onDelete: (row: HoverCardNotebookFragmentRow) => void;
    onSaveEdit: (
      row: HoverCardNotebookFragmentRow,
      type: string,
      body: string
    ) => void;
    onCancelEdit: () => void;
  }
): void {
  list.replaceChildren();
  if (view.fragments.length === 0) {
    empty.textContent = view.emptyText;
    empty.hidden = false;
    empty.setAttribute("role", "status");
    empty.dataset.vera5NotebookEmpty = "true";
    list.hidden = true;
    return;
  }

  empty.hidden = true;
  empty.textContent = "";
  empty.removeAttribute("role");
  delete empty.dataset.vera5NotebookEmpty;
  list.hidden = false;

  for (const row of view.fragments) {
    const item = doc.createElement("li");
    item.className = HOVER_CARD_NOTEBOOK_ITEM_CLASS;
    item.dataset.vera5NotebookFragmentId = row.fragmentId;
    item.dataset.vera5NotebookFragmentType = row.type;

    if (options.editingFragmentId === row.fragmentId) {
      const editForm = doc.createElement("div");
      editForm.className = HOVER_CARD_NOTEBOOK_FORM_CLASS;
      editForm.setAttribute("role", "group");
      editForm.setAttribute("aria-label", NOTEBOOK_FRAGMENT_EDIT_FORM_ARIA_LABEL);

      const typeLabel = doc.createElement("label");
      typeLabel.textContent = NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL;
      const typeSelect = doc.createElement("select");
      typeSelect.className = HOVER_CARD_NOTEBOOK_SELECT_CLASS;
      typeSelect.setAttribute("aria-label", NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL);
      for (const option of listNotebookFragmentTypeOptions()) {
        const opt = doc.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (option.value === row.type) {
          opt.selected = true;
        }
        typeSelect.appendChild(opt);
      }
      typeLabel.appendChild(typeSelect);
      editForm.appendChild(typeLabel);

      const bodyLabel = doc.createElement("label");
      bodyLabel.textContent = NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL;
      const bodyInput = doc.createElement("textarea");
      bodyInput.className = HOVER_CARD_NOTEBOOK_TEXTAREA_CLASS;
      bodyInput.rows = 3;
      bodyInput.value = row.fullBody;
      bodyInput.setAttribute("aria-label", NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL);
      bodyLabel.appendChild(bodyInput);
      editForm.appendChild(bodyLabel);

      const actions = doc.createElement("div");
      actions.className = HOVER_CARD_NOTEBOOK_ACTIONS_CLASS;
      const saveBtn = doc.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS;
      saveBtn.textContent = NOTEBOOK_FRAGMENT_SAVE_LABEL;
      saveBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        options.onSaveEdit(row, typeSelect.value, bodyInput.value);
      });
      const cancelBtn = doc.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS;
      cancelBtn.textContent = NOTEBOOK_FRAGMENT_CANCEL_LABEL;
      cancelBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        options.onCancelEdit();
      });
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      editForm.appendChild(actions);

      for (const control of [typeSelect, bodyInput, saveBtn, cancelBtn]) {
        control.addEventListener("mousedown", (event) => {
          event.stopPropagation();
        });
      }

      item.appendChild(editForm);
      list.appendChild(item);
      continue;
    }

    const meta = doc.createElement("div");
    meta.className = HOVER_CARD_NOTEBOOK_ITEM_TYPE_CLASS;
    meta.textContent = row.typeLabel;
    item.appendChild(meta);

    if (row.showStatusBadge && row.statusBadgeLabel) {
      const badge = doc.createElement("span");
      badge.className = HOVER_CARD_NOTEBOOK_ITEM_BADGE_CLASS;
      badge.textContent = row.statusBadgeLabel;
      item.appendChild(badge);
    }

    const body = doc.createElement("div");
    body.className = HOVER_CARD_NOTEBOOK_ITEM_BODY_CLASS;
    appendNotebookFragmentMarkdownLite(body, row.fullBody, doc);
    body.title = row.fullBody;
    item.appendChild(body);

    const actions = doc.createElement("div");
    actions.className = HOVER_CARD_NOTEBOOK_ACTIONS_CLASS;
    const editBtn = doc.createElement("button");
    editBtn.type = "button";
    editBtn.className = HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS;
    editBtn.textContent = NOTEBOOK_FRAGMENT_EDIT_LABEL;
    editBtn.setAttribute(
      "aria-label",
      `${NOTEBOOK_FRAGMENT_EDIT_LABEL} ${row.typeLabel}`
    );
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      options.onEdit(row);
    });
    const deleteBtn = doc.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS;
    deleteBtn.textContent = NOTEBOOK_FRAGMENT_DELETE_LABEL;
    deleteBtn.setAttribute(
      "aria-label",
      `${NOTEBOOK_FRAGMENT_DELETE_LABEL} ${row.typeLabel}`
    );
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      options.onDelete(row);
    });
    for (const control of [editBtn, deleteBtn]) {
      control.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
    }
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);

    list.appendChild(item);
  }
}

function createNotebookSection(
  payload: Pick<HoverCardOverlayPayload, "type" | "value">,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_NOTEBOOK_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_NOTEBOOK_SECTION_ARIA_LABEL);

  const heading = createSectionHeading(HOVER_CARD_NOTEBOOK_LABEL, doc);
  heading.id = "vera5-notebook-heading";
  heading.className = HOVER_CARD_NOTEBOOK_LABEL_CLASS;

  const tabs = doc.createElement("div");
  tabs.className = HOVER_CARD_NOTEBOOK_TABS_CLASS;
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Notebook scope");

  const empty = doc.createElement("p");
  empty.className = HOVER_CARD_NOTEBOOK_EMPTY_CLASS;
  empty.setAttribute("aria-live", "polite");

  const list = doc.createElement("ul");
  list.className = HOVER_CARD_NOTEBOOK_LIST_CLASS;
  list.setAttribute("aria-labelledby", heading.id);

  const feedback = doc.createElement("p");
  feedback.className = HOVER_CARD_NOTEBOOK_FEEDBACK_CLASS;
  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;

  const addForm = doc.createElement("div");
  addForm.className = HOVER_CARD_NOTEBOOK_FORM_CLASS;
  addForm.setAttribute("role", "group");
  addForm.setAttribute("aria-label", NOTEBOOK_FRAGMENT_ADD_FORM_ARIA_LABEL);

  const typeLabel = doc.createElement("label");
  typeLabel.textContent = NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL;
  const typeSelect = doc.createElement("select");
  typeSelect.className = HOVER_CARD_NOTEBOOK_SELECT_CLASS;
  typeSelect.setAttribute("aria-label", NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL);
  const defaultType = defaultNotebookFragmentType();
  for (const option of listNotebookFragmentTypeOptions()) {
    const opt = doc.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === defaultType) {
      opt.selected = true;
    }
    typeSelect.appendChild(opt);
  }
  typeLabel.appendChild(typeSelect);
  addForm.appendChild(typeLabel);

  const bodyLabel = doc.createElement("label");
  bodyLabel.textContent = NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL;
  const bodyInput = doc.createElement("textarea");
  bodyInput.className = HOVER_CARD_NOTEBOOK_TEXTAREA_CLASS;
  bodyInput.rows = 3;
  bodyInput.placeholder = NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER;
  bodyInput.setAttribute("aria-label", NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL);
  bodyLabel.appendChild(bodyInput);
  addForm.appendChild(bodyLabel);

  const addButton = doc.createElement("button");
  addButton.type = "button";
  addButton.className = HOVER_CARD_NOTEBOOK_ACTION_BUTTON_CLASS;
  addButton.textContent = NOTEBOOK_FRAGMENT_ADD_LABEL;
  addForm.appendChild(addButton);

  for (const control of [typeSelect, bodyInput, addButton]) {
    control.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
  }

  const tabButtons = new Map<NotebookHoverTab, HTMLButtonElement>();
  let activeTab: NotebookHoverTab = "ioc";
  let latestView: HoverCardNotebookPanelView | null = null;
  let editingFragmentId: string | null = null;

  const setFeedback = (message: string | null): void => {
    if (!message) {
      feedback.hidden = true;
      feedback.textContent = "";
      return;
    }
    feedback.hidden = false;
    feedback.textContent = message;
  };

  const syncAuthoringAvailability = (view: HoverCardNotebookPanelView): void => {
    const gate = canAuthorNotebookFragmentsForScope({
      scope: view.activeTab,
      sessionId: view.sessionId,
      pageScopeKey: view.pageScopeKey,
    });
    typeSelect.disabled = !gate.allowed;
    bodyInput.disabled = !gate.allowed;
    addButton.disabled = !gate.allowed;
    if (!gate.allowed) {
      bodyInput.placeholder = gate.reason;
    } else {
      bodyInput.placeholder = NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER;
    }
  };

  const syncTabButtons = (view: HoverCardNotebookPanelView): void => {
    for (const tab of NOTEBOOK_HOVER_TABS) {
      const button = tabButtons.get(tab);
      if (!button) {
        continue;
      }
      const count =
        tab === "ioc"
          ? view.iocCount
          : tab === "session"
            ? view.sessionCount
            : view.pageCount;
      button.textContent = formatNotebookTabLabel(tab, count);
      const isActive = tab === view.activeTab;
      button.classList.toggle(HOVER_CARD_NOTEBOOK_TAB_ACTIVE_CLASS, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.tabIndex = isActive ? 0 : -1;
    }
  };

  const renderList = (view: HoverCardNotebookPanelView): void => {
    renderNotebookFragmentList(list, empty, view, doc, {
      editingFragmentId,
      onEdit: (row) => {
        editingFragmentId = row.fragmentId;
        setFeedback(null);
        if (latestView) {
          renderList(latestView);
        }
      },
      onCancelEdit: () => {
        editingFragmentId = null;
        if (latestView) {
          renderList(latestView);
        }
      },
      onSaveEdit: (row, type, body) => {
        void (async () => {
          const result = await editNotebookFragment({
            fragmentId: row.fragmentId,
            type,
            body,
          });
          if (!result.ok) {
            setFeedback(result.error);
            return;
          }
          editingFragmentId = null;
          setFeedback(NOTEBOOK_FRAGMENT_SAVED_FEEDBACK);
          await refresh(activeTab);
        })();
      },
      onDelete: (row) => {
        const confirmed =
          typeof doc.defaultView?.confirm === "function"
            ? doc.defaultView.confirm(NOTEBOOK_FRAGMENT_DELETE_CONFIRM_TEXT)
            : true;
        if (!confirmed) {
          return;
        }
        void (async () => {
          const result = await deleteNotebookFragment(row.fragmentId);
          if (!result.ok) {
            setFeedback(result.error);
            return;
          }
          if (editingFragmentId === row.fragmentId) {
            editingFragmentId = null;
          }
          setFeedback(NOTEBOOK_FRAGMENT_DELETED_FEEDBACK);
          await refresh(activeTab);
        })();
      },
    });
  };

  const refresh = async (nextTab: NotebookHoverTab): Promise<void> => {
    activeTab = nextTab;
    const view = await loadHoverCardNotebookPanelView({
      iocType: payload.type,
      value: payload.value,
      pageUrl: doc.defaultView?.location.href ?? "",
      activeTab: nextTab,
    });
    latestView = view;
    syncTabButtons(view);
    syncAuthoringAvailability(view);
    renderList(view);
  };

  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    void (async () => {
      const result = await addNotebookFragmentForScope({
        scope: activeTab,
        type: typeSelect.value,
        body: bodyInput.value,
        iocType: payload.type,
        value: payload.value,
        sessionId: latestView?.sessionId ?? null,
        pageUrl: doc.defaultView?.location.href ?? "",
      });
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }
      bodyInput.value = "";
      typeSelect.value = defaultNotebookFragmentType();
      setFeedback(NOTEBOOK_FRAGMENT_SAVED_FEEDBACK);
      await refresh(activeTab);
    })();
  });

  for (const tab of NOTEBOOK_HOVER_TABS) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = HOVER_CARD_NOTEBOOK_TAB_CLASS;
    button.setAttribute("role", "tab");
    button.dataset.vera5NotebookTab = tab;
    button.textContent = formatNotebookTabLabel(tab, 0);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      editingFragmentId = null;
      setFeedback(null);
      void refresh(tab);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const index = NOTEBOOK_HOVER_TABS.indexOf(tab);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next =
        NOTEBOOK_HOVER_TABS[
          (index + delta + NOTEBOOK_HOVER_TABS.length) % NOTEBOOK_HOVER_TABS.length
        ]!;
      tabButtons.get(next)?.focus();
      editingFragmentId = null;
      setFeedback(null);
      void refresh(next);
    });
    tabButtons.set(tab, button);
    tabs.appendChild(button);
  }

  section.appendChild(heading);
  section.appendChild(tabs);
  section.appendChild(empty);
  section.appendChild(list);
  section.appendChild(addForm);
  section.appendChild(feedback);

  void refresh(activeTab).then(() => {
    if (latestView) {
      syncTabButtons(latestView);
      syncAuthoringAvailability(latestView);
    }
  });

  return section;
}

function createAnalystNotesSection(
  value: string,
  initialNote: string,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = HOVER_CARD_ANALYST_NOTES_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL);

  const heading = createSectionHeading(HOVER_CARD_ANALYST_NOTES_LABEL, doc);
  heading.id = "vera5-analyst-notes-heading";

  const textarea = doc.createElement("textarea");
  textarea.id = HOVER_CARD_ANALYST_NOTES_INPUT_ID;
  textarea.className = HOVER_CARD_ANALYST_NOTES_INPUT_CLASS;
  textarea.placeholder = HOVER_CARD_ANALYST_NOTES_PLACEHOLDER;
  textarea.rows = 3;
  textarea.value = initialNote;
  textarea.setAttribute("aria-labelledby", heading.id);

  textarea.addEventListener("input", () => {
    setSessionAnalystNote(value, textarea.value);
  });
  textarea.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });

  primeAnalystNoteForIoc(value, (note) => {
    if (textarea.value.length === 0 && note.length > 0) {
      textarea.value = note;
    }
  });

  section.appendChild(heading);
  section.appendChild(textarea);
  return section;
}

export function ensureHoverCardHost(doc: Document = document): HTMLElement {
  const existing = doc.getElementById(HOVER_CARD_HOST_ID);
  if (existing) {
    return existing;
  }

  const host = doc.createElement("div");
  host.id = HOVER_CARD_HOST_ID;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "none";
  doc.body.appendChild(host);
  return host;
}

export type BuildHoverCardPanelOptions = {
  detailClear?: {
    onClear: () => void;
  };
};

function createDetailClearButton(
  detailClear: NonNullable<BuildHoverCardPanelOptions["detailClear"]>,
  doc: Document
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "vera5-hover-card-detail-clear";
  button.textContent = "↻";
  button.setAttribute("aria-label", "Clear indicator details");
  button.addEventListener("click", detailClear.onClear);
  return button;
}

export function createIndicatorValueSection(
  payload: Pick<HoverCardOverlayPayload, "value" | "displayValue">,
  doc: Document
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const presentation = resolveIndicatorValuePresentation(payload);

  if (!presentation.showRefangedPair) {
    const valueRow = doc.createElement("p");
    valueRow.className = "vera5-hover-card-value";
    valueRow.textContent = presentation.refangedValue;
    fragment.appendChild(valueRow);
    return fragment;
  }

  const onPageRow = doc.createElement("p");
  onPageRow.className = "vera5-hover-card-value-on-page";
  onPageRow.textContent = `${HOVER_CARD_ON_PAGE_VALUE_LABEL} ${presentation.onPageValue}`;
  fragment.appendChild(onPageRow);

  const refangedRow = doc.createElement("p");
  refangedRow.className = "vera5-hover-card-refanged-value";
  refangedRow.textContent = `${HOVER_CARD_REFANGED_VALUE_LABEL} ${presentation.refangedValue}`;
  fragment.appendChild(refangedRow);

  return fragment;
}

export function createWhyDetectedSection(
  view: WhyDetectedView,
  doc: Document,
  options: { compact?: boolean; omitHeading?: boolean } = {}
): HTMLElement {
  const section = doc.createElement("section");
  section.className = options.compact
    ? `${HOVER_CARD_WHY_DETECTED_CLASS} ${TRAY_WHY_DETECTED_CLASS}`
    : HOVER_CARD_WHY_DETECTED_CLASS;
  section.setAttribute("aria-label", HOVER_CARD_WHY_DETECTED_SECTION_ARIA_LABEL);

  if (!options.omitHeading) {
    section.appendChild(createSectionHeading(HOVER_CARD_WHY_DETECTED_HEADING, doc));
  }

  const typeRow = doc.createElement("p");
  typeRow.className = "vera5-why-detected-row";
  typeRow.textContent = `Type: ${view.typeLabel}`;
  section.appendChild(typeRow);

  const reasonRow = doc.createElement("p");
  reasonRow.className = "vera5-why-detected-row";
  reasonRow.textContent = `Reason: ${view.reason}`;
  section.appendChild(reasonRow);

  const contextRow = doc.createElement("p");
  contextRow.className = "vera5-why-detected-row vera5-why-detected-context";
  contextRow.textContent = `Source context: ${view.sourceTextHint}`;
  section.appendChild(contextRow);

  if (view.ignoredOverlaps.length > 0) {
    const overlapsHeading = doc.createElement("p");
    overlapsHeading.className = "vera5-why-detected-overlaps-heading";
    overlapsHeading.textContent = "Ignored overlaps:";
    section.appendChild(overlapsHeading);

    const list = doc.createElement("ul");
    list.className = HOVER_CARD_WHY_DETECTED_LIST_CLASS;
    for (const overlap of view.ignoredOverlaps) {
      const item = doc.createElement("li");
      item.className = HOVER_CARD_WHY_DETECTED_ITEM_CLASS;
      item.textContent = `${overlap.typeLabel} ${overlap.value} — ${overlap.reason}`;
      list.appendChild(item);
    }
    section.appendChild(list);
  } else {
    const noneRow = doc.createElement("p");
    noneRow.className = "vera5-why-detected-row";
    noneRow.textContent = "Ignored overlaps: none";
    section.appendChild(noneRow);
  }

  return section;
}

export function buildHoverCardPanel(
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  options: BuildHoverCardPanelOptions = {}
): HTMLElement {
  ensureVera5UiStyles(doc);

  const displayContext = getCachedAnalystModeDisplayContext();
  const pivotRecipes = getPivotRecipes(payload.type, payload.value, {
    emphasisProviders: displayContext.pivotEmphasisProviders,
  });
  const sourceResults = payload.sourceResults ?? [];
  const view = resolveHoverCardDisplayView({
    enrichmentState: payload.enrichmentState,
    summary: payload.summary,
    tags: payload.tags,
    sourceAttribution: payload.sourceAttribution,
    errorMessage: payload.errorMessage,
    errorCode: payload.errorCode,
    retryHint: payload.retryHint,
    disabledSources: payload.disabledSources,
    sourceResults,
    pivotLinkCount: pivotRecipes.length,
  });
  const enrichment = view.enrichment;
  const sourceResultsSection = view.showMultiSourceResults
    ? createSourceResultsSection(sourceResults, doc)
    : null;
  const singleSourceRawJson =
    view.showSingleSourceRawJson && view.singleSourceRawJson?.trim()
      ? createRawVendorJsonDetails(view.singleSourceRawJson, doc)
      : null;
  const disabledSourcesSection = createDisabledSourcesSection(
    view.disabledSourcePlaceholders,
    doc
  );
  const pivotRecipesPanel = createPivotRecipesPanel(payload, doc);
  const enrichmentTagsSection = view.showTags
    ? createEnrichmentTagsSection(view.enrichmentTags, doc)
    : null;
  const effectiveSourceAttribution = resolveEffectiveSourceAttribution(
    payload.sourceAttribution,
    sourceResults
  );
  const disclaimerInput: HoverCardDisclaimerInput = {
    enrichmentState: enrichment.variant,
    includeRiskScoreDisclaimer: view.includeRiskScoreDisclaimer,
  };
  const attributionFooter =
    view.showAttribution && effectiveSourceAttribution
      ? createSourceAttributionFooter(
          effectiveSourceAttribution,
          enrichment.variant,
          doc
        )
      : null;
  const disclaimerFooter = view.showDisclaimer
    ? createHoverCardDisclaimerFooter(
        view.disclaimerLines,
        disclaimerInput,
        doc
      )
    : null;
  const missingKeyAction = view.showMissingKeyAction
    ? createMissingKeyAction(doc)
    : null;
  const rateLimitRetryHint =
    view.showRateLimitRetryHint && payload.retryHint
      ? createRateLimitRetryHint(payload.retryHint, doc)
      : null;
  const singleSourceLastUpdated = view.singleSourceLastUpdatedLine
    ? createSingleSourceLastUpdated(view.singleSourceLastUpdatedLine, doc)
    : null;
  const showBelowSummary = view.showBelowSummary;
  const showFooter = view.showFooter;
  const riskScoreSection = view.showRiskScore
    ? createRiskScoreSection(payload, doc)
    : null;
  const analystNotesSection = createAnalystNotesSection(
    payload.value,
    resolveHoverCardAnalystNote(payload.value, payload.analystNotes),
    doc
  );
  const iocLabelSection = createIocLabelSection(
    payload.value,
    resolveHoverCardIocLabel(payload.value, payload.iocLabel),
    doc
  );
  const iocTimelineSection = createIocTimelineSection(payload.value, doc);
  const coOccurrenceSection = createCoOccurrenceSection(payload, doc);
  const relationshipSection = createRelationshipSection(payload, doc);
  const notebookSection = createNotebookSection(payload, doc);
  const saveToCollectionSection = createSaveToCollectionSection(payload, doc);
  const exportSection = createExportSection(payload, doc);
  const localLlmSummarySection = createLocalLlmSummarySection(payload, doc);
  const whyDetectedView = buildWhyDetectedView({
    type: payload.type,
    ruleId: payload.ruleId,
    sourceTextHint: payload.sourceTextHint,
    ignoredOverlaps: payload.ignoredOverlaps,
  });
  const whyDetectedSection = whyDetectedView
    ? createWhyDetectedSection(whyDetectedView, doc)
    : null;
  const preQueryDisclosureSection = createPreQueryDisclosureSection(payload, doc);

  const panel = doc.createElement("aside");
  panel.className = HOVER_CARD_PANEL_CLASS;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `Indicator details for ${payload.value}`);
  if (payload.ruleId) {
    panel.dataset.vera5RuleId = payload.ruleId;
  }
  if (payload.sourceTextHint) {
    panel.dataset.vera5SourceTextHint = payload.sourceTextHint;
  }

  const headerRow = doc.createElement("div");
  headerRow.className = "vera5-hover-card-header";

  const typeRow = doc.createElement("span");
  typeRow.className = "vera5-hover-card-type";
  typeRow.textContent = formatTypeLabel(payload.type);
  headerRow.appendChild(typeRow);

  const headerActions = doc.createElement("div");
  headerActions.className = "vera5-hover-card-header-actions";
  headerActions.appendChild(createIocPinButton(payload, doc));
  headerActions.appendChild(createIndicatorCopyActions(payload, doc));
  if (options.detailClear) {
    headerActions.appendChild(createDetailClearButton(options.detailClear, doc));
  }
  headerRow.appendChild(headerActions);
  panel.appendChild(headerRow);

  const knownGoodMatchSection = createKnownGoodMatchSection(payload.value, doc, {
    insertBadgeAfter: typeRow,
    enrichSkippedByPolicy:
      payload.errorCode === ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY ||
      (payload.sourceResults ?? []).some(
        (entry) => entry.errorCode === ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY
      ),
  });
  knownGoodMatchSection.style.marginBottom = "8px";
  panel.appendChild(knownGoodMatchSection);

  const noiseRuleMatchSection = createNoiseRuleDeprioritizedSection(payload.value, doc, {
    insertBadgeAfter: typeRow,
  });
  noiseRuleMatchSection.style.marginBottom = "8px";
  panel.appendChild(noiseRuleMatchSection);

  panel.appendChild(createIndicatorValueSection(payload, doc));

  if (shouldOfferLiveUrlOpen(payload.type)) {
    const openLiveUrlButton = createOpenLiveUrlButton(payload.value, doc);
    openLiveUrlButton.style.marginBottom = "8px";
    panel.appendChild(openLiveUrlButton);
  }

  if (whyDetectedSection) {
    whyDetectedSection.style.marginBottom = "8px";
    panel.appendChild(whyDetectedSection);
  }

  if (preQueryDisclosureSection) {
    preQueryDisclosureSection.style.marginBottom = "8px";
    panel.appendChild(preQueryDisclosureSection);
  }

  const intelSection = doc.createElement("section");
  intelSection.className = HOVER_CARD_INTEL_SUMMARY_CLASS;
  intelSection.setAttribute("aria-label", "Threat intelligence summary");
  intelSection.appendChild(createSectionHeading("Intel Summary", doc));

  const summaryRow = doc.createElement("p");
  summaryRow.className = buildEnrichmentSummaryClassName(
    enrichment.variant,
    HOVER_CARD_ENRICHMENT_CLASS
  );
  if (showBelowSummary) {
    summaryRow.style.marginBottom = "8px";
  }
  summaryRow.textContent = enrichment.text;
  if (enrichment.variant === "error") {
    summaryRow.setAttribute("role", "alert");
  } else {
    summaryRow.setAttribute("role", "status");
  }
  if (enrichment.variant === "loading") {
    summaryRow.setAttribute("aria-live", "polite");
    summaryRow.setAttribute("aria-busy", "true");
  }
  intelSection.appendChild(summaryRow);

  if (riskScoreSection) {
    riskScoreSection.style.marginBottom = showBelowSummary ? "8px" : "0";
    intelSection.appendChild(riskScoreSection);
  }

  if (missingKeyAction) {
    missingKeyAction.style.marginBottom = showBelowSummary ? "8px" : "0";
    intelSection.appendChild(missingKeyAction);
  }

  if (rateLimitRetryHint) {
    rateLimitRetryHint.style.marginBottom = showBelowSummary ? "8px" : "0";
    intelSection.appendChild(rateLimitRetryHint);
  }

  panel.appendChild(intelSection);

  if (localLlmSummarySection) {
    localLlmSummarySection.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(localLlmSummarySection);
  }

  if (singleSourceRawJson) {
    singleSourceRawJson.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(singleSourceRawJson);
  }

  if (singleSourceLastUpdated) {
    singleSourceLastUpdated.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(singleSourceLastUpdated);
  }

  if (enrichmentTagsSection) {
    enrichmentTagsSection.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(enrichmentTagsSection);
  }

  if (sourceResultsSection) {
    sourceResultsSection.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(sourceResultsSection);
  }
  if (disabledSourcesSection) {
    panel.appendChild(disabledSourcesSection);
  }
  if (pivotRecipesPanel) {
    panel.appendChild(pivotRecipesPanel);
  }
  iocLabelSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(iocLabelSection);
  coOccurrenceSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(coOccurrenceSection);
  relationshipSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(relationshipSection);
  notebookSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(notebookSection);
  iocTimelineSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(iocTimelineSection);
  saveToCollectionSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(saveToCollectionSection);
  analystNotesSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(analystNotesSection);
  exportSection.style.marginBottom = showFooter ? "8px" : "0";
  panel.appendChild(exportSection);
  if (attributionFooter) {
    panel.appendChild(attributionFooter);
  }
  if (disclaimerFooter) {
    panel.appendChild(disclaimerFooter);
  }

  return panel;
}

export function positionHoverCardPanel(
  panel: HTMLElement,
  anchor: Element,
  viewport: HoverCardViewport = readViewportSize()
): AxisPoint {
  const anchorRect = anchor.getBoundingClientRect();
  panel.style.visibility = "hidden";
  panel.style.display = "block";

  const measured = panel.getBoundingClientRect();
  const cardSize = {
    width: Math.max(measured.width, panel.offsetWidth, 220),
    height: Math.max(measured.height, panel.offsetHeight, 80),
  };

  const position = computeHoverCardPosition(anchorRect, cardSize, viewport);
  applyHoverCardFixedPosition(panel, position);
  panel.style.visibility = "visible";
  return position;
}

export function showHoverCardNearAnchor(
  anchor: Element,
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  options: ShowHoverCardFocusOptions = {}
): HTMLElement {
  if (lastHoverCardPayload && lastHoverCardPayload.value !== payload.value) {
    resetHoverCardSaveToCollectionState();
    resetHoverCardLocalLlmSummaryState();
  }
  lastHoverCardAnchor = anchor;
  const host = ensureHoverCardHost(doc);
  host.replaceChildren();
  const analystNotes = resolveHoverCardAnalystNote(
    payload.value,
    payload.analystNotes
  );
  const resolvedPayload = {
    ...payload,
    analystNotes: analystNotes.length > 0 ? analystNotes : undefined,
  };
  lastHoverCardPayload = resolvedPayload;
  const panel = buildHoverCardPanel(resolvedPayload, doc);
  host.appendChild(panel);
  positionHoverCardPanel(panel, anchor, readViewportSize(doc.defaultView ?? window));
  if (options.moveFocus) {
    focusFirstHoverCardControl(panel);
  }
  return panel;
}

export function showHoverCardNearRange(
  range: Range,
  payload: HoverCardOverlayPayload,
  doc: Document = document,
  options: ShowHoverCardFocusOptions = {}
): HTMLElement {
  let anchor: Element = doc.body;
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (node instanceof Element) {
    anchor = node;
  }
  if (lastHoverCardPayload && lastHoverCardPayload.value !== payload.value) {
    resetHoverCardSaveToCollectionState();
    resetHoverCardLocalLlmSummaryState();
  }
  lastHoverCardAnchor = anchor;
  const host = ensureHoverCardHost(doc);
  host.replaceChildren();
  const analystNotes = resolveHoverCardAnalystNote(
    payload.value,
    payload.analystNotes
  );
  const resolvedPayload = {
    ...payload,
    analystNotes: analystNotes.length > 0 ? analystNotes : undefined,
  };
  lastHoverCardPayload = resolvedPayload;
  const panel = buildHoverCardPanel(resolvedPayload, doc);
  host.appendChild(panel);

  const anchorRect = range.getBoundingClientRect();
  panel.style.visibility = "hidden";
  panel.style.display = "block";
  const measured = panel.getBoundingClientRect();
  const cardSize = {
    width: Math.max(measured.width, panel.offsetWidth, 220),
    height: Math.max(measured.height, panel.offsetHeight, 80),
  };
  const position = computeHoverCardPosition(
    anchorRect,
    cardSize,
    readViewportSize(doc.defaultView ?? window)
  );
  applyHoverCardFixedPosition(panel, position);
  panel.style.visibility = "visible";
  if (options.moveFocus) {
    focusFirstHoverCardControl(panel);
  }
  return panel;
}

export function updateHoverCardAnalystNoteIfOpen(
  iocKey: string,
  note: string,
  doc: Document = document
): void {
  if (!lastHoverCardPayload) {
    return;
  }
  if (
    normalizeIocNoteKey(lastHoverCardPayload.value) !== normalizeIocNoteKey(iocKey)
  ) {
    return;
  }

  const textarea = doc.getElementById(
    HOVER_CARD_ANALYST_NOTES_INPUT_ID
  ) as HTMLTextAreaElement | null;
  if (!textarea || textarea.value === note) {
    return;
  }

  const hadFocus = doc.activeElement === textarea;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  textarea.value = note;
  lastHoverCardPayload = {
    ...lastHoverCardPayload,
    analystNotes: note.length > 0 ? note : undefined,
  };

  if (hadFocus) {
    textarea.focus();
    const cursor = Math.min(selectionStart, note.length);
    textarea.setSelectionRange(cursor, Math.min(selectionEnd, note.length));
  }
}

export function updateHoverCardIocLabelIfOpen(
  iocKey: string,
  label: IocLabelId | null,
  doc: Document = document
): void {
  if (!lastHoverCardPayload) {
    return;
  }
  if (
    normalizeIocNoteKey(lastHoverCardPayload.value) !== normalizeIocNoteKey(iocKey)
  ) {
    return;
  }

  const select = doc.getElementById(
    HOVER_CARD_IOC_LABEL_SELECT_ID
  ) as HTMLSelectElement | null;
  const nextValue = label ?? HOVER_CARD_IOC_LABEL_NONE_VALUE;
  if (!select || select.value === nextValue) {
    return;
  }

  const hadFocus = doc.activeElement === select;
  select.value = nextValue;
  lastHoverCardPayload = {
    ...lastHoverCardPayload,
    iocLabel: label ?? undefined,
  };

  if (hadFocus) {
    select.focus();
  }
}

export function refreshHoverCardIfOpen(doc: Document = document): void {
  if (!lastHoverCardAnchor || !lastHoverCardPayload) {
    return;
  }
  showHoverCardNearAnchor(lastHoverCardAnchor, lastHoverCardPayload, doc);
}

export function hideHoverCard(doc: Document = document): void {
  cancelPreQueryDisclosure();
  resetHoverCardSaveToCollectionState();
  resetHoverCardLocalLlmSummaryState();
  const host = doc.getElementById(HOVER_CARD_HOST_ID);
  if (!host) {
    return;
  }
  host.replaceChildren();
  lastHoverCardAnchor = null;
  lastHoverCardPayload = null;
  restoreHoverCardFocusReturn(doc);
}
