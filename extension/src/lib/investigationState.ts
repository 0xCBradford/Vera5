/**
 * Phase 18A — per-IOC investigation runtime state (in-memory).
 * Scoped by canonical targetKey. No cross-target contamination.
 */

import type {
  InvestigationCapabilityId,
  InvestigationFinding,
  InvestigationReasonCode,
  InvestigationStatus,
} from "./investigationCapability";

export type InvestigationCapabilityRuntimeState = {
  status: InvestigationStatus;
  completedAt: number | null;
  findings: readonly InvestigationFinding[];
  summary: string | null;
  reasonCode: InvestigationReasonCode | null;
  reasonDetail: string | null;
  error: string | null;
  /** Analyst explicitly activated this capability (pivot/sandbox/review). */
  executed: boolean;
};

type TargetCapabilityMap = Map<
  InvestigationCapabilityId,
  InvestigationCapabilityRuntimeState
>;

/** Session-scoped store — survives workspace tab switches within the popup lifetime. */
const capabilityStateByTarget = new Map<string, TargetCapabilityMap>();

export function getInvestigationCapabilityState(
  targetKey: string,
  capabilityId: InvestigationCapabilityId
): InvestigationCapabilityRuntimeState | null {
  return capabilityStateByTarget.get(targetKey)?.get(capabilityId) ?? null;
}

export function listInvestigationCapabilityStates(
  targetKey: string
): ReadonlyMap<InvestigationCapabilityId, InvestigationCapabilityRuntimeState> {
  return capabilityStateByTarget.get(targetKey) ?? new Map();
}

export function setInvestigationCapabilityState(
  targetKey: string,
  capabilityId: InvestigationCapabilityId,
  state: InvestigationCapabilityRuntimeState
): void {
  let map = capabilityStateByTarget.get(targetKey);
  if (!map) {
    map = new Map();
    capabilityStateByTarget.set(targetKey, map);
  }
  map.set(capabilityId, state);
}

export function markInvestigationCapabilityExecuted(
  targetKey: string,
  capabilityId: InvestigationCapabilityId,
  input?: {
    status?: InvestigationStatus;
    summary?: string | null;
    findings?: readonly InvestigationFinding[];
    reasonDetail?: string | null;
  }
): InvestigationCapabilityRuntimeState {
  const next: InvestigationCapabilityRuntimeState = {
    status: input?.status ?? "AVAILABLE",
    completedAt: Date.now(),
    findings: input?.findings ?? [],
    summary: input?.summary ?? null,
    reasonCode: "COMPLETED",
    reasonDetail: input?.reasonDetail ?? null,
    error: null,
    executed: true,
  };
  setInvestigationCapabilityState(targetKey, capabilityId, next);
  return next;
}

/** Test / reset helper — clears all per-IOC investigation runtime state. */
export function clearAllInvestigationCapabilityState(): void {
  capabilityStateByTarget.clear();
}

export function clearInvestigationCapabilityStateForTarget(targetKey: string): void {
  capabilityStateByTarget.delete(targetKey);
}
