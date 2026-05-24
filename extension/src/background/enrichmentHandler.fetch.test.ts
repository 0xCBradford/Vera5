import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "../lib/enrichment";
import { enrichIocMessage } from "../lib/messages";
import { setApiKey } from "../lib/storage";
import { handleEnrichIocMessage } from "./enrichmentHandler";

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getEnrichmentSourceEnabled: vi.fn(async () => ({ abuseipdb: true })),
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
      },
    },
  });
}

function successPayload() {
  return {
    data: {
      ipAddress: "8.8.8.8",
      abuseConfidenceScore: 42,
      countryCode: "US",
      usageType: "Fixed Line ISP",
    },
  };
}

describe("enrichment handler with mocked fetch", () => {
  const store: Record<string, unknown> = {};

  beforeEach(async () => {
    stubChromeStorage(store);
    await setApiKey("abuseipdb", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("returns normalized enrichment when mocked fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(successPayload(), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "42 abuse confidence",
          tags: ["US", "Fixed Line ISP"],
          fetchedAt: expect.any(String),
        },
      },
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("surfaces HTTP 401 from mocked fetch as unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: unknown } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "AbuseIPDB rejected the API key.",
    });
  });

  it("surfaces HTTP 429 from mocked fetch with retry hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 429,
            headers: { "Retry-After": "90" },
          })
      )
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: Record<string, unknown> } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 90 seconds.",
    });
  });

  it("surfaces mocked fetch abort as timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      })
    );

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response.ok).toBe(true);
    const source = (response as { ok: true; payload: { source: unknown } })
      .payload.source;
    expect(source).toMatchObject({
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "AbuseIPDB request timed out.",
    });
  });
});
