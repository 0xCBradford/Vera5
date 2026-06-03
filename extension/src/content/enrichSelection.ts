import type { MessageResponse } from "../lib/messages";
import { extractExactIocValue } from "../lib/iocRequestBoundaries";
import { IOC_TYPE, ruleIdForIocType, type IocMatch, type IocRegexOptions, type IocType } from "../lib/iocRegex";
import {
  logUnlessBenignExtensionError,
  rethrowUnlessStaleExtensionError,
} from "../lib/extensionContext";
import { detectIocsInText } from "./detector";
import { attemptAutoEnrichmentFetch } from "./enrichmentAutoFetch";
import {
  cancelPendingHoverEnrichment,
  runBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import {
  loadWorkspaceEnrichmentSourceContext,
} from "./enrichmentSourceStorage";
import {
  buildHoverCardPayloadFromHighlight,
  openHoverCardForHighlight,
  resolveIocHighlight,
  type HoverCardOpenOptions,
} from "./hoverCardTrigger";
import {
  showHoverCardNearRange,
  type HoverCardOverlayPayload,
} from "./hoverCardOverlay";
import { CONTENT_MESSAGE } from "./constants";
import { resolveActiveSelectionRange, resolveIocDetectorScanOptions } from "./scanPage";

export function isEnrichSelectionMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.ENRICH_SELECTION } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.ENRICH_SELECTION
  );
}

function selectionIntersectsHighlight(range: Range, highlight: HTMLElement): boolean {
  const ownerDocument = highlight.ownerDocument ?? document;
  const highlightRange = ownerDocument.createRange();
  try {
    highlightRange.selectNodeContents(highlight);
  } catch {
    return false;
  }
  return (
    range.compareBoundaryPoints(Range.END_TO_START, highlightRange) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, highlightRange) > 0
  );
}

export function resolveHighlightFromSelection(doc: Document = document): HTMLElement | null {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  for (const node of [selection.anchorNode, selection.focusNode]) {
    if (!node) {
      continue;
    }
    const element =
      node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const highlight = resolveIocHighlight(element);
    if (highlight && selectionIntersectsHighlight(range, highlight)) {
      return highlight;
    }
  }

  let current: Node | null = range.commonAncestorContainer;
  if (current.nodeType === Node.TEXT_NODE) {
    current = current.parentElement;
  }
  while (current instanceof Element) {
    const highlight = resolveIocHighlight(current);
    if (highlight && selectionIntersectsHighlight(range, highlight)) {
      return highlight;
    }
    current = current.parentElement;
  }

  return null;
}

export function resolveIocMatchFromSelectionText(
  text: string,
  iocOptions: IocRegexOptions = {}
): IocMatch | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const matches = detectIocsInText(trimmed, iocOptions);
  if (matches.length === 0) {
    return null;
  }

  for (const type of Object.values(IOC_TYPE)) {
    const exact = extractExactIocValue(trimmed, type);
    if (!exact) {
      continue;
    }
    const exactMatch = matches.find(
      (match) =>
        match.type === type &&
        match.value === exact &&
        match.start === 0 &&
        match.end === trimmed.length
    );
    if (exactMatch) {
      return exactMatch;
    }
    return {
      value: exact,
      type,
      start: 0,
      end: trimmed.length,
      ruleId: ruleIdForIocType(type),
      sourceTextHint: trimmed,
    };
  }

  return [...matches].sort((a, b) => b.value.length - a.value.length)[0] ?? null;
}

