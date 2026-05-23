export type AxisRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type AxisSize = {
  width: number;
  height: number;
};

export type AxisPoint = {
  top: number;
  left: number;
};

export type HoverCardViewport = {
  width: number;
  height: number;
  margin?: number;
  offset?: number;
};

export const DEFAULT_HOVER_CARD_VIEWPORT_MARGIN = 8;
export const DEFAULT_HOVER_CARD_ANCHOR_OFFSET = 8;

export function computeHoverCardPosition(
  anchor: AxisRect,
  card: AxisSize,
  viewport: HoverCardViewport
): AxisPoint {
  const margin = viewport.margin ?? DEFAULT_HOVER_CARD_VIEWPORT_MARGIN;
  const offset = viewport.offset ?? DEFAULT_HOVER_CARD_ANCHOR_OFFSET;
  const maxLeft = Math.max(margin, viewport.width - margin - card.width);
  const maxTop = Math.max(margin, viewport.height - margin - card.height);

  let top = anchor.top + anchor.height + offset;
  if (top + card.height > viewport.height - margin) {
    top = anchor.top - card.height - offset;
  }
  top = clamp(top, margin, maxTop);

  let left = anchor.left;
  if (left + card.width > viewport.width - margin) {
    left = viewport.width - margin - card.width;
  }
  left = clamp(left, margin, maxLeft);

  return { top, left };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function applyHoverCardFixedPosition(
  element: HTMLElement,
  position: AxisPoint
): void {
  element.style.position = "fixed";
  element.style.top = `${position.top}px`;
  element.style.left = `${position.left}px`;
  element.style.margin = "0";
  element.style.zIndex = "2147483646";
}

export function readViewportSize(
  view: Window = window
): Pick<HoverCardViewport, "width" | "height"> {
  return {
    width: view.innerWidth,
    height: view.innerHeight,
  };
}
