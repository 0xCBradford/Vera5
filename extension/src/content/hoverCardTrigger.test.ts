/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";import { IOC_TYPE } from "../lib/iocRegex";
import {
  CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  createDefaultEnrichmentSourceEnabledMap,
  listDisabledEnrichmentSourceIds,
  listEnabledEnrichmentSourceIds,
} from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import * as enrichmentBackgroundFetch from "./enrichmentBackgroundFetch";
import {
  setAutoEnrichmentFetcherForTests,
} from "./enrichmentAutoFetch";
import { scanTextNodesForIocs } from "./detector";
import {
  clearIocHighlights,
  highlightDetectedIocs,
  IOC_ENRICH_ICON_CLASS,
  IOC_HIGHLIGHT_CLASS,
} from "./highlighter";
import {
  HOVER_CARD_ANALYST_NOTES_INPUT_CLASS,
  HOVER_CARD_HOST_ID,
  HOVER_CARD_IOC_PIN_BUTTON_CLASS,
  HOVER_CARD_PANEL_CLASS,
} from "./hoverCardOverlay";
import {
  buildHoverCardPayloadFromHighlight,
  openHoverCardForHighlight,
  resolveIocHighlight,
  setupHoverCardTrigger,
} from "./hoverCardTrigger";

vi.mock("./enrichmentSourceStorage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentSourceStorage")>();
  return {
    ...actual,
    loadWorkspaceEnrichmentSourceContext: vi.fn(async () => {
      const sources = createDefaultEnrichmentSourceEnabledMap();
      return {
        sources,
        showDisabledSourcesInWorkspace: true,
        disabledSourceIds: listDisabledEnrichmentSourceIds(sources, true),
        enabledSourceIds: listEnabledEnrichmentSourceIds(sources),
      };
    }),
  };
});

function stubManualOnlyStorage(manualOnly: boolean): void {
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
              result[key] = manualOnly;
            }
          }
          return Promise.resolve(result);
        },
      },
    },
  });
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
  return wrapper;
}

