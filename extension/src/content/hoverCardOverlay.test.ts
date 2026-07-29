/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import {
  clearSessionAnalystNotes,
  getSessionAnalystNote,
  setSessionAnalystNote,
} from "../lib/analystNotesSession";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  formatSourceStatusBadge,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_LOADING_SUMMARY,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
  HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK,
  HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY,
  HOVER_CARD_CO_OCCURRENCE_SECTION_ARIA_LABEL,
  HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
} from "../lib/hoverCardEnrichment";
import * as hoverCardCoOccurrence from "../lib/hoverCardCoOccurrence";
import * as hoverCardRelationship from "../lib/hoverCardRelationship";
import * as hoverCardNotebook from "../lib/hoverCardNotebook";
import {
  HOVER_CARD_RELATIONSHIP_DISCLAIMER_CLASS,
  HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL,
  RELATIONSHIP_MEMORY_DISCLAIMER_TEXT,
} from "../lib/hoverCardRelationship";
import {
  HOVER_CARD_NOTEBOOK_SECTION_ARIA_LABEL,
} from "../lib/hoverCardNotebook";
import {
  focusAdjacentCoOccurrenceListItem,
  handleCoOccurrenceListItemKeyDown,
} from "../lib/hoverCardCoOccurrence";
import * as iocTrayNavigation from "./iocTrayNavigation";
import { setAutoEnrichmentFetcherForTests } from "./enrichmentAutoFetch";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import { scanTextNodesForIocs } from "./detector";
import { highlightDetectedIocs } from "./highlighter";
import { IOC_TYPE, IOC_RULE_ID, type IocType } from "../lib/iocRegex";
import { PAGE_CONTEXT_TYPE } from "../lib/pageContext";
import { setCachedPageContextType } from "./analystModeStorage";
import { getPivotRecipes } from "../lib/pivots";
import * as copyText from "../lib/copyText";
import { REDACTED_VALUE_PLACEHOLDER } from "../lib/enrichmentRawResponse";
import { TEST_FIXTURE_VENDOR_SENSITIVE_FIELD } from "../lib/fixtureSecrets";
import {
  DEFAULT_HOVER_CARD_SUMMARY,
  HOVER_CARD_ERROR_SUMMARY,
  type HoverCardEnrichmentState,
} from "../lib/hoverCardEnrichment";
import { HOVER_CARD_ENRICHMENT_MODIFIER_CLASS } from "../lib/vera5UiStyles";
import { COMPOSITE_SCORE_DISAGREEMENT_NOTICE } from "../lib/scoring";
import {
  buildHoverCardPanel,
  hideHoverCard,
  HOVER_CARD_COPY_BUTTON_CLASS,
  HOVER_CARD_CO_OCCURRENCE_CLASS,
  HOVER_CARD_RELATIONSHIP_CLASS,
  HOVER_CARD_NOTEBOOK_CLASS,
  HOVER_CARD_NOTEBOOK_TAB_CLASS,
  HOVER_CARD_NOTEBOOK_TAB_ACTIVE_CLASS,
  HOVER_CARD_GENERATE_SUMMARY_LABEL,
  HOVER_CARD_GENERATE_SUMMARY_LOADING_LABEL,
  HOVER_CARD_HOST_ID,
  HOVER_CARD_INTEL_SUMMARY_CLASS,
  HOVER_CARD_LOCAL_LLM_SUMMARY_BODY_CLASS,
  HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS,
  HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER,
  HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING,
  HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS,
  HOVER_CARD_IOC_PIN_BUTTON_CLASS,
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_ENRICHMENT_CLASS,
  HOVER_CARD_PIVOT_LINK_CLASS,
  HOVER_CARD_PIVOT_RECIPES_CLASS,
  HOVER_CARD_PIVOT_RECIPES_LIST_CLASS,
  HOVER_CARD_PIVOT_RECIPE_CLASS,
  HOVER_CARD_PIVOT_RECIPE_GUIDANCE_CLASS,
  HOVER_CARD_PIVOT_RECIPE_SOURCE_CLASS,
  HOVER_CARD_PIVOT_CHIP_MAX,
  HOVER_CARD_MORE_CLASS,
  HOVER_CARD_MORE_GROUP_CLASS,
  HOVER_CARD_RAW_JSON_BODY_CLASS,
  HOVER_CARD_RAW_JSON_CLASS,
  HOVER_CARD_SOURCES_CLASS,
  HOVER_CARD_TAGS_CLASS,
  HOVER_CARD_TAG_CLASS,
  HOVER_CARD_ATTRIBUTION_CLASS,
  HOVER_CARD_DISCLAIMER_CLASS,
  HOVER_CARD_RISK_SCORE_CLASS,
  HOVER_CARD_RISK_SCORE_LABEL_CLASS,
  HOVER_CARD_RISK_SCORE_UNAVAILABLE_CLASS,
  HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS,
  HOVER_CARD_RISK_DISAGREEMENT_CLASS,
  HOVER_CARD_RISK_REASONING_CLASS,
  HOVER_CARD_RISK_REASONING_CHAIN_CLASS,
  HOVER_CARD_RISK_REASONING_STEP_CLASS,
  HOVER_CARD_ACTION_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
  HOVER_CARD_SOURCE_DETAIL_CLASS,
  HOVER_CARD_SOURCE_TAGS_CLASS,
  HOVER_CARD_SOURCE_ITEM_CLASS,
  HOVER_CARD_ANALYST_NOTES_CLASS,
  HOVER_CARD_ANALYST_NOTES_INPUT_CLASS,
  HOVER_CARD_EXPORT_BUTTON_CLASS,
  HOVER_CARD_EXPORT_DROPDOWN_CLASS,
  HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS,
  HOVER_CARD_EXPORT_SECTION_CLASS,
  HOVER_CARD_EXPORT_TEMPLATES_SUMMARY,
  HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID,
  buildExportRecordFromPayload,
  focusFirstHoverCardControl,
  HOVER_CARD_SAVE_TO_COLLECTION_TOGGLE_CLASS,
  resetHoverCardSaveToCollectionStateForTests,
  resetHoverCardLocalLlmSummaryStateForTests,
  runHoverCardLocalLlmSummaryGenerationForTests,
  showHoverCardNearAnchor,
  updateHoverCardAnalystNoteIfOpen,
} from "./hoverCardOverlay";
import { createIocCollection } from "../lib/iocCollection";
import { MESSAGE } from "../lib/messages";
import * as enrichmentExport from "../lib/enrichmentExport";
import * as exportTemplates from "../lib/exportTemplates";
import { buildNormalizedEnrichmentRecord } from "../lib/enrichmentExport";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import * as tabScanSummary from "../lib/tabScanSummary";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import * as tabScanSnapshotStorage from "../lib/tabScanSnapshotStorage";
import * as tabScanSummaryContent from "./tabScanSummaryContent";
import {
  setCachedLocalBackendEnabledForTests,
} from "./localBackendStorage";
import {
  setCachedLocalLlmSummaryEnabledForTests,
} from "./localLlmSummaryStorage";
import * as aiSummaryService from "../lib/aiSummaryService";
import { buildLocalBackendSummarizeUrl } from "../lib/localBackendSummarize";

function readyHoverCardPayload() {
  return {
    value: "8.8.8.8",
    type: IOC_TYPE.IPV4,
    enrichmentState: "ready" as const,
    summary: "84 abuse confidence",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: "ok" as const,
        summary: "84 abuse confidence",
      },
    ]),
  };
}

function groundedLocalLlmSummaryMarkdown(): string {
  return [
    "# IOC summary: 8.8.8.8",
    "",
    "**Type:** IPv4 address",
    "",
    "AbuseIPDB reported 84 abuse confidence.",
    "",
    "- **AbuseIPDB** (Live): 84 abuse confidence",
    "",
    "**Risk score:** Unknown risk",
  ].join("\n");
}

function queryOverlayEnrichmentSummary(panel: ParentNode): HTMLElement | null {
  return panel.querySelector(`.${HOVER_CARD_ENRICHMENT_CLASS}`);
}

function readPivotGuidanceText(panel: ParentNode): string[] {
  return Array.from(
    panel.querySelectorAll(`.${HOVER_CARD_PIVOT_LINK_CLASS}`)
  ).map(
    (node) =>
      (node as HTMLElement).dataset.vera5PivotGuidance ??
      node.getAttribute("title") ??
      ""
  );
}

type PivotRecipePanelRow = {
  sourceLabel: string;
  linkLabel: string;
  href: string;
  guidance: string;
};

