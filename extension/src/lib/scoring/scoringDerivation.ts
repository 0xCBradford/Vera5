/**
 * Phase 21B — source-specific risk/confidence derivation helpers (pure).
 * Adapters orchestrate these; constants live in scoringCalibration.ts.
 */

import { getScoringCalibrationConstants } from "./scoringCalibration";
import { clampConfidence, clampRisk } from "./adapterCommon";
import type {
  AbuseIpdbScoringEvidence,
  GreynoiseScoringEvidence,
  OtxScoringEvidence,
  UrlscanScoringEvidence,
  VirustotalScoringEvidence,
} from "./scoringEvidence";
import { SIGNAL_DIRECTION, type SignalDirection } from "./scoringTypes";

export function deriveAbuseIPDBRisk(
  evidence: AbuseIpdbScoringEvidence
): number | null {
  if (
    evidence.abuseConfidenceScore !== undefined &&
    Number.isFinite(evidence.abuseConfidenceScore)
  ) {
    return clampRisk(evidence.abuseConfidenceScore);
  }
  // Reports without abuseConfidence are not a direct risk measure.
  return null;
}

export function deriveAbuseIPDBConfidence(
  evidence: AbuseIpdbScoringEvidence,
  risk: number | null
): number {
  const cal = getScoringCalibrationConstants();
  if (risk === null) {
    return 0;
  }
  let confidence =
    risk === 0 ? cal.ABUSEIPDB_ZERO_CONFIDENCE : cal.ABUSEIPDB_BASE_CONFIDENCE;

  const reports = evidence.totalReports ?? 0;
  const reporters = evidence.numDistinctUsers ?? 0;
  if (reports > 0 || reporters > 0) {
    const boost = Math.min(
      cal.ABUSEIPDB_REPORT_CONFIDENCE_BOOST_CAP,
      Math.log10(1 + reports + reporters * 2) / 4
    );
    confidence += boost;
  }
  return clampConfidence(confidence);
}

export function deriveAbuseIPDBDirection(risk: number | null): SignalDirection {
  if (risk === null) return SIGNAL_DIRECTION.NEUTRAL;
  if (risk > 0) return SIGNAL_DIRECTION.RISK;
  // Zero abuse confidence ≠ proven benign.
  return SIGNAL_DIRECTION.NEUTRAL;
}

/**
 * Denominator = malicious + suspicious + harmless.
 * Undetected is excluded — it is not an explicit clean vote.
 */
export function deriveVTRisk(evidence: VirustotalScoringEvidence): number {
  const cal = getScoringCalibrationConstants();
  const malicious = evidence.malicious;
  const suspicious = evidence.suspicious;
  const harmless = evidence.harmless;
  const classified = malicious + suspicious + harmless;
  if (classified <= 0) {
    return 0;
  }
  const weighted = malicious + cal.VT_SUSPICIOUS_COEFFICIENT * suspicious;
  return clampRisk((weighted / classified) * 100);
}

export function deriveVTConfidence(
  evidence: VirustotalScoringEvidence
): { confidence: number; direction: SignalDirection } {
  const cal = getScoringCalibrationConstants();
  const malicious = evidence.malicious;
  const suspicious = evidence.suspicious;
  const harmless = evidence.harmless;
  const classified = malicious + suspicious + harmless;

  if (malicious > 0 || suspicious > 0) {
    const engineWeight = malicious + suspicious;
    const confidence = clampConfidence(
      Math.min(
        cal.VT_STRONG_MALICIOUS_CONFIDENCE,
        cal.VT_DETECTION_CONFIDENCE_BASE +
          engineWeight * cal.VT_DETECTION_CONFIDENCE_PER_ENGINE
      )
    );
    return { confidence, direction: SIGNAL_DIRECTION.RISK };
  }

  if (harmless > 0 && classified > 0) {
    return {
      confidence: cal.VT_EXPLICIT_HARMLESS_CONFIDENCE,
      direction: SIGNAL_DIRECTION.BENIGN,
    };
  }

  // Undetected-only / empty classified: weak absence evidence, not BENIGN.
  return {
    confidence: cal.VT_UNDETECTED_ONLY_CONFIDENCE,
    direction: SIGNAL_DIRECTION.NEUTRAL,
  };
}

export function deriveOTXRisk(evidence: OtxScoringEvidence): number | null {
  const cal = getScoringCalibrationConstants();
  const count = evidence.pulseCount;
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  const saturation = cal.OTX_PULSE_SATURATION;
  return clampRisk(100 * (1 - Math.exp(-count / saturation)));
}

export function deriveOTXConfidence(evidence: OtxScoringEvidence): number {
  const cal = getScoringCalibrationConstants();
  if (evidence.pulseCount <= 0) {
    return 0;
  }
  let confidence = cal.OTX_PULSE_BASE_CONFIDENCE;
  if ((evidence.malwareFamilies?.length ?? 0) > 0) {
    confidence += cal.OTX_FAMILY_CONFIDENCE_BOOST;
  }
  if ((evidence.attackIds?.length ?? 0) > 0) {
    confidence += cal.OTX_ATTACK_CONFIDENCE_BOOST;
  }
  return clampConfidence(confidence);
}

export function deriveURLScanRisk(
  evidence: UrlscanScoringEvidence
): {
  risk: number | null;
  confidence: number;
  direction: SignalDirection;
  suspiciousTag: boolean;
} {
  const cal = getScoringCalibrationConstants();
  if (evidence.hasMaliciousVerdict) {
    return {
      risk: cal.URLSCAN_MALICIOUS_RISK,
      confidence: cal.URLSCAN_MALICIOUS_CONFIDENCE,
      direction: SIGNAL_DIRECTION.RISK,
      suspiciousTag: false,
    };
  }
  const tags = (evidence.verdictTags ?? []).map((tag) => tag.toLowerCase());
  const suspiciousTag = tags.some(
    (tag) => tag.includes("suspicious") || tag === "phish" || tag === "phishing"
  );
  if (suspiciousTag) {
    return {
      risk: cal.URLSCAN_SUSPICIOUS_RISK,
      confidence: cal.URLSCAN_SUSPICIOUS_CONFIDENCE,
      direction: SIGNAL_DIRECTION.RISK,
      suspiciousTag: true,
    };
  }
  // No classification / no malicious verdict — absence ≠ benign.
  return {
    risk: null,
    confidence: 0,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    suspiciousTag: false,
  };
}

export function deriveGreyNoiseInterpretation(evidence: GreynoiseScoringEvidence): {
  risk: number | null;
  confidence: number;
  direction: SignalDirection;
} {
  const cal = getScoringCalibrationConstants();
  const classification = (evidence.classification ?? "").trim().toLowerCase();

  if (classification === "malicious") {
    return {
      risk: cal.GREYNOISE_MALICIOUS_RISK,
      confidence: cal.GREYNOISE_MALICIOUS_CONFIDENCE,
      direction: SIGNAL_DIRECTION.RISK,
    };
  }

  if (classification === "benign") {
    return {
      risk: cal.GREYNOISE_BENIGN_RISK,
      confidence: evidence.riot
        ? cal.GREYNOISE_RIOT_BENIGN_CONFIDENCE
        : cal.GREYNOISE_BENIGN_CONFIDENCE,
      direction: SIGNAL_DIRECTION.BENIGN,
    };
  }

  // noise / unknown / unclassified — neutral, no numeric vote
  return {
    risk: null,
    confidence: 0,
    direction: SIGNAL_DIRECTION.NEUTRAL,
  };
}
