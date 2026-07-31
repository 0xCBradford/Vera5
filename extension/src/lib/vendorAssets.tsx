/**
 * Phase 4 — Vendor visual-asset registry (presentation only).
 * Does not participate in enrichment, scoring, or source enablement logic.
 *
 * No third-party vendor logo files are shipped until an approved Priority 1–3
 * source is documented. Every source uses a neutral Phosphor category fallback.
 */
import { useState, type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  Bug,
  CirclesThreePlus,
  Database,
  Globe,
  IdentificationCard,
  Network,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import { VeraIcon, type VeraIconSizeToken } from "./veraIcons";

export type VendorAssetCategory =
  | "threat_intelligence"
  | "malware_intelligence"
  | "infrastructure_search"
  | "reputation"
  | "registry"
  | "search_pivot"
  | "generic";

export type VendorFallbackIconId =
  | "database"
  | "bug"
  | "network"
  | "shieldCheck"
  | "shieldWarning"
  | "globe"
  | "identification"
  | "generic";

export type VendorAssetEntry = {
  sourceId: EnrichmentSourceId;
  displayName: string;
  /** Local packaged logo path under public/, or null when using fallback. */
  localAsset: string | null;
  fallbackIcon: VendorFallbackIconId;
  category: VendorAssetCategory;
  accessibilityLabel: string;
  attributionId: string;
};

const FALLBACK_ICON_MAP: Record<VendorFallbackIconId, Icon> = {
  database: Database,
  bug: Bug,
  network: Network,
  shieldCheck: ShieldCheck,
  shieldWarning: ShieldWarning,
  globe: Globe,
  identification: IdentificationCard,
  generic: CirclesThreePlus,
};

const VENDOR_ASSET_BY_ID: Record<EnrichmentSourceId, VendorAssetEntry> = {
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
    sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
    displayName: "VirusTotal",
    localAsset: null,
    fallbackIcon: "database",
    category: "threat_intelligence",
    accessibilityLabel: "VirusTotal",
    attributionId: "vendor-virustotal",
  },
  [ENRICHMENT_SOURCE.OTX]: {
    sourceId: ENRICHMENT_SOURCE.OTX,
    displayName: "OTX",
    localAsset: null,
    fallbackIcon: "database",
    category: "threat_intelligence",
    accessibilityLabel: "AlienVault OTX",
    attributionId: "vendor-otx",
  },
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
    displayName: "AbuseIPDB",
    localAsset: null,
    fallbackIcon: "shieldCheck",
    category: "reputation",
    accessibilityLabel: "AbuseIPDB",
    attributionId: "vendor-abuseipdb",
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    sourceId: ENRICHMENT_SOURCE.GREYNOISE,
    displayName: "GreyNoise",
    localAsset: null,
    fallbackIcon: "shieldWarning",
    category: "reputation",
    accessibilityLabel: "GreyNoise",
    attributionId: "vendor-greynoise",
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    sourceId: ENRICHMENT_SOURCE.URLSCAN,
    displayName: "URLScan.io",
    localAsset: null,
    fallbackIcon: "network",
    category: "infrastructure_search",
    accessibilityLabel: "URLScan.io",
    attributionId: "vendor-urlscan",
  },
  [ENRICHMENT_SOURCE.SHODAN]: {
    sourceId: ENRICHMENT_SOURCE.SHODAN,
    displayName: "Shodan",
    localAsset: null,
    fallbackIcon: "network",
    category: "infrastructure_search",
    accessibilityLabel: "Shodan",
    attributionId: "vendor-shodan",
  },
  [ENRICHMENT_SOURCE.CENSYS]: {
    sourceId: ENRICHMENT_SOURCE.CENSYS,
    displayName: "Censys",
    localAsset: null,
    fallbackIcon: "network",
    category: "infrastructure_search",
    accessibilityLabel: "Censys",
    attributionId: "vendor-censys",
  },
  [ENRICHMENT_SOURCE.PULSEDIVE]: {
    sourceId: ENRICHMENT_SOURCE.PULSEDIVE,
    displayName: "Pulsedive",
    localAsset: null,
    fallbackIcon: "database",
    category: "threat_intelligence",
    accessibilityLabel: "Pulsedive",
    attributionId: "vendor-pulsedive",
  },
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
    sourceId: ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
    displayName: "Google Safe Browsing",
    localAsset: null,
    fallbackIcon: "shieldCheck",
    category: "reputation",
    accessibilityLabel: "Google Safe Browsing",
    attributionId: "vendor-google-safe-browsing",
  },
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
    sourceId: ENRICHMENT_SOURCE.MALWAREBAZAAR,
    displayName: "MalwareBazaar",
    localAsset: null,
    fallbackIcon: "bug",
    category: "malware_intelligence",
    accessibilityLabel: "MalwareBazaar",
    attributionId: "vendor-malwarebazaar",
  },
  [ENRICHMENT_SOURCE.THREATFOX]: {
    sourceId: ENRICHMENT_SOURCE.THREATFOX,
    displayName: "ThreatFox",
    localAsset: null,
    fallbackIcon: "bug",
    category: "malware_intelligence",
    accessibilityLabel: "ThreatFox",
    attributionId: "vendor-threatfox",
  },
  [ENRICHMENT_SOURCE.URLHAUS]: {
    sourceId: ENRICHMENT_SOURCE.URLHAUS,
    displayName: "URLHaus",
    localAsset: null,
    fallbackIcon: "bug",
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
 * Vendor identity mark for cards and source tiles.
 * Uses local approved logo when registered; otherwise category Phosphor fallback.
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

  if (visual.kind === "logo" && !logoFailed) {
    return (
      <span className={`vera5-vendor-mark ${className ?? ""}`.trim()}>
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
