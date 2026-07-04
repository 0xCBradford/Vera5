/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_QUIET_MODE_BANNER_MESSAGE,
  POPUP_QUIET_MODE_STATUS_LABEL,
  STORAGE_KEY_QUIET_MODE,
} from "../lib/storage";
import { VERA5_UI_STYLE_ID } from "../lib/vera5UiStyles";
import {
  getCachedQuietModeActive,
  getQuietModeBannerHost,
  QUIET_MODE_BANNER_CLASS,
  QUIET_MODE_BANNER_HOST_ID,
  QUIET_MODE_BANNER_LABEL_CLASS,
  QUIET_MODE_BANNER_MESSAGE_CLASS,
  renderQuietModeBanner,
  setupQuietModeBannerStorageListener,
  syncQuietModeBannerWithStorage,
} from "./quietModeBanner";

const getQuietMode = vi.fn(async () => false);

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getQuietMode: (...args: unknown[]) => getQuietMode(...args),
  };
});

describe("renderQuietModeBanner", () => {
  afterEach(() => {
    getQuietMode.mockResolvedValue(false);
    document.body.replaceChildren();
    document.getElementById(VERA5_UI_STYLE_ID)?.remove();
  });

  it("renders a fixed top banner when quiet mode is active", () => {
    renderQuietModeBanner(true);

    const host = getQuietModeBannerHost();
    expect(host).not.toBeNull();
    expect(host?.getAttribute("role")).toBe("status");
    expect(host?.getAttribute("aria-live")).toBe("polite");
    expect(host?.querySelector(`.${QUIET_MODE_BANNER_CLASS}`)).not.toBeNull();
    expect(host?.querySelector(`.${QUIET_MODE_BANNER_LABEL_CLASS}`)?.textContent).toBe(
      POPUP_QUIET_MODE_STATUS_LABEL
    );
    expect(host?.querySelector(`.${QUIET_MODE_BANNER_MESSAGE_CLASS}`)?.textContent).toBe(
      PAGE_QUIET_MODE_BANNER_MESSAGE
    );
    expect(document.getElementById(VERA5_UI_STYLE_ID)).not.toBeNull();
    expect(getCachedQuietModeActive()).toBe(true);
  });

  it("removes the banner when quiet mode is off", () => {
    renderQuietModeBanner(true);
    expect(getQuietModeBannerHost()).not.toBeNull();

    renderQuietModeBanner(false);
    expect(getQuietModeBannerHost()).toBeNull();
    expect(getCachedQuietModeActive()).toBe(false);
  });

  it("does not duplicate the banner when render is called twice", () => {
    renderQuietModeBanner(true);
    renderQuietModeBanner(true);

    expect(document.querySelectorAll(`#${QUIET_MODE_BANNER_HOST_ID}`)).toHaveLength(1);
  });
});

describe("syncQuietModeBannerWithStorage", () => {
  afterEach(() => {
    getQuietMode.mockResolvedValue(false);
    document.body.replaceChildren();
  });

  it("shows the banner when storage reports quiet mode on", async () => {
    getQuietMode.mockResolvedValue(true);
    await syncQuietModeBannerWithStorage();
    expect(getQuietModeBannerHost()).not.toBeNull();
  });

  it("hides the banner when storage reports quiet mode off", async () => {
    renderQuietModeBanner(true);
    getQuietMode.mockResolvedValue(false);
    await syncQuietModeBannerWithStorage();
    expect(getQuietModeBannerHost()).toBeNull();
  });
});

describe("setupQuietModeBannerStorageListener", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("updates the banner when quiet mode changes in storage", () => {
    let listener:
      | ((
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: string
        ) => void)
      | undefined;

    vi.stubGlobal("chrome", {
      storage: {
        onChanged: {
          addListener: (fn: typeof listener) => {
            listener = fn;
          },
        },
      },
    });

    setupQuietModeBannerStorageListener();
    expect(listener).toBeDefined();

    renderQuietModeBanner(false);
    listener!(
      {
        [STORAGE_KEY_QUIET_MODE]: {
          oldValue: false,
          newValue: true,
        },
      },
      "local"
    );
    expect(getQuietModeBannerHost()).not.toBeNull();

    listener!(
      {
        [STORAGE_KEY_QUIET_MODE]: {
          oldValue: true,
          newValue: false,
        },
      },
      "local"
    );
    expect(getQuietModeBannerHost()).toBeNull();
  });
});
