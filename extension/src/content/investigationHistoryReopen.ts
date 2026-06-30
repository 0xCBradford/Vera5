import type { MessageResponse } from "../lib/messages";
import { extractExactIocValue } from "../lib/iocRequestBoundaries";
import type { IocType } from "../lib/iocRegex";
import { resolvePageOriginFromUrl } from "../lib/investigationHistory";
import { rethrowUnlessStaleExtensionError } from "../lib/extensionContext";
import { CONTENT_MESSAGE } from "./constants";
import { findHighlightByIoc } from "./highlighter";
import { openHoverCardForHighlight } from "./hoverCardTrigger";

export function isReopenInvestigationHistoryMessage(
  raw: unknown
): raw is {
  type: typeof CONTENT_MESSAGE.REOPEN_INVESTIGATION_HISTORY;
  ioc: string;
  iocType: IocType;
  pageOrigin: string;
} {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== CONTENT_MESSAGE.REOPEN_INVESTIGATION_HISTORY) {
    return false;
  }
  if (typeof record.ioc !== "string" || record.ioc.trim().length === 0) {
    return false;
  }
  if (typeof record.iocType !== "string") {
    return false;
  }
  if (typeof record.pageOrigin !== "string" || record.pageOrigin.trim().length === 0) {
    return false;
  }
  return extractExactIocValue(record.ioc, record.iocType as IocType) !== null;
}

export function handleReopenInvestigationHistoryRequest(
  input: { ioc: string; iocType: IocType; pageOrigin: string },
  root: ParentNode = document.body,
  doc: Document = document
): MessageResponse {
  const sanitized = extractExactIocValue(input.ioc, input.iocType);
  if (!sanitized) {
    return { ok: false, error: "invalid ioc" };
  }

  const currentOrigin = resolvePageOriginFromUrl(doc.location.href);
  if (!currentOrigin || currentOrigin !== input.pageOrigin.trim()) {
    return { ok: false, error: "page origin mismatch" };
  }

  const highlight = findHighlightByIoc(sanitized, input.iocType, root);
  if (!highlight) {
    return { ok: false, error: "highlight not found" };
  }

  highlight.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

  openHoverCardForHighlight(highlight, { enrichmentTrigger: "auto" }, doc);
  return { ok: true };
}

export function setupReopenInvestigationHistoryListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isReopenInvestigationHistoryMessage(message)) {
      return false;
    }
    try {
      sendResponse(
        handleReopenInvestigationHistoryRequest({
          ioc: message.ioc,
          iocType: message.iocType,
          pageOrigin: message.pageOrigin,
        })
      );
    } catch (error) {
      rethrowUnlessStaleExtensionError(error);
    }
    return true;
  });
}
