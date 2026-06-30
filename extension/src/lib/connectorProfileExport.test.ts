import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildConnectorProfileDocument,
  buildConnectorProfilePrivacyWarnings,
  buildConnectorProfileRateLimitMetadata,
  CONNECTOR_PROFILE_SCHEMA_VERSION,
  ConnectorProfileImportError,
  exportConnectorProfileJson,
  getEnrichmentSourceQuotaSummary,
  importConnectorProfileJson,
  mergeImportedConnectorProfile,
  parseConnectorProfileDocument,
  serializeConnectorProfileExport,
} from "./connectorProfileExport";
import { ENRICHMENT_SOURCE, ENRICHMENT_SOURCE_ORDER } from "./enrichmentSourceRegistry";
import {
  createDefaultVera5Settings,
  getVera5Settings,
  setApiKey,
  setEnrichmentSourceEnabled,
  setIocTypeEnabled,
  setManualOnlyMode,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
} from "./storage";
import {
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
} from "./hoverCardEnrichment";
import {
  TEST_FIXTURE_SECONDARY_API_KEY,
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

describe("connector profile export", () => {
  it("includes IOC types, rate-limit metadata, and privacy warnings without keys", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      apiKeys: {
        abuseipdb: TEST_FIXTURE_STORED_API_KEY,
        otx: TEST_FIXTURE_SECONDARY_API_KEY,
      },
      iocTypeEnabled: { ipv4: true, domain: false },
      manualOnlyMode: false,
    };

    const document = buildConnectorProfileDocument(
      settings,
      "2026-06-02T12:00:00.000Z"
    );
    const json = serializeConnectorProfileExport(settings);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(document.connectorProfileSchemaVersion).toBe(
      CONNECTOR_PROFILE_SCHEMA_VERSION
    );
    expect(document.preferences.iocTypeEnabled).toEqual({
      ipv4: true,
      domain: false,
    });
    expect(document.rateLimitMetadata.defaultGlobalCooldownSeconds).toBe(60);
    expect(document.rateLimitMetadata.sources.length).toBeGreaterThan(0);
    expect(document.rateLimitMetadata.sources).toHaveLength(
      ENRICHMENT_SOURCE_ORDER.length
    );
    expect(
      getEnrichmentSourceQuotaSummary(ENRICHMENT_SOURCE.URLSCAN)
    ).toContain("URLScan.io account");
    expect(document.privacyWarnings.enrichmentDisclaimer).toBe(
      HOVER_CARD_ENRICHMENT_DISCLAIMER
    );
    expect(document.privacyWarnings.riskScoreDisclaimer).toBe(
      HOVER_CARD_RISK_SCORE_DISCLAIMER
    );
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(parsed.apiKeys).toBeUndefined();
    expect(parsed).not.toHaveProperty("apiKeys");
  });

  it("rejects connector profile JSON that contains API keys", () => {
    const payload = {
      connectorProfileSchemaVersion: CONNECTOR_PROFILE_SCHEMA_VERSION,
      exportedAt: "2026-06-02T12:00:00.000Z",
      preferences: createDefaultVera5Settings(),
      apiKeys: { abuseipdb: "leaked" },
      rateLimitMetadata: buildConnectorProfileRateLimitMetadata(),
      privacyWarnings: buildConnectorProfilePrivacyWarnings(),
    };

    expect(() =>
      parseConnectorProfileDocument(JSON.stringify(payload))
    ).toThrow(ConnectorProfileImportError);
  });

  it("merges imported preferences without replacing stored API keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      manualOnlyMode: true,
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };
    const importedPreferences = {
      ...buildConnectorProfileDocument(createDefaultVera5Settings()).preferences,
      manualOnlyMode: false,
      iocTypeEnabled: { ipv4: true, sha256: false },
    };

    const merged = mergeImportedConnectorProfile(current, importedPreferences);

    expect(merged.manualOnlyMode).toBe(false);
    expect(merged.iocTypeEnabled.sha256).toBe(false);
    expect(merged.apiKeys.abuseipdb).toBe(TEST_FIXTURE_STORED_API_KEY);
  });
});

describe("connector profile storage integration", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports connector profile JSON without keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    await setIocTypeEnabled("domain", false);

    const json = await exportConnectorProfileJson();
    const parsed = JSON.parse(json) as {
      preferences: { iocTypeEnabled: Record<string, boolean> };
    };

    expect(parsed.preferences.iocTypeEnabled.domain).toBe(false);
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
  });

  it("imports connector profile without overwriting stored API keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_MANUAL_ONLY_MODE] = true;

    const exportJson = await exportConnectorProfileJson();
    const parsed = JSON.parse(exportJson) as {
      preferences: Record<string, unknown>;
    };
    parsed.preferences.manualOnlyMode = false;

    await importConnectorProfileJson(
      JSON.stringify({
        connectorProfileSchemaVersion: CONNECTOR_PROFILE_SCHEMA_VERSION,
        exportedAt: "2026-06-02T12:00:00.000Z",
        preferences: parsed.preferences,
      })
    );

    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(false);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });

  it("round-trips connector preferences through export and import", async () => {
    await setManualOnlyMode(false);
    await setEnrichmentSourceEnabled("urlscan", true);
    await setIocTypeEnabled("cve", false);

    const before = await getVera5Settings();
    const exportJson = await exportConnectorProfileJson();

    await setManualOnlyMode(true);
    await setEnrichmentSourceEnabled("urlscan", false);
    await setIocTypeEnabled("cve", true);

    await importConnectorProfileJson(exportJson);
    const after = await getVera5Settings();

    expect(after.manualOnlyMode).toBe(before.manualOnlyMode);
    expect(after.enrichmentSourceEnabled).toEqual(before.enrichmentSourceEnabled);
    expect(after.iocTypeEnabled).toEqual(before.iocTypeEnabled);
    expect(store[STORAGE_KEY_IOC_TYPE_ENABLED]).toEqual(before.iocTypeEnabled);
  });
});
