export const IOC_LABEL_IDS = [
  "benign",
  "internal",
  "suppress-false-positive",
  "case-important",
] as const;

export type IocLabelId = (typeof IOC_LABEL_IDS)[number];

export const IOC_LABEL_DISPLAY: Record<IocLabelId, string> = {
  benign: "Benign",
  internal: "Internal",
  "suppress-false-positive": "Suppress false positive",
  "case-important": "Case important",
};

/**
 * Watchlist labels that block an IOC from cross-session correlation cluster
 * promotion. Analysts apply these explicitly; they are not detection verdicts.
 */
export const IOC_LABELS_EXCLUDED_FROM_CORRELATION_CLUSTER_PROMOTION: readonly IocLabelId[] =
  ["internal", "suppress-false-positive"];

const IOC_LABELS_EXCLUDED_FROM_CORRELATION_CLUSTER_PROMOTION_SET = new Set<string>(
  IOC_LABELS_EXCLUDED_FROM_CORRELATION_CLUSTER_PROMOTION
);

export function isIocLabelId(value: unknown): value is IocLabelId {
  return typeof value === "string" && (IOC_LABEL_IDS as readonly string[]).includes(value);
}

export function normalizeIocLabelId(value: unknown): IocLabelId | null {
  if (!isIocLabelId(value)) {
    return null;
  }
  return value;
}

export function formatIocLabelDisplay(label: IocLabelId): string {
  return IOC_LABEL_DISPLAY[label];
}

export function isIocLabelExcludedFromCorrelationClusterPromotion(
  label: IocLabelId | null | undefined
): boolean {
  if (!label) {
    return false;
  }
  return IOC_LABELS_EXCLUDED_FROM_CORRELATION_CLUSTER_PROMOTION_SET.has(label);
}
