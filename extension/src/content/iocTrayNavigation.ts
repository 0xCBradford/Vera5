import type { MessageResponse } from "../lib/messages";
import { rethrowUnlessStaleExtensionError } from "../lib/extensionContext";
import { CONTENT_MESSAGE } from "./constants";
import { findHighlightByAnchorId } from "./highlighter";
import { openHoverCardForHighlight } from "./hoverCardTrigger";
import {
  activateWorkspaceIndicatorByAnchorId,
  isWorkspaceOpen,
} from "./workspaceSidebar";

export function isNavigateToIocAnchorMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.NAVIGATE_TO_IOC_ANCHOR; anchorId: string } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.NAVIGATE_TO_IOC_ANCHOR &&
    typeof (raw as { anchorId?: unknown }).anchorId === "string" &&
    (raw as { anchorId: string }).anchorId.length > 0
  );
}

export function handleNavigateToIocAnchorRequest(
  anchorId: string,
  root: ParentNode = document.body,
  doc: Document = document
): MessageResponse {
  const highlight = findHighlightByAnchorId(anchorId, root);
  if (!highlight) {
    return { ok: false, error: "highlight not found" };
  }

  highlight.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

  if (isWorkspaceOpen(doc)) {
    return activateWorkspaceIndicatorByAnchorId(anchorId, doc)
      ? { ok: true }
      : { ok: false, error: "highlight not found" };
  }

  openHoverCardForHighlight(highlight, { enrichmentTrigger: "auto" }, doc);
  return { ok: true };
}

export function setupNavigateToIocAnchorListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isNavigateToIocAnchorMessage(message)) {
      return false;
    }
    try {
      sendResponse(handleNavigateToIocAnchorRequest(message.anchorId));
    } catch (error) {
      rethrowUnlessStaleExtensionError(error);
    }
    return true;
  });
}
