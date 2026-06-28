export const UNIFIED_TAG_LIMIT = 5;

export const UNIFIED_SUMMARY_METRIC = {
  ABUSE_CONFIDENCE: "abuse_confidence",
  REPORT_COUNT: "report_count",
  PULSE_COUNT: "pulse_count",
  SCAN_COUNT: "scan_count",
} as const;

export type UnifiedSummaryMetric =
  (typeof UNIFIED_SUMMARY_METRIC)[keyof typeof UNIFIED_SUMMARY_METRIC];

export type UnifiedEnrichmentPresentation = {
  summary: string;
  tags: readonly string[];
};

export type UnifiedVendorFieldMap = {
  summaryMetric?: UnifiedSummaryMetric;
  summaryValue?: number;
  countryCode?: string;
  usageType?: string;
  isp?: string;
  domain?: string;
  threatTags?: readonly string[];
};

function appendUniqueTag(
  tags: string[],
  seen: Set<string>,
  value: string | undefined
): void {
  if (tags.length >= UNIFIED_TAG_LIMIT) {
    return;
  }
  const trimmed = value?.trim();
  if (!trimmed || seen.has(trimmed)) {
    return;
  }
  seen.add(trimmed);
  tags.push(trimmed);
}

export function buildUnifiedSummary(
  metric: UnifiedSummaryMetric | undefined,
  value: number | undefined
): string | null {
  if (metric === undefined || value === undefined) {
    return null;
  }
  const rounded = Math.max(0, Math.round(value));
  if (metric === UNIFIED_SUMMARY_METRIC.ABUSE_CONFIDENCE) {
    return `${rounded} abuse confidence`;
  }
  if (metric === UNIFIED_SUMMARY_METRIC.REPORT_COUNT) {
    return `${rounded} reports`;
  }
  if (metric === UNIFIED_SUMMARY_METRIC.SCAN_COUNT) {
    return rounded === 1 ? "1 urlscan result" : `${rounded} urlscan results`;
  }
  return rounded === 1 ? "1 threat pulse" : `${rounded} threat pulses`;
}

export function buildUnifiedTags(
  fields: Pick<
    UnifiedVendorFieldMap,
    "countryCode" | "usageType" | "isp" | "domain" | "threatTags"
  >
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  if (fields.countryCode) {
    appendUniqueTag(tags, seen, fields.countryCode.toUpperCase());
  }
  appendUniqueTag(tags, seen, fields.usageType);
  appendUniqueTag(tags, seen, fields.isp);
  appendUniqueTag(tags, seen, fields.domain);

  for (const threatTag of fields.threatTags ?? []) {
    appendUniqueTag(tags, seen, threatTag);
    if (tags.length >= UNIFIED_TAG_LIMIT) {
      break;
    }
  }

  return tags;
}

export function mapVendorFieldsToUnifiedPresentation(
  fields: UnifiedVendorFieldMap
): UnifiedEnrichmentPresentation | null {
  const summary = buildUnifiedSummary(fields.summaryMetric, fields.summaryValue);
  if (!summary) {
    return null;
  }
  return {
    summary,
    tags: buildUnifiedTags(fields),
  };
}

export type AbuseIpdbUnifiedInput = {
  abuseConfidenceScore?: number;
  totalReports?: number;
  countryCode?: string;
  usageType?: string;
  isp?: string;
  domain?: string;
};

export function mapAbuseIpdbFieldsToUnifiedPresentation(
  data: AbuseIpdbUnifiedInput
): UnifiedEnrichmentPresentation | null {
  const summaryMetric =
    data.abuseConfidenceScore !== undefined
      ? UNIFIED_SUMMARY_METRIC.ABUSE_CONFIDENCE
      : data.totalReports !== undefined
        ? UNIFIED_SUMMARY_METRIC.REPORT_COUNT
        : undefined;
  const summaryValue = data.abuseConfidenceScore ?? data.totalReports;

  return mapVendorFieldsToUnifiedPresentation({
    summaryMetric,
    summaryValue,
    countryCode: data.countryCode,
    usageType: data.usageType,
    isp: data.isp,
    domain: data.domain,
  });
}

export type OtxUnifiedInput = {
  pulseCount: number;
  threatTags?: readonly string[];
};

