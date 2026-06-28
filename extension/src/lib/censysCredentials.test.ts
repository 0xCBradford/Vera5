import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichWithConnectorShell } from "./enrichmentConnectorShell";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";
import {
  formatMissingCensysCredentialsMessage,
  hasCensysCredentials,
  resolveCensysCredentials,
} from "./censysCredentials";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import {
  TEST_FIXTURE_GENERIC_API_KEY,
  TEST_FIXTURE_SECONDARY_API_KEY,
} from "./fixtureSecrets";
import { IOC_TYPE } from "./iocRegex";
import { getApiKey, setApiKey } from "./storage";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === "string") {
            return Promise.resolve({ [keys]: store[keys] });
          }
          if (Array.isArray(keys)) {
            const result: Record<string, unknown> = {};
            for (const key of keys) {
              result[key] = store[key];
            }
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...store, ...keys });
        },
        set: (values: Record<string, unknown>) => {
          Object.assign(store, values);
          return Promise.resolve();
        },
      },
    },
  });
}

describe("Censys credential pair resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null when either storage slot is missing", async () => {
    await expect(
      resolveCensysCredentials({
        getApiId: async () => TEST_FIXTURE_GENERIC_API_KEY,
        getApiSecret: async () => "",
      })
    ).resolves.toBeNull();
    await expect(
      resolveCensysCredentials({
        getApiId: async () => "",
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
      })
    ).resolves.toBeNull();
    await expect(hasCensysCredentials({ getApiId: async () => "", getApiSecret: async () => "" })).resolves.toBe(false);
  });

  it("returns the credential pair when both options slots are configured", async () => {
    await expect(
      resolveCensysCredentials({
        getApiId: async () => TEST_FIXTURE_GENERIC_API_KEY,
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
      })
    ).resolves.toEqual({
      apiId: TEST_FIXTURE_GENERIC_API_KEY,
      apiSecret: TEST_FIXTURE_SECONDARY_API_KEY,
    });
    await expect(
      hasCensysCredentials({
        getApiId: async () => TEST_FIXTURE_GENERIC_API_KEY,
        getApiSecret: async () => TEST_FIXTURE_SECONDARY_API_KEY,
      })
    ).resolves.toBe(true);
  });

  it("loads the credential pair from extension storage", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);
    await setApiKey("censys", TEST_FIXTURE_GENERIC_API_KEY);
    await setApiKey("censys_secret", TEST_FIXTURE_SECONDARY_API_KEY);

    await expect(resolveCensysCredentials()).resolves.toEqual({
      apiId: TEST_FIXTURE_GENERIC_API_KEY,
      apiSecret: TEST_FIXTURE_SECONDARY_API_KEY,
    });
    await expect(getApiKey("censys")).resolves.toBe(TEST_FIXTURE_GENERIC_API_KEY);
    await expect(getApiKey("censys_secret")).resolves.toBe(TEST_FIXTURE_SECONDARY_API_KEY);
  });

  it("surfaces actionable copy when the connector shell lacks a credential pair", async () => {
    stubChromeStorage({});
    const result = await enrichWithConnectorShell(ENRICHMENT_SOURCE.CENSYS, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(result).toMatchObject({
      sourceId: "censys",
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage: formatMissingCensysCredentialsMessage(),
    });
  });
});
