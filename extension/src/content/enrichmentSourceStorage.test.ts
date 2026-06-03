import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_ORDER } from "../lib/enrichmentSourceRegistry";
import {
  createDefaultEnrichmentSourceEnabledMap,
  listDisabledEnrichmentSourceIds,
  normalizeEnrichmentSourceEnabledMap,
} from "./enrichmentSourceStorage";

describe("enrichment source storage", () => {
  it("defaults all enrichment sources to disabled", () => {
    expect(createDefaultEnrichmentSourceEnabledMap()).toEqual(
      Object.fromEntries(
        ENRICHMENT_SOURCE_ORDER.map((sourceId) => [sourceId, false])
      )
    );
  });

  it("merges stored source flags with defaults", () => {
    expect(
      normalizeEnrichmentSourceEnabledMap({
        abuseipdb: true,
        otx: false,
      })
    ).toEqual({
      ...createDefaultEnrichmentSourceEnabledMap(),
      abuseipdb: true,
      otx: false,
    });
  });

  it("lists disabled sources for the hover card", () => {
    const disabled = listDisabledEnrichmentSourceIds(
      {
        ...createDefaultEnrichmentSourceEnabledMap(),
        abuseipdb: true,
        otx: false,
        urlscan: false,
        greynoise: true,
      },
      true
    );
    expect(disabled).toContain("otx");
    expect(disabled).toContain("urlscan");
    expect(disabled).not.toContain("abuseipdb");
    expect(disabled).not.toContain("greynoise");
  });

  it("hides disabled sources when workspace preference is off", () => {
    const disabled = listDisabledEnrichmentSourceIds(
      createDefaultEnrichmentSourceEnabledMap(),
      false
    );
    expect(disabled).toEqual([]);
  });
});
