import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  buildEnrichIocMessage,
  requestEnrichmentFromBackground,
} from "./enrichmentRequest";
import { MESSAGE } from "./messages";

describe("enrichment background request", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an ENRICH_IOC service worker message", () => {
    expect(
      buildEnrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    ).toEqual({
      type: MESSAGE.ENRICH_IOC,
      value: "8.8.8.8",
      iocType: "ipv4",
      sourceId: "abuseipdb",
    });
  });

  it("returns a normalized source result from the service worker", async () => {
    const sendMessage = vi.mocked(chrome.runtime.sendMessage);
    sendMessage.mockResolvedValue({
      ok: true,
      payload: {
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "5 abuse confidence",
        },
      },
    });

    const source = await requestEnrichmentFromBackground({
      value: "8.8.8.8",
      iocType: "ipv4",
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE.ENRICH_IOC,
      value: "8.8.8.8",
      iocType: "ipv4",
      sourceId: "abuseipdb",
    });
    expect(source?.summary).toBe("5 abuse confidence");
  });

  it("returns null when the service worker responds with an error", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      ok: false,
      error: "invalid enrich request",
    });

    const source = await requestEnrichmentFromBackground({
      value: "8.8.8.8",
      iocType: "ipv4",
    });

    expect(source).toBeNull();
  });
});
