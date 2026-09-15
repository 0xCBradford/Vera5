/**
 * Phase 18B — Conditional Intelligence normalization helpers.
 * Conservative validators, generic-label filtering, corroboration merge.
 * No speculative inference from reputation or IOC type alone.
 */

export const CONDITIONAL_INTEL_OBSERVATION_KIND = {
  MALWARE_FAMILY: "MALWARE_FAMILY",
  MALWARE_ALIAS: "MALWARE_ALIAS",
  CAMPAIGN: "CAMPAIGN",
  THREAT_ACTOR: "THREAT_ACTOR",
  THREAT_CLUSTER: "THREAT_CLUSTER",
  MITRE_TECHNIQUE: "MITRE_TECHNIQUE",
  MITRE_TACTIC: "MITRE_TACTIC",
  CVE: "CVE",
  VULNERABILITY_REFERENCE: "VULNERABILITY_REFERENCE",
} as const;

export type ConditionalIntelObservationKind =
  (typeof CONDITIONAL_INTEL_OBSERVATION_KIND)[keyof typeof CONDITIONAL_INTEL_OBSERVATION_KIND];

export const CONDITIONAL_INTEL_EVIDENCE_QUALITY = {
  EXPLICIT_STRUCTURED: "EXPLICIT_STRUCTURED",
  EXPLICIT_TEXTUAL: "EXPLICIT_TEXTUAL",
  DERIVED_DETERMINISTIC: "DERIVED_DETERMINISTIC",
} as const;

export type ConditionalIntelEvidenceQuality =
  (typeof CONDITIONAL_INTEL_EVIDENCE_QUALITY)[keyof typeof CONDITIONAL_INTEL_EVIDENCE_QUALITY];

export type ConditionalIntelObservation = {
  kind: ConditionalIntelObservationKind;
  value: string;
  displayValue: string;
  sourceId: string;
  sourceLabel: string;
  quality: ConditionalIntelEvidenceQuality;
  confidence?: number;
  referenceUrl?: string;
};

export type EnrichmentIntelContext = {
  malwareFamilies?: readonly string[];
  malwareAliases?: readonly string[];
  campaigns?: readonly string[];
  threatActors?: readonly string[];
  threatClusters?: readonly string[];
  attackIds?: readonly string[];
  cveIds?: readonly string[];
};

/** Generic AV/category labels that must not become malware family names. */
const GENERIC_MALWARE_LABELS = new Set(
  [
    "trojan",
    "malware",
    "virus",
    "worm",
    "adware",
    "spyware",
    "ransomware",
    "phishing",
    "malicious",
    "suspicious",
    "heuristic",
    "generic",
    "downloader",
    "dropper",
    "unwanted",
    "pup",
    "riskware",
    "backdoor",
    "banker",
    "unknown",
    "none",
    "n/a",
    "na",
    "other",
    "not-a-virus",
    "hacktool",
    "joke",
    "packed",
    "obfuscated",
    "exploit",
    "scanner",
    "c2",
    "cnc",
    "botnet",
    "spam",
    "coinminer",
    "miner",
    "cryptominer",
  ].map((entry) => entry.toLowerCase())
);

const MITRE_TECHNIQUE_RE = /^T\d{4}(?:\.\d{3})?$/i;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;
const SAFE_HTTP_RE = /^https?:\/\//i;

export function normalizeEntityDisplayName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return trimmed;
}

/** Safe case/punctuation merge key for families/campaigns. */
export function normalizeEntityMergeKey(value: string): string {
  return normalizeEntityDisplayName(value)
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericMalwareLabel(value: string): boolean {
  const key = normalizeEntityMergeKey(value);
  if (!key) {
    return true;
  }
  if (GENERIC_MALWARE_LABELS.has(key)) {
    return true;
  }
  // Trojan.Generic / Malware.Generic / Win32.Generic style
  if (/^(win32|w32|osx|linux|android|js|vbs|msil)?[\s._-]*(generic|heuristic|malicious)\b/i.test(key)) {
    return true;
  }
  if (/\b(generic|heuristic)\b/i.test(key) && key.split(" ").length <= 3) {
    return true;
  }
  return false;
}

export function normalizeMalwareFamilyName(value: string): string | null {
  const display = normalizeEntityDisplayName(value);
  if (!display || isGenericMalwareLabel(display)) {
    return null;
  }
  // Prefer last meaningful token for AV-style "Trojan.Win32.Emotet.A"
  const parts = display.split(/[./\\]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1] ?? display;
    const secondLast = parts[parts.length - 2] ?? "";
    // Drop trailing version tokens like "A", "gen", "r1"
    if (/^[a-z]\d*$/i.test(last) && secondLast && !isGenericMalwareLabel(secondLast)) {
      if (!isGenericMalwareLabel(secondLast)) {
        return normalizeEntityDisplayName(secondLast);
      }
    }
    if (!isGenericMalwareLabel(last) && last.length >= 3) {
      return normalizeEntityDisplayName(last);
    }
  }
  return display;
}

