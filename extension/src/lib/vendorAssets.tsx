/**
 * Phase 4 / 14Q / 14V / 14V.1 — Vendor visual-asset registry (presentation only).
 * Does not participate in enrichment, scoring, or source enablement logic.
 *
 * Phase 14V — local bundled vendor marks where approved; distinctive Phosphor
 * fallback glyphs otherwise (OTX / RDAP remain fallback-only until dedicated assets exist).
 * Phase 14V.1 — brand color allowed inside tiny marks; Censys uses ultra-wide footprint.
 */
import { useState, type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  Binoculars,
  Browser,
  Bug,
  CirclesThreePlus,
  Crosshair,
  Database,
  Globe,
  IdentificationCard,
  LinkSimple,
  Network,
  Pulse,
  Scan,
  ShieldCheck,
  ShieldWarning,
  WaveSine,
} from "@phosphor-icons/react";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import { VENDOR_ASSET } from "./uiAssetRegistry";
import { VeraIcon, type VeraIconSizeToken } from "./veraIcons";

export type VendorAssetCategory =
  | "threat_intelligence"
  | "malware_intelligence"
  | "infrastructure_search"
  | "reputation"
  | "registry"
  | "search_pivot"
  | "generic";

/** Phase 14Q — distinctive identity glyphs (one shape family per vendor). */
export type VendorFallbackIconId =
  | "scan"
  | "crosshair"
  | "shieldCheck"
  | "shieldWarning"
  | "wave"
  | "browser"
  | "globe"
  | "binoculars"
  | "pulse"
  | "bug"
  | "link"
  | "network"
  | "identification"
  | "database"
  | "generic";

export type VendorAssetEntry = {
  sourceId: EnrichmentSourceId;
  displayName: string;
  /** Vite-bundled local logo URL, or null when using fallback glyph. */
  localAsset: string | null;
  fallbackIcon: VendorFallbackIconId;
  category: VendorAssetCategory;
  accessibilityLabel: string;
  attributionId: string;
};

const FALLBACK_ICON_MAP: Record<VendorFallbackIconId, Icon> = {
  scan: Scan,
  crosshair: Crosshair,
  shieldCheck: ShieldCheck,
  shieldWarning: ShieldWarning,
  wave: WaveSine,
  browser: Browser,
  globe: Globe,
  binoculars: Binoculars,
  pulse: Pulse,
  bug: Bug,
  link: LinkSimple,
  network: Network,
  identification: IdentificationCard,
  database: Database,
  generic: CirclesThreePlus,
};

function bundledVendorAsset(sourceId: EnrichmentSourceId): string | null {
  if (sourceId in VENDOR_ASSET) {
    return VENDOR_ASSET[sourceId as keyof typeof VENDOR_ASSET];
  }
  return null;
}

