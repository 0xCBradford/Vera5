# Vera5

Browser extension for on-demand indicator detection on pages you browse. After a scan, matching indicators can be highlighted; clicking a highlight opens a hover card with copy, static deep-links, and—when configured—live threat intelligence from sources you enable. Settings, API keys, enrichment cache, analyst notes, and preferences stay in local browser storage. Vera5 does not operate a shared enrichment backend; you supply API keys and they remain on your machine.

## Operator surfaces

On `http://` and `https://` tabs, day-to-day triage runs through the **content-script on-page overlay**—not the React hover card used in unit tests.

| Surface | Where it runs | Role |
|---------|---------------|------|
| **On-page overlay** | Content script on the active page | Highlights, hover card (type, value, enrichment summary, per-source badges, local composite risk score with reasoning chain, **analyst notes**, **Copy all** / **Copy filtered**, **Export Markdown** / **Export JSON**, **Template** select with **Export template**, per-indicator **Export** / **Copy** menus, pivot links). Open by clicking a highlight after scan. |
| **Toolbar popup** | Extension action popup | Extension on/off, **Highlight indicators**, **Scan page**, **Settings**, **Permissions**, and—after scan—the **Detected indicators** tray (filters, counts, navigation). Reopens the last scan summary for the active tab when you open the popup again. |
| **Settings (options) page** | Dedicated options tab | Masked API keys, enrichment source toggles, indicator-type toggles, private-space IPv4 detection, cache lifetime fields, manual-only mode, auto-scan, **Clear cache**, settings export/import. |
| **React hover card** | Unit tests only | **Not injected into page tabs.** Shared scoring logic with the on-page overlay; tests also render per-source contribution chips the production overlay omits. |