export function collectOtxThreatTags(
  pulses: readonly { tags?: readonly string[] }[] | undefined
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const pulse of pulses ?? []) {
    for (const tag of pulse.tags ?? []) {
      const trimmed = tag.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      tags.push(trimmed);
      if (tags.length >= UNIFIED_TAG_LIMIT) {
        return tags;
      }
    }
  }
  return tags;
}

export function mapOtxFieldsToUnifiedPresentation(
  input: OtxUnifiedInput
): UnifiedEnrichmentPresentation | null {
  return mapVendorFieldsToUnifiedPresentation({
    summaryMetric: UNIFIED_SUMMARY_METRIC.PULSE_COUNT,
    summaryValue: input.pulseCount,
    threatTags: input.threatTags,
  });
}

export type UrlscanUnifiedInput = {
  scanCount: number;
  threatTags?: readonly string[];
  topDomain?: string;
  countryCode?: string;
};

export function collectUrlscanThreatTags(
  results:
    | readonly {
        verdictTags?: readonly string[];
        taskTags?: readonly string[];
        maliciousVerdict?: boolean;
      }[]
    | undefined
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const result of results ?? []) {
    if (result.maliciousVerdict === true) {
      appendUniqueTag(tags, seen, "malicious");
    }
    for (const tag of [...(result.verdictTags ?? []), ...(result.taskTags ?? [])]) {
      const trimmed = tag.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      tags.push(trimmed);
      if (tags.length >= UNIFIED_TAG_LIMIT) {
        return tags;
      }
    }
  }
  return tags;
}

export function mapUrlscanFieldsToUnifiedPresentation(
  input: UrlscanUnifiedInput
): UnifiedEnrichmentPresentation | null {
  return mapVendorFieldsToUnifiedPresentation({
    summaryMetric: UNIFIED_SUMMARY_METRIC.SCAN_COUNT,
    summaryValue: input.scanCount,
    threatTags: input.threatTags,
    domain: input.topDomain,
    countryCode: input.countryCode,
  });
}

export type GreyNoiseUnifiedInput = {
  noise: boolean;
  riot: boolean;
  classification?: string;
  name?: string;
};

export function buildGreyNoiseUnifiedSummary(input: GreyNoiseUnifiedInput): string {
  if (input.riot && input.classification === "benign") {
    return "benign RIOT service";
  }
  if (input.noise && input.classification === "malicious") {
    return "malicious internet noise";
  }
  if (input.noise && input.classification === "unknown") {
    return "unknown internet noise";
  }
  if (input.noise && input.classification === "benign") {
    return "benign internet noise";
  }
  if (input.noise && input.classification) {
    return `${input.classification} internet noise`;
  }
  if (input.noise) {
    return "unknown internet noise";
  }
  if (!input.noise && !input.riot) {
    return "not observed in GreyNoise";
  }
  if (input.classification) {
    return `${input.classification} classification`;
  }
  return "not observed in GreyNoise";
}

export function buildGreyNoiseUnifiedTags(
  input: GreyNoiseUnifiedInput
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  if (input.classification) {
    appendUniqueTag(tags, seen, input.classification.toLowerCase());
  }
  appendUniqueTag(tags, seen, input.name);
  if (input.noise) {
    appendUniqueTag(tags, seen, "noise");
  }
  if (input.riot) {
    appendUniqueTag(tags, seen, "riot");
  }

  return tags;
}

export function mapGreyNoiseFieldsToUnifiedPresentation(
  input: GreyNoiseUnifiedInput
): UnifiedEnrichmentPresentation {
  return {
    summary: buildGreyNoiseUnifiedSummary(input),
    tags: buildGreyNoiseUnifiedTags(input),
  };
}

export type VirustotalUnifiedInput = {
  maliciousDetections?: number;
  suspiciousDetections?: number;
  harmlessDetections?: number;
  countryCode?: string;
  networkOwner?: string;
};

export function buildVirustotalUnifiedSummary(
  input: VirustotalUnifiedInput
): string {
  const malicious = input.maliciousDetections ?? 0;
  const suspicious = input.suspiciousDetections ?? 0;
  if (malicious > 0) {
    return malicious === 1 ? "1 malicious detection" : `${malicious} malicious detections`;
  }
  if (suspicious > 0) {
    return suspicious === 1 ? "1 suspicious detection" : `${suspicious} suspicious detections`;
  }
  const harmless = input.harmlessDetections ?? 0;
  if (harmless > 0) {
    return harmless === 1 ? "1 harmless detection" : `${harmless} harmless detections`;
  }
  return "No vendor detections recorded";
}

