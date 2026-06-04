import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import {
  buildTrayEnrichQueueWarningMessage,
  estimateTrayEnrichQueueImpact,
} from "./trayEnrichQueueWarning";

describe("tray enrich queue warning", () => {
  it("estimates live vendor requests from selected tray entries", () => {
    const impact = estimateTrayEnrichQueueImpact(
      [
        { type: "ipv4", value: "8.8.8.8", anchorId: "a-1" },
        { type: "domain", value: "example.com", anchorId: "a-2" },
      ],
      ["a-1", "a-2"],
      {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: true,
        [ENRICHMENT_SOURCE.OTX]: true,
        [ENRICHMENT_SOURCE.URLSCAN]: false,
        [ENRICHMENT_SOURCE.GREYNOISE]: false,
      }
    );

    expect(impact.iocCount).toBe(2);
    expect(impact.maxLiveRequests).toBe(3);
    expect(impact.quotaSummaries.map((summary) => summary.sourceId)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
    ]);
  });

  it("builds quota and rate-limit warning copy before queue start", () => {
    const impact = estimateTrayEnrichQueueImpact(
      [{ type: "ipv4", value: "8.8.8.8", anchorId: "a-1" }],
      ["a-1"],
      {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: true,
        [ENRICHMENT_SOURCE.OTX]: true,
        [ENRICHMENT_SOURCE.URLSCAN]: false,
        [ENRICHMENT_SOURCE.GREYNOISE]: false,
      }
    );

    const message = buildTrayEnrichQueueWarningMessage(impact);

    expect(message).toContain("1 selected indicator");
    expect(message).toContain("up to 2 live vendor requests");
    expect(message).toContain("Vendor quotas apply:");
    expect(message).toContain("AbuseIPDB:");
    expect(message).toContain("OTX:");
    expect(message).toContain("Rate limits may pause or fail queue items.");
    expect(message).toContain("3600 seconds");
  });

  it("notes when no live vendor queries will run", () => {
    const impact = estimateTrayEnrichQueueImpact(
      [{ type: "ipv4", value: "8.8.8.8", anchorId: "a-1" }],
      ["a-1"],
      {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: false,
        [ENRICHMENT_SOURCE.OTX]: false,
        [ENRICHMENT_SOURCE.URLSCAN]: false,
        [ENRICHMENT_SOURCE.GREYNOISE]: false,
      }
    );

    const message = buildTrayEnrichQueueWarningMessage(impact);

    expect(message).toContain("without live vendor queries");
    expect(message).not.toContain("Vendor quotas apply:");
  });
});
