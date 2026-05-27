import { parseRateLimitHeaders } from "./enrichment";

export const DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS = 60;
export const MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS = 3600;

let cooldownUntilMs = 0;

export function clearGlobalEnrichmentCooldown(): void {
  cooldownUntilMs = 0;
}

export function getGlobalEnrichmentCooldownUntilMs(): number {
  return cooldownUntilMs;
}

export function resolveGlobalCooldownDurationMs(
  retryAfterSeconds?: number
): number {
  const seconds =
    retryAfterSeconds ?? DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS;
  const bounded = Math.min(
    MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
    Math.max(1, Math.floor(seconds))
  );
  return bounded * 1000;
}

export function recordGlobalEnrichmentCooldown(
  retryAfterSeconds?: number,
  nowMs: number = Date.now()
): void {
  const nextUntilMs = nowMs + resolveGlobalCooldownDurationMs(retryAfterSeconds);
  cooldownUntilMs = Math.max(cooldownUntilMs, nextUntilMs);
}

export function recordGlobalEnrichmentCooldownFromHeaders(
  headers: Headers,
  nowMs: number = Date.now()
): void {
  const snapshot = parseRateLimitHeaders(headers);
  recordGlobalEnrichmentCooldown(snapshot?.retryAfterSeconds, nowMs);
}

export function isGlobalEnrichmentCooldownActive(
  nowMs: number = Date.now()
): boolean {
  return nowMs < cooldownUntilMs;
}

export function getGlobalEnrichmentCooldownRemainingSeconds(
  nowMs: number = Date.now()
): number {
  if (!isGlobalEnrichmentCooldownActive(nowMs)) {
    return 0;
  }
  return Math.ceil((cooldownUntilMs - nowMs) / 1000);
}

export function formatGlobalEnrichmentCooldownMessage(): string {
  return "Threat intelligence rate limit reached. Back off before retrying.";
}

export function formatGlobalEnrichmentCooldownRetryHint(
  nowMs: number = Date.now()
): string {
  const remainingSeconds = getGlobalEnrichmentCooldownRemainingSeconds(nowMs);
  if (remainingSeconds <= 0) {
    return "Try again later.";
  }
  return `Retry after ${remainingSeconds} seconds.`;
}
