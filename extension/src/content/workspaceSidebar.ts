import {
  isExtensionContextInvalidated,
  logUnlessBenignExtensionError,
  rethrowUnlessStaleExtensionError,
  safeRuntimeSendMessage,
} from "../lib/extensionContext";
import { openOptionsPageMessage } from "../lib/messages";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";
import { isTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import { requestTabScanSummary } from "../lib/tabScanSummaryClient";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  setExtensionEnabled,
  setHighlightEnabled,
} from "../lib/storage";
import {
  buildTabScanCountSummaryText,
  buildTabScanSummary,
  buildTrayRowNavigationAriaLabel,
  filterTabScanSummaryEntries,
  formatTrayRowEnrichmentHint,
  IOC_TYPE_TRAY_LABEL,
  listIocTypesPresentInSummary,
  loadTrayEntryEnrichmentStatuses,
  resolveTrayEntryMatchProvenance,
  type IocTypeFilter,
  type TabScanSummary,
  type TrayEntryEnrichmentStatus,
} from "../lib/tabScanSummary";
import {
  buildWhyDetectedView,
  HOVER_CARD_REFANGED_VALUE_LABEL,
  HOVER_CARD_WHY_DETECTED_HEADING,
  resolveIndicatorValuePresentation,
} from "../lib/hoverCardEnrichment";
import {
  getTabScanTrayFilter,
  saveTabScanTrayFilter,
} from "../lib/tabScanSnapshotStorage";
import { normalizeIocNoteKey } from "../lib/analystNotesStorage";
import { resolveWorkspaceTrayView } from "../lib/workspaceTrayState";
import { HOVER_CARD_ANALYST_NOTES_INPUT_ID } from "../lib/hoverCardEnrichment";
import { ensureVera5UiStyles } from "../lib/vera5UiStyles";
import {
  buildTrayEnrichQueueWarningMessage,
  estimateTrayEnrichQueueImpact,
} from "../lib/trayEnrichQueueWarning";
import { attemptAutoEnrichmentFetch } from "./enrichmentAutoFetch";
import {
  cancelPendingHoverEnrichment,
  DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
  resolvePageEnrichmentTrustGate,
  runBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import {
  getEnrichmentSourceEnabledForContent,
  loadWorkspaceEnrichmentSourceContext,
} from "./enrichmentSourceStorage";
import {
  buildHoverCardPayloadFromHighlight,
  type HoverCardOpenOptions,
} from "./hoverCardTrigger";
import {
  buildHoverCardPanel,
  createWhyDetectedSection,
  setScanListExportContextProvider,
  TRAY_WHY_DETECTED_CLASS,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import {
  handleScanPageRequest,
  handleScanSelectionRequest,
  resolveActiveSelectionRange,
} from "./scanPage";
import { handleEnrichSelectionRequest, resolveIocFromActiveSelection } from "./enrichSelection";
import { getTabScanSummaryForCurrentTab } from "./tabScanSummaryContent";
import {
  cancelTrayEnrichQueue,
  getTrayEnrichQueueSnapshot,
  isTrayEnrichQueueRunning,
  resetTrayEnrichQueueForTests,
  runSequentialTrayEnrichQueue,
} from "./trayEnrichQueue";
import { CONTENT_MESSAGE } from "./constants";
import {
  clearWorkspaceSelectionState,
  registerWorkspacePayloadUpdateHandler,
  setWorkspaceSelectionState,
} from "./workspaceSelectionState";

export const WORKSPACE_HOST_ID = "vera5-workspace-host";
export const WORKSPACE_WIDTH_PX = 380;
export const WORKSPACE_COLLAPSED_WIDTH_PX = 44;
export const WORKSPACE_HOST_GUTTER_PX = 8;
export const WORKSPACE_HTML_CLASS = "vera5-workspace-open";
export const VERA5_WEBSITE_URL = "https://www.vera5.io/";

const WORKSPACE_EMPTY_SCAN_MESSAGE =
  "Run a scan to detect indicators on this page.";
const WORKSPACE_EMPTY_DETAIL_MESSAGE = "Select an indicator to view details.";
const TRAY_ENRICH_QUEUE_WARNING_HEADING = "Confirm bulk enrich";
const TRAY_ENRICH_QUEUE_WARNING_CONTINUE_LABEL = "Start enrich queue";
const TRAY_ENRICH_QUEUE_WARNING_CANCEL_LABEL = "Cancel";

type WorkspaceState = {
  open: boolean;
  collapsed: boolean;
  ready: boolean;
  enabled: boolean;
  highlightEnabled: boolean;
  scanState: "idle" | "scanning" | "done" | "error";
  textSelectionAvailable: boolean;
  selectionEnrichAvailable: boolean;
  scanSummary: TabScanSummary | null;
  typeFilter: IocTypeFilter;
  trayFilterReady: boolean;
  trayNavigationMessage: string | null;
  trayEnrichmentStatuses: Record<string, TrayEntryEnrichmentStatus>;
  trayMultiSelectAnchorIds: Record<string, true>;
  selectedAnchorId: string | null;
  selection: {
    highlight: HTMLElement;
    payload: HoverCardOverlayPayload;
  } | null;
};

let workspaceState: WorkspaceState = createInitialWorkspaceState();

function createInitialWorkspaceState(): WorkspaceState {
  return {
    open: false,
    collapsed: false,
    ready: false,
    enabled: true,
    highlightEnabled: true,
    scanState: "idle",
    textSelectionAvailable: false,
    selectionEnrichAvailable: false,
    scanSummary: null,
    typeFilter: "all",
    trayFilterReady: false,
    trayNavigationMessage: null,
    trayEnrichmentStatuses: {},
    trayMultiSelectAnchorIds: {},
    selectedAnchorId: null,
    selection: null,
  };
}

export function isWorkspaceOpen(doc: Document = document): boolean {
  return workspaceState.open && doc.getElementById(WORKSPACE_HOST_ID) !== null;
}

export function getWorkspaceSelection(): {
  highlight: HTMLElement;
  payload: HoverCardOverlayPayload;
} | null {
  return workspaceState.selection;
}

export function isToggleWorkspaceMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.TOGGLE_WORKSPACE } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.TOGGLE_WORKSPACE
  );
}

