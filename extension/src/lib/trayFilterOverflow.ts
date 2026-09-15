import type { IocType } from "./iocRegex";

/**
 * Phase 16D — partition present IOC types into primary rail vs MORE overflow.
 * Preserves canonical order. Active type always remains in primary when possible.
 */
export function partitionTrayFilterTypesForOverflow(
  orderedTypes: ReadonlyArray<IocType>,
  maxPrimarySlots: number,
  activeType: IocType | null
): { primary: IocType[]; overflow: IocType[] } {
  if (orderedTypes.length === 0) {
    return { primary: [], overflow: [] };
  }

  const slots = Math.max(0, maxPrimarySlots);
  if (slots >= orderedTypes.length) {
    return { primary: [...orderedTypes], overflow: [] };
  }

  const primarySet = new Set<IocType>();
  for (const type of orderedTypes) {
    if (primarySet.size >= slots) {
      break;
    }
    primarySet.add(type);
  }

  if (activeType && orderedTypes.includes(activeType) && !primarySet.has(activeType)) {
    const primaryList = orderedTypes.filter((type) => primarySet.has(type));
    const removable = [...primaryList].reverse().find((type) => type !== activeType);
    if (removable) {
      primarySet.delete(removable);
    }
    primarySet.add(activeType);
  }

  const primary = orderedTypes.filter((type) => primarySet.has(type));
  const overflow = orderedTypes.filter((type) => !primarySet.has(type));
  return { primary, overflow };
}

/** Phase 17E — resist ±1 slot oscillation when rail width changes by less than this delta. */
export const FILTER_PRIMARY_SLOT_HYSTERESIS_PX = 12;

/**
 * Phase 17E — stabilize MORE overflow partition across resize (no 1px flip loops).
 * Full-fit ↔ overflow transitions apply immediately; within overflow mode, ±1 slot
 * changes require a meaningful width delta since the last applied slot count.
 */
export function stabilizeFilterPrimarySlotCount(input: {
  proposed: number;
  previous: number;
  orderedTypeCount: number;
  containerWidth: number;
  lastAppliedWidth: number;
}): number {
  const { proposed, previous, orderedTypeCount, containerWidth, lastAppliedWidth } = input;
  if (proposed === previous) {
    return proposed;
  }

  const proposedAllFit = proposed >= orderedTypeCount;
  const previousAllFit = previous >= orderedTypeCount;
  if (proposedAllFit !== previousAllFit) {
    return proposed;
  }

  const widthDelta = Math.abs(containerWidth - lastAppliedWidth);
  if (widthDelta < FILTER_PRIMARY_SLOT_HYSTERESIS_PX && Math.abs(proposed - previous) <= 1) {
    return previous;
  }

  return proposed;
}
