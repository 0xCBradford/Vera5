export type TrayEnrichQueueSnapshot = {
  running: boolean;
  cancelRequested: boolean;
  currentIndex: number;
  totalCount: number;
  currentAnchorId: string | null;
};

let queueSnapshot: TrayEnrichQueueSnapshot | null = null;

export function getTrayEnrichQueueSnapshot(): TrayEnrichQueueSnapshot | null {
  return queueSnapshot;
}

export function isTrayEnrichQueueRunning(): boolean {
  return queueSnapshot?.running === true;
}

export function cancelTrayEnrichQueue(): void {
  if (!queueSnapshot?.running) {
    return;
  }
  queueSnapshot = {
    ...queueSnapshot,
    cancelRequested: true,
  };
}

export function resetTrayEnrichQueueForTests(): void {
  queueSnapshot = null;
}

export async function runSequentialTrayEnrichQueue(
  anchorIds: readonly string[],
  enrichAnchor: (anchorId: string) => Promise<void>,
  onStep?: (snapshot: TrayEnrichQueueSnapshot) => void
): Promise<{ completedCount: number; cancelled: boolean }> {
  if (anchorIds.length === 0 || queueSnapshot?.running) {
    return { completedCount: 0, cancelled: false };
  }

  let completedCount = 0;
  let cancelled = false;

  queueSnapshot = {
    running: true,
    cancelRequested: false,
    currentIndex: 0,
    totalCount: anchorIds.length,
    currentAnchorId: null,
  };
  onStep?.(queueSnapshot);

  for (let index = 0; index < anchorIds.length; index += 1) {
    if (queueSnapshot.cancelRequested) {
      cancelled = true;
      break;
    }

    const anchorId = anchorIds[index];
    queueSnapshot = {
      ...queueSnapshot,
      currentIndex: index + 1,
      currentAnchorId: anchorId,
    };
    onStep?.(queueSnapshot);

    await enrichAnchor(anchorId);
    completedCount += 1;

    if (queueSnapshot.cancelRequested) {
      cancelled = true;
      break;
    }
  }

  queueSnapshot = null;
  return { completedCount, cancelled };
}
