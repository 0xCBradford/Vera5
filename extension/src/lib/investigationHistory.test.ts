import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  buildInvestigationHistoryEntry,
  buildInvestigationHistorySessionLinkSummary,
  countInvestigationHistoryEntriesForSession,
  createEmptyInvestigationHistoryStore,
  formatInvestigationHistoryTimestamp,
  generateInvestigationHistoryEntryId,
  INVESTIGATION_HISTORY_CLEAR_CONFIRM_MESSAGE,
  INVESTIGATION_HISTORY_ID_PREFIX,
  INVESTIGATION_HISTORY_SCHEMA_VERSION,
  isInvestigationHistoryEntry,
  isInvestigationHistoryEntryLinkedToActiveSession,
  isInvestigationHistoryStore,
  MAX_INVESTIGATION_HISTORY_ENTRIES,
  normalizeInvestigationHistoryEntry,
  normalizeInvestigationHistoryStore,
  prependInvestigationHistoryEntry,
  resolveInvestigationHistoryClearFeedback,
  resolveInvestigationHistoryReopenFeedback,
  resolveInvestigationHistorySessionTitle,
  resolvePageOriginFromUrl,
} from "./investigationHistory";

describe("investigationHistory", () => {
  it("resolves page origin from http and https URLs", () => {
    expect(resolvePageOriginFromUrl("https://example.com/alert?id=1")).toBe(
      "https://example.com"
    );
    expect(resolvePageOriginFromUrl("http://localhost:8080/path")).toBe(
      "http://localhost:8080"
    );
    expect(resolvePageOriginFromUrl("not-a-url")).toBeNull();
  });

  it("builds a normalized history entry with IOC, page origin, and timestamp", () => {
    const entry = buildInvestigationHistoryEntry({
      id: `${INVESTIGATION_HISTORY_ID_PREFIX}test`,
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 1_700_000_000_000,
    });

    expect(entry).toEqual({
      id: `${INVESTIGATION_HISTORY_ID_PREFIX}test`,
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageOrigin: "https://example.com",
      pageUrl: "https://example.com/alert",
      enrichedAt: 1_700_000_000_000,
    });
    expect(isInvestigationHistoryEntry(entry)).toBe(true);
  });

  it("prepends entries, dedupes by IOC, and caps at N", () => {
    const existing = Array.from({ length: 3 }, (_, index) =>
      buildInvestigationHistoryEntry({
        id: `${INVESTIGATION_HISTORY_ID_PREFIX}${index}`,
        ioc: `${index + 1}.${index + 1}.${index + 1}.${index + 1}`,
        iocType: IOC_TYPE.IPV4,
        pageUrl: "https://example.com/page",
        enrichedAt: 1_000 + index,
      })
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const refreshed = buildInvestigationHistoryEntry({
      id: `${INVESTIGATION_HISTORY_ID_PREFIX}refresh`,
      ioc: "1.1.1.1",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/refresh",
      enrichedAt: 2_000,
    })!;

    const capped = prependInvestigationHistoryEntry(existing, refreshed, 2);
    expect(capped).toHaveLength(2);
    expect(capped[0]?.id).toBe(`${INVESTIGATION_HISTORY_ID_PREFIX}refresh`);
    expect(capped.some((entry) => entry.ioc === "1.1.1.1")).toBe(true);
  });

  it("normalizes stores with schema version and entry cap", () => {
    const entry = buildInvestigationHistoryEntry({
      id: `${INVESTIGATION_HISTORY_ID_PREFIX}entry`,
      ioc: "example.com",
      iocType: IOC_TYPE.DOMAIN,
      pageUrl: "https://example.com",
      enrichedAt: 100,
    })!;

    const normalized = normalizeInvestigationHistoryStore({
      schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
      entries: [entry],
    });

    expect(normalized.entries).toEqual([entry]);
    expect(isInvestigationHistoryStore(normalized)).toBe(true);
    expect(createEmptyInvestigationHistoryStore()).toEqual({
      schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
      entries: [],
    });
  });

  it("rejects invalid entries during normalization", () => {
    expect(
      normalizeInvestigationHistoryEntry({
        id: "bad",
        ioc: "not-an-ioc",
        iocType: IOC_TYPE.IPV4,
        pageOrigin: "https://example.com",
        pageUrl: "https://example.com",
        enrichedAt: 100,
      })
    ).toBeNull();
  });

  it("generates stable id prefix", () => {
    expect(generateInvestigationHistoryEntryId(123)).toMatch(
      new RegExp(`^${INVESTIGATION_HISTORY_ID_PREFIX}`)
    );
    expect(MAX_INVESTIGATION_HISTORY_ENTRIES).toBeGreaterThan(0);
  });

  it("formats reopen feedback for page origin mismatch and missing highlights", () => {
    expect(
      resolveInvestigationHistoryReopenFeedback({
        tabId: 1,
        response: { ok: false, error: "page origin mismatch" },
        ioc: "8.8.8.8",
        pageOrigin: "https://example.com",
      })
    ).toContain("https://example.com");
    expect(
      resolveInvestigationHistoryReopenFeedback({
        tabId: 1,
        response: { ok: false, error: "highlight not found" },
        ioc: "8.8.8.8",
      })
    ).toContain("8.8.8.8");
    expect(formatInvestigationHistoryTimestamp(0)).toBeTruthy();
  });

  it("stores optional session links and resolves session summaries", () => {
    const entry = buildInvestigationHistoryEntry({
      id: `${INVESTIGATION_HISTORY_ID_PREFIX}session`,
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageUrl: "https://example.com/alert",
      enrichedAt: 100,
      sessionId: "vera5-inv-test",
    })!;

    expect(entry.sessionId).toBe("vera5-inv-test");
    expect(
      isInvestigationHistoryEntryLinkedToActiveSession(entry, "vera5-inv-test")
    ).toBe(true);
    expect(
      resolveInvestigationHistorySessionTitle(
        entry,
        new Map([["vera5-inv-test", "Phishing case"]])
      )
    ).toBe("Phishing case");
    expect(
      buildInvestigationHistorySessionLinkSummary(
        countInvestigationHistoryEntriesForSession([entry], "vera5-inv-test")
      )
    ).toBe("1 indicator linked to this session");
  });

  it("defines clear-history confirmation and feedback copy", () => {
    expect(INVESTIGATION_HISTORY_CLEAR_CONFIRM_MESSAGE).toContain("cannot be undone");
    expect(resolveInvestigationHistoryClearFeedback(true)).toContain("cleared");
    expect(resolveInvestigationHistoryClearFeedback(false)).toContain("Try again");
  });
});
