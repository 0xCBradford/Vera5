import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGlobalEnrichmentCooldown,
  DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
  formatGlobalEnrichmentCooldownRetryHint,
  getGlobalEnrichmentCooldownRemainingSeconds,
  isGlobalEnrichmentCooldownActive,
  MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS,
  recordGlobalEnrichmentCooldown,
  recordGlobalEnrichmentCooldownFromHeaders,
  resolveGlobalCooldownDurationMs,
} from "./enrichmentCooldown";

describe("global enrichment cooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearGlobalEnrichmentCooldown();
  });

  afterEach(() => {
    clearGlobalEnrichmentCooldown();
    vi.useRealTimers();
  });

  it("uses the default cooldown when retry-after is missing", () => {
    const nowMs = 1_700_000_000_000;
    recordGlobalEnrichmentCooldown(undefined, nowMs);

    expect(isGlobalEnrichmentCooldownActive(nowMs)).toBe(true);
    expect(isGlobalEnrichmentCooldownActive(nowMs + 59_999)).toBe(true);
    expect(isGlobalEnrichmentCooldownActive(nowMs + 60_000)).toBe(false);
    expect(resolveGlobalCooldownDurationMs()).toBe(
      DEFAULT_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS * 1000
    );
  });

  it("records cooldown from Retry-After headers", () => {
    const nowMs = 1_700_000_000_000;
    const headers = new Headers({ "Retry-After": "120" });
    recordGlobalEnrichmentCooldownFromHeaders(headers, nowMs);

    expect(getGlobalEnrichmentCooldownRemainingSeconds(nowMs + 30_000)).toBe(90);
    expect(formatGlobalEnrichmentCooldownRetryHint(nowMs + 30_000)).toBe(
      "Retry after 90 seconds."
    );
  });

  it("extends cooldown to the longest retry window", () => {
    const nowMs = 1_700_000_000_000;
    recordGlobalEnrichmentCooldown(30, nowMs);
    recordGlobalEnrichmentCooldown(120, nowMs);

    expect(getGlobalEnrichmentCooldownRemainingSeconds(nowMs + 10_000)).toBe(110);
  });

  it("caps cooldown duration at the configured maximum", () => {
    recordGlobalEnrichmentCooldown(MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS + 500);

    expect(resolveGlobalCooldownDurationMs(999_999)).toBe(
      MAX_GLOBAL_ENRICHMENT_COOLDOWN_SECONDS * 1000
    );
  });
});
