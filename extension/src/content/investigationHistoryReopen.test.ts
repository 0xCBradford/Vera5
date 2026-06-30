/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import { setAutoEnrichmentFetcherForTests } from "./enrichmentAutoFetch";
import { scanTextNodesForIocs } from "./detector";
import { clearIocHighlights, highlightDetectedIocs } from "./highlighter";
import { HOVER_CARD_HOST_ID, HOVER_CARD_PANEL_CLASS } from "./hoverCardOverlay";
import {
  handleReopenInvestigationHistoryRequest,
  isReopenInvestigationHistoryMessage,
} from "./investigationHistoryReopen";

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

describe("investigationHistoryReopen", () => {
  beforeEach(() => {
    stubContentChrome();
    setAutoEnrichmentFetcherForTests(null);
    document.body.replaceChildren();
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { href: "https://example.com/alert" },
    });
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    clearIocHighlights(document.body);
    document.getElementById(HOVER_CARD_HOST_ID)?.remove();
    vi.unstubAllGlobals();
  });

  it("validates reopen history messages", () => {
    expect(
      isReopenInvestigationHistoryMessage({
        type: "REOPEN_INVESTIGATION_HISTORY",
        ioc: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        pageOrigin: "https://example.com",
      })
    ).toBe(true);
    expect(
      isReopenInvestigationHistoryMessage({
        type: "REOPEN_INVESTIGATION_HISTORY",
        ioc: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        pageOrigin: "",
      })
    ).toBe(false);
  });

  it("rejects reopen when page origin does not match", () => {
    const response = handleReopenInvestigationHistoryRequest({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageOrigin: "https://other.example",
    });
    expect(response).toEqual({ ok: false, error: "page origin mismatch" });
  });

  it("scrolls to the highlight and opens the hover card", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 today.";
    document.body.appendChild(paragraph);
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });

    const highlight = document.querySelector<HTMLElement>(".vera5-ioc-highlight");
    expect(highlight).not.toBeNull();
    const scrollIntoView = vi.spyOn(highlight!, "scrollIntoView");

    const response = handleReopenInvestigationHistoryRequest({
      ioc: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      pageOrigin: "https://example.com",
    });

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
});
