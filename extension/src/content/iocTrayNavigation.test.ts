/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import { setAutoEnrichmentFetcherForTests } from "./enrichmentAutoFetch";
import { scanTextNodesForIocs } from "./detector";
import { clearIocHighlights, highlightDetectedIocs } from "./highlighter";
import { HOVER_CARD_HOST_ID, HOVER_CARD_PANEL_CLASS } from "./hoverCardOverlay";
import {
  handleNavigateToIocAnchorRequest,
  isNavigateToIocAnchorMessage,
} from "./iocTrayNavigation";

function stubContentChrome(): void {
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
}

describe("iocTrayNavigation", () => {
  beforeEach(() => {
    stubContentChrome();
    setAutoEnrichmentFetcherForTests(null);
    document.body.replaceChildren();
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    clearIocHighlights(document.body);
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
    vi.unstubAllGlobals();
  });

  it("validates navigate-to-anchor messages", () => {
    expect(
      isNavigateToIocAnchorMessage({
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: "vera5-hl-1",
      })
    ).toBe(true);
    expect(
      isNavigateToIocAnchorMessage({
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: "",
      })
    ).toBe(false);
  });

  it("scrolls to the highlight and opens the hover card", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 today.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });

    const highlight = document.querySelector<HTMLElement>("[data-vera5-anchor-id]");
    expect(highlight).not.toBeNull();
    const anchorId = highlight?.dataset.vera5AnchorId;
    expect(anchorId).toBeTruthy();

    const scrollIntoView = vi.spyOn(highlight!, "scrollIntoView");
    const response = handleNavigateToIocAnchorRequest(anchorId!);

    expect(response).toEqual({ ok: true });
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });

    await vi.waitFor(() => {
      expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
    });
  });

  it("returns an error when the highlight anchor is missing", () => {
    expect(handleNavigateToIocAnchorRequest("missing-anchor")).toEqual({
      ok: false,
      error: "highlight not found",
    });
  });
});
