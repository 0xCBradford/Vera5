/**
 * Phase 21B — authoritative scoring-adapter registry + shadow evaluation.
 *
 * Production composite (lib/scoring.ts) is NOT replaced here.
 */

import type { EnrichmentResult, EnrichmentSourceResult } from "../enrichment";
import { ENRICHMENT_SOURCE, type EnrichmentSourceId } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";
import type { SourceScoringAdapter } from "./scoringAdapter";
import type { AdapterNormalizedInput } from "./adapterCommon";
import {
  abuseIpdbScoringAdapter,
  censysScoringAdapter,
  googleSafeBrowsingScoringAdapter,
  greynoiseScoringAdapter,
  malwareBazaarScoringAdapter,
  otxScoringAdapter,
  pulsediveScoringAdapter,
  rdapWhoisScoringAdapter,
  shodanScoringAdapter,
  threatfoxScoringAdapter,
  urlhausScoringAdapter,
  urlscanScoringAdapter,
  virusTotalScoringAdapter,
} from "./scoringAdapters";
import {
  getSourceScoringPolicy,
  getSourceTargetScoringPolicy,
} from "./scoringPolicy";
import {
  serializeScoringSignalForDiagnostics,
  hasScoringRisk,
  isCompositeEligible,
} from "./scoringSignal";
import type { ScoringSignal, ScoringTarget } from "./scoringTypes";
import { validateScoringSignal } from "./scoringValidation";

export const SCORING_ADAPTER_REGISTRY: Record<
  EnrichmentSourceId,
  SourceScoringAdapter<AdapterNormalizedInput>
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: abuseIpdbScoringAdapter,
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: virusTotalScoringAdapter,
  [ENRICHMENT_SOURCE.OTX]: otxScoringAdapter,
  [ENRICHMENT_SOURCE.URLSCAN]: urlscanScoringAdapter,
  [ENRICHMENT_SOURCE.GREYNOISE]: greynoiseScoringAdapter,
  [ENRICHMENT_SOURCE.THREATFOX]: threatfoxScoringAdapter,
  [ENRICHMENT_SOURCE.URLHAUS]: urlhausScoringAdapter,
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: malwareBazaarScoringAdapter,
  [ENRICHMENT_SOURCE.SHODAN]: shodanScoringAdapter,
  [ENRICHMENT_SOURCE.CENSYS]: censysScoringAdapter,
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: rdapWhoisScoringAdapter,
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: googleSafeBrowsingScoringAdapter,
  [ENRICHMENT_SOURCE.PULSEDIVE]: pulsediveScoringAdapter,
};

export function getScoringAdapter(
  source: EnrichmentSourceId
): SourceScoringAdapter<AdapterNormalizedInput> {
  return SCORING_ADAPTER_REGISTRY[source];
}

export function evaluateSourceSignal(
  source: EnrichmentSourceId,
  target: ScoringTarget,
  normalized: EnrichmentSourceResult
): ScoringSignal {
  const adapter = getScoringAdapter(source);
  const policy = getSourceScoringPolicy(source);
  const targetPolicy = getSourceTargetScoringPolicy(source, target.iocType);
  const signal = adapter.evaluate({
    target,
    normalized,
    policy,
    targetPolicy,
  });
  const validated = validateScoringSignal(signal);
  if (!validated.ok) {
    return {
      ...signal,
      risk: null,
      confidence: 0,
      effectiveWeight: 0,
      status: "INVALID",
      metadata: {
        ...(signal.metadata ?? {}),
        validationIssues: validated.issues,
      },
    };
  }
  return validated.signal;
}

/**
 * Shadow / parallel V2 signal generation for an enrichment result.
 * Does NOT feed production composite scoring (Phase 21C).
 */
export function evaluateShadowScoringSignals(
  enrichment: EnrichmentResult
): ScoringSignal[] {
  const target: ScoringTarget = {
    iocType: enrichment.type,
    value: enrichment.ioc,
  };
  return enrichment.sources.map((sourceResult) =>
    evaluateSourceSignal(sourceResult.sourceId, target, sourceResult)
  );
}

export type LegacyVsV2Comparison = {
  source: EnrichmentSourceId;
  legacySignal: number | null;
  v2: {
    risk: number | null;
    confidence: number;
    direction: ScoringSignal["direction"];
    mode: ScoringSignal["mode"];
    hasScoringRisk: boolean;
    compositeEligible: boolean;
    basis: ScoringSignal["basis"];
  };
};

/** Developer diagnostic — no UI, no secrets. */
export function compareLegacyAssessmentToV2Signal(
  sourceResult: EnrichmentSourceResult,
  signal: ScoringSignal
): LegacyVsV2Comparison {
  const legacySignal =
    sourceResult.assessment?.kind === "risk" &&
    typeof sourceResult.assessment.signal === "number"
      ? sourceResult.assessment.signal
      : null;
  return {
    source: sourceResult.sourceId,
    legacySignal,
    v2: {
      risk: signal.risk,
      confidence: signal.confidence,
      direction: signal.direction,
      mode: signal.mode,
      hasScoringRisk: hasScoringRisk(signal),
      compositeEligible: isCompositeEligible(signal),
      basis: signal.basis,
    },
  };
}

export function diagnoseScoringSignal(signal: ScoringSignal): Record<string, unknown> {
  return serializeScoringSignalForDiagnostics(signal);
}

export function createScoringTarget(iocType: IocType, value: string): ScoringTarget {
  return { iocType, value };
}