The keyboard shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y`) triggers the same page scan as **Scan page**. Reopen the popup afterward to load the **Detected indicators** tray from the stored scan summary.

Diagram overviews in those docs: [Local mode — what runs where](docs/local-mode.md) (browser runtime and local storage) and [Typical triage flow](docs/analyst-workflows.md) (scan, on-page overlay, and enrichment on a page tab).

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled**; **Highlight indicators** (default on); **Scan page**; **Settings** and **Permissions** shortcuts. After scan, the **Detected indicators** section lists IOCs for the active tab (see **IOC tray**). |
| **IOC tray** | Scrollable list with per-type filter chips and count summary (for example `11 indicators · 2 IP · 1 CVE`). Click a row to scroll to the page highlight and open the on-page overlay. Optional source-attributed status hints (for example `OTX · Cached`) when a stored enrichment result exists. Clear feedback when a row’s highlight is missing after DOM changes—rescan to refresh. Bulk copy/export/template controls live on the overlay and respect the popup’s active filter chip. |
| **On-page highlights** | After scan, detected indicators get an inline underline, type badge, and **›** enrich control when highlighting is enabled. |
| **Hover card** | Click a highlight for the **on-page overlay**: indicator type and value, enrichment summary, tag chips when returned, per-source rows with **Live** / **Cached** / **Error** / **Skipped** badges, **Last updated**, optional redacted **Raw response**, **Analyst notes** (local per-indicator field, persisted in extension storage), **Copy**, **Export** / **Copy** dropdowns (Markdown, JSON, TXT), and pivot links. Dismiss with Escape or an outside click. |
| **Composite risk score** | When enrichment returns per-source results, a **Risk score** section shows a locally computed advisory band (**Unknown**–**Critical**, with **/100** when a blended composite is available), a **How this score was computed** panel (ordered per-source lines from normalized summaries, or an explicit empty state when blending is not possible), and a **Sources disagree** note when source bands diverge materially. Requires at least two parseable OK enrichment results for a blended **/100** label; otherwise expect **Unknown risk**, an insufficient-data notice, and an empty reasoning chain. If every enrichment source is disabled, the section shows **Risk score unavailable** with settings guidance. Footer disclaimers may appear when scoring applies. Same rules power the React hover card in unit tests, which additionally shows per-source contribution chips. |
| **Live enrichment** | **AbuseIPDB** (IPv4) and **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE) when enabled with a saved API key. Enabled sources are queried in parallel from the service worker; partial success keeps working sources visible while failures stay per source. Only the indicator value is sent to vendors. |
| **Enrichment cache** | Successful responses are stored locally per indicator and per source; error and skipped outcomes from live enrichment are stored too so the popup tray can show the last known status without re-fetching. Default time-to-live is about one hour; adjust the global seconds value on the options page, with optional per-source overrides. Repeat enrichment reuses cache until expiry. **Clear cache** removes stored responses without changing keys or toggles. |
| **Manual refresh** | **›** on a highlight forces a live fetch for that indicator, bypassing cache and removing cached entries for that indicator first. Manual refresh also bypasses the global rate-limit cooldown gate (vendors may still return HTTP 429). |
| **Enrichment errors** | Missing API key shows **Open settings** on the overlay; HTTP 429 shows per-source backoff and retry hints and starts a global cooldown that blocks further automatic enrichment until the window passes; invalid keys, timeouts, and other vendor errors include source attribution. |
| **Quota protection** | With manual-only enrichment off, rapid card opens debounce auto-fetch (~400 ms) to the last indicator selected. |
| **Static pivots** | Opens VirusTotal, OTX, AbuseIPDB (IPv4), or URLScan in a new tab where supported. Vera5 does not proxy navigation. |
| **Analyst notes** | Per-indicator note field on the on-page overlay; saved locally per IOC and survives extension reloads. |
| **Case export format** | Documented markdown, JSON, and plain-text (`schemaVersion: 1` for JSON) from the normalized enrichment record—composite score, reasoning chain, disagreement callout, per-source summary rows, optional analyst notes, and pivot links. The on-page overlay **Export** / **Copy** menus write one indicator at a time; **Copy all**, **Copy filtered**, **Export Markdown**, **Export JSON**, and **Template** / **Export template** on the same overlay export filtered scan subsets from cached enrichment per listed IOC when present. Contract: [docs/export-artifacts.md](docs/export-artifacts.md). Sample layout: **Example exported markdown** below. |
| **Options page** | Masked API keys for **AbuseIPDB** and **OTX**; enable toggles for AbuseIPDB, OTX, URLScan.io, and GreyNoise; **Indicator types** checkboxes (IPv4, domain, URL, hashes, CVE); **Include private-space IPv4 addresses**; default and per-source **cache lifetime** (seconds); auto-scan; manual-only enrichment (default on); cache clear; settings export/import (keys omitted from export unless you opt in). |
| **Auto-scan** | Optional rescan after DOM changes (debounced). Off by default. |
| **Background worker** | Message routing, scan command, tab scan-summary storage for the popup tray, enrichment cache, global rate-limit cooldown, and parallel AbuseIPDB/OTX fetches. |
| **IOC detection** | Visible text nodes on demand; skips `script`, `style`, `textarea`, and metadata subtrees; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Disable individual types under **Indicator types** in settings. Private-space IPv4 (RFC1918, loopback, link-local) is omitted by default; enable **Include private-space IPv4 addresses** when needed. Stops after 2,500 text nodes per scan. |
| **Build** | `npm run build` emits `dist/`, then runs `verify:dist` and `verify:security`. `npm run check` runs lint and unit tests. |

Not supported: live enrichment from URLScan.io or GreyNoise (toggles and pivot links only; no API key fields for those sources).

## Configuration flow

1. Build and load the extension (see below).
2. Open **Vera5 Settings**.
3. Enter **AbuseIPDB** and/or **OTX** API keys.
4. Enable sources under **Enrichment sources** (URLScan.io and GreyNoise toggles store preferences and pivot links only—no live API calls).
5. Under **Scanning**, choose which **Indicator types** to detect and whether to **Include private-space IPv4 addresses**.
6. Under **Enrichment cache**, set the default cache lifetime (seconds) and optional per-source overrides.
7. Choose **Manual-only enrichment** (default on) or allow automatic fetch when opening the card (debounced across quick clicks).
8. Enable **Automatically scan when the page changes** if you want mutation rescans.
9. Use **Clear cache** to drop stored vendor responses.
10. Use **Export settings** to back up preferences (API keys omitted unless you opt in).
11. Add **Analyst notes** on the overlay when triaging an indicator; notes persist locally.
12. On dense pages, scan once and use the popup **IOC tray** to filter and jump to highlights; on the overlay use **Copy all**, **Copy filtered**, **Export Markdown**, **Export JSON**, or **Export template** for the active filter.

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/analyst-workflows.md](docs/analyst-workflows.md), [docs/export-artifacts.md](docs/export-artifacts.md).

## Example exported markdown

Vera5 builds case artifacts from the same normalized enrichment record as the on-page overlay. The samples below show multi-source IPv4 markdown layout for case notes, wikis, or Obsidian: blended composite score, numbered reasoning chain, optional disagreement callout, per-source summary rows, and an optional **Analyst notes** section when you saved a note for that IOC. JSON uses the same fields with `schemaVersion: 1` (see [docs/export-artifacts.md](docs/export-artifacts.md)).

When sources agree:

```markdown
## Vera5 IOC Summary

