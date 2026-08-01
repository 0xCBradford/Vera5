/**
 * Phase 4 — VERA5 UI icon system.
 * Sole general-purpose icon family: Phosphor (`@phosphor-icons/react`).
 * Import only icons used by the Chrome workspace; do not barrel-import the package.
 */
import type { Icon, IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArrowCounterClockwise,
  BookOpen,
  BracketsCurly,
  Bug,
  CaretDown,
  CaretRight,
  CirclesThreePlus,
  Copy,
  Crosshair,
  Database,
  DotsThree,
  FileText,
  GearSix,
  Globe,
  GridFour,
  HardDrives,
  IdentificationCard,
  Info,
  MagnifyingGlass,
  MagnifyingGlassPlus,
  Minus,
  Network,
  Plus,
  Pulse,
  Selection,
  ShareNetwork,
  ShieldCheck,
  ShieldWarning,
  SquaresFour,
  TreeStructure,
  Warning,
  X,
} from "@phosphor-icons/react";

/** Phase 1 icon-size tokens (px). */
export const VERA_ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export type VeraIconSizeToken = keyof typeof VERA_ICON_SIZE;

/**
 * Weight rules:
 * - `regular` — default for ordinary UI icons
 * - `bold` — primary command emphasis only (SCAN PAGE)
 * - `fill` — reserved for selected/critical affordances (not used as default)
 */
export const VERA_ICON_WEIGHT = {
  default: "regular" as const satisfies IconWeight,
  primary: "bold" as const satisfies IconWeight,
};

export type VeraIconProps = {
  icon: Icon;
  size?: VeraIconSizeToken | number;
  weight?: IconWeight;
  className?: string;
  /** Decorative when true (default). Icon-only controls must pass decorative={false} + label. */
  decorative?: boolean;
  label?: string;
} & Omit<IconProps, "size" | "weight" | "className" | "children">;

export function VeraIcon({
  icon: IconComponent,
  size = "sm",
  weight = VERA_ICON_WEIGHT.default,
  className,
  decorative = true,
  label,
  ...rest
}: VeraIconProps) {
  const px = typeof size === "number" ? size : VERA_ICON_SIZE[size];
  return (
    <IconComponent
      size={px}
      weight={weight}
      className={className}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative ? label : undefined}
      role={!decorative && label ? "img" : undefined}
      {...rest}
    />
  );
}

/** Named UI icons used by the Chrome side panel (tree-shaken individual imports). */
export const VeraUiIcons = {
  howTo: BookOpen,
  settings: GearSix,
  permissions: ShieldCheck,
  scanSection: Crosshair,
  scanPage: Crosshair,
  scanSelection: Selection,
  enrichSelection: MagnifyingGlassPlus,
  intelSection: Pulse,
  enrich: Database,
  research: MagnifyingGlass,
  copy: Copy,
  exportMarkdown: FileText,
  exportJson: BracketsCurly,
  moreFormats: DotsThree,
  warning: Warning,
  info: Info,
  collections: SquaresFour,
  detectedSection: Crosshair,
  investigationSection: ShareNetwork,
  malware: Bug,
  detections: MagnifyingGlass,
  infrastructure: HardDrives,
  campaign: TreeStructure,
  mitre: GridFour,
  family: ShareNetwork,
  cve: ShieldWarning,
  chevron: CaretDown,
  chevronRight: CaretRight,
  plus: Plus,
  minus: Minus,
  search: MagnifyingGlass,
  clear: X,
  reset: ArrowCounterClockwise,
  network: Network,
  globe: Globe,
  identification: IdentificationCard,
  threatIntel: Database,
  genericSource: CirclesThreePlus,
  pulse: Pulse,
} as const;

export type InvestigationGlyphName =
  | "compass"
  | "malware"
  | "detections"
  | "infra"
  | "campaign"
  | "clipboard"
  | "mitre"
  | "family"
  | "cve"
  | "chevron"
  | "dot";

const INVESTIGATION_GLYPH_MAP: Record<Exclude<InvestigationGlyphName, "dot">, Icon> = {
  compass: ShareNetwork,
  malware: Bug,
  detections: MagnifyingGlass,
  infra: HardDrives,
  campaign: TreeStructure,
  clipboard: Copy,
  mitre: GridFour,
  family: ShareNetwork,
  cve: ShieldWarning,
  chevron: CaretDown,
};

/**
 * Investigation Paths glyph bridge — Phosphor replacements for prior inline SVGs.
 * `dot` renders a CSS mark (status-dot family), not a Phosphor icon.
 */
export function InvestigationGlyph({
  name,
  size = "xs",
}: {
  name: InvestigationGlyphName | string;
  size?: VeraIconSizeToken;
}) {
  if (name === "dot") {
    return <span className="vera5-ip-context-dot-mark" aria-hidden="true" />;
  }
  const icon = INVESTIGATION_GLYPH_MAP[name as Exclude<InvestigationGlyphName, "dot">];
  if (!icon) {
    return <VeraIcon icon={CirclesThreePlus} size={size} />;
  }
  return <VeraIcon icon={icon} size={size} />;
}
