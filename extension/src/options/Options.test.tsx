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
  STORAGE_KEY_INSTALL_QUICK_START_COMPLETED,
  STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_ANALYST_MODE_PRESET_ID,
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
} from "../lib/storage";
import { IOC_TYPE_SETTINGS_ORDER } from "../lib/storage";
import { DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES } from "../lib/domainPolicy";
import {
  TEST_FIXTURE_ABUSEIPDB_API_KEY,
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_GREYNOISE_API_KEY,
  TEST_FIXTURE_OTX_API_KEY,
  TEST_FIXTURE_SECONDARY_API_KEY,
  TEST_FIXTURE_STORED_API_KEY,
  TEST_FIXTURE_URLSCAN_API_KEY,
} from "../lib/fixtureSecrets";
import { ENRICHMENT_SOURCE_OPS_POPUP_GUIDANCE } from "../lib/enrichmentSourceOps";
import { maskApiKeyForDisplay } from "../lib/storage";
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
  email: "Email addresses",
  asn: "ASNs",
  cidr: "IPv4 CIDR ranges",
  filepath: "File paths",
  onion: "Onion domains",
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
    expect(
      mounted.container.querySelector('input[aria-label="Enable VirusTotal"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable Shodan"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable Censys"]')
    ).not.toBeNull();
  });

  it("points source health to the popup instead of a duplicate panel", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain(
      ENRICHMENT_SOURCE_OPS_POPUP_GUIDANCE
    );
    expect(mounted.container.textContent).not.toContain(
      "Source health monitoring coming soon."
    );
    expect(
      mounted.container.querySelectorAll(".v5-source__health").length
    ).toBe(0);
    expect(mounted.container.textContent).not.toContain("Last status:");
    expect(mounted.container.textContent).not.toContain("Vendor quota:");
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

  it("renders the attribute href extraction toggle off by default", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const attributeToggle = mounted.container.querySelector(
      'input[aria-label="Scan link attributes for IOCs"]'
    );
    expect(attributeToggle).not.toBeNull();
    expect((attributeToggle as HTMLInputElement).checked).toBe(false);
  });

  it("shows first-enable consent before turning on attribute href extraction", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const attributeToggle = mounted.container.querySelector(
      'input[aria-label="Scan link attributes for IOCs"]'
    ) as HTMLInputElement;
    attributeToggle.click();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('[role="dialog"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain(
      "Enable link attribute scanning?"
    );
    expect(
      mounted.container.querySelector(
        'a[href*="docs/security-model.md#opt-in-attribute-and-href-extraction"]'
      )
    ).not.toBeNull();
    expect(attributeToggle.checked).toBe(false);

    const cancelButton = Array.from(
      mounted.container.querySelectorAll("button")
    ).find((button) => button.textContent === "Cancel");
    cancelButton?.click();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
    expect(attributeToggle.checked).toBe(false);
  });

  it("enables attribute href extraction after consent confirmation", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const attributeToggle = mounted.container.querySelector(
      'input[aria-label="Scan link attributes for IOCs"]'
    ) as HTMLInputElement;
    attributeToggle.click();
    await act(async () => {
      await Promise.resolve();
    });

    const confirmButton = Array.from(
      mounted.container.querySelectorAll("button")
    ).find((button) => button.textContent === "Enable attribute scan");
    confirmButton?.click();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
    expect(attributeToggle.checked).toBe(true);
    expect(store.attributeHrefExtractionEnabled).toBe(true);
    expect(store.attributeHrefExtractionConsentAcknowledged).toBe(true);
  });

  it("can opt into per-site remember from the first-enable consent dialog", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const attributeToggle = mounted.container.querySelector(
      'input[aria-label="Scan link attributes for IOCs"]'
    ) as HTMLInputElement;
    attributeToggle.click();
    await act(async () => {
      await Promise.resolve();
    });

    const rememberCheckbox = mounted.container.querySelector(
      ".v5-consent-dialog__remember input"
    ) as HTMLInputElement;
    rememberCheckbox.click();

    const confirmButton = Array.from(
      mounted.container.querySelectorAll("button")
    ).find((button) => button.textContent === "Enable attribute scan");
    confirmButton?.click();
    await act(async () => {
      await Promise.resolve();
    });

    expect(store.attributeHrefExtractionRememberSiteChoices).toBe(true);
    const rememberToggle = mounted.container.querySelector(
      'input[aria-label="Remember per-site attribute scan choices"]'
    ) as HTMLInputElement;
    expect(rememberToggle.checked).toBe(true);
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
    expect(
      mounted.container.querySelector(
        'input[aria-label="URLScan.io cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="GreyNoise cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="VirusTotal cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="Shodan cache lifetime in seconds"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="Censys cache lifetime in seconds"]'
      )
    ).not.toBeNull();
  });

  it("renders masked inputs for live enrichment API keys", async () => {
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
    const urlscanInput = mounted.container.querySelector(
      'input[aria-label="URLScan.io API key"]'
    );
    const greynoiseInput = mounted.container.querySelector(
      'input[aria-label="GreyNoise API key"]'
    );

    expect(abuseInput).not.toBeNull();
    expect(otxInput).not.toBeNull();
    expect(urlscanInput).not.toBeNull();
    expect(greynoiseInput).not.toBeNull();
    expect(abuseInput?.getAttribute("type")).toBe("password");
    expect(otxInput?.getAttribute("type")).toBe("password");
    expect(urlscanInput?.getAttribute("type")).toBe("password");
    expect(greynoiseInput?.getAttribute("type")).toBe("password");
    expect(abuseInput?.getAttribute("autocomplete")).toBe("off");
    expect(otxInput?.getAttribute("autocomplete")).toBe("off");
    expect(urlscanInput?.getAttribute("autocomplete")).toBe("off");
    expect(greynoiseInput?.getAttribute("autocomplete")).toBe("off");
  });

  it("persists a newly entered URLScan.io API key on blur", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const urlscanInput = mounted.container.querySelector(
      'input[aria-label="URLScan.io API key"]'
    ) as HTMLInputElement;

    await act(async () => {
      urlscanInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(urlscanInput, "fresh-urlscan-key");
      urlscanInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      urlscanInput.blur();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      urlscan: "fresh-urlscan-key",
    });
  });

  it("shows URLScan.io source status when enabled without a saved key", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const urlscanToggle = mounted.container.querySelector(
      'input[aria-label="Enable URLScan.io"]'
    ) as HTMLInputElement;

    await act(async () => {
      urlscanToggle.click();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("No API key");
  });

  it("loads stored URLScan.io keys as masked previews only", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      urlscan: TEST_FIXTURE_URLSCAN_API_KEY,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const urlscanInput = mounted.container.querySelector(
      'input[aria-label="URLScan.io API key"]'
    ) as HTMLInputElement;

    expect(urlscanInput.value).toBe(
      maskApiKeyForDisplay(TEST_FIXTURE_URLSCAN_API_KEY)
    );
    expect(urlscanInput.value).not.toBe(TEST_FIXTURE_URLSCAN_API_KEY);
  });

  it("persists a newly entered GreyNoise API key on blur", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const greynoiseInput = mounted.container.querySelector(
      'input[aria-label="GreyNoise API key"]'
    ) as HTMLInputElement;

    await act(async () => {
      greynoiseInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(greynoiseInput, "fresh-greynoise-key");
      greynoiseInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      greynoiseInput.blur();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      greynoise: "fresh-greynoise-key",
    });
  });

  it("shows GreyNoise source status when enabled without a saved key", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const greynoiseToggle = mounted.container.querySelector(
      'input[aria-label="Enable GreyNoise"]'
    ) as HTMLInputElement;

    await act(async () => {
      greynoiseToggle.click();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("No API key");
  });

  it("loads stored GreyNoise keys as masked previews only", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      greynoise: TEST_FIXTURE_GREYNOISE_API_KEY,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const greynoiseInput = mounted.container.querySelector(
      'input[aria-label="GreyNoise API key"]'
    ) as HTMLInputElement;

    expect(greynoiseInput.value).toBe(
      maskApiKeyForDisplay(TEST_FIXTURE_GREYNOISE_API_KEY)
    );
    expect(greynoiseInput.value).not.toBe(TEST_FIXTURE_GREYNOISE_API_KEY);
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
      abuseipdb: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      otx: TEST_FIXTURE_OTX_API_KEY,
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

    expect(abuseInput.value).toBe(maskApiKeyForDisplay(TEST_FIXTURE_ABUSEIPDB_API_KEY));
    expect(abuseInput.value).not.toContain("abuse");
    expect(otxInput.value).toBe(maskApiKeyForDisplay(TEST_FIXTURE_OTX_API_KEY));
    expect(otxInput.value).not.toBe(TEST_FIXTURE_OTX_API_KEY);
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
    expect(mounted.container.textContent).toContain("Enrichment Cache");
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

  it("renders masked inputs and enable toggles for VirusTotal, Shodan, and Censys", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    for (const sourceLabel of ["VirusTotal", "Shodan", "Censys"] as const) {
      expect(
        mounted.container.querySelector(`input[aria-label="Enable ${sourceLabel}"]`)
      ).not.toBeNull();
      expect(
        mounted.container.querySelector(`input[aria-label="${sourceLabel} API key"]`)
      ).not.toBeNull();
    }

    const censysSecretInput = mounted.container.querySelector(
      'input[aria-label="Censys API secret API key"]'
    );
    expect(censysSecretInput).not.toBeNull();
    expect(censysSecretInput?.getAttribute("type")).toBe("password");
    expect(
      mounted.container.querySelector('input[aria-label="VirusTotal API key"]')?.getAttribute(
        "type"
      )
    ).toBe("password");
    expect(
      mounted.container.querySelector('input[aria-label="Shodan API key"]')?.getAttribute(
        "type"
      )
    ).toBe("password");
  });

  it("persists a newly entered Shodan API key on blur", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const shodanInput = mounted.container.querySelector(
      'input[aria-label="Shodan API key"]'
    ) as HTMLInputElement;

    await act(async () => {
      shodanInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(shodanInput, "fresh-shodan-key");
      shodanInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      shodanInput.blur();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      shodan: "fresh-shodan-key",
    });
  });

  it("persists the Censys credential pair on blur", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const censysIdInput = mounted.container.querySelector(
      'input[aria-label="Censys API key"]'
    ) as HTMLInputElement;
    const censysSecretInput = mounted.container.querySelector(
      'input[aria-label="Censys API secret API key"]'
    ) as HTMLInputElement;

    await act(async () => {
      censysIdInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(censysIdInput, "fresh-censys-id");
      censysIdInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      censysIdInput.blur();
      await Promise.resolve();
    });

    await act(async () => {
      censysSecretInput.focus();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(censysSecretInput, "fresh-censys-secret");
      censysSecretInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      censysSecretInput.blur();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      censys: "fresh-censys-id",
      censys_secret: "fresh-censys-secret",
    });
  });

  it("loads stored VirusTotal keys as masked previews only", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      virustotal: TEST_FIXTURE_GENERIC_API_KEY,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const vtInput = mounted.container.querySelector(
      'input[aria-label="VirusTotal API key"]'
    ) as HTMLInputElement;

    expect(vtInput.value).toBe(maskApiKeyForDisplay(TEST_FIXTURE_GENERIC_API_KEY));
    expect(vtInput.value).not.toBe(TEST_FIXTURE_GENERIC_API_KEY);
  });

  it("shows Shodan source status when enabled without a saved key", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const shodanToggle = mounted.container.querySelector(
      'input[aria-label="Enable Shodan"]'
    ) as HTMLInputElement;

    await act(async () => {
      shodanToggle.click();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("No API key");
  });

  it("shows Censys source status when enabled without the full credential pair", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      censys: TEST_FIXTURE_GENERIC_API_KEY,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const censysToggle = mounted.container.querySelector(
      'input[aria-label="Enable Censys"]'
    ) as HTMLInputElement;

    await act(async () => {
      censysToggle.click();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("No API key");
  });

  it("shows Censys as saved when enabled with both credential slots configured", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      censys: TEST_FIXTURE_GENERIC_API_KEY,
      censys_secret: TEST_FIXTURE_SECONDARY_API_KEY,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const censysToggle = mounted.container.querySelector(
      'input[aria-label="Enable Censys"]'
    ) as HTMLInputElement;

    await act(async () => {
      censysToggle.click();
      await Promise.resolve();
    });

    const censysSource = Array.from(
      mounted.container.querySelectorAll(".v5-source")
    ).find((element) => element.textContent?.includes("Censys"));

    expect(censysSource?.textContent).toContain("Saved");
    expect(censysSource?.textContent).not.toContain("No API key");
  });

  it("exports settings without API keys by default", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
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
    expect(exportedJson).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(exportedJson).not.toContain('"apiKeys"');
    expect(mounted.container.textContent).toContain("Settings exported.");

    clickSpy.mockRestore();
  });
});

