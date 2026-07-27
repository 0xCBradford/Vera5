import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOVER_CARD_NOTEBOOK_EMPTY_IOC_TEXT,
  HOVER_CARD_NOTEBOOK_EMPTY_PAGE_TEXT,
  HOVER_CARD_NOTEBOOK_EMPTY_SESSION_UNAVAILABLE_TEXT,
  HOVER_CARD_NOTEBOOK_TAB_IOC_LABEL,
  NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_SESSION_TEXT,
  POPUP_SESSION_NOTEBOOK_EMPTY_TEXT,
  addNotebookFragmentForScope,
  addNotebookFragmentForSession,
  buildHoverCardNotebookFragmentRow,
  buildHoverCardNotebookPanelView,
  buildPopupSessionNotebookTimelineView,
  canAuthorNotebookFragmentsForScope,
  deleteNotebookFragment,
  editNotebookFragment,
  formatNotebookTabLabel,
  loadHoverCardNotebookPanelView,
  loadPopupSessionNotebookFragmentTimeline,
  sortNotebookFragmentsChronologically,
  truncateNotebookFragmentBodyPreview,
} from "./hoverCardNotebook";
import {
  NOTEBOOK_FRAGMENT_TYPE,
  createNotebookFragment,
} from "./notebookFragment";
import {
  attachStoredNotebookFragmentToIoc,
  attachStoredNotebookFragmentToPage,
  attachStoredNotebookFragmentToSession,
  clearStoredNotebookFragments,
  upsertStoredNotebookFragment,
} from "./notebookFragmentStorage";
import { INVESTIGATION_SESSION_ID_PREFIX } from "./investigationSession";
import * as investigationSessionStorage from "./investigationSessionStorage";
import { IOC_TYPE } from "./iocRegex";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

