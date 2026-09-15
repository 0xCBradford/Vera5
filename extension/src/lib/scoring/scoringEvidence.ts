/**
 * Phase 21B — structured scoring evidence retained at normalize time.
 *
 * Presentation summaries alone lose VT engine breakdowns, AbuseIPDB report
 * metadata, etc. This field is a minimal, deterministic extension of
 * ConnectorNormalizeResult / EnrichmentSourceResult for ScoringSignal adapters.
 *
 * Never contains secrets or full raw vendor payloads.
 */

import { ENRICHMENT_SOURCE, type EnrichmentSourceId } from "../enrichmentSourceRegistry";

export type AbuseIpdbScoringEvidence = {
  source: typeof ENRICHMENT_SOURCE.ABUSEIPDB;
  abuseConfidenceScore?: number;
  totalReports?: number;
  numDistinctUsers?: number;
  lastReportedAt?: string;
};

export type VirustotalScoringEvidence = {
  source: typeof ENRICHMENT_SOURCE.VIRUSTOTAL;
  malicious: number;
  suspicious: number;
  harmless: number;
  /** Informational only — never treated as explicit clean in adapters. */
  undetected: number;
};

export type OtxScoringEvidence = {
  source: typeof ENRICHMENT_SOURCE.OTX;
  pulseCount: number;
  malwareFamilies?: readonly string[];
  attackIds?: readonly string[];
  threatTags?: readonly string[];
};

export type UrlscanScoringEvidence = {
  source: typeof ENRICHMENT_SOURCE.URLSCAN;
  resultTotal: number;
  hasMaliciousVerdict: boolean;
  verdictTags?: readonly string[];
};

export type GreynoiseScoringEvidence = {
  source: typeof ENRICHMENT_SOURCE.GREYNOISE;
  classification?: string;
  noise: boolean;
  riot: boolean;
  name?: string;
};

export type ContextScoringEvidence = {
  source:
    | typeof ENRICHMENT_SOURCE.SHODAN
    | typeof ENRICHMENT_SOURCE.CENSYS
    | typeof ENRICHMENT_SOURCE.RDAP_WHOIS;
  kind: "context";
  summary?: string;
};

/**
 * Pivot-only / not-yet-live sources have no normalize path.
 * Adapters still exist and return NO_SIGNAL when invoked.
 */
export type PivotOnlyScoringEvidence = {
  source:
    | typeof ENRICHMENT_SOURCE.THREATFOX
    | typeof ENRICHMENT_SOURCE.URLHAUS
    | typeof ENRICHMENT_SOURCE.MALWAREBAZAAR
    | typeof ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING
    | typeof ENRICHMENT_SOURCE.PULSEDIVE;
  kind: "pivot_only";
};

export type ScoringEvidence =
  | AbuseIpdbScoringEvidence
  | VirustotalScoringEvidence
  | OtxScoringEvidence
  | UrlscanScoringEvidence
  | GreynoiseScoringEvidence
  | ContextScoringEvidence
  | PivotOnlyScoringEvidence;

const SOURCE_IDS = new Set<string>(Object.values(ENRICHMENT_SOURCE));

function isFiniteNonNeg(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Type guard for EnrichmentSourceResult / cache validation. */
export function isScoringEvidence(value: unknown): value is ScoringEvidence {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.source !== "string" || !SOURCE_IDS.has(record.source)) {
    return false;
  }
  const source = record.source as EnrichmentSourceId;

  switch (source) {
    case ENRICHMENT_SOURCE.ABUSEIPDB:
      return (
        (record.abuseConfidenceScore === undefined ||
          isFiniteNonNeg(record.abuseConfidenceScore)) &&
        (record.totalReports === undefined || isFiniteNonNeg(record.totalReports)) &&
        (record.numDistinctUsers === undefined || isFiniteNonNeg(record.numDistinctUsers)) &&
        (record.lastReportedAt === undefined || typeof record.lastReportedAt === "string")
      );
    case ENRICHMENT_SOURCE.VIRUSTOTAL:
      return (
        isFiniteNonNeg(record.malicious) &&
        isFiniteNonNeg(record.suspicious) &&
        isFiniteNonNeg(record.harmless) &&
        isFiniteNonNeg(record.undetected)
      );
    case ENRICHMENT_SOURCE.OTX:
      return (
        isFiniteNonNeg(record.pulseCount) &&
        (record.malwareFamilies === undefined || isStringArray(record.malwareFamilies)) &&
        (record.attackIds === undefined || isStringArray(record.attackIds)) &&
        (record.threatTags === undefined || isStringArray(record.threatTags))
      );
    case ENRICHMENT_SOURCE.URLSCAN:
      return (
        isFiniteNonNeg(record.resultTotal) &&
        typeof record.hasMaliciousVerdict === "boolean" &&
        (record.verdictTags === undefined || isStringArray(record.verdictTags))
      );
    case ENRICHMENT_SOURCE.GREYNOISE:
      return (
        typeof record.noise === "boolean" &&
        typeof record.riot === "boolean" &&
        (record.classification === undefined || typeof record.classification === "string") &&
        (record.name === undefined || typeof record.name === "string")
      );
    case ENRICHMENT_SOURCE.SHODAN:
    case ENRICHMENT_SOURCE.CENSYS:
    case ENRICHMENT_SOURCE.RDAP_WHOIS:
      return record.kind === "context";
    case ENRICHMENT_SOURCE.THREATFOX:
    case ENRICHMENT_SOURCE.URLHAUS:
    case ENRICHMENT_SOURCE.MALWAREBAZAAR:
    case ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING:
    case ENRICHMENT_SOURCE.PULSEDIVE:
      return record.kind === "pivot_only";
    default:
      return false;
  }
}

export function normalizeScoringEvidence(value: unknown): ScoringEvidence | null {
  return isScoringEvidence(value) ? (value as ScoringEvidence) : null;
}