export async function resolveIocFromActiveSelection(
  doc: Document = document
): Promise<{
  value: string;
  type: IocType;
  ruleId?: IocMatch["ruleId"];
  sourceTextHint?: string;
  highlight: HTMLElement | null;
  range: Range | null;
} | null> {
  const range = resolveActiveSelectionRange(doc);
  if (!range) {
    return null;
  }

  const highlight = resolveHighlightFromSelection(doc);
  if (highlight) {
    const payload = buildHoverCardPayloadFromHighlight(highlight);
    if (!payload) {
      return null;
    }
    return {
      value: payload.value,
      type: payload.type,
      ruleId: payload.ruleId,
      sourceTextHint: payload.sourceTextHint,
      highlight,
      range: null,
    };
  }

  const scanOptions = await resolveIocDetectorScanOptions();
  const match = resolveIocMatchFromSelectionText(
    doc.getSelection()?.toString() ?? "",
    scanOptions.ioc ?? {}
  );
  if (!match) {
    return null;
  }

  return {
    value: match.value,
    type: match.type,
    ruleId: match.ruleId,
    sourceTextHint: match.sourceTextHint,
    highlight: null,
    range,
  };
}

function resolveSelectionAnchorElement(range: Range, doc: Document): HTMLElement {
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (node instanceof HTMLElement) {
    return node;
  }
  return doc.body;
}

export async function openEnrichmentForResolvedSelection(
  resolved: {
    value: string;
    type: IocType;
    highlight: HTMLElement | null;
    range: Range | null;
  },
  doc: Document = document,
  options: HoverCardOpenOptions = { enrichmentTrigger: "manual" }
): Promise<boolean> {
  if (resolved.highlight) {
    const workspaceModule = await import("./workspaceSidebar");
    if (workspaceModule.isWorkspaceOpen(doc)) {
      const payload = buildHoverCardPayloadFromHighlight(resolved.highlight);
      if (!payload) {
        return false;
      }
      workspaceModule.presentWorkspaceEnrichmentForPayload(
        payload,
        resolved.highlight,
        options,
        doc
      );
      return true;
    }
    return openHoverCardForHighlight(resolved.highlight, options, doc);
  }

  if (!resolved.range) {
    return false;
  }

  const basePayload: HoverCardOverlayPayload = {
    value: resolved.value,
    type: resolved.type,
    ruleId: resolved.ruleId,
    sourceTextHint: resolved.sourceTextHint,
    enrichmentState: "empty",
  };

  const workspaceModule = await import("./workspaceSidebar");
  if (workspaceModule.isWorkspaceOpen(doc)) {
    workspaceModule.presentWorkspaceEnrichmentForPayload(
      basePayload,
      resolveSelectionAnchorElement(resolved.range, doc),
      options,
      doc
    );
    return true;
  }

  const { disabledSourceIds, enabledSourceIds, showDisabledSourcesInWorkspace } =
    await loadWorkspaceEnrichmentSourceContext();
  const payload: HoverCardOverlayPayload = {
    ...basePayload,
    ...(disabledSourceIds.length > 0
      ? { disabledSources: disabledSourceIds }
      : {}),
    enabledEnrichmentSourceIds: enabledSourceIds,
    showDisabledSourcesInWorkspace,
  };

  showHoverCardNearRange(resolved.range, payload, doc);

  if (options.enrichmentTrigger === "manual") {
    cancelPendingHoverEnrichment();
    void runBackgroundEnrichment(payload, doc, { bypassCache: true }).catch(
      rethrowUnlessStaleExtensionError
    );
  } else {
    void attemptAutoEnrichmentFetch(payload).catch(rethrowUnlessStaleExtensionError);
  }

  return true;
}

export async function handleEnrichSelectionRequest(
  doc: Document = document
): Promise<MessageResponse> {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { ok: false, error: "No text selected." };
  }

  const resolved = await resolveIocFromActiveSelection(doc);
  if (!resolved) {
    return { ok: false, error: "No indicator found in selection." };
  }

  const opened = await openEnrichmentForResolvedSelection(resolved, doc, {
    enrichmentTrigger: "manual",
  });
  if (!opened) {
    return { ok: false, error: "No indicator found in selection." };
  }

  return {
    ok: true,
    payload: {
      value: resolved.value,
      type: resolved.type,
    },
  };
}

export function setupEnrichSelectionListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isEnrichSelectionMessage(message)) {
      return false;
    }
    void handleEnrichSelectionRequest()
      .then(sendResponse)
      .catch((error) => {
        logUnlessBenignExtensionError(error);
      });
    return true;
  });
}