export function mapVirustotalFieldsToUnifiedPresentation(
  input: VirustotalUnifiedInput
): UnifiedEnrichmentPresentation {
  return {
    summary: buildVirustotalUnifiedSummary(input),
    tags: buildUnifiedTags({
      countryCode: input.countryCode,
      isp: input.networkOwner,
    }),
  };
}

export type ShodanUnifiedInput = {
  openServiceCount?: number;
  subdomainCount?: number;
  dnsRecordCount?: number;
  countryCode?: string;
  organization?: string;
  serviceTags?: readonly string[];
};

export function buildShodanUnifiedSummary(input: ShodanUnifiedInput): string {
  const openServices = input.openServiceCount ?? 0;
  if (openServices > 0) {
    return openServices === 1 ? "1 open service" : `${openServices} open services`;
  }

  const subdomains = input.subdomainCount ?? 0;
  if (subdomains > 0) {
    return subdomains === 1 ? "1 subdomain" : `${subdomains} subdomains`;
  }

  const dnsRecords = input.dnsRecordCount ?? 0;
  if (dnsRecords > 0) {
    return dnsRecords === 1 ? "1 DNS record" : `${dnsRecords} DNS records`;
  }

  return "No Shodan exposure data";
}

export function buildShodanUnifiedTags(
  input: ShodanUnifiedInput
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  if (input.countryCode) {
    appendUniqueTag(tags, seen, input.countryCode.toUpperCase());
  }
  appendUniqueTag(tags, seen, input.organization);

  for (const serviceTag of input.serviceTags ?? []) {
    appendUniqueTag(tags, seen, serviceTag);
    if (tags.length >= UNIFIED_TAG_LIMIT) {
      break;
    }
  }

  return tags;
}

export function mapShodanFieldsToUnifiedPresentation(
  input: ShodanUnifiedInput
): UnifiedEnrichmentPresentation {
  return {
    summary: buildShodanUnifiedSummary(input),
    tags: buildShodanUnifiedTags(input),
  };
}

export type CensysUnifiedInput = {
  serviceCount?: number;
  certificateCount?: number;
  dnsNameCount?: number;
  countryCode?: string;
  autonomousSystemName?: string;
  serviceTags?: readonly string[];
  certificateTags?: readonly string[];
  dnsNames?: readonly string[];
};

export function buildCensysUnifiedSummary(input: CensysUnifiedInput): string {
  const services = input.serviceCount ?? 0;
  if (services > 0) {
    return services === 1 ? "1 observed service" : `${services} observed services`;
  }

  const certificates = input.certificateCount ?? 0;
  if (certificates > 0) {
    return certificates === 1 ? "1 TLS certificate" : `${certificates} TLS certificates`;
  }

  const dnsNames = input.dnsNameCount ?? 0;
  if (dnsNames > 0) {
    return dnsNames === 1 ? "1 DNS name" : `${dnsNames} DNS names`;
  }

  return "No Censys host data";
}

export function buildCensysUnifiedTags(
  input: CensysUnifiedInput
): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  if (input.countryCode) {
    appendUniqueTag(tags, seen, input.countryCode.toUpperCase());
  }
  appendUniqueTag(tags, seen, input.autonomousSystemName);

  for (const serviceTag of input.serviceTags ?? []) {
    appendUniqueTag(tags, seen, serviceTag);
    if (tags.length >= UNIFIED_TAG_LIMIT) {
      return tags;
    }
  }

  for (const certificateTag of input.certificateTags ?? []) {
    appendUniqueTag(tags, seen, certificateTag);
    if (tags.length >= UNIFIED_TAG_LIMIT) {
      return tags;
    }
  }

  for (const dnsName of input.dnsNames ?? []) {
    appendUniqueTag(tags, seen, dnsName);
    if (tags.length >= UNIFIED_TAG_LIMIT) {
      break;
    }
  }

  return tags;
}

export function mapCensysFieldsToUnifiedPresentation(
  input: CensysUnifiedInput
): UnifiedEnrichmentPresentation {
  return {
    summary: buildCensysUnifiedSummary(input),
    tags: buildCensysUnifiedTags(input),
  };
}
