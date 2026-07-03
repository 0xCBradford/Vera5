import type { MessageResponse } from "../lib/messages";
import { isNavigateToIocAnchorMessage } from "../lib/messages";
import type { IocType } from "../lib/iocRegex";
import { rethrowUnlessStaleExtensionError } from "../lib/extensionContext";
import { findHighlightByAnchorId, findHighlightByIoc } from "./highlighter";
import { openHoverCardForHighlight } from "./hoverCardTrigger";

export type NavigateToIocAnchorTarget = {
  anchorId: string;
  iocType?: IocType;
  value?: string;
};

export function resolveHighlightForNavigation(
  target: NavigateToIocAnchorTarget,
  root: ParentNode = document.body
): HTMLElement | null {
  const byAnchor = findHighlightByAnchorId(target.anchorId, root);
  if (byAnchor?.isConnected) {
    return byAnchor;
  }

  if (target.iocType && target.value) {
    return findHighlightByIoc(target.value, target.iocType, root);
  }

  return null;
}

export function handleNavigateToIocAnchorRequest(
  target: string | NavigateToIocAnchorTarget,
  root: ParentNode = document.body,
  doc: Document = document
): MessageResponse {
  const resolved =
    typeof target === "string" ? { anchorId: target } : target;
  const highlight = resolveHighlightForNavigation(resolved, root);
  if (!highlight) {
    return { ok: false, error: "highlight not found" };
  }

  highlight.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

  openHoverCardForHighlight(highlight, { enrichmentTrigger: "auto" }, doc);
  return { ok: true };
}

export function setupNavigateToIocAnchorListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isNavigateToIocAnchorMessage(message)) {
      return false;
    }
    try {
      sendResponse(
        handleNavigateToIocAnchorRequest({
          anchorId: message.anchorId,
          iocType: message.iocType,
          value: message.value,
        })
      );
    } catch (error) {
      rethrowUnlessStaleExtensionError(error);
    }
    return true;
  });
}

export { isNavigateToIocAnchorMessage };
