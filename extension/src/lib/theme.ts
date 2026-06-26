/**
 * VERA5 shared design system.
 *
 * Canonical design tokens for every VERA5 UI surface (popup, options/settings,
 * and future surfaces). The palette is the dark-neutral + ELECTRIC AMBER identity
 * taken verbatim from the official website (vera5.io). It is the TS mirror of
 * `extension/src/styles/tokens.css` (the CSS source of truth); keep the two in
 * sync. Surfaces stay neutral (~70%), text ~20%, amber accent ~10%.
 */

export const VERA5_COLOR = {
  /** Void-black page background (popup/sidebar). */
  bg: "#0B0E11",
  /** Primary card / panel surface. */
  surface: "#12171E",
  /** Raised / hover control surface. */
  surfaceRaised: "#222B36",
  /** Layered surface for inputs, list rows. */
  surfaceSunken: "#19202A",
  border: "#262D36",
  borderHard: "#313A45",
  borderSubtle: "#232A33",
  text: "#F5F7FA",
  textMuted: "#A7B0BA",
  textLow: "#6B7480",
  /** Electric amber — primary buttons, active, focus, toggles. */
  accent: "#FFB224",
  accentHover: "#FFC24D",
  accentStrong: "#FFC24D",
  accentWeak: "rgba(255, 178, 36, 0.12)",
  /** Dark text/knobs placed on top of amber. */
  onAccent: "#0B0E11",
  /** Neutral primary text used where a light "accent text" was before. */
  accentText: "#F5F7FA",
  accentActiveBg: "#FFB224",
  /** Clean / trusted IOC verdict ONLY (never controls). */
  terminalTeal: "#22C7A9",
  /** Advanced / AI-assisted / correlation features. */
  violet: "#8B5CF6",
  success: "#22C7A9",
  successText: "#22C7A9",
  warning: "#FFB224",
  warningText: "#FFB224",
  danger: "#FF4D5A",
  dangerText: "#FF4D5A",
  signalRed: "#FF4D5A",
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
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const VERA5_SHADOW = {
  sm: "0 2px 8px rgba(0, 0, 0, 0.18)",
  md: "0 6px 18px rgba(0, 0, 0, 0.28)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.35)",
} as const;

export const VERA5_FONT = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  /** Reserved for the "Vera5" wordmark / headers only — never body or labels. */
  wordmark: '"Space Grotesk", "Inter", system-ui, sans-serif',
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

export const VERA5_FOCUS_RING = "0 0 0 2px rgba(255, 178, 36, 0.6)";

export const VERA5_TRANSITION = {
  fast: "0.14s cubic-bezier(0.16, 1, 0.3, 1)",
  base: "0.2s cubic-bezier(0.16, 1, 0.3, 1)",
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