function readPivotRecipePanelRows(panel: ParentNode): PivotRecipePanelRow[] {
  return Array.from(
    panel.querySelectorAll(`.${HOVER_CARD_PIVOT_RECIPE_CLASS}`)
  ).map((item) => {
    const link = item.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}`
    ) as HTMLAnchorElement | null;
    return {
      sourceLabel: link?.textContent ?? "",
      linkLabel: link?.dataset.vera5PivotLabel ?? "",
      href: link?.getAttribute("href") ?? "",
      guidance:
        link?.dataset.vera5PivotGuidance ?? link?.getAttribute("title") ?? "",
    };
  });
}

function openHoverCardExportTemplates(panel: ParentNode): HTMLDetailsElement | null {
  const details = panel.querySelector(
    `.${HOVER_CARD_EXPORT_SECTION_CLASS} .vera5-hover-card-export-templates`
  ) as HTMLDetailsElement | null;
  if (details) {
    details.open = true;
  }
  return details;
}

const PIVOT_PANEL_GOLDEN_CASES: ReadonlyArray<{
  type: IocType;
  value: string;
}> = [
  { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
  { type: IOC_TYPE.DOMAIN, value: "example.com" },
  { type: IOC_TYPE.URL, value: "https://example.com/login" },
  {
    type: IOC_TYPE.SHA256,
    value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  { type: IOC_TYPE.CVE, value: "CVE-2021-44228" },
  { type: IOC_TYPE.EMAIL, value: "analyst@corp.example.com" },
  { type: IOC_TYPE.ASN, value: "AS15169" },
  { type: IOC_TYPE.CIDR, value: "203.0.113.0/24" },
  { type: IOC_TYPE.FILEPATH, value: "/var/log/auth.log" },
  { type: IOC_TYPE.ONION, value: `${"a".repeat(56)}.onion` },
];

describe("notebook panel", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  it("renders notebook section with indicator/session/page tabs and IOC fragments", async () => {
    vi.spyOn(hoverCardNotebook, "loadHoverCardNotebookPanelView").mockResolvedValue({
      activeTab: "ioc",
      iocCount: 1,
      sessionCount: 0,
      pageCount: 0,
      fragments: [
        {
          fragmentId: "nf-hover-1",
          type: "hypothesis",
          typeLabel: "Hypothesis",
          statusBadgeLabel: "Unverified",
          showStatusBadge: true,
          bodyPreview: "Possibly related C2.",
          fullBody: "Possibly related C2.",
          hint: "Working theory—not confirmed. Treat as unverified until validated.",
        },
      ],
      emptyText: "No notebook fragments for this indicator.",
      sessionId: null,
      pageScopeKey: "https://portal.example.com/cases/1",
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const section = panel.querySelector(`.${HOVER_CARD_NOTEBOOK_CLASS}`);
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-label")).toBe(
      HOVER_CARD_NOTEBOOK_SECTION_ARIA_LABEL
    );
    expect(
      section?.closest(".vera5-hover-card-export-templates")
    ).not.toBeNull();
    const notebookDetails = section?.closest(
      'details[data-vera5-casework="notebook"]'
    ) as HTMLDetailsElement | null;
    expect(notebookDetails).not.toBeNull();
    expect(notebookDetails?.open).toBe(false);
    expect(notebookDetails?.querySelector(":scope > summary")?.textContent).toBe(
      "Notebook"
    );

    await vi.waitFor(() => {
      expect(section?.textContent).toContain("Hypothesis");
      expect(section?.textContent).toContain("Unverified");
      expect(section?.textContent).toContain("Possibly related C2.");
    });

    const tabs = section?.querySelectorAll(`.${HOVER_CARD_NOTEBOOK_TAB_CLASS}`);
    expect(tabs?.length).toBe(3);
    expect(tabs?.[0]?.textContent).toContain("Indicator");
    expect(tabs?.[1]?.textContent).toContain("Session");
    expect(tabs?.[2]?.textContent).toContain("Page");
    expect(tabs?.[0]?.classList.contains(HOVER_CARD_NOTEBOOK_TAB_ACTIVE_CLASS)).toBe(
      true
    );
    expect(section?.textContent).toContain("Add fragment");
    expect(
      Array.from(section?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === "Add fragment"
      )?.classList.contains("vera5-hover-card-notebook-action--primary")
    ).toBe(true);
    expect(
      section?.querySelector('button[aria-label="Edit Hypothesis"]')
    ).not.toBeNull();
    expect(
      section?.querySelector('button[aria-label="Delete Hypothesis"]')
    ).not.toBeNull();
  });

  it("switches notebook tabs to session and page scopes", async () => {
    const loadSpy = vi
      .spyOn(hoverCardNotebook, "loadHoverCardNotebookPanelView")
      .mockImplementation(async (input) => {
        const activeTab = input.activeTab ?? "ioc";
        return {
          activeTab,
          iocCount: 1,
          sessionCount: 1,
          pageCount: 1,
          fragments:
            activeTab === "session"
              ? [
                  {
                    fragmentId: "nf-session",
                    type: "conclusion",
                    typeLabel: "Conclusion",
                    statusBadgeLabel: null,
                    showStatusBadge: false,
                    bodyPreview: "Session finding.",
                    fullBody: "Session finding.",
                    hint: "Analyst judgment for this investigation.",
                  },
                ]
              : activeTab === "page"
                ? [
                    {
                      fragmentId: "nf-page",
                      type: "tag",
                      typeLabel: "Tag",
                      statusBadgeLabel: null,
                      showStatusBadge: false,
                      bodyPreview: "Page finding.",
                      fullBody: "Page finding.",
                      hint: "Lightweight label for triage grouping.",
                    },
                  ]
                : [
                    {
                      fragmentId: "nf-ioc",
                      type: "observation",
                      typeLabel: "Observation",
                      statusBadgeLabel: null,
                      showStatusBadge: false,
                      bodyPreview: "IOC finding.",
                      fullBody: "IOC finding.",
                      hint: "Logged finding from the investigation.",
                    },
                  ],
          emptyText: "No notebook fragments for this indicator.",
          sessionId: "vera5-inv-test",
          pageScopeKey: "https://portal.example.com/cases/1",
        };
      });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    const section = panel.querySelector(`.${HOVER_CARD_NOTEBOOK_CLASS}`);
    await vi.waitFor(() => {
      expect(section?.textContent).toContain("IOC finding.");
    });

    const sessionTab = section?.querySelector<HTMLButtonElement>(
      `[data-vera5-notebook-tab="session"]`
    );
    sessionTab?.click();
    await vi.waitFor(() => {
      expect(section?.textContent).toContain("Session finding.");
    });
    expect(loadSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeTab: "session" })
    );

    const pageTab = section?.querySelector<HTMLButtonElement>(
      `[data-vera5-notebook-tab="page"]`
    );
    pageTab?.click();
    await vi.waitFor(() => {
      expect(section?.textContent).toContain("Page finding.");
    });
    expect(loadSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeTab: "page" })
    );
  });
});

describe("co-occurrence panel", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  it("renders appeared alongside section and loads related IOCs", async () => {
    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "Same page scan",
      entries: [
        {
          iocType: IOC_TYPE.DOMAIN,
          value: "example.com",
          anchorId: "vera5-hl-missing-co-occur",
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const section = panel.querySelector(`.${HOVER_CARD_CO_OCCURRENCE_CLASS}`);
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-label")).toBe(
      HOVER_CARD_CO_OCCURRENCE_SECTION_ARIA_LABEL
    );
    expect(section?.closest(".vera5-why-detected")).not.toBeNull();
    expect(
      section
        ?.closest('details[data-vera5-casework="why-detected"]')
        ?.querySelector(":scope > summary")?.textContent
    ).toBe("Why detected?");

    await vi.waitFor(() => {
      expect(section?.textContent).toContain("DOM · example.com");
      expect(section?.textContent).toContain("Same page scan");
      expect(section?.hidden).toBe(false);
    });
  });

  it("omits empty co-occurrence and relationship drawers after load", async () => {
    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "",
      entries: [],
    });
    vi.spyOn(
      hoverCardRelationship,
      "loadHoverCardRelationshipPanelView"
    ).mockResolvedValue({
      layout: "list",
      focusEntityKey: "ipv4:8.8.8.8",
      entries: [],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(panel.querySelector(`.${HOVER_CARD_CO_OCCURRENCE_CLASS}`)).toBeNull();
      expect(panel.querySelector(`.${HOVER_CARD_RELATIONSHIP_CLASS}`)).toBeNull();
    });
  });

  it("navigates to a related IOC when its co-occurrence entry is clicked", async () => {
    const navigateSpy = vi
      .spyOn(iocTrayNavigation, "handleNavigateToIocAnchorRequest")
      .mockReturnValue({ ok: true });

    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "Same page scan",
      entries: [
        {
          iocType: IOC_TYPE.DOMAIN,
          value: "example.com",
          anchorId: "vera5-hl-missing-co-occur",
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(
        panel.querySelector(".vera5-hover-card-co-occurrence-item-button")
      ).not.toBeNull();
    });

    const button = panel.querySelector<HTMLButtonElement>(
      ".vera5-hover-card-co-occurrence-item-button"
    );
    expect(button?.getAttribute("aria-label")).toBe("View example.com on page");
    button?.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      {
        anchorId: "vera5-hl-missing-co-occur",
        iocType: IOC_TYPE.DOMAIN,
        value: "example.com",
      },
      document.body,
      document
    );
  });

  it("opens the target IOC hover card when a co-occurrence entry is activated", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 and review example.com on the same page.";
    document.body.appendChild(paragraph);

    setAutoEnrichmentFetcherForTests(null);
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "test stub" }),
      },
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
                result[key] = true;
              }
              if (key === CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED) {
                result[key] = {
                  abuseipdb: false,
                  otx: false,
                  urlscan: false,
                  greynoise: false,
                };
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });

    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });

    const relatedHighlight = Array.from(
      document.querySelectorAll<HTMLElement>("[data-vera5-anchor-id]")
    ).find((highlight) => highlight.dataset.vera5Value === "example.com");
    expect(relatedHighlight).toBeDefined();

    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "Same page scan",
      entries: [
        {
          iocType: IOC_TYPE.DOMAIN,
          value: "example.com",
          anchorId: relatedHighlight!.dataset.vera5AnchorId!,
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(
        panel.querySelector(".vera5-hover-card-co-occurrence-item-button")
      ).not.toBeNull();
    });

    panel
      .querySelector<HTMLButtonElement>(".vera5-hover-card-co-occurrence-item-button")
      ?.click();

    await vi.waitFor(() => {
      const openedPanel = document
        .getElementById(HOVER_CARD_HOST_ID)
        ?.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
      expect(openedPanel?.getAttribute("aria-label")).toBe(
        "Indicator details for example.com"
      );
      expect(openedPanel?.textContent).toContain("example.com");
    });
  });

  it("moves focus between co-occurrence entries with arrow keys", async () => {
    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "Same page scan",
      entries: [
        {
          iocType: IOC_TYPE.DOMAIN,
          value: "example.com",
          anchorId: "vera5-hl-missing-co-occur",
        },
        {
          iocType: IOC_TYPE.IPV4,
          value: "192.0.2.1",
          anchorId: "vera5-hl-3",
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    document.body.appendChild(panel);

    await vi.waitFor(() => {
      expect(
        panel.querySelectorAll(".vera5-hover-card-co-occurrence-item-button").length
      ).toBe(2);
    });

    const buttons = Array.from(
      panel.querySelectorAll<HTMLButtonElement>(
        ".vera5-hover-card-co-occurrence-item-button"
      )
    );
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    expect(
      handleCoOccurrenceListItemKeyDown(
        {
          key: "ArrowDown",
          currentTarget: buttons[0]!,
          preventDefault,
          stopPropagation,
        },
        ".vera5-hover-card-co-occurrence-item-button"
      )
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[1]);

    focusAdjacentCoOccurrenceListItem(
      buttons[1]!,
      "focus-previous",
      ".vera5-hover-card-co-occurrence-item-button"
    );
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("shows feedback when co-occurrence navigation cannot find the highlight", async () => {
    vi.spyOn(hoverCardCoOccurrence, "loadHoverCardCoOccurrencePanelView").mockResolvedValue({
      contextLabel: "Same page scan",
      entries: [
        {
          iocType: IOC_TYPE.DOMAIN,
          value: "example.com",
          anchorId: "vera5-hl-missing-co-occur",
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(
        panel.querySelector(".vera5-hover-card-co-occurrence-item-button")
      ).not.toBeNull();
    });

    const button = panel.querySelector<HTMLButtonElement>(
      ".vera5-hover-card-co-occurrence-item-button"
    );
    button?.click();

    await vi.waitFor(() => {
      expect(
        panel.querySelector(".vera5-hover-card-co-occurrence-feedback")?.textContent
      ).toBe("Could not find example.com on the page. Scan again to refresh the list.");
    });
  });
});

describe("relationship panel", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
  });

  it("renders previously appeared with list rows (type, truncated value, last seen, session count)", async () => {
    vi.spyOn(
      hoverCardRelationship,
      "loadHoverCardRelationshipPanelView"
    ).mockResolvedValue({
      layout: "list",
      focusEntityKey: "ipv4:185.220.101.1",
      entries: [
        {
          edgeId: "re-test",
          relationship: "co_seen",
          relatedEntityKey: "domain:evil.example",
          iocType: IOC_TYPE.DOMAIN,
          value: "evil.example",
          lastSeen: Date.UTC(2026, 6, 28),
          sessionCount: 2,
          sessionIds: ["vera5-inv-a", "vera5-inv-b"],
        },
      ],
    });

    const panel = buildHoverCardPanel({
      value: "185.220.101.1",
      type: IOC_TYPE.IPV4,
    });

    const section = panel.querySelector(`.${HOVER_CARD_RELATIONSHIP_CLASS}`);
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-label")).toBe(
      HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL
    );
    expect(section?.getAttribute("data-vera5-relationship-layout")).toBe("list");
    expect(section?.closest(".vera5-why-detected")).not.toBeNull();

    await vi.waitFor(() => {
      expect(section?.textContent).toContain("DOM · evil.example");
      expect(section?.textContent).toContain("Last seen:");
      expect(section?.textContent).toContain("2 sessions");
      expect(section?.hidden).toBe(false);
    });

    const disclaimer = section?.querySelector(
      `.${HOVER_CARD_RELATIONSHIP_DISCLAIMER_CLASS}`
    );
    expect(disclaimer).not.toBeNull();
    expect(disclaimer?.getAttribute("role")).toBe("note");
    expect(disclaimer?.textContent).toBe(RELATIONSHIP_MEMORY_DISCLAIMER_TEXT);
    expect(disclaimer?.textContent).toContain("Correlation ≠ causation");
  });
});

describe("match provenance exposure", () => {
  it("stores provenance on hover card panel datasets", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Contact 8.8.8.8 for details.",
    });
    expect(panel.dataset.vera5RuleId).toBe("ioc.regex.ipv4");
    expect(panel.dataset.vera5SourceTextHint).toBe(
      "Contact 8.8.8.8 for details."
    );
  });

  it("renders Phase 2 type badge labels in the hover card header", () => {
    const cases: Array<{ type: IocType; label: string; value: string }> = [
      { type: IOC_TYPE.EMAIL, label: "Email address", value: "analyst@corp.example.com" },
      { type: IOC_TYPE.ASN, label: "ASN", value: "AS15169" },
      { type: IOC_TYPE.CIDR, label: "IPv4 CIDR", value: "203.0.113.0/24" },
      { type: IOC_TYPE.FILEPATH, label: "File path", value: "C:\\Users\\Public\\malware.exe" },
      { type: IOC_TYPE.ONION, label: "Onion domain", value: `${"a".repeat(56)}.onion` },
    ];

    for (const { type, label, value } of cases) {
      const panel = buildHoverCardPanel({ value, type });
      expect(panel.querySelector(".vera5-hover-card-type")?.textContent).toBe(label);
    }
  });

  it("renders Why detected panel with Phase 2 provenance", () => {
    const panel = buildHoverCardPanel({
      value: "analyst@corp.example.com",
      type: IOC_TYPE.EMAIL,
      ruleId: IOC_RULE_ID.EMAIL,
      sourceTextHint: "Contact analyst@corp.example.com today",
      ignoredOverlaps: [
        {
          type: IOC_TYPE.DOMAIN,
          value: "corp.example.com",
          ruleId: IOC_RULE_ID.DOMAIN,
        },
      ],
    });

    const why = panel.querySelector(".vera5-why-detected");
    expect(why).not.toBeNull();
    expect(
      why?.closest('details[data-vera5-casework="why-detected"]')
    ).not.toBeNull();
    expect(panel.querySelector(`.${HOVER_CARD_MORE_GROUP_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("Type: Email address");
    expect(panel.textContent).toContain("Matched an email address in visible text.");
    expect(panel.textContent).toContain(
      "Source context: Contact analyst@corp.example.com today"
    );
    expect(panel.textContent).toContain("corp.example.com");
    expect(panel.textContent).toContain(
      "Matched a domain name in visible text, including bracket-dot defanged forms."
    );
  });

  it("renders Why detected panel with type, reason, context, and ignored overlaps", () => {
    const panel = buildHoverCardPanel({
      value: "https://example.com",
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: "Visit https://example.com today",
      ignoredOverlaps: [
        {
          type: IOC_TYPE.DOMAIN,
          value: "example.com",
          ruleId: "ioc.regex.domain",
        },
      ],
    });

    const section = panel.querySelector(".vera5-why-detected");
    expect(section).not.toBeNull();
    expect(
      section
        ?.closest('details[data-vera5-casework="why-detected"]')
        ?.querySelector(":scope > summary")?.textContent
    ).toBe("Why detected?");
    expect(section?.getAttribute("aria-label")).toBe("Why detected?");
    expect(panel.textContent).toContain("Type: URL");
    expect(panel.textContent).toContain(
      "Matched a visible URL in page text, including defanged hxxp and bracket-dot forms."
    );
    expect(panel.textContent).toContain(
      "Source context: Visit https://example.com today"
    );
    expect(panel.textContent).toContain("example.com");
    expect(panel.textContent).toContain(
      "Matched a domain name in visible text, including bracket-dot defanged forms."
    );
  });

  it("shows deprioritized badge and linked matched noise rule", async () => {
    const { STORAGE_KEY_NOISE_RULES, NOISE_RULES_STORE_SCHEMA_VERSION } = await import(
      "../lib/noiseRuleStorage"
    );
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");
    const tabsCreate = vi.fn(() => Promise.resolve({ id: 1 }));
    const localStore: Record<string, unknown> = {};
    const rule = createNoiseRule({
      id: "nr-hover-overlay",
      patternType: "exact",
      pattern: "noise.example",
      sourceAction: "suppress",
      createdAt: 1,
      hitCount: 0,
    });
    localStore[STORAGE_KEY_NOISE_RULES] = {
      schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
    };

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      tabs: {
        create: tabsCreate,
      },
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
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
          remove: () => Promise.resolve(),
        },
      },
    });

    const panel = buildHoverCardPanel({
      value: "noise.example",
      type: IOC_TYPE.DOMAIN,
    });
    document.body.appendChild(panel);

    await vi.waitFor(() => {
      expect(
        panel.querySelector("[data-vera5-noise-deprioritized-badge='true']")?.textContent
      ).toBe("Deprioritized");
    });

    const matchSection = panel.querySelector(".vera5-hover-card-noise-rule-match");
    expect(matchSection?.getAttribute("aria-label")).toBe("Matched noise rule");
    expect(matchSection?.textContent).toContain("Suppress false positive");
    expect(matchSection?.textContent).toContain("View matched noise rule");

    const link = panel.querySelector<HTMLButtonElement>(
      "[data-vera5-noise-rule-link='true']"
    );
    expect(link).not.toBeNull();
    link?.click();
    expect(tabsCreate).toHaveBeenCalledWith({
      url: "chrome-extension://test/options.html#noise-rules/nr-hover-overlay",
    });

    vi.unstubAllGlobals();
  });

  it("shows known benign badge when a known-good entry matches", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");
    const localStore: Record<string, unknown> = {};
    const tabsCreate = vi.fn(() => Promise.resolve({ id: 1 }));
    const entry = createKnownGoodEntry({
      id: "kg-hover-overlay",
      category: "saas",
      matchType: "domain",
      pattern: "noise.example",
      labelText: "Known benign",
    });
    localStore[STORAGE_KEY_KNOWN_GOOD_LIST] = {
      schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      entries: [entry],
    };

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      tabs: {
        create: tabsCreate,
      },
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
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
          remove: () => Promise.resolve(),
        },
      },
    });

    const panel = buildHoverCardPanel({
      value: "noise.example",
      type: IOC_TYPE.DOMAIN,
    });
    document.body.appendChild(panel);

    await vi.waitFor(() => {
      expect(
        panel.querySelector("[data-vera5-known-good-badge='true']")?.textContent
      ).toBe("Known benign");
    });

    const provenance = panel.querySelector(".vera5-hover-card-known-good-match");
    expect(provenance?.getAttribute("data-vera5-known-good-entry-id")).toBe(
      "kg-hover-overlay"
    );
    expect(provenance?.getAttribute("data-vera5-known-good-category")).toBe(
      "saas"
    );
    expect(provenance?.getAttribute("data-vera5-known-good-match-type")).toBe(
      "domain"
    );
    expect(provenance?.getAttribute("data-vera5-known-good-pattern")).toBe(
      "noise.example"
    );
    expect(provenance?.textContent).toContain("SaaS · domain · noise.example");
    expect(provenance?.textContent).toContain("Entry id: kg-hover-overlay");
    const link = panel.querySelector(
      "[data-vera5-known-good-entry-link='true']"
    ) as HTMLButtonElement | null;
    expect(link?.textContent).toBe("View matched known-good entry");
    link?.click();
    expect(tabsCreate).toHaveBeenCalledWith({
      url: "chrome-extension://test/options.html#known-good/kg-hover-overlay",
    });

    vi.unstubAllGlobals();
  });

  it("shows enrich skipped known-good policy with matched entry link", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");
    const { ENRICHMENT_ERROR_CODE } = await import("../lib/enrichment");
    const localStore: Record<string, unknown> = {};
    const entry = createKnownGoodEntry({
      id: "kg-skip-overlay",
      category: "saas",
      matchType: "domain",
      pattern: "skip.example",
      labelText: "Known benign",
    });
    localStore[STORAGE_KEY_KNOWN_GOOD_LIST] = {
      schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
      updatedAt: 1,
      entries: [entry],
      categoryEnabled: {
        cdn: true,
        saas: true,
        corp_vpn: true,
        vuln_scanner: true,
        internal: true,
      },
    };

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      tabs: {
        create: vi.fn(() => Promise.resolve({ id: 1 })),
      },
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
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
          remove: () => Promise.resolve(),
        },
      },
    });

    const panel = buildHoverCardPanel({
      value: "skip.example",
      type: IOC_TYPE.DOMAIN,
      enrichmentState: "empty",
      errorCode: ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY,
      errorMessage: "Outbound vendor enrichment skipped (known-good match policy).",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "skipped",
          badgeText: "Skipped (known-good)",
          detail: "Outbound vendor enrichment skipped (known-good match policy).",
          errorCode: ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY,
        },
      ],
    });
    document.body.appendChild(panel);

    await vi.waitFor(() => {
      expect(
        panel.querySelector("[data-vera5-known-good-enrich-skipped='true']")
          ?.textContent
      ).toBe("Enrichment skipped (known-good policy)");
    });
    expect(
      panel.querySelector("[data-vera5-known-good-entry-link='true']")
    ).not.toBeNull();

    vi.unstubAllGlobals();
  });

  it("renders on-page and refanged values when displayValue differs", () => {
    const panel = buildHoverCardPanel({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: "Ticket hxxps://example[.]com/evil",
    });

    expect(panel.querySelector(".vera5-hover-card-value")).toBeNull();
    expect(panel.querySelector(".vera5-hover-card-value-on-page")?.textContent).toBe(
      "On page: hxxps://example[.]com/evil"
    );
    expect(panel.querySelector(".vera5-hover-card-refanged-value")?.textContent).toBe(
      "Refanged: https://example.com/evil"
    );
  });

  it("renders separate defanged and refanged copy actions when displayValue differs", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
    });

    const buttons = Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`.${HOVER_CARD_COPY_BUTTON_CLASS}`)
    );
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Copy defanged",
      "Copy refanged",
    ]);

    buttons[0]?.click();
    await vi.waitFor(() => {
      expect(copy).toHaveBeenCalledWith("hxxps://example[.]com/evil");
    });

    buttons[1]?.click();
    await vi.waitFor(() => {
      expect(copy).toHaveBeenCalledWith("https://example.com/evil");
    });

    copy.mockRestore();
  });

  it("requires the VERA5 navigation gate before opening a live URL", () => {
    const open = vi.fn(() => null);
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: true,
      value: open,
    });

    const panel = buildHoverCardPanel({
      value: "https://example.com/evil",
      type: IOC_TYPE.URL,
    });

    const openButton = Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`.${HOVER_CARD_ACTION_CLASS}`)
    ).find((button) => button.textContent === "Open live URL");
    expect(openButton).toBeDefined();
    openButton?.click();

    const warning = panel.querySelector(".vera5-live-url-warning");
    const confirmButton = panel.querySelector<HTMLButtonElement>(
      ".vera5-live-url-warning-confirm"
    );
    expect(warning?.getAttribute("role")).toBe("alertdialog");
    expect(warning?.textContent).toContain("VERA5 // NAVIGATION GATE");
    expect(warning?.textContent).toContain("Open live indicator?");
    expect(warning?.textContent).toContain("https://example.com/evil");
    expect(open).not.toHaveBeenCalled();

    confirmButton?.click();

    expect(open).toHaveBeenCalledWith(
      "https://example.com/evil",
      "_blank",
      "noopener,noreferrer"
    );
    expect(panel.querySelector(".vera5-live-url-warning")).toBeNull();
  });

  it("does not open a live URL when the VERA5 warning is cancelled", () => {
    const open = vi.fn(() => null);
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: true,
      value: open,
    });

    const panel = buildHoverCardPanel({
      value: "https://example.com/evil",
      type: IOC_TYPE.URL,
    });

    const openButton = Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`.${HOVER_CARD_ACTION_CLASS}`)
    ).find((button) => button.textContent === "Open live URL");
    openButton?.click();

    const cancelButton = panel.querySelector<HTMLButtonElement>(
      ".vera5-live-url-warning-cancel"
    );
    expect(cancelButton).not.toBeNull();
    cancelButton?.click();

    expect(open).not.toHaveBeenCalled();
    expect(panel.querySelector(".vera5-live-url-warning")).toBeNull();
  });
});

