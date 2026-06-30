type TabActiveInfo = {
  tabId: number;
  windowId?: number;
};

type TabChangeInfo = {
  status?: string;
  url?: string;
};

type TabSnapshot = {
  id?: number;
  active?: boolean;
  windowId?: number;
};

type TabActivatedListener = (activeInfo: TabActiveInfo) => void;
type TabUpdatedListener = (
  tabId: number,
  changeInfo: TabChangeInfo,
  tab: TabSnapshot
) => void;

type TabsEventScope = {
  tabs?: {
    onActivated?: {
      addListener: (listener: TabActivatedListener) => void;
      removeListener: (listener: TabActivatedListener) => void;
    };
    onUpdated?: {
      addListener: (listener: TabUpdatedListener) => void;
      removeListener: (listener: TabUpdatedListener) => void;
    };
  };
};

/**
 * Notify the side panel when the analyst's active page context changes.
 *
 * The native side panel persists across tab switches (unlike the injected
 * sidebar, which was bound to a single page DOM), so it must re-read the
 * now-active tab's scan state to keep "Scan page", the detected-indicator tray,
 * and the per-indicator detail pane pointed at the page the analyst is looking
 * at. Two events matter:
 *   - `tabs.onActivated` — the analyst switches to a different tab.
 *   - `tabs.onUpdated` (status "complete" on the active tab) — the active tab
 *     navigates to a new page in place, which invalidates the prior scan.
 *
 * Events are de-duplicated by `tabId` + URL so repeated/no-op updates (Chrome
 * fires several `onUpdated` events per navigation) don't churn the panel. The
 * surface is dependency-injectable for unit testing and is an inert no-op when
 * the runtime exposes no `tabs` events (e.g. a non-extension test context).
 *
 * Returns an unsubscribe function that detaches every listener.
 */
export function subscribeActiveTabChange(
  onActiveContextChange: () => void,
  scope: TabsEventScope = globalThis.chrome as unknown as TabsEventScope
): () => void {
  const tabs = scope?.tabs;
  const onActivated = tabs?.onActivated;
  const onUpdated = tabs?.onUpdated;
  if (!onActivated && !onUpdated) {
    return () => {};
  }

  let lastContextKey: string | null = null;
  const notifyIfChanged = (contextKey: string): void => {
    if (contextKey === lastContextKey) {
      return;
    }
    lastContextKey = contextKey;
    onActiveContextChange();
  };

  const activatedListener: TabActivatedListener = (activeInfo) => {
    notifyIfChanged(`activated:${activeInfo.tabId}`);
  };
  const updatedListener: TabUpdatedListener = (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || tab?.active !== true) {
      return;
    }
    notifyIfChanged(`updated:${tabId}:${tab.windowId ?? ""}:${changeInfo.url ?? ""}`);
  };

  onActivated?.addListener(activatedListener);
  onUpdated?.addListener(updatedListener);

  return () => {
    onActivated?.removeListener(activatedListener);
    onUpdated?.removeListener(updatedListener);
  };
}
