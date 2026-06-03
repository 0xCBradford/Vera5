/**
 * VERA5 shared design system.
 *
 * Canonical design tokens for every VERA5 UI surface (popup, options/settings,
 * and future surfaces). The palette is the dark slate + blue identity that the
 * popup established; it is extracted here so all surfaces share one language.
 *
 * NOTE: `extension/src/options/options.css` mirrors these values as CSS custom
 * properties (`--v5-*`) so that pseudo-states (:hover/:focus/:checked) and
 * transitions — which inline styles cannot express — stay in sync with the
 * tokens below. Keep the two in step when changing a value.
 */

export const VERA5_COLOR = {
  /** Page background (deepest slate). */
  bg: "#0f172a",
  /** Primary card / panel surface. */
  surface: "#1e293b",
  /** Raised control surface (buttons, inputs, chips). */
  surfaceRaised: "#334155",
  /** Sunken surface (rows nested inside a card). */
  surfaceSunken: "#0f172a",
  border: "#475569",
  borderSubtle: "#334155",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  accent: "#60a5fa",
  accentStrong: "#3b82f6",
  accentText: "#dbeafe",
  accentActiveBg: "#1d4ed8",
  success: "#4ade80",
  successText: "#bbf7d0",
  warning: "#fbbf24",
  warningText: "#fde68a",
  danger: "#f87171",
  dangerText: "#fca5a5",
} as const;

export const VERA5_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const VERA5_RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const VERA5_SHADOW = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.35)",
  md: "0 4px 14px rgba(0, 0, 0, 0.45)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.55)",
} as const;

export const VERA5_FONT = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    "2xl": 28,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const VERA5_FOCUS_RING = "0 0 0 3px rgba(96, 165, 250, 0.45)";

export const VERA5_TRANSITION = {
  fast: "0.15s ease",
  base: "0.2s ease",
} as const;

export const VERA5_THEME = {
  color: VERA5_COLOR,
  space: VERA5_SPACE,
  radius: VERA5_RADIUS,
  shadow: VERA5_SHADOW,
  font: VERA5_FONT,
  focusRing: VERA5_FOCUS_RING,
  transition: VERA5_TRANSITION,
} as const;

export type Vera5Theme = typeof VERA5_THEME;
