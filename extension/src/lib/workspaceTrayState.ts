import type { TabScanSummary } from "./tabScanSummary";

export type WorkspaceTrayView = "prompt" | "scanning" | "empty" | "results";

export function resolveWorkspaceTrayView(input: {
  enabled: boolean;
  scanState: "idle" | "scanning" | "done" | "error";
  scanSummary: TabScanSummary | null;
}): WorkspaceTrayView | null {
  if (!input.enabled) {
    return null;
  }
  if (input.scanState === "scanning") {
    return "scanning";
  }
  if (input.scanState === "done" && input.scanSummary) {
    return input.scanSummary.totalCount > 0 ? "results" : "empty";
  }
  return "prompt";
}

export function resolveTrayNavigationFeedback(input: {
  tabId?: number;
  response?: unknown;
  sendFailed?: boolean;
  indicatorValue?: string;
}): string | null {
  if (input.sendFailed || input.tabId === undefined) {
    return "Could not open this indicator on the page. Reload the tab and rescan.";
  }

  if (
    input.response &&
    typeof input.response === "object" &&
    "ok" in input.response &&
    (input.response as { ok: unknown }).ok === false &&
    typeof (input.response as { error?: unknown }).error === "string"
  ) {
    const error = (input.response as { error: string }).error;
    if (error === "highlight not found") {
      if (input.indicatorValue) {
        return `Could not find ${input.indicatorValue} on the page. Scan again to refresh the list.`;
      }
      return "This indicator is no longer on the page. Scan again to refresh the list.";
    }
  }

  return null;
}

export function resolveCollectionMemberOpenFeedback(input: {
  tabId?: number;
  summary: TabScanSummary | null;
  member: { value: string };
  entryFound: boolean;
  response?: unknown;
  sendFailed?: boolean;
}): string | null {
  if (input.sendFailed || input.tabId === undefined) {
    return resolveTrayNavigationFeedback({
      tabId: input.tabId,
      sendFailed: input.sendFailed,
      indicatorValue: input.member.value,
    });
  }

  if (input.response !== undefined) {
    return resolveTrayNavigationFeedback({
      tabId: input.tabId,
      response: input.response,
      indicatorValue: input.member.value,
    });
  }

  if (!input.summary) {
    return `Scan this page to locate ${input.member.value} on the page.`;
  }

  if (!input.entryFound) {
    return `${input.member.value} is not on the current page. Scan again to refresh the list.`;
  }

  return null;
}
