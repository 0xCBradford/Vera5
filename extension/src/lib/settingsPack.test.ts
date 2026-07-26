/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYST_MODE_PRESET_CTI_ID,
  ANALYST_MODE_PRESET_SOC_ID,
} from "./analystModePresets";
import { DOMAIN_POLICY_MODE_DENY_BY_DEFAULT } from "./domainPolicy";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import {
  assertNoSecretsInSettingsPack,
  assertSettingsPackNotThreatProfile,
  buildSettingsPackDocument,
  buildSettingsPackImportDiff,
  buildSettingsPackImportPreview,
  downloadSettingsPackExport,
  exportSettingsPackJson,
  importSettingsPackJson,
  importThreatProfileJson,
  isSettingsPackDocument,
  isThreatProfileDocument,
  mapThreatProfileEnabledConnectorsToEnrichmentSourceEnabled,
  mapThreatProfileToAnalystModeStorage,
  mapThreatProfileToConnectorProfilePreferences,
  mergeImportedSettingsPack,
  mergeImportedThreatProfile,
  normalizeSettingsPackDocument,
  normalizeThreatProfileDocument,
  parseSettingsPackDocument,
  parseThreatProfileDocument,
  buildThreatProfileImportDiff,
  buildThreatProfileImportPreview,
  applyImportedThreatProfile,
  buildThreatProfileApplyAsNewActiveBase,
  buildActiveThreatProfileStateAfterImport,
  createEmptyActiveThreatProfileState,
  formatActiveThreatProfileIndicator,
  formatThreatProfileLastImportedAt,
  getActiveThreatProfileState,
  getBuiltInThreatProfileById,
  listShippedBuiltInThreatProfiles,
  BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH,
  BUILT_IN_THREAT_PROFILE_SOC_TRIAGE,
  BUILT_IN_THREAT_PROFILE_CTI_HUNTING,
  BUILT_IN_MALWARE_RESEARCH_DOMAIN_FORWARD_PIVOTS,
  BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS,
  isCompleteThreatProfile,
  resolvePivotRecipeSetPresetId,
  THREAT_PROFILE_SCHEMA_VERSION,
  THREAT_PROFILE_EXPORT_FILENAME,
  THREAT_PROFILE_IMPORT_MERGE_MODE,
  STORAGE_KEY_ACTIVE_THREAT_PROFILE,
  ACTIVE_THREAT_PROFILE_CUSTOM_MODE_ID,
  ACTIVE_THREAT_PROFILE_ID,
  BUILT_IN_THREAT_PROFILE_ID_CTI,
  BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH,
  BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE,
  BUILT_IN_THREAT_PROFILE_IDS,
  isBuiltInThreatProfileId,
  listBuiltInThreatProfileIds,
  buildThreatProfileDocumentFromSettings,
  downloadThreatProfileExport,
  exportThreatProfileJson,
  serializeThreatProfile,
  validateThreatProfileExport,
  SETTINGS_PACK_EXPORT_FILENAME,
  SETTINGS_PACK_SCHEMA_VERSION,
  SettingsPackImportError,
  serializeSettingsPack,
  validateSettingsPackExport,
} from "./settingsPack";
import {
  API_KEY_SLOTS,
  applyAnalystModePreset,
  createDefaultVera5Settings,
  getVera5Settings,
  setApiKey,
  setDefaultExportTemplateId,
  setEnrichmentSourceEnabled,
  setManualOnlyMode,
  setQuietMode,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
  STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES,
  STORAGE_KEY_QUIET_MODE,
  STORAGE_KEY_SHOW_PRE_QUERY_NOTICES,
  vera5SettingsToStoragePayload,
} from "./storage";
import {
  TEST_FIXTURE_API_KEY_LITERALS,
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

describe("settings pack schema", () => {
  it("builds a settings pack with schemaVersion, connector toggles, TTL, domain policy, and analyst mode", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      apiKeys: {
        abuseipdb: TEST_FIXTURE_STORED_API_KEY,
        otx: TEST_FIXTURE_SECONDARY_API_KEY,
      },
      enrichmentSourceEnabled: {
        abuseipdb: true,
        otx: false,
        rdap_whois: true,
      },
      enrichmentCacheTtlSeconds: 7200,
      enrichmentSourceCacheTtlSeconds: {
        abuseipdb: 3600,
        otx: 1800,
      },
      domainPolicyMode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
      domainAllowlist: ["corp.example"],
      domainDenylist: ["webmail.example"],
      domainPolicyEnrichGateEnabled: false,
      analystModePresetId: ANALYST_MODE_PRESET_CTI_ID,
      defaultExportTemplateId: "markdown-report" as const,
      pivotEmphasisProviders: ["otx", "virustotal"],
      manualOnlyMode: false,
      showPreQueryNotices: false,
      showDisabledSourcesInWorkspace: true,
      includePrivateIpv4: true,
    };

    const document = buildSettingsPackDocument(
      settings,
      "2026-06-30T12:00:00.000Z"
    );
    const json = serializeSettingsPack(settings);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(document).toEqual({
      schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
      exportedAt: "2026-06-30T12:00:00.000Z",
      enrichmentSourceEnabled: {
        abuseipdb: true,
        otx: false,
        rdap_whois: true,
      },
      enrichmentCacheTtlSeconds: 7200,
      enrichmentSourceCacheTtlSeconds: {
        abuseipdb: 3600,
        otx: 1800,
      },
      domainPolicy: {
        mode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
        allowlist: ["corp.example"],
        denylist: ["webmail.example"],
        enrichGateEnabled: false,
      },
      analystMode: {
        presetId: ANALYST_MODE_PRESET_CTI_ID,
        defaultExportTemplateId: "markdown-report",
        pivotEmphasisProviders: ["otx", "virustotal"],
        manualOnlyMode: false,
        showPreQueryNotices: false,
        showDisabledSourcesInWorkspace: true,
        includePrivateIpv4: true,
      },
      connectorConfidenceMetadataOverrides: {},
    });
    expect(isSettingsPackDocument(document)).toBe(true);
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(parsed.apiKeys).toBeUndefined();
    expect(parsed).not.toHaveProperty("apiKeys");
  });

  it("normalizes imported settings pack documents", () => {
    const normalized = normalizeSettingsPackDocument({
      schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
      exportedAt: "2026-06-30T12:00:00.000Z",
      enrichmentSourceEnabled: {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: true,
        [ENRICHMENT_SOURCE.RDAP_WHOIS]: true,
      },
      enrichmentCacheTtlSeconds: 5400,
      enrichmentSourceCacheTtlSeconds: {
        [ENRICHMENT_SOURCE.RDAP_WHOIS]: 900,
      },
      domainPolicy: {
        mode: "allow_by_default",
        allowlist: [" TRUSTED.EXAMPLE ", "trusted.example"],
        denylist: ["blocked.example"],
        enrichGateEnabled: true,
      },
      analystMode: {
        presetId: ANALYST_MODE_PRESET_SOC_ID,
        defaultExportTemplateId: "jira-comment",
        pivotEmphasisProviders: ["abuseipdb", "invalid-provider", "otx"],
        manualOnlyMode: true,
        showPreQueryNotices: true,
        showDisabledSourcesInWorkspace: false,
        includePrivateIpv4: false,
      },
    });

    expect(normalized.domainPolicy.allowlist).toEqual(["trusted.example"]);
    expect(normalized.analystMode.pivotEmphasisProviders).toEqual([
      "abuseipdb",
      "otx",
    ]);
    expect(normalized.enrichmentSourceEnabled.rdap_whois).toBe(true);
  });

  it("parses serialized settings pack JSON", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      analystModePresetId: ANALYST_MODE_PRESET_SOC_ID,
    };
    const parsed = parseSettingsPackDocument(serializeSettingsPack(settings));

    expect(parsed.schemaVersion).toBe(SETTINGS_PACK_SCHEMA_VERSION);
    expect(parsed.analystMode.presetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
  });

  it("rejects settings packs that contain API keys or tokens", () => {
    const withApiKeys = {
      schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
      exportedAt: "2026-06-30T12:00:00.000Z",
      apiKeys: { abuseipdb: "leaked" },
      enrichmentSourceEnabled: {},
      enrichmentCacheTtlSeconds: 3600,
      enrichmentSourceCacheTtlSeconds: {},
      domainPolicy: {
        mode: "allow_by_default",
        allowlist: [],
        denylist: [],
        enrichGateEnabled: true,
      },
      analystMode: {
        presetId: "",
        defaultExportTemplateId: "analyst-update",
        pivotEmphasisProviders: [],
        manualOnlyMode: true,
        showPreQueryNotices: true,
        showDisabledSourcesInWorkspace: false,
        includePrivateIpv4: false,
      },
    };

    expect(() => normalizeSettingsPackDocument(withApiKeys)).toThrow(
      SettingsPackImportError
    );
    expect(() =>
      assertNoSecretsInSettingsPack({
        analystMode: {
          connectorApiKey: "hidden",
        },
      })
    ).toThrow(SettingsPackImportError);
    expect(() =>
      assertNoSecretsInSettingsPack({
        enrichmentSourceEnabled: {
          otx: true,
          token: "hidden",
        },
      })
    ).toThrow(SettingsPackImportError);
  });

  it("rejects unsupported schema versions and invalid JSON", () => {
    expect(() => parseSettingsPackDocument("{")).toThrow(SettingsPackImportError);
    expect(() =>
      normalizeSettingsPackDocument({
        schemaVersion: 99,
        exportedAt: "2026-06-30T12:00:00.000Z",
      })
    ).toThrow(SettingsPackImportError);
  });
});

