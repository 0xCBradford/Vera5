# Browser support

Vera5 ships two Manifest V3 extension builds from the same source tree: **`extension/dist/`** for Chromium-based browsers and **`extension/dist-firefox/`** for Firefox. Analyst-facing behavior is intended to match; validation depth and distribution paths differ today.

For permissions, data boundaries, and BYOK posture (unchanged across browsers), see [security-model.md](security-model.md) and [SECURITY.md](../SECURITY.md).

## Supported browsers

| Browser | Build output | Support level |
|---------|--------------|---------------|
| **Chromium** (Chrome, Edge, Brave, and similar MV3 browsers) | `extension/dist/` | **Primary.** Recommended for day-to-day triage. Pull-request CI runs automated browser smokes against this build. |
| **Firefox** (Gecko, Manifest V3) | `extension/dist-firefox/` | **Experimental port.** Same feature surface in code; load as a temporary add-on only. Not published on Firefox Add-ons (AMO). Automated release gates still target Chromium. |

## Chromium (recommended)

- Background work runs in a Manifest V3 **service worker** (`background.service_worker` in `extension/public/manifest.json`).
- Install via the standard **Load unpacked** developer workflow pointing at `extension/dist/` after `npm run build` in `extension/`.
- Per-tab scan snapshots and tray filters use **`storage.session`**, which is available on supported Chromium versions.
- See [README.md](../README.md) for install, configuration, and operator workflows.

## Firefox (experimental)

- Background work uses Firefox MV3 **event background scripts** (`background.scripts` in `extension/public/manifest.firefox.json`) instead of a persistent service worker. Shared logic is the same bundle; lifecycle and wake timing can differ under memory pressure.
- A **`browser.*` compatibility shim** (`extension/src/lib/browserCompat.ts`) maps promise-based Firefox APIs onto the shared `chrome.*` call sites used in Chromium.
- Manifest permissions and declared vendor host patterns match the Chromium manifest; Gecko-specific metadata (extension ID, minimum version) lives under `browser_specific_settings.gecko`.
- Build with `npm run build:firefox` in `extension/` to produce `extension/dist-firefox/`.

## Installing Vera5 on Firefox (temporary add-on)

Firefox does not support Chrome’s persistent **Load unpacked** workflow. Install Vera5 as a **temporary add-on** from a local build of `extension/dist-firefox/`. The add-on is removed when Firefox fully exits.

### Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Firefox 115+** | Recommended for `storage.session` parity with Chromium tab-tray behavior. Manifest minimum is Firefox **109**. |
| **Node.js and npm** | To build from source (see below). |
| **Repository checkout** | Clone or download this repo; instructions assume you build locally. |

### Build from source

From the repository root:

```bash
cd extension
npm ci
npm run build:firefox
```

This writes **`extension/dist-firefox/`** with `manifest.json` at the directory root and runs manifest, dist, and security checks on that output. Re-run **`npm run build:firefox`** after pulling changes or editing extension code.

### Load the temporary add-on

1. Open **`about:debugging#/runtime/this-firefox`** in Firefox (paste into the address bar).
2. Under **This Firefox** (or **This Nightly** on developer builds), click **Load Temporary Add-on…**.
3. In the file picker, open **`extension/dist-firefox/`** and select **`manifest.json`** (the file, not the folder).

Firefox lists Vera5 under **about:addons** with a **temporary** badge. Pin the toolbar action if your browser hides new extensions.

### Confirm it works

1. Click the Vera5 toolbar action — the popup should open.
2. On first install, **Vera5 Settings** may open automatically; finish the install quick-start or dismiss it, then configure API keys if you need live enrichment.
3. Serve a fixture page over HTTP (for example `examples/sample-alert.html` via a local static server), open it in Firefox, and use **Scan page** from the popup or **Ctrl+Shift+Y** / **Cmd+Shift+Y**.
4. Click a highlighted indicator to open the on-page overlay.

For day-to-day operator flows after install, see [analyst-workflows.md](analyst-workflows.md).

### Reload after rebuilding

Temporary add-ons do not pick up disk changes automatically.

1. Run **`npm run build:firefox`** again in `extension/`.
2. In **`about:debugging#/runtime/this-firefox`**, click **Reload** on the Vera5 entry, **or** remove the add-on and **Load Temporary Add-on…** again with the updated `manifest.json`.

### Prebuilt artifact from CI (optional)