export function normalizeMitreTechniqueId(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  if (!MITRE_TECHNIQUE_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function normalizeCveId(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  if (!CVE_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function extractCveIdsFromText(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const normalized = normalizeCveId(match);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function extractMitreTechniqueIdsFromText(text: string): string[] {
  const matches = text.match(/\bT\d{4}(?:\.\d{3})?\b/gi) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const normalized = normalizeMitreTechniqueId(match);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function sanitizeIntelReferenceUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!SAFE_HTTP_RE.test(trimmed)) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export type CorroboratedIntelFinding = {
  kind: ConditionalIntelObservationKind;
  value: string;
  displayValue: string;
  sources: readonly { sourceId: string; sourceLabel: string }[];
  sourceCount: number;
  quality: ConditionalIntelEvidenceQuality;
  referenceUrls: readonly string[];
  confidence?: number;
};

function qualityRank(quality: ConditionalIntelEvidenceQuality): number {
  if (quality === CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED) {
    return 3;
  }
  if (quality === CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_TEXTUAL) {
    return 2;
  }
  return 1;
}

/**
 * Merge identical observations across sources.
 * Same source counted once. Conflicts remain as separate findings.
 */
export function corroborateObservations(
  observations: readonly ConditionalIntelObservation[]
): CorroboratedIntelFinding[] {
  type Acc = {
    kind: ConditionalIntelObservationKind;
    value: string;
    displayValue: string;
    sources: Map<string, string>;
    quality: ConditionalIntelEvidenceQuality;
    referenceUrls: Set<string>;
    confidence?: number;
  };
  const byKey = new Map<string, Acc>();

  for (const observation of observations) {
    const mergeKey = `${observation.kind}:${normalizeEntityMergeKey(observation.value)}`;
    let entry = byKey.get(mergeKey);
    if (!entry) {
      entry = {
        kind: observation.kind,
        value: observation.value,
        displayValue: observation.displayValue,
        sources: new Map(),
        quality: observation.quality,
        referenceUrls: new Set(),
        confidence: observation.confidence,
      };
      byKey.set(mergeKey, entry);
    }
    entry.sources.set(observation.sourceId, observation.sourceLabel);
    if (qualityRank(observation.quality) > qualityRank(entry.quality)) {
      entry.quality = observation.quality;
      entry.displayValue = observation.displayValue;
      entry.value = observation.value;
    }
    const ref = sanitizeIntelReferenceUrl(observation.referenceUrl);
    if (ref) {
      entry.referenceUrls.add(ref);
    }
    if (
      typeof observation.confidence === "number" &&
      Number.isFinite(observation.confidence)
    ) {
      entry.confidence =
        entry.confidence === undefined
          ? observation.confidence
          : Math.max(entry.confidence, observation.confidence);
    }
  }

  const findings = [...byKey.values()].map((entry) => ({
    kind: entry.kind,
    value: entry.value,
    displayValue: entry.displayValue,
    sources: [...entry.sources.entries()].map(([sourceId, sourceLabel]) => ({
      sourceId,
      sourceLabel,
    })),
    sourceCount: entry.sources.size,
    quality: entry.quality,
    referenceUrls: [...entry.referenceUrls],
    ...(entry.confidence === undefined ? {} : { confidence: entry.confidence }),
  }));

  findings.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    if (right.sourceCount !== left.sourceCount) {
      return right.sourceCount - left.sourceCount;
    }
    return left.displayValue.localeCompare(right.displayValue);
  });

  return findings;
}

export function normalizeIntelContext(
  value: EnrichmentIntelContext | undefined
): EnrichmentIntelContext | undefined {
  if (!value) {
    return undefined;
  }
  const next: EnrichmentIntelContext = {};
  const families = uniqueNormalizedFamilies(value.malwareFamilies);
  if (families.length) {
    next.malwareFamilies = families;
  }
  const aliases = uniqueNormalizedFamilies(value.malwareAliases);
  if (aliases.length) {
    next.malwareAliases = aliases;
  }
  const campaigns = uniqueNonGenericNames(value.campaigns);
  if (campaigns.length) {
    next.campaigns = campaigns;
  }
  const actors = uniqueNonGenericNames(value.threatActors);
  if (actors.length) {
    next.threatActors = actors;
  }
  const clusters = uniqueNonGenericNames(value.threatClusters);
  if (clusters.length) {
    next.threatClusters = clusters;
  }
  const attackIds = uniqueMitreIds(value.attackIds);
  if (attackIds.length) {
    next.attackIds = attackIds;
  }
  const cveIds = uniqueCveIds(value.cveIds);
  if (cveIds.length) {
    next.cveIds = cveIds;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function uniqueNormalizedFamilies(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const family = normalizeMalwareFamilyName(value);
    if (!family) {
      continue;
    }
    const key = normalizeEntityMergeKey(family);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(family);
  }
  return out;
}

function uniqueNonGenericNames(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const display = normalizeEntityDisplayName(value);
    if (!display || isGenericMalwareLabel(display)) {
      continue;
    }
    const key = normalizeEntityMergeKey(display);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(display);
  }
  return out;
}

function uniqueMitreIds(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const id = normalizeMitreTechniqueId(value);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function uniqueCveIds(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const id = normalizeCveId(value);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}
