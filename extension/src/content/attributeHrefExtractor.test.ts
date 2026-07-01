/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  buildIocDedupeKey,
  collectAllowlistedAttributeValues,
  getAllowlistedAttributeValuesForElement,
  getAttributeHrefAllowlistContract,
  isAllowlistedAttributeName,
  isElementEligibleForAttributeRead,
  isElementHiddenForAttributeExtract,
  mergeVisibleTextAndAttributeIocMatches,
  scanAllowlistedAttributesForIocs,
  scanAllowlistedAttributesForIocsWithProfile,
  shouldRejectElementSubtreeForAttributeExtract,
  shouldSkipElementForAttributeExtract,
} from "./attributeHrefExtractor";
import { scanTextNodesForIocs } from "./detector";

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

function hasAttributeMatch(
  matches: ReadonlyArray<{ type: string; value: string; attributeName?: string }>,
  type: string,
  value: string,
  attributeName?: string
): boolean {
  return matches.some(
    (match) =>
      match.type === type &&
      match.value === value &&
      (attributeName === undefined || match.attributeName === attributeName)
  );
}

describe("attributeHrefExtractor allowlist contract", () => {
  it("documents href, src, data mirrors, and cite allowlist entries", () => {
    const contract = getAttributeHrefAllowlistContract();
    expect(contract.map((entry) => entry.attribute)).toEqual([
      "href",
      "src",
      "data-url",
      "data-href",
      "data-src",
      "cite",
    ]);
  });

  it("accepts only allowlisted attribute names", () => {
    expect(isAllowlistedAttributeName("href")).toBe(true);
    expect(isAllowlistedAttributeName("src")).toBe(true);
    expect(isAllowlistedAttributeName("data-url")).toBe(true);
    expect(isAllowlistedAttributeName("class")).toBe(false);
    expect(isAllowlistedAttributeName("value")).toBe(false);
    expect(isAllowlistedAttributeName("data-testid")).toBe(false);
    expect(isAllowlistedAttributeName("aria-label")).toBe(false);
    expect(isAllowlistedAttributeName("onclick")).toBe(false);
  });

  it("pairs attributes with eligible element tags", () => {
    const anchor = document.createElement("a");
    const span = document.createElement("span");
    expect(isElementEligibleForAttributeRead(anchor, "href")).toBe(true);
    expect(isElementEligibleForAttributeRead(span, "href")).toBe(false);
    expect(isElementEligibleForAttributeRead(span, "data-url")).toBe(true);
    expect(isElementEligibleForAttributeRead(anchor, "class")).toBe(false);
  });
});

describe("attributeHrefExtractor element gates", () => {
  it("rejects form controls and executable subtrees", () => {
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("input"))).toBe(
      true
    );
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("button"))).toBe(
      true
    );
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("script"))).toBe(
      true
    );
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("noscript"))).toBe(
      true
    );
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("template"))).toBe(
      true
    );
    expect(shouldRejectElementSubtreeForAttributeExtract(document.createElement("p"))).toBe(false);
  });

  it("skips head metadata except link href", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("content", "https://evil.example.com");
    expect(shouldSkipElementForAttributeExtract(meta)).toBe(true);

    const link = document.createElement("link");
    link.setAttribute("href", "https://cdn.example.com/app.css");
    document.head.appendChild(link);
    expect(shouldSkipElementForAttributeExtract(link)).toBe(false);
    link.remove();
  });

  it("detects hidden elements via attributes and computed styles", () => {
    const hidden = document.createElement("div");
    hidden.setAttribute("hidden", "");
    expect(isElementHiddenForAttributeExtract(hidden)).toBe(true);

    const ariaHidden = document.createElement("div");
    ariaHidden.setAttribute("aria-hidden", "true");
    expect(isElementHiddenForAttributeExtract(ariaHidden)).toBe(true);

    const displayNone = document.createElement("div");
    displayNone.style.display = "none";
    document.body.appendChild(displayNone);
    expect(isElementHiddenForAttributeExtract(displayNone)).toBe(true);
    displayNone.remove();
  });
});

