import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_SOURCE_ORDER } from "./enrichmentSourceRegistry";
import {
  API_KEY_SLOTS,
  createDefaultVera5Settings,
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  getApiKey,
  getAutoScanEnabled,
  getEnrichmentSourceEnabled,
  getManualOnlyMode,
  getPreQueryNoticePreferenceConfigured,
  getShowPreQueryNotices,
  getExtensionEnabled,
  getHighlightEnabled,
  getIncludePrivateIpv4,
  getVera5Settings,
  listDisabledEnrichmentSources,
  setAutoScanEnabled,
  setEnrichmentSourceEnabled,
  setEnrichmentCacheTtlSeconds,
  setIncludePrivateIpv4,
  setIocTypeEnabled,
  setManualOnlyMode,
  setPreQueryNoticePreference,
  STORAGE_KEY_MANUAL_ONLY_MODE,
  hasApiKey,
  isMaskedApiKeyDisplay,
  maskApiKeyForDisplay,
  setApiKey,
  IOC_TYPE_SETTINGS_ORDER,
  isApiKeysRecord,
  isEnrichmentSourceEnabledRecord,
  isIocTypeEnabledRecord,
  migrateVera5StorageRaw,
  needsStorageMigration,
  normalizeVera5Settings,
  SETTINGS_SCHEMA_VERSION,
  setEnrichmentSourceCacheTtlSeconds,
  setExtensionEnabled,
  setHighlightEnabled,
  vera5SettingsToStoragePayload,
  isEnrichmentSourceCacheTtlRecord,
  normalizeEnrichmentSourceCacheTtlRecord,
  STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_AUTO_SCAN_ENABLED,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_KEY_INCLUDE_PRIVATE_IPV4,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEYS,
  VERA5_SETTINGS_READ_KEYS,
  VERA5_SETTINGS_STORAGE_KEYS,
} from "./storage";

function stubChromeStorage(store: Record<string, unknown>): void {
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
      },
    },
  });
}

describe("extension enabled storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to enabled when unset", async () => {
    await expect(getExtensionEnabled()).resolves.toBe(true);
  });

  it("persists disabled state", async () => {
    await setExtensionEnabled(false);
    expect(store[STORAGE_KEY_EXTENSION_ENABLED]).toBe(false);
    await expect(getExtensionEnabled()).resolves.toBe(false);
  });

  it("persists enabled state", async () => {
    await setExtensionEnabled(true);
    await expect(getExtensionEnabled()).resolves.toBe(true);
  });
});

describe("auto scan storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled when unset", async () => {
    await expect(getAutoScanEnabled()).resolves.toBe(false);
  });

  it("persists enabled state", async () => {
    await setAutoScanEnabled(true);
    expect(store[STORAGE_KEY_AUTO_SCAN_ENABLED]).toBe(true);
    await expect(getAutoScanEnabled()).resolves.toBe(true);
  });
});

describe("enrichment source enabled storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults all sources to disabled", async () => {
    const sources = await getEnrichmentSourceEnabled();
    expect(sources).toEqual(createDefaultVera5Settings().enrichmentSourceEnabled);
  });

  it("persists a single source toggle", async () => {
    await setEnrichmentSourceEnabled("abuseipdb", true);
    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toMatchObject({
      abuseipdb: true,
    });
    await expect(getEnrichmentSourceEnabled()).resolves.toMatchObject({
      abuseipdb: true,
    });
  });

  it("persists a single IOC type toggle", async () => {
    await setIocTypeEnabled("ipv4", false);
    const settings = await getVera5Settings();
    expect(settings.iocTypeEnabled.ipv4).toBe(false);
    expect(settings.iocTypeEnabled.domain).toBe(true);
  });

  it("persists includePrivateIpv4", async () => {
    await setIncludePrivateIpv4(true);
    await expect(getIncludePrivateIpv4()).resolves.toBe(true);
  });

  it("persists global enrichment cache TTL", async () => {
    await setEnrichmentCacheTtlSeconds(7200);
    const settings = await getVera5Settings();
    expect(settings.enrichmentCacheTtlSeconds).toBe(7200);
  });

  it("lists disabled sources for connector gating", () => {
    const disabled = listDisabledEnrichmentSources({
      ...createDefaultVera5Settings().enrichmentSourceEnabled,
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: true,
    });
    expect(disabled).toContain("otx");
    expect(disabled).toContain("urlscan");
    expect(disabled).not.toContain("abuseipdb");
    expect(disabled).not.toContain("greynoise");
  });
});

