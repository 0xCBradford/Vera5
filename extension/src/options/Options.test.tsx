/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY_ENRICHMENT_CACHE } from "../lib/cache";
import { serializeSettingsPack } from "../lib/settingsPack";
import { serializeOperatorMacroPack } from "../lib/operatorMacro";
import { STORAGE_KEY_OPERATOR_MACROS } from "../lib/operatorMacroStorage";
import { STORAGE_KEY_API_KEYS, createDefaultVera5Settings } from "../lib/storage";
import { STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "../lib/storage";
import {
  STORAGE_KEY_INSTALL_QUICK_START_COMPLETED,
  STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_MANUAL_ONLY_MODE,
  STORAGE_KEY_QUIET_MODE,
  STORAGE_KEY_ANALYST_MODE_PRESET_ID,
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
  STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
} from "../lib/storage";
import { PAGE_CONTEXT_TYPE } from "../lib/pageContext";
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
    expect(
      mounted.container.querySelector('input[aria-label="Enable RDAP/WHOIS"]')
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
    await vi.waitFor(() => {
      expect(attributeToggle.disabled).toBe(false);
    });
    await act(async () => {
      attributeToggle.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });
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

  it("persists page context site mode overrides from Trust section", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Treat this site as");

    const hostInput = mounted.container.querySelector(
      'input[aria-label="Page context override hostname"]'
    ) as HTMLInputElement;
    const typeSelect = mounted.container.querySelector(
      'select[aria-label="Page context override type"]'
    ) as HTMLSelectElement;
    const addButton = mounted.container.querySelector(
      'button[aria-label="Add page context site override"]'
    ) as HTMLButtonElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(hostInput, "splunk.example.com");
      hostInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      typeSelect.value = PAGE_CONTEXT_TYPE.CTI_PLATFORM;
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]).toEqual({
      "splunk.example.com": PAGE_CONTEXT_TYPE.CTI_PLATFORM,
    });
    expect(mounted.container.textContent).toContain("splunk.example.com");
    expect(mounted.container.textContent).toContain("CTI platform");
  });

  it("clears all page context site overrides from Trust section", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const hostInput = mounted.container.querySelector(
      'input[aria-label="Page context override hostname"]'
    ) as HTMLInputElement;
    const addButton = mounted.container.querySelector(
      'button[aria-label="Add page context site override"]'
    ) as HTMLButtonElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(hostInput, "splunk.example.com");
      hostInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(
        mounted.container.querySelector(
          'button[aria-label="Clear all page context site overrides"]'
        )
      ).not.toBeNull();
    });

    const clearAllButton = mounted.container.querySelector(
      'button[aria-label="Clear all page context site overrides"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clearAllButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]).toEqual({});
    expect(mounted.container.textContent).not.toContain("splunk.example.com");
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

  it("enables RDAP/WHOIS without an API key and persists the toggle", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const rdapToggle = mounted.container.querySelector(
      'input[aria-label="Enable RDAP/WHOIS"]'
    ) as HTMLInputElement;
    expect(rdapToggle).not.toBeNull();
    expect(rdapToggle.checked).toBe(false);

    await act(async () => {
      rdapToggle.click();
      await Promise.resolve();
    });

    expect(rdapToggle.checked).toBe(true);
    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toEqual(
      expect.objectContaining({ rdap_whois: true })
    );

    const rdapSource = Array.from(
      mounted.container.querySelectorAll(".v5-source")
    ).find((element) => element.textContent?.includes("RDAP/WHOIS"));

    expect(rdapSource?.textContent).toContain("No API key required");
    expect(rdapSource?.querySelector(".v5-badge")?.textContent).toContain(
      "Enabled"
    );
  });

  it("does not show RDAP/WHOIS in the API keys section", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('input[aria-label="RDAP/WHOIS API key"]')
    ).toBeNull();
    expect(
      mounted.container.querySelector('input[aria-label="Enable RDAP/WHOIS"]')
    ).not.toBeNull();
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

  it("exports settings pack JSON without API keys from options", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };

    const createObjectURL = vi.fn(() => "blob:settings-pack");
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
      'button[aria-label="Export settings pack JSON"]'
    ) as HTMLButtonElement;

    await act(async () => {
      exportButton.click();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const exportedJson = await blob.text();
    const parsed = JSON.parse(exportedJson) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe(1);
    expect(exportedJson).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(parsed.apiKeys).toBeUndefined();
    expect(mounted.container.textContent).toContain("Settings pack exported.");

    clickSpy.mockRestore();
  });

  it("exports threat profile JSON without API keys from options", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };

    const createObjectURL = vi.fn(() => "blob:threat-profile");
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
      'button[aria-label="Export threat profile JSON"]'
    ) as HTMLButtonElement;

    await act(async () => {
      exportButton.click();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const exportedJson = await blob.text();
    const parsed = JSON.parse(exportedJson) as Record<string, unknown>;

    expect(parsed.threatProfileSchemaVersion).toBe(1);
    expect(parsed.id).toBe("active");
    expect(exportedJson).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(parsed.apiKeys).toBeUndefined();
    expect(mounted.container.textContent).toContain("Threat profile exported.");

    clickSpy.mockRestore();
  });

  it("imports a valid threat profile and rejects files with key-like fields", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };
    store[STORAGE_KEY_QUIET_MODE] = false;

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector(
        'button[aria-label="Import threat profile JSON"]'
      )
    ).not.toBeNull();

    const fileInput = mounted.container.querySelector(
      'input[aria-label="Import threat profile JSON file"]'
    ) as HTMLInputElement;

    const validProfile = JSON.stringify({
      threatProfileSchemaVersion: 1,
      quietModeDefault: true,
    });
    const validFile = new File([validProfile], "vera5-threat-profile.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [validFile],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    expect(mounted.container.textContent).toContain("Review threat profile import");
    expect(mounted.container.textContent).toContain(
      "Warning: This profile can change enabled connectors, export templates, and analyst modes"
    );
    expect(mounted.container.textContent).toContain(
      "It does not import or change your API keys."
    );
    expect(mounted.container.textContent).toContain("Merge into current settings");
    expect(mounted.container.textContent).toContain("Apply as new active profile");
    expect(mounted.container.textContent).toContain("Quiet mode");
    expect(mounted.container.textContent).toContain("Disabled → Enabled");

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply threat profile import"]'
    ) as HTMLButtonElement;

    await act(async () => {
      applyButton.click();
    });

    await vi.waitFor(() => {
      expect(store[STORAGE_KEY_QUIET_MODE]).toBe(true);
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    expect(mounted.container.textContent).toContain("Threat profile imported.");

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Active threat profile:");
      expect(mounted!.container.textContent).toContain("Last imported:");
      expect(mounted!.container.textContent).not.toContain(
        "Active threat profile: No imported profile"
      );
    });

    const secretProfile = JSON.stringify({
      threatProfileSchemaVersion: 1,
      quietModeDefault: false,
      apiKey: "leaked-key",
    });
    const secretFile = new File([secretProfile], "bad-profile.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [secretFile],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain(
        "Could not import threat profile. Check the file and try again."
      );
    });

    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(true);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });

  it("shows empty active threat profile indicator before import", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain(
        "Active threat profile: No imported profile"
      );
      expect(mounted!.container.textContent).toContain("Last imported: Never");
    });
  });

  it("offers Apply Malware Research built-in profile and opens the review dialog", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply Malware Research built-in threat profile"]'
    ) as HTMLButtonElement;
    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    expect(mounted.container.textContent).toContain("Review threat profile import");
    expect(mounted.container.textContent).toContain("Apply as new active profile");
    expect(
      (
        mounted.container.querySelector(
          'input[aria-label="Apply as new active profile"]'
        ) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it("offers Apply SOC Triage built-in profile and opens the review dialog", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply SOC Triage built-in threat profile"]'
    ) as HTMLButtonElement;
    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    expect(mounted.container.textContent).toContain("Review threat profile import");
    expect(
      (
        mounted.container.querySelector(
          'input[aria-label="Apply as new active profile"]'
        ) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it("offers Apply CTI Hunting built-in profile and opens the review dialog", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply CTI Hunting built-in threat profile"]'
    ) as HTMLButtonElement;
    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    expect(mounted.container.textContent).toContain("Review threat profile import");
    expect(
      (
        mounted.container.querySelector(
          'input[aria-label="Apply as new active profile"]'
        ) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it("applies threat profile as new active from the review dialog", async () => {
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };
    store[STORAGE_KEY_QUIET_MODE] = true;
    store[STORAGE_KEY_ANALYST_MODE_PRESET_ID] = "cti";
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = {
      ...createDefaultVera5Settings().enrichmentSourceEnabled,
      abuseipdb: true,
      otx: true,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const fileInput = mounted.container.querySelector(
      'input[aria-label="Import threat profile JSON file"]'
    ) as HTMLInputElement;

    const profileJson = JSON.stringify({
      threatProfileSchemaVersion: 1,
      quietModeDefault: false,
      enabledConnectors: ["otx"],
    });
    const file = new File([profileJson], "profile.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    const applyAsNewRadio = mounted.container.querySelector(
      'input[aria-label="Apply as new active profile"]'
    ) as HTMLInputElement;

    await act(async () => {
      applyAsNewRadio.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("AbuseIPDB enabled");
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply threat profile import"]'
    ) as HTMLButtonElement;

    await act(async () => {
      applyButton.click();
    });

    await vi.waitFor(() => {
      expect(store[STORAGE_KEY_QUIET_MODE]).toBe(false);
    });

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    const enabled = store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] as Record<
      string,
      boolean
    >;
    expect(enabled.otx).toBe(true);
    expect(enabled.abuseipdb).toBe(false);
    expect(mounted.container.textContent).toContain("Threat profile imported.");
  });

  it("does not enable connectors when threat profile import is canceled", async () => {
    const beforeEnabled = {
      ...createDefaultVera5Settings().enrichmentSourceEnabled,
      abuseipdb: false,
      otx: false,
    };
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = beforeEnabled;
    store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES] = true;
    store[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = false;

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const fileInput = mounted.container.querySelector(
      'input[aria-label="Import threat profile JSON file"]'
    ) as HTMLInputElement;

    const profileJson = JSON.stringify({
      threatProfileSchemaVersion: 1,
      enabledConnectors: ["abuseipdb", "otx"],
      quietModeDefault: true,
    });
    const file = new File([profileJson], "profile.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    expect(mounted.container.textContent).toContain(
      "Warning: This profile can change enabled connectors"
    );

    const cancelButton = Array.from(
      mounted.container.querySelectorAll(".v5-consent-dialog__actions .v5-btn")
    ).find((button) => button.textContent === "Cancel") as HTMLButtonElement;

    await act(async () => {
      cancelButton.click();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.querySelector('[role="dialog"]')).toBeNull();
    });

    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toEqual(beforeEnabled);
    expect(store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]).toBe(true);
    expect(store[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]).toBe(false);
  });

  it("renders settings pack import control", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector(
        'button[aria-label="Import settings pack JSON"]'
      )
    ).not.toBeNull();
  });

  it("shows a diff preview and applies pack import after confirmation", async () => {
    store[STORAGE_KEY_MANUAL_ONLY_MODE] = true;
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };

    const packJson = serializeSettingsPack({
      ...createDefaultVera5Settings(),
      manualOnlyMode: false,
    });

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const fileInput = mounted.container.querySelector(
      'input[aria-label="Import settings pack JSON file"]'
    ) as HTMLInputElement;
    const file = new File([packJson], "vera5-settings-pack.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mounted.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mounted.container.textContent).toContain("Review settings pack import");
    expect(mounted.container.textContent).toContain("Manual-only enrichment");
    expect(mounted.container.textContent).toContain("Enabled → Disabled");
    expect(mounted.container.textContent).toContain(
      "the threat profile wins for overlapping workflow fields"
    );

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply settings pack import"]'
    ) as HTMLButtonElement;

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(false);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    expect(mounted.container.textContent).toContain("Settings pack imported.");
    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes the diff preview without applying when canceled", async () => {
    store[STORAGE_KEY_MANUAL_ONLY_MODE] = true;

    const packJson = serializeSettingsPack({
      ...createDefaultVera5Settings(),
      manualOnlyMode: false,
    });

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const fileInput = mounted.container.querySelector(
      'input[aria-label="Import settings pack JSON file"]'
    ) as HTMLInputElement;
    const file = new File([packJson], "vera5-settings-pack.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = mounted.container.querySelector(
      '[aria-labelledby="settings-pack-import-title"]'
    );
    const cancelButton = dialog?.querySelector(
      ".v5-consent-dialog__actions .v5-btn:not(.v5-btn--primary)"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      cancelButton?.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(true);
    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
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

describe("Options quiet mode controls", () => {
  let store: Record<string, unknown>;
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    store = {
      [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]: true,
      [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: true,
      [STORAGE_KEY_INSTALL_QUICK_START_COMPLETED]: true,
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

  it("renders quiet mode toggle with blocked and allowed guidance", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Quiet mode");
    expect(mounted.container.textContent).toContain("Blocked while on:");
    expect(mounted.container.textContent).toContain("Still available:");
    expect(mounted.container.textContent).toContain("attributed pivot links");

    const toggle = mounted.container.querySelector(
      'input[aria-label="Quiet mode"]'
    ) as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(false);
  });

  it("reflects quiet mode on from storage", async () => {
    store[STORAGE_KEY_QUIET_MODE] = true;

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const toggle = mounted.container.querySelector(
      'input[aria-label="Quiet mode"]'
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("persists quiet mode when toggled on", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const toggle = mounted.container.querySelector(
      'input[aria-label="Quiet mode"]'
    ) as HTMLInputElement;
    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(true);
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
    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(false);
  });

  it("applies DFIR analyst workflow preset with quiet mode on", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
    });

    const applyButton = mounted.container.querySelector(
      'button[aria-label="Apply DFIR investigation preset"]'
    ) as HTMLButtonElement;

    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_ANALYST_MODE_PRESET_ID]).toBe("dfir");
    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(true);
  });
});

describe("Options operator macros", () => {
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

  async function openOperatorMacrosSection(): Promise<ParentNode> {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const navButton = [...mounted.container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Operator Macros"
    );
    expect(navButton).toBeDefined();

    await act(async () => {
      navButton!.click();
      await Promise.resolve();
    });

    const sectionToggle = mounted.container.querySelector(
      "#operator-macros-heading button"
    ) as HTMLButtonElement | null;
    expect(sectionToggle).not.toBeNull();

    await act(async () => {
      sectionToggle!.click();
      await Promise.resolve();
    });

    return mounted.container;
  }

  it("renders built-in macros in the operator macros section", async () => {
    const container = await openOperatorMacrosSection();
    expect(container.textContent).toContain("CTI Deep Check");
    expect(container.textContent).toContain("DFIR Triage");
    expect(container.textContent).toContain("Built-in");
  });

  it("creates, duplicates, and deletes a user macro", async () => {
    const container = await openOperatorMacrosSection();

    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create macro"
    ) as HTMLButtonElement;
    expect(createButton).toBeDefined();

    await act(async () => {
      createButton.click();
      await Promise.resolve();
    });

    const nameInput = container.querySelector(
      "#operator-macro-name"
    ) as HTMLInputElement;
    const idInput = container.querySelector(
      "#operator-macro-id"
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    expect(idInput).not.toBeNull();

    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await act(async () => {
      setInputValue(nameInput, "Ticket export");
      setInputValue(idInput, "ticket-export");
      await Promise.resolve();
    });

    const saveButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save macro"
    ) as HTMLButtonElement;
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ticket export");
    expect(container.textContent).toContain("ticket-export");
    expect(container.textContent).toContain("1 step");

    const editButton = [...container.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Edit Ticket export"
    ) as HTMLButtonElement;
    expect(editButton).toBeDefined();

    await act(async () => {
      editButton.click();
      await Promise.resolve();
    });

    const addStepButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add step"
    ) as HTMLButtonElement;
    expect(addStepButton).toBeDefined();

    await act(async () => {
      addStepButton.click();
      await Promise.resolve();
    });

    const saveAfterStepsButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save macro"
    ) as HTMLButtonElement;
    expect(saveAfterStepsButton).toBeDefined();

    await act(async () => {
      saveAfterStepsButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("2 steps");

    const duplicateButton = [...container.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Duplicate Ticket export"
    ) as HTMLButtonElement;
    expect(duplicateButton).toBeDefined();

    await act(async () => {
      duplicateButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ticket export (copy)");

    const deleteButton = [...container.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Delete Ticket export"
    ) as HTMLButtonElement;
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      [...container.querySelectorAll("code")].some((node) => node.textContent === "ticket-export")
    ).toBe(false);
    expect(container.textContent).toContain("ticket-export-copy");
  });

  it("blocks save when a note template step has empty text", async () => {
    const container = await openOperatorMacrosSection();

    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create macro"
    ) as HTMLButtonElement;
    expect(createButton).toBeDefined();

    await act(async () => {
      createButton.click();
      await Promise.resolve();
    });

    const nameInput = container.querySelector(
      "#operator-macro-name"
    ) as HTMLInputElement;
    const idInput = container.querySelector(
      "#operator-macro-id"
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    expect(idInput).not.toBeNull();

    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await act(async () => {
      setInputValue(nameInput, "Note macro");
      setInputValue(idInput, "note-macro");
      await Promise.resolve();
    });

    const stepTypeSelect = container.querySelector(
      '[aria-label="Step type to add"]'
    ) as HTMLSelectElement;
    expect(stepTypeSelect).not.toBeNull();

    await act(async () => {
      stepTypeSelect.value = "applyNoteTemplate";
      stepTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    const addStepButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add step"
    ) as HTMLButtonElement;
    expect(addStepButton).toBeDefined();

    await act(async () => {
      addStepButton.click();
      await Promise.resolve();
    });

    const noteTemplateTextarea = container.querySelector(
      'textarea[id$="-note-template-text"]'
    ) as HTMLTextAreaElement;
    expect(noteTemplateTextarea).not.toBeNull();

    const setTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await act(async () => {
      setTextareaValue(noteTemplateTextarea, "   ");
      await Promise.resolve();
    });

    const saveButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save macro"
    ) as HTMLButtonElement;
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("has invalid parameters");
    expect(
      [...container.querySelectorAll("code")].some((node) => node.textContent === "note-macro")
    ).toBe(false);
  });

  it("renders macro pack export and import controls", async () => {
    const container = await openOperatorMacrosSection();
    expect(
      container.querySelector('button[aria-label="Export user macro pack JSON"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Import user macro pack JSON"]')
    ).not.toBeNull();
    expect(container.textContent).toContain(
      "Built-in playbooks and API keys are never included"
    );
  });

  it("shows a preview and applies macro pack import after confirmation", async () => {
    const packJson = serializeOperatorMacroPack([
      {
        schemaVersion: 1,
        id: "imported-pack-macro",
        name: "Imported pack macro",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "Portable",
          builtIn: false,
          tags: [],
          updatedAt: 1,
        },
      },
    ]);

    const container = await openOperatorMacrosSection();
    const fileInput = container.querySelector(
      'input[aria-label="Import user macro pack JSON file"]'
    ) as HTMLInputElement;
    const file = new File([packJson], "vera5-operator-macros.json", {
      type: "application/json",
    });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Review macro pack import");
    expect(container.textContent).toContain("Imported pack macro");
    expect(container.textContent).toContain("imported-pack-macro");

    const applyButton = container.querySelector(
      'button[aria-label="Apply macro pack import"]'
    ) as HTMLButtonElement;

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stored = store[STORAGE_KEY_OPERATOR_MACROS] as {
      macros: Array<{ id: string }>;
    };
    expect(stored.macros.some((macro) => macro.id === "imported-pack-macro")).toBe(
      true
    );
    expect(container.textContent).toContain("Imported user macros");
  });
});

describe("Options cross-session correlation controls", () => {
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

  it("renders retention, overlap, and clear-all correlation controls", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Cross-session correlation");
    expect(
      mounted.container.querySelector(
        'input[aria-label="Correlation cluster retention window in days"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'select[aria-label="Correlation cluster overlap merge mode"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Clear all correlation clusters"]')
    ).not.toBeNull();
  });

  it("renders relationship memory retention control", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Relationship memory");
    expect(
      mounted.container.querySelector(
        'input[aria-label="Relationship memory retention window in days"]'
      )
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Clear all relationship memory"]')
    ).not.toBeNull();
  });

  it("loads stored relationship retention window into Options", async () => {
    const { STORAGE_KEY_RELATIONSHIP_EDGES } = await import("../lib/relationshipEdgeStorage");
    store[STORAGE_KEY_RELATIONSHIP_EDGES] = {
      schemaVersion: 1,
      updatedAt: Date.now(),
      edges: [],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: "off",
      retentionDays: 45,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = mounted.container.querySelector(
      'input[aria-label="Relationship memory retention window in days"]'
    ) as HTMLInputElement;
    expect(input.value).toBe("45");
  });

  it("clears relationship memory after confirmation and preserves retention", async () => {
    const { STORAGE_KEY_RELATIONSHIP_EDGES } = await import("../lib/relationshipEdgeStorage");
    const { createRelationshipEdge, RELATIONSHIP_TYPE } = await import(
      "../lib/relationshipEdge"
    );
    const nowMs = Date.UTC(2026, 6, 22);
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["a", "b"],
      firstSeen: nowMs - 1_000,
      lastSeen: nowMs - 500,
      weight: 2,
    });
    store[STORAGE_KEY_RELATIONSHIP_EDGES] = {
      schemaVersion: 1,
      updatedAt: nowMs,
      edges: [edge],
      minCoOccurrenceCount: 3,
      knownGoodPolicy: "exclude",
      retentionDays: 45,
    };

    const confirmSpy = vi.fn(() => true);
    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: confirmSpy,
    });

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const clearButton = mounted.container.querySelector(
      'button[aria-label="Clear all relationship memory"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clearButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(confirmSpy).toHaveBeenCalled();
    const afterClear = store[STORAGE_KEY_RELATIONSHIP_EDGES] as {
      edges: unknown[];
      retentionDays: number;
      minCoOccurrenceCount: number;
      knownGoodPolicy: string;
    };
    expect(afterClear.edges).toEqual([]);
    expect(afterClear.retentionDays).toBe(45);
    expect(afterClear.minCoOccurrenceCount).toBe(3);
    expect(afterClear.knownGoodPolicy).toBe("exclude");
    expect(mounted.container.textContent).toContain("Relationship memory cleared");
  });

  it("does not clear relationship memory when confirmation is cancelled", async () => {
    const { STORAGE_KEY_RELATIONSHIP_EDGES } = await import("../lib/relationshipEdgeStorage");
    const { createRelationshipEdge, RELATIONSHIP_TYPE } = await import(
      "../lib/relationshipEdge"
    );
    const nowMs = Date.UTC(2026, 6, 22);
    const edge = createRelationshipEdge({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:keep.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["a", "b"],
      firstSeen: nowMs - 1_000,
      lastSeen: nowMs - 500,
      weight: 2,
    });
    store[STORAGE_KEY_RELATIONSHIP_EDGES] = {
      schemaVersion: 1,
      updatedAt: nowMs,
      edges: [edge],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: "off",
      retentionDays: 90,
    };

    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: vi.fn(() => false),
    });

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const clearButton = mounted.container.querySelector(
      'button[aria-label="Clear all relationship memory"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clearButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterCancel = store[STORAGE_KEY_RELATIONSHIP_EDGES] as {
      edges: unknown[];
    };
    expect(afterCancel.edges).toHaveLength(1);
    expect(mounted.container.textContent).not.toContain("Relationship memory cleared");
  });

  it("persists retention window and clears stored clusters", async () => {
    const { STORAGE_KEY_CORRELATION_CLUSTERS } = await import(
      "../lib/correlationClusterStorage"
    );
    const { createCorrelationCluster, CORRELATION_CLUSTER_SCHEMA_VERSION } = await import(
      "../lib/correlationCluster"
    );
    const { buildIocCoOccurrenceMemberKey } = await import("../lib/iocCoOccurrence");
    const { IOC_TYPE } = await import("../lib/iocRegex");

    const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
    const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a", "session-b"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });
    store[STORAGE_KEY_CORRELATION_CLUSTERS] = {
      schemaVersion: 1,
      updatedAt: 1,
      clusters: [{ ...cluster, schemaVersion: CORRELATION_CLUSTER_SCHEMA_VERSION }],
      retentionDays: 30,
      overlapMerge: { mode: "jaccard", jaccardThreshold: 0.75, minSharedIocCount: 2 },
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const retentionInput = mounted.container.querySelector(
      'input[aria-label="Correlation cluster retention window in days"]'
    ) as HTMLInputElement;
    expect(retentionInput.value).toBe("30");

    const modeSelect = mounted.container.querySelector(
      'select[aria-label="Correlation cluster overlap merge mode"]'
    ) as HTMLSelectElement;
    expect(modeSelect.value).toBe("jaccard");

    const clearButton = mounted.container.querySelector(
      'button[aria-label="Clear all correlation clusters"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clearButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterClear = store[STORAGE_KEY_CORRELATION_CLUSTERS] as {
      clusters: unknown[];
      retentionDays: number;
      overlapMerge: { jaccardThreshold?: number } | null;
    };
    expect(afterClear.clusters).toEqual([]);
    expect(afterClear.retentionDays).toBe(30);
    expect(afterClear.overlapMerge?.jaccardThreshold).toBe(0.75);
    expect(mounted.container.textContent).toContain("Correlation clusters cleared");
  });

  it("persists Jaccard overlap mode from Options", async () => {
    const { STORAGE_KEY_CORRELATION_CLUSTERS } = await import(
      "../lib/correlationClusterStorage"
    );

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const modeSelect = mounted.container.querySelector(
      'select[aria-label="Correlation cluster overlap merge mode"]'
    ) as HTMLSelectElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      setter?.call(modeSelect, "jaccard");
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector(
        'input[aria-label="Correlation cluster Jaccard overlap threshold"]'
      )
    ).not.toBeNull();

    const stored = store[STORAGE_KEY_CORRELATION_CLUSTERS] as {
      overlapMerge: { mode: string; jaccardThreshold: number } | null;
    };
    expect(stored.overlapMerge?.mode).toBe("jaccard");
    expect(stored.overlapMerge?.jaccardThreshold).toBe(0.5);
  });
});

