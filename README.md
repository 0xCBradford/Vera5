# Vera5

Browser extension for on-demand indicator detection on pages you browse. After a scan, matching indicators can be highlighted; clicking a highlight opens a hover card with copy, static deep-links, and—when configured—live threat intelligence from sources you enable. Settings, API keys, enrichment cache, and preferences stay in local browser storage. Vera5 does not operate a shared enrichment backend; you supply API keys and they remain on your machine.

## Operator surfaces

On `http://` and `https://` tabs, day-to-day triage runs through the **content-script on-page overlay**—not the React hover card used in unit tests.

| Surface | Where it runs | Role |
|---------|---------------|------|
| **On-page overlay** | Content script on the active page | **Primary operator UI:** highlights, hover card (type, value, enrichment summary, per-source badges, copy, pivot links). Open it by clicking a highlight after scan. |
| **Toolbar popup** | Extension action popup | Extension on/off, **Highlight indicators**, **Scan page**, and match count after a popup scan. |
| **Settings (options) page** | Dedicated options tab | Masked API keys, enrichment source toggles, manual-only mode, auto-scan, **Clear cache**, settings export/import. |
| **React hover card** | Unit tests only | **Not injected into page tabs.** Holds the full **composite risk score** presentation (band label, per-source contribution chips, disagreement callout). The default `npm run dev` page is a stub and does not mount this UI. The production overlay shows enrichment and risk-score **footer disclaimers** when applicable—not that full score UI. |

The keyboard shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y`) triggers the same page scan as **Scan page**; the match count appears in the popup only when you scan from there.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled**; **Highlight indicators** (default on); **Scan page** scans the active tab and shows a match count. Keyboard shortcut `Ctrl+Shift+Y` / `Cmd+Shift+Y` runs the same scan (count updates in the popup when you scan from there). |
| **On-page highlights** | After scan, detected indicators get an inline underline, type badge, and **›** enrich control when highlighting is enabled. |
| **Hover card** | Click a highlight on the page for the **on-page overlay** (content script): type, value, enrichment summary, tag chips when returned, **Copy**, pivot links, and source attribution. With multiple live sources enabled, each source shows a badge (**Live**, **Cached**, **Error**, or **Skipped**), detail text, **Last updated** when available, and optional **Raw response** (redacted vendor JSON). After successful enrichment, the footer may include enrichment and advisory risk-score disclaimers when enough source signals exist—not a composite score block. Dismiss with Escape or an outside click. |
| **Composite risk score** | Full presentation (band label **Unknown**–**Critical**, per-source contribution chips, disagreement callout) appears in **React unit tests** only. On live page tabs, the **on-page overlay** shows footer disclaimers when scoring signals apply—not the composite score UI. |
| **Live enrichment** | **AbuseIPDB** (IPv4) and **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE) when enabled with a saved API key. Enabled sources are queried in parallel from the service worker; partial success keeps working sources visible while failures stay per source. Only the indicator value is sent to vendors. |
| **Enrichment cache** | Successful responses are stored locally per indicator and per source (default time-to-live about one hour). Repeat enrichment reuses cache until expiry. **Clear cache** on the options page removes stored responses without changing keys or toggles. |
| **Manual refresh** | **›** on a highlight forces a live fetch for that indicator, bypassing cache and removing cached entries for that indicator first. Manual refresh also bypasses the global rate-limit cooldown gate (vendors may still return HTTP 429). |
| **Enrichment errors** | Missing API key (single-source layout) shows **Open settings**; HTTP 429 shows per-source backoff and retry hints and starts a global cooldown that blocks further automatic enrichment until the window passes; invalid keys, timeouts, and other vendor errors include source attribution. |
| **Quota protection** | With manual-only enrichment off, rapid card opens debounce auto-fetch (~400 ms) to the last indicator selected. |
| **Static pivots** | Opens VirusTotal, OTX, AbuseIPDB (IPv4), or URLScan in a new tab where supported. Vera5 does not proxy navigation. |
| **Options page** | Masked API keys for **AbuseIPDB** and **OTX**; enable toggles for AbuseIPDB, OTX, URLScan.io, and GreyNoise; auto-scan; manual-only enrichment (default on); cache clear; settings export/import (keys omitted from export unless you opt in). |
| **Auto-scan** | Optional rescan after DOM changes (debounced). Off by default. |
| **Background worker** | Message routing, scan command, enrichment cache, global rate-limit cooldown, and parallel AbuseIPDB/OTX fetches. |
| **IOC detection** | Visible text nodes on demand; skips `script`, `style`, `textarea`, and metadata subtrees; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Private-space IPv4 (RFC1918, loopback, link-local) is omitted by default. Stops after 2,500 text nodes per scan. |
| **Build** | `npm run build` emits `dist/`, then runs `verify:dist` and `verify:security`. `npm run check` runs lint and unit tests. |

Not supported: live enrichment from URLScan.io or GreyNoise (toggles and pivot links only; no API key fields for those sources), per-type IOC toggles in options, an options control for cache time-to-live (a default applies in storage), or an options toggle for private-space IPv4 (omitted by default in the scan path; storage schema only).

## Configuration flow

1. Build and load the extension (see below).
2. Open **Vera5 Settings**.
3. Enter **AbuseIPDB** and/or **OTX** API keys.
4. Enable sources under **Enrichment sources** (URLScan.io and GreyNoise toggles store preferences and pivot links only—no live API calls).
5. Choose **Manual-only enrichment** (default on) or allow automatic fetch when opening the card (debounced across quick clicks).
6. Enable **Automatically scan when the page changes** if you want mutation rescans.
7. Use **Clear cache** to drop stored vendor responses.
8. Use **Export settings** to back up preferences.

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/analyst-workflows.md](docs/analyst-workflows.md).

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, connector scope. |
| `docs/api-integrations.md` | Vendor limits and 429 handling. |
| `docs/analyst-workflows.md` | Cache, refresh, and quota-aware triage. |
| `docs/security-model.md` | Permissions and host access. |
| `docs/local-mode.md` | Extension-only deployment. |
| `examples/` | Sample HTML and IOC strings for manual checks. |
| `.github/workflows/` | Lint, tests, and secret scan on pull requests. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker, enrichment handler, cache, cooldown. |
| `extension/src/content/` | Detection, highlights, **production on-page overlay**, debounced fetch, auto-scan. |
| `extension/src/components/` | React hover card and risk score UI for unit tests—not injected into page tabs. |
| `extension/src/lib/` | IOC regex, connectors, storage, cache, scoring, export/import, pivots, UI styles. |
| `extension/src/popup/` | Toolbar popup (scan, enable, highlight toggle). |
| `extension/src/options/` | Settings page (keys, toggles, cache, export/import). |

## Browser support

Chromium with Manifest V3 (Chrome, Edge, Brave, and similar). On-page styles follow `prefers-color-scheme: dark` and `prefers-reduced-motion` where defined.

## Load unpacked (Chrome)

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select **`extension/dist`** (must contain `manifest.json`).
2. Pin the toolbar action if needed.
3. After code changes: `npm run build`, then **Reload** the extension.

### Try detection and enrichment locally

Content scripts match `http://` and `https://` pages only. Serve examples over HTTP:

