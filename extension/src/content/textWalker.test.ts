/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  collectIocScanTextBlocks,
  collectTextNodes,
  DEFAULT_MAX_TEXT_NODES_PER_SCAN,
  getScannableAttributeValues,
  isMatchWhollyInsideTextNode,
  isTextNodeEligibleForIocScan,
  resolveMaxTextNodesPerScan,
  shouldScanElementAttribute,
  shouldSkipElementForTextWalk,
} from "./textWalker";

function joinedText(nodes: ReadonlyArray<Text>): string {
  return nodes.map((node) => node.textContent ?? "").join("|");
}

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

describe("textWalker element skip rules", () => {
  it("skips script, style, and textarea by default", () => {
    const root = mount(`
      <p>Visible 8.8.8.8</p>
      <script>const ip = "10.0.0.1";</script>
      <style>.rule { color: red; }</style>
      <textarea>192.168.1.1</textarea>
    `);
    const text = joinedText(collectTextNodes(root));
    expect(text).toContain("Visible 8.8.8.8");
    expect(text).not.toContain("10.0.0.1");
    expect(text).not.toContain("192.168.1.1");
    expect(text).not.toContain("color: red");
  });

  it("allows script and style text when skip flags are disabled", () => {
    const root = mount(`
      <script>10.0.0.2</script>
      <style>body { margin: 0; }</style>
      <textarea>192.168.1.9</textarea>
    `);
    const text = joinedText(
      collectTextNodes(root, {
        skipScript: false,
        skipStyle: false,
        skipTextarea: false,
      })
    );
    expect(text).toContain("10.0.0.2");
    expect(text).toContain("margin: 0");
    expect(text).toContain("192.168.1.9");
  });

  it("skips noscript and template subtrees", () => {
    const root = mount(`
      <p>Body</p>
      <noscript>8.8.4.4</noscript>
      <template>1.1.1.1</template>
    `);
    const text = joinedText(collectTextNodes(root));
    expect(text).toBe("Body");
  });

  it("reports skip for metadata and configured tags", () => {
    expect(shouldSkipElementForTextWalk(document.createElement("script"))).toBe(
      true
    );
    expect(shouldSkipElementForTextWalk(document.createElement("style"))).toBe(
      true
    );
    expect(
      shouldSkipElementForTextWalk(document.createElement("textarea"))
    ).toBe(true);
    expect(shouldSkipElementForTextWalk(document.createElement("p"))).toBe(
      false
    );
  });
});

describe("textWalker attribute scan policy", () => {
  it("blocks layout-sensitive and aria/data/event attributes", () => {
    expect(shouldScanElementAttribute("href")).toBe(false);
    expect(shouldScanElementAttribute("class")).toBe(false);
    expect(shouldScanElementAttribute("style")).toBe(false);
    expect(shouldScanElementAttribute("data-testid")).toBe(false);
    expect(shouldScanElementAttribute("aria-label")).toBe(false);
    expect(shouldScanElementAttribute("onclick")).toBe(false);
  });

  it("does not return attribute values for IOC scan", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://evil.example.com");
    anchor.textContent = "safe label";
    expect(getScannableAttributeValues(anchor)).toEqual([]);
  });

  it("collects link label text but not href-only IOC values", () => {
    const root = mount(
      `<a href="https://evil.example.com">safe label</a>`
    );
    const text = joinedText(collectTextNodes(root));
    expect(text).toBe("safe label");
    expect(text).not.toContain("evil.example.com");
  });
});

describe("textWalker scan limits", () => {
  it("defaults max text nodes per scan", () => {
    expect(resolveMaxTextNodesPerScan()).toBe(
      DEFAULT_MAX_TEXT_NODES_PER_SCAN
    );
    expect(DEFAULT_MAX_TEXT_NODES_PER_SCAN).toBeGreaterThan(0);
  });

  it("caps eligible text nodes collected per invocation", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, index) => `<p>Node ${index} with 8.8.8.8</p>`
    ).join("");
    const root = mount(paragraphs);
    expect(collectTextNodes(root, { maxTextNodes: 3 })).toHaveLength(3);
  });

  it("applies the cap in collectIocScanTextBlocks", () => {
    const paragraphs = Array.from(
      { length: 8 },
      (_, index) => `<p>Block ${index}</p>`
    ).join("");
    const root = mount(paragraphs);
    const blocks = collectIocScanTextBlocks(root, { maxTextNodes: 2 });
    expect(blocks).toHaveLength(2);
  });
});

describe("textWalker IOC scan helpers", () => {
  it("rejects empty text nodes", () => {
    const root = mount(`<p>   </p><span>ok</span>`);
    const nodes = collectTextNodes(root);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].textContent).toBe("ok");
    expect(
      isTextNodeEligibleForIocScan(nodes[0], root)
    ).toBe(true);
  });

  it("validates match offsets stay inside a text node", () => {
    const root = mount(`<p>8.8.8.8</p>`);
    const node = collectTextNodes(root)[0];
    expect(isMatchWhollyInsideTextNode(node, 0, 7)).toBe(true);
    expect(isMatchWhollyInsideTextNode(node, 0, 99)).toBe(false);
  });

  it("builds contiguous block offsets for collected text", () => {
    const root = mount(`<p>aaa</p><p>bb</p>`);
    const blocks = collectIocScanTextBlocks(root);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ text: "aaa", blockStart: 0 });
    expect(blocks[1]).toMatchObject({ text: "bb", blockStart: 3 });
  });
});
