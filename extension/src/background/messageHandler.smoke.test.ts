import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentRegisterMessage, enrichIocMessage, pingMessage } from "../lib/messages";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import {
  DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS,
  STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS,
} from "../lib/storage";
import { routeIncomingMessage, routeIncomingMessageAsync } from "./messageRouter";

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

const enrichWithAbuseIpdb = vi.fn();

vi.mock("../lib/abuseipdbConnector", () => ({
  ABUSEIPDB_SOURCE_ID: "abuseipdb",
  enrichWithAbuseIpdb: (...args: unknown[]) => enrichWithAbuseIpdb(...args),
}));

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({ abuseipdb: true })),
  };
});

describe("message handler smoke", () => {
  it("responds to PING", () => {
    expect(routeIncomingMessage(pingMessage())).toEqual({
      ok: true,
      payload: { pong: true },
    });
  });

  it("acknowledges CONTENT_REGISTER", () => {
    expect(routeIncomingMessage(contentRegisterMessage())).toEqual({
      ok: true,
      payload: { registered: true },
    });
  });

  it("rejects invalid envelopes", () => {
    expect(routeIncomingMessage(null).ok).toBe(false);
    expect(routeIncomingMessage({}).ok).toBe(false);
  });

  it("rejects unrecognized type strings", () => {
    const result = routeIncomingMessage({ type: "NOT_REAL" });
    expect(result).toEqual({ ok: false, error: "invalid message envelope" });
  });

  it("defers ENRICH_IOC to the async router", () => {
    expect(routeIncomingMessage(enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }))).toEqual({
      ok: false,
      error: "enrich request requires async handler",
    });
  });
});

describe("message handler async enrich", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    enrichWithAbuseIpdb.mockReset();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    store[STORAGE_KEY_ENRICHMENT_CACHE_TTL_SECONDS] =
      DEFAULT_ENRICHMENT_CACHE_TTL_SECONDS;
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes ENRICH_IOC through the service worker handler", async () => {
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "3 abuse confidence",
    });

    const response = await routeIncomingMessageAsync(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    expect(enrichWithAbuseIpdb).toHaveBeenCalledOnce();
  });
});
