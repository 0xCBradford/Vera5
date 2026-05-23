import { describe, expect, it } from "vitest";
import {
  computeHoverCardPosition,
  DEFAULT_HOVER_CARD_ANCHOR_OFFSET,
  DEFAULT_HOVER_CARD_VIEWPORT_MARGIN,
} from "./hoverCardPosition";

const viewport = { width: 800, height: 600 };

describe("computeHoverCardPosition", () => {
  it("places the card below the anchor by default", () => {
    const position = computeHoverCardPosition(
      { top: 100, left: 120, width: 80, height: 20 },
      { width: 240, height: 100 },
      viewport
    );

    expect(position).toEqual({
      top: 100 + 20 + DEFAULT_HOVER_CARD_ANCHOR_OFFSET,
      left: 120,
    });
  });

  it("flips above the anchor when there is no room below", () => {
    const position = computeHoverCardPosition(
      { top: 520, left: 200, width: 60, height: 24 },
      { width: 220, height: 90 },
      viewport
    );

    expect(position.top).toBeLessThan(520);
    expect(position.top).toBe(520 - 90 - DEFAULT_HOVER_CARD_ANCHOR_OFFSET);
  });

  it("shifts left when the card would overflow the right edge", () => {
    const position = computeHoverCardPosition(
      { top: 80, left: 700, width: 40, height: 16 },
      { width: 200, height: 80 },
      viewport
    );

    expect(position.left).toBe(
      viewport.width - DEFAULT_HOVER_CARD_VIEWPORT_MARGIN - 200
    );
  });

  it("clamps to the viewport margin when the anchor is near the top", () => {
    const position = computeHoverCardPosition(
      { top: 4, left: 100, width: 50, height: 12 },
      { width: 200, height: 120 },
      viewport
    );

    expect(position.top).toBeGreaterThanOrEqual(DEFAULT_HOVER_CARD_VIEWPORT_MARGIN);
  });
});
