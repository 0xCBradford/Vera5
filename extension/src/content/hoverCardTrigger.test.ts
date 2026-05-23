/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("hover card manual enrich trigger", () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
    teardown = setupHoverCardTrigger(document);
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    clearIocHighlights(document.body);
    document.getElementById(HOVER_CARD_HOST_ID)?.replaceChildren();
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

  it("opens the hover card when a highlight is clicked", () => {
    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("8.8.8.8");
    expect(panel?.textContent).toContain("IPv4 address");
  });

  it("opens the hover card from the enrich icon", () => {
    const highlight = mountHighlightedIpv4();
    const icon = highlight.querySelector(`.${IOC_ENRICH_ICON_CLASS}`);
    icon?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
  });

  it("opens the hover card when Enter is pressed on a highlight", () => {
    const highlight = mountHighlightedIpv4();
    highlight.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();
  });

  it("closes the hover card on Escape or outside click", () => {
    const highlight = mountHighlightedIpv4();
    openHoverCardForHighlight(highlight);
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();

    openHoverCardForHighlight(highlight);
    document.body.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    expect(document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)).toBeNull();
  });
});
