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

/**
 * Spacing scale (px). Mirrors CSS `--sp-*` / legacy `--s-*` in tokens.css.
 * Prefer these over ad-hoc pixel literals in inline styles.
 */
export const VERA5_SPACE = {
  /** 2px — hairline/micro alignment */
  "0": 2,
  /** 4px */
  xs: 4,
  /** 6px */
  "2": 6,
  /** 8px */
  sm: 8,
  /** 10px */
  "4": 10,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 20px */
  xl: 20,
  /** 24px */
  "2xl": 24,
  /** 32px */
  "3xl": 32,
  "4xl": 40,
} as const;

/** Radius families — compact / card / major / circular. */
export const VERA5_RADIUS = {
  xs: 4,
  sm: 6,
  compact: 6,
  md: 10,
  card: 10,
  lg: 14,
  major: 14,
  pill: 999,
} as const;

export const VERA5_SHADOW = {
  sm: "0 2px 8px rgba(0, 0, 0, 0.18)",
  md: "0 6px 18px rgba(0, 0, 0, 0.28)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.35)",
  selected: "0 0 0 1px rgba(255, 178, 36, 0.38), 0 6px 18px rgba(0, 0, 0, 0.3)",
} as const;

/**
 * Typography — mirrors CSS `--fs-*` / `--fw-*` / font stacks in tokens.css.
 * Legacy size keys (base/md/lg/xl/2xl) are retained for inline-style callers.
 */
export const VERA5_FONT = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  /** Reserved for the "Vera5" wordmark / headers only — never body or labels. */
  wordmark: '"Space Grotesk", "Inter", system-ui, sans-serif',
  size: {
    /** Meaningful metadata minimum */
    micro: 11,
    xs: 11,
    /** Small support / secondary */
    support: 11.5,
    sm: 12,
    /** Standard body */
    body: 12.5,
    /** Technical / IOC values & control labels */
    value: 13,
    /** Card / vendor titles */
    title: 13.5,
    /** Major section headings */
    heading: 14,
    base: 14,
    headingLg: 15,
    md: 16,
    lg: 18,
    /** Narrow-layout score */
    scoreSm: 22,
    xl: 22,
    /** Primary score value */
    score: 30,
    "2xl": 28,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    score: 1,
    control: 1.15,
    tight: 1.2,
    label: 1.25,
    value: 1.35,
    body: 1.45,
    multiline: 1.5,
  },
} as const;

export const VERA5_ICON = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export const VERA5_SCORE_COLOR = {
  critical: "#FF4D5A",
  high: "#FF8A24",
  suspicious: "#FFD24A",
  low: "#B88938",
  /** Valid 0/100 — distinct from unavailable blue-gray */
  zero: "#9A8F6B",
} as const;

export const VERA5_FOCUS_RING = "0 0 0 2px rgba(255, 178, 36, 0.6)";

export const VERA5_TRANSITION = {
  fast: "0.14s cubic-bezier(0.16, 1, 0.3, 1)",
  base: "0.2s cubic-bezier(0.16, 1, 0.3, 1)",
  active: "0.09s cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const VERA5_INTERACTION = {
  disabledOpacity: 0.55,
  disabledSaturate: 0.7,
  focusOutlineWidth: 2,
  focusOutlineOffset: 2,
} as const;

export const VERA5_THEME = {
  color: VERA5_COLOR,
  space: VERA5_SPACE,
  radius: VERA5_RADIUS,
  shadow: VERA5_SHADOW,
  font: VERA5_FONT,
  icon: VERA5_ICON,
  scoreColor: VERA5_SCORE_COLOR,
  focusRing: VERA5_FOCUS_RING,
  transition: VERA5_TRANSITION,
  interaction: VERA5_INTERACTION,
} as const;

export type Vera5Theme = typeof VERA5_THEME;

function resolveBundledFontUrl(fileName: string): string {
  try {
    const getURL = (
      globalThis as {
        chrome?: { runtime?: { getURL?: (path: string) => string } };
      }
    ).chrome?.runtime?.getURL;
    if (typeof getURL === "function") {
      return getURL(`fonts/${fileName}`);
    }
  } catch {
    // Unit tests / non-extension hosts fall back to extension-page paths.
  }
  return `/fonts/${fileName}`;
}

/**
 * Local @font-face rules for injected content UI (web_accessible fonts).
 * Extension pages already load the same faces via `styles/tokens.css`.
 */
export function buildVera5ContentFontFaceCss(): string {
  const interRegular = resolveBundledFontUrl("Inter-Regular.woff2");
  const interMedium = resolveBundledFontUrl("Inter-Medium.woff2");
  const interSemiBold = resolveBundledFontUrl("Inter-SemiBold.woff2");
  const interBold = resolveBundledFontUrl("Inter-Bold.woff2");
  const mono = resolveBundledFontUrl("JetBrainsMono-Medium.woff2");
  const wordmark = resolveBundledFontUrl("SpaceGrotesk-Bold.woff2");
  return `
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("${interRegular}") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("${interMedium}") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("${interSemiBold}") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("${interBold}") format("woff2");
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("${mono}") format("woff2");
}
@font-face {
  font-family: "Space Grotesk";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("${wordmark}") format("woff2");
}
`.trim();
}

/**
 * `--vera5-*` custom properties for injected UI roots.
 * Values mirror `styles/tokens.css` / `VERA5_*` so overlay, workspace, and
 * extension pages share one brand palette.
 */
export function buildVera5ContentUiTokenDeclarations(): string {
  const c = VERA5_COLOR;
  const r = VERA5_RADIUS;
  const s = VERA5_SHADOW;
  const f = VERA5_FONT;
  return `
  --vera5-page: ${c.bg};
  --vera5-surface: ${c.surface};
  --vera5-surface-raised: ${c.surfaceRaised};
  --vera5-text: ${c.text};
  --vera5-border: ${c.borderHard};
  --vera5-border-soft: ${c.border};
  --vera5-accent: ${c.accent};
  --vera5-accent-hover: ${c.accentHover};
  --vera5-accent-strong: ${c.accentStrong};
  --vera5-accent-text: ${c.accentText};
  --vera5-on-accent: ${c.onAccent};
  --vera5-muted: ${c.textMuted};
  --vera5-muted-label: ${c.textMuted};
  --vera5-text-low: ${c.textLow};
  --vera5-error: ${c.danger};
  --vera5-ready: ${c.text};
  --vera5-success: ${c.success};
  --vera5-violet: ${c.violet};
  --vera5-button-bg: ${c.surfaceSunken};
  --vera5-copy-success-bg: color-mix(in srgb, ${c.success} 16%, ${c.surface});
  --vera5-shadow: ${s.md};
  --vera5-shadow-low: ${s.sm};
  --vera5-radius-sm: ${r.sm}px;
  --vera5-radius-md: ${r.md}px;
  --vera5-radius-lg: ${r.lg}px;
  --vera5-font-ui: ${f.sans};
  --vera5-font-mono: ${f.mono};
  --vera5-font-wordmark: ${f.wordmark};
  --vera5-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --vera5-t-hover: ${VERA5_TRANSITION.fast};
  --vera5-t-card: ${VERA5_TRANSITION.base};
`.trim();
}
