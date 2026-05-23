import type { MessageResponse } from "../lib/messages";
import { handleScanPageRequest } from "./scanPage";

export const DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS = 400;

export type MutationRescanOptions = {
  enabled?: boolean;
  debounceMs?: number;
  root?: Node;
  onScan?: (result: MessageResponse) => void;
};

let activeObserver: MutationObserver | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let activeDebounceMs = DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS;
let activeRoot: Node = document.body;
let activeOnScan: ((result: MessageResponse) => void) | undefined;

function clearPendingRescan(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function runRescan(): void {
  void handleScanPageRequest(activeRoot).then((result) => {
    activeOnScan?.(result);
  });
}

export function scheduleDebouncedRescan(): void {
  clearPendingRescan();
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    runRescan();
  }, activeDebounceMs);
}

export function setupDebouncedMutationRescan(
  options: MutationRescanOptions = {}
): () => void {
  if (options.enabled !== true) {
    return () => undefined;
  }

  teardownDebouncedMutationRescan();

  activeDebounceMs =
    options.debounceMs ?? DEFAULT_MUTATION_RESCAN_DEBOUNCE_MS;
  activeRoot = options.root ?? document.body;
  activeOnScan = options.onScan;

  activeObserver = new MutationObserver(() => {
    scheduleDebouncedRescan();
  });

  activeObserver.observe(activeRoot, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return teardownDebouncedMutationRescan;
}

export function teardownDebouncedMutationRescan(): void {
  clearPendingRescan();
  activeObserver?.disconnect();
  activeObserver = null;
}

export function isMutationRescanActive(): boolean {
  return activeObserver !== null;
}
