# VERA5 visual-asset attribution

Repository traceability for third-party visual assets used by the Chrome extension.
This file does **not** appear in the analyst workspace UI.

Location: `extension/public/icons/` (alongside VERA5 brand toolbar assets).  
Retrieval date for this Phase 4 inventory: **2026-07-31**.

---

## UI icon family

| Field | Value |
|-------|-------|
| Family | Phosphor Icons |
| Package | `@phosphor-icons/react` |
| Version | see `extension/package.json` |
| Source | https://github.com/phosphor-icons/react |
| License | MIT |
| Modification | None (icons rendered via package components; `currentColor`) |
| Usage | Chrome side-panel UI icons (header, scan, intel, investigation paths, disclosures, export) |
| Runtime | Local / bundled — no CDN |

---

## VERA5 brand assets

| Filename | Location | Source | Modification | Usage |
|----------|----------|--------|--------------|-------|
| `logo-mark.png` | `extension/public/icons/` | VERA5-owned | None in Phase 4 | Side-panel / options wordmark mark |
| `icon16.png` … `icon128.png` | `extension/public/icons/` | Generated from logo-mark | Toolbar tile generation | Chrome / Firefox manifest icons |

---

## Vendor trademarks / logos

**No third-party vendor logo SVG or raster files are packaged in this release.**

For every intelligence source, VERA5 renders a **neutral Phosphor category fallback** beside the vendor display name. Fallbacks communicate source category (threat intelligence, malware, infrastructure, reputation, registry) and are **not** vendor monograms or AI-generated logos.

| Vendor / product | Internal key | Asset decision | Reason | Fallback category |
|------------------|--------------|----------------|--------|-------------------|
| VirusTotal | `virustotal` | Neutral fallback | No Priority 1–3 approved local logo on file | threat intelligence (`Database`) |
| AlienVault OTX | `otx` | Neutral fallback | No approved local logo on file | threat intelligence (`Database`) |
| AbuseIPDB | `abuseipdb` | Neutral fallback | No approved local logo on file | reputation (`ShieldCheck`) |
| GreyNoise | `greynoise` | Neutral fallback | No approved local logo on file | reputation (`ShieldWarning`) |
| URLScan.io | `urlscan` | Neutral fallback | No approved local logo on file | infrastructure (`Network`) |
| Shodan | `shodan` | Neutral fallback | No approved local logo on file | infrastructure (`Network`) |
| Censys | `censys` | Neutral fallback | No approved local logo on file | infrastructure (`Network`) |
| Pulsedive | `pulsedive` | Neutral fallback | No approved local logo on file | threat intelligence (`Database`) |
| Google Safe Browsing | `google_safe_browsing` | Neutral fallback | No approved local logo on file | reputation (`ShieldCheck`) |
| MalwareBazaar | `malwarebazaar` | Neutral fallback | No approved local logo on file | malware (`Bug`) |
| ThreatFox | `threatfox` | Neutral fallback | No approved local logo on file | malware (`Bug`) |
| URLHaus | `urlhaus` | Neutral fallback | No approved local logo on file | malware (`Bug`) |
| RDAP/WHOIS | `rdap_whois` | Neutral fallback | No approved local logo on file | registry (`IdentificationCard`) |

Registry implementation: `extension/src/lib/vendorAssets.tsx`.

### Trademark disclaimer

Third-party names and logos are trademarks of their respective owners. Their inclusion (or textual identification) identifies supported intelligence sources and does not imply endorsement, partnership, certification, or affiliation.

When an approved Priority 1–3 vendor mark is added in the future, place the SVG under a documented local vendors path, register it in `vendorAssets.tsx`, and record here:

- filename
- original source location or package
- copyright / trademark owner
- license or brand-kit terms
- retrieval date
- whether colors or geometry were altered (must remain: **not materially altered**)
- usage locations in VERA5

Do **not** obtain logos from image search, favicon services, unofficial repositories, AI generation, or hotlinked remote URLs.

---

## Custom VERA5 product SVGs (Phase 4)

None created. Improvised inline scan/investigation glyphs were replaced with Phosphor equivalents rather than new custom product icons.
