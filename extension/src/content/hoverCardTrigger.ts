import type { IocType } from "../lib/iocRegex";
import { IOC_TYPE } from "../lib/iocRegex";
import { attemptAutoEnrichmentFetch } from "./enrichmentAutoFetch";
import { runBackgroundEnrichment } from "./enrichmentBackgroundFetch";
import {
  getEnrichmentSourceEnabledForContent,
  listDisabledEnrichmentSourceIds,
} from "./enrichmentSourceStorage";
import { IOC_ENRICH_ICON_CLASS, IOC_HIGHLIGHT_CLASS } from "./highlighter";
import {
  hideHoverCard,
  HOVER_CARD_HOST_ID,
  showHoverCardNearAnchor,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

function isIocType(value: string): value is IocType {
  return IOC_TYPES.has(value);
}

export function resolveIocHighlight(element: Element | null): HTMLElement | null {
  if (!element) {
    return null;
  }

  const highlight = element.closest<HTMLElement>(`.${IOC_HIGHLIGHT_CLASS}`);
  if (!highlight) {
    return null;
  }

  const value = highlight.dataset.vera5Value;
  const type = highlight.dataset.vera5Type;
  if (!value || !type || !isIocType(type)) {
    return null;
  }

  return highlight;
}

export function buildHoverCardPayloadFromHighlight(
  highlight: HTMLElement
): HoverCardOverlayPayload | null {
  const value = highlight.dataset.vera5Value;
  const type = highlight.dataset.vera5Type;
  if (!value || !type || !isIocType(type)) {
    return null;
  }

  return {
    value,
    type,
    enrichmentState: "empty",
  };
}

export type HoverCardOpenOptions = {
  enrichmentTrigger?: "manual" | "auto";
};

function isManualEnrichTarget(target: Element): boolean {
  return target.closest(`.${IOC_ENRICH_ICON_CLASS}`) !== null;
}

export function openHoverCardForHighlight(
  highlight: HTMLElement,
  options: HoverCardOpenOptions = {},
  doc: Document = document
): boolean {
  const basePayload = buildHoverCardPayloadFromHighlight(highlight);
  if (!basePayload) {
    return false;
  }

  void getEnrichmentSourceEnabledForContent().then((sources) => {
    const disabledSources = listDisabledEnrichmentSourceIds(sources);
    const payload: HoverCardOverlayPayload =
      disabledSources.length > 0
        ? { ...basePayload, disabledSources }
        : basePayload;

    showHoverCardNearAnchor(highlight, payload, doc);

    if (options.enrichmentTrigger === "manual") {
      void runBackgroundEnrichment(payload, doc);
    } else {
      void attemptAutoEnrichmentFetch(payload);
    }
  });

  return true;
}

function isHoverCardTarget(target: Element): boolean {
  return target.closest(`#${HOVER_CARD_HOST_ID}`) !== null;
}

function handleDocumentClick(event: MouseEvent, doc: Document): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const highlight = resolveIocHighlight(target);
  if (highlight) {
    event.preventDefault();
    event.stopPropagation();
    openHoverCardForHighlight(highlight, {
      enrichmentTrigger: isManualEnrichTarget(target) ? "manual" : "auto",
    }, doc);
    return;
  }

  if (isHoverCardTarget(target)) {
    return;
  }

  hideHoverCard(doc);
}

function handleDocumentKeyDown(event: KeyboardEvent, doc: Document): void {
  if (event.key === "Escape") {
    hideHoverCard(doc);
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const highlight = resolveIocHighlight(
    event.target instanceof Element ? event.target : null
  );
  if (!highlight) {
    return;
  }

  event.preventDefault();
  openHoverCardForHighlight(
    highlight,
    {
      enrichmentTrigger: isManualEnrichTarget(
        event.target instanceof Element ? event.target : highlight
      )
        ? "manual"
        : "auto",
    },
    doc
  );
}

export function setupHoverCardTrigger(doc: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    handleDocumentClick(event, doc);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    handleDocumentKeyDown(event, doc);
  };

  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);

  return () => {
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    hideHoverCard(doc);
  };
}
