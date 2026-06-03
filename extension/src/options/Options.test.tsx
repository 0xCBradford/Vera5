/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY_ENRICHMENT_CACHE } from "../lib/cache";
import { STORAGE_KEY_API_KEYS } from "../lib/storage";
import {
  STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
} from "../lib/storage";
import { IOC_TYPE_SETTINGS_ORDER } from "../lib/storage";
import { Options } from "./Options";

const IOC_TYPE_OPTION_LABELS: Record<
  (typeof IOC_TYPE_SETTINGS_ORDER)[number],
  string
> = {
  ipv4: "IPv4 addresses",
  domain: "Domain names",
  url: "URLs",
  md5: "MD5 hashes",
  sha1: "SHA1 hashes",
  sha256: "SHA256 hashes",
  cve: "CVE identifiers",
};

function renderOptions(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<Options />);
  });
  return { container, root };
}

describe("Options API key inputs", () => {
  let store: Record<string, unknown>;
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[] | Record<string, unknown>) => {
            const keyList = Array.isArray(keys)
              ? keys
              : typeof keys === "string"
                ? [keys]
                : Object.keys(keys);
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(store, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete store[key];
            }
            return Promise.resolve();
          },
        },
      },
    });
  });

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.unstubAllGlobals();
  });

  it("renders per-source enable toggles", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('input[aria-label="Enable AbuseIPDB"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable OTX"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable URLScan.io"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable GreyNoise"]')
    ).not.toBeNull();
  });

  it("renders the manual-only enrichment toggle", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const manualOnlyToggle = mounted.container.querySelector(
      'input[aria-label="Manual-only enrichment"]'
    );
    expect(manualOnlyToggle).not.toBeNull();
    expect((manualOnlyToggle as HTMLInputElement).checked).toBe(true);
  });

  it("renders the auto-scan toggle", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const autoScanToggle = mounted.container.querySelector(
      'input[aria-label="Automatically scan when the page changes"]'
    );
    expect(autoScanToggle).not.toBeNull();
    expect(autoScanToggle?.getAttribute("type")).toBe("checkbox");
  });

  it("renders per-type IOC detection toggles", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    for (const iocType of IOC_TYPE_SETTINGS_ORDER) {
      expect(
        mounted.container.querySelector(
          `input[aria-label="Enable ${IOC_TYPE_OPTION_LABELS[iocType]}"]`
        )
      ).not.toBeNull();
    }
  });

  it("renders private IPv4 and cache TTL controls", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector(
        'input[aria-label="Include private-space IPv4 addresses"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="Default cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="AbuseIPDB cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="OTX cache lifetime in seconds"]'
      )
    ).not.toBeNull();
  });

  it("renders masked inputs for AbuseIPDB and OTX", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const abuseInput = mounted.container.querySelector(
      'input[aria-label="AbuseIPDB API key"]'
    );
    const otxInput = mounted.container.querySelector(
      'input[aria-label="OTX API key"]'
    );

    expect(abuseInput).not.toBeNull();
    expect(otxInput).not.toBeNull();
    expect(abuseInput?.getAttribute("type")).toBe("password");
    expect(otxInput?.getAttribute("type")).toBe("password");
    expect(abuseInput?.getAttribute("autocomplete")).toBe("off");
    expect(otxInput?.getAttribute("autocomplete")).toBe("off");
  });

  it("persists a newly entered API key on blur", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const abuseInput = mounted.container.querySelector(
      'input[aria-label="AbuseIPDB API key"]'
    ) as HTMLInputElement;

    await act(async () => {
      abuseInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(abuseInput, "fresh-abuse-key");
      abuseInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      abuseInput.blur();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: "fresh-abuse-key",
    });
    expect(mounted.container.textContent).toContain("Saved locally.");
  });

  it("loads stored keys as masked previews only", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: "abuse-secret",
      otx: "otx-secret",
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const abuseInput = mounted.container.querySelector(
      'input[aria-label="AbuseIPDB API key"]'
    ) as HTMLInputElement;
    const otxInput = mounted.container.querySelector(
      'input[aria-label="OTX API key"]'
    ) as HTMLInputElement;

    expect(abuseInput.value).toBe("••••••••cret");
    expect(abuseInput.value).not.toContain("abuse");
    expect(otxInput.value).toBe("••••••••cret");
    expect(otxInput.value).not.toBe("otx-secret");
    expect(mounted.container.textContent).toContain(
      "Only the last four characters are shown"
    );
  });

  it("renders a clear cache control", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('button[aria-label="Clear enrichment cache"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Enrichment cache");
  });

  it("clears enrichment cache when the button is clicked", async () => {
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "185.220.101.4|abuseipdb": {
        fetchedAt: Date.now(),
        payload: { summary: "cached" },
      },
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const clearButton = mounted.container.querySelector(
      'button[aria-label="Clear enrichment cache"]'
    ) as HTMLButtonElement;

    await act(async () => {
      clearButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toBeUndefined();
    expect(mounted.container.textContent).toContain("Enrichment cache cleared.");
  });

  it("renders settings export and import controls", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('button[aria-label="Export settings JSON"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Import settings JSON"]')
    ).not.toBeNull();
    const includeKeysToggle = mounted.container.querySelector(
      'input[aria-label="Include API keys in export"]'
    ) as HTMLInputElement;
    expect(includeKeysToggle).not.toBeNull();
    expect(includeKeysToggle.checked).toBe(false);
  });

  it("exports settings without API keys by default", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: "stored-secret",
    };

    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const exportButton = mounted.container.querySelector(
      'button[aria-label="Export settings JSON"]'
    ) as HTMLButtonElement;

    await act(async () => {
      exportButton.click();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const exportedJson = await blob.text();
    expect(exportedJson).not.toContain("stored-secret");
    expect(exportedJson).not.toContain('"apiKeys"');
    expect(mounted.container.textContent).toContain("Settings exported.");

    clickSpy.mockRestore();
  });
});

describe("Options pre-query notice preference", () => {
  let store: Record<string, unknown>;
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[] | Record<string, unknown>) => {
            const keyList = Array.isArray(keys)
              ? keys
              : typeof keys === "string"
                ? [keys]
                : Object.keys(keys);
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(store, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete store[key];
            }
            return Promise.resolve();
          },
        },
      },
    });
  });

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.unstubAllGlobals();
  });

  it("renders first-run pre-query notice choice when preference is unset", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Pre-query notices");
    expect(
      mounted.container.querySelector('button[type="button"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Show pre-query notices");
    expect(mounted.container.textContent).toContain("Skip pre-query notices");
  });

  it("persists first-run choice and hides the prompt", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const skipButton = Array.from(
      mounted.container.querySelectorAll("button")
    ).find((button) => button.textContent === "Skip pre-query notices");

    expect(skipButton).not.toBeUndefined();

    await act(async () => {
      skipButton?.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]).toBe(false);
    expect(store[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]).toBe(true);
    expect(mounted.container.textContent).not.toContain(
      "Skip pre-query notices"
    );

    const toggle = mounted.container.querySelector(
      'input[aria-label="Show pre-query notices"]'
    ) as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(false);
  });

  it("renders trust section toggle when preference is already configured", async () => {
    store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES] = true;
    store[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED] = true;

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).not.toContain(
      "Skip pre-query notices"
    );
    expect(mounted.container.textContent).toContain("Trust & consent");

    const toggle = mounted.container.querySelector(
      'input[aria-label="Show pre-query notices"]'
    ) as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);
  });
});
