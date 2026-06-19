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
