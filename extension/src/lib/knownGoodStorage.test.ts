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
  serializeKnownGoodCdnSaasStarterExportJson,
  serializeKnownGoodExportJson,
  updateStoredKnownGoodEntry,
  upsertStoredKnownGoodEntry,
  validateKnownGoodExportDocument,
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
});