describe("manual-only mode storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to enabled when unset", async () => {
    await expect(getManualOnlyMode()).resolves.toBe(true);
  });

  it("persists disabled state", async () => {
    await setManualOnlyMode(false);
    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(false);
    await expect(getManualOnlyMode()).resolves.toBe(false);
  });
});

describe("highlight enabled storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to enabled when unset", async () => {
    await expect(getHighlightEnabled()).resolves.toBe(true);
  });

  it("persists disabled state", async () => {
    await setHighlightEnabled(false);
    expect(store[STORAGE_KEY_HIGHLIGHT_ENABLED]).toBe(false);
    await expect(getHighlightEnabled()).resolves.toBe(false);
  });
});

describe("Vera5 settings schema", () => {
  it("declares a positive schema version", () => {
    expect(SETTINGS_SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("uses unique storage keys for each settings field", () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("lists required settings keys and optional read keys separately", () => {
    const optionalReadKeys = [STORAGE_KEY_ENRICHMENT_SOURCE_CACHE_TTL_SECONDS];
    const requiredKeys = Object.values(STORAGE_KEYS).filter(
      (key) => !optionalReadKeys.includes(key)
    );
    expect(VERA5_SETTINGS_STORAGE_KEYS).toEqual(requiredKeys);
    expect(VERA5_SETTINGS_READ_KEYS).toEqual([
      ...VERA5_SETTINGS_STORAGE_KEYS,
      ...optionalReadKeys,
    ]);
    expect(new Set(VERA5_SETTINGS_STORAGE_KEYS).size).toBe(
      VERA5_SETTINGS_STORAGE_KEYS.length
    );
  });

  it("covers enrichment API key storage slots", () => {
    expect(API_KEY_SLOTS).toEqual([
      ...ENRICHMENT_SOURCE_ORDER,
      "censys_secret",
    ]);
  });

  it("covers all MVP IOC types for toggle records", () => {
    expect(IOC_TYPE_SETTINGS_ORDER).toEqual([
      "ipv4",
      "domain",
      "url",
      "md5",
      "sha1",
      "sha256",
      "cve",
    ]);
  });

  it("validates api key records", () => {
    expect(isApiKeysRecord({ abuseipdb: "secret" })).toBe(true);
    expect(isApiKeysRecord({ abuseipdb: "secret", otx: "other" })).toBe(true);
    expect(isApiKeysRecord({})).toBe(true);
    expect(isApiKeysRecord(null)).toBe(false);
    expect(isApiKeysRecord([])).toBe(false);
    expect(isApiKeysRecord({ abuseipdb: 1 })).toBe(false);
    expect(isApiKeysRecord({ unknown: "secret" })).toBe(false);
  });

  it("validates enrichment source enabled records", () => {
    expect(isEnrichmentSourceEnabledRecord({ abuseipdb: true, otx: false })).toBe(
      true
    );
    expect(isEnrichmentSourceEnabledRecord({})).toBe(true);
    expect(isEnrichmentSourceEnabledRecord({ abuseipdb: "yes" })).toBe(false);
    expect(isEnrichmentSourceEnabledRecord({ virustotal: true })).toBe(true);
    expect(isEnrichmentSourceEnabledRecord({ unknown_source: true })).toBe(false);
  });

  it("validates IOC type enabled records", () => {
    expect(isIocTypeEnabledRecord({ ipv4: true, cve: false })).toBe(true);
    expect(isIocTypeEnabledRecord({})).toBe(true);
    expect(isIocTypeEnabledRecord({ ipv4: 1 })).toBe(false);
    expect(isIocTypeEnabledRecord({ email: true })).toBe(false);
  });

  it("validates optional per-source cache TTL records", () => {
    expect(isEnrichmentSourceCacheTtlRecord({ abuseipdb: 1800, otx: 600 })).toBe(
      true
    );
    expect(isEnrichmentSourceCacheTtlRecord({})).toBe(true);
    expect(isEnrichmentSourceCacheTtlRecord({ abuseipdb: -1 })).toBe(false);
    expect(isEnrichmentSourceCacheTtlRecord({ unknown: 60 })).toBe(false);
    expect(
      normalizeEnrichmentSourceCacheTtlRecord({ otx: 120.9, abuseipdb: 30 })
    ).toEqual({ otx: 120, abuseipdb: 30 });
  });
});

describe("migrate-safe defaults", () => {
  it("defines conservative product defaults", () => {
    const defaults = createDefaultVera5Settings();
    expect(defaults.extensionEnabled).toBe(true);
    expect(defaults.highlightEnabled).toBe(true);
    expect(defaults.settingsSchemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(defaults.autoScanEnabled).toBe(false);
    expect(defaults.manualOnlyMode).toBe(true);
    expect(defaults.includePrivateIpv4).toBe(false);
    expect(defaults.showPreQueryNotices).toBe(true);
    expect(defaults.preQueryNoticePreferenceConfigured).toBe(false);
    expect(defaults.domainPolicyMode).toBe("allow_by_default");
    expect(defaults.domainAllowlist).toEqual([]);
    expect(defaults.domainDenylist).toEqual([]);
    expect(defaults.domainPolicyEnrichGateEnabled).toBe(true);
    expect(defaults.enrichmentCacheTtlSeconds).toBe(
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS
    );
    expect(defaults.enrichmentSourceCacheTtlSeconds).toEqual({});
    expect(defaults.apiKeys).toEqual({});
    expect(defaults.enrichmentSourceEnabled).toEqual(
      createDefaultVera5Settings().enrichmentSourceEnabled
    );
    expect(defaults.showDisabledSourcesInWorkspace).toBe(false);
    expect(defaults.iocTypeEnabled).toEqual({
      ipv4: true,
      domain: true,
      url: true,
      md5: true,
      sha1: true,
      sha256: true,
      cve: true,
    });
  });

  it("preserves legacy extension and highlight flags", () => {
    const settings = normalizeVera5Settings({
      [STORAGE_KEY_EXTENSION_ENABLED]: false,
      [STORAGE_KEY_HIGHLIGHT_ENABLED]: true,
    });
    expect(settings.extensionEnabled).toBe(false);
    expect(settings.highlightEnabled).toBe(true);
    expect(settings.manualOnlyMode).toBe(true);
    expect(settings.iocTypeEnabled.ipv4).toBe(true);
  });

  it("drops invalid api key payloads during normalization", () => {
    const settings = normalizeVera5Settings({
      [STORAGE_KEY_API_KEYS]: { abuseipdb: 1 },
    });
    expect(settings.apiKeys).toEqual({});
  });

  it("merges partial IOC type toggles with defaults", () => {
    const settings = normalizeVera5Settings({
      [STORAGE_KEY_IOC_TYPE_ENABLED]: { ipv4: false },
    });
    expect(settings.iocTypeEnabled.ipv4).toBe(false);
    expect(settings.iocTypeEnabled.domain).toBe(true);
  });

  it("bumps schema version during migration", () => {
    const migrated = migrateVera5StorageRaw({
      [STORAGE_KEY_EXTENSION_ENABLED]: true,
    });
    expect(migrated[STORAGE_KEY_SCHEMA_VERSION]).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("detects when storage migration is required", () => {
    expect(needsStorageMigration({})).toBe(true);
    expect(
      needsStorageMigration({
        [STORAGE_KEY_SCHEMA_VERSION]: SETTINGS_SCHEMA_VERSION,
        [STORAGE_KEY_EXTENSION_ENABLED]: true,
        [STORAGE_KEY_HIGHLIGHT_ENABLED]: true,
        [STORAGE_KEY_AUTO_SCAN_ENABLED]: false,
        [STORAGE_KEY_MANUAL_ONLY_MODE]: true,
        [STORAGE_KEY_INCLUDE_PRIVATE_IPV4]: false,
        [STORAGE_KEY_API_KEYS]: {},
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]:
          createDefaultVera5Settings().enrichmentSourceEnabled,
        [STORAGE_KEY_SHOW_DISABLED_SOURCES_IN_WORKSPACE]: false,
        [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: true,
        [STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]: false,
        [STORAGE_KEY_DOMAIN_POLICY_MODE]: "allow_by_default",
        [STORAGE_KEY_DOMAIN_ALLOWLIST]: [],
        [STORAGE_KEY_DOMAIN_DENYLIST]: [],
        [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]: true,
        [STORAGE_KEY_IOC_TYPE_ENABLED]: {
          ipv4: true,
          domain: true,
          url: true,
          md5: true,
          sha1: true,
          sha256: true,
          cve: true,
        },
        [STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS]:
          DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
      })
    ).toBe(false);
    expect(
      needsStorageMigration({
        [STORAGE_KEY_API_KEYS]: { abuseipdb: 1 },
      })
    ).toBe(true);
  });
});

describe("getVera5Settings", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists migrated defaults for empty storage", async () => {
    const settings = await getVera5Settings();
    expect(settings.settingsSchemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(store[STORAGE_KEY_SCHEMA_VERSION]).toBe(SETTINGS_SCHEMA_VERSION);
    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(true);
    expect(store[STORAGE_KEY_AUTO_SCAN_ENABLED]).toBe(false);
  });

  it("does not rewrite storage when already migrated", async () => {
    await getVera5Settings();
    const snapshot = { ...store };
    await getVera5Settings();
    expect(store).toEqual(snapshot);
  });

  it("repairs invalid api key storage once", async () => {
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: 1 };
    store[STORAGE_KEY_EXTENSION_ENABLED] = true;
    store[STORAGE_KEY_HIGHLIGHT_ENABLED] = true;

    const settings = await getVera5Settings();
    expect(settings.apiKeys).toEqual({});
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({});
    expect(store[STORAGE_KEY_SCHEMA_VERSION]).toBe(SETTINGS_SCHEMA_VERSION);
  });
});

describe("api key display masking", () => {
  it("masks long keys and reveals only the last four characters", () => {
    expect(maskApiKeyForDisplay("abcdefghijklmnop")).toBe("••••••••mnop");
    expect(maskApiKeyForDisplay("abcdefghijklmnop")).not.toContain("abcdef");
  });

  it("masks short keys entirely", () => {
    expect(maskApiKeyForDisplay("abcd")).toBe("••••");
  });

  it("detects masked display values", () => {
    expect(isMaskedApiKeyDisplay("••••••••mnop")).toBe(true);
    expect(isMaskedApiKeyDisplay("fresh-secret")).toBe(false);
  });
});

describe("api key accessors", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty string when a slot is unset", async () => {
    await expect(getApiKey("abuseipdb")).resolves.toBe("");
  });

  it("persists and reads a connector key", async () => {
    await setApiKey("otx", "otx-test-key");
    await expect(getApiKey("otx")).resolves.toBe("otx-test-key");
    await expect(hasApiKey("otx")).resolves.toBe(true);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      otx: "otx-test-key",
    });
  });

  it("removes a slot when cleared", async () => {
    await setApiKey("abuseipdb", "abuse-test-key");
    await setApiKey("abuseipdb", "   ");
    await expect(getApiKey("abuseipdb")).resolves.toBe("");
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({});
  });
});

