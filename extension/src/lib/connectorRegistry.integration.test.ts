import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleEnrichIocMessage } from "../background/enrichmentHandler";
import {
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";
import * as connectorRegistry from "./connectorRegistry";
import {
  enrichRegisteredLiveConnector,
  registerBuiltInLiveConnectors,
  resetDefaultConnectorRegistryState,
} from "./connectorRegistry";
import {
  TEST_FIXTURE_ABUSEIPDB_API_KEY,
  TEST_FIXTURE_OTX_API_KEY,
} from "./fixtureSecrets";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import { enrichIocMessage } from "./messages";
import { IOC_TYPE } from "./iocRegex";
import * as storage from "./storage";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
} from "./storage";

vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({
      abuseipdb: true,
      otx: true,
    })),
    getLocalBackendEnabled: vi.fn(async () => false),
  };
});

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

function abuseIpdbSuccessPayload() {
  return {
    data: {
      ipAddress: "8.8.8.8",
      abuseConfidenceScore: 12,
      countryCode: "US",
    },
  };
}

function otxSuccessPayload() {
  return {
    pulse_info: {
      count: 3,
      pulses: [{ tags: ["scanner"] }],
    },
  };
}

describe("connector registry integration", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    resetDefaultConnectorRegistryState();
    registerBuiltInLiveConnectors();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
    await storage.setApiKey(ENRICHMENT_SOURCE.ABUSEIPDB, TEST_FIXTURE_ABUSEIPDB_API_KEY);
    await storage.setApiKey(ENRICHMENT_SOURCE.OTX, TEST_FIXTURE_OTX_API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetDefaultConnectorRegistryState();
  });

  it("enriches multiple live sources in parallel through the registry", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(abuseIpdbSuccessPayload(), { status: 200 });
      }
      if (url.includes("otx.alienvault.com")) {
        return Response.json(otxSuccessPayload(), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ioc = { value: "8.8.8.8", type: IOC_TYPE.IPV4 };
    const [abuseIpdb, otx] = await Promise.all([
      enrichRegisteredLiveConnector(ENRICHMENT_SOURCE.ABUSEIPDB, ioc),
      enrichRegisteredLiveConnector(ENRICHMENT_SOURCE.OTX, ioc),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(abuseIpdb).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      status: ENRICHMENT_SOURCE_STATUS.OK,
    });
    expect(otx).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.OTX,
      status: ENRICHMENT_SOURCE_STATUS.OK,
    });
    expect(abuseIpdb?.summary).toContain("12");
    expect(otx?.summary).toMatch(/3/);
  });

  it("routes handler multi-source enrichment through registry dispatch with mocks", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("abuseipdb.com")) {
        return Response.json(abuseIpdbSuccessPayload(), { status: 200 });
      }
      if (url.includes("otx.alienvault.com")) {
        return Response.json(otxSuccessPayload(), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dispatchSpy = vi.spyOn(connectorRegistry, "enrichRegisteredLiveConnector");

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(dispatchSpy).toHaveBeenCalledWith(ENRICHMENT_SOURCE.ABUSEIPDB, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    expect(dispatchSpy).toHaveBeenCalledWith(ENRICHMENT_SOURCE.OTX, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    expect(response.payload.sources).toHaveLength(2);
    expect(response.payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: ENRICHMENT_SOURCE_STATUS.OK,
        }),
        expect.objectContaining({
          sourceId: ENRICHMENT_SOURCE.OTX,
          status: ENRICHMENT_SOURCE_STATUS.OK,
        }),
      ])
    );
  });
});