describe("pivot recipes panel content", () => {
  afterEach(() => {
    clearSessionAnalystNotes();
  });

  it.each(PIVOT_PANEL_GOLDEN_CASES)(
    "renders compact pivot chips from getPivotRecipes for $type",
    ({ type, value }) => {
      const panel = buildHoverCardPanel({ value, type });
      const section = panel.querySelector(`.${HOVER_CARD_PIVOT_RECIPES_CLASS}`);

      expect(section).not.toBeNull();
      expect(section?.getAttribute("aria-label")).toBe("Recommended next pivots");
      expect(panel.textContent).toContain("Pivots");
      expect(panel.textContent).toContain("[Redirect to Intel Sites]");

      const expectedRecipes = getPivotRecipes(type, value).slice(
        0,
        HOVER_CARD_PIVOT_CHIP_MAX
      );
      const rows = readPivotRecipePanelRows(panel);

      expect(rows).toHaveLength(expectedRecipes.length);
      expect(rows.map((row) => row.sourceLabel)).toEqual(
        expectedRecipes.map((recipe) => recipe.sourceLabel)
      );
      expect(rows.map((row) => row.linkLabel)).toEqual(
        expectedRecipes.map((recipe) => recipe.label)
      );
      expect(rows.map((row) => row.href)).toEqual(
        expectedRecipes.map((recipe) => recipe.href)
      );
      expect(rows.map((row) => row.guidance)).toEqual(
        expectedRecipes.map((recipe) => recipe.guidance)
      );

      const list = panel.querySelector(`.${HOVER_CARD_PIVOT_RECIPES_LIST_CLASS}`);
      expect(list?.children).toHaveLength(expectedRecipes.length);

      const links = Array.from(
        panel.querySelectorAll(`.${HOVER_CARD_PIVOT_LINK_CLASS}`)
      );
      for (const recipe of expectedRecipes) {
        const link = links.find(
          (anchor) => anchor.getAttribute("href") === recipe.href
        );
        expect(link?.textContent).toBe(recipe.sourceLabel);
        expect(link?.getAttribute("title")).toBe(recipe.guidance);
        expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
        expect(link?.getAttribute("target")).toBe("_blank");
      }

      expect(
        panel.querySelectorAll(`.${HOVER_CARD_PIVOT_RECIPE_SOURCE_CLASS}`).length
      ).toBe(0);
      expect(
        panel.querySelectorAll(`.${HOVER_CARD_PIVOT_RECIPE_GUIDANCE_CLASS}`).length
      ).toBe(0);
    }
  );

  it("orders URL indicators with URLScan first in the panel", () => {
    const value = "https://example.com/login";
    const panel = buildHoverCardPanel({
      value,
      type: IOC_TYPE.URL,
    });

    const expected = getPivotRecipes(IOC_TYPE.URL, value).slice(
      0,
      HOVER_CARD_PIVOT_CHIP_MAX
    );
    expect(readPivotRecipePanelRows(panel).map((row) => row.sourceLabel)).toEqual(
      expected.map((recipe) => recipe.sourceLabel)
    );
    expect(readPivotRecipePanelRows(panel)[0]?.sourceLabel).toBe("URLScan.io");
  });

  it("does not inject enrichment summaries into pivot guidance rows", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "100% abusive — 45/70 vendors flagged malicious",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "100% abusive confidence with 45/70 vendor consensus",
        },
      ],
    });

    for (const guidance of readPivotGuidanceText(panel)) {
      expect(guidance).not.toMatch(/\b100\s*%\b/);
      expect(guidance).not.toMatch(/\b45\s*\/\s*70\b/);
    }
    expect(readPivotRecipePanelRows(panel).map((row) => row.guidance)).toEqual(
      getPivotRecipes(IOC_TYPE.IPV4, "8.8.8.8")
        .slice(0, HOVER_CARD_PIVOT_CHIP_MAX)
        .map((recipe) => recipe.guidance)
    );
  });
});

