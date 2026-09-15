/**
 * Phase 16C — canonical VERA5 IOC visual registry.
 * Resolves type → glyph, label, color token. Presentation only; no detection logic.
 */
import type { ReactNode } from "react";
import { IOC_TYPE, type IocType } from "./iocRegex";
import { IOC_TYPE_TRAY_LABEL } from "./tabScanSummary";
import {
  IocGlyphAsn,
  IocGlyphCidr,
  IocGlyphCve,
  IocGlyphDomain,
  IocGlyphEmail,
  IocGlyphHash,
  IocGlyphIp,
  IocGlyphOnion,
  IocGlyphPath,
  IocGlyphUnknown,
  IocGlyphUrl,
  type IocGlyphComponent,
} from "./iocGlyphs";

/** Canonical semantic colors — mirror tokens.css data-ioc-type palette. */
export const IOC_TYPE_COLOR_TOKEN = {
  url: "#2db87a",
  ipv4: "#3aa7e8",
  domain: "#8d72e8",
  cidr: "#28a99e",
  asn: "#e17b32",
  md5: "#c64eae",
  sha1: "#c64eae",
  sha256: "#c64eae",
  email: "#d65c84",
  cve: "#d84b5f",
  filepath: "#687ebd",
  onion: "#945cc9",
  unknown: "#8793a8",
} as const;

export type IocVisualGlyphKey =
  | "url"
  | "ip"
  | "domain"
  | "hash"
  | "path"
  | "asn"
  | "cidr"
  | "email"
  | "cve"
  | "onion"
  | "unknown";

const GLYPH_BY_KEY: Record<IocVisualGlyphKey, IocGlyphComponent> = {
  url: IocGlyphUrl,
  ip: IocGlyphIp,
  domain: IocGlyphDomain,
  hash: IocGlyphHash,
  path: IocGlyphPath,
  asn: IocGlyphAsn,
  cidr: IocGlyphCidr,
  email: IocGlyphEmail,
  cve: IocGlyphCve,
  onion: IocGlyphOnion,
  unknown: IocGlyphUnknown,
};

/** CSS / legacy alias keys → canonical IocType or glyph bucket. */
export const IOC_TYPE_ALIAS: Record<string, IocType | "unknown"> = {
  ip: IOC_TYPE.IPV4,
  ipv6: IOC_TYPE.IPV4,
  dom: IOC_TYPE.DOMAIN,
  hostname: IOC_TYPE.DOMAIN,
  hash: IOC_TYPE.SHA256,
  file: IOC_TYPE.FILEPATH,
  path: IOC_TYPE.FILEPATH,
};

const GLYPH_KEY_BY_TYPE: Record<IocType, IocVisualGlyphKey> = {
  [IOC_TYPE.URL]: "url",
  [IOC_TYPE.IPV4]: "ip",
  [IOC_TYPE.DOMAIN]: "domain",
  [IOC_TYPE.MD5]: "hash",
  [IOC_TYPE.SHA1]: "hash",
  [IOC_TYPE.SHA256]: "hash",
  [IOC_TYPE.FILEPATH]: "path",
  [IOC_TYPE.ASN]: "asn",
  [IOC_TYPE.CIDR]: "cidr",
  [IOC_TYPE.EMAIL]: "email",
  [IOC_TYPE.CVE]: "cve",
  [IOC_TYPE.ONION]: "onion",
};

export type IocVisual = {
  canonicalType: IocType | "unknown";
  glyphKey: IocVisualGlyphKey;
  glyph: IocGlyphComponent;
  label: string;
  color: string;
  colorToken: keyof typeof IOC_TYPE_COLOR_TOKEN | "unknown";
};

export function resolveCanonicalIocType(type: string): IocType | "unknown" {
  const normalized = type.trim().toLowerCase();
  if ((Object.values(IOC_TYPE) as string[]).includes(normalized)) {
    return normalized as IocType;
  }
  if (normalized in IOC_TYPE_ALIAS) {
    return IOC_TYPE_ALIAS[normalized]!;
  }
  return "unknown";
}

export function getIocVisual(type: string): IocVisual {
  const canonicalType = resolveCanonicalIocType(type);
  if (canonicalType === "unknown") {
    return {
      canonicalType,
      glyphKey: "unknown",
      glyph: IocGlyphUnknown,
      label: type.trim().length > 0 ? type.toUpperCase() : "UNK",
      color: IOC_TYPE_COLOR_TOKEN.unknown,
      colorToken: "unknown",
    };
  }

  const glyphKey = GLYPH_KEY_BY_TYPE[canonicalType];
  const colorToken = canonicalType in IOC_TYPE_COLOR_TOKEN ? (canonicalType as keyof typeof IOC_TYPE_COLOR_TOKEN) : "unknown";

  return {
    canonicalType,
    glyphKey,
    glyph: GLYPH_BY_KEY[glyphKey],
    label: IOC_TYPE_TRAY_LABEL[canonicalType],
    color: IOC_TYPE_COLOR_TOKEN[colorToken as IocType] ?? IOC_TYPE_COLOR_TOKEN.unknown,
    colorToken: colorToken as keyof typeof IOC_TYPE_COLOR_TOKEN,
  };
}

export type IocTypeIconProps = {
  type: string;
  size?: number;
  className?: string;
};

/** Renders the canonical IOC glyph; inherits color from parent via currentColor. */
export function IocTypeIcon({ type, size = 16, className }: IocTypeIconProps): ReactNode {
  const visual = getIocVisual(type);
  const Glyph = visual.glyph;
  return <Glyph size={size} className={className} />;
}

/** @deprecated Phase 16C — use getIocVisual(). All types now resolve to inline SVG glyphs. */
export function resolveIocTypeAsset(_type: string): string | null {
  return null;
}