export function isOpenWorkspaceMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.OPEN_WORKSPACE } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.OPEN_WORKSPACE
  );
}

function ensureWorkspaceHost(doc: Document): HTMLElement {
  const existing = doc.getElementById(WORKSPACE_HOST_ID);
  if (existing) {
    return existing;
  }

  ensureVera5UiStyles(doc);

  const host = doc.createElement("div");
  host.id = WORKSPACE_HOST_ID;
  host.className = "vera5-workspace-host";
  host.hidden = true;
  host.style.setProperty("--vera5-workspace-width", `${WORKSPACE_WIDTH_PX}px`);
  host.style.setProperty(
    "--vera5-workspace-gutter",
    `${WORKSPACE_HOST_GUTTER_PX}px`
  );
  doc.body.appendChild(host);
  return host;
}

function resolveWorkspaceWidthPx(): number {
  return workspaceState.collapsed ? WORKSPACE_COLLAPSED_WIDTH_PX : WORKSPACE_WIDTH_PX;
}

function applyWorkspaceHostLayout(doc: Document): void {
  const host = doc.getElementById(WORKSPACE_HOST_ID);
  if (!host) {
    return;
  }

  const width = resolveWorkspaceWidthPx();
  host.style.setProperty("--vera5-workspace-width", `${width}px`);
  host.classList.toggle("vera5-workspace-host--collapsed", workspaceState.collapsed);
  setWorkspacePageGutter(workspaceState.open, doc);
}

function setWorkspacePageGutter(open: boolean, doc: Document): void {
  doc.documentElement.classList.toggle(WORKSPACE_HTML_CLASS, open);
  if (open) {
    const width = resolveWorkspaceWidthPx();
    doc.documentElement.style.setProperty(
      "--vera5-workspace-width",
      `${width + WORKSPACE_HOST_GUTTER_PX}px`
    );
    return;
  }
  doc.documentElement.style.removeProperty("--vera5-workspace-width");
}

function renderWorkspaceDetail(
  payload: HoverCardOverlayPayload,
  doc: Document
): void {
  const bottom = doc.querySelector(".vera5-workspace-bottom");
  if (!(bottom instanceof HTMLElement)) {
    return;
  }

  setScanListExportContextProvider(() => {
    if (!workspaceState.scanSummary || workspaceState.scanSummary.entries.length === 0) {
      return null;
    }
    return {
      summary: workspaceState.scanSummary,
      filter: workspaceState.typeFilter,
    };
  });

  bottom.replaceChildren();
  const panel = buildHoverCardPanel(payload, doc, {
    detailClear: {
      onClear: () => {
        clearWorkspaceDetailSelection(doc);
      },
    },
  });
  panel.classList.add("vera5-workspace-detail-panel");
  bottom.appendChild(panel);
}

function renderWorkspaceEmptyDetail(doc: Document): void {
  const bottom = doc.querySelector(".vera5-workspace-bottom");
  if (!(bottom instanceof HTMLElement)) {
    return;
  }

  bottom.replaceChildren();
  const empty = doc.createElement("p");
  empty.className = "vera5-workspace-empty";
  empty.textContent = WORKSPACE_EMPTY_DETAIL_MESSAGE;
  bottom.appendChild(empty);
}

export function updateWorkspaceDetailPanel(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): void {
  if (!workspaceState.open) {
    return;
  }

  if (workspaceState.selection) {
    workspaceState.selection = {
      ...workspaceState.selection,
      payload,
    };
  }

  renderWorkspaceDetail(payload, doc);
  renderWorkspaceTop(doc);
}

export function updateWorkspaceAnalystNoteIfOpen(
  iocKey: string,
  note: string,
  doc: Document = document
): void {
  if (!workspaceState.selection) {
    return;
  }
  if (
    normalizeIocNoteKey(workspaceState.selection.payload.value) !==
    normalizeIocNoteKey(iocKey)
  ) {
    return;
  }

  const textarea = doc.querySelector(
    `.vera5-workspace-bottom #${HOVER_CARD_ANALYST_NOTES_INPUT_ID}`
  ) as HTMLTextAreaElement | null;
  if (!textarea || textarea.value === note) {
    return;
  }

  const hadFocus = doc.activeElement === textarea;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  textarea.value = note;
  workspaceState.selection = {
    ...workspaceState.selection,
    payload: {
      ...workspaceState.selection.payload,
      analystNotes: note.length > 0 ? note : undefined,
    },
  };

  if (hadFocus) {
    textarea.focus();
    const cursor = Math.min(selectionStart, note.length);
    textarea.setSelectionRange(cursor, Math.min(selectionEnd, note.length));
  }
}

async function loadTrayEnrichmentStatuses(): Promise<void> {
  if (!workspaceState.scanSummary || workspaceState.scanSummary.entries.length === 0) {
    workspaceState.trayEnrichmentStatuses = {};
    return;
  }

  try {
    workspaceState.trayEnrichmentStatuses = await loadTrayEntryEnrichmentStatuses(
      workspaceState.scanSummary.entries
    );
  } catch (error) {
    logUnlessBenignExtensionError(error);
    workspaceState.trayEnrichmentStatuses = {};
  }
}

function buildSummaryFromScanPayload(payload: unknown): TabScanSummary | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (!isTabScanSnapshotPayload(record.snapshot)) {
    return null;
  }

  const tabId = typeof record.tabId === "number" ? record.tabId : null;
  if (tabId === null) {
    return null;
  }

  return buildTabScanSummary({
    ...record.snapshot,
    tabId,
  });
}