describe("hover card overlay shell", () => {
  afterEach(() => {
    clearSessionAnalystNotes();
  });

  it("renders recommended pivot recipes with source attribution for IPv4 indicators", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      panel.querySelector(`.${HOVER_CARD_PIVOT_RECIPES_CLASS}`)
    ).not.toBeNull();
    expect(panel.textContent).toContain("Pivots");
    expect(
      panel.querySelectorAll(`.${HOVER_CARD_PIVOT_LINK_CLASS}`).length
    ).toBeGreaterThan(0);
    const vtLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.virustotal.com/gui/ip-address/8.8.8.8"]`
    );
    const abuseLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.abuseipdb.com/check/8.8.8.8"]`
    );
    expect(vtLink?.textContent).toBe("VirusTotal");
    expect(abuseLink?.textContent).toBe("AbuseIPDB");
    expect(vtLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(vtLink?.getAttribute("target")).toBe("_blank");
    expect(vtLink?.getAttribute("title")).toBeTruthy();
  });

  it.each<
    [
      string,
      {
        enrichmentState?: HoverCardEnrichmentState;
        summary?: string;
        errorMessage?: string;
        expectedText: string;
        modifier: keyof typeof HOVER_CARD_ENRICHMENT_MODIFIER_CLASS;
        role: "status" | "alert";
        ariaBusy?: string;
        ariaLive?: string;
      },
    ]
  >([
    [
      "empty default",
      {
        expectedText: DEFAULT_HOVER_CARD_SUMMARY,
        modifier: "empty",
        role: "status",
      },
    ],
    [
      "empty explicit",
      {
        enrichmentState: "empty",
        expectedText: DEFAULT_HOVER_CARD_SUMMARY,
        modifier: "empty",
        role: "status",
      },
    ],
    [
      "loading",
      {
        enrichmentState: "loading",
        expectedText: HOVER_CARD_LOADING_SUMMARY,
        modifier: "loading",
        role: "status",
        ariaBusy: "true",
        ariaLive: "polite",
      },
    ],
    [
      "error default",
      {
        enrichmentState: "error",
        expectedText: HOVER_CARD_ERROR_SUMMARY,
        modifier: "error",
        role: "alert",
      },
    ],
    [
      "error custom",
      {
        enrichmentState: "error",
        errorMessage: "Request timed out.",
        expectedText: "Request timed out.",
        modifier: "error",
        role: "alert",
      },
    ],
    [
      "ready",
      {
        enrichmentState: "ready",
        summary: "3 threat pulses",
        expectedText: "3 threat pulses",
        modifier: "ready",
        role: "status",
      },
    ],
  ])("renders %s enrichment state", (_label, config) => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: config.enrichmentState,
      summary: config.summary,
      errorMessage: config.errorMessage,
    });

    const summary = queryOverlayEnrichmentSummary(panel);
    expect(summary?.textContent).toContain(config.expectedText);
    expect(summary?.className).toContain(
      HOVER_CARD_ENRICHMENT_MODIFIER_CLASS[config.modifier]
    );
    expect(summary?.getAttribute("role")).toBe(config.role);

    if (config.ariaBusy) {
      expect(summary?.getAttribute("aria-busy")).toBe(config.ariaBusy);
    } else {
      expect(summary?.hasAttribute("aria-busy")).toBe(false);
    }

    if (config.ariaLive) {
      expect(summary?.getAttribute("aria-live")).toBe(config.ariaLive);
    } else {
      expect(summary?.hasAttribute("aria-live")).toBe(false);
    }
  });

  it("shows ready summary and keeps pivot recipes visible together", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "Known scanner activity.",
    });

    expect(panel.textContent).toContain("Known scanner activity.");
    expect(
      panel.querySelector(`.${HOVER_CARD_PIVOT_RECIPES_CLASS}`)
    ).not.toBeNull();
    expect(queryOverlayEnrichmentSummary(panel)?.className).toContain(
      HOVER_CARD_ENRICHMENT_MODIFIER_CLASS.ready
    );
  });

  it("keeps pivot guidance static when enrichment summaries change", () => {
    const baselinePanel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    const enrichedPanel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "100% abusive — 45/70 vendors flagged malicious",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "100% abusive confidence with 45/70 vendor consensus",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "Score 92/100 — detected as malicious by 45 vendors",
        },
      ],
    });

    expect(readPivotGuidanceText(baselinePanel)).toEqual(
      readPivotGuidanceText(enrichedPanel)
    );
    expect(enrichedPanel.textContent).toContain(
      "100% abusive — 45/70 vendors flagged malicious"
    );
    for (const guidance of readPivotGuidanceText(enrichedPanel)) {
      expect(guidance).not.toMatch(/\b45\s*\/\s*70\b/);
      expect(guidance).not.toMatch(/\b100\s*%\b/);
      expect(guidance).not.toMatch(/flagged malicious/i);
    }
  });

  it("hides attribution footer while loading", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`)).toBeNull();
    expect(panel.textContent).toContain(HOVER_CARD_LOADING_SUMMARY);
  });

  it("copies the IOC value from the shell copy button", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = panel.querySelector(`.${HOVER_CARD_COPY_BUTTON_CLASS}`);
    expect(button?.textContent).toBe("Copy Indicator");
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(button?.textContent).toBe("Copied");
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    expect(button?.className).toContain("vera5-hover-card-copy--copied");
    copy.mockRestore();
  });
});

describe("overlay risk score presentation", () => {
  const blendedSourceResults = buildHoverCardSourceEntries([
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "84 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      sourceLabel: "OTX",
      status: "ok",
      summary: "4 threat pulses",
    },
  ]);

  const disagreeingSourceResults = buildHoverCardSourceEntries([
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "95 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      sourceLabel: "OTX",
      status: "ok",
      summary: "1 threat pulse",
    },
  ]);

  it("omits the risk score section when enrichment has no source results", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
    });

    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`)).toBeNull();
    expect(panel.textContent).not.toContain("Risk score:");
  });

  it("omits the risk score section while enrichment is loading", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading",
    });

    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`)).toBeNull();
    expect(panel.textContent).not.toContain("Risk score:");
  });

  it("renders unavailable score state instead of a composite label when all sources are disabled", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      disabledSources: [...ENRICHMENT_SOURCE_ORDER],
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "74 abuse confidence",
        },
      ]),
    });

    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_UNAVAILABLE_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("Risk score unavailable");
    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_LABEL_CLASS}`)).toBeNull();
    expect(panel.textContent).not.toContain("Risk score:");
  });

  it("renders a blended composite score label with signal strength", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      sourceResults: blendedSourceResults,
    });

    const label = panel.querySelector(`.${HOVER_CARD_RISK_SCORE_LABEL_CLASS}`);
    expect(label).not.toBeNull();
    expect(label?.textContent).toMatch(
      /Risk score:\s*(High|Suspicious|Critical) risk \(\d+\/100\)/
    );
    expect(label?.querySelector("strong")?.textContent).toMatch(
      /(High|Suspicious|Critical) risk \(\d+\/100\)/
    );
  });

  it("renders the disagreement callout after the reasoning chain for diverging sources", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "95 abuse confidence",
      sourceResults: disagreeingSourceResults,
    });

    const scoreSection = panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`);
    const chain = scoreSection?.querySelector(
      `.${HOVER_CARD_RISK_REASONING_CHAIN_CLASS}`
    );
    const callout = scoreSection?.querySelector(
      `.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`
    );

    expect(callout).not.toBeNull();
    expect(callout?.getAttribute("role")).toBe("note");
    expect(callout?.textContent).toBe(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
    expect(
      chain?.compareDocumentPosition(callout!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("overlay reasoning chain presentation paths", () => {
  const agreeingSourceResults = buildHoverCardSourceEntries([
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "74 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      sourceLabel: "OTX",
      status: "ok",
      summary: "74 abuse confidence",
    },
  ]);

  const disagreeingSourceResults = buildHoverCardSourceEntries([
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "95 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      sourceLabel: "OTX",
      status: "ok",
      summary: "1 threat pulse",
    },
  ]);

  const insufficientSourceResults = buildHoverCardSourceEntries([
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "12 abuse confidence",
    },
  ]);

  function buildReadyPanel(
    sourceResults: ReturnType<typeof buildHoverCardSourceEntries>
  ) {
    return buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sourceResults,
    });
  }

  it("shows the reasoning chain section when blended composite evidence is available", () => {
    const panel = buildReadyPanel(agreeingSourceResults);
    const reasoning = panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CLASS}`);

    expect(reasoning).not.toBeNull();
    expect(reasoning?.getAttribute("aria-label")).toBe("How this score was computed");
    expect(panel.textContent).toContain("How this score was computed");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CHAIN_CLASS}`)
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).toBeNull();
  });

  it("lists per-source reasoning lines in connector order", () => {
    const panel = buildReadyPanel(agreeingSourceResults);
    const steps = panel.querySelectorAll(`.${HOVER_CARD_RISK_REASONING_STEP_CLASS}`);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.textContent).toContain("AbuseIPDB:");
    expect(steps[1]?.textContent).toContain("OTX:");
    expect(steps[0]?.textContent).toContain("74/100");
    expect(steps[1]?.textContent).toContain("74/100");
  });

  it("shows the disagreement callout only when sources diverge materially", () => {
    const agreeingPanel = buildReadyPanel(agreeingSourceResults);
    const disagreeingPanel = buildReadyPanel(disagreeingSourceResults);

    expect(
      agreeingPanel.querySelector(`.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`)
    ).toBeNull();
    const callout = disagreeingPanel.querySelector(
      `.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`
    );
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toBe(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
  });

  it("shows a short Sources hint instead of empty reasoning when blend evidence is insufficient", () => {
    const panel = buildReadyPanel(insufficientSourceResults);

    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS}`)?.textContent
    ).toBe("Need two sources to blend.");
    expect(
      panel.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).toBeNull();
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CHAIN_CLASS}`)
    ).toBeNull();
    expect(panel.textContent).not.toContain("How this score was computed");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`)
    ).toBeNull();
  });

  it("opens Sources when the insufficient risk notice is activated with multi-source rows", () => {
    const panel = buildReadyPanel(
      buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "error",
          summary: "request failed",
        },
      ])
    );
    const notice = panel.querySelector(
      `.${HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS}`
    ) as HTMLElement | null;
    const sourcesDetails = Array.from(panel.querySelectorAll("details")).find(
      (node) =>
        Array.from(node.children).some(
          (child) => child.tagName === "SUMMARY" && child.textContent === "Intel Sources"
        )
    ) as HTMLDetailsElement | undefined;

    expect(notice?.textContent).toBe("Need two sources to blend — see Intel Sources.");
    expect(sourcesDetails).not.toBeUndefined();
    expect(sourcesDetails?.open).toBe(false);

    notice?.click();

    expect(sourcesDetails?.open).toBe(true);
  });
});