describe("Options noise rules controls", () => {
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

  it("renders human-readable noise rules without hidden weight vectors", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-options-ui",
      patternType: "exact",
      pattern: "noise.example",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_000,
      hitCount: 3,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain("Noise rules");
    expect(mounted.container.textContent).toContain("no hidden weight vectors");
    expect(mounted.container.textContent).toContain("Suppress false positive");
    expect(mounted.container.textContent).toContain("Exact match");
    expect(mounted.container.textContent).toContain("Pattern: noise.example");
    expect(mounted.container.textContent).toContain("Hits: 3");
    expect(mounted.container.textContent).toContain("Id: nr-options-ui");
    expect(mounted.container.textContent).toContain("no hidden weight vectors");
    expect(mounted.container.textContent).not.toMatch(/\bWeight:\b/);
    expect(mounted.container.textContent).toContain("Status: Enabled");
    expect(
      mounted.container.querySelector('input[aria-label="Search noise rules"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Edit: noise.example"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Delete: noise.example"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector('button[aria-label="Export rules JSON"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("team handoff");
    expect(mounted.container.textContent).toContain("never API keys");
    expect(
      mounted.container.querySelector('button[aria-label="Import rules JSON/CSV"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'button[aria-label="Import SOC dashboard starter"]'
      )
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Optional");
    expect(mounted.container.textContent).toContain(
      "examples/soc-dashboard-noise-starter.json"
    );
    expect(
      mounted.container.querySelector('button[aria-label="Clear all noise rules"]')
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(
        'button[aria-label="Preview noise rule matches on sample alert without mutating a live page"]'
      )
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("examples/sample-alert.html");
    expect(
      mounted.container.querySelector(
        'button[aria-label="Undo last learned noise rule"]'
      )
    ).not.toBeNull();
  });

  it("previews sample-alert matches offline without mutating a live page", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-preview-ui",
      patternType: "exact",
      pattern: "8.8.8.8",
      sourceAction: "benign",
      createdAt: 1_700_000_000_000,
      hitCount: 0,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };

    const bodyMarker = document.createElement("div");
    bodyMarker.id = "live-page-marker";
    bodyMarker.textContent = "untouched-live-page";
    document.body.appendChild(bodyMarker);

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const previewButton = mounted.container.querySelector(
      'button[aria-label="Preview noise rule matches on sample alert without mutating a live page"]'
    ) as HTMLButtonElement | null;
    expect(previewButton).not.toBeNull();

    await act(async () => {
      previewButton!.click();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain(
      "1 of 11 sample-alert indicators would be suppressed"
    );
    expect(mounted.container.textContent).toContain("8.8.8.8");
    expect(mounted.container.textContent).toContain("examples/sample-alert.html");
    expect(mounted.container.textContent).toContain(
      "Does not open, scan, or change any live page"
    );
    expect(
      mounted.container.querySelector(
        '[aria-label="Sample alert indicators matching noise rules"]'
      )
    ).not.toBeNull();
    expect(document.getElementById("live-page-marker")?.textContent).toBe(
      "untouched-live-page"
    );
    expect(document.body.contains(bodyMarker)).toBe(true);

    const clearPreview = mounted.container.querySelector(
      'button[aria-label="Clear preview"]'
    ) as HTMLButtonElement | null;
    expect(clearPreview).not.toBeNull();
    await act(async () => {
      clearPreview!.click();
      await Promise.resolve();
    });
    expect(
      mounted.container.querySelector(
        '[aria-label="Sample alert indicators matching noise rules"]'
      )
    ).toBeNull();
    expect(document.getElementById("live-page-marker")?.textContent).toBe(
      "untouched-live-page"
    );
    bodyMarker.remove();
  });

  it("undoes the last learned noise rule in a single step from Options", async () => {
    const {
      STORAGE_KEY_NOISE_RULES,
      STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO,
    } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const keep = createNoiseRule({
      id: "nr-keep-undo",
      patternType: "exact",
      pattern: "keep.example",
      sourceAction: "internal",
      createdAt: 1_700_000_000_000,
      hitCount: 0,
    });
    const learned = createNoiseRule({
      id: "nr-last-learned",
      patternType: "exact",
      pattern: "learned.example",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_001,
      hitCount: 0,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [
        { ...keep, schemaVersion: NOISE_RULE_SCHEMA_VERSION },
        { ...learned, schemaVersion: NOISE_RULE_SCHEMA_VERSION },
      ],
    };
    store[STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO] = {
      ...learned,
      schemaVersion: NOISE_RULE_SCHEMA_VERSION,
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const undoButton = mounted.container.querySelector(
      'button[aria-label="Undo last learned noise rule"]'
    ) as HTMLButtonElement;
    expect(undoButton).not.toBeNull();
    expect(undoButton.disabled).toBe(false);

    await act(async () => {
      undoButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mounted.container.textContent).toContain(
      "Undid learned rule for learned.example."
    );
    expect(mounted.container.textContent).not.toContain("Pattern: learned.example");
    expect(mounted.container.textContent).toContain("Pattern: keep.example");
    expect(store[STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO]).toBeUndefined();
    expect(
      (store[STORAGE_KEY_NOISE_RULES] as { rules: Array<{ id: string }> }).rules.map(
        (rule) => rule.id
      )
    ).toEqual(["nr-keep-undo"]);
    expect(undoButton.disabled).toBe(true);
  });

  it("searches, edits, disables, and deletes a noise rule in Options", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const keep = createNoiseRule({
      id: "nr-keep",
      patternType: "exact",
      pattern: "keep.example",
      sourceAction: "internal",
      createdAt: 1_700_000_000_000,
      hitCount: 0,
    });
    const editMe = createNoiseRule({
      id: "nr-edit",
      patternType: "exact",
      pattern: "edit.example",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_001,
      hitCount: 1,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [
        { ...keep, schemaVersion: NOISE_RULE_SCHEMA_VERSION },
        { ...editMe, schemaVersion: NOISE_RULE_SCHEMA_VERSION },
      ],
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const search = mounted.container.querySelector(
      'input[aria-label="Search noise rules"]'
    ) as HTMLInputElement;
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(search, "edit.example");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("edit.example");
      expect(mounted!.container.textContent).not.toContain("Pattern: keep.example");
    });

    const editButton = mounted!.container.querySelector(
      'button[aria-label="Edit: edit.example"]'
    ) as HTMLButtonElement;
    await act(async () => {
      editButton.click();
      await Promise.resolve();
    });

    const patternInput = mounted!.container.querySelector(
      'input[aria-label="Edit pattern for nr-edit"]'
    ) as HTMLInputElement;
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(patternInput, "edited.example");
      patternInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = mounted!.container.querySelector(
      'button[aria-label="Save rule: nr-edit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Noise rule saved");
    });

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(search, "");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("edited.example");
      expect(mounted!.container.textContent).toContain("keep.example");
    });

    const enableToggle = mounted!.container.querySelector(
      'input[aria-label="Enabled: edited.example"]'
    ) as HTMLInputElement;
    await act(async () => {
      enableToggle.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Status: Disabled");
    });

    vi.stubGlobal("confirm", () => true);
    const deleteButton = mounted!.container.querySelector(
      'button[aria-label="Delete: edited.example"]'
    ) as HTMLButtonElement;
    await act(async () => {
      deleteButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(mounted!.container.textContent).not.toContain("edited.example");
      expect(mounted!.container.textContent).toContain("keep.example");
      expect(mounted!.container.textContent).toContain("Noise rule deleted");
    });
  });

  it("imports the SOC dashboard starter list from Options on demand", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const starterButton = mounted.container.querySelector(
      'button[aria-label="Import SOC dashboard starter"]'
    ) as HTMLButtonElement;
    await act(async () => {
      starterButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Review noise rules import");
      expect(mounted!.container.textContent).toContain("Add only");
    });

    const applyButton = mounted!.container.querySelector(
      'button[aria-label="Apply import"]'
    ) as HTMLButtonElement;
    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toMatch(/Imported \d+/);
      expect(mounted!.container.textContent).toContain("8.8.8.8");
      expect(mounted!.container.textContent).toContain("10.0.0.0/8");
    });
  });

  it("exports noise rules JSON for team handoff without API keys", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-export-ui",
      patternType: "exact",
      pattern: "handoff.example",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_000,
      hitCount: 1,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: "should-not-appear-in-noise-export",
    };

    const createObjectURL = vi.fn(() => "blob:noise-rules");
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
      await Promise.resolve();
    });

    const exportButton = mounted.container.querySelector(
      'button[aria-label="Export rules JSON"]'
    ) as HTMLButtonElement;
    await act(async () => {
      exportButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const text = await blob.text();
    expect(text).toContain("handoff.example");
    expect(text).not.toContain("should-not-appear-in-noise-export");
    expect(text).not.toMatch(/apiKey|api_key|abuseipdb/i);
    expect(mounted.container.textContent).toContain("Noise rules exported");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("exports known-good list JSON for team handoff without API keys", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");

    const entry = createKnownGoodEntry({
      id: "kg-export-ui",
      category: "cdn",
      matchType: "domain",
      pattern: "cdn.handoff.example",
      labelText: "Known benign",
    });
    store[STORAGE_KEY_KNOWN_GOOD_LIST] = {
      schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      entries: [entry],
    };
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: "should-not-appear-in-known-good-export",
    };

    const createObjectURL = vi.fn(() => "blob:known-good");
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
      await Promise.resolve();
    });

    const exportButton = mounted.container.querySelector(
      'button[aria-label="Export list JSON"]'
    ) as HTMLButtonElement;
    expect(exportButton).not.toBeNull();
    await act(async () => {
      exportButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const text = await blob.text();
    expect(text).toContain("cdn.handoff.example");
    expect(text).not.toContain("should-not-appear-in-known-good-export");
    expect(text).not.toMatch(/apiKey|api_key|abuseipdb/i);
    expect(mounted.container.textContent).toContain("Known-good list exported");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("toggles known-good category matching and edits or deletes entries", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");

    const entry = createKnownGoodEntry({
      id: "kg-options-edit",
      category: "cdn",
      matchType: "domain",
      pattern: "edit.example",
      labelText: "Known benign",
    });
    store[STORAGE_KEY_KNOWN_GOOD_LIST] = {
      schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      entries: [entry],
      categoryEnabled: {
        cdn: true,
        saas: true,
        corp_vpn: true,
        vuln_scanner: true,
        internal: true,
      },
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      mounted.container.querySelector('[data-known-good-entry-id="kg-options-edit"]')
    ).not.toBeNull();

    const skipEnrichToggle = mounted.container.querySelector(
      'input[aria-label="Skip outbound vendor enrich on known-good match"]'
    ) as HTMLInputElement;
    expect(skipEnrichToggle).not.toBeNull();
    expect(skipEnrichToggle.checked).toBe(false);
    await act(async () => {
      skipEnrichToggle.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(skipEnrichToggle.checked).toBe(true);
    const { STORAGE_KEY_SKIP_ENRICH_ON_KNOWN_GOOD_MATCH } = await import(
      "../lib/storage"
    );
    expect(store[STORAGE_KEY_SKIP_ENRICH_ON_KNOWN_GOOD_MATCH]).toBe(true);

    const cdnToggle = mounted.container.querySelector(
      'input[aria-label="Match this category: CDN"]'
    ) as HTMLInputElement;
    expect(cdnToggle).not.toBeNull();
    expect(cdnToggle.checked).toBe(true);
    await act(async () => {
      cdnToggle.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(cdnToggle.checked).toBe(false);
    expect(mounted.container.textContent).toContain("CDN matching disabled");

    const editButton = mounted.container.querySelector(
      'button[aria-label="Edit kg-options-edit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      editButton.click();
      await Promise.resolve();
    });
    const patternInput = mounted.container.querySelector(
      'input[aria-label="Edit pattern for kg-options-edit"]'
    ) as HTMLInputElement;
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(patternInput, "edited.example");
      patternInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
    const saveButton = mounted.container.querySelector(
      'button[aria-label="Save kg-options-edit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mounted.container.textContent).toContain("edited.example");
    expect(mounted.container.textContent).toContain("Known-good entry saved");

    const deleteButton = mounted.container.querySelector(
      'button[aria-label="Delete kg-options-edit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      deleteButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      mounted.container.querySelector('[data-known-good-entry-id="kg-options-edit"]')
    ).toBeNull();
    expect(mounted.container.textContent).toContain("Known-good entry deleted");
  });

  it("imports noise rules JSON from Options with duplicate skip feedback", async () => {
    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = mounted.container.querySelector(
      'input[aria-label="Import noise rules JSON or CSV file"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          rules: [
            {
              patternType: "exact",
              pattern: "import.example",
              sourceAction: "suppress",
            },
            {
              patternType: "exact",
              pattern: "import.example",
              sourceAction: "suppress",
            },
          ],
        }),
      ],
      "vera5-noise-rules.json",
      { type: "application/json" }
    );

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Review noise rules import");
      expect(mounted!.container.textContent).toContain("Duplicates skipped");
    });

    const applyButton = mounted!.container.querySelector(
      'button[aria-label="Apply import"]'
    ) as HTMLButtonElement;
    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Imported 1");
      expect(mounted!.container.textContent).toContain("1 duplicate");
      expect(mounted!.container.textContent).toContain("Pattern: import.example");
    });
  });

  it("requires confirmation before replace-all noise rules import", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-replace-ui",
      patternType: "exact",
      pattern: "old.example",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_000,
      hitCount: 0,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = mounted.container.querySelector(
      'input[aria-label="Import noise rules JSON or CSV file"]'
    ) as HTMLInputElement;
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          rules: [
            {
              patternType: "exact",
              pattern: "fresh.example",
              sourceAction: "benign",
            },
          ],
        }),
      ],
      "replace-noise.json",
      { type: "application/json" }
    );

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Review noise rules import");
    });

    const replaceRadio = mounted!.container.querySelector(
      'input[aria-label="Replace all stored rules"]'
    ) as HTMLInputElement;
    await act(async () => {
      replaceRadio.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Will remove stored");
    });

    const applyButton = mounted!.container.querySelector(
      'button[aria-label="Apply import"]'
    ) as HTMLButtonElement;
    expect(applyButton.disabled).toBe(true);

    const confirm = mounted!.container.querySelector(
      'input[aria-label="I understand this removes all currently stored noise rules and replaces them with this import."]'
    ) as HTMLInputElement;
    await act(async () => {
      confirm.click();
      await Promise.resolve();
    });
    expect(applyButton.disabled).toBe(false);

    await act(async () => {
      applyButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("Replaced 1");
      expect(mounted!.container.textContent).toContain("fresh.example");
      expect(mounted!.container.textContent).not.toContain("Pattern: old.example");
    });
  });

  it("clears stored noise rules from Options", async () => {
    const { STORAGE_KEY_NOISE_RULES } = await import("../lib/noiseRuleStorage");
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-clear-ui",
      patternType: "exact",
      pattern: "clear.me",
      sourceAction: "benign",
      createdAt: 1_700_000_000_000,
      hitCount: 0,
    });
    store[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: 1,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };

    mounted = renderOptions();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const clearButton = mounted.container.querySelector(
      'button[aria-label="Clear all noise rules"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clearButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store[STORAGE_KEY_NOISE_RULES]).toBeUndefined();
    expect(mounted.container.textContent).toContain("Noise rules cleared");
    expect(mounted.container.textContent).toContain("No noise rules yet");
  });
});
