import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichIocMessage } from "../lib/messages";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import { handleEnrichIocMessage } from "./enrichmentHandler";

const enrichWithAbuseIpdb = vi.fn();

vi.mock("../lib/abuseipdbConnector", () => ({
  ABUSEIPDB_SOURCE_ID: "abuseipdb",
  enrichWithAbuseIpdb: (...args: unknown[]) => enrichWithAbuseIpdb(...args),
}));

vi.mock("../lib/storage", () => ({
  getEnrichmentSourceEnabled: vi.fn(async () => ({ abuseipdb: true })),
}));

describe("enrichment handler", () => {
  beforeEach(() => {
    enrichWithAbuseIpdb.mockReset();
  });

  it("routes ENRICH_IOC through the AbuseIPDB connector", async () => {
    enrichWithAbuseIpdb.mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary: "12 abuse confidence",
    });

    const response = await handleEnrichIocMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );

    expect(response).toEqual({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
      },
    });
    expect(enrichWithAbuseIpdb).toHaveBeenCalledWith({
      value: "8.8.8.8",
      type: "ipv4",
    });
  });

  it("rejects invalid enrich envelopes", async () => {
    const response = await handleEnrichIocMessage({ type: "ENRICH_IOC" });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });

  it("rejects enrich messages with extra page fields", async () => {
    const response = await handleEnrichIocMessage({
      type: "ENRICH_IOC",
      value: "8.8.8.8",
      iocType: "ipv4",
      pageHtml: "<html></html>",
    });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });

  it("rejects enrich messages with trailing page context", async () => {
    const response = await handleEnrichIocMessage({
      type: "ENRICH_IOC",
      value: "8.8.8.8 seen on the page",
      iocType: "ipv4",
    });
    expect(response).toEqual({ ok: false, error: "invalid enrich request" });
    expect(enrichWithAbuseIpdb).not.toHaveBeenCalled();
  });
});