describe("hover card overlay", () => {
  afterEach(() => {
    hideHoverCard();
    document.body.replaceChildren();
    clearSessionAnalystNotes();
  });

  it("mounts a positioned panel near the anchor", () => {
    const anchor = document.createElement("span");
    anchor.textContent = "8.8.8.8";
    anchor.style.display = "inline-block";
    anchor.style.position = "absolute";
    anchor.style.top = "120px";
    anchor.style.left = "300px";
    anchor.style.width = "80px";
    anchor.style.height = "20px";
    document.body.appendChild(anchor);

    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 120,
        left: 300,
        width: 80,
        height: 20,
        right: 380,
        bottom: 140,
        x: 300,
        y: 120,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(document.getElementById(HOVER_CARD_HOST_ID)).not.toBeNull();
    expect(panel.className).toBe(HOVER_CARD_PANEL_CLASS);
    expect(panel.style.position).toBe("fixed");
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(140);
    expect(panel.textContent).toContain("8.8.8.8");
    const vtLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.virustotal.com/gui/ip-address/8.8.8.8"]`
    );
    expect(vtLink?.textContent).toBe("VirusTotal");
  });

  it("repositions when the anchor is flush against the right edge", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);

    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 200,
        left: 760,
        width: 30,
        height: 18,
        right: 790,
        bottom: 218,
        x: 760,
        y: 200,
        toJSON: () => ({}),
      }),
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "CVE-2021-44228",
      type: IOC_TYPE.CVE,
    });

    expect(Number.parseFloat(panel.style.left)).toBeLessThan(760);
  });

  it("copies the IOC from the overlay copy button", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 80,
        left: 80,
        width: 40,
        height: 16,
        right: 120,
        bottom: 96,
        x: 80,
        y: 80,
        toJSON: () => ({}),
      }),
    });

    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = panel.querySelector(`.${HOVER_CARD_COPY_BUTTON_CLASS}`);
    expect(button).not.toBeNull();
    await vi.waitFor(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      expect(button?.textContent).toBe("Copied");
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    copy.mockRestore();
  });

  it("shows loading and disabled-source placeholders in the overlay", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading",
      disabledSources: [ENRICHMENT_SOURCE.OTX],
    });

    const enrichment = panel.querySelector(`.${HOVER_CARD_ENRICHMENT_CLASS}`);
    expect(enrichment?.textContent).toContain(HOVER_CARD_LOADING_SUMMARY);
    expect(enrichment?.getAttribute("aria-busy")).toBe("true");
    expect(panel.querySelector(`.${HOVER_CARD_SOURCES_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("OTX");
  });

  it("shows source summary and tags when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      tags: ["US", "Fixed Line ISP"],
    });

    expect(panel.textContent).toContain("12 abuse confidence");
    const tagsRow = panel.querySelector(`.${HOVER_CARD_TAGS_CLASS}`);
    expect(tagsRow).not.toBeNull();
    expect(
      tagsRow?.closest('details[data-vera5-casework="why-detected"]')
    ).not.toBeNull();
    expect(panel.querySelectorAll(`.${HOVER_CARD_TAG_CLASS}`)).toHaveLength(2);
  });

  it("shows GreyNoise benign and noise context in summary and tags when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "malicious internet noise",
      tags: ["malicious", "noise"],
      sourceAttribution: { sourceLabel: "GreyNoise", fromCache: false },
    });

    expect(panel.textContent).toContain("malicious internet noise");
    expect(panel.textContent).toContain("malicious");
    expect(panel.textContent).toContain("noise");
    expect(panel.querySelector(`.${HOVER_CARD_TAGS_CLASS}`)).not.toBeNull();
  });

  it("shows GreyNoise per-source tags on multi-source enrichment rows", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.GREYNOISE,
          sourceLabel: "GreyNoise",
          status: "ok",
          summary: "benign RIOT service",
          tags: ["benign", "Google Public DNS", "riot"],
        },
      ]),
    });

    const greynoiseItem = panel.querySelectorAll(`.${HOVER_CARD_SOURCE_ITEM_CLASS}`)[1];
    expect(greynoiseItem?.textContent).toContain("benign RIOT service");
    expect(
      greynoiseItem?.querySelector(`.${HOVER_CARD_SOURCE_TAGS_CLASS}`)
    ).not.toBeNull();
    expect(
      greynoiseItem?.querySelectorAll(`.${HOVER_CARD_TAG_CLASS}`)
    ).toHaveLength(3);
  });

  it("shows GreyNoise attribution on multi-source rows alongside AbuseIPDB and OTX", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "4 threat pulses",
        },
        {
          sourceId: ENRICHMENT_SOURCE.GREYNOISE,
          sourceLabel: "GreyNoise",
          status: "ok",
          summary: "malicious internet noise",
          tags: ["malicious", "noise"],
        },
      ]),
    });

    const sourceItems = panel.querySelectorAll(`.${HOVER_CARD_SOURCE_ITEM_CLASS}`);
    expect(sourceItems).toHaveLength(3);
    expect(panel.textContent).toContain("AbuseIPDB · Live");
    expect(panel.textContent).toContain("OTX · Live");
    expect(panel.textContent).toContain("GreyNoise · Live");
    expect(panel.textContent).toContain("malicious internet noise");
    expect(
      panel.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
    expect(panel.textContent).toContain("GreyNoise:");
  });

  it("shows RDAP/WHOIS attribution with fetch timestamp on single-source domain enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
        sourceLabel: "RDAP/WHOIS",
        status: "ok",
        summary:
          "Example Registrar · registered 1995-08-14 · expires 2024-08-13",
        fetchedAt: "2026-06-30T12:00:00.000Z",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
      enrichmentState: "ready",
      summary:
        "Example Registrar · registered 1995-08-14 · expires 2024-08-13",
      sourceResults,
      sourceAttribution: { sourceLabel: "RDAP/WHOIS" },
    });

    expect(panel.textContent).toContain("Source: RDAP/WHOIS · live");
    expect(panel.textContent).toContain("Last updated:");
    expect(panel.textContent).toContain("Example Registrar");
  });

  it("shows RDAP/WHOIS attribution on multi-source rows with fetch timestamp", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
      enrichmentState: "ready",
      summary: "2 threat pulses",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "2 threat pulses",
          fetchedAt: "2026-06-30T11:00:00.000Z",
        },
        {
          sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
          sourceLabel: "RDAP/WHOIS",
          status: "ok",
          summary:
            "Example Registrar · registered 1995-08-14 · expires 2024-08-13",
          fetchedAt: "2026-06-30T12:00:00.000Z",
        },
      ]),
    });

    const sourceItems = panel.querySelectorAll(`.${HOVER_CARD_SOURCE_ITEM_CLASS}`);
    expect(sourceItems).toHaveLength(2);
    expect(panel.textContent).toContain("OTX · Live");
    expect(panel.textContent).toContain("RDAP/WHOIS · Live");
    expect(panel.textContent).toContain("Last updated:");
    expect(
      panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`)
    ).toBeNull();
  });

  it("shows VT, Shodan, and Censys attribution on multi-source rows alongside AbuseIPDB and OTX", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "42 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "2 threat pulses",
        },
        {
          sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
          sourceLabel: "VirusTotal",
          status: "ok",
          summary: "5 malicious detections",
          tags: ["US"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.SHODAN,
          sourceLabel: "Shodan",
          status: "ok",
          summary: "4 open services",
          tags: ["US", "Google"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.CENSYS,
          sourceLabel: "Censys",
          status: "ok",
          summary: "3 observed services",
          tags: ["DE", "443/tcp"],
        },
      ]),
    });

    const sourceItems = panel.querySelectorAll(`.${HOVER_CARD_SOURCE_ITEM_CLASS}`);
    expect(sourceItems).toHaveLength(5);
    expect(panel.textContent).toContain("AbuseIPDB · Live");
    expect(panel.textContent).toContain("OTX · Live");
    expect(panel.textContent).toContain("VirusTotal · Live");
    expect(panel.textContent).toContain("Shodan · Live");
    expect(panel.textContent).toContain("Censys · Live");
    expect(panel.textContent).toContain("5 malicious detections");
    expect(panel.textContent).toContain("4 open services");
    expect(panel.textContent).toContain("3 observed services");
    expect(
      panel.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
  });

  it("shows source attribution footer when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    const footer = panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`);
    expect(footer?.textContent).toBe("Source: AbuseIPDB · cached");
    expect(footer?.getAttribute("role")).toBe("note");
  });

  it("shows source attribution on enrichment errors", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorMessage: "Request timed out.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain("Source: AbuseIPDB");
  });

  it("shows enrichment and risk score disclaimers when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
      ]),
    });

    const footer = panel.querySelector(`.${HOVER_CARD_DISCLAIMER_CLASS}`);
    expect(footer?.getAttribute("aria-label")).toBe(
      HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK
    );
    expect(panel.textContent).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(panel.textContent).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("shows source attribution alongside risk score for single-source ready enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "4 threat pulses",
        },
      ]),
    });

    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("Risk score:");
    expect(panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`)).toBeNull();
    expect(panel.textContent).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(panel.textContent).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("shows single-source attribution derived from source results when risk score is shown", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
          fromCache: true,
        },
      ]),
    });

    const attribution = panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`);
    expect(attribution?.textContent).toBe("Source: AbuseIPDB · cached");
    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("Unknown risk");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS}`)
    ).not.toBeNull();
  });

  it("shows enrichment-only disclaimer when all sources are disabled and risk score is unavailable", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      disabledSources: [...ENRICHMENT_SOURCE_ORDER],
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "74 abuse confidence",
        },
      ]),
    });

    const footer = panel.querySelector(`.${HOVER_CARD_DISCLAIMER_CLASS}`);
    expect(footer?.getAttribute("aria-label")).toBe(
      HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY
    );
    expect(panel.textContent).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(panel.textContent).not.toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
    expect(panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("Risk score unavailable");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_SCORE_UNAVAILABLE_CLASS}`)
    ).not.toBeNull();
  });

  it("shows disagreement callout after reasoning chain without hiding enrichment disclaimers", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "95 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "95 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "1 threat pulse",
        },
      ]),
    });

    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`)
    ).not.toBeNull();
    expect(panel.textContent).toContain("Sources disagree:");
    const reasoning = panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CLASS}`);
    expect(reasoning).not.toBeNull();
    expect(
      panel.querySelectorAll(`.${HOVER_CARD_RISK_REASONING_STEP_CLASS}`)
    ).toHaveLength(2);
    expect(panel.textContent).toContain("AbuseIPDB: Critical");
    expect(panel.textContent).toContain("OTX: Suspicious");
    const scoreSection = panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`);
    const label = scoreSection?.querySelector(
      `.${HOVER_CARD_RISK_SCORE_LABEL_CLASS}`
    );
    const chain = scoreSection?.querySelector(
      `.${HOVER_CARD_RISK_REASONING_CHAIN_CLASS}`
    );
    const disagreement = scoreSection?.querySelector(
      `.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`
    );
    expect(label?.compareDocumentPosition(chain!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      chain?.compareDocumentPosition(disagreement!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(panel.textContent).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(panel.textContent).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("shows per-source reasoning lines for multi-source enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "4 threat pulses",
        },
      ]),
    });

    expect(panel.textContent).toContain("How this score was computed");
    expect(panel.textContent).toContain(
      "AbuseIPDB: Critical (84/100, weight 1.00)."
    );
    expect(panel.textContent).toContain("OTX:");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_DISAGREEMENT_CLASS}`)
    ).not.toBeNull();
  });

  it("shows unknown with a short Sources hint when composite blend is insufficient", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
      ]),
    });

    expect(panel.textContent).toContain("Unknown risk");
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_SCORE_INSUFFICIENT_CLASS}`)?.textContent
    ).toBe("Need two sources to blend.");
    expect(panel.textContent).not.toContain("How this score was computed");
    expect(
      panel.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).toBeNull();
    expect(
      panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CHAIN_CLASS}`)
    ).toBeNull();
  });

  it("shows missing-key message and open-settings action", () => {
    const openOptionsPage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        openOptionsPage,
      },
    });

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "missing_key",
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    const action = panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`);
    expect(action?.textContent).toBe("Open settings");
    action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("shows cached badge and last updated for single-source enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults,
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    expect(panel.textContent).toContain("Last updated:");
    expect(panel.textContent).toContain("Source: AbuseIPDB · cached");
  });

  it("shows Cached badge on multi-source rows served from cache", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
        fetchedAt: "2026-05-22T11:00:00.000Z",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults,
    });

    expect(panel.textContent).toContain("AbuseIPDB · Cached");
    expect(panel.textContent).toContain("OTX · Live");
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--cached")
    ).not.toBeNull();
  });

  it("renders Live, Cached, Error, and Skipped badges on multi-source rows", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Cached",
          detail: "12 abuse confidence",
          fromCache: true,
          lastUpdatedLine: "Last updated: May 22, 2026, 6:00 AM",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "2 threat pulses",
        },
        {
          sourceId: ENRICHMENT_SOURCE.URLSCAN,
          label: "URLScan.io",
          status: "error",
          badgeText: "Error",
          detail: "URLScan.io rate limit reached. Back off before retrying.",
          retryHint: "Retry after 30 seconds.",
        },
        {
          sourceId: ENRICHMENT_SOURCE.GREYNOISE,
          label: "GreyNoise",
          status: "skipped",
          badgeText: "Skipped",
          detail: "Enrichment was not available for this source.",
        },
      ],
    });

    expect(panel.textContent).toContain("AbuseIPDB · Cached");
    expect(panel.textContent).toContain("OTX · Live");
    expect(panel.textContent).toContain("URLScan.io · Error");
    expect(panel.textContent).toContain("GreyNoise · Skipped");
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--cached")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--skipped")
    ).not.toBeNull();
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(4);
    expect(panel.querySelector(".vera5-hover-card-attribution")).toBeNull();
    expect(panel.textContent).toContain("Retry after 30 seconds.");
    expect(panel.textContent).toContain("Intel Sources");
    expect(panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`)).toBeNull();
    expect(
      panel.querySelector(`p.${HOVER_CARD_RETRY_HINT_CLASS}`)
    ).toBeNull();
    const perSourceRetry = panel.querySelector(
      `.${HOVER_CARD_SOURCE_ITEM_CLASS} .${HOVER_CARD_RETRY_HINT_CLASS}`
    );
    expect(perSourceRetry?.textContent).toBe("Retry after 30 seconds.");
    expect(
      panel.querySelector(`.${HOVER_CARD_SOURCE_DETAIL_CLASS}`)
    ).not.toBeNull();
  });

  it("renders confidence metadata chips on each multi-source row", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "2 threat pulses",
        },
      ]),
    });

    const metadataRows = panel.querySelectorAll(".vera5-hover-card-source-metadata");
    expect(metadataRows).toHaveLength(2);
    expect(panel.textContent).toContain("Authoritative");
    expect(panel.textContent).toContain("Community");
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-metadata-chip")
    ).toHaveLength(6);
    expect(
      panel.querySelector(".vera5-hover-card-source-metadata-chip--reliability")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-metadata-chip--freshness")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-metadata-chip--sourceClass")
    ).not.toBeNull();
    expect(metadataRows[0]?.getAttribute("title")).toBe(
      HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP
    );
    const firstChip = panel.querySelector(
      ".vera5-hover-card-source-metadata-chip"
    );
    expect(firstChip?.getAttribute("title")?.toLowerCase()).toContain(
      "informational"
    );
  });

  it("renders source rows without metadata chips when metadata is missing", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: formatSourceStatusBadge("ok"),
          detail: "12 abuse confidence",
          metadataChips: [],
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: formatSourceStatusBadge("ok"),
          detail: "2 threat pulses",
          metadataChips: [],
        },
      ],
    });

    expect(panel.querySelectorAll(".vera5-hover-card-source-metadata")).toHaveLength(
      0
    );
    expect(panel.textContent).toContain("AbuseIPDB");
    expect(panel.textContent).toContain("OTX");
    expect(panel.textContent).toContain("12 abuse confidence");
    expect(panel.textContent).toContain("2 threat pulses");
  });

  it("renders partial metadata chips when reliability tier is missing", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: formatSourceStatusBadge("ok"),
          detail: "12 abuse confidence",
          metadataChips: [
            {
              kind: "freshness",
              label: "Standard",
              tooltip: HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
            },
            {
              kind: "sourceClass",
              label: "Authoritative",
              tooltip: HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
            },
          ],
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: formatSourceStatusBadge("ok"),
          detail: "2 threat pulses",
          metadataChips: [
            {
              kind: "reliability",
              label: "Community",
              tooltip: HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
            },
            {
              kind: "freshness",
              label: "Standard",
              tooltip: HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
            },
            {
              kind: "sourceClass",
              label: "Community",
              tooltip: HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
            },
          ],
        },
      ],
    });

    const metadataRows = panel.querySelectorAll(".vera5-hover-card-source-metadata");
    expect(metadataRows).toHaveLength(2);
    expect(
      metadataRows[0]?.querySelectorAll(".vera5-hover-card-source-metadata-chip")
    ).toHaveLength(2);
    expect(
      metadataRows[0]?.querySelector(
        ".vera5-hover-card-source-metadata-chip--reliability"
      )
    ).toBeNull();
    expect(metadataRows[0]?.textContent).toContain("Standard");
    expect(metadataRows[0]?.textContent).toContain("Authoritative");
    expect(
      metadataRows[1]?.querySelector(
        ".vera5-hover-card-source-metadata-chip--reliability"
      )
    ).not.toBeNull();
  });

  it("shows partial success UI when one source succeeds and another fails", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      tags: ["US"],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "42 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "error",
          badgeText: "Error",
          detail: "OTX rate limit reached. Back off before retrying.",
          retryHint: "Retry after 30 seconds.",
        },
      ],
    });

    expect(panel.textContent).toContain("42 abuse confidence");
    expect(panel.textContent).toContain("US");
    expect(panel.textContent).toContain("AbuseIPDB · Live");
    expect(panel.textContent).toContain("OTX · Error");
    expect(panel.textContent).toContain("OTX rate limit reached");
    expect(panel.querySelector(".vera5-hover-card-attribution")).toBeNull();
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
  });

  it("shows Shodan and Censys partial success when one source succeeds and the other fails", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "4 open services",
      tags: ["US", "Google"],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.SHODAN,
          label: "Shodan",
          status: "ok",
          badgeText: "Live",
          detail: "4 open services",
          tags: ["US", "Google"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.CENSYS,
          label: "Censys",
          status: "error",
          badgeText: "Error",
          detail: "Censys rate limit reached.",
          retryHint: "Retry after 60 seconds.",
        },
      ],
    });

    expect(panel.textContent).toContain("4 open services");
    expect(panel.textContent).toContain("Shodan · Live");
    expect(panel.textContent).toContain("Censys · Error");
    expect(panel.textContent).toContain("Censys rate limit reached");
    expect(panel.querySelector(".vera5-hover-card-attribution")).toBeNull();
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
  });

  it("shows per-source error detail without card-level open-settings when all sources fail", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "missing_key",
        errorMessage:
          "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "error",
        errorCode: "missing_key",
        errorMessage: "Add your OTX API key in Vera5 Settings to load enrichment.",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "missing_key",
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      sourceResults,
    });

    expect(panel.textContent).toContain(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    expect(panel.textContent).toContain(
      "Add your OTX API key in Vera5 Settings to load enrichment."
    );
    expect(panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`)).toBeNull();
    expect(
      panel.querySelectorAll(`.${HOVER_CARD_SOURCE_DETAIL_CLASS}`)
    ).toHaveLength(2);
  });

  it("shows expandable raw vendor JSON for enrichment sources", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
          rawVendorJson:
            '{\n  "data": {\n    "abuseConfidenceScore": 12\n  }\n}',
        },
      ],
    });

    const details = panel.querySelector(".vera5-hover-card-raw-json");
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("Raw response");
    expect(details?.textContent).toContain("abuseConfidenceScore");
  });

  it("redacts sensitive fields in expandable raw response panel", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
          rawVendorJson: JSON.stringify({
            data: { abuseConfidenceScore: 12 },
            Key: TEST_FIXTURE_VENDOR_SENSITIVE_FIELD,
          }),
        },
      ],
    });

    const pre = panel.querySelector(`.${HOVER_CARD_RAW_JSON_BODY_CLASS}`);
    expect(pre?.textContent).toContain("abuseConfidenceScore");
    expect(pre?.textContent).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(pre?.textContent).not.toContain(TEST_FIXTURE_VENDOR_SENSITIVE_FIELD);
  });

  it("shows per-source expandable raw response panels for multi-source enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "42 abuse confidence",
          rawVendorJson: '{"data":{"abuseConfidenceScore":42}}',
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "2 threat pulses",
          rawVendorJson: '{"pulse_info":{"count":2}}',
        },
      ],
    });

    expect(
      panel.querySelectorAll(`.${HOVER_CARD_RAW_JSON_CLASS}`)
    ).toHaveLength(2);
    expect(panel.textContent).toContain("abuseConfidenceScore");
    expect(panel.textContent).toContain("pulse_info");
  });

  it("shows rate-limit backoff message and retry hint", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "rate_limited",
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 120 seconds.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    const hint = panel.querySelector(`.${HOVER_CARD_RETRY_HINT_CLASS}`);
    expect(hint?.textContent).toBe("Retry after 120 seconds.");
  });

  it("removes the panel on hide", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    showHoverCardNearAnchor(anchor, {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
    });
    hideHoverCard();
    expect(
      document.getElementById(HOVER_CARD_HOST_ID)?.childElementCount
    ).toBe(0);
  });

  it("renders an analyst notes field on the overlay", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    const notesSection = panel.querySelector(`.${HOVER_CARD_ANALYST_NOTES_CLASS}`);
    const notesInput = panel.querySelector(
      `.${HOVER_CARD_ANALYST_NOTES_INPUT_CLASS}`
    ) as HTMLTextAreaElement | null;

    expect(notesSection).not.toBeNull();
    expect(notesInput).not.toBeNull();
    expect(notesInput?.value).toBe("");
  });

  it("keeps Investigation casework drawers collapsed in the requested order", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Observed 8.8.8.8 in the page.",
    });

    const caseworkDetails = Array.from(
      panel.querySelectorAll<HTMLDetailsElement>(
        "details.vera5-hover-card-casework-details"
      )
    );
    const summaries = caseworkDetails.map(
      (details) => details.querySelector(":scope > summary")?.textContent
    );

    expect(caseworkDetails).toHaveLength(3);
    expect(caseworkDetails.every((details) => details.open === false)).toBe(true);
    expect(summaries).toEqual(["Analyst notes", "Notebook", "Why detected?"]);
    expect(
      caseworkDetails[0]?.closest(".vera5-hover-card-export-investigation")
    ).not.toBeNull();
    expect(
      caseworkDetails[1]?.parentElement?.classList.contains(
        "vera5-hover-card-export-notes-body"
      )
    ).toBe(true);
    expect(
      caseworkDetails[2]?.parentElement?.classList.contains(
        "vera5-hover-card-export-notes-body"
      )
    ).toBe(true);
  });

  it("keeps per-IOC analyst notes when the overlay rebuilds", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    const basePayload = {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading" as const,
    };

    showHoverCardNearAnchor(anchor, basePayload);
    setSessionAnalystNote("8.8.8.8", "Review firewall logs.");

    const rebuilt = showHoverCardNearAnchor(anchor, {
      ...basePayload,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    const notesInput = rebuilt.querySelector(
      `.${HOVER_CARD_ANALYST_NOTES_INPUT_CLASS}`
    ) as HTMLTextAreaElement | null;

    expect(notesInput?.value).toBe("Review firewall logs.");
    expect(getSessionAnalystNote("8.8.8.8")).toBe("Review firewall logs.");
  });

  it("renders centered intel summary and sources section headings", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      disabledSources: [ENRICHMENT_SOURCE.OTX],
    });

    const headings = [...panel.querySelectorAll(".vera5-hover-card-section-heading")].map(
      (heading) => heading.textContent
    );
    const sourceDrawer = [
      ...panel.querySelectorAll<HTMLDetailsElement>(
        `:scope > details.${HOVER_CARD_MORE_CLASS}`
      ),
    ].find(
      (details) =>
        details.querySelector(":scope > summary")?.textContent === "Intel Sources"
    );
    const exportGroup = panel.querySelector(`.${HOVER_CARD_MORE_GROUP_CLASS}`);

    expect(headings).toContain("Intel Summary");
    expect(headings).toContain("Pivots [Redirect to Intel Sites]");
    expect(sourceDrawer).toBeDefined();
    expect(panel.textContent).not.toContain("Extra Intel");
    expect([...panel.children].indexOf(sourceDrawer!)).toBeLessThan(
      [...panel.children].indexOf(exportGroup!)
    );
  });

  it("renders export and copy dropdown actions on the overlay", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const exportSection = panel.querySelector(`.${HOVER_CARD_EXPORT_SECTION_CLASS}`);
    const intelSection = panel.querySelector(`.${HOVER_CARD_INTEL_SUMMARY_CLASS}`);
    const dropdowns = intelSection?.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    );
    const dropdownTriggers = intelSection?.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS} .${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    );
    const templates = exportSection?.querySelector(
      ".vera5-hover-card-export-templates"
    ) as HTMLDetailsElement | null;
    const investigation = templates?.querySelector(
      ".vera5-hover-card-export-investigation"
    ) as HTMLDetailsElement | null;
    const notesBody = templates?.querySelector(
      ".vera5-hover-card-export-notes-body"
    );
    const directDrawerSummaries = Array.from(
      notesBody?.children ?? []
    ).map((element) =>
      element.querySelector(":scope > summary")?.textContent
    );

    expect(exportSection).not.toBeNull();
    expect(dropdowns).toHaveLength(2);
    expect(dropdownTriggers).toHaveLength(2);
    expect(dropdownTriggers?.[0]?.textContent).toBe("Export");
    expect(dropdownTriggers?.[1]?.textContent).toBe("Copy");
    expect(
      exportSection?.querySelector(`.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`)
    ).toBeNull();
    expect(
      intelSection?.querySelector(".vera5-hover-card-intel-export-actions")
    ).not.toBeNull();
    expect(templates?.open).toBe(false);
    expect(templates?.querySelector("summary")?.textContent).toBe(
      HOVER_CARD_EXPORT_TEMPLATES_SUMMARY
    );
    expect(
      investigation?.querySelector(".vera5-hover-card-ioc-label")
    ).not.toBeNull();
    expect(
      templates?.querySelector(
        `.vera5-hover-card-export-notes-body .${HOVER_CARD_IOC_PIN_BUTTON_CLASS}`
      )
    ).not.toBeNull();
    expect(investigation?.open).toBe(false);
    expect(investigation?.querySelector(":scope > summary")?.textContent).toBe(
      "Investigation"
    );
    expect(
      investigation?.querySelector(
        'details[data-vera5-casework="analyst-notes"]'
      )
    ).not.toBeNull();
    expect(directDrawerSummaries).toEqual([
      "Investigation",
      "Notebook",
      "Why detected?",
    ]);
    expect(templates?.textContent).not.toContain("Extra Intel");
    expect(panel.querySelector(":scope > .vera5-hover-card-ioc-label")).toBeNull();
    const identity = panel.querySelector(".vera5-hover-card-identity");
    expect(identity).not.toBeNull();
    expect(identity?.querySelector(`.${HOVER_CARD_IOC_PIN_BUTTON_CLASS}`)).toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-lens-brand")?.textContent
    ).toBe("VERA5");
    expect(
      panel.querySelector(".vera5-hover-card-lens-label")?.textContent
    ).toBe("Analyst Lens");
    expect(panel.querySelector(".vera5-hover-card-lens-trust")).toBeNull();
  });

  it("renders scan list copy actions in the copy dropdown and enabled template controls", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const exportDropdown = panel.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    )[0];
    const exportTrigger = exportDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    exportTrigger?.click();
    const exportMenuLabels = Array.from(
      exportDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ??
        []
    ).map((item) => item.textContent);

    const copyDropdown = panel.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    )[1];
    const copyTrigger = copyDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    copyTrigger?.click();

    const menuLabels = Array.from(
      copyDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ?? []
    ).map((item) => item.textContent);
    openHoverCardExportTemplates(panel);
    const templateSelect = panel.querySelector(
      `#${HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID}`
    ) as HTMLSelectElement | null;
    const flatCopyAllButton = Array.from(
      panel.querySelectorAll(`.${HOVER_CARD_EXPORT_BUTTON_CLASS}`)
    ).find((button) => button.textContent === "Copy all");

    expect(exportMenuLabels).toContain("Export filtered Markdown");
    expect(exportMenuLabels).toContain("Export filtered JSON");
    expect(menuLabels).toContain("Copy all");
    expect(menuLabels).toContain("Copy filtered");
    expect(menuLabels).toContain("Copy filtered Markdown");
    expect(menuLabels).toContain("Copy filtered JSON");
    expect(flatCopyAllButton).toBeUndefined();
    expect(templateSelect?.disabled).toBe(false);
    expect(
      Array.from(panel.querySelectorAll(`.${HOVER_CARD_EXPORT_BUTTON_CLASS}`)).map(
        (button) => button.textContent
      )
    ).toEqual(
      expect.arrayContaining(["Export template", "Copy template"])
    );
    expect(
      panel.querySelectorAll(
        ".vera5-hover-card-scan-export-template-actions .vera5-hover-card-export-button"
      )
    ).toHaveLength(2);
  });

  it("copies all indicators when Copy all is clicked", async () => {
    const scanSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [
          { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
          { type: "ipv4", value: "192.0.2.1", anchorId: "vera5-hl-2" },
        ],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      scanSummary
    );
    vi.spyOn(tabScanSnapshotStorage, "getTabScanTrayFilter").mockResolvedValue("all");
    const copyAll = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    const copyDropdown = panel.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    )[1];
    const copyTrigger = copyDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    copyTrigger?.click();
    const copyAllMenuItem = Array.from(
      copyDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ?? []
    ).find((item) => item.textContent === "Copy all") as HTMLButtonElement | undefined;
    copyAllMenuItem?.click();

    await vi.waitFor(() => {
      expect(copyAll).toHaveBeenCalledWith("8.8.8.8\n192.0.2.1");
    });
  });

  it("copies markdown from the copy dropdown menu", async () => {
    const copyMarkdown = vi
      .spyOn(enrichmentExport, "copyEnrichmentExportMarkdownToClipboard")
      .mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    const copyDropdown = panel.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    )[1];
    const copyTrigger = copyDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    copyTrigger?.click();

    const menuItem = Array.from(
      copyDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ?? []
    ).find((item) => item.textContent === "Copy Markdown") as HTMLButtonElement | null;
    menuItem?.click();

    await vi.waitFor(() => {
      expect(copyMarkdown).toHaveBeenCalledTimes(1);
    });
    expect(copyMarkdown.mock.calls[0]?.[0]).toMatchObject({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
    });

    copyMarkdown.mockRestore();
  });

  it("downloads template export when Export template is clicked after scan cache warms", async () => {
    const scanSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [
          { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
          { type: "ipv4", value: "192.0.2.1", anchorId: "vera5-hl-2" },
        ],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      scanSummary
    );
    vi.spyOn(tabScanSnapshotStorage, "getTabScanTrayFilter").mockResolvedValue("all");
    const records = [
      buildNormalizedEnrichmentRecord({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
      }),
      buildNormalizedEnrichmentRecord({
        value: "192.0.2.1",
        iocType: IOC_TYPE.IPV4,
      }),
    ];
    const buildRecords = vi
      .spyOn(tabScanSummary, "buildTraySubsetEnrichmentRecords")
      .mockResolvedValue(records);
    const download = vi
      .spyOn(exportTemplates, "downloadTrayTemplateExportFile")
      .mockImplementation(() => undefined);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(buildRecords).toHaveBeenCalled();
    });

    openHoverCardExportTemplates(panel);
    const templateSelect = panel.querySelector(
      `#${HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID}`
    ) as HTMLSelectElement | null;
    templateSelect!.value = "jira-comment";

    const exportTemplateButton = Array.from(
      panel.querySelectorAll(`.${HOVER_CARD_EXPORT_BUTTON_CLASS}`)
    ).find((button) => button.textContent === "Export template") as
      | HTMLButtonElement
      | undefined;
    exportTemplateButton?.click();

    await vi.waitFor(() => {
      expect(download).toHaveBeenCalledWith("jira-comment", records, document);
    });

    buildRecords.mockRestore();
    download.mockRestore();
  });

  it("exports filtered markdown through the template engine after scan cache warms", async () => {
    setCachedPageContextType(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    const scanSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      scanSummary
    );
    vi.spyOn(tabScanSnapshotStorage, "getTabScanTrayFilter").mockResolvedValue("all");
    const records = [
      buildNormalizedEnrichmentRecord({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
      }),
    ];
    vi.spyOn(tabScanSummary, "buildTraySubsetEnrichmentRecords").mockResolvedValue(
      records
    );
    const download = vi
      .spyOn(exportTemplates, "downloadTrayTemplateExportFile")
      .mockImplementation(() => undefined);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(tabScanSummary.buildTraySubsetEnrichmentRecords).toHaveBeenCalled();
    });

    const exportDropdown = panel.querySelectorAll(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    )[0];
    const exportTrigger = exportDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    exportTrigger?.click();
    const exportMarkdownItem = Array.from(
      exportDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ??
        []
    ).find(
      (item) => item.textContent === "Export filtered Markdown"
    ) as HTMLButtonElement | undefined;
    exportMarkdownItem?.click();

    await vi.waitFor(() => {
      expect(download).toHaveBeenCalledWith("jira-comment", records, document);
    });

    download.mockRestore();
  });

  it("copies the selected template after scan cache warms", async () => {
    const scanSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      scanSummary
    );
    vi.spyOn(tabScanSnapshotStorage, "getTabScanTrayFilter").mockResolvedValue("all");
    const records = [
      buildNormalizedEnrichmentRecord({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
      }),
    ];
    vi.spyOn(tabScanSummary, "buildTraySubsetEnrichmentRecords").mockResolvedValue(
      records
    );
    const copyTemplate = vi
      .spyOn(exportTemplates, "copyTrayTemplateExportToClipboard")
      .mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await vi.waitFor(() => {
      expect(tabScanSummary.buildTraySubsetEnrichmentRecords).toHaveBeenCalled();
    });

    openHoverCardExportTemplates(panel);
    const templateSelect = panel.querySelector(
      `#${HOVER_CARD_SCAN_EXPORT_TEMPLATE_SELECT_ID}`
    ) as HTMLSelectElement | null;
    templateSelect!.value = "thehive-case-note";

    const copyTemplateButton = Array.from(
      panel.querySelectorAll(`.${HOVER_CARD_EXPORT_BUTTON_CLASS}`)
    ).find((button) => button.textContent === "Copy template") as
      | HTMLButtonElement
      | undefined;
    copyTemplateButton?.click();

    await vi.waitFor(() => {
      expect(copyTemplate).toHaveBeenCalledWith("thehive-case-note", records);
    });

    copyTemplate.mockRestore();
  });

  it("downloads markdown from the export dropdown menu", () => {
    const download = vi
      .spyOn(enrichmentExport, "downloadEnrichmentExportFile")
      .mockImplementation(() => undefined);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    const exportDropdown = panel.querySelector(
      `.${HOVER_CARD_EXPORT_DROPDOWN_CLASS}`
    );
    const exportTrigger = exportDropdown?.querySelector(
      `.${HOVER_CARD_EXPORT_BUTTON_CLASS}`
    ) as HTMLButtonElement | null;
    exportTrigger?.click();

    const exportMarkdownItem = Array.from(
      exportDropdown?.querySelectorAll(`.${HOVER_CARD_EXPORT_DROPDOWN_ITEM_CLASS}`) ??
        []
    ).find((item) => item.textContent === "Export Markdown") as
      | HTMLButtonElement
      | undefined;
    exportMarkdownItem?.click();

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        ioc: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
      }),
      "markdown",
      document
    );

    download.mockRestore();
  });

  it("includes analyst notes in export record built from overlay payload", () => {
    setSessionAnalystNote("8.8.8.8", "Escalate to IR.");

    const record = buildExportRecordFromPayload({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    expect(record.analystNotes).toBe("Escalate to IR.");
  });

  it("preserves analyst notes focus when the note is updated in place", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const notesInput = panel.querySelector(
      `.${HOVER_CARD_ANALYST_NOTES_INPUT_CLASS}`
    ) as HTMLTextAreaElement | null;
    expect(notesInput).not.toBeNull();

    notesInput!.focus();
    notesInput!.value = "te";
    notesInput!.setSelectionRange(2, 2);

    updateHoverCardAnalystNoteIfOpen("8.8.8.8", "test");

    expect(notesInput!.value).toBe("test");
    expect(document.activeElement).toBe(notesInput);
    expect(notesInput!.selectionStart).toBe(2);
  });

  it("does not rebuild the overlay when session already matches persisted note", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const notesInput = panel.querySelector(
      `.${HOVER_CARD_ANALYST_NOTES_INPUT_CLASS}`
    ) as HTMLTextAreaElement | null;
    notesInput!.focus();
    setSessionAnalystNote("8.8.8.8", "a");

    updateHoverCardAnalystNoteIfOpen("8.8.8.8", "a");

    expect(document.activeElement).toBe(notesInput);
    expect(notesInput!.value).toBe("a");
  });
});