describe("attributeHrefExtractor value collection", () => {
  it("reads allowlisted values from eligible elements only", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://evil.example.com/path");
    anchor.setAttribute("class", "nav-link");
    anchor.setAttribute("data-testid", "ignored");

    expect(getAllowlistedAttributeValuesForElement(anchor)).toEqual([
      {
        element: anchor,
        attributeName: "href",
        value: "https://evil.example.com/path",
      },
    ]);
  });

  it("collects href, src, data mirrors, and cite from visible DOM", () => {
    const root = mount(`
      <a href="https://phish.example.com/login">label</a>
      <img src="https://cdn.example.com/logo.png" />
      <span data-url="https://mirror.example.com/ioc"></span>
      <blockquote cite="https://source.example.com/report"></blockquote>
      <input type="url" value="https://ignored.example.com" />
      <a class="https://not-an-ioc.example.com" href="https://visible.example.com">x</a>
    `);

    const values = collectAllowlistedAttributeValues(root);
    expect(values.map(({ attributeName, value }) => ({ attributeName, value }))).toEqual(
      expect.arrayContaining([
        { attributeName: "href", value: "https://phish.example.com/login" },
        { attributeName: "href", value: "https://visible.example.com" },
        { attributeName: "src", value: "https://cdn.example.com/logo.png" },
        { attributeName: "data-url", value: "https://mirror.example.com/ioc" },
        { attributeName: "cite", value: "https://source.example.com/report" },
      ])
    );
    expect(
      values.some(({ value }) => value.includes("ignored.example.com"))
    ).toBe(false);
    expect(values.some(({ attributeName }) => attributeName === "class")).toBe(false);
  });

  it("skips hidden subtrees and script bodies", () => {
    const root = mount(`
      <a href="https://visible.example.com">ok</a>
      <div hidden>
        <a href="https://hidden.example.com">no</a>
      </div>
      <div aria-hidden="true">
        <img src="https://aria-hidden.example.com/x.png" />
      </div>
      <script src="https://script.example.com/x.js"></script>
      <noscript>
        <a href="https://noscript.example.com">no</a>
      </noscript>
    `);

    const values = collectAllowlistedAttributeValues(root);
    const urls = values.map((entry) => entry.value);
    expect(urls).toContain("https://visible.example.com");
    expect(urls).not.toContain("https://hidden.example.com");
    expect(urls).not.toContain("https://aria-hidden.example.com/x.png");
    expect(urls).not.toContain("https://script.example.com/x.js");
    expect(urls).not.toContain("https://noscript.example.com");
  });
});

describe("attributeHrefExtractor IOC detection", () => {
  it("detects IOCs from allowlisted attribute values", () => {
    const root = mount(`
      <a href="https://malware.example.com/payload">x</a>
      <img src="https://8.8.8.8/logo.png" />
      <span data-href="hxxps://defanged[.]example[.]com/path"></span>
    `);

    const { matches, profile } = scanAllowlistedAttributesForIocsWithProfile(root);
    expect(profile.attributesScanned).toBeGreaterThanOrEqual(3);
    expect(hasAttributeMatch(matches, IOC_TYPE.URL, "https://malware.example.com/payload", "href")).toBe(
      true
    );
    expect(hasAttributeMatch(matches, IOC_TYPE.URL, "https://8.8.8.8/logo.png", "src")).toBe(true);
    expect(
      hasAttributeMatch(matches, IOC_TYPE.URL, "https://defanged.example.com/path", "data-href")
    ).toBe(true);
  });

  it("does not duplicate visible-text-only anchors when href is benign", () => {
    const root = mount(`<a href="https://www.example.com/">Home</a>`);
    const matches = scanAllowlistedAttributesForIocs(root);
    expect(matches.some((match) => match.value.includes("example.com"))).toBe(true);
  });

  it("leaves fragment-only and relative asset attributes without network IOC matches", () => {
    const root = mount(`
      <a href="#top">Home</a>
      <img src="pixel.gif" alt="logo" />
    `);
    const matches = scanAllowlistedAttributesForIocs(root);
    expect(
      matches.some((match) =>
        [IOC_TYPE.URL, IOC_TYPE.DOMAIN, IOC_TYPE.IPV4].includes(match.type as typeof IOC_TYPE.URL)
      )
    ).toBe(false);
  });
});

describe("attributeHrefExtractor merge and dedupe", () => {
  it("builds stable dedupe keys from type and value", () => {
    expect(buildIocDedupeKey("url", "https://example.com/path")).toBe(
      "url:https://example.com/path"
    );
  });

  it("prefers visible-text matches over duplicate attribute detections", () => {
    const root = mount(`
      <a href="https://duplicate.example.com/path">https://duplicate.example.com/path</a>
      <img src="https://attribute-only.example.com/logo.png" />
    `);
    const textMatches = scanTextNodesForIocs(root);
    const attributeMatches = scanAllowlistedAttributesForIocs(root);

    const merged = mergeVisibleTextAndAttributeIocMatches(
      textMatches,
      attributeMatches
    );
    const duplicateUrlMatches = merged.filter(
      (match) => match.value === "https://duplicate.example.com/path"
    );
    expect(duplicateUrlMatches).toHaveLength(1);
    expect(duplicateUrlMatches[0]?.textNode).toBeDefined();
    expect(
      merged.some(
        (match) => match.value === "https://attribute-only.example.com/logo.png"
      )
    ).toBe(true);
  });
});
