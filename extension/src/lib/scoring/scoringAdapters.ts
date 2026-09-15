/**
 * Phase 21B — source-specific ScoringSignal adapters.
 * Consume EnrichmentSourceResult (+ scoringEvidence). Zero network. No React.
 */

import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";
import type { SourceScoringAdapter, SourceScoringAdapterInput } from "./scoringAdapter";
import {
  type AdapterNormalizedInput,
  buildSignal,
  contextOnlySignal,
  ensureApplicable,
  noSignal,
  signalForNonOkStatus,
} from "./adapterCommon";
import { scoringBasis, SCORING_BASIS_CODE } from "./scoringBasisCodes";
import { getScoringCalibrationConstants } from "./scoringCalibration";
import {
  deriveAbuseIPDBConfidence,
  deriveAbuseIPDBDirection,
  deriveAbuseIPDBRisk,
  deriveGreyNoiseInterpretation,
  deriveOTXConfidence,
  deriveOTXRisk,
  deriveURLScanRisk,
  deriveVTConfidence,
  deriveVTRisk,
} from "./scoringDerivation";
import type {
  AbuseIpdbScoringEvidence,
  GreynoiseScoringEvidence,
  OtxScoringEvidence,
  ScoringEvidence,
  UrlscanScoringEvidence,
  VirustotalScoringEvidence,
} from "./scoringEvidence";
import { isSourceScoringApplicable } from "./scoringPolicy";
import {
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  SIGNAL_DIRECTION,
  type ScoringSignal,
} from "./scoringTypes";

function evidenceOf<T extends ScoringEvidence>(
  normalized: AdapterNormalizedInput,
  source: T["source"]
): T | null {
  const evidence = normalized.scoringEvidence;
  if (!evidence || evidence.source !== source) {
    return null;
  }
  return evidence as T;
}