describe("pre-query notice preference storage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to showing notices with first-run prompt pending", async () => {
    await expect(getShowPreQueryNotices()).resolves.toBe(true);
    await expect(getPreQueryNoticePreferenceConfigured()).resolves.toBe(false);
  });

  it("perserves first-run choice and marks preference configured", async () => {
    await setPreQueryNoticePreference(false);
    expect(store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]).toBe(false);
    expect(store[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]).toBe(true);
    await expect(getShowPreQueryNotices()).resolves.toBe(false);
    await expect(getPreQueryNoticePreferenceConfigured()).resolves.toBe(true);
  });

  it("marks preference configured when toggling show notices", async () => {
    await setPreQueryNoticePreference(true);
    await setPreQueryNoticePreference(false);
    expect(store[STORAGE_KEY_PRE_QUERY_NOTICE_PREFERENCE_CONFIGURED]).toBe(true);
    await expect(getShowPreQueryNotices()).resolves.toBe(false);
  });
});

describe("settings round-trip", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips toggles and API keys through getVera5Settings", async () => {
    await setExtensionEnabled(false);
    await setHighlightEnabled(false);
    await setAutoScanEnabled(true);
    await setManualOnlyMode(false);
    await setEnrichmentSourceEnabled("abuseipdb", true);
    await setEnrichmentSourceEnabled("otx", true);
    await setApiKey("abuseipdb", "abuse-round-trip");
    await setApiKey("otx", "otx-round-trip");

    const settings = await getVera5Settings();

    expect(settings.extensionEnabled).toBe(false);
    expect(settings.highlightEnabled).toBe(false);
    expect(settings.autoScanEnabled).toBe(true);
    expect(settings.manualOnlyMode).toBe(false);
    expect(settings.enrichmentSourceEnabled).toMatchObject({
      abuseipdb: true,
      otx: true,
      urlscan: false,
      greynoise: false,
    });
    expect(settings.apiKeys).toEqual({
      abuseipdb: "abuse-round-trip",
      otx: "otx-round-trip",
    });
  });

  it("round-trips optional per-source cache TTL overrides", async () => {
    await setEnrichmentSourceCacheTtlSeconds("abuseipdb", 900);
    await setEnrichmentSourceCacheTtlSeconds("otx", 300);

    const settings = await getVera5Settings();
    expect(settings.enrichmentSourceCacheTtlSeconds).toEqual({
      abuseipdb: 900,
      otx: 300,
    });

    await setEnrichmentSourceCacheTtlSeconds("otx", null);
    const cleared = await getVera5Settings();
    expect(cleared.enrichmentSourceCacheTtlSeconds).toEqual({
      abuseipdb: 900,
    });
  });

  it("round-trips a full settings payload written to storage", async () => {
    const target = {
      ...createDefaultVera5Settings(),
      includePrivateIpv4: true,
      enrichmentCacheTtlSeconds: 7200,
      enrichmentSourceCacheTtlSeconds: { abuseipdb: 1800 },
      iocTypeEnabled: {
        ...createDefaultVera5Settings().iocTypeEnabled,
        md5: false,
        cve: false,
      },
    };

    await chrome.storage.local.set(vera5SettingsToStoragePayload(target));
    const loaded = await getVera5Settings();

    expect(loaded.includePrivateIpv4).toBe(true);
    expect(loaded.enrichmentCacheTtlSeconds).toBe(7200);
    expect(loaded.enrichmentSourceCacheTtlSeconds).toEqual({ abuseipdb: 1800 });
    expect(loaded.iocTypeEnabled.md5).toBe(false);
    expect(loaded.iocTypeEnabled.cve).toBe(false);
    expect(loaded.iocTypeEnabled.ipv4).toBe(true);
  });

  it("round-trips normalize after storage payload serialization", () => {
    const original = {
      ...createDefaultVera5Settings(),
      autoScanEnabled: true,
      manualOnlyMode: false,
      enrichmentSourceEnabled: {
        abuseipdb: false,
        otx: false,
        urlscan: true,
        greynoise: false,
      },
    };

    const roundTripped = normalizeVera5Settings(
      vera5SettingsToStoragePayload(original)
    );

    expect(roundTripped.autoScanEnabled).toBe(true);
    expect(roundTripped.manualOnlyMode).toBe(false);
    expect(roundTripped.enrichmentSourceEnabled.urlscan).toBe(true);
    expect(roundTripped.enrichmentSourceEnabled.abuseipdb).toBe(false);
  });
});
