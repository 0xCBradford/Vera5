import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKnownGoodEntry,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_IMPORT_MERGE_MODE,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
} from "./knownGood";
import {
  STORAGE_KEY_KNOWN_GOOD_LIST,
  clearStoredKnownGoodList,
  deleteStoredKnownGoodEntry,
  exportStoredKnownGoodListJson,
  formatKnownGoodImportStatus,
  getKnownGoodListStore,
  importKnownGoodCdnSaasStarterEntries,
  importKnownGoodListFromJson,
  KnownGoodExportError,
  KnownGoodImportError,
  listStoredKnownGoodEntries,
  listStoredKnownGoodEntriesForMatching,
  shouldSkipOutboundEnrichForKnownGoodMatch,
  parseKnownGoodImportCsv,
  serializeKnownGoodCdnSaasStarterExportJson,
  serializeKnownGoodExportJson,
  setStoredKnownGoodCategoryEnabled,
  syncKnownGoodEntryLabelFromWatchlistPromotion,
  updateStoredKnownGoodEntry,
  upsertStoredKnownGoodEntry,
  validateKnownGoodExportDocument,
  detectKnownGoodImportFormat,
  importKnownGoodListFromCsv,
  importKnownGoodListFromText,
  KNOWN_GOOD_CSV_HEADER,
} from "./knownGoodStorage";

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