describe("settings pack export", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports settings pack JSON from storage without API keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };

    const json = await exportSettingsPackJson();
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe(SETTINGS_PACK_SCHEMA_VERSION);
    expect(parsed.apiKeys).toBeUndefined();
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(isSettingsPackDocument(parsed)).toBe(true);
  });

  it("exports configured connector confidence metadata overrides in settings pack JSON", async () => {
    store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES] = {
      otx: { reliabilityTier: "authoritative" },
      urlscan: { freshnessPolicy: "stable", sourceClass: "authoritative" },
    };

    const json = await exportSettingsPackJson();
    const parsed = JSON.parse(json) as {
      connectorConfidenceMetadataOverrides: Record<string, unknown>;
    };

    expect(parsed.connectorConfidenceMetadataOverrides).toEqual({
      otx: { reliabilityTier: "authoritative" },
      urlscan: { freshnessPolicy: "stable", sourceClass: "authoritative" },
    });
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
  });

  it("round-trips configured metadata overrides through settings pack export and import", async () => {
    store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES] = {
      greynoise: { freshnessPolicy: "stable" },
    };

    const exportJson = await exportSettingsPackJson();
    store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES] = {};

    await importSettingsPackJson(exportJson);

    expect(store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES]).toEqual({
      greynoise: { freshnessPolicy: "stable" },
    });
  });

  it("downloads settings pack JSON with the default filename", () => {
    const createObjectURL = vi.fn(() => "blob:settings-pack");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const createElementSpy = vi.spyOn(document, "createElement");

    downloadSettingsPackExport('{"schemaVersion":1}');

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    const anchor = createElementSpy.mock.results.find(
      (result) => result.value instanceof HTMLAnchorElement
    )?.value as HTMLAnchorElement;
    expect(anchor.download).toBe(SETTINGS_PACK_EXPORT_FILENAME);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:settings-pack");

    clickSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});

describe("settings pack export secret stripping validation", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates export strips apiKey, token, and similar fields from populated storage", async () => {
    for (const slot of API_KEY_SLOTS) {
      await setApiKey(slot, `${TEST_FIXTURE_STORED_API_KEY}-${slot}`);
    }

    const json = await exportSettingsPackJson();
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(validateSettingsPackExport(parsed as never)).toEqual(parsed);
    expect(parsed).not.toHaveProperty("apiKeys");
    expect(parsed).not.toHaveProperty(STORAGE_KEY_API_KEYS);
    for (const literal of TEST_FIXTURE_API_KEY_LITERALS) {
      expect(json).not.toContain(literal);
    }
    for (const forbiddenKey of [
      "apiKey",
      "api_key",
      "token",
      "secret",
      "password",
      "credential",
    ]) {
      expect(json.toLowerCase()).not.toContain(`"${forbiddenKey.toLowerCase()}"`);
    }
  });

  it("rejects export documents that still contain forbidden secret field names", () => {
    const baseDocument = buildSettingsPackDocument(createDefaultVera5Settings());
    const forbiddenKeys = [
      "apiKey",
      "api_key",
      "token",
      "secret",
      "password",
      "credential",
      "connectorApiKey",
      "accessToken",
    ] as const;

    for (const forbiddenKey of forbiddenKeys) {
      expect(() =>
        validateSettingsPackExport({
          ...baseDocument,
          [forbiddenKey]: "leaked",
        } as never)
      ).toThrow(SettingsPackImportError);
      expect(() =>
        validateSettingsPackExport({
          ...baseDocument,
          analystMode: {
            ...baseDocument.analystMode,
            [forbiddenKey]: "leaked",
          },
        } as never)
      ).toThrow(SettingsPackImportError);
    }
  });

  it("builds export documents without apiKeys even when settings include every key slot", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      apiKeys: Object.fromEntries(
        API_KEY_SLOTS.map((slot, index) => [
          slot,
          `${TEST_FIXTURE_SECONDARY_API_KEY}-${index}`,
        ])
      ),
    };

    const document = buildSettingsPackDocument(settings);
    const json = serializeSettingsPack(settings);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(document).not.toHaveProperty("apiKeys");
    expect(parsed).not.toHaveProperty("apiKeys");
    expect(json).not.toContain(TEST_FIXTURE_SECONDARY_API_KEY);
    expect(() => validateSettingsPackExport(document)).not.toThrow();
  });
});

