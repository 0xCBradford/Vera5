export function logIocDetectionCount(count: number): void {
  if (!import.meta.env.DEV) {
    return;
  }
  console.debug(`[Vera5] detection count: ${count}`);
}
