import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentRegisterMessage, enrichIocMessage, pingMessage } from "../lib/messages";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import { routeIncomingMessage, routeIncomingMessageAsync } from "./messageRouter";

const enrichWithAbuseIpdb = vi.fn();

vi.mock("../lib/abuseipdbConnector", () => ({
  ABUSEIPDB_SOURCE_ID: "abuseipdb",
  enrichWithAbuseIpdb: (...args: unknown[]) => enrichWithAbuseIpdb(...args),
}));

vi.mock("../lib/storage", () => ({
  getEnrichmentSourceEnabled: vi.fn(async () => ({ abuseipdb: true })),
}));

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
  beforeEach(() => {
    enrichWithAbuseIpdb.mockReset();
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
