import { describe, expect, it } from "vitest";
import {
  createDefaultEnrichmentSourceEnabledMap,
  listDisabledEnrichmentSourceIds,
  normalizeEnrichmentSourceEnabledMap,
} from "./enrichmentSourceStorage";

describe("enrichment source storage", () => {
  it("defaults all MVP sources to disabled", () => {
    expect(createDefaultEnrichmentSourceEnabledMap()).toEqual({
      abuseipdb: false,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
  });

  it("merges stored source flags with defaults", () => {
    expect(
      normalizeEnrichmentSourceEnabledMap({
        abuseipdb: true,
        otx: false,
      })
    ).toEqual({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
  });

  it("lists disabled sources for the hover card", () => {
    const disabled = listDisabledEnrichmentSourceIds({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: true,
    });
    expect(disabled).toEqual(["otx", "urlscan"]);
  });
});