Pull-request CI builds `dist-firefox/` and uploads it as a workflow artifact (`firefox-artifact` job in `.github/workflows/extension-quality.yml`). Download and unzip the artifact, then load **`manifest.json`** from the unpacked directory using the same temporary add-on steps above.

### What temporary install does not provide

- **Persistence across browser restarts** — reload after every full Firefox exit.
- **Firefox Add-ons (AMO) distribution** — no signed listing in this repository today.
- **Parity with Chromium CI gates** — optional local Firefox smokes exist for contributors; primary release validation still targets Chromium.

For known platform differences, see [Known Firefox gaps and limitations](#known-firefox-gaps-and-limitations) below.

## Host permissions and connector endpoints

Both manifests declare the same `host_permissions`: broad `http://*/*` and `https://*/*` for content scripts on analyst pages, plus an explicit `https://<host>/*` entry for each live enrichment connector API hostname. The canonical hostname list lives in `extension/src/lib/iocRequestBoundaries.ts` as `DECLARED_ENRICHMENT_API_HOSTS` and is derived from the connector modules (AbuseIPDB, OTX, URLScan.io, GreyNoise, VirusTotal, Shodan, Censys).

| Declared connector API host | Connector module | Live HTTPS enrichment today |
|-----------------------------|------------------|----------------------------|
| `api.abuseipdb.com` | `abuseipdbConnector.ts` | Yes (IPv4) |
| `otx.alienvault.com` | `otxConnector.ts` | Yes (multi-type) |
| `urlscan.io` | `urlscanConnector.ts` | Yes (domain, URL) |
| `api.greynoise.io` | `greynoiseConnector.ts` | Yes (IPv4 community) |
| `www.virustotal.com` | `virustotalConnector.ts` | Allowlisted; live fetch not enabled in product today |
| `api.shodan.io` | `shodanConnector.ts` | Yes (IPv4, domain) |
| `search.censys.io` | `censysConnector.ts` | Yes (IPv4) |

**Runtime guard:** `enrichmentFetch` in `iocRequestBoundaries.ts` throws before network I/O when a connector targets a host outside `DECLARED_ENRICHMENT_API_HOSTS`, uses non-HTTPS, or sends a request body. Only approved connector modules may call vendor `fetch()`.

**Optional localhost paths:** When enabled, the optional local backend (`http://127.0.0.1:8765/…`) and local AI summary (`http://127.0.0.1:11434/…`) rely on the broad `http://*/*` permission—not separate manifest entries—and are restricted to `127.0.0.1` in code.

**Audit status (Chromium and Firefox):** `npm run verify:firefox-manifest` in `extension/` asserts Chromium/Firefox manifest parity and that both manifests include explicit permissions covering every declared connector host. `npm run verify:security` (Chromium `dist/` post-build) and `npm run verify:security:firefox` (`dist-firefox/` after `npm run build:firefox`) cross-check shipped popup/options HTML for remote assets, default MV3 CSP posture (no manifest override with `unsafe-eval`, `unsafe-inline`, or remote `script-src`), and production bundles for remote dynamic imports. Unit tests in `iocRequestBoundaries.test.ts`, `serviceWorker.test.ts`, and `firefoxApiParity.test.ts` cross-check connector base URLs against the declared host list. **No host-permission gaps** were found between manifests and connector endpoints at audit time.

## Content security and remote origins (Firefox)

Firefox uses the same Vite bundles and extension pages as Chromium. Neither manifest sets a custom `content_security_policy`; both rely on default Manifest V3 extension-page rules (`script-src 'self'`).

| Check | Chromium | Firefox |
|-------|----------|---------|
| Custom manifest CSP override | None (default MV3) | None (default MV3) |
| Popup/options HTML remote assets | Blocked by `verify:security` on `dist/` | Blocked by `verify:security:firefox` on `dist-firefox/` |
| Packaged fonts | Local `woff2` under `/fonts` via `web_accessible_resources` | Same `web_accessible_resources` entries as Chromium |
| Live vendor `fetch()` | Connector modules + `enrichmentFetch` allowlist | Same shared source; no Firefox-specific remote origins |
| Remote code at runtime | No `import()` / `importScripts()` from `https://` in production bundles | Same bundles; verified on `dist-firefox/` |

Optional localhost enrichment and local AI summary paths (`127.0.0.1`) use the broad `http://*/*` permission and are restricted to loopback in code—not separate manifest CSP entries.

## Telemetry (Firefox)

The Firefox port does not add usage analytics, crash reporting, or Vera5-operated phone-home endpoints beyond the Chromium build.

| Check | Chromium | Firefox |
|-------|----------|---------|
| Mozilla `data_collection_permissions` | N/A | `required: ["none"]` in `manifest.firefox.json` |
| Shared source bundles | Same Vite output; no Firefox-only telemetry modules | Same bundles under `dist-firefox/` |
| Outbound `fetch()` | Connector allowlist + `enrichmentFetch` only | Same shared code |
| Analytics SDK hosts in production JS | Absent (`verify:security` on `dist/`) | Absent (`verify:security:firefox` on `dist-firefox/`) |
| Maintainer telemetry | None by default | None by default |

**Audit status:** `npm run verify:firefox-manifest` requires `data_collection_permissions.required` to be `["none"]`. `npm run verify:security:firefox` scans shipped bundles for common analytics/crash-reporting host strings and reuses the same live-fetch and logging guards as Chromium. **No additional telemetry** was found in the Firefox build path at audit time.

## Known Firefox gaps and limitations

These are the shipped gaps as of the dual-target port. They describe what analysts and operators should expect today—not a roadmap.

### Distribution and validation

| Gap | Impact |
|-----|--------|
| **No AMO listing or signed package** | Firefox users cannot install Vera5 from Mozilla Add-ons. Only a locally built **`dist-firefox/`** temporary add-on is supported. |
| **No Chromium-style Load unpacked** | Firefox does not offer the same persistent unpacked load path as Chrome. You must install the build as a **temporary add-on** (session ends when Firefox closes). |
| **Chromium-first CI** | Pull-request automation builds the Firefox artifact and runs Chromium browser smokes on mocked vendors. Firefox browser smokes are optional locally (`npm run test:e2e:firefox` in `extension/`); they do not gate merge today. |
| **Shallower automated coverage on Firefox** | Optional Firefox smokes cover temporary add-on load, content-script readiness, scan → hover → cache-backed enrich → export on `examples/sample-alert.html`. They do not replay the full Chromium E2E matrix. Manual Firefox validation is still recommended before relying on the port in production triage. |

### Platform and storage

| Gap | Impact |
|-----|--------|
| **`storage.session` minimum version** | Tab scan snapshots and per-tab tray filters persist in **`chrome.storage.session`**. Firefox added `storage.session` in **Firefox 115**. The Firefox manifest declares **`strict_min_version` 109**, so Firefox **109–114** may run the add-on but **without session storage**. Helpers degrade safely: session reads return empty and session writes no-op; the popup tray may rely on background messaging instead of session-backed snapshots on those versions. **Use Firefox 115 or newer** for parity with Chromium tab-tray behavior. |
| **Event background vs service worker** | Firefox wakes the background script on events rather than keeping a persistent worker. Rare delays are possible for enrichment, scan summary, or context-menu registration immediately after install or under heavy memory pressure. |
| **Context menu registration style** | Selection context menu setup uses callback-style `contextMenus.removeAll` before create. This is supported on Firefox today; promise-only migration is a maintainability follow-up, not an analyst-visible feature gap. |

### Feature parity intent

| Area | Status |
|------|--------|
| **Core investigation path** | Scan, on-page overlay, manual/auto enrichment, composite risk score, export, sessions, collections, and trust gates are implemented in shared code and exercised by optional Firefox smokes on a fixture page. |
| **Live vendor HTTP** | Same connector set and BYOK model as Chromium; outbound calls still go only to declared vendor hosts you enable. Primary automated vendor-mock coverage remains on Chromium. |
| **Local backend and local AI summary** | Same localhost-only optional paths (`127.0.0.1`); no Vera5-operated relay on either browser. |
| **Telemetry** | No usage analytics or Vera5 phone-home on either build. |

### What is not a Firefox gap

- **Safari / WebKit** — out of scope; no build in this repository.
- **BYOK and local-first storage** — API keys and enrichment cache remain in local browser storage on Firefox the same as on Chromium.
- **Indicator-only vendor payloads** — enrichment still sends only the selected indicator value, not full page content.

## Related documentation

| Topic | Document |
|-------|----------|
| Architecture and dual-target build | [architecture.md](architecture.md), [contributors/extension-architecture.md](contributors/extension-architecture.md) |
| Operator workflows | [analyst-workflows.md](analyst-workflows.md) |
| Contributor testing (including optional Firefox smokes) | [contributors/testing.md](contributors/testing.md) |
| Permissions and security | [security-model.md](security-model.md) |