describe("hoverCardNotebook", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
    vi.spyOn(
      investigationSessionStorage,
      "getActiveInvestigationSession"
    ).mockResolvedValue(null);
  });

  afterEach(async () => {
    await clearStoredNotebookFragments();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds fragment rows with type hints and Unverified badge for hypothesis", () => {
    const hypothesis = createNotebookFragment({
      id: "nf-h",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "Possibly staging.",
      createdAt: 1,
      updatedAt: 1,
    });
    const row = buildHoverCardNotebookFragmentRow(hypothesis);
    expect(row.typeLabel).toBe("Hypothesis");
    expect(row.showStatusBadge).toBe(true);
    expect(row.statusBadgeLabel).toBe("Unverified");
    expect(row.bodyPreview).toBe("Possibly staging.");
  });

  it("truncates long body previews", () => {
    const long = "a".repeat(200);
    expect(truncateNotebookFragmentBodyPreview(long).endsWith("…")).toBe(true);
    expect(truncateNotebookFragmentBodyPreview(long).length).toBe(120);
  });

  it("formats tab labels with counts and empty-state copy", () => {
    expect(formatNotebookTabLabel("ioc", 2)).toBe(
      `${HOVER_CARD_NOTEBOOK_TAB_IOC_LABEL} (2)`
    );
    expect(
      buildHoverCardNotebookPanelView({
        activeTab: "ioc",
        iocFragments: [],
        sessionFragments: [],
        pageFragments: [],
        sessionId: null,
        pageScopeKey: null,
      }).emptyText
    ).toBe(HOVER_CARD_NOTEBOOK_EMPTY_IOC_TEXT);
    expect(
      buildHoverCardNotebookPanelView({
        activeTab: "session",
        iocFragments: [],
        sessionFragments: [],
        pageFragments: [],
        sessionId: null,
        pageScopeKey: null,
      }).emptyText
    ).toBe(HOVER_CARD_NOTEBOOK_EMPTY_SESSION_UNAVAILABLE_TEXT);
  });

  it("sorts session notebook fragments chronologically for popup timeline", () => {
    const later = createNotebookFragment({
      id: "nf-later",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Later note",
      createdAt: 300,
      updatedAt: 300,
    });
    const earlier = createNotebookFragment({
      id: "nf-earlier",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Earlier note",
      createdAt: 100,
      updatedAt: 100,
    });
    const middle = createNotebookFragment({
      id: "nf-middle",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "Middle note",
      createdAt: 200,
      updatedAt: 200,
    });

    const ordered = sortNotebookFragmentsChronologically([
      later,
      earlier,
      middle,
    ]);
    expect(ordered.map((fragment) => fragment.id)).toEqual([
      "nf-earlier",
      "nf-middle",
      "nf-later",
    ]);

    const view = buildPopupSessionNotebookTimelineView({
      sessionId: `${INVESTIGATION_SESSION_ID_PREFIX}timeline`,
      fragments: [later, earlier, middle],
    });
    expect(view.emptyText).toBe(POPUP_SESSION_NOTEBOOK_EMPTY_TEXT);
    expect(view.fragments.map((row) => row.fragmentId)).toEqual([
      "nf-earlier",
      "nf-middle",
      "nf-later",
    ]);
    expect(view.fragments[1]?.typeLabel).toBe("Hypothesis");
    expect(view.fragments[1]?.showStatusBadge).toBe(true);
    expect(view.fragments[1]?.statusBadgeLabel).toBe("Unverified");
  });

  it("loads session notebook fragment timeline from storage", async () => {
    const sessionId = `${INVESTIGATION_SESSION_ID_PREFIX}popup-nb`;
    const first = createNotebookFragment({
      id: "nf-sess-1",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "First session fragment",
      createdAt: 10,
      updatedAt: 10,
    });
    const second = createNotebookFragment({
      id: "nf-sess-2",
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "Second session fragment",
      createdAt: 20,
      updatedAt: 20,
    });
    await upsertStoredNotebookFragment(first);
    await upsertStoredNotebookFragment(second);
    await attachStoredNotebookFragmentToSession({
      fragmentId: first.id,
      sessionId,
    });
    await attachStoredNotebookFragmentToSession({
      fragmentId: second.id,
      sessionId,
    });

    const view = await loadPopupSessionNotebookFragmentTimeline(sessionId);
    expect(view.sessionId).toBe(sessionId);
    expect(view.fragments.map((row) => row.fragmentId)).toEqual([
      "nf-sess-1",
      "nf-sess-2",
    ]);
    expect(view.fragments[0]?.bodyPreview).toBe("First session fragment");
  });

  it("loads IOC/session/page fragment lists for hover panel tabs", async () => {
    const sessionId = `${INVESTIGATION_SESSION_ID_PREFIX}hover-nb`;
    vi.spyOn(
      investigationSessionStorage,
      "getActiveInvestigationSession"
    ).mockResolvedValue({
      id: sessionId,
      title: "Investigation",
      createdAt: 1,
      updatedAt: 1,
      pageUrl: "https://portal.example.com/cases/1",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
    });

    const iocFragment = createNotebookFragment({
      id: "nf-ioc-hover",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "IOC note",
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionFragment = createNotebookFragment({
      id: "nf-session-hover",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Session note",
      createdAt: 2,
      updatedAt: 2,
    });
    const pageFragment = createNotebookFragment({
      id: "nf-page-hover",
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "Page note",
      createdAt: 3,
      updatedAt: 3,
    });

    await upsertStoredNotebookFragment(iocFragment);
    await upsertStoredNotebookFragment(sessionFragment);
    await upsertStoredNotebookFragment(pageFragment);
    await attachStoredNotebookFragmentToIoc({
      fragmentId: iocFragment.id,
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });
    await attachStoredNotebookFragmentToSession({
      fragmentId: sessionFragment.id,
      sessionId,
    });
    await attachStoredNotebookFragmentToPage({
      fragmentId: pageFragment.id,
      pageUrl: "https://portal.example.com/cases/1",
      includePathPrefix: true,
    });

    const iocView = await loadHoverCardNotebookPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      pageUrl: "https://portal.example.com/cases/1",
      activeTab: "ioc",
    });
    expect(iocView.iocCount).toBe(1);
    expect(iocView.sessionCount).toBe(1);
    expect(iocView.pageCount).toBe(1);
    expect(iocView.fragments).toEqual([
      expect.objectContaining({
        fragmentId: "nf-ioc-hover",
        typeLabel: "Observation",
      }),
    ]);

    const sessionView = await loadHoverCardNotebookPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      pageUrl: "https://portal.example.com/cases/1",
      activeTab: "session",
    });
    expect(sessionView.fragments[0]?.fragmentId).toBe("nf-session-hover");

    const pageView = await loadHoverCardNotebookPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      pageUrl: "https://portal.example.com/cases/1",
      activeTab: "page",
    });
    expect(pageView.fragments[0]?.fragmentId).toBe("nf-page-hover");
    expect(pageView.pageScopeKey).toBe("https://portal.example.com/cases/1");
    expect(
      buildHoverCardNotebookPanelView({
        activeTab: "page",
        iocFragments: [],
        sessionFragments: [],
        pageFragments: [],
        sessionId: pageView.sessionId,
        pageScopeKey: pageView.pageScopeKey,
      }).emptyText
    ).toBe(HOVER_CARD_NOTEBOOK_EMPTY_PAGE_TEXT);
  });

  it("adds, edits, and deletes notebook fragments for scopes", async () => {
    const sessionId = `${INVESTIGATION_SESSION_ID_PREFIX}author`;
    vi.spyOn(
      investigationSessionStorage,
      "getActiveInvestigationSession"
    ).mockResolvedValue({
      id: sessionId,
      title: "Investigation",
      createdAt: 1,
      updatedAt: 1,
      pageUrl: "https://portal.example.com/cases/9",
      totalIocCount: 0,
      iocCountByType: {},
      enrichmentCount: 0,
      exportCount: 0,
    });

    const added = await addNotebookFragmentForScope({
      scope: "ioc",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Inline IOC observation",
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      sessionId,
      pageUrl: "https://portal.example.com/cases/9",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const iocView = await loadHoverCardNotebookPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      pageUrl: "https://portal.example.com/cases/9",
      activeTab: "ioc",
    });
    expect(iocView.fragments.some((row) => row.fragmentId === added.fragment.id)).toBe(
      true
    );

    const edited = await editNotebookFragment({
      fragmentId: added.fragment.id,
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "Edited hypothesis",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    expect(edited.fragment.type).toBe(NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS);
    expect(edited.fragment.body).toBe("Edited hypothesis");
    expect(edited.fragment.createdAt).toBe(added.fragment.createdAt);

    const sessionAdded = await addNotebookFragmentForSession({
      sessionId,
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "Session tag",
    });
    expect(sessionAdded.ok).toBe(true);

    const deleted = await deleteNotebookFragment(added.fragment.id);
    expect(deleted.ok).toBe(true);
    const afterDelete = await loadHoverCardNotebookPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      pageUrl: "https://portal.example.com/cases/9",
      activeTab: "ioc",
    });
    expect(
      afterDelete.fragments.some((row) => row.fragmentId === added.fragment.id)
    ).toBe(false);
  });

  it("rejects empty body and unavailable session authoring", async () => {
    expect(
      (
        await addNotebookFragmentForScope({
          scope: "ioc",
          type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
          body: "   ",
          iocType: IOC_TYPE.IPV4,
          value: "1.1.1.1",
          sessionId: null,
          pageUrl: "https://example.com/",
        })
      ).ok
    ).toBe(false);

    expect(
      canAuthorNotebookFragmentsForScope({
        scope: "session",
        sessionId: null,
        pageScopeKey: null,
      })
    ).toEqual({
      allowed: false,
      reason: NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_SESSION_TEXT,
    });
  });
});
