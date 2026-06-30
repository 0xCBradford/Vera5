import { describe, expect, it, vi } from "vitest";
import { subscribeActiveTabChange } from "./sidePanelActiveTab";

type ActivatedListener = (activeInfo: { tabId: number; windowId?: number }) => void;
type UpdatedListener = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: { id?: number; active?: boolean; windowId?: number }
) => void;

function createFakeTabsScope() {
  const activated = new Set<ActivatedListener>();
  const updated = new Set<UpdatedListener>();
  return {
    activated,
    updated,
    scope: {
      tabs: {
        onActivated: {
          addListener: (listener: ActivatedListener) => {
            activated.add(listener);
          },
          removeListener: (listener: ActivatedListener) => {
            activated.delete(listener);
          },
        },
        onUpdated: {
          addListener: (listener: UpdatedListener) => {
            updated.add(listener);
          },
          removeListener: (listener: UpdatedListener) => {
            updated.delete(listener);
          },
        },
      },
    },
    activate: (activeInfo: { tabId: number; windowId?: number }) => {
      for (const listener of activated) {
        listener(activeInfo);
      }
    },
    update: (
      tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: { id?: number; active?: boolean; windowId?: number }
    ) => {
      for (const listener of updated) {
        listener(tabId, changeInfo, tab);
      }
    },
  };
}

type Scope = Parameters<typeof subscribeActiveTabChange>[1];

describe("subscribeActiveTabChange", () => {
  it("refreshes when the analyst switches to a different tab", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    subscribeActiveTabChange(onChange, fake.scope as unknown as Scope);

    fake.activate({ tabId: 7 });
    fake.activate({ tabId: 9 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("de-duplicates repeated activations of the same tab", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    subscribeActiveTabChange(onChange, fake.scope as unknown as Scope);

    fake.activate({ tabId: 7 });
    fake.activate({ tabId: 7 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the active tab finishes navigating in place", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    subscribeActiveTabChange(onChange, fake.scope as unknown as Scope);

    fake.update(
      7,
      { status: "complete", url: "https://example.com/a" },
      { id: 7, active: true, windowId: 1 }
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores in-progress updates and background-tab navigations", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    subscribeActiveTabChange(onChange, fake.scope as unknown as Scope);

    // Still loading.
    fake.update(7, { status: "loading" }, { id: 7, active: true, windowId: 1 });
    // Completed but not the active tab.
    fake.update(
      8,
      { status: "complete", url: "https://background.example" },
      { id: 8, active: false, windowId: 1 }
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("de-duplicates the burst of onUpdated events Chrome fires per navigation", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    subscribeActiveTabChange(onChange, fake.scope as unknown as Scope);

    const tab = { id: 7, active: true, windowId: 1 };
    const changeInfo = { status: "complete", url: "https://example.com/a" };
    fake.update(7, changeInfo, tab);
    fake.update(7, changeInfo, tab);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes both listeners when unsubscribed", () => {
    const fake = createFakeTabsScope();
    const onChange = vi.fn();

    const unsubscribe = subscribeActiveTabChange(
      onChange,
      fake.scope as unknown as Scope
    );
    unsubscribe();

    expect(fake.activated.size).toBe(0);
    expect(fake.updated.size).toBe(0);
    fake.activate({ tabId: 3 });
    fake.update(
      3,
      { status: "complete", url: "x" },
      { id: 3, active: true, windowId: 1 }
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is an inert no-op when the runtime has no tabs events", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeActiveTabChange(onChange, {} as unknown as Scope);

    expect(() => unsubscribe()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
