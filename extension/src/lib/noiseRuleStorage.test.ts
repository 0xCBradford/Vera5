import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLearnedNoiseRules,
  createNoiseRule,
  listLearnedNoiseRules,
  NOISE_RULE_PATTERN_TYPE,
  NOISE_RULE_SOURCE_ACTION,
} from "./noiseRule";
import {
  STORAGE_KEY_NOISE_RULES,
  clearStoredNoiseRules,
  exportStoredNoiseRulesJson,
  formatNoiseRulesImportStatus,
  getNoiseRulesStore,
  hydrateLearnedNoiseRulesFromStorage,
  importNoiseRulesFromText,
  importSocDashboardNoiseStarterRules,
  listStoredNoiseRules,
  NoiseRulesExportError,
  NoiseRulesImportError,
  parseAndAnalyzeNoiseRulesImport,
  parseNoiseRulesImportCsv,
  parseNoiseRulesImportJson,
  serializeNoiseRulesExportJson,
  serializeSocDashboardNoiseStarterExportJson,
  upsertStoredNoiseRule,
  validateNoiseRulesExportDocument,
} from "./noiseRuleStorage";

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
}

describe("noiseRuleStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
    clearLearnedNoiseRules();
  });

  afterEach(async () => {
    await clearStoredNoiseRules();
    clearLearnedNoiseRules();
    vi.unstubAllGlobals();
  });

  it("persists rules only in chrome.storage.local under noiseRules", async () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.8.8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1_700_000_000_000,
    });

    await upsertStoredNoiseRule(rule);

    expect(store[STORAGE_KEY_NOISE_RULES]).toMatchObject({
      schemaVersion: 1,
      rules: [
        expect.objectContaining({
          id: rule.id,
          pattern: "8.8.8.8",
          sourceAction: "suppress",
        }),
      ],
    });
    expect(await listStoredNoiseRules()).toEqual([
      expect.objectContaining({ id: rule.id }),
    ]);
  });

  it("upserts by id without duplicating", async () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 1,
    });
    await upsertStoredNoiseRule(rule);
    await upsertStoredNoiseRule({ ...rule, hitCount: 5 });

    const listed = await listStoredNoiseRules();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.hitCount).toBe(0);
  });

  it("exports inspectable JSON without secrets", async () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
      pattern: ".corp.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 2,
    });
    await upsertStoredNoiseRule(rule);

    const json = await exportStoredNoiseRulesJson("2026-07-24T12:00:00.000Z");
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      exportedAt: string;
      rules: unknown[];
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportedAt).toBe("2026-07-24T12:00:00.000Z");
    expect(parsed.rules).toHaveLength(1);
    expect(Object.keys(parsed).sort()).toEqual([
      "exportedAt",
      "rules",
      "schemaVersion",
    ]);
    expect(json).not.toMatch(/apiKey|api_key|token|secret|password/i);
    expect(serializeNoiseRulesExportJson([])).toContain('"rules": []');
    expect(
      validateNoiseRulesExportDocument(parsed as never)
    ).toMatchObject({ schemaVersion: 1 });
  });

  it("hydrates the session buffer from local storage", async () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "10.0.0.0/8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 3,
    });
    await upsertStoredNoiseRule(rule);
    clearLearnedNoiseRules();
    expect(listLearnedNoiseRules()).toEqual([]);

    const hydrated = await hydrateLearnedNoiseRulesFromStorage();
    expect(hydrated).toHaveLength(1);
    expect(listLearnedNoiseRules()).toEqual([
      expect.objectContaining({ pattern: "10.0.0.0/8" }),
    ]);
  });

  it("clears durable store and session buffer", async () => {
    await upsertStoredNoiseRule(
      createNoiseRule({
        patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
        pattern: "clear.me",
        sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
        createdAt: 4,
      })
    );
    await clearStoredNoiseRules();
    expect(await getNoiseRulesStore()).toMatchObject({ rules: [] });
    expect(store[STORAGE_KEY_NOISE_RULES]).toBeUndefined();
    expect(listLearnedNoiseRules()).toEqual([]);
  });
});

