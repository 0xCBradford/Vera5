/**

 * Phase 14V / 14V.1 — centralized local UI / vendor asset URLs (presentation only).

 * Phase 16C — IOC type glyphs moved to iocVisualRegistry (inline SVG, currentColor).

 */

import type { ReactNode } from "react";

import { VERA_ICON_SIZE, type VeraIconSizeToken } from "./veraIcons";



import copyIocAsset from "../media/icons/Copy-IOC.svg";

import exportAsset from "../media/icons/export-Icon.svg";

import collectionsAsset from "../media/icons/Collections-Icon.svg";

import reloadAsset from "../media/icons/reload-icon.svg";

import warningAsset from "../media/icons/Warning-Triangle.png";

import infoHelpAsset from "../media/icons/information-help-svgrepo-com.svg";

import detectedIndicatorsAsset from "../media/icons/Detected-Indicators-Icon.png";

import investigationPathsAsset from "../media/icons/InvestigationPath-Icon.png";



import virustotalVendor from "../media/vendors/virustotal-svgrepo-com.svg";

import abuseipdbVendor from "../media/vendors/abuseipdb-logo.svg";

import urlscanVendor from "../media/vendors/Urlscan.io.svg";

import greynoiseVendor from "../media/vendors/330px-Greynoise_Logo.svg.webp";

import shodanVendor from "../media/vendors/330px-Logo_of_Shodan.svg.webp";

import censysVendor from "../media/vendors/Censys-Primary-logo-White.webp";

import googleSafeBrowsingVendor from "../media/vendors/google-icon-svgrepo-com.svg";

import pulsediveVendor from "../media/vendors/PulseDivelogo_community_light.svg";

import malwarebazaarVendor from "../media/vendors/malwarebazaar_logo.svg";

import threatfoxVendor from "../media/vendors/threatfox_logo.svg";

import urlhausVendor from "../media/vendors/urlhaus_logo.svg";

import abuseChVendor from "../media/vendors/abusedotch.svg";



export {

  getIocVisual,

  IocTypeIcon,

  IOC_TYPE_ALIAS,

  IOC_TYPE_COLOR_TOKEN,

  resolveCanonicalIocType,

  resolveIocTypeAsset,

  type IocVisual,

} from "./iocVisualRegistry";



/** Actions & module chrome icons (local SVG/PNG). */

export const UI_ASSET = {

  copyIoc: copyIocAsset,

  copySummary: copyIocAsset,

  exportOut: exportAsset,

  collections: collectionsAsset,

  reset: reloadAsset,

  warning: warningAsset,

  info: infoHelpAsset,

  detectedSection: detectedIndicatorsAsset,

  investigationSection: investigationPathsAsset,

} as const;



/** Vendor logos keyed by EnrichmentSourceId. OTX / RDAP intentionally omitted. */

export const VENDOR_ASSET = {

  virustotal: virustotalVendor,

  abuseipdb: abuseipdbVendor,

  urlscan: urlscanVendor,

  greynoise: greynoiseVendor,

  shodan: shodanVendor,

  censys: censysVendor,

  google_safe_browsing: googleSafeBrowsingVendor,

  pulsedive: pulsediveVendor,

  malwarebazaar: malwarebazaarVendor,

  threatfox: threatfoxVendor,

  urlhaus: urlhausVendor,

} as const;



export const ABUSE_CH_ASSET = abuseChVendor;



export type UiAssetId = keyof typeof UI_ASSET;



export type VeraAssetIconProps = {

  src: string;

  size?: VeraIconSizeToken | number;

  className?: string;

  decorative?: boolean;

  label?: string;

};



export function VeraAssetIcon({

  src,

  size = "sm",

  className,

  decorative = true,

  label,

}: VeraAssetIconProps): ReactNode {

  const px = typeof size === "number" ? size : VERA_ICON_SIZE[size];

  return (

    <img

      src={src}

      width={px}

      height={px}

      className={`vera5-asset-icon ${className ?? ""}`.trim()}

      alt=""

      aria-hidden={decorative ? true : undefined}

      aria-label={!decorative ? label : undefined}

      role={!decorative && label ? "img" : undefined}

      draggable={false}

    />

  );

}