describe("hover card keyboard focus", () => {
  afterEach(() => {
    hideHoverCard(document);
    document.body.replaceChildren();
  });

  it("focusFirstHoverCardControl focuses the visible header copy control", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    document.body.appendChild(panel);

    const copyButton = panel.querySelector<HTMLElement>(
      `.${HOVER_CARD_COPY_BUTTON_CLASS}`
    );
    expect(copyButton).not.toBeNull();

    const focused = focusFirstHoverCardControl(panel);
    expect(focused).toBe(true);
    expect(document.activeElement).toBe(copyButton);
  });

  it("showHoverCardNearAnchor moves focus when moveFocus is set", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(
      anchor,
      { value: "8.8.8.8", type: IOC_TYPE.IPV4 },
      document,
      { moveFocus: true }
    );

    const copyButton = panel.querySelector<HTMLElement>(
      `.${HOVER_CARD_COPY_BUTTON_CLASS}`
    );
    expect(document.activeElement).toBe(copyButton);
  });
});

describe("pre-query disclosure section", () => {
  it("renders vendor query notice with send, cancel, and remember actions", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "empty",
      preQueryDisclosure: {
        sourceIds: ["abuseipdb"],
      },
    });

    expect(panel.textContent).toContain(
      "Vera5 will query AbuseIPDB with this IPv4 address: 8.8.8.8"
    );
    expect(panel.querySelector(".vera5-pre-query-disclosure")).not.toBeNull();
    expect(panel.textContent).toContain("Before querying vendors");
    expect(panel.textContent).toContain("Send query");
    expect(panel.textContent).toContain("Cancel");
    expect(panel.textContent).toContain("Don't show this notice again");
  });

  it("renders multi-vendor disclosure copy when multiple sources are listed", () => {
    const panel = buildHoverCardPanel({
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
      enrichmentState: "empty",
      preQueryDisclosure: {
        sourceIds: ["abuseipdb", "otx"],
      },
    });

    expect(panel.textContent).toContain(
      "Vera5 will query AbuseIPDB and OTX with this Domain: example.com"
    );
    expect(panel.querySelector(".vera5-pre-query-disclosure")).not.toBeNull();
  });

  it("omits disclosure when preQueryDisclosure is not set", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "empty",
    });

    expect(panel.querySelector(".vera5-pre-query-disclosure")).toBeNull();
    expect(panel.textContent).not.toContain("Vera5 will query");
  });
});