IOC: 185.220.101.4
Type: IPv4 address

Summary: 74 abuse confidence

Risk score: High risk (59/100)

### How this score was computed

1. AbuseIPDB: High (74/100, weight 1.00).
2. OTX: Suspicious (42/100, weight 0.85).

### Source Summary

- AbuseIPDB (Cached): 74 abuse confidence — Last updated: Jun 2, 2026, 7:00 AM
- OTX (Live): 3 threat pulses
```

When sources disagree (callout appears after the reasoning chain):

```markdown
## Vera5 IOC Summary

IOC: 8.8.8.8
Type: IPv4 address

Summary: 95 abuse confidence

Risk score: High risk (63/100)

### How this score was computed

1. AbuseIPDB: Critical (95/100, weight 1.00).
2. OTX: Suspicious (26/100, weight 0.85).

Sources disagree: compare per-source details before deciding.

### Source Summary

- AbuseIPDB (Live): 95 abuse confidence
- OTX (Live): 1 threat pulse
```

When analyst notes are present:

```markdown
### Analyst notes

Review firewall logs.
```

Field contract and JSON export shape: [docs/export-artifacts.md](docs/export-artifacts.md).

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, connector scope. |
| `docs/api-integrations.md` | Vendor limits and 429 handling. |
| `docs/analyst-workflows.md` | Cache, refresh, and quota-aware triage. |
| `docs/export-artifacts.md` | Markdown and JSON case export contract. |
| `docs/security-model.md` | Permissions and host access. |
| `docs/local-mode.md` | Extension-only deployment. |
| `docs/contributors/` | Contributor architecture, connectors, cache, scoring, and testing. |
| `examples/` | Sample HTML and IOC strings for manual checks. |
| `.github/workflows/` | Lint, tests, and secret scan on pull requests. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker, enrichment handler, cache, cooldown. |
| `extension/src/content/` | Detection, highlights, **production on-page overlay**, debounced fetch, auto-scan. |
| `extension/src/components/` | React hover card and risk score UI for unit tests (shared scoring with the overlay; not injected into page tabs). |
| `extension/src/lib/` | IOC regex, connectors, storage, cache, scoring, export builders, analyst notes, pivots, UI styles. |
| `extension/src/popup/` | Toolbar popup: enable, highlights, scan, IOC tray (filters, navigation, status hints). |
| `extension/src/options/` | Settings page (keys, toggles, indicator types, cache TTL, export/import). |

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
3. Open the popup **Detected indicators** tray: confirm count summary and type filters on a dense page such as `sample-alert.html`; click a tray row to jump to a highlight and open the overlay.
4. Save API keys and enable AbuseIPDB and/or OTX in settings.
5. Click a highlighted IPv4 (use **›** first when manual-only is on). With both sources enabled, check the **Risk score** label, **How this score was computed** panel (or its empty-state note when only one source has parseable data), per-source badges, optional **Raw response**, **Analyst notes**, **Export** / **Copy** menus, and footer disclaimers when a score is shown.
6. Reopen the popup and confirm source-attributed tray hints (for example `OTX · Cached`) on enriched rows; on the overlay, try **Copy filtered**, **Export Markdown**, or **Export template** for a filtered subset.
7. Reopen the same indicator on the page and confirm **Cached** / **· cached** and **Last updated**; use **›** to force a fresh fetch.
8. Try a domain, URL, or hash with OTX enabled.
9. Confirm **Copy** and pivot links on the overlay.

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Settings, masked API keys, enrichment cache, analyst notes, toggles (`chrome.storage.local`); per-tab scan summaries for the popup tray (`chrome.storage.session`). |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest (see [docs/security-model.md](docs/security-model.md)). IOC detection and the overlay run through the registered content script on matched pages. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content scripts, visible-text reads for detection, and HTTPS enrichment calls (indicator values only). Pivot links are normal browser navigation. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Privacy and keys (BYOK/BYOA)

- API keys, enrichment cache, and analyst notes stay in local extension storage; Vera5 does not host enrichment infrastructure.
- Enrichment requests go from the service worker directly to vendors you enable.
- Settings export omits API keys unless you include them.
- Manual-only enrichment is on by default.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Scans and detection run locally. Enrichment sends only the selected indicator value. Composite risk labels and reasoning chains are computed locally from vendor summaries—not an LLM verdict. Raw JSON panels redact sensitive key fields before display.

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

[CONTRIBUTING.md](CONTRIBUTING.md). Contributor architecture and module guides: [docs/contributors/README.md](docs/contributors/README.md).

## License

[MIT License](LICENSE).
