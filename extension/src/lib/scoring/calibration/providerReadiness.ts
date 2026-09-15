/**
 * Phase 21D.1 — provider readiness tracking (adapter vs live pipeline).
 * Does not add providers or change live enrichment.
 */

import { ENRICHMENT_SOURCE, type EnrichmentSourceId } from "../../enrichmentSourceRegistry";

export type ProviderReadinessRow = {
  source: EnrichmentSourceId;
  adapterReady: boolean;
  liveNormalizedDataAvailable: boolean;
  shadowSignalGenerationAvailable: boolean;
  productionEligibleLater: boolean;
  notes: string;
};

export const PROVIDER_READINESS: ProviderReadinessRow[] = [
  {
    source: ENRICHMENT_SOURCE.ABUSEIPDB,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: true,
    notes: "DIRECT scoring via scoringEvidence",
  },
  {
    source: ENRICHMENT_SOURCE.VIRUSTOTAL,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: true,
    notes: "DERIVED engine ratios; undetected≠clean",
  },
  {
    source: ENRICHMENT_SOURCE.OTX,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: true,
    notes: "DERIVED pulse saturation",
  },
  {
    source: ENRICHMENT_SOURCE.URLSCAN,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: true,
    notes: "Verdict/tag based",
  },
  {
    source: ENRICHMENT_SOURCE.GREYNOISE,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: true,
    notes: "Classification/RIOT; noise≠malicious",
  },
  {
    source: ENRICHMENT_SOURCE.SHODAN,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "CONTEXT_ONLY — never numeric voter",
  },
  {
    source: ENRICHMENT_SOURCE.CENSYS,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "CONTEXT_ONLY — never numeric voter",
  },
  {
    source: ENRICHMENT_SOURCE.RDAP_WHOIS,
    adapterReady: true,
    liveNormalizedDataAvailable: true,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "CONTEXT_ONLY — never numeric voter",
  },
  {
    source: ENRICHMENT_SOURCE.THREATFOX,
    adapterReady: true,
    liveNormalizedDataAvailable: false,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "MATCH adapter semantic ready; live normalize = Phase 21G",
  },
  {
    source: ENRICHMENT_SOURCE.URLHAUS,
    adapterReady: true,
    liveNormalizedDataAvailable: false,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "MATCH adapter semantic ready; live normalize = Phase 21G",
  },
  {
    source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
    adapterReady: true,
    liveNormalizedDataAvailable: false,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "MATCH adapter semantic ready; live normalize = Phase 21G",
  },
  {
    source: ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
    adapterReady: true,
    liveNormalizedDataAvailable: false,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "Pivot-only / NO_SIGNAL until live",
  },
  {
    source: ENRICHMENT_SOURCE.PULSEDIVE,
    adapterReady: true,
    liveNormalizedDataAvailable: false,
    shadowSignalGenerationAvailable: true,
    productionEligibleLater: false,
    notes: "Pivot-only / NO_SIGNAL until live",
  },
];
