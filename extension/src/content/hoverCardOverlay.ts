import type { IocType } from "../lib/iocRegex";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildDisabledSourcePlaceholders,
  buildSourceStatusBadgeClassName,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_RAW_JSON_SUMMARY_LABEL,
  resolveEnrichmentDisplay,
  shouldShowEnrichmentSourceAttribution,
  shouldShowMissingKeyAction,
  shouldShowMultiSourceResults,
  shouldShowRateLimitRetryHint,
  shouldShowSingleSourceRawJson,
  type EnrichmentSourceAttribution,
  type EnrichmentSourceId,
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

export const HOVER_CARD_HOST_ID = "vera5-hover-card-host";

let lastHoverCardAnchor: Element | null = null;

export function getLastHoverCardAnchor(): Element | null {
  return lastHoverCardAnchor;
}
export const HOVER_CARD_PANEL_CLASS = "vera5-hover-card-panel";
export const HOVER_CARD_COPY_BUTTON_CLASS = "vera5-hover-card-copy";
export const HOVER_CARD_PIVOT_NAV_CLASS = "vera5-hover-card-pivots";
export const HOVER_CARD_PIVOT_LINK_CLASS = "vera5-hover-card-pivot-link";
export const HOVER_CARD_ENRICHMENT_CLASS = "vera5-hover-card-enrichment";
export const HOVER_CARD_TAGS_CLASS = "vera5-hover-card-tags";
export const HOVER_CARD_TAG_CLASS = "vera5-hover-card-tag";
export const HOVER_CARD_ATTRIBUTION_CLASS = "vera5-hover-card-attribution";
export const HOVER_CARD_ACTION_CLASS = "vera5-hover-card-action";
export const HOVER_CARD_RETRY_HINT_CLASS = "vera5-hover-card-retry-hint";
export const HOVER_CARD_SOURCES_CLASS = "vera5-hover-card-sources";
export const HOVER_CARD_SOURCE_ITEM_CLASS = "vera5-hover-card-source-item";
export const HOVER_CARD_SOURCE_BADGE_CLASS = "vera5-hover-card-source-badge";
export const HOVER_CARD_SOURCE_DETAIL_CLASS = "vera5-hover-card-source-detail";
export const HOVER_CARD_RAW_JSON_CLASS = "vera5-hover-card-raw-json";
export const HOVER_CARD_RAW_JSON_BODY_CLASS = "vera5-hover-card-raw-json-body";

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
};

function formatTypeLabel(type: IocType): string {
  return TYPE_LABELS[type];
}