```bash
cd examples
python -m http.server 8080
```

1. Open `http://localhost:8080/sample-alert.html` or `http://localhost:8080/sample-blog.html`.
2. Enable the extension and highlighting, then **Scan page**.
3. Save API keys and enable AbuseIPDB and/or OTX in settings.
4. Click a highlighted IPv4 (use **›** first when manual-only is on). With both sources enabled, check per-source badges, optional **Raw response**, and footer disclaimers (enrichment plus advisory risk-score notice when enough source signals exist).
5. Reopen the same indicator and confirm **Cached** / **· cached** and **Last updated**; use **›** to force a fresh fetch.
6. Try a domain, URL, or hash with OTX enabled.
7. Confirm **Copy** and pivot links.

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Settings, masked API keys, enrichment cache, toggles (`chrome.storage.local`). |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest; scans and UI use the registered content script. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content scripts, visible-text reads for detection, and HTTPS enrichment calls (indicator values only). Pivot links are normal browser navigation. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Privacy and keys (BYOK/BYOA)

- API keys and cache stay in local extension storage; Vera5 does not host enrichment infrastructure.
- Enrichment requests go from the service worker directly to vendors you enable.
- Settings export omits API keys unless you include them.
- Manual-only enrichment is on by default.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Scans and detection run locally. Enrichment sends only the selected indicator value. Raw JSON panels redact sensitive key fields before display.

[SECURITY.md](SECURITY.md), [docs/local-mode.md](docs/local-mode.md).

## Security

`npm run verify:security` (runs on `build`) checks bundled scripts for unsafe patterns. See [docs/security-model.md](docs/security-model.md). Do not commit API keys or `.env` files.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | Production `dist/` plus verify steps |
| `npm run build:watch` | Rebuilds popup/options/background on save—not `content.js`; run full `build` after content changes |
| `npm run dev` | Vite dev server with a stub landing page; not a loadable extension and does not mount the hover card |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest path checks |
| `npm run verify:security` | Bundle security checks |

From the repository root: `.\scripts\check.ps1`, `.\scripts\dev.ps1` (Windows).

[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE).
