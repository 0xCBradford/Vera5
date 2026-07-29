/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  buildVera5ContentFontFaceCss,
  buildVera5ContentUiTokenDeclarations,
  VERA5_COLOR,
  VERA5_FONT,
} from "./theme";

describe("vera5 theme token bridge", () => {
  it("emits content-UI token declarations from the canonical palette", () => {
    const css = buildVera5ContentUiTokenDeclarations();
    expect(css).toContain(`--vera5-surface: ${VERA5_COLOR.surface}`);
    expect(css).toContain(`--vera5-accent: ${VERA5_COLOR.accent}`);
    expect(css).toContain(`--vera5-font-ui: ${VERA5_FONT.sans}`);
    expect(css).toContain(`--vera5-font-wordmark: ${VERA5_FONT.wordmark}`);
  });

  it("emits local @font-face rules for bundled brand fonts", () => {
    const css = buildVera5ContentFontFaceCss();
    expect(css).toContain('font-family: "Inter"');
    expect(css).toContain('font-family: "JetBrains Mono"');
    expect(css).toContain('font-family: "Space Grotesk"');
    expect(css).toContain("Inter-Regular.woff2");
  });
});