describe("settings pack import", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges toggles, TTL, domain policy, and analyst mode from a settings pack", () => {
    const current = {
      ...createDefaultVera5Settings(),
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
      manualOnlyMode: true,
      enrichmentCacheTtlSeconds: 3600,
      enrichmentSourceEnabled: { abuseipdb: false, rdap_whois: false },
    };
    const pack = buildSettingsPackDocument(
      {
        ...createDefaultVera5Settings(),
        manualOnlyMode: false,
        enrichmentCacheTtlSeconds: 9000,
        enrichmentSourceEnabled: { abuseipdb: true, rdap_whois: true },
        domainPolicyMode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
        domainAllowlist: ["trusted.example"],
        domainDenylist: ["blocked.example"],
        domainPolicyEnrichGateEnabled: false,
        analystModePresetId: ANALYST_MODE_PRESET_CTI_ID,
        defaultExportTemplateId: "markdown-report",
        pivotEmphasisProviders: ["otx", "virustotal"],
        showDisabledSourcesInWorkspace: true,
        includePrivateIpv4: true,
      },
      "2026-06-30T12:00:00.000Z"
    );

    const merged = mergeImportedSettingsPack(current, pack);

    expect(merged.manualOnlyMode).toBe(false);
    expect(merged.enrichmentCacheTtlSeconds).toBe(9000);
    expect(merged.enrichmentSourceEnabled).toEqual({
      abuseipdb: true,
      rdap_whois: true,
    });
    expect(merged.domainPolicyMode).toBe(DOMAIN_POLICY_MODE_DENY_BY_DEFAULT);
    expect(merged.domainAllowlist).toEqual(["trusted.example"]);
    expect(merged.domainDenylist).toEqual(["blocked.example"]);
    expect(merged.domainPolicyEnrichGateEnabled).toBe(false);
    expect(merged.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(merged.defaultExportTemplateId).toBe("markdown-report");
    expect(merged.pivotEmphasisProviders).toEqual(["otx", "virustotal"]);
    expect(merged.showDisabledSourcesInWorkspace).toBe(true);
    expect(merged.includePrivateIpv4).toBe(true);
    expect(merged.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
  });

  it("imports settings pack without overwriting stored API keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    await setApiKey("otx", TEST_FIXTURE_SECONDARY_API_KEY);
    await setManualOnlyMode(true);

    const exportJson = await exportSettingsPackJson();
    const parsed = JSON.parse(exportJson) as Record<string, unknown>;
    parsed.analystMode = {
      ...(parsed.analystMode as Record<string, unknown>),
      manualOnlyMode: false,
    };

    await importSettingsPackJson(JSON.stringify(parsed));

    expect(store[STORAGE_KEY_MANUAL_ONLY_MODE]).toBe(false);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
      otx: TEST_FIXTURE_SECONDARY_API_KEY,
    });
  });

  it("round-trips pack fields through export and import while preserving unrelated settings", async () => {
    await setManualOnlyMode(false);
    await setEnrichmentSourceEnabled("rdap_whois", true);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 5400;

    const before = await getVera5Settings();
    const exportJson = await exportSettingsPackJson();

    await setManualOnlyMode(true);
    await setEnrichmentSourceEnabled("rdap_whois", false);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 3600;

    await importSettingsPackJson(exportJson);
    const after = await getVera5Settings();

    expect(after.manualOnlyMode).toBe(before.manualOnlyMode);
    expect(after.enrichmentSourceEnabled).toEqual(before.enrichmentSourceEnabled);
    expect(after.enrichmentCacheTtlSeconds).toBe(before.enrichmentCacheTtlSeconds);
    expect(after.domainPolicyMode).toBe(before.domainPolicyMode);
    expect(after.analystModePresetId).toBe(before.analystModePresetId);
    expect(store[STORAGE_KEY_DOMAIN_POLICY_MODE]).toBe(before.domainPolicyMode);
    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toEqual(
      before.enrichmentSourceEnabled
    );
  });

  it("imports settings pack connector confidence metadata overrides without keys", async () => {
    const pack = buildSettingsPackDocument(createDefaultVera5Settings());
    pack.connectorConfidenceMetadataOverrides = {
      otx: { reliabilityTier: "authoritative" },
      urlscan: { freshnessPolicy: "stable" },
    };

    await importSettingsPackJson(JSON.stringify(pack));

    expect(store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES]).toEqual({
      otx: { reliabilityTier: "authoritative" },
      urlscan: { freshnessPolicy: "stable" },
    });
    const settings = await getVera5Settings();
    expect(
      settings.connectorConfidenceMetadataOverrides[ENRICHMENT_SOURCE.URLSCAN]
    ).toEqual({ freshnessPolicy: "stable" });
  });

  it("exports settings pack metadata overrides and shows import diff", () => {
    const current = {
      ...createDefaultVera5Settings(),
      connectorConfidenceMetadataOverrides: {},
    };
    const pack = buildSettingsPackDocument({
      ...createDefaultVera5Settings(),
      connectorConfidenceMetadataOverrides: {
        greynoise: { freshnessPolicy: "stable" },
      },
    });

    const changes = buildSettingsPackImportDiff(current, pack);
    expect(changes.some((entry) => entry.field === "connectorConfidenceMetadataOverrides")).toBe(
      true
    );
    expect(JSON.stringify(pack)).not.toContain("apiKeys");
  });

  it("rejects settings pack import with unknown connector metadata ids", async () => {
    const pack = buildSettingsPackDocument(createDefaultVera5Settings());
    pack.connectorConfidenceMetadataOverrides = {
      unknown_source: { reliabilityTier: "community" },
    };

    await expect(importSettingsPackJson(JSON.stringify(pack))).rejects.toThrow(
      SettingsPackImportError
    );
  });

  it("rejects settings pack import with unknown metadata fields", async () => {
    const pack = buildSettingsPackDocument(createDefaultVera5Settings());
    pack.connectorConfidenceMetadataOverrides = {
      otx: { reliabilityTier: "authoritative", scoreWeight: 2 },
    };

    await expect(importSettingsPackJson(JSON.stringify(pack))).rejects.toThrow(
      SettingsPackImportError
    );
  });

  it("rejects settings pack import with empty metadata override objects", async () => {
    const pack = buildSettingsPackDocument(createDefaultVera5Settings());
    pack.connectorConfidenceMetadataOverrides = {
      otx: {},
    };

    await expect(importSettingsPackJson(JSON.stringify(pack))).rejects.toThrow(
      SettingsPackImportError
    );
  });

  it("rejects settings pack import documents that contain secrets", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);

    await expect(
      importSettingsPackJson(
        JSON.stringify({
          schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
          exportedAt: "2026-06-30T12:00:00.000Z",
          apiKeys: { abuseipdb: "leaked" },
          enrichmentSourceEnabled: {},
          enrichmentCacheTtlSeconds: 3600,
          enrichmentSourceCacheTtlSeconds: {},
          domainPolicy: {
            mode: "allow_by_default",
            allowlist: [],
            denylist: [],
            enrichGateEnabled: true,
          },
          analystMode: {
            presetId: "",
            defaultExportTemplateId: "analyst-update",
            pivotEmphasisProviders: [],
            manualOnlyMode: true,
            showPreQueryNotices: true,
            showDisabledSourcesInWorkspace: false,
            includePrivateIpv4: false,
          },
        })
      )
    ).rejects.toThrow(SettingsPackImportError);

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });
});

describe("settings pack import diff preview", () => {
  it("lists only fields that change between current settings and an incoming pack", () => {
    const current = {
      ...createDefaultVera5Settings(),
      manualOnlyMode: true,
      enrichmentCacheTtlSeconds: 3600,
      enrichmentSourceEnabled: { abuseipdb: false, rdap_whois: false },
      domainPolicyMode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
    };
    const pack = buildSettingsPackDocument(
      {
        ...createDefaultVera5Settings(),
        manualOnlyMode: false,
        enrichmentCacheTtlSeconds: 7200,
        enrichmentSourceEnabled: { abuseipdb: true, rdap_whois: true },
        domainPolicyMode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
      },
      "2026-06-30T12:00:00.000Z"
    );

    const changes = buildSettingsPackImportDiff(current, pack);

    expect(changes.map((change) => change.field)).toEqual(
      expect.arrayContaining([
        "manualOnlyMode",
        "enrichmentCacheTtlSeconds",
        "enrichmentSourceEnabled.abuseipdb",
        "enrichmentSourceEnabled.rdap_whois",
      ])
    );
    expect(changes.find((change) => change.field === "manualOnlyMode")).toEqual({
      field: "manualOnlyMode",
      label: "Manual-only enrichment",
      currentValue: "Enabled",
      incomingValue: "Disabled",
    });
    expect(changes.some((change) => change.field === "domainPolicyMode")).toBe(
      false
    );
  });

  it("builds an import preview from settings pack JSON", () => {
    const current = {
      ...createDefaultVera5Settings(),
      manualOnlyMode: true,
    };
    const preview = buildSettingsPackImportPreview(
      current,
      serializeSettingsPack({
        ...createDefaultVera5Settings(),
        manualOnlyMode: false,
      })
    );

    expect(preview.pack.schemaVersion).toBe(SETTINGS_PACK_SCHEMA_VERSION);
    expect(preview.changes.some((change) => change.field === "manualOnlyMode")).toBe(
      true
    );
  });
});

