import type { IocType } from "../lib/iocRegex";
import { resolveHoverCardAnalystNote, primeAnalystNoteForIoc, setSessionAnalystNote } from "../lib/analystNotesSession";
import { normalizeIocNoteKey } from "../lib/analystNotesStorage";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildNormalizedEnrichmentRecord,
  copyEnrichmentExportJsonToClipboard,
  copyEnrichmentExportMarkdownToClipboard,
  copyEnrichmentExportTxtToClipboard,
  downloadEnrichmentExportFile,
  type EnrichmentExportFileFormat,
} from "../lib/enrichmentExport";
import { safeOpenOptionsPage } from "../lib/extensionContext";
import {
  buildSourceStatusBadgeClassName,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_ANALYST_NOTES_INPUT_ID,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_ANALYST_NOTES_PLACEHOLDER,
  HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_RAW_JSON_SUMMARY_LABEL,
  resolveEffectiveSourceAttribution,
  resolveHoverCardDisplayView,
  resolveHoverCardDisclaimerAriaLabel,
  type EnrichmentSourceAttribution,
  type EnrichmentSourceId,
  type HoverCardDisclaimerInput,
  type HoverCardEnrichmentState,
  type HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import { scheduleCopyFeedbackReset } from "../lib/motionPreference";
import { getPivotLinks } from "../lib/pivots";
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

let lastHoverCardAnchor: Element | null = null;
let lastHoverCardPayload: HoverCardOverlayPayload | null = null;

export function getLastHoverCardAnchor(): Element | null {
  return lastHoverCardAnchor;
}

export function getLastHoverCardPayload(): HoverCardOverlayPayload | null {
  return lastHoverCardPayload;
}
export const HOVER_CARD_PANEL_CLASS = "vera5-hover-card-panel";
export const HOVER_CARD_COPY_BUTTON_CLASS = "vera5-hover-card-copy";
export const HOVER_CARD_PIVOT_NAV_CLASS = "vera5-hover-card-pivots";
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
export const HOVER_CARD_EXPORT_SECTION_CLASS = "vera5-hover-card-export";
export const HOVER_CARD_EXPORT_ACTIONS_CLASS = "vera5-hover-card-export-actions";
export const HOVER_CARD_EXPORT_BUTTON_CLASS = "vera5-hover-card-export-button";
export const HOVER_CARD_EXPORT_DROPDOWN_CLASS = "vera5-hover-card-export-dropdown";
export const HOVER_CARD_EXPORT_DROPDOWN_MENU_CLASS =
  "vera5-hover-card-export-dropdown-menu";
export const HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS =
  "vera5-hover-card-export-dropdown-item";
export const HOVER_CARD_SECTION_HEADING_CLASS = "vera5-hover-card-section-heading";
export const HOVER_CARD_INTEL_SUMMARY_CLASS = "vera5-hover-card-intel-summary";

const TYPE_LABELS: Record<IocType, string> = {
  ipv4: "IPv4 address",
  domain: "Domain",
  url: "URL",
  md5: "MD5 hash",
  sha1: "SHA1 hash",
  sha256: "SHA256 hash",
  cve: "CVE ID",
};

export type HoverCardOverlayPayload = {
  value: string;
  type: IocType;
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  enrichmentState?: HoverCardEnrichmentState;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
  analystNotes?: string;
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

function createPivotLinksNav(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const pivotLinks = getPivotLinks(payload.type, payload.value);
  if (pivotLinks.length === 0) {
    return null;
  }

  const nav = doc.createElement("nav");
  nav.className = HOVER_CARD_PIVOT_NAV_CLASS;
  nav.setAttribute("aria-label", "Open indicator in external sources");

  for (const link of pivotLinks) {
    const anchor = doc.createElement("a");
    anchor.className = HOVER_CARD_PIVOT_LINK_CLASS;
    anchor.href = link.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = link.label;
    nav.appendChild(anchor);
  }

  return nav;
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

    const detail = doc.createElement("span");
    detail.className = HOVER_CARD_SOURCE_DETAIL_CLASS;
    detail.textContent = entry.detail;
    item.appendChild(detail);

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

function createCopyButton(
  value: string,
  doc: Document
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_COPY_BUTTON_CLASS;
  button.textContent = "Copy";
  button.setAttribute("aria-label", `Copy indicator ${value}`);

  button.addEventListener("click", () => {
    void copyTextToClipboard(value).then((success) => {
      if (!success) {
        return;
      }
      button.textContent = "Copied";
      button.classList.add("vera5-hover-card-copy--copied");
      const docView = doc.defaultView ?? window;
      scheduleCopyFeedbackReset(() => {
        button.textContent = "Copy";
        button.classList.remove("vera5-hover-card-copy--copied");
      }, docView);
    });
  });

  return button;
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
      if (mode === "export") {
        downloadEnrichmentExportFile(record, format, doc);
        return;
      }
      if (format === "markdown") {
        return copyEnrichmentExportMarkdownToClipboard(record);
      }
      if (format === "json") {
        return copyEnrichmentExportJsonToClipboard(record);
      }
      return copyEnrichmentExportTxtToClipboard(record);
    },
  }));
}

