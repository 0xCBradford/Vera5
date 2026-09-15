/**
 * Phase 16C — VERA5 IOC glyph family (24×24 artboard, currentColor, small-size first).
 * Shared angular geometry; no embedded gradients, shadows, or backgrounds.
 */
import type { ReactNode, SVGProps } from "react";

export const IOC_GLYPH_VIEWBOX = "0 0 24 24";

type GlyphProps = SVGProps<SVGSVGElement>;

function GlyphShell({
  children,
  className,
  size = 24,
  ...rest
}: GlyphProps & { size?: number; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={IOC_GLYPH_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Web resource / directed address. */
export function IocGlyphUrl(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M4.5 7.5 9 12l-4.5 4.5V7.5Z"
        fill="currentColor"
      />
      <path
        d="M9.5 10.5h8v3h-8v-3Z"
        fill="currentColor"
      />
      <path
        d="M17.5 7.5 21 12l-3.5 4.5V7.5Z"
        fill="currentColor"
      />
    </GlyphShell>
  );
}

/** Network host / IPv4 address family. */
export function IocGlyphIp(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <rect x="5" y="5" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <path d="M12 5.5V8M12 16v2.5M5.5 12H8M16 12h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </GlyphShell>
  );
}

/** Named namespace / hostname hierarchy. */
export function IocGlyphDomain(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M12 4.5 16.5 8H14v3.5H10V8H7.5L12 4.5Z"
        fill="currentColor"
      />
      <path
        d="M8 13.5h3.5V19H8v-5.5ZM12.5 13.5H16V19h-3.5v-5.5Z"
        fill="currentColor"
      />
      <path d="M10 11.5h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </GlyphShell>
  );
}

/** Hash fingerprint family (MD5 / SHA1 / SHA256). */
export function IocGlyphHash(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M6 6h4.5v4.5H6V6Zm7.5 0H18v4.5h-4.5V6ZM6 13.5h4.5V18H6v-4.5Zm7.5 0H18V18h-4.5v-4.5Z"
        fill="currentColor"
      />
      <path d="M10.5 6v12M13.5 6v12M6 10.5h12M6 13.5h12" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
    </GlyphShell>
  );
}

/** Filesystem / resource path. */
export function IocGlyphPath(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M5.5 6.5h5l1.5 2H18.5V18h-13V6.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <path d="M8.5 12.5h7M8.5 15h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </GlyphShell>
  );
}

/** Autonomous network / routing organization. */
export function IocGlyphAsn(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <circle cx="15" cy="10" r="1.6" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" />
      <path d="M9.8 10.8 11.2 14M14.2 10.8 12.8 14" stroke="currentColor" strokeWidth="1.25" />
    </GlyphShell>
  );
}

/** Network range / CIDR block. */
export function IocGlyphCidr(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path d="M5 8.5v7M19 8.5v7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <path d="M7.5 6.5h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </GlyphShell>
  );
}

/** Message / address identity. */
export function IocGlyphEmail(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M4.5 7.5h15v9h-15v-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <path d="M4.5 8.5 12 13.5 19.5 8.5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="miter" />
    </GlyphShell>
  );
}

/** Vulnerability identifier — fracture, not warning triangle. */
export function IocGlyphCve(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M12 4.5 18.5 8v8L12 19.5 5.5 16V8L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </GlyphShell>
  );
}

/** Onion / hidden service namespace. */
export function IocGlyphOnion(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M12 5.5c3.5 0 6 2.2 6 5s-2.5 5-6 5-6-2.2-6-5 2.5-5 6-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 8c2 0 3.5 1.2 3.5 2.5S14 13 12 13s-3.5-1.2-3.5-2.5S10 8 12 8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="10.5" r="0.9" fill="currentColor" />
    </GlyphShell>
  );
}

/** Neutral unknown / fallback IOC type. */
export function IocGlyphUnknown(props: GlyphProps & { size?: number }) {
  const { size, ...rest } = props;
  return (
    <GlyphShell size={size} {...rest}>
      <path
        d="M12 4.5 18.5 8v8L12 19.5 5.5 16V8L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    </GlyphShell>
  );
}

export type IocGlyphComponent = typeof IocGlyphUrl;