const VENDOR_ASSET_BY_ID: Record<EnrichmentSourceId, VendorAssetEntry> = {
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
    sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
    displayName: "VirusTotal",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.VIRUSTOTAL),
    fallbackIcon: "scan",
    category: "threat_intelligence",
    accessibilityLabel: "VirusTotal",
    attributionId: "vendor-virustotal",
  },
  [ENRICHMENT_SOURCE.OTX]: {
    sourceId: ENRICHMENT_SOURCE.OTX,
    displayName: "OTX",
    /** No dedicated OTX asset in the bundled pack — keep Phosphor fallback. */
    localAsset: null,
    fallbackIcon: "crosshair",
    category: "threat_intelligence",
    accessibilityLabel: "AlienVault OTX",
    attributionId: "vendor-otx",
  },
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
    displayName: "AbuseIPDB",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.ABUSEIPDB),
    fallbackIcon: "shieldCheck",
    category: "reputation",
    accessibilityLabel: "AbuseIPDB",
    attributionId: "vendor-abuseipdb",
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    sourceId: ENRICHMENT_SOURCE.GREYNOISE,
    displayName: "GreyNoise",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.GREYNOISE),
    fallbackIcon: "wave",
    category: "reputation",
    accessibilityLabel: "GreyNoise",
    attributionId: "vendor-greynoise",
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    sourceId: ENRICHMENT_SOURCE.URLSCAN,
    displayName: "URLScan.io",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.URLSCAN),
    fallbackIcon: "browser",
    category: "infrastructure_search",
    accessibilityLabel: "URLScan.io",
    attributionId: "vendor-urlscan",
  },
  [ENRICHMENT_SOURCE.SHODAN]: {
    sourceId: ENRICHMENT_SOURCE.SHODAN,
    displayName: "Shodan",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.SHODAN),
    fallbackIcon: "globe",
    category: "infrastructure_search",
    accessibilityLabel: "Shodan",
    attributionId: "vendor-shodan",
  },
  [ENRICHMENT_SOURCE.CENSYS]: {
    sourceId: ENRICHMENT_SOURCE.CENSYS,
    displayName: "Censys",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.CENSYS),
    fallbackIcon: "binoculars",
    category: "infrastructure_search",
    accessibilityLabel: "Censys",
    attributionId: "vendor-censys",
  },
  [ENRICHMENT_SOURCE.PULSEDIVE]: {
    sourceId: ENRICHMENT_SOURCE.PULSEDIVE,
    displayName: "Pulsedive",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.PULSEDIVE),
    fallbackIcon: "pulse",
    category: "threat_intelligence",
    accessibilityLabel: "Pulsedive",
    attributionId: "vendor-pulsedive",
  },
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
    sourceId: ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
    displayName: "Google Safe Browsing",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING),
    fallbackIcon: "shieldWarning",
    category: "reputation",
    accessibilityLabel: "Google Safe Browsing",
    attributionId: "vendor-google-safe-browsing",
  },
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
    sourceId: ENRICHMENT_SOURCE.MALWAREBAZAAR,
    displayName: "MalwareBazaar",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.MALWAREBAZAAR),
    fallbackIcon: "bug",
    category: "malware_intelligence",
    accessibilityLabel: "MalwareBazaar",
    attributionId: "vendor-malwarebazaar",
  },
  [ENRICHMENT_SOURCE.THREATFOX]: {
    sourceId: ENRICHMENT_SOURCE.THREATFOX,
    displayName: "ThreatFox",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.THREATFOX),
    fallbackIcon: "network",
    category: "malware_intelligence",
    accessibilityLabel: "ThreatFox",
    attributionId: "vendor-threatfox",
  },
  [ENRICHMENT_SOURCE.URLHAUS]: {
    sourceId: ENRICHMENT_SOURCE.URLHAUS,
    displayName: "URLHaus",
    localAsset: bundledVendorAsset(ENRICHMENT_SOURCE.URLHAUS),
    fallbackIcon: "link",
    category: "malware_intelligence",
    accessibilityLabel: "URLHaus",
    attributionId: "vendor-urlhaus",
  },
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: {
    sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
    displayName: "RDAP/WHOIS",
    localAsset: null,
    fallbackIcon: "identification",
    category: "registry",
    accessibilityLabel: "RDAP/WHOIS",
    attributionId: "vendor-rdap-whois",
  },
};

export function getVendorAsset(sourceId: EnrichmentSourceId): VendorAssetEntry {
  return VENDOR_ASSET_BY_ID[sourceId];
}

export function listVendorAssets(): readonly VendorAssetEntry[] {
  return ENRICHMENT_SOURCE_ORDER.map((id) => VENDOR_ASSET_BY_ID[id]);
}

export function getVendorFallbackIcon(sourceId: EnrichmentSourceId): Icon {
  return FALLBACK_ICON_MAP[getVendorAsset(sourceId).fallbackIcon];
}

export function resolveVendorVisual(
  sourceId: EnrichmentSourceId
): { kind: "logo"; src: string } | { kind: "fallback"; icon: Icon } {
  const entry = getVendorAsset(sourceId);
  if (entry.localAsset) {
    return { kind: "logo", src: entry.localAsset };
  }
  return { kind: "fallback", icon: FALLBACK_ICON_MAP[entry.fallbackIcon] };
}

type VendorMarkProps = {
  sourceId: EnrichmentSourceId;
  size?: VeraIconSizeToken;
  className?: string;
  /** When true (default), logo/fallback is decorative beside visible vendor name. */
  decorative?: boolean;
};

/**
 * Vendor identity mark for evidence rows.
 * Uses local approved logo when registered; otherwise distinctive Phosphor glyph.
 * Broken logo loads fall back without layout shift.
 */
export function VendorMark({
  sourceId,
  size = "sm",
  className,
  decorative = true,
}: VendorMarkProps): ReactNode {
  const entry = getVendorAsset(sourceId);
  const visual = resolveVendorVisual(sourceId);
  const [logoFailed, setLogoFailed] = useState(false);
  const markVariant =
    sourceId === ENRICHMENT_SOURCE.CENSYS
      ? " vera5-vendor-mark--wide vera5-vendor-mark--ultra-wide"
      : sourceId === ENRICHMENT_SOURCE.SHODAN
        ? " vera5-vendor-mark--wide"
        : "";

  if (visual.kind === "logo" && !logoFailed) {
    return (
      <span
        className={`vera5-vendor-mark${markVariant} ${className ?? ""}`.trim()}
      >
        <img
          className="vera5-vendor-mark-img"
          src={visual.src}
          alt=""
          aria-hidden={decorative ? true : undefined}
          aria-label={!decorative ? entry.accessibilityLabel : undefined}
          onError={() => setLogoFailed(true)}
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span className={`vera5-vendor-mark ${className ?? ""}`.trim()} aria-hidden="true">
      <VeraIcon icon={FALLBACK_ICON_MAP[entry.fallbackIcon]} size={size} />
    </span>
  );
}