async function refreshWorkspaceScanState(doc: Document): Promise<void> {
  if (workspaceState.scanState === "scanning") {
    return;
  }

  try {
    const [enabled, highlightEnabled, summary] = await Promise.all([
      getExtensionEnabled(),
      getHighlightEnabled(),
      getTabScanSummaryForCurrentTab(),
    ]);

    workspaceState.enabled = enabled;
    workspaceState.highlightEnabled = highlightEnabled;

    if (summary) {
      workspaceState.scanSummary = summary;
      workspaceState.scanState = "done";
      const storedFilter = await getTabScanTrayFilter(summary.tabId);
      workspaceState.typeFilter = storedFilter;
      workspaceState.trayFilterReady = true;
    } else if (workspaceState.scanState !== "error") {
      workspaceState.scanSummary = null;
      workspaceState.scanState = "idle";
      workspaceState.typeFilter = "all";
      workspaceState.trayFilterReady = false;
      workspaceState.trayEnrichmentStatuses = {};
    }
  } catch (error) {
    logUnlessBenignExtensionError(error);
  } finally {
    workspaceState.ready = true;
    if (workspaceState.open) {
      renderWorkspaceTop(doc);
      if (!workspaceState.selection) {
        renderWorkspaceEmptyDetail(doc);
      }
    }
  }

  if (workspaceState.scanSummary && workspaceState.scanSummary.entries.length > 0) {
    void loadTrayEnrichmentStatuses()
      .then(() => {
        if (workspaceState.open) {
          renderWorkspaceTop(doc);
        }
      })
      .catch((error) => {
        logUnlessBenignExtensionError(error);
      });
  }
}

function createWorkspaceButton(
  label: string,
  doc: Document,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "vera5-workspace-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function createWorkspaceIconButton(
  label: string,
  doc: Document,
  onClick: () => void,
  disabled = false,
  extraClassName = ""
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `vera5-workspace-icon-button${extraClassName ? ` ${extraClassName}` : ""}`;
  button.textContent = "↻";
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function createWorkspaceToggle(
  label: string,
  checked: boolean,
  disabled: boolean,
  doc: Document,
  onChange: (nextChecked: boolean) => void
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "vera5-workspace-toggle";
  if (checked) {
    button.classList.add("vera5-workspace-toggle--on");
  }
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", checked ? "true" : "false");
  button.setAttribute("aria-label", label);
  button.disabled = disabled;

  const labelEl = doc.createElement("span");
  labelEl.className = "vera5-workspace-toggle-label";
  labelEl.textContent = label;

  const switchTrack = doc.createElement("span");
  switchTrack.className = "vera5-workspace-toggle-switch";
  switchTrack.setAttribute("aria-hidden", "true");
  const knob = doc.createElement("span");
  knob.className = "vera5-workspace-toggle-knob";
  switchTrack.appendChild(knob);

  button.append(labelEl, switchTrack);
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }
    onChange(!checked);
  });
  return button;
}

function createFilterChip(
  label: string,
  active: boolean,
  doc: Document,
  onClick: () => void
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "vera5-workspace-filter-chip";
  button.textContent = label;
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.addEventListener("click", onClick);
  return button;
}

function trayHintClassName(
  badgeText: TrayEntryEnrichmentStatus["badgeText"]
): string {
  if (badgeText === "Live") {
    return "vera5-workspace-tray-hint vera5-workspace-tray-hint--live";
  }
  if (badgeText === "Error") {
    return "vera5-workspace-tray-hint vera5-workspace-tray-hint--error";
  }
  return "vera5-workspace-tray-hint";
}

async function handleWorkspaceScan(doc: Document): Promise<void> {
  if (!workspaceState.enabled) {
    return;
  }

  workspaceState.scanState = "scanning";
  workspaceState.typeFilter = "all";
  workspaceState.trayFilterReady = false;
  workspaceState.trayNavigationMessage = null;
  workspaceState.trayEnrichmentStatuses = {};
  renderWorkspaceTop(doc);

  try {
    const response = await handleScanPageRequest();
    if (!response.ok) {
      workspaceState.scanState = "error";
      return;
    }

    const summary =
      buildSummaryFromScanPayload(response.payload) ??
      (await requestTabScanSummary());
    if (!summary) {
      workspaceState.scanState = "error";
      return;
    }

    workspaceState.scanSummary = summary;
    workspaceState.scanState = "done";
    workspaceState.typeFilter = "all";
    workspaceState.trayFilterReady = true;
    void saveTabScanTrayFilter(summary.tabId, "all").catch((error) => {
      logUnlessBenignExtensionError(error);
    });

    void loadTrayEnrichmentStatuses()
      .then(() => {
        if (workspaceState.open && workspaceState.scanState === "done") {
          renderWorkspaceTop(doc);
        }
      })
      .catch((error) => {
        logUnlessBenignExtensionError(error);
      });
  } catch (error) {
    logUnlessBenignExtensionError(error);
    workspaceState.scanState = "error";
  } finally {
    if (workspaceState.scanState === "scanning") {
      workspaceState.scanState = "error";
    }
    if (workspaceState.open) {
      renderWorkspaceTop(doc);
    }
  }
}

async function handleWorkspaceSelectionScan(doc: Document): Promise<void> {
  if (!workspaceState.enabled) {
    return;
  }

  workspaceState.scanState = "scanning";
  workspaceState.typeFilter = "all";
  workspaceState.trayFilterReady = false;
  workspaceState.trayNavigationMessage = null;
  workspaceState.trayEnrichmentStatuses = {};
  renderWorkspaceTop(doc);

  try {
    const response = await handleScanSelectionRequest();
    if (!response.ok) {
      workspaceState.scanState = "error";
      return;
    }

    const summary =
      buildSummaryFromScanPayload(response.payload) ??
      (await requestTabScanSummary());
    if (!summary) {
      workspaceState.scanState = "error";
      return;
    }

    workspaceState.scanSummary = summary;
    workspaceState.scanState = "done";
    workspaceState.typeFilter = "all";
    workspaceState.trayFilterReady = true;
    void saveTabScanTrayFilter(summary.tabId, "all").catch((error) => {
      logUnlessBenignExtensionError(error);
    });

    void loadTrayEnrichmentStatuses()
      .then(() => {
        if (workspaceState.open && workspaceState.scanState === "done") {
          renderWorkspaceTop(doc);
        }
      })
      .catch((error) => {
        logUnlessBenignExtensionError(error);
      });
  } catch (error) {
    logUnlessBenignExtensionError(error);
    workspaceState.scanState = "error";
  } finally {
    if (workspaceState.scanState === "scanning") {
      workspaceState.scanState = "error";
    }
    if (workspaceState.open) {
      renderWorkspaceTop(doc);
    }
  }
}