describe("settings pack threat profile precedence", () => {
  it("detects threat profile documents by schema markers", () => {
    expect(
      isThreatProfileDocument({
        threatProfileSchemaVersion: 1,
        id: "soc-triage",
      })
    ).toBe(true);
    expect(
      isThreatProfileDocument({
        enabledConnectors: ["abuseipdb"],
        pivotRecipeSetId: "cti-hunt",
      })
    ).toBe(true);
    expect(
      isThreatProfileDocument({
        connectorConfidenceMetadataOverrides: {
          otx: { reliabilityTier: "authoritative" },
        },
      })
    ).toBe(true);
    expect(
      isThreatProfileDocument({
        schemaVersion: SETTINGS_PACK_SCHEMA_VERSION,
        exportedAt: "2026-06-30T12:00:00.000Z",
        enrichmentSourceEnabled: {},
        enrichmentCacheTtlSeconds: 3600,
        enrichmentSourceCacheTtlSeconds: {},
        domainPolicy: {
          mode: "allow_by_default",
          allowlist: [],
          denylist: [],
          enrichGateEnabled: true,
        },
        analystMode: {
          presetId: "",
          defaultExportTemplateId: "analyst-update",
          pivotEmphasisProviders: [],
          manualOnlyMode: true,
          showPreQueryNotices: true,
          showDisabledSourcesInWorkspace: false,
          includePrivateIpv4: false,
        },
      })
    ).toBe(false);
  });

  it("rejects threat profile JSON on settings pack import", () => {
    expect(() =>
      assertSettingsPackNotThreatProfile({
        threatProfileSchemaVersion: 1,
        enabledConnectors: ["otx"],
        pivotRecipeSetId: "malware-research",
      })
    ).toThrow(SettingsPackImportError);

    expect(() =>
      normalizeSettingsPackDocument({
        threatProfileSchemaVersion: 1,
        exportedAt: "2026-06-30T12:00:00.000Z",
        enabledConnectors: ["abuseipdb"],
        pivotRecipeSetId: "soc-triage",
      })
    ).toThrow(SettingsPackImportError);
  });
});

describe("built-in threat profile ids", () => {
  it("registers SOC triage, CTI, and malware research ids", () => {
    expect(BUILT_IN_THREAT_PROFILE_IDS).toEqual([
      BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE,
      BUILT_IN_THREAT_PROFILE_ID_CTI,
      BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH,
    ]);
    expect(BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE).toBe("soc-triage");
    expect(BUILT_IN_THREAT_PROFILE_ID_CTI).toBe("cti-research");
    expect(BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH).toBe("malware-research");
  });

  it("exposes listBuiltInThreatProfileIds and isBuiltInThreatProfileId", () => {
    expect(listBuiltInThreatProfileIds()).toEqual([...BUILT_IN_THREAT_PROFILE_IDS]);
    expect(isBuiltInThreatProfileId("soc-triage")).toBe(true);
    expect(isBuiltInThreatProfileId("cti-research")).toBe(true);
    expect(isBuiltInThreatProfileId("malware-research")).toBe(true);
    expect(isBuiltInThreatProfileId("custom-profile")).toBe(false);
    expect(isBuiltInThreatProfileId(null)).toBe(false);
  });

  it("maps built-in pivot recipe set ids to analyst presets", () => {
    expect(resolvePivotRecipeSetPresetId(BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE)).toBe(
      ANALYST_MODE_PRESET_SOC_ID
    );
    expect(resolvePivotRecipeSetPresetId(BUILT_IN_THREAT_PROFILE_ID_CTI)).toBe(
      ANALYST_MODE_PRESET_CTI_ID
    );
    expect(
      resolvePivotRecipeSetPresetId(BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH)
    ).toBe(ANALYST_MODE_PRESET_CTI_ID);
  });
});

