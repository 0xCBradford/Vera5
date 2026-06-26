/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildEnrichmentSummaryClassName,
  buildVera5UiStylesCss,
  ensureVera5UiStyles,
  VERA5_UI_STYLE_ID,
} from "./vera5UiStyles";

describe("vera5 UI styles", () => {
  afterEach(() => {
    document.getElementById(VERA5_UI_STYLE_ID)?.remove();
  });

  it("includes dark color-scheme overrides for hover card and highlights", () => {
    const css = buildVera5UiStylesCss();
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(".vera5-hover-card-panel");
    expect(css).toContain(".vera5-ioc-highlight");
    expect(css).toContain("--vera5-surface: #12171e");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("vera5-panel-reveal");
  });

  it("injects shared UI styles once per document", () => {
    ensureVera5UiStyles(document);
    ensureVera5UiStyles(document);
    expect(document.getElementById(VERA5_UI_STYLE_ID)).not.toBeNull();
    expect(document.querySelectorAll(`#${VERA5_UI_STYLE_ID}`)).toHaveLength(1);
  });

  it("maps enrichment variants to modifier classes", () => {
    expect(buildEnrichmentSummaryClassName("error")).toContain(
      "vera5-hover-card-enrichment--error"
    );
  });
});