function syncWorkspaceTextSelectionAvailability(doc: Document): void {
  const nextAvailable = resolveActiveSelectionRange(doc) !== null;
  const selectionChanged = nextAvailable !== workspaceState.textSelectionAvailable;
  if (selectionChanged) {
    workspaceState.textSelectionAvailable = nextAvailable;
  }

  void resolveIocFromActiveSelection(doc)
    .then((resolved) => {
      const nextEnrichAvailable = resolved !== null;
      if (
        nextEnrichAvailable === workspaceState.selectionEnrichAvailable &&
        !selectionChanged
      ) {
        return;
      }
      workspaceState.selectionEnrichAvailable = nextEnrichAvailable;
      if (workspaceState.open) {
        renderWorkspaceTop(doc);
      }
    })
    .catch((error) => {
      logUnlessBenignExtensionError(error);
    });

  if (selectionChanged && workspaceState.open) {
    renderWorkspaceTop(doc);
  }
}

async function handleWorkspaceSelectionEnrich(doc: Document): Promise<void> {
  if (!workspaceState.enabled) {
    return;
  }

  try {
    await handleEnrichSelectionRequest(doc);
  } catch (error) {
    logUnlessBenignExtensionError(error);
  }
}

function clearWorkspaceScanResults(doc: Document): void {
  if (workspaceState.scanState === "scanning") {
    return;
  }

  workspaceState.scanSummary = null;
  workspaceState.scanState = "idle";
  workspaceState.typeFilter = "all";
  workspaceState.trayFilterReady = false;
  workspaceState.trayNavigationMessage = null;
  workspaceState.trayEnrichmentStatuses = {};
  workspaceState.trayMultiSelectAnchorIds = {};
  cancelTrayEnrichQueue();

  if (workspaceState.selection) {
    cancelPendingHoverEnrichment();
    workspaceState.selection = null;
    workspaceState.selectedAnchorId = null;
    clearWorkspaceSelectionState();
    setWorkspaceSelectionState({
      open: true,
      selectedAnchorId: null,
      payloadValue: null,
    });
    setScanListExportContextProvider(null);
    renderWorkspaceEmptyDetail(doc);
  }

  renderWorkspaceTop(doc);
}

function clearWorkspaceDetailSelection(doc: Document): void {
  if (!workspaceState.selection) {
    renderWorkspaceEmptyDetail(doc);
    return;
  }

  cancelPendingHoverEnrichment();
  workspaceState.selection = null;
  workspaceState.selectedAnchorId = null;
  clearWorkspaceSelectionState();
  setWorkspaceSelectionState({
    open: true,
    selectedAnchorId: null,
    payloadValue: null,
  });
  renderWorkspaceEmptyDetail(doc);
  renderWorkspaceTop(doc);
}

function toggleWorkspaceCollapsed(doc: Document): void {
  workspaceState.collapsed = !workspaceState.collapsed;
  applyWorkspaceHostLayout(doc);
  const sidebar = doc.querySelector(".vera5-workspace-sidebar");
  if (sidebar instanceof HTMLElement) {
    sidebar.classList.toggle(
      "vera5-workspace-sidebar--collapsed",
      workspaceState.collapsed
    );
  }
  const edgeTab = doc.querySelector(".vera5-workspace-edge-tab");
  if (edgeTab instanceof HTMLButtonElement) {
    edgeTab.textContent = workspaceState.collapsed ? "‹" : "›";
    edgeTab.setAttribute(
      "aria-label",
      workspaceState.collapsed ? "Expand workspace" : "Collapse workspace"
    );
  }
}

function selectWorkspaceIndicator(
  highlight: HTMLElement,
  options: HoverCardOpenOptions = {},
  doc: Document = document
): boolean {
  const basePayload = buildHoverCardPayloadFromHighlight(highlight);
  if (!basePayload) {
    return false;
  }

  presentWorkspaceEnrichmentForPayload(
    basePayload,
    highlight,
    options,
    doc,
    highlight.dataset.vera5AnchorId ?? null
  );
  return true;
}

export function presentWorkspaceEnrichmentForPayload(
  basePayload: HoverCardOverlayPayload,
  anchor: HTMLElement,
  options: HoverCardOpenOptions = {},
  doc: Document = document,
  selectedAnchorId: string | null = anchor.dataset.vera5AnchorId ?? null
): void {
  workspaceState.selectedAnchorId = selectedAnchorId;
  workspaceState.trayNavigationMessage = null;

  const applySelection = (payload: HoverCardOverlayPayload) => {
    workspaceState.selection = { highlight: anchor, payload };
    setWorkspaceSelectionState({
      open: true,
      selectedAnchorId: workspaceState.selectedAnchorId,
      payloadValue: payload.value,
    });
    renderWorkspaceDetail(payload, doc);
    renderWorkspaceTop(doc);
  };

  applySelection(basePayload);

  if (isExtensionContextInvalidated()) {
    return;
  }

  void loadWorkspaceEnrichmentSourceContext()
    .then(({ disabledSourceIds, enabledSourceIds, showDisabledSourcesInWorkspace }) => {
      const payload: HoverCardOverlayPayload = {
        ...basePayload,
        ...(disabledSourceIds.length > 0
          ? { disabledSources: disabledSourceIds }
          : {}),
        enabledEnrichmentSourceIds: enabledSourceIds,
        showDisabledSourcesInWorkspace,
      };

      if (
        workspaceState.selection?.highlight === anchor &&
        workspaceState.selectedAnchorId === selectedAnchorId
      ) {
        workspaceState.selection = { highlight: anchor, payload };
        renderWorkspaceDetail(payload, doc);
      }

      if (options.enrichmentTrigger === "manual") {
        cancelPendingHoverEnrichment();
        void runBackgroundEnrichment(payload, doc, { bypassCache: true }).catch(
          (error) => {
            logUnlessBenignExtensionError(error);
          }
        );
      } else if (options.enrichmentTrigger !== "none") {
        void attemptAutoEnrichmentFetch(payload).catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      }
    })
    .catch((error) => {
      logUnlessBenignExtensionError(error);
    });
}