describe("hover card manual enrich trigger", () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    stubManualOnlyStorage(true);
    setAutoEnrichmentFetcherForTests(null);
    document.body.replaceChildren();
    teardown = setupHoverCardTrigger(document);
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    setAutoEnrichmentFetcherForTests(null);
    clearIocHighlights(document.body);
    document.getElementById(HOVER_CARD_HOST_ID)?.replaceChildren();
    vi.unstubAllGlobals();
  });

  function mountHighlightedIpv4(): HTMLSpanElement {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 for details.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    const highlight = document.querySelector<HTMLSpanElement>(
      `.${IOC_HIGHLIGHT_CLASS}`
    );
    if (!highlight) {
      throw new Error("expected a highlighted IOC");
    }
    return highlight;
  }

  it("buildHoverCardPayloadFromHighlight exposes match provenance", () => {
    const highlight = mountHighlightedIpv4();
    expect(buildHoverCardPayloadFromHighlight(highlight)).toEqual({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Contact 8.8.8.8 for details.",
      ignoredOverlaps: [],
      enrichmentState: "empty",
    });
  });

  it("buildHoverCardPayloadFromHighlight preserves defanged displayValue", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Ticket hxxps://example[.]com/evil";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    const highlight = document.querySelector<HTMLSpanElement>(
      `.${IOC_HIGHLIGHT_CLASS}`
    );
    if (!highlight) {
      throw new Error("expected a highlighted IOC");
    }

    expect(buildHoverCardPayloadFromHighlight(highlight)).toEqual({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: "Ticket hxxps://example[.]com/evil",
      ignoredOverlaps: [],
      enrichmentState: "empty",
    });
  });

  function mountMultipleHighlightedIpv4(): HTMLSpanElement[] {
    const paragraph = document.createElement("p");
    paragraph.textContent = "IPs 8.8.8.8 and 192.0.2.1 here.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    const highlights = Array.from(
      document.querySelectorAll<HTMLSpanElement>(`.${IOC_HIGHLIGHT_CLASS}`)
    );
    if (highlights.length < 2) {
      throw new Error("expected multiple highlighted IOCs");
    }
    return highlights;
  }

  it("resolves highlighted IOC metadata from click targets", () => {
    const highlight = mountHighlightedIpv4();
    const icon = highlight.querySelector(`.${IOC_ENRICH_ICON_CLASS}`);
    expect(icon).not.toBeNull();
    expect(resolveIocHighlight(icon)).toBe(highlight);
    expect(highlight.getAttribute("role")).toBe("button");
  });

  it("opens the hover card when a highlight is clicked", async () => {
    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("8.8.8.8");
    expect(panel?.textContent).toContain("IPv4 address");
  });

  it("shows disabled sources on the hover card when sources are off", async () => {
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
                  ...createDefaultEnrichmentSourceEnabledMap(),
                  otx: true,
                };
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });

    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("AbuseIPDB");
    expect(panel?.textContent).toContain("disabled");
  });

  it("opens the hover card from the enrich icon", async () => {
    const highlight = mountHighlightedIpv4();
    const icon = highlight.querySelector(`.${IOC_ENRICH_ICON_CLASS}`);
    icon?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
  });

  it("opens the hover card when Enter is pressed on a highlight", async () => {
    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    await flushAsyncWork();

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
  });

  it("moves focus into the hover card when opened from the keyboard", async () => {
    const highlight = mountHighlightedIpv4();
    highlight.focus();
    highlight.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    await flushAsyncWork();

    const pinButton = document.querySelector<HTMLElement>(
      `.${HOVER_CARD_IOC_PIN_BUTTON_CLASS}`
    );
    expect(pinButton).not.toBeNull();
    expect(document.activeElement).toBe(pinButton);
  });

  it("opens the hover card when Space is pressed on a highlight", async () => {
    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true })
    );

    await flushAsyncWork();

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
  });

  it("returns focus to the highlight when Escape closes a keyboard-opened card", async () => {
    const highlight = mountHighlightedIpv4();
    highlight.focus();
    highlight.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    await flushAsyncWork();
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();
    expect(document.activeElement).toBe(highlight);
  });

  it("does not auto-fetch enrichment when manual-only mode is on", async () => {
    const fetcher = vi.fn();
    const runSpy = vi
      .spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment")
      .mockResolvedValue(undefined);
    setAutoEnrichmentFetcherForTests(fetcher);

    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    expect(fetcher).not.toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
    runSpy.mockRestore();
  });

  it("requests live enrichment with bypassCache when the enrich icon is clicked", async () => {
    const runSpy = vi
      .spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment")
      .mockResolvedValue(undefined);
    const cancelSpy = vi
      .spyOn(enrichmentBackgroundFetch, "cancelPendingHoverEnrichment")
      .mockImplementation(() => {});

    const highlight = mountHighlightedIpv4();
    const icon = highlight.querySelector(`.${IOC_ENRICH_ICON_CLASS}`);
    icon?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    expect(cancelSpy).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      }),
      document,
      { bypassCache: true }
    );

    runSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it("still requests bypassCache refresh from the enrich icon when manual-only mode is off", async () => {
    stubManualOnlyStorage(false);
    const runSpy = vi
      .spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment")
      .mockResolvedValue(undefined);

    const highlight = mountHighlightedIpv4();
    const icon = highlight.querySelector(`.${IOC_ENRICH_ICON_CLASS}`);
    icon?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    await flushAsyncWork();

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      }),
      document,
      { bypassCache: true }
    );
    runSpy.mockRestore();
  });

  it("openHoverCardForHighlight passes bypassCache only for manual enrichment trigger", async () => {
    const runSpy = vi
      .spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment")
      .mockResolvedValue(undefined);
    const highlight = mountHighlightedIpv4();

    openHoverCardForHighlight(highlight, { enrichmentTrigger: "auto" });
    await flushAsyncWork();
    expect(runSpy).not.toHaveBeenCalled();

    openHoverCardForHighlight(highlight, { enrichmentTrigger: "manual" });
    await flushAsyncWork();
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      }),
      document,
      { bypassCache: true }
    );
    runSpy.mockRestore();
  });

  it("closes the hover card on Escape or outside click", async () => {
    const highlight = mountHighlightedIpv4();
    openHoverCardForHighlight(highlight);
    await flushAsyncWork();
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();

    openHoverCardForHighlight(highlight);
    await flushAsyncWork();
    document.body.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();
  });

  it("moves focus to the next highlight on ArrowDown", () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    first.focus();

    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.activeElement).toBe(second);
  });

  it("wraps to the first highlight when ArrowDown is pressed on the last highlight", () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    second.focus();

    second.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.activeElement).toBe(first);
  });

  it("focuses the first highlight when ArrowDown is pressed from the page", () => {
    const [first] = mountMultipleHighlightedIpv4();
    document.body.focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.activeElement).toBe(first);
  });

  it("closes the hover card when triage navigation moves to another highlight", async () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    openHoverCardForHighlight(first);
    await flushAsyncWork();
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();
    expect(document.activeElement).toBe(second);
  });
});

