/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { scanTextNodesForIocs } from "./detector";
import {
  clearIocHighlights,
  ensureIocHighlightStyles,
  highlightDetectedIocs,
  IOC_ENRICH_ICON_CLASS,
  IOC_HIGHLIGHT_BADGE_CLASS,
  IOC_HIGHLIGHT_CLASS,
  IOC_HIGHLIGHT_STYLE_ID,
  listIocHighlightsInDocumentOrder,
  readIocHighlightDisplayValue,
  readIocHighlightProvenance,
  resolveAdjacentIocHighlight,
} from "./highlighter";

describe("ioc highlighter", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.head
      .querySelectorAll(`#${IOC_HIGHLIGHT_STYLE_ID}`)
      .forEach((node) => node.remove());
  });

  afterEach(() => {
    clearIocHighlights(document.body);
    document.head
      .querySelectorAll(`#${IOC_HIGHLIGHT_STYLE_ID}`)
      .forEach((node) => node.remove());
  });

  it("injects inline highlight styles once", () => {
    ensureIocHighlightStyles(document);
    ensureIocHighlightStyles(document);
    expect(document.getElementById(IOC_HIGHLIGHT_STYLE_ID)).not.toBeNull();
  });

  it("wraps detected IOCs with inline underline and type badge", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 for details.";
    document.body.appendChild(paragraph);

    const matches = scanTextNodesForIocs(document.body);
    const result = highlightDetectedIocs(matches, { root: document.body });

    expect(result.highlightedCount).toBeGreaterThanOrEqual(1);

    const highlight = document.querySelector<HTMLSpanElement>(
      `.${IOC_HIGHLIGHT_CLASS}`
    );
    expect(highlight).not.toBeNull();
    expect(highlight?.style.display).not.toBe("block");
    expect(highlight?.dataset.vera5Type).toBe(IOC_TYPE.IPV4);
    expect(highlight?.dataset.vera5Value).toBe("8.8.8.8");
    expect(highlight?.dataset.vera5AnchorId).toMatch(/^vera5-hl-\d+$/);
    expect(highlight?.dataset.vera5RuleId).toBe("ioc.regex.ipv4");
    expect(highlight?.dataset.vera5SourceTextHint).toBe(
      "Contact 8.8.8.8 for details."
    );
    expect(result.anchorLinks).toEqual([
      {
        anchorId: highlight?.dataset.vera5AnchorId,
        type: IOC_TYPE.IPV4,
        value: "8.8.8.8",
        ruleId: "ioc.regex.ipv4",
        sourceTextHint: "Contact 8.8.8.8 for details.",
      },
    ]);
    expect(
      highlight?.querySelector(`.${IOC_HIGHLIGHT_BADGE_CLASS}`)?.textContent
    ).toBe("IP");
    expect(
      highlight?.querySelector(`.${IOC_ENRICH_ICON_CLASS}`)?.textContent
    ).toBe("›");
    expect(highlight?.getAttribute("role")).toBe("button");
    expect(readIocHighlightProvenance(highlight!)).toEqual({
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Contact 8.8.8.8 for details.",
      ignoredOverlaps: [],
    });

    const beforeHeight = paragraph.offsetHeight;
    expect(paragraph.offsetHeight).toBe(beforeHeight);
  });

  it("highlights defanged URLs with on-page text and displayValue metadata", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Ticket hxxps://example[.]com/evil";
    document.body.appendChild(paragraph);

    const matches = scanTextNodesForIocs(document.body);
    highlightDetectedIocs(matches, { root: document.body });

    const highlight = document.querySelector<HTMLSpanElement>(
      `.${IOC_HIGHLIGHT_CLASS}`
    );
    expect(highlight).not.toBeNull();
    expect(highlight?.textContent).toContain("hxxps://example[.]com/evil");
    expect(highlight?.dataset.vera5Value).toBe("https://example.com/evil");
    expect(readIocHighlightDisplayValue(highlight!)).toBe(
      "hxxps://example[.]com/evil"
    );
    expect(readIocHighlightProvenance(highlight!)).toEqual({
      ruleId: "ioc.regex.url",
      sourceTextHint: "Ticket hxxps://example[.]com/evil",
      ignoredOverlaps: [],
    });
  });

  it("highlights multiple IOCs in one text node without losing surrounding text", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "IPs 8.8.8.8 and 192.0.2.1 here.";
    document.body.appendChild(paragraph);

    const matches = scanTextNodesForIocs(document.body);
    const result = highlightDetectedIocs(matches, { root: document.body });

    expect(result.highlightedCount).toBeGreaterThanOrEqual(2);
    expect(paragraph.textContent).toContain("IPs");
    expect(paragraph.textContent).toContain("here.");
    expect(document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBe(
      result.highlightedCount
    );
  });

  it("clears highlights and restores plain text nodes", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "See CVE-2021-44228 for context.";
    document.body.appendChild(paragraph);

    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    expect(document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBeGreaterThan(
      0
    );

    const removed = clearIocHighlights(document.body);
    expect(removed).toBeGreaterThan(0);
    expect(document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(paragraph.textContent).toContain("CVE-2021-44228");
  });

  it("clears existing highlights before re-applying on a fresh scan", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 8.8.8.8 for details.";
    document.body.appendChild(paragraph);

    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    expect(document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBe(1);

    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
    expect(document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBe(1);
  });

  it("lists highlights in document order and resolves adjacent triage targets", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "IPs 8.8.8.8 and 192.0.2.1 here.";
    document.body.appendChild(paragraph);

    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });

    const highlights = listIocHighlightsInDocumentOrder(document.body);
    expect(highlights).toHaveLength(2);

    expect(resolveAdjacentIocHighlight(null, "next", document.body)).toBe(
      highlights[0]
    );
    expect(resolveAdjacentIocHighlight(null, "previous", document.body)).toBe(
      highlights[1]
    );
    expect(resolveAdjacentIocHighlight(highlights[0], "next", document.body)).toBe(
      highlights[1]
    );
    expect(
      resolveAdjacentIocHighlight(highlights[1], "next", document.body)
    ).toBe(highlights[0]);
    expect(
      resolveAdjacentIocHighlight(highlights[0], "previous", document.body)
    ).toBe(highlights[1]);
  });
});