export function activateWorkspaceIndicatorByAnchorId(
  anchorId: string,
  doc: Document = document
): boolean {
  const highlight = doc.querySelector<HTMLElement>(
    `[data-vera5-anchor-id="${CSS.escape(anchorId)}"]`
  );
  if (!highlight) {
    workspaceState.trayNavigationMessage =
      "This indicator is no longer on the page. Scan again to refresh the list.";
    renderWorkspaceTop(doc);
    return false;
  }

  highlight.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  return selectWorkspaceIndicator(highlight, { enrichmentTrigger: "auto" }, doc);
}

function setTrayMultiSelectAnchor(anchorId: string, selected: boolean): void {
  if (selected) {
    workspaceState.trayMultiSelectAnchorIds[anchorId] = true;
  } else {
    delete workspaceState.trayMultiSelectAnchorIds[anchorId];
  }
}

function resolveSelectedTrayAnchorIdsForEnrich(): string[] {
  const summary = workspaceState.scanSummary;
  if (!summary) {
    return [];
  }

  const filteredEntries = filterTabScanSummaryEntries(
    summary.entries,
    workspaceState.typeFilter
  );
  return filteredEntries
    .map((entry) => entry.anchorId)
    .filter((anchorId) => workspaceState.trayMultiSelectAnchorIds[anchorId]);
}

async function enrichTrayIndicatorSequentially(
  anchorId: string,
  doc: Document
): Promise<void> {
  const highlight = doc.querySelector<HTMLElement>(
    `[data-vera5-anchor-id="${CSS.escape(anchorId)}"]`
  );
  if (!highlight) {
    workspaceState.trayNavigationMessage =
      "This indicator is no longer on the page. Scan again to refresh the list.";
    renderWorkspaceTop(doc);
    return;
  }

  const basePayload = buildHoverCardPayloadFromHighlight(highlight);
  if (!basePayload) {
    return;
  }

  highlight.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

  const { disabledSourceIds, enabledSourceIds, showDisabledSourcesInWorkspace } =
    await loadWorkspaceEnrichmentSourceContext();
  const payload: HoverCardOverlayPayload = {
    ...basePayload,
    ...(disabledSourceIds.length > 0 ? { disabledSources: disabledSourceIds } : {}),
    enabledEnrichmentSourceIds: enabledSourceIds,
    showDisabledSourcesInWorkspace,
  };

  presentWorkspaceEnrichmentForPayload(
    basePayload,
    highlight,
    { enrichmentTrigger: "none" },
    doc,
    anchorId
  );
  cancelPendingHoverEnrichment();
  const outcome = await runBackgroundEnrichment(payload, doc, { bypassCache: true });
  if (outcome === "cancelled") {
    cancelTrayEnrichQueue();
  }
}

function confirmTrayEnrichQueueWarning(
  message: string,
  doc: Document
): Promise<boolean> {
  ensureVera5UiStyles(doc);

  return new Promise((resolve) => {
    const backdrop = doc.createElement("div");
    backdrop.className = "vera5-tray-enrich-queue-warning-backdrop";

    const panel = doc.createElement("div");
    panel.className = "vera5-tray-enrich-queue-warning-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", TRAY_ENRICH_QUEUE_WARNING_HEADING);

    const heading = doc.createElement("h3");
    heading.className = "vera5-tray-enrich-queue-warning-heading";
    heading.textContent = TRAY_ENRICH_QUEUE_WARNING_HEADING;

    const body = doc.createElement("p");
    body.className = "vera5-tray-enrich-queue-warning-message";
    body.setAttribute("role", "note");
    body.textContent = message;

    const actions = doc.createElement("div");
    actions.className = "vera5-tray-enrich-queue-warning-actions";

    const finish = (confirmed: boolean) => {
      backdrop.remove();
      resolve(confirmed);
    };

    const continueButton = createWorkspaceButton(
      TRAY_ENRICH_QUEUE_WARNING_CONTINUE_LABEL,
      doc,
      () => {
        finish(true);
      }
    );
    const cancelButton = createWorkspaceButton(
      TRAY_ENRICH_QUEUE_WARNING_CANCEL_LABEL,
      doc,
      () => {
        finish(false);
      }
    );

    actions.append(continueButton, cancelButton);
    panel.append(heading, body, actions);
    backdrop.appendChild(panel);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        finish(false);
      }
    });

    doc.body.appendChild(backdrop);
    continueButton.focus();
  });
}

async function startTrayEnrichQueue(
  anchorIds: readonly string[],
  doc: Document
): Promise<void> {
  if (isTrayEnrichQueueRunning() || anchorIds.length === 0) {
    return;
  }

  const summary = workspaceState.scanSummary;
  if (!summary) {
    return;
  }

  const pageGate = await resolvePageEnrichmentTrustGate(doc);
  if (!pageGate.allowed) {
    workspaceState.trayNavigationMessage = DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE;
    renderWorkspaceTop(doc);
    return;
  }

  const filteredEntries = filterTabScanSummaryEntries(
    summary.entries,
    workspaceState.typeFilter
  );
  const enabledSources = await getEnrichmentSourceEnabledForContent();
  const impact = estimateTrayEnrichQueueImpact(
    filteredEntries,
    anchorIds,
    enabledSources
  );
  const confirmed = await confirmTrayEnrichQueueWarning(
    buildTrayEnrichQueueWarningMessage(impact),
    doc
  );
  if (!confirmed) {
    return;
  }

  workspaceState.trayNavigationMessage = null;

  try {
    await runSequentialTrayEnrichQueue(
      anchorIds,
      (anchorId) => enrichTrayIndicatorSequentially(anchorId, doc),
      () => {
        if (workspaceState.open) {
          renderWorkspaceTop(doc);
        }
      }
    );
  } catch (error) {
    logUnlessBenignExtensionError(error);
  } finally {
    await loadTrayEnrichmentStatuses();
    if (workspaceState.open) {
      renderWorkspaceTop(doc);
    }
  }
}

