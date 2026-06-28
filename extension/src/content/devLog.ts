export function logIocDetectionCount(count: number): void {
  if (!import.meta.env.DEV) {
    return;
  }
  console.debug(`[Vera5] detection count: ${count}`);
}

export function logIocScanProfile(profile: {
  textNodesScanned: number;
  textNodeCap: number;
  capReached: boolean;
  iocCount: number;
  iocCap: number;
  iocCapReached: boolean;
  durationMs: number;
}): void {
  if (!import.meta.env.DEV) {
    return;
  }
  console.debug(
    `[Vera5] scan profile: nodes=${profile.textNodesScanned}/${profile.textNodeCap} capReached=${profile.capReached} iocs=${profile.iocCount}/${profile.iocCap} iocCapReached=${profile.iocCapReached} durationMs=${profile.durationMs.toFixed(1)}`
  );
}