describe("hover card save to collection", () => {
  const sampleCollection = createIocCollection({
    id: "vera5-col-hover-test",
    name: "Qakbot Investigation",
    createdAt: 100,
    updatedAt: 100,
    members: [],
  })!;

  afterEach(() => {
    resetHoverCardSaveToCollectionStateForTests();
    hideHoverCard(document);
    vi.unstubAllGlobals();
  });

  it("opens picker and saves the current indicator to an existing collection", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async (message: { type?: string; collectionId?: string }) => {
          if (message?.type === MESSAGE.LIST_IOC_COLLECTIONS) {
            return { ok: true, payload: { collections: [sampleCollection] } };
          }
          if (message?.type === MESSAGE.ADD_IOC_TO_COLLECTION) {
            return {
              ok: true,
              payload: {
                collection: {
                  ...sampleCollection,
                  members: [{ iocType: "ipv4", value: "8.8.8.8" }],
                  updatedAt: 200,
                },
                added: true,
              },
            };
          }
          return { ok: true };
        }),
      },
    });

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const readPanel = (): HTMLElement => {
      const host = document.getElementById(HOVER_CARD_HOST_ID);
      expect(host?.firstElementChild).toBeInstanceOf(HTMLElement);
      return host!.firstElementChild as HTMLElement;
    };

    let panel = readPanel();
    const toggle = panel.querySelector<HTMLButtonElement>(
      `.${HOVER_CARD_SAVE_TO_COLLECTION_TOGGLE_CLASS}`
    );
    expect(toggle?.textContent).toBe("Save to collection…");
    const analystNotesDetails = toggle?.closest<HTMLDetailsElement>(
      'details[data-vera5-casework="analyst-notes"]'
    );
    expect(analystNotesDetails).not.toBeNull();
    expect(analystNotesDetails?.open).toBe(false);
    const investigationDetails = analystNotesDetails?.closest<HTMLDetailsElement>(
      ".vera5-hover-card-export-investigation"
    );
    expect(investigationDetails).not.toBeNull();
    investigationDetails!.open = true;
    analystNotesDetails!.open = true;
    toggle!.click();

    await vi.waitFor(() => {
      panel = readPanel();
      expect(panel.textContent).toContain("Qakbot Investigation");
      expect(
        panel.querySelector<HTMLDetailsElement>(
          'details[data-vera5-casework="analyst-notes"]'
        )?.open
      ).toBe(true);
      expect(
        panel.querySelector<HTMLDetailsElement>(
          ".vera5-hover-card-export-investigation"
        )?.open
      ).toBe(true);
      expect(
        panel.querySelector<HTMLDetailsElement>(
          ".vera5-hover-card-export-templates"
        )?.open
      ).toBe(true);
    });

    const collectionButton = [...panel.querySelectorAll<HTMLButtonElement>(
      `.${HOVER_CARD_ACTION_CLASS}`
    )].find((button) => button.textContent === "Qakbot Investigation");
    expect(collectionButton).toBeDefined();
    collectionButton!.click();

    await vi.waitFor(() => {
      panel = readPanel();
      expect(panel.textContent).toContain("Saved to Qakbot Investigation.");
    });
  });
});

