import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultVera5Settings,
  getVera5Settings,
  setApiKey,
  setAutoScanEnabled,
  setEnrichmentSourceEnabled,
  setExtensionEnabled,
  setManualOnlyMode,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_AUTO_SCAN_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
} from "./storage";
import {
  buildVera5SettingsExportDocument,
  exportIncludesApiKeys,
  exportVera5SettingsJson,
  importVera5SettingsJson,
  mergeImportedVera5Settings,
  parseVera5SettingsExportDocument,
  serializeVera5SettingsExport,
  SettingsImportError,
} from "./settingsExport";
import {
  TEST_FIXTURE_CURRENT_API_KEY,
  TEST_FIXTURE_IMPORTED_API_KEY,
  TEST_FIXTURE_STORED_API_KEY,
} from "./fixtureSecrets";

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

describe("settings export", () => {
  it("omits API keys from export by default", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
      autoScanEnabled: true,
    };

    const document = buildVera5SettingsExportDocument(settings, false);
    const parsed = JSON.parse(serializeVera5SettingsExport(settings, false));

    expect(document.includeApiKeys).toBe(false);
    expect(document.settings[STORAGE_KEY_API_KEYS]).toBeUndefined();
    expect(parsed.settings.apiKeys).toBeUndefined();
    expect(document.settings[STORAGE_KEY_AUTO_SCAN_ENABLED]).toBe(true);
  });

  it("includes API keys when export is explicitly requested", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };

    const document = buildVera5SettingsExportDocument(settings, true);

    expect(document.includeApiKeys).toBe(true);
    expect(document.settings[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    expect(exportIncludesApiKeys(document)).toBe(true);
  });

  it("rejects invalid import JSON", () => {
    expect(() => parseVera5SettingsExportDocument("{")).toThrow(
      SettingsImportError
    );
    expect(() =>
      parseVera5SettingsExportDocument(JSON.stringify({ foo: "bar" }))
    ).toThrow(SettingsImportError);
  });

  it("merges imported settings without replacing API keys by default", () => {
    const current = {
      ...createDefaultVera5Settings(),
      manualOnlyMode: true,
      apiKeys: { abuseipdb: TEST_FIXTURE_CURRENT_API_KEY },
    };
    const imported = {
      ...createDefaultVera5Settings(),
      manualOnlyMode: false,
      autoScanEnabled: true,
      apiKeys: { abuseipdb: TEST_FIXTURE_IMPORTED_API_KEY },
    };

    const merged = mergeImportedVera5Settings(current, imported, false);

    expect(merged.manualOnlyMode).toBe(false);
    expect(merged.autoScanEnabled).toBe(true);
    expect(merged.apiKeys.abuseipdb).toBe(TEST_FIXTURE_CURRENT_API_KEY);
  });

  it("merges imported API keys when export included them", () => {
    const current = {
      ...createDefaultVera5Settings(),
      apiKeys: { abuseipdb: TEST_FIXTURE_CURRENT_API_KEY },
    };
    const imported = {
      ...createDefaultVera5Settings(),
      apiKeys: { otx: TEST_FIXTURE_IMPORTED_API_KEY },
    };

    const merged = mergeImportedVera5Settings(current, imported, true);

    expect(merged.apiKeys.abuseipdb).toBe(TEST_FIXTURE_CURRENT_API_KEY);
    expect(merged.apiKeys.otx).toBe(TEST_FIXTURE_IMPORTED_API_KEY);
  });
});

describe("settings export storage integration", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports current settings as JSON without keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_AUTO_SCAN_ENABLED] = true;

    const json = await exportVera5SettingsJson(false);
    const parsed = JSON.parse(json);

    expect(parsed.includeApiKeys).toBe(false);
    expect(parsed.settings.apiKeys).toBeUndefined();
    expect(parsed.settings.autoScanEnabled).toBe(true);
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
  });

  it("imports settings without overwriting stored API keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_MANUAL_ONLY_MODE] = true;

    const exportJson = await exportVera5SettingsJson(false);
    const parsed = JSON.parse(exportJson) as {
      settings: Record<string, unknown>;
    };
    parsed.settings.manualOnlyMode = false;
    parsed.settings.autoScanEnabled = true;

    await importVera5SettingsJson(JSON.stringify(parsed));

    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(false);
    expect(store[STORAGE_KEY_AUTO_SCAN_ENABLED]).toBe(true);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });

  it("round-trips preferences through export and import", async () => {
    await setExtensionEnabled(false);
    await setAutoScanEnabled(true);
    await setManualOnlyMode(false);
    await setEnrichmentSourceEnabled("urlscan", true);

    const before = await getVera5Settings();
    const exportJson = await exportVera5SettingsJson(false);

    await setAutoScanEnabled(false);
    await setManualOnlyMode(true);
    await setEnrichmentSourceEnabled("urlscan", false);

    await importVera5SettingsJson(exportJson);
    const after = await getVera5Settings();

    expect(after.extensionEnabled).toBe(before.extensionEnabled);
    expect(after.autoScanEnabled).toBe(before.autoScanEnabled);
    expect(after.manualOnlyMode).toBe(before.manualOnlyMode);
    expect(after.enrichmentSourceEnabled).toEqual(before.enrichmentSourceEnabled);
  });

  it("round-trips API keys when export includes them", async () => {
    await setApiKey("abuseipdb", "export-round-trip");
    await setApiKey("otx", "otx-export-round-trip");

    const exportJson = await exportVera5SettingsJson(true);
    await setApiKey("abuseipdb", "");
    await setApiKey("otx", "");

    await importVera5SettingsJson(exportJson);
    const settings = await getVera5Settings();

    expect(settings.apiKeys).toEqual({
      abuseipdb: "export-round-trip",
      otx: "otx-export-round-trip",
    });
  });
});