function renderWorkspaceTop(doc: Document): void {
  const top = doc.querySelector(".vera5-workspace-top");
  if (!(top instanceof HTMLElement)) {
    return;
  }

  top.replaceChildren();

  const controls = doc.createElement("div");
  controls.className = "vera5-workspace-controls";

  const toggleRow = doc.createElement("div");
  toggleRow.className = "vera5-workspace-toggle-row";
  toggleRow.appendChild(
    createWorkspaceToggle(
      "Extension enabled",
      workspaceState.enabled,
      !workspaceState.ready,
      doc,
      (checked) => {
        workspaceState.enabled = checked;
        void setExtensionEnabled(checked);
        if (!checked) {
          workspaceState.scanState = "idle";
          workspaceState.scanSummary = null;
          workspaceState.typeFilter = "all";
          workspaceState.trayFilterReady = false;
          workspaceState.trayNavigationMessage = null;
          workspaceState.trayEnrichmentStatuses = {};
          workspaceState.trayMultiSelectAnchorIds = {};
          cancelTrayEnrichQueue();
          workspaceState.selection = null;
          workspaceState.selectedAnchorId = null;
          renderWorkspaceEmptyDetail(doc);
        }
        renderWorkspaceTop(doc);
      }
    )
  );
  toggleRow.appendChild(
    createWorkspaceToggle(
      "Highlight indicators",
      workspaceState.highlightEnabled,
      !workspaceState.ready || !workspaceState.enabled,
      doc,
      (checked) => {
        workspaceState.highlightEnabled = checked;
        void setHighlightEnabled(checked);
        renderWorkspaceTop(doc);
      }
    )
  );
  controls.appendChild(toggleRow);

  controls.appendChild(
    createWorkspaceButton(
      workspaceState.scanState === "scanning" ? "Scanning…" : "Scan page",
      doc,
      () => {
        void handleWorkspaceScan(doc).catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      },
      !workspaceState.ready ||
        !workspaceState.enabled ||
        workspaceState.scanState === "scanning"
    )
  );
  controls.appendChild(
    createWorkspaceButton(
      workspaceState.scanState === "scanning" ? "Scanning…" : "Scan selection",
      doc,
      () => {
        void handleWorkspaceSelectionScan(doc).catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      },
      !workspaceState.ready ||
        !workspaceState.enabled ||
        workspaceState.scanState === "scanning" ||
        !workspaceState.textSelectionAvailable
    )
  );
  controls.appendChild(
    createWorkspaceButton(
      "Enrich selection",
      doc,
      () => {
        void handleWorkspaceSelectionEnrich(doc).catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      },
      !workspaceState.ready ||
        !workspaceState.enabled ||
        !workspaceState.selectionEnrichAvailable
    )
  );
  controls.appendChild(
    createWorkspaceButton(
      "Settings",
      doc,
      () => {
        void safeRuntimeSendMessage(openOptionsPageMessage());
      },
      !workspaceState.ready
    )
  );
  controls.appendChild(
    createWorkspaceButton(
      "Permissions",
      doc,
      () => {
        openExtensionSitePermissionsPage();
      },
      !workspaceState.ready
    )
  );

  if (workspaceState.scanState === "error") {
    const error = doc.createElement("p");
    error.className = "vera5-workspace-error";
    error.textContent = "Scan failed. Reload the tab and try again.";
    controls.appendChild(error);
  }

  top.appendChild(controls);

  const trayView = resolveWorkspaceTrayView({
    enabled: workspaceState.enabled,
    scanState: workspaceState.scanState,
    scanSummary: workspaceState.scanSummary,
  });

  if (!trayView) {
    return;
  }

  const trayHeadingRow = doc.createElement("div");
  trayHeadingRow.className = "vera5-workspace-tray-heading-row";

  const trayHeading = doc.createElement("h2");
  trayHeading.className = "vera5-workspace-tray-heading";
  trayHeading.textContent = "Detected indicators";

  const clearScanButton = createWorkspaceIconButton(
    "Clear detected indicators",
    doc,
    () => {
      clearWorkspaceScanResults(doc);
    },
    !workspaceState.ready || !workspaceState.enabled || workspaceState.scanState === "scanning"
  );
  trayHeadingRow.append(trayHeading, clearScanButton);
  top.appendChild(trayHeadingRow);

  if (trayView === "prompt") {
    const prompt = doc.createElement("p");
    prompt.className = "vera5-workspace-empty";
    prompt.textContent = WORKSPACE_EMPTY_SCAN_MESSAGE;
    top.appendChild(prompt);
    return;
  }

  if (trayView === "scanning") {
    const scanning = doc.createElement("p");
    scanning.className = "vera5-workspace-empty";
    scanning.setAttribute("aria-live", "polite");
    scanning.textContent = "Scanning page…";
    top.appendChild(scanning);
    return;
  }

  if (trayView === "empty") {
    const empty = doc.createElement("p");
    empty.className = "vera5-workspace-empty";
    empty.setAttribute("aria-live", "polite");
    empty.textContent = "No indicators detected on this page.";
    top.appendChild(empty);
    return;
  }

  const summary = workspaceState.scanSummary;
  if (!summary) {
    return;
  }

  const countLine = doc.createElement("p");
  countLine.className = "vera5-workspace-tray-summary";
  countLine.textContent = buildTabScanCountSummaryText(summary);
  top.appendChild(countLine);

  const filterRow = doc.createElement("div");
  filterRow.className = "vera5-workspace-filter-row";
  filterRow.setAttribute("role", "group");
  filterRow.setAttribute("aria-label", "Filter by indicator type");
  filterRow.appendChild(
    createFilterChip(
      `All (${summary.totalCount})`,
      workspaceState.typeFilter === "all",
      doc,
      () => {
        workspaceState.typeFilter = "all";
        if (workspaceState.trayFilterReady && workspaceState.scanSummary) {
          void saveTabScanTrayFilter(workspaceState.scanSummary.tabId, "all");
        }
        renderWorkspaceTop(doc);
      }
    )
  );
  for (const type of listIocTypesPresentInSummary(summary)) {
    filterRow.appendChild(
      createFilterChip(
        `${IOC_TYPE_TRAY_LABEL[type]} (${summary.countByType[type] ?? 0})`,
        workspaceState.typeFilter === type,
        doc,
        () => {
          workspaceState.typeFilter = type;
          if (workspaceState.trayFilterReady && workspaceState.scanSummary) {
            void saveTabScanTrayFilter(workspaceState.scanSummary.tabId, type);
          }
          renderWorkspaceTop(doc);
        }
      )
    );
  }
  top.appendChild(filterRow);

  const selectedTrayAnchorIds = resolveSelectedTrayAnchorIdsForEnrich();
  const queueRunning = isTrayEnrichQueueRunning();
  const queueSnapshot = getTrayEnrichQueueSnapshot();

  const bulkRow = doc.createElement("div");
  bulkRow.className = "vera5-workspace-tray-bulk-row";
  bulkRow.appendChild(
    createWorkspaceButton(
      `Enrich selected (${selectedTrayAnchorIds.length})`,
      doc,
      () => {
        void startTrayEnrichQueue(selectedTrayAnchorIds, doc).catch((error) => {
          logUnlessBenignExtensionError(error);
        });
      },
      !workspaceState.ready ||
        !workspaceState.enabled ||
        selectedTrayAnchorIds.length === 0 ||
        queueRunning
    )
  );
  if (queueRunning) {
    bulkRow.appendChild(
      createWorkspaceButton(
        "Cancel enrich queue",
        doc,
        () => {
          cancelTrayEnrichQueue();
          cancelPendingHoverEnrichment();
          renderWorkspaceTop(doc);
        },
        false
      )
    );
  }
  top.appendChild(bulkRow);

  if (queueRunning && queueSnapshot) {
    const queueStatus = doc.createElement("p");
    queueStatus.className = "vera5-workspace-tray-queue-status";
    queueStatus.setAttribute("aria-live", "polite");
    queueStatus.textContent = `Enriching ${queueSnapshot.currentIndex} of ${queueSnapshot.totalCount}…`;
    top.appendChild(queueStatus);
  }

  if (workspaceState.trayNavigationMessage) {
    const navMessage = doc.createElement("p");
    navMessage.className = "vera5-workspace-error";
    navMessage.setAttribute("role", "alert");
    navMessage.setAttribute("aria-live", "polite");
    navMessage.textContent = workspaceState.trayNavigationMessage;
    top.appendChild(navMessage);
  }

  const filteredEntries = filterTabScanSummaryEntries(
    summary.entries,
    workspaceState.typeFilter
  );

  if (filteredEntries.length === 0) {
    const noMatches = doc.createElement("p");
    noMatches.className = "vera5-workspace-empty";
    noMatches.textContent = "No indicators match this filter.";
    top.appendChild(noMatches);
    return;
  }

  const list = doc.createElement("ul");
  list.className = "vera5-workspace-tray-list";

  for (const entry of filteredEntries) {
    const enrichmentStatus = workspaceState.trayEnrichmentStatuses[entry.anchorId];
    const provenance = resolveTrayEntryMatchProvenance(entry);
    const row = doc.createElement("li");
    row.className = "vera5-workspace-tray-row";
    row.dataset.vera5TrayEntry = "true";
    row.dataset.vera5Type = entry.type;
    row.dataset.vera5Value = entry.value;
    row.dataset.vera5AnchorId = entry.anchorId;
    if (provenance) {
      row.dataset.vera5RuleId = provenance.ruleId;
      row.dataset.vera5SourceTextHint = provenance.sourceTextHint;
    }
    if (entry.displayValue) {
      row.dataset.vera5DisplayValue = entry.displayValue;
    }
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute(
      "aria-label",
      buildTrayRowNavigationAriaLabel(entry.value, enrichmentStatus)
    );
    row.setAttribute(
      "aria-selected",
      workspaceState.selectedAnchorId === entry.anchorId ? "true" : "false"
    );
    row.classList.toggle(
      "vera5-workspace-tray-row--bulk-selected",
      Boolean(workspaceState.trayMultiSelectAnchorIds[entry.anchorId])
    );

    const selectCheckbox = doc.createElement("input");
    selectCheckbox.type = "checkbox";
    selectCheckbox.className = "vera5-workspace-tray-select";
    selectCheckbox.checked = Boolean(workspaceState.trayMultiSelectAnchorIds[entry.anchorId]);
    selectCheckbox.disabled = queueRunning;
    selectCheckbox.setAttribute(
      "aria-label",
      `Select ${entry.value} for bulk enrich`
    );
    selectCheckbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    selectCheckbox.addEventListener("change", () => {
      setTrayMultiSelectAnchor(entry.anchorId, selectCheckbox.checked);
      renderWorkspaceTop(doc);
    });

    const activate = () => {
      activateWorkspaceIndicatorByAnchorId(entry.anchorId, doc);
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      activate();
    });

    const typeBadge = doc.createElement("span");
    typeBadge.className = "vera5-workspace-tray-type";
    typeBadge.setAttribute("aria-hidden", "true");
    typeBadge.textContent = IOC_TYPE_TRAY_LABEL[entry.type];

    const valuePresentation = resolveIndicatorValuePresentation({
      value: entry.value,
      displayValue: entry.displayValue,
    });
    const valueContainer = doc.createElement("span");
    valueContainer.className = "vera5-workspace-tray-value";
    if (valuePresentation.showRefangedPair) {
      const onPage = doc.createElement("span");
      onPage.className = "vera5-workspace-tray-value-on-page";
      onPage.textContent = valuePresentation.onPageValue;
      const refanged = doc.createElement("span");
      refanged.className = "vera5-workspace-tray-refanged-value";
      refanged.textContent = `${HOVER_CARD_REFANGED_VALUE_LABEL} ${valuePresentation.refangedValue}`;
      valueContainer.append(onPage, refanged);
    } else {
      valueContainer.textContent = valuePresentation.refangedValue;
    }

    const mainRow = doc.createElement("div");
    mainRow.className = "vera5-workspace-tray-row-main";
    mainRow.append(selectCheckbox, typeBadge, valueContainer);

    if (enrichmentStatus) {
      const hint = doc.createElement("span");
      hint.className = trayHintClassName(enrichmentStatus.badgeText);
      hint.setAttribute("aria-hidden", "true");
      hint.textContent = formatTrayRowEnrichmentHint(enrichmentStatus);
      mainRow.appendChild(hint);
    }

    row.appendChild(mainRow);

    const whyDetectedView = buildWhyDetectedView({
      type: entry.type,
      ruleId: entry.ruleId,
      sourceTextHint: entry.sourceTextHint,
      ignoredOverlaps: entry.ignoredOverlaps,
    });
    if (whyDetectedView) {
      const details = doc.createElement("details");
      details.className = TRAY_WHY_DETECTED_CLASS;
      details.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      details.addEventListener("keydown", (event) => {
        event.stopPropagation();
      });
      const summary = doc.createElement("summary");
      summary.textContent = HOVER_CARD_WHY_DETECTED_HEADING;
      details.appendChild(summary);
      details.appendChild(
        createWhyDetectedSection(whyDetectedView, doc, {
          compact: true,
          omitHeading: true,
        })
      );
      row.appendChild(details);
    }

    list.appendChild(row);
  }

  top.appendChild(list);
}