describe("local LLM summary controls", () => {
  afterEach(() => {
    setCachedLocalLlmSummaryEnabledForTests(false);
    setCachedLocalBackendEnabledForTests(false);
    resetHoverCardLocalLlmSummaryStateForTests();
    hideHoverCard();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hides generate summary controls when the global toggle is off", () => {
    setCachedLocalLlmSummaryEnabledForTests(false);

    const panel = buildHoverCardPanel(readyHoverCardPayload());

    expect(panel.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS}`)).toBeNull();
  });

  it("does not invoke resolveLocalLlmSummaryRequest when the global toggle is off", async () => {
    setCachedLocalLlmSummaryEnabledForTests(false);
    const requestSpy = vi
      .spyOn(aiSummaryService, "resolveLocalLlmSummaryRequest")
      .mockResolvedValue({ ok: true, markdown: "ignored" });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await runHoverCardLocalLlmSummaryGenerationForTests(readyHoverCardPayload());

    expect(requestSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call localhost fetch when generate summary is blocked by the toggle", async () => {
    setCachedLocalLlmSummaryEnabledForTests(false);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, readyHoverCardPayload());

    await runHoverCardLocalLlmSummaryGenerationForTests(readyHoverCardPayload());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows generate summary for ready enrichment when the global toggle is on", () => {
    setCachedLocalLlmSummaryEnabledForTests(true);

    const panel = buildHoverCardPanel(readyHoverCardPayload());
    const summarySection = panel.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS}`);
    const button = summarySection?.querySelector("button");

    expect(
      summarySection
        ?.closest('details[data-vera5-casework="why-detected"]')
        ?.querySelector(":scope > summary")?.textContent
    ).toBe("Why detected?");
    expect(summarySection?.getAttribute("aria-label")).toBe(
      HOVER_CARD_LOCAL_LLM_SUMMARY_HEADING
    );
    expect(button?.textContent).toBe(HOVER_CARD_GENERATE_SUMMARY_LABEL);
    expect((button as HTMLButtonElement | undefined)?.disabled).toBe(false);
  });

  it("keeps the AI summary panel separate from risk score and explain chain", () => {
    setCachedLocalLlmSummaryEnabledForTests(true);

    const panel = buildHoverCardPanel({
      ...readyHoverCardPayload(),
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: "ok",
          summary: "4 threat pulses",
        },
      ]),
    });

    const intelSection = panel.querySelector(`.${HOVER_CARD_INTEL_SUMMARY_CLASS}`);
    const summarySection = panel.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS}`);
    const riskScore = panel.querySelector(`.${HOVER_CARD_RISK_SCORE_CLASS}`);
    const reasoning = panel.querySelector(`.${HOVER_CARD_RISK_REASONING_CLASS}`);
    const moreGroup = panel.querySelector(`.${HOVER_CARD_MORE_GROUP_CLASS}`);

    expect(intelSection?.contains(riskScore)).toBe(true);
    expect(intelSection?.contains(reasoning)).toBe(true);
    expect(intelSection?.contains(summarySection)).toBe(false);
    expect(moreGroup?.contains(summarySection)).toBe(true);

    const panelChildren = [...panel.children];
    expect(panelChildren.indexOf(moreGroup!)).toBeGreaterThan(
      panelChildren.indexOf(intelSection!)
    );
  });

  it("disables generate summary while enrichment is loading", () => {
    setCachedLocalLlmSummaryEnabledForTests(true);

    const panel = buildHoverCardPanel({
      ...readyHoverCardPayload(),
      enrichmentState: "loading",
    });
    const button = panel.querySelector(
      `.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS} button`
    ) as HTMLButtonElement | null;

    expect(button?.disabled).toBe(true);
  });

  it("shows loading and success states after generate summary", async () => {
    setCachedLocalLlmSummaryEnabledForTests(true);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: groundedLocalLlmSummaryMarkdown() } }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    const panel = showHoverCardNearAnchor(anchor, readyHoverCardPayload());
    const button = panel.querySelector(
      `.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS} button`
    ) as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const currentPanel = document.querySelector(
        `.${HOVER_CARD_PANEL_CLASS}`
      ) as HTMLElement | null;
      expect(
        currentPanel?.querySelector(
          `.${HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS}.vera5-hover-card-local-llm-summary-status--loading`
        )?.textContent
      ).toBe(HOVER_CARD_GENERATE_SUMMARY_LOADING_LABEL);
    });

    await vi.waitFor(() => {
      const currentPanel = document.querySelector(
        `.${HOVER_CARD_PANEL_CLASS}`
      ) as HTMLElement | null;
      expect(
        currentPanel?.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_BODY_CLASS}`)
          ?.textContent
      ).toBe(groundedLocalLlmSummaryMarkdown());
      expect(currentPanel?.textContent).toContain(
        HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER
      );
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("surfaces summary service errors on the hover card", async () => {
    setCachedLocalLlmSummaryEnabledForTests(true);
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ECONNREFUSED" } });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(error));

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    const panel = showHoverCardNearAnchor(anchor, readyHoverCardPayload());
    const button = panel.querySelector(
      `.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS} button`
    ) as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const currentPanel = document.querySelector(
        `.${HOVER_CARD_PANEL_CLASS}`
      ) as HTMLElement | null;
      expect(
        currentPanel?.querySelector(
          `.${HOVER_CARD_LOCAL_LLM_SUMMARY_STATUS_CLASS}.vera5-hover-card-local-llm-summary-status--error`
        )?.textContent
      ).toBe("Local LLM endpoint refused the connection on 127.0.0.1.");
    });
  });

  it("uses the backend summarize route with the same disclaimer UX when local backend is enabled", async () => {
    setCachedLocalLlmSummaryEnabledForTests(true);
    setCachedLocalBackendEnabledForTests(true);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ok: true,
        markdown: groundedLocalLlmSummaryMarkdown(),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    const panel = showHoverCardNearAnchor(anchor, readyHoverCardPayload());
    const button = panel.querySelector(
      `.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS} button`
    ) as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const currentPanel = document.querySelector(
        `.${HOVER_CARD_PANEL_CLASS}`
      ) as HTMLElement | null;
      expect(
        currentPanel?.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_BODY_CLASS}`)
          ?.textContent
      ).toBe(groundedLocalLlmSummaryMarkdown());
      expect(currentPanel?.textContent).toContain(
        HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER
      );
      expect(
        currentPanel
          ?.querySelector(`.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS}`)
          ?.closest('details[data-vera5-casework="why-detected"]')
          ?.querySelector(":scope > summary")?.textContent
      ).toBe("Why detected?");
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(buildLocalBackendSummarizeUrl());
  });

  it("falls back to direct local LLM with the same disclaimer UX when backend summarize is unreachable", async () => {
    setCachedLocalLlmSummaryEnabledForTests(true);
    setCachedLocalBackendEnabledForTests(true);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: groundedLocalLlmSummaryMarkdown() } }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    const panel = showHoverCardNearAnchor(anchor, readyHoverCardPayload());
    const button = panel.querySelector(
      `.${HOVER_CARD_LOCAL_LLM_SUMMARY_CLASS} button`
    ) as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const currentPanel = document.querySelector(
        `.${HOVER_CARD_PANEL_CLASS}`
      ) as HTMLElement | null;
      expect(currentPanel?.textContent).toContain(
        HOVER_CARD_LOCAL_LLM_SUMMARY_DISCLAIMER
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(buildLocalBackendSummarizeUrl());
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      aiSummaryService.DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT
    );
  });
});
