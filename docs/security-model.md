# Vera5 security model

This document explains why the Manifest V3 extension requests each permission in [`extension/public/manifest.json`](../extension/public/manifest.json). It complements [SECURITY.md](../SECURITY.md) (threat model and reporting) and [architecture.md](architecture.md) (module layout and data boundaries).

Vera5 is **local-first**: enrichment uses API keys you configure; indicator values are sent only to vendors you enable—not to Vera5-operated infrastructure.

## Current release scope

The shipped extension registers a Manifest V3 service worker, content scripts on HTTP/HTTPS pages, a toolbar popup, and an options page. On pages you open, Vera5 can scan visible text for IOCs, show on-page highlights, open a production hover overlay, and—when you configure API keys—fetch enrichment from AbuseIPDB and OTX directly from the background worker. Settings, API keys, and enrichment cache stay in local browser storage. There is no Vera5-operated enrichment backend and no default telemetry. Permission rationale below matches this behavior.

## Manifest permissions

| Permission | Required | Why Vera5 needs it |
|------------|----------|-------------------|
| `storage` | Yes | Persist analyst-controlled settings locally in the browser: extension on/off, API keys (masked at rest in UI), per-source toggles, enrichment cache entries, and related options. No Vera5 cloud sync; data stays in `chrome.storage.local` (or equivalent) on your profile. |
| `activeTab` | Yes | Operate on the tab you are viewing when you invoke the extension (toolbar action, keyboard shortcut, or future on-demand actions) without requesting blanket access to every tab’s URL up front. Supports analyst-driven, tab-scoped behavior aligned with “enrich what I’m looking at now.” |
| `scripting` | Yes | Inject or update page scripts when needed for IOC detection and UI (for example programmatic injection on demand, re-scan after navigation, or future manual-only modes). Content scripts are declared in the manifest; `scripting` covers dynamic injection paths the product may use without listing every site pattern twice. |

### What these permissions do not grant

- **`storage`** does not send data to Vera5 servers; it is local browser storage only.
- **`activeTab`** does not by itself read page content until you interact with the extension in that tab (combined with host access below for declared content scripts).
- **`scripting`** is not used to run remote code, `eval`, or maintainer-hosted scripts—all executable code ships inside the extension package reviewers install.

## Host permissions

| Pattern | Required | Why Vera5 needs it |
|---------|----------|-------------------|
| `http://*/*` | Yes | Analyst workflows include internal tools, blogs, ticketing mirrors, and lab pages served over HTTP. IOC text must be readable on those origins when you visit them. |
| `https://*/*` | Yes | Same for HTTPS sites (GitHub, vendor portals, search results, documentation). Broad match avoids maintaining an incomplete allowlist of analyst destinations. |

### How host access is used

- **Content scripts** (see manifest `content_scripts`) run at `document_idle` on matching pages, scan visible text for IOCs when you trigger a scan (or when auto-scan is enabled), and render the on-page hover overlay.
- **Page text** is processed in the browser for detection. Only **indicator values you choose to enrich** are sent in API requests to third parties you configure—not full page HTML to Vera5 infrastructure.
- **Skip rules:** ignore `script`, `style`, and `textarea` text by default; respect manual-only enrichment and per-source toggles in settings.

### Why broad host patterns

Analysts cannot predict every SOC, CTI, or DFIR site in advance. Narrow host lists would block legitimate workflows. The tradeoff is explicit: Vera5 may access pages you open on HTTP/HTTPS origins you visit; you control whether enrichment runs and which vendors receive IOC values.

## Surfaces declared in the manifest (not separate permission keys)

| Surface | Purpose |
|---------|---------|
| `background` service worker (`background.js`, ES module) | Message routing, enrichment fetch orchestration, cache, rate-limit cooldown, and connector calls. No DOM access. |
| `content_scripts` → `content.js` on `http://*/*`, `https://*/*` | IOC detection, highlights, production hover overlay, and enrich wiring. Runs only on origins covered by host permissions. |
| `action` popup (`popup.html`) | Extension on/off, highlight toggle, scan page, match count. |
| `options_page` (`options.html`) | Masked API keys, source toggles, manual-only mode, cache clear, settings export/import. |

Icons and HTML entrypoints do not add extra Chrome permission keys beyond those listed above.

## Data and trust boundaries

| Data | Stays local | May leave the browser (your choice) |
|------|-------------|-----------------------------------|
| API keys | Stored in extension storage (or optional self-hosted env you control) | Sent only to vendor APIs you enable, over TLS, as required by each connector |
| Extension enabled flag, UI settings | Yes | No |
| Detected IOC values | Processed locally for display | Sent as **indicator-only** requests to configured threat-intel APIs |
| Full page HTML, browsing history, tickets | Not uploaded to Vera5-operated services | Not sent to Vera5 by design |

**Bring-your-own keys / bring-your-own API:** You create keys in vendor portals; Vera5 does not operate a required enrichment proxy or shared maintainer keys.

**Telemetry:** No usage analytics or crash reporting to Vera5 by default.

## Permission changes

Any new permission or host pattern requires an update to this document, [SECURITY.md](../SECURITY.md), the manifest, and the Chrome Web Store listing so analysts can review the change before upgrading.

## Executable code and content security policy

| Check | Status |
|-------|--------|
| `eval()` / `new Function()` | Not used in `extension/src/` or production bundles under `extension/dist/`. |
| Remote scripts | Popup, options, background, and content bundles load only packaged assets (`chrome-extension://…` / relative `/assets/…` paths). No `https://` script or stylesheet URLs in built HTML. |
| Manifest CSP override | [`extension/public/manifest.json`](../extension/public/manifest.json) does not set a custom `content_security_policy` with `unsafe-eval` or `unsafe-inline`. Extension pages use Chromium’s default Manifest V3 CSP (`script-src 'self'`, WASM and local extension origins only). |
| Remote code at runtime | No `importScripts()` or dynamic `import()` from network URLs in shipped bundles. Future connector HTTP calls will fetch JSON API responses, not executable script. |

Automated checks run after each production build:

```bash
cd extension
npm run verify:security
```

(`postbuild` runs this together with `verify:dist`.)

## Related documents

- [SECURITY.md](../SECURITY.md) — vulnerability reporting and high-level threat model
- [architecture.md](architecture.md) — codebase layout, MVP IOC types, connector order
- [README.md](../README.md) — install and development workflow
