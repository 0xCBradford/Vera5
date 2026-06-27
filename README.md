# Vera5

Browser extension for on-demand IOC detection and triage on `http://` and `https://` pages you browse. Scans, enrichment, scoring, export, investigation sessions, and IOC collections run locally in Chromium—you bring your own API keys; Vera5 does not operate a shared enrichment cloud. An optional user-operated FastAPI aggregator on `127.0.0.1` is available for AbuseIPDB IPv4 when **Use local backend** is enabled in settings (off by default).

## Quick start (install and keys)

**Install (developers and testers)**

```bash
cd extension
npm install
npm run build
```

Load **`extension/dist/`** in Chrome (manifest **0.1.0**). See [Load unpacked (Chrome)](#load-unpacked-chrome) for load steps, packaging, and a manual walkthrough.

On **first install**, Vera5 opens **Settings** once for a four-step **Install quick start** wizard (Welcome → optional AbuseIPDB/OTX/URLScan.io/GreyNoise keys → enrichment control → trust defaults). Completing the wizard keeps **manual-only enrichment** on and **auto-scan** off unless you change them in the wizard or under **Scanning**.

**Bring your own API keys (BYOK/BYOA)**

Vera5 does not ship vendor credentials or proxy enrichment through maintainer infrastructure.

1. Open **Vera5 Settings** from the toolbar popup.
2. Enter your own **AbuseIPDB**, **OTX**, **URLScan.io**, and/or **GreyNoise** API keys (masked in the UI).
3. Enable those sources under **Enrichment Sources**. Keys stay in `chrome.storage.local` on your machine.
4. Leave **Manual-only enrichment** on (default) until you are ready for automatic vendor fetches when you open the triage overlay.

**Optional localhost backend:** Run the FastAPI aggregator on your machine, put keys in `backend/.env`, and turn on **Use local backend** under **Enrichment Sources** in settings. Live **AbuseIPDB IPv4** enrichment can use the aggregator; leave the toggle **off** for OTX, URLScan.io, or GreyNoise. Traffic stays on `127.0.0.1`; Vera5 does not receive those keys. Setup: [docs/local-mode.md — Install the optional backend](docs/local-mode.md#install-the-optional-backend).

The extension does not read API keys from a repository `.env` file. Optional root `.env.example` is for maintainer tooling only; backend keys belong in `backend/.env` on your machine when you use the optional aggregator.

**Privacy in one minute**

- Scans and detection run locally on pages you open.
- Live enrichment sends **only the selected indicator value** to vendors **you** enable—not full page content.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Trust controls (pre-query notices, domain policy, internal asset lists) can block vendor calls before they leave the browser.

Details: [Privacy and keys (BYOK/BYOA)](#privacy-and-keys-byokbyoa), [SECURITY.md](SECURITY.md), [docs/security-model.md](docs/security-model.md).

## Limitations

What Vera5 does **not** do today:

| Limitation | Detail |
|------------|--------|
| **Browser support** | Chromium with Manifest V3 (Chrome, Edge, Brave, similar). No Firefox extension build in this repository. |
| **Install path** | Unpacked load from `extension/dist/` (manifest **0.1.0**). Package a zip with `.\scripts\package-extension.ps1` at the repository root (`release/vera5-0.1.0.zip`). Chrome Web Store listing draft: [docs/store-listing.md](docs/store-listing.md)—submission is separate operator work. |
| **Live enrichment** | Live HTTPS API queries when you enable **AbuseIPDB**, **OTX**, **URLScan.io**, or **GreyNoise (community)** (indicator-type coverage in **What works today**). **VirusTotal** and the other registry entries do not call vendor APIs—pivot links and settings slots only. |
| **Backend** | No Vera5-operated enrichment relay, shared team workspace, or cloud sync for sessions, collections, or keys. An optional user-operated FastAPI aggregator on `127.0.0.1` (extension bridge off by default) centralizes SQLite cache, rate limits, and **AbuseIPDB IPv4** live enrichment. With the toggle on and the server reachable, OTX, URLScan.io, and GreyNoise are not enriched—turn **Use local backend** off for those sources. If the toggle is on but localhost is down, Vera5 falls back to in-extension connectors. |
| **Page coverage** | Content scripts on `http://` and `https://` only. Detection reads visible text nodes (not attributes, scripts, or hidden fields); stops after 2,500 text nodes per scan. |
| **Data sent to vendors** | Indicator values you choose to enrich—not full pages, attachments, or clipboard dumps. |
| **Scoring** | Advisory labels computed locally; not a vendor verdict. Blended **/100** needs at least two parseable OK source results. |
| **Automation** | Pull request CI runs browser smokes on Playwright Chromium with mocked vendors—it does not replace manual unpacked Chrome checks before you rely on the extension in production triage. |
| **README images** | No embedded screenshots. Capture guide: [docs/screenshots.md](docs/screenshots.md). |

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/contributors/testing.md](docs/contributors/testing.md) (E2E scope and limits).

## Operator surfaces

On `http://` and `https://` tabs, day-to-day triage uses the surfaces below.

| Surface | Where it runs | Role |
|---------|---------------|------|
| **On-page overlay** | Content script on the active page | Triage card on scanned highlights: trust details, enrichment, pivots, notes, **Label**, **Pin**, **Session timeline**, **Save to collection…**, copy, and export. Open by clicking a highlight or with **Enter** / **Space** on a focused highlight; **ArrowDown** / **ArrowUp** move between highlights. See **What works today** for field-level behavior. |
| **Command palette** | Content script on the active page | **Ctrl+Shift+K** / **Cmd+Shift+K** opens a searchable list of core actions (scan page, enrich selection, tray copy/export, clear highlights, **Open options**). Choose a command with the keyboard or mouse; **Esc** closes the palette. |
| **Selection context menu** | Browser context menu on selected text | Right-click a text selection → **Enrich with Vera5** resolves an indicator in the selection and opens the overlay for manual enrichment (same trust gates as **Enrich selection**). |
| **Toolbar popup** | Extension action popup | Extension on/off, scan and selection actions, **Investigation session** (title, rollups, recent sessions, session export, **Promote session to collection…**), **Detected indicators** tray (**Save to collection…**, **Add filtered to collection…**), **IOC collections** (view members, rename, delete, export), **Source operations** (cache, cooldown, per-source status), **Open sidebar**, **Settings**, **Permissions**. |
| **Page workspace sidebar** | Content script panel on the active page | Docked tray with scan, selection, enrich, and IOC list controls; row checkboxes for bulk enrich; **Save to collection…** and **Add filtered to collection…** per tray; pinned session indicators sort first. Selecting an indicator opens the same overlay model. Collapsible **Why detected?** per row. |
| **Settings (options) page** | Dedicated options tab | **Use local backend** toggle (off by default), masked API keys, per-source enable toggles, indicator-type toggles, private-space IPv4 detection, cache lifetime fields, manual-only mode, auto-scan, **Trust & consent** (pre-query notices, domain allow/deny lists and presets, internal asset lists, analyst workflow presets), **Clear cache**, settings export/import. Per-source source-health details are shown in the popup **Source operations** section. |
| **React hover card** | Unit tests only | **Not injected into page tabs.** Shared scoring logic with the on-page overlay; not a production triage surface. |

Keyboard shortcuts: **Ctrl+Shift+Y** / **Cmd+Shift+Y** triggers **Scan page**; **Ctrl+Shift+K** / **Cmd+Shift+K** opens the **command palette**. After **Scan page** (shortcut or palette), reopen the popup to refresh the **Detected indicators** tray for that tab.

See [Local mode — what runs where](docs/local-mode.md) for extension-only runtime, optional localhost backend boundaries, and local storage; [Typical triage flow](docs/analyst-workflows.md) for scan, overlay, and enrichment on a page tab.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Install quick start** | First-run wizard in **Settings**: install checklist, optional live-source API keys (saving a key can auto-enable that source), **Manual-only enrichment** (recommended on), auto-scan summary, and pre-query notice choice (**Show pre-query notices (recommended)** or skip). Finishing the wizard persists safe defaults (manual-only on, auto-scan off). |
| **Command palette** | **Ctrl+Shift+K** / **Cmd+Shift+K** on a page tab opens a filterable command list. Commands include **Scan page**, **Enrich selection** (when text is selected), **Copy filtered Markdown**, **Export tray subset**, **Clear highlights**, and **Open options**. **Enter** runs the highlighted command; **Esc** closes the palette. |
| **Context-menu enrich** | With indicator text selected, right-click → **Enrich with Vera5** detects the IOC, opens the overlay, and starts manual enrichment when resolved. Domain policy, internal asset lists, and pre-query disclosure apply before any vendor fetch—same as **Enrich selection**. |
| **Bulk enrich queue** | In the workspace tray, check one or more IOC rows, then **Enrich selected (N)**. A quota and rate-limit confirmation appears before the queue runs. Indicators enrich sequentially with progress (**Enriching X of N…**); **Cancel enrich queue** stops after the current item. Pre-query **Cancel** on an item also stops the queue. Each step respects domain policy, internal asset lists, and pre-query disclosure. |
| **Selection scan** | On dense dashboard exports, highlight a table row or panel and use **Scan selection** in the popup (or workspace sidebar when open) to detect indicators only in that range—without rescanning the full page. |
| **Selection enrich** | Select indicator text (including inside a scanned highlight) and use **Enrich selection** (popup, workspace sidebar, command palette, or context menu) to open the overlay and request enrichment for that value when it resolves to a single supported indicator. |
| **Keyboard triage** | Highlights are focusable (`Tab`). **ArrowDown** / **ArrowUp** move to the next or previous highlight in document order (wraps at the ends); from page focus after scan, **ArrowDown** selects the first highlight and **ArrowUp** the last. **Enter** / **Space** on a focused highlight opens the overlay and moves focus to the first focusable control in the panel (**Copy Indicator**, **Copy defanged** when shown, or session controls such as **Pin** when a session is active). **Escape** closes the overlay; after a keyboard-opened overlay, focus returns to the highlight. Arrow keys do not triage while focus is inside the overlay panel. |
| **IOC tray** | Scrollable list with per-type filter chips and count summary (for example `10 indicators · 2 IP · 2 CVE` on `sample-alert.html`). Click a row to scroll to the page highlight and open the on-page overlay. Optional source-attributed status hints (for example `OTX · Cached`) when a stored enrichment result exists. Each row can expand **Why detected?** (type, reason, source context, ignored overlaps). When defanged text differs from the stored value, rows show the on-page form and a **Refanged:** line. Clear feedback when a row’s highlight is missing after DOM changes—rescan to refresh. In the workspace tray, row checkboxes select indicators for bulk enrich. Bulk copy, export, and ticket-template actions live on the overlay and respect the tab’s stored tray filter (popup or workspace sidebar). |
| **On-page highlights** | After scan, detected indicators get an inline underline, type badge, and **›** enrich control when highlighting is enabled. |
| **Detection provenance** | Each match stores a rule id and source text hint from the scan. **Why detected?** on the overlay and IOC tray explains the indicator type, detection reason, surrounding context, and any overlapping matches dropped during dedupe. |
| **Defang and refang** | Detects common defanged forms in visible text (`hxxp`/`hxxps`, bracket dots such as `[.]`, bracket scheme separators). Match values are refanged for enrichment, pivots, and default copy; highlights still cover the original on-page text. When forms differ, use **Copy defanged** or **Copy refanged** on the overlay header. |
| **Composite risk score** | When enrichment returns per-source results, a **Risk score** section shows a locally computed advisory band (**Unknown**–**Critical**, with **/100** when a blended composite is available), a **How this score was computed** panel (ordered per-source lines from normalized summaries, or an explicit empty state when no parseable OK summaries exist), and a **Sources disagree** note when source bands diverge materially. Requires at least two parseable OK enrichment results for a blended **/100** label; with one OK source, expect **Unknown risk**, an insufficient-data notice, and a single reasoning line when that summary is parseable. If every enrichment source is disabled, the section shows **Risk score unavailable** with settings guidance. Footer disclaimers may appear when scoring applies. |
| **Live enrichment** | **AbuseIPDB** (IPv4), **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE), **URLScan.io** (domain, URL), and **GreyNoise (community)** (IPv4) when enabled with a saved API key in extension-only mode (**Use local backend** off). With the toggle on and the aggregator reachable, live calls for **AbuseIPDB IPv4** go to `http://127.0.0.1:8765/enrich`; OTX, URLScan.io, and GreyNoise are not queried until you turn the toggle off or those connectors are added to the backend. If the toggle is on but localhost is down, Vera5 falls back to in-extension connectors with an honest status hint. Enabled sources run in parallel where supported; partial success keeps working sources visible while failures stay per source. Only the indicator value is sent to vendors (URLScan.io receives a search query for the domain or URL—not a full page submission; GreyNoise receives the IPv4 in the community lookup path). Live HTTPS calls are limited to declared connector API hosts (`api.abuseipdb.com`, `otx.alienvault.com`, `urlscan.io`, `api.greynoise.io`); a runtime allowlist blocks undeclared outbound fetch before network I/O. Pre-query disclosure (when enabled), domain policy, and internal asset lists gate outbound calls before the service worker fetch runs. |
| **Optional local backend** | User-operated FastAPI on `127.0.0.1:8765`: SQLite TTL cache, central per-source rate limits, redacted request logging, and AbuseIPDB IPv4 enrichment with extension parity. Keys in `backend/.env` on your machine; CORS restricted to your extension origin. **Use local backend** is off by default—extension-only mode needs no Python install. Turn the toggle off to enrich with OTX, URLScan.io, or GreyNoise from the extension. See [docs/local-mode.md](docs/local-mode.md) and [SECURITY.md — Optional local enrichment backend](SECURITY.md#optional-local-enrichment-backend). |
| **Pre-query disclosure** | When pre-query notices are on (default until you choose on first visit to Settings), the overlay shows an inline notice naming enabled vendors and the indicator value before any live fetch. **Send query** proceeds; **Cancel** aborts. **Don't show this notice again** turns off later notices (same as the **Trust & consent** toggle). Applies to manual enrich, context-menu enrich, and each step of a bulk enrich queue. |
| **Domain policy** | **Trust & consent** sets allow-by-default or deny-by-default hostname rules for auto-scan and live enrichment. Fresh installs include a default sensitive webmail denylist. Denylisted hosts skip mutation rescans and block vendor calls before disclosure when the domain enrich gate is on (default). Bulk enrich on a denylisted tab shows a tray message and does not start the queue. Merge the **Sensitive sites denylist** preset for banking, health, and HR patterns. Pattern syntax supports exact hosts, prefix wildcards (`mail.*`), and suffix wildcards (`*.corp.example`). |
| **Internal asset lists** | Optional indicator-level lists—internal domains, IPv4 CIDR ranges, and labeled vendor/SaaS hostname patterns—block live enrichment for matching IOC values even on otherwise allowed pages. Configure under **Trust & consent**; empty lists impose no block. |
| **Analyst workflow presets** | **SOC triage**, **CTI research**, and **DFIR investigation** presets apply role-specific defaults: built-in presets enable **AbuseIPDB** and **OTX** only (not URLScan.io or GreyNoise), plus manual-only and notice defaults, optional private-space IPv4 (DFIR), default export template, and recommended pivot ordering. |
| **Registered enrichment sources** | Twelve sources appear in settings and the overlay registry (AbuseIPDB, OTX, VirusTotal, URLScan.io, GreyNoise, Shodan, Google Safe Browsing, Pulsedive, MalwareBazaar, Censys, ThreatFox, URLhaus). **AbuseIPDB**, **OTX**, **URLScan.io**, and **GreyNoise (community)** perform live HTTPS enrichment when enabled (**URLScan.io**: domain and URL only; **GreyNoise**: IPv4 only). Other enabled registry-only sources may show missing-key, unsupported-type, or **enrichment is not available yet** rows; pivot links still appear where the registry defines them for the IOC type. Saved API keys for registry-only sources stay in local storage and are not sent to those vendors. |
| **Enrichment cache** | Successful responses are stored locally per indicator and per source. Failed live attempts may also be stored so the popup tray can show the last known per-source status without re-fetching. Default time-to-live is about one hour; adjust the global seconds value on the options page, with optional per-source overrides. Repeat enrichment reuses cache until expiry. **Clear cache** removes stored responses without changing keys or toggles. |
| **Manual refresh** | **›** on a highlight forces a live fetch for that indicator, bypassing cache and removing cached entries for that indicator first. Manual refresh also bypasses the global rate-limit cooldown gate (vendors may still return HTTP 429). |
| **Enrichment errors** | Missing API key shows **Open settings** on the overlay; HTTP 429 shows per-source backoff and retry hints (including URLScan.io quota headers and GreyNoise JSON rate-limit bodies when applicable) and starts a global cooldown that blocks further automatic enrichment until the window passes; invalid keys, timeouts, and other vendor errors include source attribution. Domain policy and internal asset gates show explicit block messages without sending the indicator to vendors. |
| **Quota protection** | With manual-only enrichment off, rapid overlay opens debounce auto-fetch (~400 ms) to the last indicator selected. Before a bulk enrich queue starts, a confirmation summarizes estimated live vendor requests, vendor quota notes, and rate-limit backoff behavior. |
| **Pivot recipes** | **Recommended next pivots** lists type-specific vendor links from the registry, each with a source badge and static workflow guidance. Order follows the applied analyst workflow preset when one is set. Guidance is authored copy only—it does not repeat live enrichment scores or vendor ratios. Vera5 does not proxy navigation. **Open live URL** on URL indicators is separate: it opens the refanged URL in a new tab only after you confirm. |
| **Investigation session** | Named local case workspace in the popup: editable title, total and per-type IOC rollups from the **latest scan on the synced page** (for example `1 domain · 2 IPs · 4 hashes · 1 URL · 2 CVEs` on `sample-alert.html`), enrich/export activity counts, **New session**, and **Recent sessions** (reopen, rename, archive, delete). **Archive** hides a session from the recent list; archived sessions cannot be reopened from the popup. First **Scan page** auto-creates a session when none is active. Sessions persist in local storage only—no cloud sync or shared team workspace. |
| **Session IOC memory** | On the overlay when a session is active: **Label** (Benign, Internal, Suppress false positive, Case important), **Pin** for triage priority (pinned rows rise in the workspace tray), and **Session timeline** (first seen, enrich events, export events per indicator). Labels persist locally per IOC value. |
| **Session export** | From the popup when a session is active: **Copy** or **Download** **Markdown**, **JSON**, or **CSV** using session metadata plus IOC rows from the **active tab's current scan** (enrichment snippets when cached). JSON includes `schemaVersion` and session fields; CSV reuses the tray CSV row contract. Exports redact API keys and raw vendor secrets. Rescan the page before export if the tray is empty or stale. |
| **IOC collections** | Named local indicator groupings separate from the active investigation session. **Save to collection…** on a popup tray row, workspace sidebar row, or overlay adds one indicator; **Add filtered to collection… (N)** in the popup or workspace sidebar bulk-adds the filtered tray subset. **Promote session to collection…** copies session IOC members into a new collection you name. The popup **IOC collections** section lists saved collections with member counts and last updated time; **View members**, **Rename**, **Delete**, **Remove** member, and member links jump to page highlights when the IOC is on the current tab. Duplicate type+value pairs dedupe. Collections persist in local storage across sessions and restarts. No team sharing or cloud sync. |
| **Collection export** | From **IOC collections** in the popup: **Export Markdown**, **Export JSON**, or **Export CSV** per collection. Markdown includes collection summary, IOC table, cached enrichment snippets when available, and source attribution. JSON includes `schemaVersion`, collection metadata, and members. CSV uses the same row contract as session and tray exports. Empty collections skip CSV download. Exports redact API keys and raw vendor secrets. Separate from **Session export** and per-indicator overlay export. |
| **Source operations** | Popup panel: global rate-limit cooldown timer, last cache clear time, total cache entries, and per-source last status with cached row counts. Complements **Clear cache** on the settings page. |
| **Case export formats** | Markdown, JSON, and plain-text (`.txt`) per indicator (`schemaVersion: 1` for JSON), plus ticket templates (**Jira comment**, **TheHive case note**, **Analyst update**, **Obsidian note**, **Markdown report**, **CSV rows**). All derive from the normalized enrichment record—composite score, reasoning chain, disagreement callout, per-source rows, optional analyst notes, and pivot links in markdown/JSON. The overlay **Template** row defaults to your saved export template or analyst preset. Per-indicator **Export** / **Copy** menus write one IOC at a time. Filtered scan subsets use **Copy all**, **Copy filtered**, **Copy filtered Markdown** / **JSON**, **Export filtered Markdown** / **JSON**, and **Export template** / **Copy template** on the on-page overlay (clipboard or download only). The command palette can copy or export the filtered tray subset without opening the overlay. Per-indicator markdown/JSON field contract: [docs/export-artifacts.md](docs/export-artifacts.md). Session-level and collection-level exports use separate builders—see **Session export** and **Collection export** above. |
| **Options page** | **Use local backend** toggle (off by default), masked API key fields for each source that requires them (Censys uses API ID plus a separate secret field); enable toggles, **Indicator types** checkboxes (IPv4, domain, URL, hashes, CVE); **Include private-space IPv4 addresses**; default and per-source **cache lifetime** (seconds); auto-scan; manual-only enrichment (default on); **Trust & consent** (pre-query notices, domain mode and allow/deny lists, domain and internal-asset enrich gates, presets, internal asset lists, analyst workflow presets); cache clear; settings export/import (keys omitted from export unless you opt in). |
| **Auto-scan** | Optional rescan after DOM changes (debounced). Off by default. Respects domain policy on the current tab hostname—denylisted origins do not schedule mutation rescans. |
| **Background worker** | Message routing, scan and command-palette commands, selection context menu, tab scan-summary storage for the popup tray, investigation session persistence, IOC collection persistence, enrichment cache, global rate-limit cooldown, optional localhost enrich bridge (`127.0.0.1:8765` when **Use local backend** is on), and parallel live-connector fetches (AbuseIPDB, OTX, URLScan.io, and GreyNoise) when the bridge is off or unreachable. |
| **IOC detection** | Visible text nodes on demand; skips `script`, `style`, `textarea`, and metadata subtrees; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards (including export-metadata and version-range decoys on SOC-style pages) and overlap deduplication. Disable individual types under **Indicator types** in settings. Private-space IPv4 (RFC1918, loopback, link-local) is omitted by default; enable **Include private-space IPv4 addresses** when needed. Stops after 2,500 text nodes per scan. |
| **Build** | `npm run build` emits `dist/`, then runs `verify:dist` and `verify:security` (extension-page CSP, outbound fetch allowlist, no `eval`, production logging hygiene, redacted test fixtures, empty credential placeholders in root `.env.example`). `npm run check` runs lint and unit tests. `npm run audit:prod` checks production dependencies (same blocking policy as CI). Optional `npm run test:e2e:critical` runs browser smokes on unpacked `dist/` with mocked vendor HTTP (no live API calls in CI). |

## Configuration flow

1. Build and load the extension ([Load unpacked (Chrome)](#load-unpacked-chrome)). On first install, complete the **Install quick start** wizard in **Settings** (four steps: Welcome checklist, optional API keys, enrichment control, trust defaults).
2. Open **Vera5 Settings**, enter **AbuseIPDB**, **OTX**, **URLScan.io**, and/or **GreyNoise** keys when you want live enrichment in extension-only mode, and enable those sources. Live HTTPS responses come from enabled live connectors (URLScan.io enriches domain and URL indicators only; GreyNoise enriches IPv4 only).
3. **Optional:** Install and start the localhost aggregator per [docs/local-mode.md#install-the-optional-backend](docs/local-mode.md#install-the-optional-backend). Set `VERA5_CORS_ORIGINS` to your extension ID and enable **Use local backend** under **Enrichment Sources** for AbuseIPDB IPv4. Leave the toggle **off** when you need OTX, URLScan.io, or GreyNoise live enrichment from the extension.
4. Under **Trust & consent**, set pre-query notices, domain policy, internal asset lists if needed, and an analyst workflow preset when useful.
5. Under **Scanning** and **Enrichment cache**, choose indicator types, optional private-space IPv4, cache lifetime, **Manual-only enrichment** (default on), and optional auto-scan.
6. Triage on page tabs via the overlay, popup tray, workspace sidebar, or command palette—see [Operator surfaces](#operator-surfaces) and [Try detection and enrichment locally](#try-detection-and-enrichment-locally).
7. Use **Investigation session** and **IOC collections** for case tracking and ticket handoff exports.

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/analyst-workflows.md](docs/analyst-workflows.md), [docs/export-artifacts.md](docs/export-artifacts.md), [docs/security-model.md](docs/security-model.md), [docs/soc-validation-fixtures.md](docs/soc-validation-fixtures.md).

## Example exported markdown

These samples are **per-indicator** overlay exports (`## Vera5 IOC Summary`), not **Investigation session** or **IOC collection** popup exports. Per-indicator exports use the normalized enrichment record directly; session and collection exports add their own metadata sections while reusing the same IOC row and enrichment snippet builders.

These samples show multi-source IPv4 markdown layout: blended composite score, numbered reasoning chain, optional disagreement callout, per-source summary rows, and an optional **Analyst notes** section when you saved a note for that IOC. JSON uses the same fields with `schemaVersion: 1` (see [docs/export-artifacts.md](docs/export-artifacts.md)).

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

- AbuseIPDB (Cached): 74 abuse confidence — Last updated: 2026-06-01T14:30:00.000Z
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
- GreyNoise (Live): benign RIOT service
```

When analyst notes are present:

```markdown
### Analyst notes

Review firewall logs.
```

Field contract and JSON export shape: [docs/export-artifacts.md](docs/export-artifacts.md).

## Example ticket templates

Ticket-oriented templates render from the same normalized enrichment record as markdown/JSON export. Choose a template on the overlay **Template** row, then **Export template** (download) or **Copy template** (clipboard). Filtered scan subsets join multiple IOCs (CSV uses one header row; other templates separate records with `---`).

**Analyst update** (plain text, one IOC):

```text
Vera5 triage for 185.220.101.4 (IPv4 address). Summary: 74 abuse confidence. Tags: DE, Hosting. Risk score: High risk (59/100).
```

**Jira comment** (excerpt):

```markdown
h3. Vera5 IOC triage — 185.220.101.4

*Type:* IPv4 address
*Summary:* 74 abuse confidence
*Risk score:* High risk (59/100)

h4. Source summary

AbuseIPDB: 74 abuse confidence
OTX: 3 threat pulses
```

Other templates (**TheHive case note**, **Obsidian note** with front matter, **Markdown report**, **CSV rows**) follow the same field contract. Pivot recipe guidance on the overlay stays separate from template output and remains static workflow copy only.

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, connector scope. |
| `docs/api-integrations.md` | Vendor limits and 429 handling. |
| `docs/analyst-workflows.md` | Cache, refresh, keyboard triage, investigation sessions, IOC collections, and quota-aware triage. |
| `docs/soc-validation-fixtures.md` | Splunk-export and Security Onion-style sample pages for repeatable detection checks. |
| `docs/export-artifacts.md` | Per-indicator markdown and JSON export contract. |
| `docs/security-model.md` | Permissions, host access, CSP, outbound boundaries, hardening checklist, and hostile-page DOM guidance. |
| `docs/local-mode.md` | Extension-only deployment and optional localhost enrichment backend setup. |
| `docs/contributors/` | Contributor architecture, connectors, cache, scoring, and testing. |
| `examples/` | Sample HTML (including SOC dashboard exports) and IOC strings for manual checks. |
| `docs/screenshots.md` | Screenshot capture guide for README and store assets. |
| `docs/store-listing.md` | Chrome Web Store listing draft (descriptions, single purpose, permission justifications). |
| `docs/release-notes-v0.1.0.md` | Release notes for tag `v0.1.0`; see README and [CHANGELOG.md](CHANGELOG.md) for version history. |
| `scripts/` | Windows helpers: `check.ps1`, `build.ps1`, `dev.ps1`, `package-extension.ps1` (build + zip to `release/`). |
| `.github/workflows/` | Lint, unit tests, production dependency audit, Gitleaks on pull requests and pushes to `main`, and browser E2E smokes on pull requests (`browser-e2e-smokes` in `extension-quality.yml`). |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE](LICENSE) | Security, contribution, version history, bundled dependency notices, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker, enrichment handler, investigation session handlers, IOC collection handlers, cache, cooldown, context menu registration. |
| `extension/src/content/` | Detection, highlights, **production on-page overlay**, command palette, workspace sidebar, debounced fetch, auto-scan. |
| `extension/src/components/` | React hover card and risk score UI for unit tests (shared scoring with the overlay; not injected into page tabs). |
| `extension/src/lib/` | IOC regex, connectors, enrichment source registry, investigation session model and export, IOC collection model/storage/export, IOC labels, command registry, storage, cache, scoring, export builders, export templates, analyst notes, pivots, UI styles. |
| `extension/src/popup/` | Toolbar popup: enable, highlights, scan, selection actions, investigation session, IOC collections manager, detected-indicators tray, source operations, **Open sidebar**. |
| `extension/src/options/` | Settings page (keys, **Use local backend**, toggles, indicator types, cache TTL, export/import). |

## Browser support

Chromium with Manifest V3 (Chrome, Edge, Brave, and similar). On-page styles follow `prefers-color-scheme: dark` and `prefers-reduced-motion` where defined.

## Load unpacked (Chrome)

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select **`extension/dist`** (must contain `manifest.json`, version **0.1.0**).
2. Pin the toolbar action if needed. On **first install**, **Settings** opens for the **Install quick start** wizard—complete all four steps or use **Continue without keys** on step 2 when you want detection-only triage first.
3. After code changes: `npm run build`, then **Reload** the extension.

**Package for store upload or offline handoff** (from repository root on Windows):

```powershell
.\scripts\package-extension.ps1
```

Writes `release/vera5-0.1.0.zip` with `manifest.json` at the zip root. See [docs/store-listing.md](docs/store-listing.md) and [docs/release-notes-v0.1.0.md](docs/release-notes-v0.1.0.md) before publishing.

### Try detection and enrichment locally

Content scripts match `http://` and `https://` pages only. Serve examples over HTTP:

```bash
cd examples
python -m http.server 8080
```

1. Open `http://localhost:8080/sample-alert.html`, `http://localhost:8080/sample-blog.html`, `http://localhost:8080/sample-splunk-export.html`, or `http://localhost:8080/sample-security-onion-alert.html`. See [docs/soc-validation-fixtures.md](docs/soc-validation-fixtures.md) for expected counts and decoy checks. On `sample-alert.html`, confirm a defanged URL (`hxxps://…`) is detected and shows defanged on-page text with a **Refanged:** line and **Why detected?** on the overlay or tray.
2. Enable the extension and highlighting, then **Scan page** (on `sample-splunk-export.html`, try **Scan selection** on one table row first).
3. Open the popup **Detected indicators** tray or the workspace sidebar: confirm count summary and type filters on a dense page such as `sample-alert.html`; click a tray row to jump to a highlight and open the overlay. Expand **Why detected?** on a tray row when present. Use **ArrowDown** / **ArrowUp** on focused highlights to walk indicators on the page.
4. Press **Ctrl+Shift+K** / **Cmd+Shift+K** and run **Scan page** or **Clear highlights** from the command palette.
5. Select indicator text on the page, right-click → **Enrich with Vera5**, or use **Enrich selection** / the palette equivalent when text is selected.
6. In the workspace tray on a dense page such as `sample-splunk-export.html`, check three IOC rows, click **Enrich selected (3)**, confirm the quota warning, then **Start enrich queue**; try **Cancel enrich queue** mid-run.
7. Save API keys and enable AbuseIPDB, OTX, URLScan.io, and/or GreyNoise in settings.
8. Click a highlighted IPv4—or focus a highlight and press **Enter**—(use **›** first when manual-only is on). With pre-query notices enabled, confirm **Send query** on the inline disclosure before the fetch. With multiple live sources enabled for the indicator type, check the **Risk score** label, **How this score was computed** panel (or its empty-state note when only one source has parseable data), per-source badges (for example **GreyNoise · Live** with noise/RIOT summaries on IPv4), optional **Raw response**, **Recommended next pivots**, **Why detected?**, **Analyst notes**, **Copy defanged** / **Copy refanged** (or **Copy Indicator**), **Open live URL** on a URL indicator, **Export** / **Copy** menus, the **Template** row, and footer disclaimers when a score is shown.
9. Reopen the popup and confirm source-attributed tray hints (for example `OTX · Cached` or `GreyNoise · Live`) on enriched rows; on the overlay, try **Copy filtered**, **Export filtered Markdown**, **Copy template** with **Analyst update** or **Jira comment**, or **Export template** with **CSV rows** for a filtered subset.
10. Reopen the same indicator on the page and confirm **Cached** / **· cached** and **Last updated**; use **›** to force a fresh fetch.
11. Try a domain or URL with OTX and/or URLScan.io enabled and confirm live per-source rows (for example **URLScan.io · Live** with a result summary), **Recommended next pivots** order, and guidance for that IOC type. Try a hash or CVE with OTX only. On IPv4, compare **GreyNoise** row summaries (for example benign RIOT service or malicious internet noise) with your GreyNoise portal reference when you have a community key configured.
12. In the popup, name the session (for example **Phishing Investigation**), confirm rollups match the current scan on `sample-alert.html`, enrich a few indicators, set a **Label** and **Pin** on the overlay, then **Copy Markdown** and **Copy JSON** under **Export session** (requires a populated **Detected indicators** tray on that tab). Reopen the extension after a browser restart and use **Recent sessions** → **Reopen** to confirm the session persisted locally.
13. On a tray row, use **Save to collection…** → **Create new collection** (for example **Phishing Campaign**), add more indicators from the tray or overlay, then under **IOC collections** click **Export CSV** and confirm the download contains one row per member with no API keys in the file. Start **New session**, scan another fixture page, and add indicators to the same collection to confirm it persists across sessions.

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Settings, masked API keys, enrichment cache, analyst notes, investigation sessions, IOC collections, IOC labels, toggles (`chrome.storage.local`); per-tab scan summaries for the popup tray (`chrome.storage.session`). |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Fallback injection of `content.js` when the registered content script is not loaded on the active tab (for example before **Open sidebar**); routine detection uses the manifest content script on matched pages. |
| `contextMenus` | **Enrich with Vera5** on a text selection; the content script resolves the selection and runs the same enrich flow as **Enrich selection**. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content scripts, visible-text reads for detection, HTTPS enrichment calls (indicator values only) to declared vendor API hosts you enable (AbuseIPDB, OTX, URLScan.io, GreyNoise), and—when **Use local backend** is on—POSTs to `http://127.0.0.1:8765/enrich` on your machine. Pivot recipe links open in the browser like normal navigation. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Privacy and keys (BYOK/BYOA)

- API keys, enrichment cache, analyst notes, investigation sessions, and IOC collections stay in local extension storage by default; Vera5 does not host enrichment infrastructure.
- Enrichment requests go from the service worker directly to vendors you enable when **Use local backend** is off. With the toggle on and the aggregator reachable, **AbuseIPDB IPv4** uses `http://127.0.0.1:8765/enrich` and keys from `backend/.env`; turn the toggle off for OTX, URLScan.io, or GreyNoise.
- Settings export omits API keys unless you include them.
- Manual-only enrichment is on by default.
- Pre-query disclosure runs before the first vendor call when notices are enabled; domain policy and internal asset lists can block enrichment without sending indicator values. Bulk enrich and context-menu enrich use the same gates.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Scans and detection run locally. Enrichment sends only the selected indicator value to declared vendor API hosts you enable. Composite risk labels and reasoning chains are computed locally from vendor summaries. Raw JSON panels redact sensitive key fields before display. Production bundles omit sensitive `console` output. **Open live URL** uses your browser only after you confirm; Vera5 does not fetch or proxy that navigation.
- Review vendor terms and privacy policies before enabling sources: [docs/api-integrations.md — Vendor terms](docs/api-integrations.md#vendor-terms-privacy-and-acceptable-use).

[SECURITY.md](SECURITY.md), [docs/local-mode.md](docs/local-mode.md).

## Security

Security posture is local-first: your keys stay in browser storage (or in `backend/.env` when you use the optional localhost aggregator), enrichment uses bring-your-own API credentials, and there is no Vera5-operated enrichment relay.

| Control | What it does |
|---------|----------------|
| **`npm run verify:security`** | Runs after every production build. Checks extension-page CSP and packaged assets, blocks live `fetch()` outside declared connector modules and API hosts, rejects `eval` / remote dynamic import, scans production bundles for sensitive logging, enforces redacted test fixture placeholders, and verifies root `.env.example` credential variables are empty. |
| **`npm run audit:prod`** | Fails on moderate-or-higher vulnerabilities in production dependencies (React runtime shipped in `dist/`). CI uses the same blocking policy; full `npm audit` warns only on devDependencies. |
| **Browser E2E smokes (CI)** | Pull requests run `npm run test:e2e:critical` on unpacked `dist/` in headless Chromium with mocked enrichment HTTP—no live vendor API calls. |
| **Gitleaks** | Repository secret scan on pull requests and pushes to `main` (`.github/gitleaks.toml`). Run locally from the repo root: `gitleaks detect --source . --config .github/gitleaks.toml`. |
| **Outbound allowlist** | Live enrichment HTTPS calls go only to configured vendor connector endpoints; undeclared hosts are blocked before network I/O. Localhost enrich POSTs to `127.0.0.1:8765` are allowed only when **Use local backend** is on. |
| **Trust gates** | Domain policy, internal asset lists, manual-only enrichment (default), and pre-query disclosure limit accidental vendor queries on sensitive pages. |
| **Hostile-page DOM** | Detection reads visible text nodes only (not attributes or script/style subtrees). Overlay UI uses `textContent` for untrusted strings; see [Malicious page DOM confusion](docs/security-model.md#malicious-page-dom-confusion). |

Security hardening checklist and operator browser confirmation steps: [docs/security-model.md](docs/security-model.md#security-hardening-review-checklist). Vulnerability reporting: [SECURITY.md](SECURITY.md). Do not commit API keys or `.env` files. Root `.env.example` documents optional repo-side tooling variables with empty credential placeholders; configure extension API keys under **Vera5 Settings**.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | Production `dist/` plus verify steps |
| `npm run build:watch` | Rebuilds popup/options/background on save—not `content.js`; run full `build` after content changes |
| `npm run dev` | Vite dev server with a stub landing page; not a loadable extension |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest path checks |
| `npm run verify:security` | Bundle security checks (CSP, fetch allowlist, logging, fixtures, `.env.example`) |
| `npm run audit:prod` | Production dependency audit (blocking policy) |
| `npm run test:e2e:install` | One-time Playwright Chromium install for browser smokes |
| `npm run test:e2e:critical` | PR-gate browser smokes against unpacked `dist/` (mocked vendors) |
| `npm run test:e2e` | Full browser smoke suite (includes session pin and collection CSV export paths) |

Pull request CI runs `npm run test:e2e:critical` after building `extension/dist/` (mocked AbuseIPDB/OTX/URLScan.io/GreyNoise; no live vendor calls). After `npm run build`:

```bash
cd extension
npm run test:e2e:install   # first time only
npm run test:e2e:critical
```

E2E scope, limits, and flake avoidance: [docs/contributors/testing.md](docs/contributors/testing.md). PR workflow: [CONTRIBUTING.md](CONTRIBUTING.md). Contributor guides: [docs/contributors/README.md](docs/contributors/README.md).

From the repository root on Windows:

| Script | Purpose |
|--------|---------|
| `.\scripts\check.ps1` | Lint + unit tests in `extension/` |
| `.\scripts\build.ps1` | `npm install` + `npm run build` in `extension/` |
| `.\scripts\package-extension.ps1` | Build and zip `extension/dist/` to `release/vera5-0.1.0.zip` |
| `.\scripts\dev.ps1` | Vite dev server in `extension/` (UI shells only) |

## License

[MIT License](LICENSE). Bundled open-source components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Version history: [CHANGELOG.md](CHANGELOG.md).
