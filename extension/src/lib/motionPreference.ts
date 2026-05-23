export const PREFERS_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(view: Window = window): boolean {
  return view.matchMedia(PREFERS_REDUCED_MOTION_QUERY).matches;
}

export function getCopyFeedbackResetMs(view: Window = window): number {
  return prefersReducedMotion(view) ? 0 : 1500;
}

export function scheduleCopyFeedbackReset(
  callback: () => void,
  view: Window = window
): void {
  const delayMs = getCopyFeedbackResetMs(view);
  if (delayMs === 0) {
    callback();
    return;
  }
  view.setTimeout(callback, delayMs);
}