describe("noise rules import", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
    clearLearnedNoiseRules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLearnedNoiseRules();
  });

  it("parses JSON export documents and validates schema", () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "192.0.2.1",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 10,
    });
    const json = serializeNoiseRulesExportJson([rule], "2026-07-24T00:00:00.000Z");
    const { candidates } = parseNoiseRulesImportJson(json);
    expect(candidates).toHaveLength(1);

    expect(() => parseNoiseRulesImportJson("{")).toThrow(NoiseRulesImportError);
    expect(() =>
      parseNoiseRulesImportJson(
        JSON.stringify({ schemaVersion: 99, rules: [] })
      )
    ).toThrow(/Unsupported noise rules import schema version/);
    expect(() =>
      parseNoiseRulesImportJson(
        JSON.stringify({ schemaVersion: 1, rules: [], apiKey: "secret" })
      )
    ).toThrow(/API keys/);
  });

  it("rejects export documents with non-handoff fields", () => {
    expect(() =>
      validateNoiseRulesExportDocument({
        schemaVersion: 1,
        exportedAt: "2026-07-24T00:00:00.000Z",
        rules: [],
        apiKey: "leak",
      } as never)
    ).toThrow(NoiseRulesExportError);
  });

  it("parses CSV rows and rejects invalid schema rows", () => {
    const csv = [
      "patternType,pattern,sourceAction",
      "exact,noise.example,suppress",
      "glob,bad.pattern,suppress",
      "exact,,benign",
    ].join("\n");
    const { candidates, invalid } = parseNoiseRulesImportCsv(csv);
    expect(candidates).toEqual([
      {
        patternType: "exact",
        pattern: "noise.example",
        sourceAction: "suppress",
      },
    ]);
    expect(invalid).toHaveLength(2);
    expect(() =>
      parseNoiseRulesImportCsv("pattern,sourceAction\nexact,suppress")
    ).toThrow(/patternType, pattern, and sourceAction/);
  });

  it("detects in-file and existing duplicates", async () => {
    const existing = createNoiseRule({
      id: "nr-existing",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "keep.me",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 1,
    });
    await upsertStoredNoiseRule(existing);

    const analysis = parseAndAnalyzeNoiseRulesImport(
      JSON.stringify({
        schemaVersion: 1,
        rules: [
          {
            schemaVersion: 1,
            id: "nr-a",
            patternType: "exact",
            pattern: "new.one",
            sourceAction: "suppress",
            createdAt: 2,
            hitCount: 0,
          },
          {
            schemaVersion: 1,
            id: "nr-a",
            patternType: "exact",
            pattern: "other",
            sourceAction: "suppress",
            createdAt: 3,
            hitCount: 0,
          },
          {
            schemaVersion: 1,
            id: "nr-b",
            patternType: "exact",
            pattern: "NEW.ONE",
            sourceAction: "suppress",
            createdAt: 4,
            hitCount: 0,
          },
          {
            schemaVersion: 1,
            id: "nr-existing",
            patternType: "exact",
            pattern: "different",
            sourceAction: "internal",
            createdAt: 5,
            hitCount: 0,
          },
          {
            schemaVersion: 1,
            id: "nr-c",
            patternType: "exact",
            pattern: "keep.me",
            sourceAction: "benign",
            createdAt: 6,
            hitCount: 0,
          },
        ],
      }),
      "json",
      await listStoredNoiseRules()
    );

    expect(analysis.accepted.map((rule) => rule.id)).toEqual(["nr-a"]);
    expect(analysis.duplicates.map((entry) => entry.reason)).toEqual([
      "import-id",
      "import-pattern",
      "existing-id",
      "existing-pattern",
    ]);
  });

  it("imports JSON and CSV add-only with duplicate skip status", async () => {
    const jsonResult = await importNoiseRulesFromText(
      JSON.stringify({
        schemaVersion: 1,
        rules: [
          {
            patternType: "domain-suffix",
            pattern: ".corp.example",
            sourceAction: "internal",
          },
        ],
      }),
      "json"
    );
    expect(jsonResult.importedCount).toBe(1);
    expect(await listStoredNoiseRules()).toHaveLength(1);

    const csv = [
      "patternType,pattern,sourceAction",
      "domain-suffix,.corp.example,internal",
      "exact,192.0.2.9,suppress",
    ].join("\n");
    const csvResult = await importNoiseRulesFromText(csv, "csv");
    expect(csvResult.importedCount).toBe(1);
    expect(csvResult.duplicates).toHaveLength(1);
    expect(formatNoiseRulesImportStatus(csvResult)).toContain("Imported 1");
    expect(formatNoiseRulesImportStatus(csvResult)).toContain("1 duplicate");
    expect(await listStoredNoiseRules()).toHaveLength(2);
  });

  it("matches examples SOC starter JSON and imports only when requested", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const examplesJson = readFileSync(
      resolve(__dirname, "../../../examples/soc-dashboard-noise-starter.json"),
      "utf8"
    ).trim();
    expect(serializeSocDashboardNoiseStarterExportJson().trim()).toBe(examplesJson);
    expect(await listStoredNoiseRules()).toEqual([]);

    const result = await importSocDashboardNoiseStarterRules();
    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.importedCount).toBe(
      JSON.parse(examplesJson).rules.length
    );
    expect(await listStoredNoiseRules()).toHaveLength(result.importedCount);
    expect(examplesJson).not.toMatch(/apiKey|api_key|token|secret|password/i);

    const second = await importSocDashboardNoiseStarterRules();
    expect(second.importedCount).toBe(0);
    expect(second.duplicates.length).toBe(result.importedCount);
  });
});
