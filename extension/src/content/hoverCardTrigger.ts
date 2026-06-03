import type { IocType } from "../lib/iocRegex";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  isExtensionContextInvalidated,
  rethrowUnlessStaleExtensionError,
} from "../lib/extensionContext";
import { attemptAutoEnrichmentFetch } from "./enrichmentAutoFetch";
import {
  cancelPendingHoverEnrichment,
  runBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import {
  loadWorkspaceEnrichmentSourceContext,
} from "./enrichmentSourceStorage";
import {
  IOC_ENRICH_ICON_CLASS,
  IOC_HIGHLIGHT_CLASS,
  readIocHighlightDisplayValue,
  readIocHighlightProvenance,
  resolveAdjacentIocHighlight,
} from "./highlighter";
import {
  hideHoverCard,
  HOVER_CARD_HOST_ID,
  setHoverCardFocusReturnTarget,
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

  const provenance = readIocHighlightProvenance(highlight);
  const displayValue = readIocHighlightDisplayValue(highlight);

  return {
    value,
    type,
    ...(provenance ?? {}),
    ...(displayValue ? { displayValue } : {}),
    enrichmentState: "empty",
  };
}

export type HoverCardOpenOptions = {
  enrichmentTrigger?: "manual" | "auto";
  moveFocusToPanel?: boolean;
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

  if (options.moveFocusToPanel) {
    setHoverCardFocusReturnTarget(highlight);
  } else {
    setHoverCardFocusReturnTarget(null);
  }

  if (isExtensionContextInvalidated()) {
    showHoverCardNearAnchor(highlight, basePayload, doc, {
      moveFocus: options.moveFocusToPanel,
    });
    return true;
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

      showHoverCardNearAnchor(highlight, payload, doc, {
        moveFocus: options.moveFocusToPanel,
      });

      if (options.enrichmentTrigger === "manual") {
        cancelPendingHoverEnrichment();
        void runBackgroundEnrichment(payload, doc, { bypassCache: true }).catch(
          rethrowUnlessStaleExtensionError
        );
      } else {
        void attemptAutoEnrichmentFetch(payload).catch(
          rethrowUnlessStaleExtensionError
        );
      }
    })
    .catch(rethrowUnlessStaleExtensionError);

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

  cancelPendingHoverEnrichment();
  hideHoverCard(doc);
}

function isPageLevelTriageOrigin(active: Element | null, doc: Document): boolean {
  if (!active) {
    return true;
  }
  return active === doc.body || active === doc.documentElement;
}

function handleHighlightTriageNavigation(event: KeyboardEvent, doc: Document): boolean {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(`#${HOVER_CARD_HOST_ID}`)) {
    return false;
  }

  const direction = event.key === "ArrowDown" ? "next" : "previous";
  const currentHighlight = resolveIocHighlight(target);
  const origin =
    currentHighlight ??
    (isPageLevelTriageOrigin(doc.activeElement, doc) ? null : undefined);

  if (origin === undefined) {
    return false;
  }

  const nextHighlight = resolveAdjacentIocHighlight(origin, direction, doc.body);
  if (!nextHighlight) {
    return false;
  }

  event.preventDefault();
  cancelPendingHoverEnrichment();
  hideHoverCard(doc);
  setHoverCardFocusReturnTarget(null);
  nextHighlight.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: "smooth",
  });
  nextHighlight.focus();
  return true;
}

function handleDocumentKeyDown(event: KeyboardEvent, doc: Document): void {
  if (event.key === "Escape") {
    cancelPendingHoverEnrichment();
    hideHoverCard(doc);
    return;
  }

  if (handleHighlightTriageNavigation(event, doc)) {
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
      moveFocusToPanel: true,
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
    cancelPendingHoverEnrichment();
    hideHoverCard(doc);
  };
}