function clickQuickStartContinue(container: ParentNode): void {
  const continueButton = Array.from(container.querySelectorAll("button")).find(
    (button) =>
      button.textContent === "Continue" ||
      button.textContent === "Continue without keys"
  );
  continueButton?.click();
}

async function advanceQuickStartToTrustStep(
  container: ParentNode
): Promise<void> {
  for (let step = 0; step < 3; step += 1) {
    await act(async () => {
      clickQuickStartContinue(container);
      await Promise.resolve();
    });
  }
}

describe("Options install quick start", () => {
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

  it("renders install quick start welcome when preference is unset", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Install quick start");
    expect(mounted.container.textContent).toContain("Welcome");
    expect(mounted.container.textContent).toContain("Continue");
    expect(mounted.container.textContent).not.toContain(
      "Skip pre-query notices"
    );
  });

  it("renders GreyNoise in install quick start API key step", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      clickQuickStartContinue(mounted!.container);
      await Promise.resolve();
    });

    expect(mounted!.container.textContent).toContain("GreyNoise");
    expect(
      mounted!.container.querySelector('input[aria-label="GreyNoise API key"]')
    ).not.toBeNull();
  });

  it("persists trust choice and hides the quick start flow", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    await advanceQuickStartToTrustStep(mounted.container);

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
    expect(store[STORAGE_KEY_INSTALL_QUICK_START_COMPLETED]).toBe(true);
    expect(mounted.container.textContent).not.toContain("Install quick start");
    expect(mounted.container.textContent).not.toContain(
      "Skip pre-query notices"
    );

    const toggle = mounted.container.querySelector(
      'input[aria-label="Show pre-query notices"]'
    ) as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(false);
  });

  it("renders trust section toggle when quick start is already completed", async () => {
    store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES] = true;
    store[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED] = true;
    store[STORAGE_KEY_INSTALL_QUICK_START_COMPLETED] = true;

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).not.toContain(
      "Skip pre-query notices"
    );
    expect(mounted.container.textContent).toContain("Trust & Consent");

    const toggle = mounted.container.querySelector(
      'input[aria-label="Show pre-query notices"]'
    ) as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);
  });
});

