import {
  getQuietMode,
  TRAY_ENRICH_QUEUE_QUIET_MODE_ABORT_MESSAGE,
} from "../lib/storage";

export type TrayEnrichQueueSnapshot = {
  running: boolean;
  cancelRequested: boolean;
  currentIndex: number;
  totalCount: number;
  currentAnchorId: string | null;
};

export type TrayEnrichQueueRunResult = {
  completedCount: number;
  cancelled: boolean;
  aborted?: boolean;
  abortMessage?: string;
};

export type TrayEnrichQueueQuietModeGateResult =
  | { allowed: true }
  | { allowed: false; message: string };

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

export function resolveTrayEnrichQueueQuietModeGate(
  quietMode: boolean
): TrayEnrichQueueQuietModeGateResult {
  if (!quietMode) {
    return { allowed: true };
  }
  return {
    allowed: false,
    message: TRAY_ENRICH_QUEUE_QUIET_MODE_ABORT_MESSAGE,
  };
}

export async function runSequentialTrayEnrichQueue(
  anchorIds: readonly string[],
  enrichAnchor: (anchorId: string) => Promise<void>,
  onStep?: (snapshot: TrayEnrichQueueSnapshot) => void
): Promise<TrayEnrichQueueRunResult> {
  if (anchorIds.length === 0 || queueSnapshot?.running) {
    return { completedCount: 0, cancelled: false };
  }

  const quietGate = resolveTrayEnrichQueueQuietModeGate(await getQuietMode());
  if (!quietGate.allowed) {
    return {
      completedCount: 0,
      cancelled: false,
      aborted: true,
      abortMessage: quietGate.message,
    };
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
