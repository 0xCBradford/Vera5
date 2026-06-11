import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  computeInvestigationSessionRollups,
  createInvestigationSession,
  buildDefaultInvestigationSessionTitle,
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  buildInvestigationSessionActivitySummaryText,
  DEFAULT_INVESTIGATION_SESSION_TITLE,
  INVESTIGATION_SESSION_EMPTY_STATE_TEXT,
  generateInvestigationSessionId,
  INVESTIGATION_SESSION_ID_PREFIX,
  isInvestigationSession,
  MAX_INVESTIGATION_SESSION_NOTES_LENGTH,
  MAX_INVESTIGATION_SESSION_TITLE_LENGTH,
  normalizeInvestigationSession,
  normalizeInvestigationSessionIocCountByType,
  normalizeInvestigationSessionNotes,
  normalizeInvestigationSessionRollups,
  normalizeInvestigationSessionTitle,
  updateInvestigationSession,
} from "./investigationSession";

describe("investigationSession schema", () => {
  it("creates a session with required fields and empty rollups", () => {
    const session = createInvestigationSession({
      title: "  Phishing Investigation  ",
      pageUrl: "http://localhost:8080/sample-alert.html",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      id: "vera5-inv-test-1",
    });

    expect(session).toEqual({
      id: "vera5-inv-test-1",
      title: "Phishing Investigation",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      pageUrl: "http://localhost:8080/sample-alert.html",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
    });
  });

  it("includes optional notes when provided", () => {
    const session = createInvestigationSession({
      title: "Case A",
      pageUrl: "https://example.com/alert",
      notes: "  Initial triage notes  ",
      id: "vera5-inv-test-2",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(session?.notes).toBe("Initial triage notes");
    expect(isInvestigationSession(session)).toBe(true);
  });

  it("omits notes when blank", () => {
    const session = createInvestigationSession({
      title: "Case B",
      pageUrl: "",
      notes: "   ",
      id: "vera5-inv-test-3",
      createdAt: 100,
      updatedAt: 100,
    });

    expect(session?.notes).toBeUndefined();
  });

  it("rejects empty titles and invalid timestamps", () => {
    expect(
      createInvestigationSession({
        title: "   ",
        pageUrl: "https://example.com",
      })
    ).toBeNull();

    expect(
      createInvestigationSession({
        title: "Valid",
        pageUrl: "https://example.com",
        createdAt: 200,
        updatedAt: 100,
        id: "vera5-inv-test-4",
      })
    ).toBeNull();
  });

  it("generates prefixed session ids", () => {
    const id = generateInvestigationSessionId(1_700_000_000_000);
    expect(id.startsWith(INVESTIGATION_SESSION_ID_PREFIX)).toBe(true);
  });

  it("provides empty-state guidance when no session is active", () => {
    expect(INVESTIGATION_SESSION_EMPTY_STATE_TEXT).toContain(
      "No active investigation session"
    );
    expect(INVESTIGATION_SESSION_EMPTY_STATE_TEXT).toContain("Scan this page");
  });

  it("truncates long titles and notes", () => {
    const longTitle = "x".repeat(MAX_INVESTIGATION_SESSION_TITLE_LENGTH + 10);
    expect(normalizeInvestigationSessionTitle(longTitle)?.length).toBe(
      MAX_INVESTIGATION_SESSION_TITLE_LENGTH
    );

    const longNotes = "n".repeat(MAX_INVESTIGATION_SESSION_NOTES_LENGTH + 5);
    expect(normalizeInvestigationSessionNotes(longNotes)?.length).toBe(
      MAX_INVESTIGATION_SESSION_NOTES_LENGTH
    );
  });

  it("updates sessions and clears notes", () => {
    const original = createInvestigationSession({
      title: "Original",
      pageUrl: "http://localhost/",
      notes: "keep",
      id: "vera5-inv-test-5",
      createdAt: 100,
      updatedAt: 100,
    });
    expect(original).not.toBeNull();

    const updated = updateInvestigationSession(original!, {
      title: "Renamed case",
      pageUrl: "http://localhost:8080/sample-splunk-export.html",
      notes: null,
      updatedAt: 500,
    });

    expect(updated).toEqual({
      id: "vera5-inv-test-5",
      title: "Renamed case",
      createdAt: 100,
      updatedAt: 500,
      pageUrl: "http://localhost:8080/sample-splunk-export.html",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
    });
    expect(updated?.notes).toBeUndefined();
  });

  it("validates persisted session shapes", () => {
    expect(
      isInvestigationSession({
        id: "vera5-inv-1",
        title: "T",
        createdAt: 1,
        updatedAt: 2,
        pageUrl: "",
        totalIocCount: 0,
        iocCountByType: {},
      })
    ).toBe(true);

    expect(
      isInvestigationSession({
        id: "vera5-inv-1",
        title: "T",
        createdAt: 2,
        updatedAt: 1,
        pageUrl: "",
        totalIocCount: 0,
        iocCountByType: {},
      })
    ).toBe(false);

    expect(
      isInvestigationSession({
        id: "vera5-inv-1",
        title: "T",
        createdAt: 1,
        updatedAt: 1,
        pageUrl: "",
        totalIocCount: 0,
        iocCountByType: {},
        notes: "",
      })
    ).toBe(false);
  });

  it("normalizes valid stored sessions", () => {
    const normalized = normalizeInvestigationSession({
      id: "  vera5-inv-9  ",
      title: "  Case  ",
      createdAt: 10,
      updatedAt: 20,
      pageUrl: "  http://localhost/  ",
      notes: "  note  ",
      totalIocCount: 0,
      iocCountByType: {},
    });

    expect(normalized).toEqual({
      id: "vera5-inv-9",
      title: "Case",
      createdAt: 10,
      updatedAt: 20,
      pageUrl: "http://localhost/",
      notes: "note",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
    });
  });

  it("defaults missing activity counts when normalizing stored sessions", () => {
    const normalized = normalizeInvestigationSession({
      id: "vera5-inv-legacy",
      title: "Legacy",
      createdAt: 1,
      updatedAt: 2,
      pageUrl: "",
      totalIocCount: 0,
      iocCountByType: {},
    });

    expect(normalized?.enrichmentCount).toBe(0);
    expect(normalized?.exportCount).toBe(0);
  });
});

describe("investigationSession rollups", () => {
  it("builds default titles from page URLs", () => {
    expect(buildDefaultInvestigationSessionTitle("https://mail.example.com/alert")).toBe(
      `${DEFAULT_INVESTIGATION_SESSION_TITLE} — mail.example.com`
    );
    expect(buildDefaultInvestigationSessionTitle("")).toBe(
      DEFAULT_INVESTIGATION_SESSION_TITLE
    );
    expect(buildDefaultInvestigationSessionTitle("not-a-url")).toBe(
      DEFAULT_INVESTIGATION_SESSION_TITLE
    );
  });

  it("formats session IOC counts and per-type breakdown text", () => {
    expect(buildInvestigationSessionIocCountText(13)).toBe("13 indicators");
    expect(buildInvestigationSessionIocCountText(1)).toBe("1 indicator");

    expect(
      buildInvestigationSessionTypeBreakdownText({
        totalIocCount: 23,
        iocCountByType: {
          [IOC_TYPE.DOMAIN]: 8,
          [IOC_TYPE.IPV4]: 4,
          [IOC_TYPE.MD5]: 1,
          [IOC_TYPE.SHA256]: 1,
          [IOC_TYPE.URL]: 9,
        },
      })
    ).toBe("8 domains · 4 IPs · 2 hashes · 9 URLs");
  });

  it("formats enrichment and export activity summary text", () => {
    expect(
      buildInvestigationSessionActivitySummaryText({
        enrichmentCount: 0,
        exportCount: 0,
      })
    ).toBe("");

    expect(
      buildInvestigationSessionActivitySummaryText({
        enrichmentCount: 1,
        exportCount: 2,
      })
    ).toBe("1 enrichment · 2 exports");
  });

  it("computes total and per-type counts from IOC entries", () => {
    const rollups = computeInvestigationSessionRollups([
      { type: IOC_TYPE.DOMAIN },
      { type: IOC_TYPE.DOMAIN },
      { type: IOC_TYPE.IPV4 },
      { type: IOC_TYPE.URL },
      { type: IOC_TYPE.MD5 },
      { type: IOC_TYPE.SHA256 },
      { type: IOC_TYPE.CVE },
    ]);

    expect(rollups).toEqual({
      totalIocCount: 7,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: 1,
        [IOC_TYPE.URL]: 1,
        [IOC_TYPE.MD5]: 1,
        [IOC_TYPE.SHA256]: 1,
        [IOC_TYPE.CVE]: 1,
      },
    });
  });

  it("creates sessions with normalized rollup fields", () => {
    const session = createInvestigationSession({
      title: "Rollup case",
      pageUrl: "https://example.com",
      id: "vera5-inv-rollups-1",
      createdAt: 100,
      updatedAt: 100,
      totalIocCount: 3,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: 1,
        bogus: 5,
      },
    });

    expect(session).toEqual({
      id: "vera5-inv-rollups-1",
      title: "Rollup case",
      createdAt: 100,
      updatedAt: 100,
      pageUrl: "https://example.com",
      totalIocCount: 3,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: 1,
      },
      enrichmentCount: 0,
      exportCount: 0,
    });
  });

  it("rejects rollup totals that do not match per-type counts", () => {
    expect(
      normalizeInvestigationSessionRollups({
        totalIocCount: 5,
        iocCountByType: {
          [IOC_TYPE.URL]: 2,
        },
      })
    ).toBeNull();

    expect(
      createInvestigationSession({
        title: "Mismatch",
        pageUrl: "https://example.com",
        totalIocCount: 2,
        iocCountByType: {
          [IOC_TYPE.DOMAIN]: 1,
        },
      })
    ).toBeNull();
  });

  it("updates rollup fields and preserves them when omitted", () => {
    const original = createInvestigationSession({
      title: "Case",
      pageUrl: "https://example.com",
      id: "vera5-inv-rollups-2",
      createdAt: 100,
      updatedAt: 100,
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 1,
        [IOC_TYPE.URL]: 1,
      },
    });
    expect(original).not.toBeNull();

    const updated = updateInvestigationSession(original!, {
      totalIocCount: 4,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: 2,
      },
      updatedAt: 200,
    });

    expect(updated).toEqual({
      id: "vera5-inv-rollups-2",
      title: "Case",
      createdAt: 100,
      updatedAt: 200,
      pageUrl: "https://example.com",
      totalIocCount: 4,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: 2,
      },
      enrichmentCount: 0,
      exportCount: 0,
    });

    const preserved = updateInvestigationSession(updated!, {
      title: "Renamed",
      updatedAt: 300,
    });

    expect(preserved?.totalIocCount).toBe(4);
    expect(preserved?.iocCountByType).toEqual(updated?.iocCountByType);
    expect(preserved?.enrichmentCount).toBe(0);
    expect(preserved?.exportCount).toBe(0);
  });

  it("updates activity counts independently of rollups", () => {
    const original = createInvestigationSession({
      title: "Case",
      pageUrl: "https://example.com",
      id: "vera5-inv-activity",
      createdAt: 100,
      updatedAt: 100,
    });
    expect(original).not.toBeNull();

    const updated = updateInvestigationSession(original!, {
      enrichmentCount: 3,
      exportCount: 2,
      updatedAt: 200,
    });

    expect(updated).toEqual(
      expect.objectContaining({
        enrichmentCount: 3,
        exportCount: 2,
      })
    );
  });

  it("normalizes stored per-type counts and validates persisted rollups", () => {
    expect(
      normalizeInvestigationSessionIocCountByType({
        [IOC_TYPE.DOMAIN]: 2,
        [IOC_TYPE.IPV4]: -1,
        not_a_type: 3,
      })
    ).toEqual({
      [IOC_TYPE.DOMAIN]: 2,
    });

    expect(
      isInvestigationSession({
        id: "vera5-inv-rollup-valid",
        title: "T",
        createdAt: 1,
        updatedAt: 1,
        pageUrl: "",
        totalIocCount: 3,
        iocCountByType: {
          [IOC_TYPE.DOMAIN]: 2,
          [IOC_TYPE.CVE]: 1,
        },
      })
    ).toBe(true);

    expect(
      isInvestigationSession({
        id: "vera5-inv-rollup-invalid",
        title: "T",
        createdAt: 1,
        updatedAt: 1,
        pageUrl: "",
        totalIocCount: 3,
        iocCountByType: {
          [IOC_TYPE.DOMAIN]: 2,
        },
      })
    ).toBe(false);
  });
});