export function createRawVendorJsonDetails(
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
  pre.textContent = rawVendorJson;
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
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const entries = payload.sourceResults ?? [];
  if (!shouldShowMultiSourceResults(entries)) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_SOURCES_CLASS;
  section.setAttribute("aria-label", "Enrichment source results");

  const heading = doc.createElement("p");
  heading.className = "vera5-hover-card-sources-heading";
  heading.textContent = "Enrichment sources";
  section.appendChild(heading);

  const list = doc.createElement("ul");
  list.className = "vera5-hover-card-sources-list";

  for (const entry of entries) {
    const item = doc.createElement("li");
    item.className = HOVER_CARD_SOURCE_ITEM_CLASS;

    const badge = doc.createElement("span");
    badge.className = buildSourceStatusBadgeClassName(entry.status);
    badge.textContent = `${entry.label} · ${entry.badgeText}`;
    item.appendChild(badge);

    const detail = doc.createElement("span");
    detail.className = HOVER_CARD_SOURCE_DETAIL_CLASS;
    detail.textContent = entry.detail;
    item.appendChild(detail);

    if (entry.retryHint?.trim()) {
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
  payload: HoverCardOverlayPayload,
  doc: Document
): HTMLElement | null {
  const placeholders = buildDisabledSourcePlaceholders(
    payload.disabledSources ?? []
  );
  if (placeholders.length === 0) {
    return null;
  }

  const section = doc.createElement("section");
  section.className = HOVER_CARD_SOURCES_CLASS;
  section.setAttribute("aria-label", "Enrichment sources");

  const heading = doc.createElement("p");
  heading.className = "vera5-hover-card-sources-heading";
  heading.textContent = "Sources";
  section.appendChild(heading);

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

function createSourceAttributionFooter(
  payload: HoverCardOverlayPayload,
  enrichmentState: HoverCardEnrichmentState,
  doc: Document
): HTMLElement | null {
  if (
    !shouldShowEnrichmentSourceAttribution(
      enrichmentState,
      payload.sourceAttribution,
      payload.sourceResults
    ) ||
    !payload.sourceAttribution
  ) {
    return null;
  }

  const footer = doc.createElement("p");
  footer.className = HOVER_CARD_ATTRIBUTION_CLASS;
  footer.setAttribute("role", "note");
  footer.textContent = formatEnrichmentSourceAttribution(
    payload.sourceAttribution,
    enrichmentState
  );
  return footer;
}

function createMissingKeyAction(
  payload: HoverCardOverlayPayload,
  enrichmentState: HoverCardEnrichmentState,
  doc: Document
): HTMLElement | null {
  if (!shouldShowMissingKeyAction(enrichmentState, payload.errorCode, payload.sourceResults)) {
    return null;
  }

  const button = doc.createElement("button");
  button.type = "button";
  button.className = HOVER_CARD_ACTION_CLASS;
  button.textContent = HOVER_CARD_OPEN_SETTINGS_LABEL;
  button.setAttribute("aria-label", "Open Vera5 Settings to add an API key");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void chrome.runtime.openOptionsPage();
  });
  return button;
}

function createRateLimitRetryHint(
  payload: HoverCardOverlayPayload,
  enrichmentState: HoverCardEnrichmentState,
  doc: Document
): HTMLElement | null {
  if (!shouldShowRateLimitRetryHint(enrichmentState, payload.retryHint, payload.sourceResults)) {
    return null;
  }

  const hint = doc.createElement("p");
  hint.className = HOVER_CARD_RETRY_HINT_CLASS;
  hint.setAttribute("role", "note");
  hint.textContent = payload.retryHint ?? "";
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
  const enrichment = resolveEnrichmentDisplay({
    enrichmentState: payload.enrichmentState,
    summary: payload.summary,
    errorMessage: payload.errorMessage,
  });
  const sourceResultsSection = createSourceResultsSection(payload, doc);
  const singleSourceRawJson =
    shouldShowSingleSourceRawJson(payload.sourceResults) &&
    payload.sourceResults?.[0]?.rawVendorJson?.trim()
      ? createRawVendorJsonDetails(
          payload.sourceResults[0].rawVendorJson,
          doc
        )
      : null;
  const disabledSourcesSection = createDisabledSourcesSection(payload, doc);
  const pivotNav = createPivotLinksNav(payload, doc);
  const enrichmentTagsSection =
    enrichment.variant === "ready" && payload.tags
      ? createEnrichmentTagsSection(payload.tags, doc)
      : null;
  const attributionFooter = createSourceAttributionFooter(
    payload,
    enrichment.variant,
    doc
  );
  const missingKeyAction = createMissingKeyAction(
    payload,
    enrichment.variant,
    doc
  );
  const rateLimitRetryHint = createRateLimitRetryHint(
    payload,
    enrichment.variant,
    doc
  );
  const showFooter =
    pivotLinks.length > 0 ||
    disabledSourcesSection !== null ||
    sourceResultsSection !== null;
  const showBelowSummary =
    showFooter ||
    singleSourceRawJson !== null ||
    enrichmentTagsSection !== null ||
    attributionFooter !== null ||
    missingKeyAction !== null ||
    rateLimitRetryHint !== null;

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
  panel.appendChild(summaryRow);

  if (missingKeyAction) {
    missingKeyAction.style.marginBottom = showBelowSummary ? "8px" : "0";
    panel.appendChild(missingKeyAction);
  }

  if (rateLimitRetryHint) {
    rateLimitRetryHint.style.marginBottom = showBelowSummary ? "8px" : "0";
    panel.appendChild(rateLimitRetryHint);
  }

  if (enrichmentTagsSection) {
    panel.appendChild(enrichmentTagsSection);
  }

  if (singleSourceRawJson) {
    singleSourceRawJson.style.marginBottom = showFooter ? "8px" : "0";
    panel.appendChild(singleSourceRawJson);
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
  if (attributionFooter) {
    panel.appendChild(attributionFooter);
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
  const panel = buildHoverCardPanel(payload, doc);
  host.appendChild(panel);
  positionHoverCardPanel(panel, anchor, readViewportSize(doc.defaultView ?? window));
  return panel;
}

export function hideHoverCard(doc: Document = document): void {
  const host = doc.getElementById(HOVER_CARD_HOST_ID);
  if (!host) {
    return;
  }
  host.replaceChildren();
  lastHoverCardAnchor = null;
}
