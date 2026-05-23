import type { IocType } from "../lib/iocRegex";
import { IOC_TYPE } from "../lib/iocRegex";
import { IOC_HIGHLIGHT_CLASS } from "./highlighter";
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

export function openHoverCardForHighlight(
  highlight: HTMLElement,
  doc: Document = document
): boolean {
  const payload = buildHoverCardPayloadFromHighlight(highlight);
  if (!payload) {
    return false;
  }

  showHoverCardNearAnchor(highlight, payload, doc);
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
    openHoverCardForHighlight(highlight, doc);
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
  openHoverCardForHighlight(highlight, doc);
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
