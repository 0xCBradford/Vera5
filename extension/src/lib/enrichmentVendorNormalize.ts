export const UNIFIED_TAG_LIMIT = 5;

export const UNIFIED_SUMMARY_METRIC = {
  ABUSE_CONFIDENCE: "abuse_confidence",
  REPORT_COUNT: "report_count",
  PULSE_COUNT: "pulse_count",
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
