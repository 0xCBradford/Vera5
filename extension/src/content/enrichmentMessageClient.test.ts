/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { requestEnrichmentFromServiceWorker } from "./enrichmentMessageClient";

describe("enrichment message client IOC boundaries", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          payload: {
            source: {
              sourceId: "abuseipdb",
              sourceLabel: "AbuseIPDB",
              status: "ok",
              summary: "12 abuse confidence",
            },
          },
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends only sanitized exact IOC values to the service worker", async () => {
    const result = await requestEnrichmentFromServiceWorker({
      value: "  8.8.8.8  ",
      iocType: IOC_TYPE.IPV4,
    });

    expect(result).not.toBeNull();
    expect(vi.mocked(chrome.runtime.sendMessage)).toHaveBeenCalledWith({
      type: "ENRICH_IOC",
      value: "8.8.8.8",
      iocType: "ipv4",
    });
  });

  it("returns null without messaging when value contains page context", async () => {
    const result = await requestEnrichmentFromServiceWorker({
      value: "8.8.8.8 seen in alert body",
      iocType: IOC_TYPE.IPV4,
    });

    expect(result).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("returns null without messaging when value contains HTML markers", async () => {
    const result = await requestEnrichmentFromServiceWorker({
      value: "<div>8.8.8.8</div>",
      iocType: IOC_TYPE.IPV4,
    });

    expect(result).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
