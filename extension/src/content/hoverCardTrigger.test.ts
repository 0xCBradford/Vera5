/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
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
import { HOVER_CARD_HOST_ID, HOVER_CARD_PANEL_CLASS } from "./hoverCardOverlay";
import {
  openHoverCardForHighlight,
  resolveIocHighlight,
  setupHoverCardTrigger,
} from "./hoverCardTrigger";

function stubManualOnlyStorage(manualOnly: boolean): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
              result[key] = manualOnly;
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
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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
                  otx: true,
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

  it("does not auto-fetch enrichment when manual-only mode is on", () => {
    const fetcher = vi.fn();
    setAutoEnrichmentFetcherForTests(fetcher);

    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    expect(fetcher).not.toHaveBeenCalled();
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
});
