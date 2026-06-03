/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED } from "./highlightStorage";
import {
  DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS,
  isMutationRescanActive,
  scheduleDebouncedRescan,
  setupDebouncedMutationRescan,
  teardownDebouncedMutationRescan,
} from "./mutationRescan";

describe("debounced mutation rescan stub", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({ [CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]: true }),
        },
      },
    });
    teardownDebouncedMutationRescan();
  });

  afterEach(() => {
    teardownDebouncedMutationRescan();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not observe when disabled", () => {
    const teardown = setupDebouncedMutationRescan({ enabled: false });
    teardown();
    expect(isMutationRescanActive()).toBe(false);
  });

  it("debounces scheduled rescans into one scan", async () => {
    const onScan = vi.fn();
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    const paragraph = document.createElement("p");
    paragraph.textContent = "8.8.8.8";
    root.appendChild(paragraph);

    setupDebouncedMutationRescan({
      enabled: true,
      debounceMs: DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS,
      root,
      onScan,
    });

    scheduleDebouncedRescan();
    scheduleDebouncedRescan();
    vi.advanceTimersByTime(DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS - 1);
    expect(onScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(onScan).toHaveBeenCalledTimes(1);
    });
    expect(onScan.mock.calls[0]?.[0]).toMatchObject({
      ok: true,
      payload: { count: expect.any(Number) },
    });
  });

  it("coalesces rapid reschedule bursts", async () => {
    const onScan = vi.fn();
    const root = document.createElement("div");
    document.body.replaceChildren(root);

    setupDebouncedMutationRescan({
      enabled: true,
      debounceMs: 200,
      root,
      onScan,
    });

    for (let index = 0; index < 5; index += 1) {
      scheduleDebouncedRescan();
      if (index < 4) {
        vi.advanceTimersByTime(50);
      }
    }

    vi.advanceTimersByTime(199);
    expect(onScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(onScan).toHaveBeenCalledTimes(1);
    });
  });

  it("routes mutation observer callbacks through debounced rescan", async () => {
    const callbacks: MutationCallback[] = [];
    class MockMutationObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: MutationCallback) {
        callbacks.push(callback);
      }
    }
    vi.stubGlobal("MutationObserver", MockMutationObserver);

    const onScan = vi.fn();
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    const paragraph = document.createElement("p");
    paragraph.textContent = "192.0.2.1";
    root.appendChild(paragraph);

    setupDebouncedMutationRescan({
      enabled: true,
      debounceMs: DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS,
      root,
      onScan,
    });

    expect(callbacks).toHaveLength(1);
    callbacks[0]?.([], {} as MutationObserver);
    vi.advanceTimersByTime(DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS);
    await vi.waitFor(() => {
      expect(onScan).toHaveBeenCalledTimes(1);
    });
  });

  it("cancels pending rescans on teardown", () => {
    const onScan = vi.fn();
    setupDebouncedMutationRescan({ enabled: true, onScan });
    scheduleDebouncedRescan();
    teardownDebouncedMutationRescan();
    vi.advanceTimersByTime(DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("skips rescans when the current domain is denylisted", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () =>
            Promise.resolve({
              domainDenylist: ["blocked.example.com"],
            }),
        },
      },
    });
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "blocked.example.com" },
    });

    const onScan = vi.fn();
    const root = document.createElement("div");
    document.body.replaceChildren(root);

    setupDebouncedMutationRescan({
      enabled: true,
      debounceMs: DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS,
      root,
      onScan,
    });

    scheduleDebouncedRescan();
    vi.advanceTimersByTime(DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(onScan).not.toHaveBeenCalled();
  });
});
