/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED } from "./autoScanStorage";
import {
  isAutoScanAllowedForCurrentPage,
  isCurrentPageAllowedByDomainPolicy,
  isEnrichmentAllowedForCurrentPage,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
} from "./domainPolicyStorage";

describe("domain policy content gates", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "soc.example.com" },
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("auto-scan per domain policy", () => {
    it("returns false when auto-scan is disabled", async () => {
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = false;
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(false);
    });

    it("returns false on denylisted hosts when auto-scan is enabled", async () => {
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_DENYLIST] = ["soc.example.com"];
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(false);
    });

    it("returns true on allowed hosts when auto-scan is enabled", async () => {
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(true);
    });

    it("returns false outside the allowlist in deny-by-default mode", async () => {
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
      store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["mail.example.com"];
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(false);
    });

    it("returns true on allowlisted hosts in deny-by-default mode", async () => {
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
      store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["soc.example.com"];
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(true);
    });

    it("blocks default webmail hosts via shipped denylist patterns", async () => {
      Object.defineProperty(document, "location", {
        configurable: true,
        value: { hostname: "mail.google.com" },
      });
      store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
      await expect(isCurrentPageAllowedByDomainPolicy()).resolves.toBe(false);
      await expect(isAutoScanAllowedForCurrentPage()).resolves.toBe(false);
    });
  });

  describe("enrichment per domain policy", () => {
    it("blocks enrichment on denylisted hosts when the enrich gate is enabled", async () => {
      Object.defineProperty(document, "location", {
        configurable: true,
        value: { hostname: "mail.example.com" },
      });
      store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_DENYLIST] = ["mail.example.com"];
      await expect(isEnrichmentAllowedForCurrentPage()).resolves.toBe(false);
    });

    it("allows enrichment on denylisted hosts when the enrich gate is disabled", async () => {
      Object.defineProperty(document, "location", {
        configurable: true,
        value: { hostname: "mail.example.com" },
      });
      store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = false;
      store[STORAGE_KEY_DOMAIN_DENYLIST] = ["mail.example.com"];
      await expect(isEnrichmentAllowedForCurrentPage()).resolves.toBe(true);
    });

    it("blocks enrichment outside the allowlist in deny-by-default mode", async () => {
      store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
      store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["mail.example.com"];
      await expect(isEnrichmentAllowedForCurrentPage()).resolves.toBe(false);
    });

    it("allows enrichment on allowlisted hosts in deny-by-default mode", async () => {
      store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
      store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
      store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["soc.example.com"];
      await expect(isEnrichmentAllowedForCurrentPage()).resolves.toBe(true);
    });
  });
});