describe("built-in Malware Research threat profile", () => {
  it("ships a complete profile with CTI markdown export and enrich-friendly connectors", () => {
    expect(isCompleteThreatProfile(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH)).toBe(
      true
    );
    expect(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.id).toBe(
      BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH
    );
    expect(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.defaultExportTemplateId).toBe(
      "markdown-report"
    );
    expect(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.analystMode).toBe(
      ANALYST_MODE_PRESET_CTI_ID
    );
    expect(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.quietModeDefault).toBe(false);
    expect(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.enabledConnectors).toEqual(
      expect.arrayContaining(["otx", "virustotal", "urlscan", "malwarebazaar"])
    );
    expect(listShippedBuiltInThreatProfiles()).toEqual([
      BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH,
      BUILT_IN_THREAT_PROFILE_SOC_TRIAGE,
      BUILT_IN_THREAT_PROFILE_CTI_HUNTING,
    ]);
    expect(
      getBuiltInThreatProfileById(BUILT_IN_THREAT_PROFILE_ID_MALWARE_RESEARCH)
    ).toEqual(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH);
    expect(JSON.stringify(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH)).not.toMatch(
      /apiKey|token|password|credential/i
    );
  });

  it("applies domain-forward pivots when importing Malware Research", () => {
    const mapped = mapThreatProfileToAnalystModeStorage(
      BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH
    );
    expect(mapped.defaultExportTemplateId).toBe("markdown-report");
    expect(mapped.pivotEmphasisProviders).toEqual([
      ...BUILT_IN_MALWARE_RESEARCH_DOMAIN_FORWARD_PIVOTS,
    ]);
    expect(mapped.pivotEmphasisProviders?.[0]).toBe("virustotal");
    expect(mapped.pivotEmphasisProviders?.[1]).toBe("urlscan");

    const merged = applyImportedThreatProfile(
      createDefaultVera5Settings(),
      BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH,
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );
    expect(merged.defaultExportTemplateId).toBe("markdown-report");
    expect(merged.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(merged.pivotEmphasisProviders[0]).toBe("virustotal");
    expect(merged.enrichmentSourceEnabled.otx).toBe(true);
    expect(merged.enrichmentSourceEnabled.virustotal).toBe(true);
    expect(merged.enrichmentSourceEnabled.urlscan).toBe(true);
    expect(merged.enrichmentSourceEnabled.malwarebazaar).toBe(true);
    expect(merged.apiKeys).toEqual(createDefaultVera5Settings().apiKeys);
  });
});

describe("built-in SOC Triage threat profile", () => {
  it("ships a complete profile with SOC mode, Splunk-oriented CSV export, and conservative connectors", () => {
    expect(isCompleteThreatProfile(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE)).toBe(true);
    expect(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.id).toBe(
      BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE
    );
    expect(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.defaultExportTemplateId).toBe(
      "csv-row"
    );
    expect(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.analystMode).toBe(
      ANALYST_MODE_PRESET_SOC_ID
    );
    expect(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.quietModeDefault).toBe(false);
    expect(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.enabledConnectors).toEqual([
      "abuseipdb",
      "otx",
    ]);
    expect(
      getBuiltInThreatProfileById(BUILT_IN_THREAT_PROFILE_ID_SOC_TRIAGE)
    ).toEqual(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE);
    expect(JSON.stringify(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE)).not.toMatch(
      /apiKey|token|password|credential/i
    );
  });

  it("applies SOC pivots and conservative auto-scan defaults without touching API keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      autoScanEnabled: true,
      manualOnlyMode: false,
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };

    const mapped = mapThreatProfileToAnalystModeStorage(
      BUILT_IN_THREAT_PROFILE_SOC_TRIAGE
    );
    expect(mapped.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(mapped.defaultExportTemplateId).toBe("csv-row");
    expect(mapped.pivotEmphasisProviders?.[0]).toBe("abuseipdb");

    const merged = applyImportedThreatProfile(
      current,
      BUILT_IN_THREAT_PROFILE_SOC_TRIAGE,
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    expect(merged.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(merged.defaultExportTemplateId).toBe("csv-row");
    expect(merged.autoScanEnabled).toBe(false);
    expect(merged.manualOnlyMode).toBe(true);
    expect(merged.pivotEmphasisProviders[0]).toBe("abuseipdb");
    expect(merged.enrichmentSourceEnabled.abuseipdb).toBe(true);
    expect(merged.enrichmentSourceEnabled.otx).toBe(true);
    expect(merged.enrichmentSourceEnabled.virustotal).toBe(false);
    expect(merged.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
  });
});

describe("built-in CTI Hunting threat profile", () => {
  it("ships a complete profile with CTI hunting pivots and tray-first layout via CTI mode", () => {
    expect(isCompleteThreatProfile(BUILT_IN_THREAT_PROFILE_CTI_HUNTING)).toBe(true);
    expect(BUILT_IN_THREAT_PROFILE_CTI_HUNTING.id).toBe(
      BUILT_IN_THREAT_PROFILE_ID_CTI
    );
    expect(BUILT_IN_THREAT_PROFILE_CTI_HUNTING.name).toBe("CTI Hunting");
    expect(BUILT_IN_THREAT_PROFILE_CTI_HUNTING.defaultExportTemplateId).toBe(
      "markdown-report"
    );
    expect(BUILT_IN_THREAT_PROFILE_CTI_HUNTING.analystMode).toBe(
      ANALYST_MODE_PRESET_CTI_ID
    );
    expect(BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS[0]).toBe("otx");
    expect(
      getBuiltInThreatProfileById(BUILT_IN_THREAT_PROFILE_ID_CTI)
    ).toEqual(BUILT_IN_THREAT_PROFILE_CTI_HUNTING);
    expect(JSON.stringify(BUILT_IN_THREAT_PROFILE_CTI_HUNTING)).not.toMatch(
      /apiKey|token|password|credential/i
    );
  });

  it("applies CTI platform pivot emphasis and tray-first workspace layout without touching keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      showDisabledSourcesInWorkspace: false,
      apiKeys: { otx: TEST_FIXTURE_STORED_API_KEY },
    };

    const mapped = mapThreatProfileToAnalystModeStorage(
      BUILT_IN_THREAT_PROFILE_CTI_HUNTING
    );
    expect(mapped.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(mapped.defaultExportTemplateId).toBe("markdown-report");
    expect(mapped.pivotEmphasisProviders).toEqual([
      ...BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS,
    ]);
    expect(mapped.pivotEmphasisProviders?.[0]).toBe("otx");

    const merged = applyImportedThreatProfile(
      current,
      BUILT_IN_THREAT_PROFILE_CTI_HUNTING,
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    expect(merged.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(merged.showDisabledSourcesInWorkspace).toBe(true);
    expect(merged.pivotEmphasisProviders[0]).toBe("otx");
    expect(merged.enrichmentSourceEnabled.otx).toBe(true);
    expect(merged.enrichmentSourceEnabled.threatfox).toBe(true);
    expect(merged.apiKeys).toEqual({ otx: TEST_FIXTURE_STORED_API_KEY });
  });
});

describe("built-in threat profile switching", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates analyst mode and default export template id when switching built-in profiles", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);

    await importThreatProfileJson(
      JSON.stringify(BUILT_IN_THREAT_PROFILE_SOC_TRIAGE),
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    const afterSoc = await getVera5Settings();
    expect(afterSoc.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(afterSoc.defaultExportTemplateId).toBe(
      BUILT_IN_THREAT_PROFILE_SOC_TRIAGE.defaultExportTemplateId
    );
    expect(afterSoc.defaultExportTemplateId).toBe("csv-row");

    await importThreatProfileJson(
      JSON.stringify(BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH),
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    const afterMalware = await getVera5Settings();
    expect(afterMalware.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(afterMalware.defaultExportTemplateId).toBe(
      BUILT_IN_THREAT_PROFILE_MALWARE_RESEARCH.defaultExportTemplateId
    );
    expect(afterMalware.defaultExportTemplateId).toBe("markdown-report");
    expect(afterMalware.analystModePresetId).not.toBe(
      afterSoc.analystModePresetId
    );
    expect(afterMalware.defaultExportTemplateId).not.toBe(
      afterSoc.defaultExportTemplateId
    );
    expect(afterMalware.apiKeys).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });

    await importThreatProfileJson(
      JSON.stringify(BUILT_IN_THREAT_PROFILE_CTI_HUNTING),
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    const afterCti = await getVera5Settings();
    expect(afterCti.analystModePresetId).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(afterCti.defaultExportTemplateId).toBe(
      BUILT_IN_THREAT_PROFILE_CTI_HUNTING.defaultExportTemplateId
    );
    expect(afterCti.defaultExportTemplateId).toBe("markdown-report");
    expect(afterCti.apiKeys).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    expect(await getActiveThreatProfileState()).toMatchObject({
      id: BUILT_IN_THREAT_PROFILE_ID_CTI,
      lastImportMergeMode: THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE,
    });
  });
});

describe("threat profile export", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports active profile JSON from settings without API keys", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_API_KEYS] = {
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    };

    const json = await exportThreatProfileJson();
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.threatProfileSchemaVersion).toBe(THREAT_PROFILE_SCHEMA_VERSION);
    expect(parsed.id).toBe(ACTIVE_THREAT_PROFILE_ID);
    expect(parsed.apiKeys).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(isThreatProfileDocument(parsed)).toBe(true);
    expect(isCompleteThreatProfile(parsed as never)).toBe(true);
  });

  it("captures enabled connectors, analyst mode, template, and quiet mode", () => {
    const settings = {
      ...createDefaultVera5Settings(),
      enrichmentSourceEnabled: {
        ...createDefaultVera5Settings().enrichmentSourceEnabled,
        abuseipdb: true,
        otx: true,
        rdap_whois: false,
      },
      analystModePresetId: ANALYST_MODE_PRESET_SOC_ID,
      defaultExportTemplateId: "jira-comment" as const,
      quietMode: true,
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };

    const profile = buildThreatProfileDocumentFromSettings(settings);

    expect(profile.enabledConnectors).toContain("abuseipdb");
    expect(profile.enabledConnectors).toContain("otx");
    expect(profile.enabledConnectors).not.toContain("rdap_whois");
    expect(profile.analystMode).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(profile.pivotRecipeSetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(profile.defaultExportTemplateId).toBe("jira-comment");
    expect(profile.quietModeDefault).toBe(true);
    expect(JSON.stringify(profile)).not.toContain(TEST_FIXTURE_STORED_API_KEY);
  });

  it("uses custom mode when no analyst preset is set", () => {
    const profile = buildThreatProfileDocumentFromSettings(createDefaultVera5Settings());
    expect(profile.analystMode).toBe(ACTIVE_THREAT_PROFILE_CUSTOM_MODE_ID);
    expect(profile.pivotRecipeSetId).toBe(ACTIVE_THREAT_PROFILE_CUSTOM_MODE_ID);
  });

  it("validateThreatProfileExport rejects secret-like keys", () => {
    expect(() =>
      validateThreatProfileExport({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "active",
        name: "Active profile",
        description: "Test",
        enabledConnectors: [],
        pivotRecipeSetId: "soc",
        defaultExportTemplateId: "jira-comment",
        analystMode: "soc",
        quietModeDefault: false,
        apiKey: "should-not-export",
      } as never)
    ).toThrow(SettingsPackImportError);
  });

  it("serializeThreatProfile includes schema version and strips secrets", () => {
    const json = serializeThreatProfile({
      ...createDefaultVera5Settings(),
      apiKeys: { otx: TEST_FIXTURE_STORED_API_KEY },
      quietMode: true,
    });
    const parsed = JSON.parse(json) as { threatProfileSchemaVersion: number };

    expect(parsed.threatProfileSchemaVersion).toBe(THREAT_PROFILE_SCHEMA_VERSION);
    expect(json).not.toContain(TEST_FIXTURE_STORED_API_KEY);
  });

  it("downloads threat profile JSON with the default filename", () => {
    const createObjectURL = vi.fn(() => "blob:threat-profile");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const createElementSpy = vi.spyOn(document, "createElement");

    downloadThreatProfileExport('{"threatProfileSchemaVersion":1}');

    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    const anchor = createElementSpy.mock.results.find(
      (result) => result.value instanceof HTMLAnchorElement
    )?.value as HTMLAnchorElement;
    expect(anchor.download).toBe(THREAT_PROFILE_EXPORT_FILENAME);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:threat-profile");

    clickSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});

describe("threat profile import", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes quietModeDefault from threat profile JSON", () => {
    const profile = normalizeThreatProfileDocument({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "restricted-dfir",
      quietModeDefault: true,
      enabledConnectors: ["abuseipdb"],
    });

    expect(profile.quietModeDefault).toBe(true);
    expect(profile.id).toBe("restricted-dfir");
  });

  it("normalizes the versioned ThreatProfile schema fields", () => {
    const profile = normalizeThreatProfileDocument({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "soc-triage",
      name: "SOC triage",
      description: "Dashboard-first connectors and ticket export defaults.",
      enabledConnectors: ["abuseipdb", "otx"],
      pivotRecipeSetId: "soc-triage",
      defaultExportTemplateId: "jira-comment",
      analystMode: "soc",
      quietModeDefault: false,
      noiseListRef: "soc-dashboard-starter",
    });

    expect(profile).toEqual({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "soc-triage",
      name: "SOC triage",
      description: "Dashboard-first connectors and ticket export defaults.",
      enabledConnectors: ["abuseipdb", "otx"],
      pivotRecipeSetId: "soc-triage",
      defaultExportTemplateId: "jira-comment",
      analystMode: "soc",
      quietModeDefault: false,
      noiseListRef: "soc-dashboard-starter",
    });
    expect(isCompleteThreatProfile(profile)).toBe(true);
  });

  it("maps legacy label into name when name is omitted", () => {
    const profile = normalizeThreatProfileDocument({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "cti-research",
      label: "CTI research",
      enabledConnectors: ["otx"],
    });

    expect(profile.name).toBe("CTI research");
    expect(profile.label).toBeUndefined();
  });

  it("merges quietModeDefault onto Vera5 settings without touching API keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: false,
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };
    const merged = mergeImportedThreatProfile(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      quietModeDefault: true,
    });

    expect(merged.quietMode).toBe(true);
    expect(merged.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
  });

  it("leaves quiet mode unchanged when quietModeDefault is omitted", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: false,
    };
    const merged = mergeImportedThreatProfile(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      pivotRecipeSetId: "soc-triage",
      enabledConnectors: ["otx"],
    });

    expect(merged.quietMode).toBe(false);
  });

  it("imports quietModeDefault into storage", async () => {
    store[STORAGE_KEY_QUIET_MODE] = false;
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: TEST_FIXTURE_STORED_API_KEY };

    await importThreatProfileJson(
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "restricted-dfir",
        quietModeDefault: true,
        enabledConnectors: ["abuseipdb"],
      })
    );

    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(true);
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });

  it("builds a quiet mode diff for threat profile import preview", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: false,
    };
    const changes = buildThreatProfileImportDiff(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      quietModeDefault: true,
    });

    expect(changes).toEqual([
      {
        field: "quietMode",
        label: "Quiet mode",
        currentValue: "Disabled",
        incomingValue: "Enabled",
      },
    ]);
  });

  it("builds threat profile import preview from JSON", () => {
    const preview = buildThreatProfileImportPreview(
      { ...createDefaultVera5Settings(), quietMode: true },
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        quietModeDefault: false,
      })
    );

    expect(preview.mergeMode).toBe(
      THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
    );
    expect(preview.profile.quietModeDefault).toBe(false);
    expect(preview.changes).toEqual([
      {
        field: "quietMode",
        label: "Quiet mode",
        currentValue: "Enabled",
        incomingValue: "Disabled",
      },
    ]);
  });

  it("apply-as-new-active resets overlapping fields then applies profile without touching keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: true,
      analystModePresetId: ANALYST_MODE_PRESET_CTI_ID,
      defaultExportTemplateId: "markdown-report" as const,
      enrichmentSourceEnabled: {
        ...createDefaultVera5Settings().enrichmentSourceEnabled,
        abuseipdb: true,
        otx: true,
        rdap_whois: true,
      },
      enrichmentCacheTtlSeconds: 999,
      domainDenylist: ["evil.example"],
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };

    const base = buildThreatProfileApplyAsNewActiveBase(current);
    expect(base.quietMode).toBe(false);
    expect(base.analystModePresetId).toBe("");
    expect(base.enrichmentSourceEnabled.abuseipdb).toBe(
      createDefaultVera5Settings().enrichmentSourceEnabled.abuseipdb
    );
    expect(base.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
    expect(base.enrichmentCacheTtlSeconds).toBe(999);
    expect(base.domainDenylist).toEqual(["evil.example"]);

    const applied = applyImportedThreatProfile(
      current,
      {
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        enabledConnectors: ["otx"],
        quietModeDefault: true,
        analystMode: ANALYST_MODE_PRESET_SOC_ID,
      },
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    expect(applied.quietMode).toBe(true);
    expect(applied.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(applied.enrichmentSourceEnabled.otx).toBe(true);
    expect(applied.enrichmentSourceEnabled.abuseipdb).toBe(false);
    expect(applied.enrichmentSourceEnabled.rdap_whois).toBe(false);
    expect(applied.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
    expect(applied.enrichmentCacheTtlSeconds).toBe(999);
  });

  it("merge-into-current leaves unspecified connectors unchanged", () => {
    const current = {
      ...createDefaultVera5Settings(),
      enrichmentSourceEnabled: {
        ...createDefaultVera5Settings().enrichmentSourceEnabled,
        abuseipdb: true,
        otx: false,
      },
      quietMode: false,
    };

    const merged = applyImportedThreatProfile(
      current,
      {
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        quietModeDefault: true,
      },
      THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
    );

    expect(merged.quietMode).toBe(true);
    expect(merged.enrichmentSourceEnabled.abuseipdb).toBe(true);
    expect(merged.enrichmentSourceEnabled.otx).toBe(false);
  });

  it("apply-as-new-active import preview includes reset diffs beyond profile fields", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: true,
      analystModePresetId: ANALYST_MODE_PRESET_CTI_ID,
      enrichmentSourceEnabled: {
        ...createDefaultVera5Settings().enrichmentSourceEnabled,
        abuseipdb: true,
      },
    };

    const preview = buildThreatProfileImportPreview(
      current,
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        quietModeDefault: false,
      }),
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    expect(preview.mergeMode).toBe(
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );
    expect(preview.changes.some((change) => change.field === "quietMode")).toBe(
      true
    );
    expect(
      preview.changes.some((change) => change.field === "analystModePresetId")
    ).toBe(true);
    expect(
      preview.changes.some(
        (change) => change.field === "enrichmentSourceEnabled.abuseipdb"
      )
    ).toBe(true);
  });

  it("records active profile indicator metadata on import without storing keys", async () => {
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: TEST_FIXTURE_STORED_API_KEY };

    const importedAt = "2026-07-25T18:00:00.000Z";
    const afterApply = buildActiveThreatProfileStateAfterImport(
      createEmptyActiveThreatProfileState(),
      {
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "soc-triage",
        name: "SOC triage",
        quietModeDefault: true,
      },
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE,
      importedAt
    );

    expect(afterApply).toEqual({
      id: "soc-triage",
      name: "SOC triage",
      lastImportedAt: importedAt,
      lastImportMergeMode: THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE,
    });
    expect(formatActiveThreatProfileIndicator(afterApply)).toBe(
      "SOC triage (soc-triage)"
    );
    expect(formatThreatProfileLastImportedAt(createEmptyActiveThreatProfileState())).toBe(
      "Never"
    );

    await importThreatProfileJson(
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "cti-research",
        name: "CTI research",
        quietModeDefault: true,
      }),
      THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
    );

    const stored = store[STORAGE_KEY_ACTIVE_THREAT_PROFILE] as Record<
      string,
      unknown
    >;
    expect(stored.id).toBe("cti-research");
    expect(stored.name).toBe("CTI research");
    expect(typeof stored.lastImportedAt).toBe("string");
    expect(JSON.stringify(stored)).not.toContain(TEST_FIXTURE_STORED_API_KEY);
    expect(await getActiveThreatProfileState()).toMatchObject({
      id: "cti-research",
      name: "CTI research",
      lastImportMergeMode: THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT,
    });
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
  });

  it("rejects settings pack JSON on threat profile import", () => {
    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify(
          buildSettingsPackDocument(createDefaultVera5Settings())
        )
      )
    ).toThrow(SettingsPackImportError);
  });

  it("normalizes connectorConfidenceMetadataOverrides from threat profile JSON", () => {
    const profile = normalizeThreatProfileDocument({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "cti-metadata",
      connectorConfidenceMetadataOverrides: {
        otx: { reliabilityTier: "authoritative", sourceClass: "community" },
        urlscan: { freshnessPolicy: "stable" },
      },
    });

    expect(profile.connectorConfidenceMetadataOverrides).toEqual({
      otx: { reliabilityTier: "authoritative", sourceClass: "community" },
      urlscan: { freshnessPolicy: "stable" },
    });
  });

  it("merges metadata overrides onto Vera5 settings without touching API keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      connectorConfidenceMetadataOverrides: {},
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };
    const merged = mergeImportedThreatProfile(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      connectorConfidenceMetadataOverrides: {
        greynoise: { freshnessPolicy: "stable" },
      },
    });

    expect(merged.connectorConfidenceMetadataOverrides).toEqual({
      greynoise: { freshnessPolicy: "stable" },
    });
    expect(merged.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
  });

  it("leaves metadata overrides unchanged when connectorConfidenceMetadataOverrides is omitted", () => {
    const current = {
      ...createDefaultVera5Settings(),
      connectorConfidenceMetadataOverrides: {
        otx: { reliabilityTier: "authoritative" },
      },
    };
    const merged = mergeImportedThreatProfile(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      quietModeDefault: true,
    });

    expect(merged.connectorConfidenceMetadataOverrides).toEqual({
      otx: { reliabilityTier: "authoritative" },
    });
  });

  it("imports metadata overrides into storage without keys", async () => {
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: TEST_FIXTURE_STORED_API_KEY };

    await importThreatProfileJson(
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "metadata-profile",
        connectorConfidenceMetadataOverrides: {
          otx: { reliabilityTier: "authoritative" },
          urlscan: { freshnessPolicy: "stable" },
        },
      })
    );

    expect(store[STORAGE_KEY_CONNECTOR_CONFIDENCE_METADATA_OVERRIDES]).toEqual({
      otx: { reliabilityTier: "authoritative" },
      urlscan: { freshnessPolicy: "stable" },
    });
    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    const settings = await getVera5Settings();
    expect(
      settings.connectorConfidenceMetadataOverrides[ENRICHMENT_SOURCE.OTX]
    ).toEqual({ reliabilityTier: "authoritative" });
  });

  it("builds metadata diff for threat profile import preview", () => {
    const current = {
      ...createDefaultVera5Settings(),
      connectorConfidenceMetadataOverrides: {},
    };
    const changes = buildThreatProfileImportDiff(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      connectorConfidenceMetadataOverrides: {
        greynoise: { freshnessPolicy: "stable" },
      },
    });

    expect(changes.some((entry) => entry.field === "connectorConfidenceMetadataOverrides")).toBe(
      true
    );
  });

  it("rejects invalid connector confidence metadata in threat profile JSON", () => {
    expect(() =>
      normalizeThreatProfileDocument({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        connectorConfidenceMetadataOverrides: {
          otx: { reliabilityTier: "not-a-tier" },
        },
      })
    ).toThrow(SettingsPackImportError);
  });

  it("rejects unknown connector ids in threat profile metadata overrides", () => {
    expect(() =>
      normalizeThreatProfileDocument({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        connectorConfidenceMetadataOverrides: {
          unknown_source: { reliabilityTier: "community" },
        },
      })
    ).toThrow(SettingsPackImportError);
  });

  it("rejects unknown metadata fields in threat profile overrides", () => {
    expect(() =>
      normalizeThreatProfileDocument({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        connectorConfidenceMetadataOverrides: {
          otx: { reliabilityTier: "authoritative", scoreWeight: 2 },
        },
      })
    ).toThrow(SettingsPackImportError);
  });

  it("rejects threat profile JSON that contains secrets alongside metadata", () => {
    expect(() =>
      normalizeThreatProfileDocument({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        connectorConfidenceMetadataOverrides: {
          otx: { reliabilityTier: "authoritative" },
        },
        apiKeys: { abuseipdb: "leaked" },
      })
    ).toThrow(SettingsPackImportError);
  });

  it("rejects threat profile parse when apiKey, token, or credential fields are present", () => {
    const base = {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      id: "soc-triage",
      name: "SOC triage",
      description: "No secrets allowed.",
      enabledConnectors: ["abuseipdb"],
      pivotRecipeSetId: "soc-triage",
      defaultExportTemplateId: "jira-comment",
      analystMode: "soc",
      quietModeDefault: false,
    };

    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify({ ...base, apiKey: "leaked-key" })
      )
    ).toThrow(/API keys, tokens, raw credentials/);

    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify({ ...base, token: "leaked-token" })
      )
    ).toThrow(/API keys, tokens, raw credentials/);

    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify({ ...base, accessToken: "leaked-access-token" })
      )
    ).toThrow(/API keys, tokens, raw credentials/);

    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify({
          ...base,
          vendor: { credential: "raw-vendor-secret" },
        })
      )
    ).toThrow(/API keys, tokens, raw credentials/);

    expect(() =>
      parseThreatProfileDocument(
        JSON.stringify({ ...base, password: "not-a-profile-field" })
      )
    ).toThrow(/API keys, tokens, raw credentials/);
  });

  it("rejects importThreatProfileJson when schema is invalid or key-like fields are present", async () => {
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: TEST_FIXTURE_STORED_API_KEY };
    store[STORAGE_KEY_QUIET_MODE] = false;

    await expect(
      importThreatProfileJson(
        JSON.stringify({
          threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
          quietModeDefault: true,
          apiKey: "leaked-key",
        })
      )
    ).rejects.toThrow(SettingsPackImportError);

    await expect(
      importThreatProfileJson(
        JSON.stringify({
          threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
          quietModeDefault: true,
          token: "leaked-token",
        })
      )
    ).rejects.toThrow(SettingsPackImportError);

    await expect(
      importThreatProfileJson(
        JSON.stringify({
          threatProfileSchemaVersion: 99,
          quietModeDefault: true,
        })
      )
    ).rejects.toThrow(SettingsPackImportError);

    await expect(
      importThreatProfileJson(
        JSON.stringify(buildSettingsPackDocument(createDefaultVera5Settings()))
      )
    ).rejects.toThrow(SettingsPackImportError);

    expect(store[STORAGE_KEY_API_KEYS]).toEqual({
      abuseipdb: TEST_FIXTURE_STORED_API_KEY,
    });
    expect(store[STORAGE_KEY_QUIET_MODE]).toBe(false);
  });

  it("round-trips export → import to equivalent active settings (mocked storage)", async () => {
    await setApiKey("abuseipdb", TEST_FIXTURE_STORED_API_KEY);
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] = 5400;
    store[STORAGE_KEY_DOMAIN_POLICY_MODE] = DOMAIN_POLICY_MODE_DENY_BY_DEFAULT;

    await applyAnalystModePreset(ANALYST_MODE_PRESET_SOC_ID);
    await setEnrichmentSourceEnabled("abuseipdb", true);
    await setEnrichmentSourceEnabled("otx", true);
    await setEnrichmentSourceEnabled("rdap_whois", false);
    await setQuietMode(true);
    await setDefaultExportTemplateId("csv-row");

    const before = await getVera5Settings();
    const exportJson = await exportThreatProfileJson();
    expect(exportJson).not.toContain(TEST_FIXTURE_STORED_API_KEY);

    await applyAnalystModePreset(ANALYST_MODE_PRESET_CTI_ID);
    await setQuietMode(false);
    await setDefaultExportTemplateId("markdown-report");
    await setEnrichmentSourceEnabled("abuseipdb", false);
    await setEnrichmentSourceEnabled("otx", false);
    await setEnrichmentSourceEnabled("rdap_whois", true);

    await importThreatProfileJson(
      exportJson,
      THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE
    );

    const after = await getVera5Settings();

    expect(after.analystModePresetId).toBe(before.analystModePresetId);
    expect(after.defaultExportTemplateId).toBe(before.defaultExportTemplateId);
    expect(after.quietMode).toBe(before.quietMode);
    expect(after.enrichmentSourceEnabled).toEqual(before.enrichmentSourceEnabled);
    expect(after.pivotEmphasisProviders).toEqual(before.pivotEmphasisProviders);
    expect(after.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
    expect(after.enrichmentCacheTtlSeconds).toBe(5400);
    expect(after.domainPolicyMode).toBe(DOMAIN_POLICY_MODE_DENY_BY_DEFAULT);

    const reexported = JSON.parse(await exportThreatProfileJson()) as Record<
      string,
      unknown
    >;
    const original = JSON.parse(exportJson) as Record<string, unknown>;
    expect(reexported).toEqual(original);
    expect(reexported.apiKeys).toBeUndefined();

    expect(await getActiveThreatProfileState()).toMatchObject({
      id: ACTIVE_THREAT_PROFILE_ID,
      lastImportMergeMode: THREAT_PROFILE_IMPORT_MERGE_MODE.APPLY_AS_NEW_ACTIVE,
    });
  });

  it("does not bypass trust consent gates when profile import enables connectors", async () => {
    store[STORAGE_KEY_SHOW_PRE_QUERY_NOTICES] = true;
    store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
    store[STORAGE_KEY_MANUAL_ONLY_MODE] = true;
    store[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = false;
    store[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_CONSENT_ACKNOWLEDGED] = false;
    store[STORAGE_KEY_API_KEYS] = { abuseipdb: TEST_FIXTURE_STORED_API_KEY };

    await importThreatProfileJson(
      JSON.stringify({
        threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
        id: "connectors-only",
        enabledConnectors: ["abuseipdb", "otx"],
        showPreQueryNotices: false,
        domainPolicyEnrichGateEnabled: false,
        manualOnlyMode: false,
        attributeHrefExtractionEnabled: true,
        attributeHrefExtractionConsentAcknowledged: true,
      }),
      THREAT_PROFILE_IMPORT_MERGE_MODE.MERGE_INTO_CURRENT
    );

    const after = await getVera5Settings();

    expect(after.enrichmentSourceEnabled.abuseipdb).toBe(true);
    expect(after.enrichmentSourceEnabled.otx).toBe(true);
    expect(after.showPreQueryNotices).toBe(true);
    expect(after.domainPolicyEnrichGateEnabled).toBe(true);
    expect(after.manualOnlyMode).toBe(true);
    expect(after.attributeHrefExtractionEnabled).toBe(false);
    expect(after.attributeHrefExtractionConsentAcknowledged).toBe(false);
    expect(after.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
  });

  it("maps enabledConnectors onto connector-profile enrichmentSourceEnabled", () => {
    const current = createDefaultVera5Settings();
    const enabled = mapThreatProfileEnabledConnectorsToEnrichmentSourceEnabled(
      ["abuseipdb", "otx"],
      current.enrichmentSourceEnabled
    );

    expect(enabled.abuseipdb).toBe(true);
    expect(enabled.otx).toBe(true);
    expect(enabled.rdap_whois).toBe(false);
    expect(
      mapThreatProfileToConnectorProfilePreferences(
        {
          threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
          enabledConnectors: ["abuseipdb", "otx"],
        },
        current
      ).enrichmentSourceEnabled
    ).toEqual(enabled);
  });

  it("maps analystMode and pivotRecipeSetId onto preset storage shapes", () => {
    expect(resolvePivotRecipeSetPresetId("malware-research")).toBe("cti");
    expect(resolvePivotRecipeSetPresetId("soc-triage")).toBe("soc");

    const mapped = mapThreatProfileToAnalystModeStorage({
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      analystMode: "soc",
      pivotRecipeSetId: "malware-research",
      defaultExportTemplateId: "thehive-case-note",
      quietModeDefault: true,
    });

    expect(mapped.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(mapped.defaultExportTemplateId).toBe("thehive-case-note");
    expect(mapped.quietMode).toBe(true);
    expect(mapped.pivotEmphasisProviders?.[0]).toBe("virustotal");
    expect(mapped.pivotEmphasisProviders?.[1]).toBe("urlscan");
  });

  it("merges profile fields onto Vera5 settings without touching API keys", () => {
    const current = {
      ...createDefaultVera5Settings(),
      quietMode: false,
      enrichmentSourceEnabled: {
        ...createDefaultVera5Settings().enrichmentSourceEnabled,
        abuseipdb: false,
        otx: false,
        rdap_whois: true,
      },
      apiKeys: { abuseipdb: TEST_FIXTURE_STORED_API_KEY },
    };

    const merged = mergeImportedThreatProfile(current, {
      threatProfileSchemaVersion: THREAT_PROFILE_SCHEMA_VERSION,
      analystMode: "soc",
      enabledConnectors: ["abuseipdb", "otx"],
      defaultExportTemplateId: "jira-comment",
      pivotRecipeSetId: "soc-triage",
      quietModeDefault: true,
      noiseListRef: "soc-dashboard-starter",
    });

    expect(merged.apiKeys).toEqual({ abuseipdb: TEST_FIXTURE_STORED_API_KEY });
    expect(merged.analystModePresetId).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(merged.defaultExportTemplateId).toBe("jira-comment");
    expect(merged.quietMode).toBe(true);
    expect(merged.enrichmentSourceEnabled.abuseipdb).toBe(true);
    expect(merged.enrichmentSourceEnabled.otx).toBe(true);
    expect(merged.enrichmentSourceEnabled.rdap_whois).toBe(false);
    expect(merged.pivotEmphasisProviders[0]).toBe("abuseipdb");
    expect(merged).not.toHaveProperty("noiseListRef");
  });
});