function renderWorkspace(doc: Document): void {
  const host = ensureWorkspaceHost(doc);
  host.replaceChildren();

  const shell = doc.createElement("div");
  shell.className = "vera5-workspace-shell";

  const edgeTab = doc.createElement("button");
  edgeTab.type = "button";
  edgeTab.className = "vera5-workspace-edge-tab";
  edgeTab.textContent = workspaceState.collapsed ? "‹" : "›";
  edgeTab.setAttribute(
    "aria-label",
    workspaceState.collapsed ? "Expand workspace" : "Collapse workspace"
  );
  edgeTab.addEventListener("click", () => {
    toggleWorkspaceCollapsed(doc);
  });

  const sidebar = doc.createElement("div");
  sidebar.className = "vera5-workspace-sidebar";
  if (workspaceState.collapsed) {
    sidebar.classList.add("vera5-workspace-sidebar--collapsed");
  }
  sidebar.setAttribute("role", "complementary");
  sidebar.setAttribute("aria-label", "Vera5 workspace");

  const header = doc.createElement("div");
  header.className = "vera5-workspace-header";

  const title = doc.createElement("a");
  title.className = "vera5-workspace-title";
  title.href = VERA5_WEBSITE_URL;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = "VERA5";

  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.className = "vera5-workspace-close";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close Vera5 workspace");
  closeButton.addEventListener("click", () => {
    closeWorkspace(doc);
  });

  header.append(title, closeButton);

  const top = doc.createElement("div");
  top.className = "vera5-workspace-top";

  const divider = doc.createElement("hr");
  divider.className = "vera5-workspace-divider";
  divider.setAttribute("aria-hidden", "true");

  const bottom = doc.createElement("div");
  bottom.className = "vera5-workspace-bottom";

  sidebar.append(header, top, divider, bottom);
  shell.append(edgeTab, sidebar);
  host.appendChild(shell);

  applyWorkspaceHostLayout(doc);
  renderWorkspaceTop(doc);

  if (workspaceState.selection) {
    renderWorkspaceDetail(workspaceState.selection.payload, doc);
  } else {
    renderWorkspaceEmptyDetail(doc);
  }
}

