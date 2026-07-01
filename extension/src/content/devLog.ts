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
  attributeNodesScanned?: number;
  attributeNodeCap?: number;
  attributeCapReached?: boolean;
  iocCount: number;
  iocCap: number;
  iocCapReached: boolean;
  durationMs: number;
}): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const attributeSummary =
    profile.attributeNodesScanned !== undefined &&
    profile.attributeNodeCap !== undefined
      ? ` attrs=${profile.attributeNodesScanned}/${profile.attributeNodeCap} attributeCapReached=${Boolean(profile.attributeCapReached)}`
      : "";
  console.debug(
    `[Vera5] scan profile: nodes=${profile.textNodesScanned}/${profile.textNodeCap} capReached=${profile.capReached}${attributeSummary} iocs=${profile.iocCount}/${profile.iocCap} iocCapReached=${profile.iocCapReached} durationMs=${profile.durationMs.toFixed(1)}`
  );
}