describe("Options domain policy controls", () => {
  let store: Record<string, unknown>;
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    store = {
      [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]: true,
      [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: true,
    };
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

  it("renders domain policy list editors and mode controls", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('input[aria-label="Denylist entry pattern"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Allowlist entry pattern"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'input[aria-label="Apply domain policy to live enrichment"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('input[name="domainPolicyMode"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Allow by default");
    expect(mounted.container.textContent).toContain("Deny by default");
    expect(mounted.container.textContent).toContain("Default-safe presets");
    expect(mounted.container.textContent).toContain("Sensitive sites denylist");
  });

  it("persists denylist entries when added from the Options UI", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const input = mounted.container.querySelector(
      'input[aria-label="Denylist entry pattern"]'
    ) as HTMLInputElement;
    const addButton = mounted.container.querySelector(
      'button[aria-label="Add domain to denylist"]'
    ) as HTMLButtonElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, " legacy.example.com ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_DOMAIN_DENYLIST]).toEqual([
      ...DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES,
      "legacy.example.com",
    ]);
    expect(mounted.container.textContent).toContain("legacy.example.com");
  });

  it("persists deny-by-default mode when selected", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const denyRadio = Array.from(
      mounted.container.querySelectorAll('input[name="domainPolicyMode"]')
    ).find(
      (input) =>
        (input as HTMLInputElement).checked === false &&
        input.parentElement?.textContent?.includes("Deny by default")
    ) as HTMLInputElement | undefined;

    expect(denyRadio).not.toBeUndefined();

    await act(async () => {
      denyRadio?.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_DOMAIN_POLICY_MODE]).toBe("deny_by_default");
  });

  it("removes allowlist entries when Remove is clicked", async () => {
    store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["soc.example.com", "lab.example.com"];

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const removeButton = mounted.container.querySelector(
      'button[aria-label="Remove soc.example.com from Allowlist"]'
    ) as HTMLButtonElement;

    await act(async () => {
      removeButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_DOMAIN_ALLOWLIST]).toEqual(["lab.example.com"]);
  });

  it("merges the sensitive sites denylist preset into storage", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply Sensitive sites denylist preset"]'
    ) as HTMLButtonElement;

    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_DOMAIN_POLICY_MODE]).toBe("allow_by_default");
    expect(store[STORAGE_KEY_DOMAIN_DENYLIST]).toEqual(
      expect.arrayContaining(["mail.*", "mail.google.com", "*.bank"])
    );
    expect(mounted.container.textContent).toContain("mail.*");
  });

  it("applies the SOC analyst workflow preset to storage", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply SOC triage preset"]'
    ) as HTMLButtonElement;

    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_ANALYST_MODE_PRESET_ID]).toBe("soc");
    expect(store[STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]).toBe("jira-comment");
    expect(store[STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS]).toEqual(
      expect.arrayContaining(["abuseipdb", "greynoise", "otx"])
    );
  });
});