export function openWorkspace(doc: Document = document): void {
  workspaceState.open = true;
  workspaceState.textSelectionAvailable = resolveActiveSelectionRange(doc) !== null;
  void resolveIocFromActiveSelection(doc)
    .then((resolved) => {
      workspaceState.selectionEnrichAvailable = resolved !== null;
      if (workspaceState.open) {
        renderWorkspaceTop(doc);
      }
    })
    .catch((error) => {
      logUnlessBenignExtensionError(error);
    });
  setWorkspaceSelectionState({
    open: true,
    selectedAnchorId: workspaceState.selectedAnchorId,
    payloadValue: workspaceState.selection?.payload.value ?? null,
  });

  const host = ensureWorkspaceHost(doc);
  host.hidden = false;
  setWorkspacePageGutter(true, doc);
  renderWorkspace(doc);
  void refreshWorkspaceScanState(doc).catch((error) => {
    logUnlessBenignExtensionError(error);
  });
}

export function closeWorkspace(doc: Document = document): void {
  workspaceState.open = false;
  workspaceState.selection = null;
  workspaceState.selectedAnchorId = null;
  setScanListExportContextProvider(null);
  clearWorkspaceSelectionState();
  setWorkspaceSelectionState({ open: false, selectedAnchorId: null, payloadValue: null });
  cancelPendingHoverEnrichment();

  const host = doc.getElementById(WORKSPACE_HOST_ID);
  if (host) {
    host.hidden = true;
    host.replaceChildren();
  }

  setWorkspacePageGutter(false, doc);
}

export function toggleWorkspace(doc: Document = document): void {
  if (isWorkspaceOpen(doc)) {
    closeWorkspace(doc);
    return;
  }
  openWorkspace(doc);
}

export function setupWorkspaceSidebarListener(doc: Document = document): void {
  registerWorkspacePayloadUpdateHandler((payload, updateDoc) => {
    updateWorkspaceDetailPanel(payload, updateDoc);
  });

  doc.addEventListener("selectionchange", () => {
    syncWorkspaceTextSelectionAvailability(doc);
  });

  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "session" || !workspaceState.open) {
      return;
    }

    const scanSnapshotChanged = Object.keys(changes).some((key) =>
      key.startsWith("tabScanSnapshot:")
    );
    if (scanSnapshotChanged) {
      void refreshWorkspaceScanState(doc).catch((error) => {
        logUnlessBenignExtensionError(error);
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isToggleWorkspaceMessage(message)) {
      try {
        toggleWorkspace(doc);
        sendResponse({ ok: true, payload: { open: isWorkspaceOpen(doc) } });
      } catch (error) {
        rethrowUnlessStaleExtensionError(error);
      }
      return true;
    }

    if (isOpenWorkspaceMessage(message)) {
      try {
        openWorkspace(doc);
        sendResponse({ ok: true, payload: { open: true } });
      } catch (error) {
        rethrowUnlessStaleExtensionError(error);
      }
      return true;
    }

    return false;
  });
}

export function resetWorkspaceSidebarForTests(): void {
  cancelTrayEnrichQueue();
  resetTrayEnrichQueueForTests();
  workspaceState = createInitialWorkspaceState();
  clearWorkspaceSelectionState();
  setWorkspaceSelectionState({ open: false, selectedAnchorId: null, payloadValue: null });
}