function createExportSection(
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement {
  ensureExportDropdownDismiss(doc);

  const section = doc.createElement("section");
  section.className = HOVER_CARD_EXPORT_SECTION_CLASS;
  section.setAttribute("aria-label", "Export case artifacts");

  const actions = doc.createElement("div");
  actions.className = HOVER_CARD_EXPORT_ACTIONS_CLASS;

  const buildRecord = () => buildExportRecordFromPayload(payload);

  actions.appendChild(
    createActionDropdown(
      "Export",
      "Export case artifacts as a file",
      buildExportFormatActions(buildRecord, doc, "export"),
      doc
    )
  );
  actions.appendChild(
    createActionDropdown(
      "Copy",
      "Copy case artifacts to the clipboard",
      buildExportFormatActions(buildRecord, doc, "copy"),
      doc
    )
  );

  section.appendChild(actions);
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

export function buildHoverCardPanel(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): HTMLElement {
  ensureVera5UiStyles(doc);

  const pivotLinks = getPivotLinks(payload.type, payload.value);
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
    pivotLinkCount: pivotLinks.length,
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
  const pivotNav = createPivotLinksNav(payload, doc);
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
  const exportSection = createExportSection(payload, doc);

  const panel = doc.createElement("aside");
  panel.className = HOVER_CARD_PANEL_CLASS;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `Indicator details for ${payload.value}`);

  const headerRow = doc.createElement("div");
  headerRow.className = "vera5-hover-card-header";

  const typeRow = doc.createElement("span");
  typeRow.className = "vera5-hover-card-type";
  typeRow.textContent = formatTypeLabel(payload.type);
  headerRow.appendChild(typeRow);
  headerRow.appendChild(createCopyButton(payload.value, doc));
  panel.appendChild(headerRow);

  const valueRow = doc.createElement("p");
  valueRow.className = "vera5-hover-card-value";
  valueRow.textContent = payload.value;
  panel.appendChild(valueRow);

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
  if (pivotNav) {
    panel.appendChild(pivotNav);
  }
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
  doc: Document = document
): HTMLElement {
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

export function refreshHoverCardIfOpen(doc: Document = document): void {
  if (!lastHoverCardAnchor || !lastHoverCardPayload) {
    return;
  }
  showHoverCardNearAnchor(lastHoverCardAnchor, lastHoverCardPayload, doc);
}

export function hideHoverCard(doc: Document = document): void {
  const host = doc.getElementById(HOVER_CARD_HOST_ID);
  if (!host) {
    return;
  }
  host.replaceChildren();
  lastHoverCardAnchor = null;
  lastHoverCardPayload = null;
}
