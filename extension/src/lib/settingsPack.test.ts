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
  isSettingsPackDocument,
  isThreatProfileDocument,
  mergeImportedSettingsPack,
  normalizeSettingsPackDocument,
  parseSettingsPackDocument,
  SETTINGS_PACK_EXPORT_FILENAME,
  SETTINGS_PACK_SCHEMA_VERSION,
  SettingsPackImportError,
  serializeSettingsPack,
  validateSettingsPackExport,
} from "./settingsPack";
import {
  API_KEY_SLOTS,
  createDefaultVera5Settings,
  getVera5Settings,
  setApiKey,
  setEnrichmentSourceEnabled,
  setManualOnlyMode,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_MANUAL_ONLY_MODE,
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