function evaluateAbuseIPDB(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.ABUSEIPDB;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  const evidence = evidenceOf<AbuseIpdbScoringEvidence>(
    input.normalized,
    ENRICHMENT_SOURCE.ABUSEIPDB
  );
  if (!evidence) {
    return noSignal(source, input, SCORING_MODE.DIRECT, [
      scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
    ]);
  }

  const risk = deriveAbuseIPDBRisk(evidence);
  const basis = [];
  if (evidence.abuseConfidenceScore !== undefined) {
    basis.push(
      scoringBasis(
        SCORING_BASIS_CODE.ABUSE_CONFIDENCE,
        evidence.abuseConfidenceScore,
        "abuseConfidenceScore"
      )
    );
  }
  if (evidence.totalReports !== undefined) {
    basis.push(
      scoringBasis(SCORING_BASIS_CODE.REPORT_COUNT, evidence.totalReports, "totalReports")
    );
  }
  if (evidence.numDistinctUsers !== undefined) {
    basis.push(
      scoringBasis(
        SCORING_BASIS_CODE.REPORTER_COUNT,
        evidence.numDistinctUsers,
        "numDistinctUsers"
      )
    );
  }
  if (evidence.lastReportedAt) {
    basis.push(
      scoringBasis(SCORING_BASIS_CODE.RECENCY, evidence.lastReportedAt, "lastReportedAt")
    );
  }

  if (risk === null) {
    return noSignal(source, input, SCORING_MODE.DIRECT, basis.length > 0 ? basis : [
      scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
    ]);
  }

  const confidence = deriveAbuseIPDBConfidence(evidence, risk);
  return buildSignal({
    source,
    targetType: input.target.iocType,
    mode: SCORING_MODE.DIRECT,
    risk,
    confidence,
    direction: deriveAbuseIPDBDirection(risk),
    applicable: true,
    basis,
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function evaluateVirusTotal(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.VIRUSTOTAL;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  const evidence = evidenceOf<VirustotalScoringEvidence>(
    input.normalized,
    ENRICHMENT_SOURCE.VIRUSTOTAL
  );
  if (!evidence) {
    return noSignal(source, input, SCORING_MODE.DERIVED, [
      scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
    ]);
  }

  const risk = deriveVTRisk(evidence);
  const { confidence, direction } = deriveVTConfidence(evidence);
  const classified =
    evidence.malicious + evidence.suspicious + evidence.harmless;

  return buildSignal({
    source,
    targetType: input.target.iocType,
    mode: SCORING_MODE.DERIVED,
    risk,
    confidence,
    direction,
    applicable: true,
    basis: [
      scoringBasis(SCORING_BASIS_CODE.MALICIOUS_DETECTIONS, evidence.malicious),
      scoringBasis(SCORING_BASIS_CODE.SUSPICIOUS_DETECTIONS, evidence.suspicious),
      scoringBasis(SCORING_BASIS_CODE.HARMLESS_DETECTIONS, evidence.harmless),
      scoringBasis(SCORING_BASIS_CODE.VT_UNDETECTED_COUNT, evidence.undetected),
      scoringBasis(SCORING_BASIS_CODE.VT_CLASSIFIED_ENGINE_COUNT, classified),
    ],
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function evaluateOTX(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.OTX;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  const evidence = evidenceOf<OtxScoringEvidence>(input.normalized, ENRICHMENT_SOURCE.OTX);
  if (!evidence) {
    return noSignal(source, input, SCORING_MODE.DERIVED, [
      scoringBasis(SCORING_BASIS_CODE.NO_MATCH),
    ]);
  }

  const risk = deriveOTXRisk(evidence);
  const basis = [
    scoringBasis(SCORING_BASIS_CODE.OTX_PULSE_COUNT, evidence.pulseCount),
  ];
  if ((evidence.malwareFamilies?.length ?? 0) > 0) {
    basis.push(
      scoringBasis(
        SCORING_BASIS_CODE.OTX_MALWARE_FAMILY,
        evidence.malwareFamilies!.slice(0, 3).join(", ")
      )
    );
  }
  if ((evidence.attackIds?.length ?? 0) > 0) {
    basis.push(
      scoringBasis(
        SCORING_BASIS_CODE.OTX_ATTACK_ASSOCIATION,
        evidence.attackIds!.slice(0, 3).join(", ")
      )
    );
  }
  if ((evidence.threatTags?.length ?? 0) > 0) {
    basis.push(
      scoringBasis(SCORING_BASIS_CODE.OTX_TAG, evidence.threatTags!.slice(0, 3).join(", "))
    );
  }

  if (risk === null) {
    // No pulses / associations — absence ≠ benign.
    return noSignal(source, input, SCORING_MODE.DERIVED, [
      scoringBasis(SCORING_BASIS_CODE.NO_MATCH, 0),
      ...basis,
    ]);
  }

  return buildSignal({
    source,
    targetType: input.target.iocType,
    mode: SCORING_MODE.DERIVED,
    risk,
    confidence: deriveOTXConfidence(evidence),
    direction: SIGNAL_DIRECTION.RISK,
    applicable: true,
    basis: [scoringBasis(SCORING_BASIS_CODE.OTX_PULSE_MATCH, evidence.pulseCount), ...basis],
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function evaluateURLScan(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.URLSCAN;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  const evidence = evidenceOf<UrlscanScoringEvidence>(
    input.normalized,
    ENRICHMENT_SOURCE.URLSCAN
  );
  if (!evidence) {
    return noSignal(source, input, SCORING_MODE.DERIVED, [
      scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
    ]);
  }

  const derived = deriveURLScanRisk(evidence);
  const basis = [
    scoringBasis(SCORING_BASIS_CODE.URLSCAN_RESULT_COUNT, evidence.resultTotal),
  ];
  if (evidence.hasMaliciousVerdict) {
    basis.push(scoringBasis(SCORING_BASIS_CODE.URLSCAN_MALICIOUS, true));
    basis.push(scoringBasis(SCORING_BASIS_CODE.URLSCAN_VERDICT, "malicious"));
  } else if (derived.suspiciousTag) {
    basis.push(scoringBasis(SCORING_BASIS_CODE.URLSCAN_SUSPICIOUS, true));
  } else {
    basis.push(scoringBasis(SCORING_BASIS_CODE.NO_DETECTION));
  }

  if (derived.risk === null) {
    return noSignal(source, input, SCORING_MODE.DERIVED, basis);
  }

  return buildSignal({
    source,
    targetType: input.target.iocType,
    mode: SCORING_MODE.DERIVED,
    risk: derived.risk,
    confidence: derived.confidence,
    direction: derived.direction,
    applicable: true,
    basis,
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function evaluateGreyNoise(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.GREYNOISE;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  const evidence = evidenceOf<GreynoiseScoringEvidence>(
    input.normalized,
    ENRICHMENT_SOURCE.GREYNOISE
  );
  if (!evidence) {
    return noSignal(source, input, SCORING_MODE.DERIVED, [
      scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
    ]);
  }

  const interpretation = deriveGreyNoiseInterpretation(evidence);
  const basis = [
    scoringBasis(
      SCORING_BASIS_CODE.GREYNOISE_CLASSIFICATION,
      evidence.classification ?? "unknown"
    ),
    scoringBasis(SCORING_BASIS_CODE.GREYNOISE_NOISE, evidence.noise),
    scoringBasis(SCORING_BASIS_CODE.GREYNOISE_RIOT, evidence.riot),
  ];
  if (interpretation.direction === SIGNAL_DIRECTION.BENIGN) {
    basis.push(scoringBasis(SCORING_BASIS_CODE.KNOWN_BENIGN_CLASSIFICATION, true));
  }

  if (interpretation.risk === null) {
    return noSignal(source, input, SCORING_MODE.DERIVED, basis);
  }

  return buildSignal({
    source,
    targetType: input.target.iocType,
    mode: SCORING_MODE.DERIVED,
    risk: interpretation.risk,
    confidence: interpretation.confidence,
    direction: interpretation.direction,
    applicable: true,
    basis,
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function evaluateMatchPivotOnly(
  source:
    | typeof ENRICHMENT_SOURCE.THREATFOX
    | typeof ENRICHMENT_SOURCE.URLHAUS
    | typeof ENRICHMENT_SOURCE.MALWAREBAZAAR,
  matchBasis:
    | typeof SCORING_BASIS_CODE.THREATFOX_MATCH
    | typeof SCORING_BASIS_CODE.URLHAUS_MATCH
    | typeof SCORING_BASIS_CODE.MALWAREBAZAAR_MATCH,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;

  // No live normalize path yet — cannot invent matches.
  return noSignal(source, input, SCORING_MODE.MATCH, [
    scoringBasis(SCORING_BASIS_CODE.PIVOT_ONLY),
    scoringBasis(matchBasis, false),
    scoringBasis(SCORING_BASIS_CODE.NO_MATCH),
  ]);
}

/**
 * Future MATCH positive-hit helper (unused until connectors ship).
 * Kept for 21D wiring — provisional constants already centralized.
 */
export function buildConfirmedMatchSignal(input: {
  source: typeof ENRICHMENT_SOURCE.THREATFOX | typeof ENRICHMENT_SOURCE.URLHAUS | typeof ENRICHMENT_SOURCE.MALWAREBAZAAR;
  targetType: IocType;
  matchBasis:
    | typeof SCORING_BASIS_CODE.THREATFOX_MATCH
    | typeof SCORING_BASIS_CODE.URLHAUS_MATCH
    | typeof SCORING_BASIS_CODE.MALWAREBAZAAR_MATCH;
  providerConfidence?: number;
}): ScoringSignal {
  const confidence = clampMatchConfidence(input.providerConfidence);
  return buildSignal({
    source: input.source,
    targetType: input.targetType,
    mode: SCORING_MODE.MATCH,
    risk: getScoringCalibrationConstants().MATCH_CONFIRMED_RISK,
    confidence,
    direction: SIGNAL_DIRECTION.RISK,
    applicable: true,
    basis: [scoringBasis(input.matchBasis, true)],
    status: SCORING_SIGNAL_STATUS.AVAILABLE,
  });
}

function clampMatchConfidence(providerConfidence?: number): number {
  if (
    providerConfidence !== undefined &&
    Number.isFinite(providerConfidence) &&
    providerConfidence >= 0 &&
    providerConfidence <= 1
  ) {
    return providerConfidence;
  }
  if (
    providerConfidence !== undefined &&
    Number.isFinite(providerConfidence) &&
    providerConfidence > 1 &&
    providerConfidence <= 100
  ) {
    return providerConfidence / 100;
  }
  return getScoringCalibrationConstants().MATCH_DEFAULT_CONFIDENCE;
}

function evaluateShodan(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.SHODAN;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;
  return contextOnlySignal(source, input, [
    scoringBasis(SCORING_BASIS_CODE.SHODAN_CONTEXT, input.normalized.summary),
    scoringBasis(SCORING_BASIS_CODE.INFRASTRUCTURE_CONTEXT),
  ]);
}

function evaluateCensys(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.CENSYS;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;
  return contextOnlySignal(source, input, [
    scoringBasis(SCORING_BASIS_CODE.CENSYS_CONTEXT, input.normalized.summary),
    scoringBasis(SCORING_BASIS_CODE.INFRASTRUCTURE_CONTEXT),
  ]);
}

function evaluateRdap(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const source = ENRICHMENT_SOURCE.RDAP_WHOIS;
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;
  // Errors already handled above — RDAP HTTP failures never become risk.
  return contextOnlySignal(source, input, [
    scoringBasis(
      SCORING_BASIS_CODE.RDAP_REGISTRATION_CONTEXT,
      input.normalized.summary
    ),
    scoringBasis(SCORING_BASIS_CODE.REGISTRATION_CONTEXT),
  ]);
}

function evaluateDerivedPivotOnly(
  source:
    | typeof ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING
    | typeof ENRICHMENT_SOURCE.PULSEDIVE,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal {
  const blocked = ensureApplicable(source, input) ?? signalForNonOkStatus(source, input);
  if (blocked) return blocked;
  return noSignal(source, input, SCORING_MODE.DERIVED, [
    scoringBasis(SCORING_BASIS_CODE.PIVOT_ONLY),
    scoringBasis(SCORING_BASIS_CODE.NO_DETECTION),
  ]);
}

function makeAdapter(
  source: AdapterNormalizedInput["sourceId"],
  evaluate: (
    input: SourceScoringAdapterInput<AdapterNormalizedInput>
  ) => ScoringSignal
): SourceScoringAdapter<AdapterNormalizedInput> {
  return {
    source,
    supports(targetType: IocType): boolean {
      return isSourceScoringApplicable(source, targetType);
    },
    evaluate,
  };
}

export const abuseIpdbScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.ABUSEIPDB,
  evaluateAbuseIPDB
);
export const virusTotalScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.VIRUSTOTAL,
  evaluateVirusTotal
);
export const otxScoringAdapter = makeAdapter(ENRICHMENT_SOURCE.OTX, evaluateOTX);
export const urlscanScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.URLSCAN,
  evaluateURLScan
);
export const greynoiseScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.GREYNOISE,
  evaluateGreyNoise
);
export const threatfoxScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.THREATFOX,
  (input) =>
    evaluateMatchPivotOnly(
      ENRICHMENT_SOURCE.THREATFOX,
      SCORING_BASIS_CODE.THREATFOX_MATCH,
      input
    )
);
export const urlhausScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.URLHAUS,
  (input) =>
    evaluateMatchPivotOnly(
      ENRICHMENT_SOURCE.URLHAUS,
      SCORING_BASIS_CODE.URLHAUS_MATCH,
      input
    )
);
export const malwareBazaarScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.MALWAREBAZAAR,
  (input) =>
    evaluateMatchPivotOnly(
      ENRICHMENT_SOURCE.MALWAREBAZAAR,
      SCORING_BASIS_CODE.MALWAREBAZAAR_MATCH,
      input
    )
);
export const shodanScoringAdapter = makeAdapter(ENRICHMENT_SOURCE.SHODAN, evaluateShodan);
export const censysScoringAdapter = makeAdapter(ENRICHMENT_SOURCE.CENSYS, evaluateCensys);
export const rdapWhoisScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.RDAP_WHOIS,
  evaluateRdap
);
export const googleSafeBrowsingScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
  (input) => evaluateDerivedPivotOnly(ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING, input)
);
export const pulsediveScoringAdapter = makeAdapter(
  ENRICHMENT_SOURCE.PULSEDIVE,
  (input) => evaluateDerivedPivotOnly(ENRICHMENT_SOURCE.PULSEDIVE, input)
);
