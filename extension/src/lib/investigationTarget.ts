/**
 * Phase 18A — canonical Investigation Target derived from the global selected IOC.
 * No separate investigation-only selection.
 */

import { normalizeIocNoteKey } from "./analystNotesStorage";
import { type IocType } from "./iocRegex";

export type InvestigationTarget = {
  /** Canonical identity key: `${iocType}:${normalizedValue}`. */
  targetKey: string;
  canonicalValue: string;
  displayValue: string;
  iocType: IocType;
  selectedAt: number;
  anchorId: string | null;
};

export function buildInvestigationTargetKey(
  iocType: IocType,
  value: string
): string {
  return `${iocType}:${normalizeIocNoteKey(value)}`;
}

export function createInvestigationTarget(input: {
  iocType: IocType;
  value: string;
  displayValue?: string;
  anchorId?: string | null;
  selectedAt?: number;
}): InvestigationTarget | null {
  const trimmed = input.value.trim();
  if (!trimmed) {
    return null;
  }
  const canonicalValue = normalizeIocNoteKey(trimmed);
  return {
    targetKey: buildInvestigationTargetKey(input.iocType, trimmed),
    canonicalValue,
    displayValue: (input.displayValue ?? trimmed).trim() || trimmed,
    iocType: input.iocType,
    selectedAt: input.selectedAt ?? Date.now(),
    anchorId: input.anchorId ?? null,
  };
}

export function investigationTargetFromScanEntry(entry: {
  type: IocType;
  value: string;
  anchorId?: string;
  displayValue?: string;
} | null): InvestigationTarget | null {
  if (!entry) {
    return null;
  }
  return createInvestigationTarget({
    iocType: entry.type,
    value: entry.value,
    displayValue: entry.displayValue ?? entry.value,
    anchorId: entry.anchorId ?? null,
  });
}
