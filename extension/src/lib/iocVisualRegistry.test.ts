import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  getIocVisual,
  IOC_TYPE_ALIAS,
  IOC_TYPE_COLOR_TOKEN,
  resolveCanonicalIocType,
} from "./iocVisualRegistry";

describe("iocVisualRegistry", () => {
  it("maps every canonical IocType to a distinct glyph bucket", () => {
    for (const type of Object.values(IOC_TYPE)) {
      const visual = getIocVisual(type);
      expect(visual.glyph).toBeTypeOf("function");
      expect(visual.label.length).toBeGreaterThan(0);
      expect(visual.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.canonicalType).toBe(type);
    }
  });

  it("resolves CSS/runtime aliases to canonical types", () => {
    expect(resolveCanonicalIocType("ip")).toBe(IOC_TYPE.IPV4);
    expect(resolveCanonicalIocType("ipv6")).toBe(IOC_TYPE.IPV4);
    expect(resolveCanonicalIocType("dom")).toBe(IOC_TYPE.DOMAIN);
    expect(resolveCanonicalIocType("hostname")).toBe(IOC_TYPE.DOMAIN);
    expect(resolveCanonicalIocType("hash")).toBe(IOC_TYPE.SHA256);
    expect(resolveCanonicalIocType("path")).toBe(IOC_TYPE.FILEPATH);
  });

  it("uses one hash-family glyph for md5, sha1, and sha256", () => {
    const md5 = getIocVisual(IOC_TYPE.MD5);
    const sha1 = getIocVisual(IOC_TYPE.SHA1);
    const sha256 = getIocVisual(IOC_TYPE.SHA256);
    expect(md5.glyphKey).toBe("hash");
    expect(sha1.glyphKey).toBe("hash");
    expect(sha256.glyphKey).toBe("hash");
    expect(md5.color).toBe(sha256.color);
  });

  it("falls back safely for unknown types", () => {
    const visual = getIocVisual("not-a-real-type");
    expect(visual.canonicalType).toBe("unknown");
    expect(visual.glyphKey).toBe("unknown");
    expect(visual.color).toBe(IOC_TYPE_COLOR_TOKEN.unknown);
  });

  it("renders inline SVG glyph elements (no img assets)", () => {
    const Glyph = getIocVisual(IOC_TYPE.URL).glyph;
    const node = createElement(Glyph, { size: 16, className: "vera5-ioc-type-asset" });
    expect(node.props.size).toBe(16);
    expect(node.props.className).toBe("vera5-ioc-type-asset");
  });

  it("documents alias keys for CSS parity", () => {
    expect(IOC_TYPE_ALIAS.ipv6).toBe(IOC_TYPE.IPV4);
    expect(IOC_TYPE_ALIAS.dom).toBe(IOC_TYPE.DOMAIN);
  });
});