describe("knownGoodStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(async () => {
    await clearStoredKnownGoodList();
    vi.unstubAllGlobals();
  });

  it("persists entries only in chrome.storage.local under knownGoodList", async () => {
    const entry = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/12",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    await upsertStoredKnownGoodEntry(entry);

    expect(store[STORAGE_KEY_KNOWN_GOOD_LIST]).toMatchObject({
      schemaVersion: 1,
      entries: [
        expect.objectContaining({
          id: entry.id,
          category: "cdn",
          pattern: "104.16.0.0/12",
        }),
      ],
    });
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({ id: entry.id }),
    ]);
  });

  it("upserts by id without duplicating", async () => {
    const entry = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "login.example.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    await upsertStoredKnownGoodEntry(entry);
    await upsertStoredKnownGoodEntry({
      ...entry,
      labelText: "Changed label",
    });

    const listed = await listStoredKnownGoodEntries();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.labelText).toBe(KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN);
  });

  it("updates, deletes, and clears stored entries", async () => {
    const entry = createKnownGoodEntry({
      id: "kg-manage",
      category: KNOWN_GOOD_CATEGORY.INTERNAL,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "10.0.0.1",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    await upsertStoredKnownGoodEntry(entry);

    await updateStoredKnownGoodEntry({
      ...entry,
      labelText: "Corp host",
    });
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({ id: "kg-manage", labelText: "Corp host" }),
    ]);

    expect(await deleteStoredKnownGoodEntry("kg-manage")).toBe(true);
    expect(await listStoredKnownGoodEntries()).toEqual([]);

    await upsertStoredKnownGoodEntry(entry);
    await clearStoredKnownGoodList();
    expect(await getKnownGoodListStore()).toMatchObject({ entries: [] });
    expect(store[STORAGE_KEY_KNOWN_GOOD_LIST]).toBeUndefined();
  });

  it("exports inspectable JSON without secrets and round-trips import", async () => {
    const entry = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CORP_VPN,
      matchType: KNOWN_GOOD_MATCH_TYPE.ASN,
      pattern: "AS64500",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    await upsertStoredKnownGoodEntry(entry);

    const json = await exportStoredKnownGoodListJson("2026-07-26T12:00:00.000Z");
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      exportedAt: string;
      entries: unknown[];
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportedAt).toBe("2026-07-26T12:00:00.000Z");
    expect(parsed.entries).toHaveLength(1);
    expect(Object.keys(parsed).sort()).toEqual([
      "entries",
      "exportedAt",
      "schemaVersion",
    ]);
    expect(json).not.toMatch(/apiKey|api_key|token|secret|password/i);
    expect(serializeKnownGoodExportJson([])).toContain('"entries": []');
    expect(
      validateKnownGoodExportDocument(parsed as never)
    ).toMatchObject({ schemaVersion: 1 });

    await clearStoredKnownGoodList();
    const result = await importKnownGoodListFromJson(json);
    expect(result.importedCount).toBe(1);
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({
        category: "corp_vpn",
        matchType: "asn",
        pattern: "AS64500",
      }),
    ]);
  });

  it("round-trips import so listed values match and unlisted IOCs do not", async () => {
    const { findMatchingKnownGoodEntry } = await import("./knownGood");
    const listed = createKnownGoodEntry({
      id: "kg-round-trip-cdn",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "1.1.1.1",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    await upsertStoredKnownGoodEntry(listed);

    const json = await exportStoredKnownGoodListJson("2026-07-26T18:00:00.000Z");
    await clearStoredKnownGoodList();
    expect(await listStoredKnownGoodEntries()).toEqual([]);

    const imported = await importKnownGoodListFromJson(json);
    expect(imported.importedCount).toBe(1);
    const restored = await listStoredKnownGoodEntriesForMatching();
    expect(findMatchingKnownGoodEntry(restored, "1.1.1.1")?.pattern).toBe("1.1.1.1");
    expect(
      findMatchingKnownGoodEntry(restored, "185.220.101.1")
    ).toBeNull();
  });

  it("rejects import JSON that contains secrets", async () => {
    await expect(
      importKnownGoodListFromJson(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: "2026-07-26T00:00:00.000Z",
          entries: [],
          apiKey: "should-not-appear",
        })
      )
    ).rejects.toBeInstanceOf(KnownGoodImportError);

    await expect(
      importKnownGoodListFromJson(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: "2026-07-26T00:00:00.000Z",
          entries: [
            {
              id: "kg-bad",
              category: "cdn",
              matchType: "domain",
              pattern: "cdn.example",
              labelText: "Known benign",
              token: "nope",
            },
          ],
        })
      )
    ).rejects.toBeInstanceOf(KnownGoodImportError);
  });

  it("rejects import entries that carry silent verdict or score fields", async () => {
    const result = await importKnownGoodListFromJson(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-07-26T00:00:00.000Z",
        entries: [
          {
            id: "kg-verdict",
            category: "cdn",
            matchType: "domain",
            pattern: "cdn.example",
            labelText: "Known benign",
            verdict: "safe",
          },
        ],
      })
    );
    expect(result.importedCount).toBe(0);
    expect(result.invalid.length).toBe(1);
    expect(result.invalid[0]?.message).toMatch(/informational label only/i);
    expect(await listStoredKnownGoodEntries()).toEqual([]);
  });

  it("skips duplicates on add-only and supports replace-all with confirmation", async () => {
    const existing = createKnownGoodEntry({
      id: "kg-existing",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.example",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    await upsertStoredKnownGoodEntry(existing);

    const addOnly = await importKnownGoodListFromJson(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-07-26T00:00:00.000Z",
        entries: [
          existing,
          createKnownGoodEntry({
            id: "kg-new",
            category: KNOWN_GOOD_CATEGORY.SAAS,
            matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
            pattern: "saas.example",
            labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
          }),
        ],
      }),
      KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY
    );
    expect(addOnly.importedCount).toBe(1);
    expect(addOnly.duplicates.length).toBe(1);
    expect(formatKnownGoodImportStatus(addOnly)).toMatch(/duplicate/i);
    expect(await listStoredKnownGoodEntries()).toHaveLength(2);

    const replacement = createKnownGoodEntry({
      id: "kg-only",
      category: KNOWN_GOOD_CATEGORY.VULN_SCANNER,
      matchType: KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX,
      pattern: "deadbeef",
      labelText: "Scanner fingerprint",
    });
    const replaced = await importKnownGoodListFromJson(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-07-26T00:00:00.000Z",
        entries: [replacement],
      }),
      KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL,
      { confirmReplace: () => true }
    );
    expect(replaced.importedCount).toBe(1);
    expect(replaced.replacedExistingCount).toBe(2);
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({ id: "kg-only", matchType: "hash-prefix" }),
    ]);
  });

  it("rejects invalid export documents and cancelled replace-all", async () => {
    expect(() =>
      validateKnownGoodExportDocument({
        schemaVersion: 1,
        exportedAt: "2026-07-26T00:00:00.000Z",
        entries: [],
        apiKey: "x",
      } as never)
    ).toThrow(KnownGoodExportError);

    await expect(
      importKnownGoodListFromJson(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: "2026-07-26T00:00:00.000Z",
          entries: [],
        }),
        KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL,
        { confirmReplace: () => false }
      )
    ).rejects.toThrow(/cancelled/i);
  });

  it("persists without network calls", async () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { sendBeacon: beaconSpy });

    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.IP,
        pattern: "1.1.1.1",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    );
    const json = await exportStoredKnownGoodListJson();
    await importKnownGoodListFromJson(json);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it("matches examples CDN/SaaS starter JSON and imports only when requested", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const examplesJson = readFileSync(
      resolve(__dirname, "../../../examples/known-good-cdn-saas-starter.json"),
      "utf8"
    ).trim();
    expect(serializeKnownGoodCdnSaasStarterExportJson().trim()).toBe(examplesJson);
    expect(await listStoredKnownGoodEntries()).toEqual([]);

    const result = await importKnownGoodCdnSaasStarterEntries();
    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.importedCount).toBe(
      (JSON.parse(examplesJson) as { entries: unknown[] }).entries.length
    );
    expect(await listStoredKnownGoodEntries()).toHaveLength(result.importedCount);
    expect(examplesJson).not.toMatch(/apiKey|api_key|token|secret|password/i);

    const second = await importKnownGoodCdnSaasStarterEntries();
    expect(second.importedCount).toBe(0);
    expect(second.duplicates.length).toBe(result.importedCount);
  });

  it("syncs known-good label text when watchlist promotes to benign or internal", async () => {
    const entry = await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-sync-promo",
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "cdn.example",
        labelText: "CDN edge",
      })
    );

    const syncedBenign = await syncKnownGoodEntryLabelFromWatchlistPromotion(
      "cdn.example",
      "benign"
    );
    expect(syncedBenign).toMatchObject({
      id: entry.id,
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({
        id: entry.id,
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      }),
    ]);

    const syncedInternal = await syncKnownGoodEntryLabelFromWatchlistPromotion(
      "cdn.example",
      "internal"
    );
    expect(syncedInternal?.labelText).toBe(KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL);

    expect(
      await syncKnownGoodEntryLabelFromWatchlistPromotion("missing.example", "benign")
    ).toBeNull();
  });

  it("detects JSON vs CSV import format from filename and content", () => {
    expect(detectKnownGoodImportFormat("list.json")).toBe("json");
    expect(detectKnownGoodImportFormat("list.csv")).toBe("csv");
    expect(detectKnownGoodImportFormat("handoff", '{"entries":[]}')).toBe("json");
    expect(
      detectKnownGoodImportFormat("handoff", `${KNOWN_GOOD_CSV_HEADER}\ncdn,domain,a.com,Known benign`)
    ).toBe("csv");
  });

  it("imports CSV with validation, duplicate skip, and invalid row rejection", async () => {
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-csv-existing",
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "cdn.example",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    );

    const csv = [
      KNOWN_GOOD_CSV_HEADER,
      'cdn,domain,cdn.example,"Known benign",kg-csv-existing',
      'saas,domain,saas.example,"Known benign",kg-csv-new',
      "cdn,domain,,Known benign,kg-csv-empty-pattern",
      "not-a-category,domain,bad.example,Known benign,kg-csv-bad-cat",
      'cdn,cidr,"104.16.0.0/12","Known benign",kg-csv-cidr',
    ].join("\n");

    const parsed = parseKnownGoodImportCsv(csv);
    expect(parsed.candidates).toHaveLength(5);

    const result = await importKnownGoodListFromCsv(csv);
    expect(result.importedCount).toBe(2);
    expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.invalid.length).toBeGreaterThanOrEqual(2);
    expect(formatKnownGoodImportStatus(result)).toMatch(/duplicate/i);
    expect(formatKnownGoodImportStatus(result)).toMatch(/invalid/i);

    const listed = await listStoredKnownGoodEntries();
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "kg-csv-existing", pattern: "cdn.example" }),
        expect.objectContaining({ id: "kg-csv-new", pattern: "saas.example" }),
        expect.objectContaining({ id: "kg-csv-cidr", pattern: "104.16.0.0/12" }),
      ])
    );
    expect(listed).toHaveLength(3);
  });

  it("rejects CSV columns that look like secrets or silent verdicts", () => {
    expect(() =>
      parseKnownGoodImportCsv(
        "category,matchType,pattern,labelText,apiKey\ncdn,domain,a.com,Known benign,secret"
      )
    ).toThrow(/API keys|secrets/i);

    expect(() =>
      parseKnownGoodImportCsv(
        "category,matchType,pattern,labelText,verdict\ncdn,domain,a.com,Known benign,safe"
      )
    ).toThrow(/informational labels only/i);

    expect(() =>
      parseKnownGoodImportCsv("pattern,labelText\ncdn.example,Known benign")
    ).toThrow(/requires category, matchType, pattern, and labelText/i);
  });

  it("imports CSV via unified text import and supports replace-all with confirmation", async () => {
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-csv-old",
        category: KNOWN_GOOD_CATEGORY.INTERNAL,
        matchType: KNOWN_GOOD_MATCH_TYPE.IP,
        pattern: "10.0.0.1",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
      })
    );

    const csv = [
      KNOWN_GOOD_CSV_HEADER,
      'saas,domain,okta.com,"Known benign",kg-csv-replace',
    ].join("\n");

    const replaced = await importKnownGoodListFromText(
      csv,
      "csv",
      KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL,
      { confirmReplace: () => true }
    );
    expect(replaced.importedCount).toBe(1);
    expect(replaced.replacedExistingCount).toBe(1);
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({ id: "kg-csv-replace", pattern: "okta.com" }),
    ]);
  });

  it("persists per-category matching toggles and filters matching lists", async () => {
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-cat-cdn",
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "cdn.example",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    );
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-cat-saas",
        category: KNOWN_GOOD_CATEGORY.SAAS,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "saas.example",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    );

    const next = await setStoredKnownGoodCategoryEnabled(
      KNOWN_GOOD_CATEGORY.CDN,
      false
    );
    expect(next.cdn).toBe(false);
    expect(next.saas).toBe(true);
    expect(await listStoredKnownGoodEntries()).toHaveLength(2);
    expect(await listStoredKnownGoodEntriesForMatching()).toEqual([
      expect.objectContaining({ id: "kg-cat-saas" }),
    ]);
    expect(await getKnownGoodListStore()).toMatchObject({
      categoryEnabled: expect.objectContaining({ cdn: false, saas: true }),
    });
  });

  it("shouldSkipOutboundEnrichForKnownGoodMatch respects policy and match", async () => {
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-skip-policy",
        category: KNOWN_GOOD_CATEGORY.SAAS,
        matchType: KNOWN_GOOD_MATCH_TYPE.IP,
        pattern: "8.8.8.8",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    );

    expect(
      await shouldSkipOutboundEnrichForKnownGoodMatch("8.8.8.8", false)
    ).toBe(false);
    expect(
      await shouldSkipOutboundEnrichForKnownGoodMatch("8.8.8.8", true)
    ).toBe(true);
    expect(
      await shouldSkipOutboundEnrichForKnownGoodMatch("1.2.3.4", true)
    ).toBe(false);
  });
});
