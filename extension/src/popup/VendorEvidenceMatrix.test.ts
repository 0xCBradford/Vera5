import { describe, expect, it } from "vitest";
import { ENRICHMENT_ASSESSMENT_KIND, ENRICHMENT_SOURCE } from "../lib/enrichmentSourceRegistry";
import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import { buildVendorEvidenceRowModel } from "./VendorEvidenceMatrix";

function scoredEntry(
  sourceId: HoverCardSourceEntry["sourceId"],
  signal: number,
  extras: Partial<HoverCardSourceEntry> = {}
): HoverCardSourceEntry {
  return {
    sourceId,
    label: sourceId,
    status: "ok",
    badgeText: "Live",
    detail: `${signal} risk signal`,
    assessment: {
      kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
      signal,
      verdict: `${signal} risk signal`,
      evidence: [`Normalized test signal: ${signal}`],
    },
    metadataChips: [],
    fromCache: false,
    lastUpdatedLine: null,
    errorCode: null,
    retryHint: null,
    ...extras,
  };
}

describe("buildVendorEvidenceRowModel", () => {
  it("maps scored critical/high/suspicious/low/zero rows", () => {
    const critical = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      source: scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 100),
      availability: { enabled: true, configured: true },
      loading: false,
    });
    expect(critical.presentationKind).toBe("scored");
    expect(critical.scoreValue).toBe(100);
    expect(critical.resultAriaLabel).toBe("100 out of 100");
    expect(critical.classificationText).toBe("[CRITICAL]");
    expect(critical.scoreBand).toBe("red");

    const zero = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.GREYNOISE,
      source: scoredEntry(ENRICHMENT_SOURCE.GREYNOISE, 0),
      availability: { enabled: true, configured: true },
      loading: false,
    });
    expect(zero.presentationKind).toBe("scored");
    expect(zero.scoreValue).toBe(0);
    expect(zero.resultLabel).toBe("0/100");
    expect(zero.classificationText).toBeNull();
    expect(zero.scoreBand).toBe("zero");
  });

  it("keeps cached scored evidence as scored with Cached evidence text", () => {
    const cached = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      source: scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 53, {
        fromCache: true,
        badgeText: "Cached",
      }),
      availability: { enabled: true, configured: true },
      loading: false,
    });
    expect(cached.presentationKind).toBe("scored");
    expect(cached.scoreValue).toBe(53);
    expect(cached.evidenceText).toContain("Cached");
    expect(cached.evidenceText).toContain("53 risk signal");
  });

  it("maps not queried, querying, pivot, disabled, and missing configuration", () => {
    const notQueried = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.OTX,
      source: undefined,
      availability: { enabled: true, configured: true },
      loading: false,
    });
    expect(notQueried.presentationKind).toBe("not_queried");
    expect(notQueried.resultLabel).toBe("Not queried");
    expect(notQueried.evidenceText).toBe("");

    const querying = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.OTX,
      source: undefined,
      availability: { enabled: true, configured: true },
      loading: true,
    });
    expect(querying.presentationKind).toBe("loading");
    expect(querying.resultLabel).toBe("Querying");

    const pivot = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.PULSEDIVE,
      source: undefined,
      availability: { enabled: true, configured: true },
      loading: false,
    });
    expect(pivot.presentationKind).toBe("pivot_only");
    expect(pivot.resultLabel).toBe("Pivot only");
    expect(pivot.evidenceText).toBe("");

    const disabled = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.CENSYS,
      source: undefined,
      availability: { enabled: false, configured: true },
      loading: false,
    });
    expect(disabled.presentationKind).toBe("disabled");

    const missing = buildVendorEvidenceRowModel({
      sourceId: ENRICHMENT_SOURCE.SHODAN,
      source: undefined,
      availability: { enabled: true, configured: false },
      loading: false,
    });
    expect(missing.presentationKind).toBe("missing_configuration");
    expect(missing.evidenceText).toBe("API key required");
  });
});