describe("keyboard navigation paths", () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    stubManualOnlyStorage(true);
    setAutoEnrichmentFetcherForTests(null);
    document.body.replaceChildren();
    teardown = setupHoverCardTrigger(document);
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    setAutoEnrichmentFetcherForTests(null);
    clearIocHighlights(document.body);
    document.getElementById(HOVER_CARD_HOST_ID)?.replaceChildren();
    vi.unstubAllGlobals();
  });

  function mountMultipleHighlightedIpv4(): HTMLSpanElement[] {
    const paragraph = document.createElement("p");
    paragraph.textContent = "IPs 8.8.8.8 and 192.0.2.1 here.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    return Array.from(
      document.querySelectorAll<HTMLSpanElement>(`.${IOC_HIGHLIGHT_CLASS}`)
    );
  }

  function mountHighlightedFixture(name: string): HTMLSpanElement[] {
    mountFixture(loadFixture(name));
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    return Array.from(
      document.querySelectorAll<HTMLSpanElement>(`.${IOC_HIGHLIGHT_CLASS}`)
    );
  }

  it("exposes keyboard-focusable highlights for triage", () => {
    const [first] = mountMultipleHighlightedIpv4();
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(first.getAttribute("role")).toBe("button");
  });

  it("moves focus to the previous highlight on ArrowUp", () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    second.focus();

    second.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );

    expect(document.activeElement).toBe(first);
  });

  it("wraps to the last highlight when ArrowUp is pressed on the first highlight", () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    first.focus();

    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );

    expect(document.activeElement).toBe(second);
  });

  it("focuses the last highlight when ArrowUp is pressed from the page", () => {
    const highlights = mountMultipleHighlightedIpv4();
    const last = highlights[highlights.length - 1];
    document.body.focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );

    expect(document.activeElement).toBe(last);
  });

  it("does not move focus into the hover card when opened with the mouse", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 for details.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    const highlight = document.querySelector<HTMLSpanElement>(
      `.${IOC_HIGHLIGHT_CLASS}`
    )!;
    highlight.focus();

    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await flushAsyncWork();

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
    expect(document.activeElement).toBe(highlight);
  });

  it("ignores ArrowDown when focus is on a non-highlight page control", () => {
    mountMultipleHighlightedIpv4();
    const button = document.createElement("button");
    button.textContent = "Filter";
    document.body.appendChild(button);
    button.focus();

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.activeElement).toBe(button);
  });

  it("does not triage-navigate while focus is inside the hover card panel", async () => {
    const [first, second] = mountMultipleHighlightedIpv4();
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await flushAsyncWork();

    const notesInput = document.querySelector<HTMLTextAreaElement>(
      `.${HOVER_CARD_ANALYST_NOTES_INPUT_CLASS}`
    );
    expect(notesInput).not.toBeNull();
    notesInput!.focus();

    notesInput!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    expect(document.activeElement).toBe(notesInput);
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
    expect(document.activeElement).not.toBe(second);
  });

  it("supports scan-to-triage-to-open on a SOC dashboard fixture", async () => {
    const highlights = mountHighlightedFixture("sample-splunk-export.html");
    expect(highlights.length).toBeGreaterThanOrEqual(3);

    document.body.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(document.activeElement).toBe(highlights[0]);

    const first = highlights[0] as HTMLSpanElement;
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(document.activeElement).toBe(highlights[1]);

    (document.activeElement as HTMLSpanElement).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await flushAsyncWork();

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
    expect(
      document.querySelector(`.${HOVER_CARD_IOC_PIN_BUTTON_CLASS}`)
    ).toBe(document.activeElement);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();
    expect(document.activeElement).toBe(highlights[1]);
  });
});
