# Vera5

Browser extension for on-demand IOC detection and triage on `http://` and `https://` pages you browse. Visible-text IOC detection runs by default; optional link attribute scanning is off until you enable it in Settings. Scans, enrichment, scoring, export, investigation sessions, and IOC collections run locally—you bring your own API keys; Vera5 does not operate a shared enrichment cloud. **Chromium** is the primary install target (`extension/dist/`); an experimental **Firefox** Manifest V3 build ships as `extension/dist-firefox/`. Optional **local AI summary** and an optional localhost FastAPI aggregator both stay on `127.0.0.1`, off by default until you enable them in settings.

## Quick start (install and keys)

**Install (developers and testers)**

```bash
cd extension
npm install
npm run build
```

Load **`extension/dist/`** in Chrome (manifest **0.1.0**). See [Load unpacked (Chrome)](#load-unpacked-chrome) for load steps, packaging, and a manual walkthrough.

**Firefox (experimental):** From `extension/`, run `npm run build:firefox`, then load **`extension/dist-firefox/manifest.json`** as a temporary add-on in Firefox. See [Load temporary add-on (Firefox)](#load-temporary-add-on-firefox) and [docs/browser-support.md](docs/browser-support.md).

On **first install**, Vera5 opens **Settings** once for a four-step **Install quick start** wizard (Welcome → optional live-source API keys → enrichment control → trust defaults). Step 2 offers key fields for **AbuseIPDB**, **OTX**, **URLScan.io**, **GreyNoise**, **Shodan**, and **Censys** (API ID). **Censys** also needs a separate secret under **API keys** on the full **Settings** page; **VirusTotal** keys are configured there too. Completing the wizard keeps **manual-only enrichment** on and **auto-scan** off unless you change them in the wizard or under **Scanning**.

**Bring your own API keys (BYOK/BYOA)**

Vera5 does not ship vendor credentials or proxy enrichment through maintainer infrastructure.

1. Open **Vera5 Settings** from the extension workspace (Chromium side panel or Firefox toolbar popup).
2. Enter your own **AbuseIPDB**, **OTX**, **URLScan.io**, **GreyNoise**, **Shodan**, **Censys**, and/or **VirusTotal** API keys (masked in the UI). **Censys** requires an API ID and a separate secret field.
3. Enable those sources under **Enrichment Sources**. Keys stay in `chrome.storage.local` on your machine.
4. Leave **Manual-only enrichment** on (default) until you are ready for automatic vendor fetches when you open the triage overlay.

**Optional localhost backend:** User-operated FastAPI on `127.0.0.1` for AbuseIPDB IPv4 enrichment (and optional **`/summarize`** when you use the backend AI summary path). Off by default. Setup: [docs/local-mode.md — Install the optional backend](docs/local-mode.md#install-the-optional-backend).

**Optional local AI summary:** Off by default under **Local AI Summary** in settings. Requires a ready enrichment card and a model you run on `127.0.0.1`. Behavior, grounding rules, and Ollama model naming: [docs/ai-summary.md](docs/ai-summary.md), [SECURITY.md — Optional local AI summary](SECURITY.md#optional-local-ai-summary-llm). See **Optional local AI summary** in [What works today](#what-works-today).

The extension does not read API keys from a repository `.env` file. Optional root `.env.example` is for maintainer tooling only; backend keys belong in `backend/.env` on your machine when you use the optional aggregator.

**Privacy summary**

- Scans and detection run locally on pages you open.
- Live enrichment sends **only the selected indicator value** to vendors **you** enable—not full page content.
- Optional **link attribute scanning** (off by default) reads allowlisted link and attribute values locally only when you enable it under **Trust & consent**—never full pages or attribute dumps to Vera5.
- Optional **local AI summary** (off by default) sends normalized enrichment JSON to `127.0.0.1` only when you enable it and click **Generate summary**—not page HTML or API keys.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Trust controls (pre-query notices, domain policy, internal asset lists) can block vendor calls before they leave the browser.

Details: [Privacy and keys (BYOK/BYOA)](#privacy-and-keys-byokbyoa), [SECURITY.md](SECURITY.md), [docs/security-model.md](docs/security-model.md).

## Limitations

What Vera5 does **not** do today:

| Limitation | Detail |
|------------|--------|
| **Browser support** | **Chromium** (primary): Chrome, Edge, Brave, and similar Manifest V3 browsers. **Firefox** (experimental): temporary add-on from `extension/dist-firefox/` only—not distributed on Mozilla Add-ons (AMO). Safari/WebKit is not supported. |
| **Install path** | **Chromium:** unpacked load from `extension/dist/` (manifest **0.1.0**). Package a zip with `.\scripts\package-extension.ps1` at the repository root (`release/vera5-0.1.0.zip`). Chrome Web Store listing draft: [docs/store-listing.md](docs/store-listing.md)—submission is separate operator work. **Firefox:** build `extension/dist-firefox/` and load `manifest.json` as a temporary add-on (`about:debugging`); package with `.\scripts\package-extension-firefox.ps1` (`release/vera5-firefox-0.1.0.zip`). Temporary add-ons do not persist across full browser restarts. |
| **Live enrichment** | Live HTTPS API queries when you enable **AbuseIPDB**, **OTX**, **URLScan.io**, **GreyNoise (community)**, **Shodan**, **Censys**, or **RDAP/WHOIS** (indicator-type coverage in **What works today**). All live calls dispatch through the bundled **connector registry** in the background worker—no maintainer enrichment relay. **RDAP/WHOIS** is keyless (domain indicators only). **VirusTotal** saves your API key locally and provides pivot links; live HTTPS enrichment is not enabled in the extension today. Other registry entries remain pivot- and settings-only. Stable registry ids for each source: [docs/api-integrations.md](docs/api-integrations.md). |
| **Backend** | No Vera5-operated enrichment relay, shared team workspace, or cloud sync for sessions, collections, or keys. An optional user-operated FastAPI aggregator on `127.0.0.1` (extension bridge off by default) centralizes SQLite cache, rate limits, **AbuseIPDB IPv4** live enrichment, and optional **`/summarize`** for local AI summary. With the toggle on and the server reachable, OTX, URLScan.io, GreyNoise, Shodan, Censys, and **RDAP/WHOIS** are not enriched through the backend—turn **Use local backend** off for those sources. If the toggle is on but localhost is down, Vera5 falls back to in-extension connectors. |
| **Local AI summary** | No bundled or cloud LLM—opt-in only. Requires a user-operated OpenAI-compatible server on `127.0.0.1`. No endpoint or model fields in Settings today (fixed `127.0.0.1:11434` path and `"model":"local"` in requests). Narrative markdown is unverified and does not replace the local composite risk score or per-source vendor rows. |
| **Page coverage** | Content scripts on `http://` and `https://` only. Default detection reads visible text nodes (not scripts or hidden input values); stops after 2,500 text nodes per scan. Optional **Scan link attributes for IOCs** (off by default) adds a separate capped pass over allowlisted `href`, `src`, `data-url`, `data-href`, `data-src`, and `cite` values when you enable it in Settings. |
| **Data sent to vendors** | Indicator values you choose to enrich—not full pages, attachments, or clipboard dumps. |
| **Scoring** | Advisory labels computed locally; not a vendor verdict. Blended **/100** needs at least two parseable OK source results. See **Composite risk score** in [What works today](#what-works-today) for extended-indicator behavior. |
| **Automation** | Pull request CI runs browser smokes on Playwright Chromium with mocked vendors—it does not replace manual checks on an unpacked Chromium build or a Firefox temporary add-on before you rely on the extension in production triage. Optional local Firefox smokes (`npm run test:e2e:firefox`) cover temporary add-on load and a scan → enrich → export path on a fixture page; they do not gate merge today. |
| **README images** | No embedded screenshots. Capture guide: [docs/screenshots.md](docs/screenshots.md). |

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/contributors/testing.md](docs/contributors/testing.md) (E2E scope and limits).

## Operator surfaces

On `http://` and `https://` tabs, day-to-day triage uses the surfaces below.

| Surface | Where it runs | Role |
|---------|---------------|------|
| **On-page overlay** | Content script on the active page | Triage card on scanned highlights: trust details, enrichment, pivots, notes, optional **AI summary (local, unverified)** when enabled, **Label**, **Pin**, **Session timeline**, **Save to collection…**, copy, and export. Open by clicking a highlight or with **Enter** / **Space** on a focused highlight; **ArrowDown** / **ArrowUp** move between highlights. See **What works today** for field-level behavior. |
| **Command palette** | Content script on the active page | **Ctrl+Shift+K** / **Cmd+Shift+K** opens a searchable list of core actions: **Scan page**, **Enrich selection** (when text is selected), **Open history**, **Source health**, **Copy filtered Markdown**, **Export tray subset**, **Clear highlights**, and **Open options**. Choose a command with the keyboard or mouse; **Esc** closes the palette. |
| **Selection context menu** | Browser context menu on selected text | Right-click a text selection → **Enrich selection with Vera5** resolves an indicator in the selection and opens the overlay for manual enrichment (same trust gates as **Enrich selection**). |
| **Extension workspace** | Chromium **side panel** (toolbar click) or Firefox **toolbar popup** / optional **sidebar panel** | Extension on/off, scan and selection actions, **Investigation session** (title, rollups, recent sessions, session export, **Promote session to collection…**), **Investigation history** (recent enriched IOCs, reopen-to-card, clear history), **Detected indicators** tray (**Save to collection…**, **Add filtered to collection…**), **IOC collections** (view members, rename, delete, export), **Source operations** (cache, cooldown, per-source status, vendor quota hints, scoped clear cache), **Settings**, **Permissions**. Chromium keeps the panel open while you switch tabs. |
| **Settings (options) page** | Dedicated options tab for keys, enrichment toggles, scanning, cache, trust controls (including **Scan link attributes for IOCs**), and **Settings Backup**. See **Options page** in [What works today](#what-works-today) for the full control list. On extension update, Vera5 runs a local storage schema migration and retains a pre-migration backup snapshot until the next migration—see **Settings migration** in [What works today](#what-works-today). Per-source source-health details are shown in the extension workspace **Source operations** section. |
| **React hover card** | Unit tests only | **Not injected into page tabs.** Shared scoring logic with the on-page overlay; not a production triage surface. |

Keyboard shortcuts: **Ctrl+Shift+Y** / **Cmd+Shift+Y** triggers **Scan page**; **Ctrl+Shift+K** / **Cmd+Shift+K** opens the **command palette**. After **Scan page** (shortcut or palette), focus the extension workspace to refresh the **Detected indicators** tray for that tab.

See [Local mode — what runs where](docs/local-mode.md) for extension-only runtime, optional localhost backend boundaries, and local storage; [Typical triage flow](docs/analyst-workflows.md) for scan, overlay, and enrichment on a page tab.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | **Chromium:** `npm run build` in `extension/`, then load `extension/dist/` unpacked in Chrome. **Firefox (experimental):** `npm run build:firefox`, then temporary add-on load—see [Load temporary add-on (Firefox)](#load-temporary-add-on-firefox). |
| **Install quick start** | First-run wizard in **Settings**: install checklist, optional live-source API keys (saving a key can auto-enable that source), **Manual-only enrichment** (recommended on), auto-scan summary, and pre-query notice choice (**Show pre-query notices (recommended)** or skip). Finishing the wizard persists safe defaults (manual-only on, auto-scan off). |
| **Command palette** | **Ctrl+Shift+K** / **Cmd+Shift+K** on a page tab opens a filterable command list. Commands include **Scan page**, **Enrich selection** (when text is selected), **Open history**, **Source health**, **Copy filtered Markdown**, **Export tray subset**, **Clear highlights**, and **Open options**. **Enter** runs the highlighted command; **Esc** closes the palette. **Open history** and **Source health** focus the extension workspace on **Investigation history** or **Source operations**. |
| **Context-menu enrich** | With indicator text selected, right-click → **Enrich selection with Vera5** detects the IOC, opens the overlay, and starts manual enrichment when resolved. Domain policy, internal asset lists, and pre-query disclosure apply before any vendor fetch—same as **Enrich selection**. |
| **Investigation history** | Local list (up to **50** entries) of recently enriched indicators with page origin and timestamp in the extension workspace **Investigation history** section. Click a row to scroll to the page highlight and reopen the overlay when you are on the **same tab origin** and the IOC is still highlighted (rescan if needed). Palette **Open history** focuses the same section. Rows linked to the active investigation session show **Linked to this session**. **Clear history** (with confirmation) removes all entries on this browser profile. History records after completed enrichment only—no cloud sync. |
| **Selection scan** | On dense dashboard exports, highlight a table row or panel and use **Scan selection** in the extension workspace to detect indicators in visible text only within that range—without rescanning the full page. Link attribute scanning applies to **Scan page**, not selection scans. |
| **Selection enrich** | Select indicator text (including inside a scanned highlight) and use **Enrich selection** (extension workspace, command palette, or context menu) to open the overlay and request enrichment for that value when it resolves to a single supported indicator. |
| **Keyboard triage** | Highlights are focusable (`Tab`). **ArrowDown** / **ArrowUp** move to the next or previous highlight in document order (wraps at the ends); from page focus after scan, **ArrowDown** selects the first highlight and **ArrowUp** the last. **Enter** / **Space** on a focused highlight opens the overlay and moves focus to the first focusable control in the panel (**Copy Indicator**, **Copy defanged** when shown, or session controls such as **Pin** when a session is active). **Escape** closes the overlay; after a keyboard-opened overlay, focus returns to the highlight. Arrow keys do not triage while focus is inside the overlay panel. |
| **IOC tray** | Scrollable **Detected indicators** list in the extension workspace with per-type filter chips and count summary (for example `11 indicators · 1 URL · 1 SHA256 · 1 SHA1 · 2 MD5 · 2 CVE · 2 IP · 1 DOM · 1 EML` on `sample-alert.html`, or additional `ASN` / `CIDR` / `PATH` / `ONION` chips when those types appear on a page). Click a row to scroll to the page highlight and open the on-page overlay when a highlight exists. Optional source-attributed status hints (for example `OTX · Cached`) when a stored enrichment result exists. Each row can expand **Why detected?** (type, reason, source context, ignored overlaps). When defanged text differs from the stored value, rows show the on-page form and a **Refanged:** line. Clear feedback when a row’s highlight is missing after DOM changes—rescan to refresh. Bulk copy, export, and ticket-template actions live on the overlay and respect the tab’s stored tray filter. Palette **Copy filtered Markdown** / **Export tray subset** use the same filter state. |
| **On-page highlights** | After scan, detected indicators with a mapped text node get an inline underline, type badge, and **›** enrich control when highlighting is enabled. Attribute-only matches (when link attribute scanning is on) can appear in the tray without a page highlight. |
| **Detection provenance** | Each match stores a rule id and source text hint from the scan. **Why detected?** on the overlay and IOC tray explains the indicator type, detection reason, surrounding context, and any overlapping matches dropped during dedupe. When **Scan link attributes for IOCs** is enabled, markup-sourced matches include attribute provenance (for example `href on <a> element: …`). |
| **Defang and refang** | Detects common defanged forms in visible text (`hxxp`/`hxxps`, bracket dots such as `[.]`, bracket scheme separators). Match values are refanged for enrichment, pivots, and default copy; highlights still cover the original on-page text. When forms differ, use **Copy defanged** or **Copy refanged** on the overlay header. |
| **Composite risk score** | When enrichment returns per-source results, a **Risk score** section shows a locally computed advisory band (**Unknown**–**Critical**, with **/100** when a blended composite is available), a **How this score was computed** panel (ordered per-source lines from normalized summaries, or an explicit empty state when no parseable OK summaries exist), and a **Sources disagree** note when source bands diverge materially. Blended **/100** labels parse summary patterns from **AbuseIPDB**, **OTX**, **URLScan.io**, and **GreyNoise** today; **Shodan**, **Censys**, and **VirusTotal** rows can appear on the card without contributing to the composite. Requires at least two parseable OK enrichment results for a blended **/100** label; with one OK source, expect **Unknown risk**, an insufficient-data notice, and a single reasoning line when that summary is parseable. **Email address**, **ASN**, **IPv4 CIDR**, **file path**, and **onion domain** indicators do not produce blended **/100** labels—enabled live connectors skip those types with explicit copy, so expect **Unknown risk** after enrichment while **Recommended next pivots** remain available. If every enrichment source is disabled, the section shows **Risk score unavailable** with settings guidance. Footer disclaimers may appear when scoring applies. |
| **Live enrichment** | **AbuseIPDB** (IPv4), **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE), **URLScan.io** (domain, URL), **GreyNoise (community)** (IPv4), **Shodan** (IPv4, domain), **Censys** (IPv4 only), and **RDAP/WHOIS** (domain only, no API key) when enabled in extension-only mode (**Use local backend** off). The background worker routes each enabled live source through the **connector registry** with per-source capability metadata and a single outbound fetch path—UI and content scripts never call vendor APIs directly. With the toggle on and the aggregator reachable, live calls for **AbuseIPDB IPv4** go to `http://127.0.0.1:8765/enrich`; OTX, URLScan.io, GreyNoise, Shodan, Censys, and **RDAP/WHOIS** are not queried through the backend until you turn the toggle off. If the toggle is on but localhost is down, Vera5 falls back to in-extension connectors with an honest status hint. **VirusTotal** accepts a saved API key and pivot links but does not perform live HTTPS enrichment in the extension today. Enabled live sources run in parallel where supported; partial success keeps working sources visible while failures stay per source. Only the indicator value is sent to vendors (**RDAP/WHOIS** queries public RDAP for the domain name—not a full WHOIS port 43 dump in the overlay). URLScan.io receives a search query for the domain or URL—not a full page submission; GreyNoise receives the IPv4 in the community lookup path; Shodan uses host or DNS domain lookups; Censys uses IPv4 host view only. Live HTTPS calls are limited to declared connector API hosts (`api.abuseipdb.com`, `otx.alienvault.com`, `urlscan.io`, `api.greynoise.io`, `api.shodan.io`, `search.censys.io`, `rdap.org`; `www.virustotal.com` is allowlisted in the manifest without live enrichment today). A runtime allowlist blocks undeclared outbound fetch before network I/O. Pre-query disclosure (when enabled), domain policy, and internal asset lists gate outbound calls before the background worker fetch runs. |
| **Connector registry** | Thirteen enrichment sources share one registry inside the extension bundle: stable ids (`abuseipdb`, `otx`, `urlscan`, `rdap_whois`, …), per-source capability metadata (live vs pivot-only, API key requirement), and a single background dispatch path. Connectors ship in the package—no hosted marketplace or remote code loading. Private fork pattern: [docs/local-connector-stub.md](docs/local-connector-stub.md). Architecture: [docs/architecture.md — Connector SDK](docs/architecture.md#connector-sdk). |
| **Settings packs** | Export a **settings pack** (`vera5-settings-pack.json`) from **Settings Backup** to share connector toggles, cache TTL, domain policy, and analyst mode—never API keys. **Import settings pack** shows a field-by-field diff preview before you apply; stored API keys on the profile stay unchanged. Separate from full **Settings Backup** export/import (optional API keys). The pack importer rejects threat-profile-shaped JSON; documented merge rules apply when threat profiles are in use—see [docs/analyst-workflows.md — Settings packs and threat profiles](docs/analyst-workflows.md#settings-packs-and-threat-profiles) and [docs/security-model.md](docs/security-model.md). |
| **Settings migration** | When the storage schema version changes on extension reload or update, the background worker migrates settings and enrichment cache metadata locally before enrichment reads the new shape. Vera5 writes a **pre-migration backup** snapshot to `chrome.storage.local` (settings, connector enable map, cache, and index when present; API keys included if they were stored). Export **Settings Backup** JSON before upgrading when you want a file rollback. Import restores the same payload shape. Rollback restores local storage only—not extension code. Details: [docs/architecture.md — Storage schema migration and rollback](docs/architecture.md#storage-schema-migration-and-rollback). |
| **Optional local backend** | User-operated FastAPI on `127.0.0.1:8765`: SQLite TTL cache, central per-source rate limits, redacted request logging, AbuseIPDB IPv4 enrichment with extension parity, and optional **`/summarize`** for local AI summary when **Use local backend** is on. Keys in `backend/.env` on your machine; CORS restricted to your extension origin. **Use local backend** is off by default—extension-only mode needs no Python install. Turn the toggle off to enrich with OTX, URLScan.io, GreyNoise, Shodan, Censys, or **RDAP/WHOIS** from the extension. See [docs/local-mode.md](docs/local-mode.md) and [SECURITY.md — Optional local enrichment backend](SECURITY.md#optional-local-enrichment-backend). |
| **Optional local AI summary** | Opt-in **Enable local AI summary** in Settings (off by default). On ready enrichment cards, **Generate summary** sends normalized export JSON to `http://127.0.0.1:11434/v1/chat/completions` by default—never page HTML, browsing history, or vendor API keys. Markdown renders in **AI summary (local, unverified)** below **Intel Summary**; it does not replace **Risk score** or **How this score was computed**. Response grounding rejects invented vendor detection counts and verdict language before display. You operate the model (Ollama, llama.cpp, or equivalent); Vera5 does not bundle, host, or relay cloud LLM inference. With **Use local backend** on, Vera5 tries `http://127.0.0.1:8765/summarize` first and falls back to the direct endpoint if the backend is unreachable. See [docs/ai-summary.md](docs/ai-summary.md) and [SECURITY.md — Optional local AI summary](SECURITY.md#optional-local-ai-summary-llm). |
| **Pre-query disclosure** | When pre-query notices are on (default until you choose on first visit to Settings), the overlay shows an inline notice naming enabled vendors and the indicator value before any live fetch. **Send query** proceeds; **Cancel** aborts. **Don't show this notice again** turns off later notices (same as the **Trust & consent** toggle). Applies to manual enrich and context-menu enrich. |
| **Domain policy** | **Trust & consent** sets allow-by-default or deny-by-default hostname rules for auto-scan and live enrichment. Fresh installs include a default sensitive webmail denylist. Denylisted hosts skip mutation rescans and block vendor calls before disclosure when the domain enrich gate is on (default). Merge the **Sensitive sites denylist** preset for banking, health, and HR patterns. Pattern syntax supports exact hosts, prefix wildcards (`mail.*`), and suffix wildcards (`*.corp.example`). |
| **Internal asset lists** | Optional indicator-level lists—internal domains, IPv4 CIDR ranges, and labeled vendor/SaaS hostname patterns—block live enrichment for matching IOC values even on otherwise allowed pages. Configure under **Trust & consent**; empty lists impose no block. |
| **Analyst workflow presets** | **SOC triage**, **CTI research**, and **DFIR investigation** presets apply role-specific defaults: built-in presets enable **AbuseIPDB** and **OTX** only (not URLScan.io, GreyNoise, Shodan, Censys, or other live sources), plus manual-only and notice defaults, optional private-space IPv4 (DFIR), default export template, and recommended pivot ordering. |
| **Registered enrichment sources** | Thirteen sources appear in settings and the overlay registry (AbuseIPDB, OTX, VirusTotal, URLScan.io, GreyNoise, Shodan, Google Safe Browsing, Pulsedive, MalwareBazaar, Censys, ThreatFox, URLhaus, **RDAP/WHOIS**). Each maps to a stable registry id used in storage, cache keys, and dispatch—see [docs/api-integrations.md — Connector registry IDs](docs/api-integrations.md#connector-registry-ids). **AbuseIPDB**, **OTX**, **URLScan.io**, **GreyNoise (community)**, **Shodan**, and **Censys** perform live HTTPS enrichment when enabled with saved credentials (**URLScan.io**: domain and URL only; **GreyNoise** and **Censys**: IPv4 only; **Shodan**: IPv4 and domain). **RDAP/WHOIS** performs live HTTPS enrichment for **domain** indicators when enabled—no API key; responses show registrar, dates, nameservers, and status with source attribution (not a raw WHOIS port 43 dump by default). **VirusTotal** stores a masked API key and shows pivot links; live enrichment is not enabled in the extension today. **Email address**, **ASN**, **IPv4 CIDR**, **file path**, and **onion domain** indicators are detected and pivotable, but live connectors skip them with explicit copy such as `AbuseIPDB does not support this indicator type.` Other registry entries without live connectors show missing-key, unsupported-type, disabled, or pivot-only rows; pivot links still appear where the registry defines them for the IOC type. |
| **Enrichment cache** | Successful responses are stored locally per indicator and per source. Failed live attempts may also be stored so the extension workspace tray can show the last known per-source status without re-fetching. Default time-to-live is about one hour; adjust the global seconds value on the options page, with optional per-source overrides. Repeat enrichment reuses cache until expiry. **Clear cache** removes stored responses without changing keys or toggles. |
| **Manual refresh** | **›** on a highlight forces a live fetch for that indicator, bypassing cache and removing cached entries for that indicator first. Manual refresh also bypasses the global rate-limit cooldown gate (vendors may still return HTTP 429). |
| **Enrichment errors** | Missing API key shows **Open settings** on the overlay; HTTP 429 shows per-source backoff and retry hints (including URLScan.io quota headers, GreyNoise JSON rate-limit bodies, Shodan/Censys rate-limit responses, and **RDAP/WHOIS** `Retry-After` when applicable) and starts a global cooldown that blocks further automatic enrichment until the window passes; invalid keys, timeouts, NXDOMAIN-style **not found** responses (**RDAP/WHOIS** on unregistered domains), and other vendor errors include source attribution. Domain policy and internal asset gates show explicit block messages without sending the indicator to vendors. |
| **Quota protection** | With manual-only enrichment off, rapid overlay opens debounce auto-fetch (~400 ms) to the last indicator selected. |
| **Pivot recipes** | **Recommended next pivots** lists type-specific vendor links from the registry, each with a source badge and static workflow guidance—including **email address**, **ASN**, **IPv4 CIDR**, **file path**, and **onion domain** rows where defined. Order follows the applied analyst workflow preset when one is set. Guidance is authored copy only—it does not repeat live enrichment scores or vendor ratios. Vera5 does not proxy navigation. **Open live URL** on URL indicators is separate: it opens the refanged URL in a new tab only after you confirm. |
| **Investigation session** | Named local case workspace in the extension workspace: editable title, total and per-type IOC rollups from the **latest scan on the synced page** (for example `11 indicators · 1 URL · 1 SHA256 · 1 SHA1 · 2 MD5 · 2 CVE · 2 IP · 1 DOM · 1 EML` on `sample-alert.html`), enrich/export activity counts, **New session**, and **Recent sessions** (reopen, rename, archive, delete). **Archive** hides a session from the recent list; archived sessions cannot be reopened from the workspace. First **Scan page** auto-creates a session when none is active. Sessions persist in local storage only—no cloud sync or shared team workspace. |
| **Session IOC memory** | On the overlay when a session is active: **Label** (Benign, Internal, Suppress false positive, Case important), **Pin** for triage priority, and **Session timeline** (first seen, enrich events, export events per indicator). Labels and pin state persist locally per IOC value. |
| **Session export** | From the extension workspace when a session is active: **Copy** or **Download** **Markdown**, **JSON**, or **CSV** using session metadata plus IOC rows from the **active tab's current scan** (enrichment snippets when cached). JSON includes `schemaVersion` and session fields; CSV reuses the tray CSV row contract. Exports redact API keys and raw vendor secrets. Rescan the page before export if the tray is empty or stale. |
| **IOC collections** | Named local indicator groupings separate from the active investigation session. **Save to collection…** on a tray row or overlay adds one indicator; **Add filtered to collection… (N)** in the extension workspace bulk-adds the filtered tray subset. **Promote session to collection…** copies session IOC members into a new collection you name. The **IOC collections** section lists saved collections with member counts and last updated time; **View members**, **Rename**, **Delete**, **Remove** member, and member links jump to page highlights when the IOC is on the current tab. Duplicate type+value pairs dedupe. Collections persist in local storage across sessions and restarts. No team sharing or cloud sync. |
| **Collection export** | From **IOC collections** in the extension workspace: **Export Markdown**, **Export JSON**, or **Export CSV** per collection. Markdown includes collection summary, IOC table, cached enrichment snippets when available, and source attribution. JSON includes `schemaVersion`, collection metadata, and members. CSV uses the same row contract as session and tray exports. Empty collections skip CSV download. Exports redact API keys and raw vendor secrets. Separate from **Session export** and per-indicator overlay export. |
| **Source operations** | Extension workspace **Source operations** panel (also via palette **Source health**): global rate-limit cooldown timer, last cache clear time, total cache entries, per-source last status and last error, cached row counts, **Vendor quota** orientation strings from vendor documentation, and scoped **Clear cache** per source. Complements **Clear cache** on the settings page. |
| **Case export formats** | Markdown, JSON, and plain-text (`.txt`) per indicator (`schemaVersion: 1` for JSON), plus ticket templates (**Jira comment**, **TheHive case note**, **Analyst update**, **Obsidian note**, **Markdown report**, **CSV rows**). All derive from the normalized enrichment record—composite score, reasoning chain, disagreement callout, per-source rows, optional analyst notes, and pivot links in markdown/JSON. The overlay **Template** row defaults to your saved export template or analyst preset. Per-indicator **Export** / **Copy** menus write one IOC at a time. Filtered scan subsets use **Copy all**, **Copy filtered**, **Copy filtered Markdown** / **JSON**, **Export filtered Markdown** / **JSON**, and **Export template** / **Copy template** on the on-page overlay (clipboard or download only). The command palette can copy or export the filtered tray subset without opening the overlay. Per-indicator markdown/JSON field contract: [docs/export-artifacts.md](docs/export-artifacts.md). Session-level and collection-level exports use separate builders—see **Session export** and **Collection export** above. |
| **Options page** | **Use local backend** toggle (off by default), **Enable local AI summary** under **Local AI Summary** (off by default), masked API key fields for each source that requires them (Censys uses API ID plus a separate secret field; **RDAP/WHOIS** has an enable toggle only—no key field); enable toggles, **Indicator types** checkboxes (IPv4, domain, URL, MD5, SHA1, SHA256, CVE, email address, ASN, IPv4 CIDR, file path, onion domain); **Include private-space IPv4 addresses**; default and per-source **cache lifetime** (seconds); auto-scan; manual-only enrichment (default on); **Trust & consent** (pre-query notices, **Scan link attributes for IOCs** with first-enable consent and optional per-site overrides, domain mode and allow/deny lists, domain and internal-asset enrich gates, presets, internal asset lists, analyst workflow presets); cache clear; **Settings Backup** full export/import (keys omitted unless you opt in); **Export settings pack** / **Import settings pack** with diff preview (never includes API keys). |
| **Auto-scan** | Optional rescan after DOM changes (debounced). Off by default. Uses the same page scan pipeline as **Scan page** (including link attribute scanning when that toggle is on). Respects domain policy on the current tab hostname—denylisted origins do not schedule mutation rescans. |
| **Background worker** | Message routing, scan and command-palette commands, selection context menu registration, Chromium side-panel open on toolbar click, tab scan-summary storage for the extension workspace tray, investigation session persistence, investigation history persistence, IOC collection persistence, enrichment cache, per-source last-status snapshots for source operations, global rate-limit cooldown, **storage schema migration** on extension update (with local pre-migration backup), optional localhost enrich bridge (`127.0.0.1:8765` when **Use local backend** is on), and parallel live-connector fetches through the **connector registry** (AbuseIPDB, OTX, URLScan.io, GreyNoise, Shodan, Censys, and **RDAP/WHOIS**) when the bridge is off or unreachable. Chromium uses a MV3 service worker; Firefox uses event background scripts with the same bundle. |
| **Link attribute scanning** | **Off by default.** Enable **Scan link attributes for IOCs** under **Trust & consent** after the first-enable consent dialog (local processing only; enrichment still sends indicator values you choose to enrich). When on, Vera5 reads allowlisted link and attribute values on **Scan page** and auto-scan passes—in addition to visible text—and merges results by deduplicated type+value (visible text wins duplicates). Skips password fields, hidden inputs, and non-visible subtrees. Caps at **1,000** attribute values per page scan; attribute-only IOCs appear in the tray and snapshot but may not receive page highlights. Optional per-site always-on or always-off overrides when **Remember per-site attribute scan choices** is on. Threat model and allowlist: [docs/security-model.md — Opt-in attribute and href extraction](docs/security-model.md#opt-in-attribute-and-href-extraction). |
| **IOC detection** | Visible text nodes on demand (default); skips `script`, `style`, `textarea`, and metadata subtrees. Optional link attribute pass when **Scan link attributes for IOCs** is on—see **Link attribute scanning** above. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE, email address, ASN, IPv4 CIDR, conservative file path, and Tor v3 onion domain—with false-positive guards (system-path denylist, invalid onion hostnames, export-metadata and version-range decoys on SOC-style pages) and overlap deduplication. Disable individual types under **Indicator types** in settings. Private-space IPv4 (RFC1918, loopback, link-local) is omitted by default; enable **Include private-space IPv4 addresses** when needed. Stops after 2,500 text nodes per scan. Detector grammar and negative fixtures: [extended indicator detector spec](docs/phase2-ioc-detector-spec.md). |
| **Build** | **Chromium:** `npm run build` emits `dist/`, then runs `verify:dist` and `verify:security`. **Firefox:** `npm run build:firefox` emits `dist-firefox/` with the same bundles and runs `verify:firefox-manifest`, `verify:dist` (Firefox dist), and `verify:security:firefox`. Shared checks cover extension-page CSP, outbound fetch allowlist, no `eval`, production logging hygiene, redacted test fixtures, and empty credential placeholders in root `.env.example`. `npm run check` runs lint and unit tests. `npm run audit:prod` checks production dependencies (same blocking policy as CI). Optional `npm run test:e2e:critical` (Chromium) and `npm run test:e2e:firefox` run browser smokes on unpacked builds with mocked vendor HTTP (no live API calls in CI). |

## Configuration flow

1. Build and load the extension: **Chromium** — [Load unpacked (Chrome)](#load-unpacked-chrome); **Firefox (experimental)** — [Load temporary add-on (Firefox)](#load-temporary-add-on-firefox). On first install, complete the **Install quick start** wizard in **Settings** (four steps: Welcome checklist, optional API keys, enrichment control, trust defaults). Before upgrading an existing install, export **Settings Backup** JSON if you want a file rollback after storage migration.
2. Open **Vera5 Settings**, enter keys for **AbuseIPDB**, **OTX**, **URLScan.io**, **GreyNoise**, **Shodan**, **Censys**, and/or **VirusTotal** when you want those sources configured, enable **RDAP/WHOIS** when you want keyless domain registration context, and enable the live connectors you need. Live HTTPS responses come from enabled live connectors through the bundled registry (**URLScan.io**: domain and URL only; **GreyNoise** and **Censys**: IPv4 only; **Shodan**: IPv4 and domain; **RDAP/WHOIS**: domain only; **VirusTotal**: pivot links only today).
3. **Optional:** Install and start the localhost aggregator per [docs/local-mode.md#install-the-optional-backend](docs/local-mode.md#install-the-optional-backend). Set `VERA5_CORS_ORIGINS` to your extension ID and enable **Use local backend** under **Enrichment Sources** for AbuseIPDB IPv4 (and optional **`/summarize`** when you use the backend AI summary path). Leave the toggle **off** when you need OTX, URLScan.io, GreyNoise, Shodan, Censys, or **RDAP/WHOIS** live enrichment from the extension.
4. **Optional:** Enable **Enable local AI summary** when you run an OpenAI-compatible model on `127.0.0.1` (see [docs/ai-summary.md](docs/ai-summary.md) for the default URL and `"model":"local"` naming). Enrich an indicator to **ready**, open the overlay, and use **Generate summary**.
5. Under **Trust & consent**, set pre-query notices, domain policy, internal asset lists if needed, and an analyst workflow preset when useful. Leave **Scan link attributes for IOCs** off unless you need markup-only IOCs on trusted CTI paste hosts—enable only after the first-enable consent dialog.
6. Under **Scanning** and **Enrichment cache**, choose indicator types (including email, ASN, CIDR, file path, and onion when needed), optional private-space IPv4, cache lifetime, **Manual-only enrichment** (default on), and optional auto-scan.
7. Triage on page tabs via the overlay, extension workspace tray, command palette, or context menu—see [Operator surfaces](#operator-surfaces) and [Try detection and enrichment locally](#try-detection-and-enrichment-locally). Use palette **Open history** or **Source health** when you need recent enrichments or quota context without hunting through workspace sections.
8. Use **Investigation session** and **IOC collections** for case tracking and ticket handoff exports.
9. **Optional team handoff:** Export a **settings pack** from **Settings Backup** on one browser profile and import it on another after reviewing the diff preview—API keys stay local to each profile. See [docs/analyst-workflows.md — Settings packs and threat profiles](docs/analyst-workflows.md#settings-packs-and-threat-profiles).

More detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/analyst-workflows.md](docs/analyst-workflows.md), [docs/export-artifacts.md](docs/export-artifacts.md), [docs/ai-summary.md](docs/ai-summary.md), [docs/security-model.md](docs/security-model.md), [docs/soc-validation-fixtures.md](docs/soc-validation-fixtures.md).

## Example exported markdown

These samples are **per-indicator** overlay exports (`## Vera5 IOC Summary`), not **Investigation session** or **IOC collection** workspace exports. They show multi-source IPv4 markdown layout: blended composite score, numbered reasoning chain, optional disagreement callout, per-source summary rows, and an optional **Analyst notes** section when you saved a note for that IOC. JSON uses the same fields with `schemaVersion: 1` (see [docs/export-artifacts.md](docs/export-artifacts.md)).

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
| `extension/` | Vite + React + TypeScript; Chromium build output in `extension/dist/`, Firefox build in `extension/dist-firefox/`. |
| `docs/architecture.md` | Detector rules, false-positive tables, enrichment scope, **Connector SDK**, and storage migration rollback (see also [extended indicator detector spec](docs/phase2-ioc-detector-spec.md) for extended indicator grammar). |
| `docs/api-integrations.md` | Vendor limits, 429 handling, and **connector registry IDs** per source. |
| `docs/local-connector-stub.md` | Reference pattern for adding a bundled local connector in a private fork. |
| `docs/analyst-workflows.md` | Cache, refresh, keyboard triage, command palette, context-menu enrich, investigation history reopen, source health, investigation sessions, IOC collections, and quota-aware triage. |
| `docs/soc-validation-fixtures.md` | Splunk-export, Security Onion-style, extended-indicator, and link-attribute sample pages for repeatable detection checks. |
| `docs/export-artifacts.md` | Per-indicator markdown and JSON export contract, connector profile JSON field reference (library contract; not a separate Options export control), and local AI summary input shape. |
| `docs/ai-summary.md` | Optional local AI summary input contract, grounding rules, and disclaimers. |
| `docs/security-model.md` | Permissions, host access, CSP, outbound boundaries, hardening checklist, and hostile-page DOM guidance. |
| `docs/browser-support.md` | Chromium vs Firefox install paths, host-permission parity, CSP/telemetry notes, and known platform gaps. |
| `docs/local-mode.md` | Extension-only deployment and optional localhost enrichment backend setup. |
| `docs/contributors/` | Contributor architecture, connectors, cache, scoring, and testing. |
| `examples/` | Sample HTML (SOC dashboard exports, CTI bulletin with extended indicator types, benign navigation anchors, attribute-only IOC markup) and IOC strings for manual checks. |
| `docs/screenshots.md` | Screenshot capture guide for README and store assets. |
| `docs/store-listing.md` | Chrome Web Store listing draft (descriptions, single purpose, permission justifications). |
| `docs/release-notes-v0.1.0.md` | Release notes for tag `v0.1.0`; see README and [CHANGELOG.md](CHANGELOG.md) for version history. |
| `scripts/` | Windows helpers: `check.ps1`, `build.ps1`, `dev.ps1`, `package-extension.ps1` (Chromium zip to `release/`), `package-extension-firefox.ps1` (Firefox zip to `release/`). |
| `.github/workflows/` | Lint, unit tests, production dependency audit, Gitleaks on pull requests and pushes to `main`, Chromium browser E2E smokes on pull requests, and a Firefox `dist-firefox/` build artifact (`extension-quality.yml`). |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE](LICENSE) | Security, contribution, version history, bundled dependency notices, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Background worker (Chromium service worker or Firefox event background scripts), enrichment handler and **connector registry** dispatch, storage migration on update, investigation session handlers, investigation history message routing, IOC collection handlers, cache, cooldown, context menu registration. |
| `extension/src/content/` | Detection, highlights, **production on-page overlay**, command palette, investigation history reopen listener, debounced fetch, auto-scan. |
| `extension/src/sidepanel/` | Native Chromium side panel host (reuses extension workspace UI; refreshes tray state on tab switch). |
| `extension/src/components/` | React hover card and risk score UI for unit tests (shared scoring with the overlay; not injected into page tabs). |
| `extension/src/lib/` | IOC regex, connector modules, connector registry (`connectorRegistry.ts`, `connectorDefinition.ts`, `enrichmentSourceRegistry.ts`), `browserCompat` shim (Firefox `browser.*` → shared `chrome.*` call sites), settings export/import, connector profile JSON contract (library; see export-artifacts.md), storage migration backup, investigation session model and export, investigation history model and storage, enrichment source operations snapshots, IOC collection model/storage/export, IOC labels, command registry, storage, cache, scoring, export builders, export templates, analyst notes, pivots, local AI summary service and prompt builders, UI styles. |
| `extension/prompts/` | Versioned enrichment-summary prompt template for local AI summary requests. |
| `extension/src/popup/` | Shared extension workspace UI (Firefox toolbar popup and side-panel host): enable, highlights, scan, selection actions, investigation session, investigation history, IOC collections manager, detected-indicators tray, source operations. |
| `extension/src/options/` | Settings page (keys, **Use local backend**, **Local AI Summary**, toggles, indicator types, cache TTL, **Settings Backup** export/import). |

## Browser support

| Browser | Build output | Install | Validation depth |
|---------|--------------|---------|------------------|
| **Chromium** (Chrome, Edge, Brave, similar) | `extension/dist/` | **Load unpacked** at `chrome://extensions` after `npm run build`; toolbar click opens the native **side panel** workspace | Primary. Pull-request CI runs automated browser smokes on this build. |
| **Firefox** (Gecko, Manifest V3) | `extension/dist-firefox/` | **Temporary add-on** — select `manifest.json` in `about:debugging#/runtime/this-firefox` after `npm run build:firefox` | Experimental. Shared bundles from the same source tree; CI and manual validation remain Chromium-first. Temporary load only (no AMO listing). Use **Firefox 115+** for `storage.session` parity with Chromium tab-tray behavior. |

On-page styles follow `prefers-color-scheme: dark` and `prefers-reduced-motion` where defined on both targets.

Install details, host-permission parity, CSP, telemetry posture, and known Firefox gaps: [docs/browser-support.md](docs/browser-support.md). Dual-browser development: [CONTRIBUTING.md](CONTRIBUTING.md).

## Load unpacked (Chrome)

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select **`extension/dist`** (must contain `manifest.json`, version **0.1.0**).
2. Pin the toolbar action if needed, then click it to open the **side panel** workspace. On **first install**, **Settings** opens for the **Install quick start** wizard—complete all four steps or use **Continue without keys** on step 2 when you want detection-only triage first.
3. After code changes: `npm run build`, then **Reload** the extension. Reload runs local storage migration when the schema version changed—export **Settings Backup** first if you need a manual rollback file.

**Package for store upload or offline handoff** (from repository root on Windows):

```powershell
.\scripts\package-extension.ps1
```

Writes `release/vera5-0.1.0.zip` with `manifest.json` at the zip root. See [docs/store-listing.md](docs/store-listing.md) and [docs/release-notes-v0.1.0.md](docs/release-notes-v0.1.0.md) before publishing.

## Load temporary add-on (Firefox)

```bash
cd extension
npm install
npm run build:firefox
```

1. Open **`about:debugging#/runtime/this-firefox`** in Firefox.
2. Click **Load Temporary Add-on…** and select **`extension/dist-firefox/manifest.json`** (the file, not the folder).
3. Pin the toolbar action if needed. On **first install**, **Settings** may open for the **Install quick start** wizard—same BYOK and trust flow as Chromium.
4. After code changes: `npm run build:firefox`, then **Reload** the add-on in `about:debugging` (or remove and load again). The add-on is removed when Firefox fully exits.

**Package for offline handoff** (from repository root on Windows):

```powershell
.\scripts\package-extension-firefox.ps1
```

Writes `release/vera5-firefox-0.1.0.zip` (Vite dev shell artifacts excluded). Unzip and load `manifest.json` from the unpacked directory.

For fixture-based manual checks, serve `examples/` over HTTP and run **Scan page** the same way as on Chromium—see [Try detection and enrichment locally](#try-detection-and-enrichment-locally).

### Try detection and enrichment locally

Steps below assume an unpacked **Chromium** load unless you loaded the Firefox temporary add-on first (fixture URLs and scan/enrich/export flows are the same on both targets).

Content scripts match `http://` and `https://` pages only. Serve examples over HTTP:

```bash
cd examples
python -m http.server 8080
```

1. Open `http://localhost:8080/sample-alert.html`, `http://localhost:8080/sample-blog.html`, `http://localhost:8080/sample-splunk-export.html`, `http://localhost:8080/sample-security-onion-alert.html`, or `http://localhost:8080/sample-extended-ioc-alert.html`. See [docs/soc-validation-fixtures.md](docs/soc-validation-fixtures.md) for expected counts and decoy checks. On `sample-alert.html`, confirm a defanged URL (`hxxps://…`) is detected and shows defanged on-page text with a **Refanged:** line and **Why detected?** on the overlay or tray; tray rollups should match the eleven-indicator fixture set (including the login URL, both MD5 hashes, and contact email `analyst@example.com`). On `sample-extended-ioc-alert.html`, confirm email, ASN, CIDR, file path, and onion highlights plus **Recommended next pivots** on the on-page overlay (live connectors should show unsupported-type **Skipped** rows when you enrich).
2. Enable the extension and highlighting, then **Scan page** (on `sample-splunk-export.html`, try **Scan selection** on one table row first).
3. Open the extension workspace **Detected indicators** tray: confirm count summary and type filters on a dense page such as `sample-alert.html`; click a tray row to jump to a highlight and open the overlay. Expand **Why detected?** on a tray row when present. Use **ArrowDown** / **ArrowUp** on focused highlights to walk indicators on the page.
4. Press **Ctrl+Shift+K** / **Cmd+Shift+K** and run **Scan page**, **Open history**, **Source health**, or **Clear highlights** from the command palette.
5. Select indicator text on the page, right-click → **Enrich selection with Vera5**, or use **Enrich selection** / the palette equivalent when text is selected.
6. Save API keys and enable AbuseIPDB, OTX, URLScan.io, GreyNoise, Shodan, and/or Censys in settings when you want live enrichment (**Censys** needs API ID and secret; **VirusTotal** key storage is optional for pivots). Enable **RDAP/WHOIS** for keyless domain registration context on domains such as `example.com` on the fixture pages.
7. Click a highlighted IPv4—or focus a highlight and press **Enter**—(use **›** first when manual-only is on). With pre-query notices enabled, confirm **Send query** on the inline disclosure before the fetch. With multiple live sources enabled for the indicator type, check the **Risk score** label, **How this score was computed** panel (or its empty-state note when only one source has parseable data), per-source badges (for example **GreyNoise · Live**, **Shodan · Live**, or **Censys · Live** on IPv4), optional **Raw response**, **Recommended next pivots**, **Why detected?**, **Analyst notes**, **Copy defanged** / **Copy refanged** (or **Copy Indicator**), **Open live URL** on a URL indicator, **Export** / **Copy** menus, the **Template** row, and footer disclaimers when a score is shown.
8. Focus the extension workspace and confirm source-attributed tray hints (for example `OTX · Cached`, `GreyNoise · Live`, or `Shodan · Live`) on enriched rows; on the overlay, try **Copy filtered**, **Export filtered Markdown**, **Copy template** with **Analyst update** or **Jira comment**, or **Export template** with **CSV rows** for a filtered subset.
9. Reopen the same indicator on the page and confirm **Cached** / **· cached** and **Last updated**; use **›** to force a fresh fetch.
10. Try a domain on the fixture page with **RDAP/WHOIS** and/or OTX and/or URLScan.io enabled: confirm a **RDAP/WHOIS** row (registrar, dates, nameservers, or documented error) with source attribution, plus any other live per-source rows, **Recommended next pivots**, and guidance for that IOC type. With **Shodan** enabled, compare domain rows. Try a hash or CVE with OTX only. On IPv4, compare **GreyNoise**, **Shodan**, and **Censys** row summaries with your vendor portals when keys are configured (**Censys** skips non-IPv4 types with explicit copy).
11. In the extension workspace, name the session (for example **Phishing Investigation**), confirm rollups match the current scan on `sample-alert.html`, enrich a few indicators, set a **Label** and **Pin** on the overlay, then **Copy Markdown** and **Copy JSON** under **Export session** (requires a populated **Detected indicators** tray on that tab). On Chromium, reopen the extension after a browser restart and use **Recent sessions** → **Reopen** to confirm the session persisted locally. On Firefox, reload the temporary add-on after a full browser exit, then confirm the same session data is still available.
12. On a tray row, use **Save to collection…** → **Create new collection** (for example **Phishing Campaign**), add more indicators from the tray or overlay, then under **IOC collections** click **Export CSV** and confirm the download contains one row per member with no API keys in the file. Start **New session**, scan another fixture page, and add indicators to the same collection to confirm it persists across sessions.
13. After a completed enrich on the fixture page, open **Investigation history** (or palette **Open history**) and click the row—confirm the page scrolls to the highlight and the overlay reopens with the same cached enrichment. Try palette **Source health** and confirm **Source operations** shows per-source status, cache counts, and **Vendor quota** hints.
14. **Optional local AI summary:** Enable **Enable local AI summary**, enrich an indicator to **ready**, click **Generate summary**, and confirm markdown under **AI summary (local, unverified)** with the panel disclaimer; verify claims match per-source rows and **Risk score** on the card. Requires a model on `127.0.0.1`—see [docs/ai-summary.md](docs/ai-summary.md).
15. **Optional link attribute scanning:** Leave **Scan link attributes for IOCs** off and confirm SOC dashboard fixtures (`sample-splunk-export.html`, `sample-security-onion-alert.html`) match documented tray counts. Enable the toggle after the consent dialog, open `sample-malicious-attribute-iocs.html`, **Scan page**, and confirm attribute-only defanged URLs appear with **Why detected?** attribute provenance; turn the toggle off again on sensitive hosts. See [docs/soc-validation-fixtures.md — Link attribute scanning](docs/soc-validation-fixtures.md#link-attribute-scanning-opt-in).

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Settings, masked API keys, enrichment cache, analyst notes, investigation sessions, investigation history, IOC collections, IOC labels, per-source last-status snapshots for source operations, toggles (`chrome.storage.local`); per-tab scan summaries for the extension workspace tray (`chrome.storage.session`). |
| `activeTab` | Tab-scoped extension actions. |
| `sidePanel` | Chromium only: persistent native side panel host for the extension workspace (`sidepanel.html`). Firefox uses `sidebar_action` with the same document instead. |
| `scripting` | Fallback injection of `content.js` when the registered content script is not loaded on the active tab; routine detection uses the manifest content script on matched pages. |
| `contextMenus` | **Enrich selection with Vera5** on a text selection; the content script resolves the selection and runs the same enrich flow as **Enrich selection**. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content scripts, visible-text reads for detection, and—when **Scan link attributes for IOCs** is enabled—local reads of allowlisted link attribute values on matched pages; HTTPS enrichment calls (indicator values only) to declared vendor API hosts you enable (`api.abuseipdb.com`, `otx.alienvault.com`, `urlscan.io`, `api.greynoise.io`, `api.shodan.io`, `search.censys.io`, `rdap.org`; `www.virustotal.com` is allowlisted without live enrichment today), localhost POSTs to `http://127.0.0.1:8765/enrich` and `http://127.0.0.1:8765/summarize` when **Use local backend** is on, and localhost POSTs to `http://127.0.0.1:11434/v1/chat/completions` when **Enable local AI summary** is on (fixed default URL). Pivot recipe links open in the browser like normal navigation. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json) (Chromium), [`extension/public/manifest.firefox.json`](extension/public/manifest.firefox.json) (Firefox). Permission names and declared vendor host patterns match across both manifests; Firefox uses event **background scripts** instead of a service worker and adds Gecko metadata under `browser_specific_settings`.

## Privacy and keys (BYOK/BYOA)

- API keys, enrichment cache, analyst notes, investigation sessions, investigation history, and IOC collections stay in local extension storage by default on both Chromium and Firefox; Vera5 does not host enrichment infrastructure.
- Enrichment requests go from the background worker directly to vendors you enable when **Use local backend** is off. With the toggle on and the aggregator reachable, **AbuseIPDB IPv4** uses `http://127.0.0.1:8765/enrich` and keys from `backend/.env`; turn the toggle off for OTX, URLScan.io, GreyNoise, Shodan, Censys, and **RDAP/WHOIS**.
- **Local AI summary** (off by default) sends normalized enrichment export JSON from the content script to `127.0.0.1` only—via `http://127.0.0.1:8765/summarize` when **Use local backend** is on and reachable, otherwise to `http://127.0.0.1:11434/v1/chat/completions` (fixed default; no endpoint field in Settings). No page HTML, vendor keys, or Vera5-operated LLM relay.
- Settings export omits API keys unless you include them. **Settings packs** never include API keys; import rejects files with secret field names. Pre-migration backup snapshots and migration artifacts stay in local extension storage only—they are not uploaded.
- Manual-only enrichment is on by default.
- Pre-query disclosure runs before the first vendor call when notices are enabled; domain policy and internal asset lists can block enrichment without sending indicator values. Context-menu enrich uses the same gates as **Enrich selection**.
- No maintainer telemetry, crash reporting, or Vera5-operated network endpoints by default.
- Scans and detection run locally. Enrichment sends only the selected indicator value to declared vendor API hosts you enable. With **Scan link attributes for IOCs** on, allowlisted attribute values are processed locally under the same trust gates—no attribute dumps or page HTML leave the browser. Composite risk labels and reasoning chains are computed locally from vendor summaries. Raw JSON panels redact sensitive key fields before display. Production bundles omit sensitive `console` output. **Open live URL** uses your browser only after you confirm; Vera5 does not fetch or proxy that navigation.
- Review vendor terms and privacy policies before enabling sources: [docs/api-integrations.md — Vendor terms](docs/api-integrations.md#vendor-terms-privacy-and-acceptable-use).

[SECURITY.md](SECURITY.md), [docs/local-mode.md](docs/local-mode.md).

## Security

Security posture is local-first: your keys stay in browser storage (or in `backend/.env` when you use the optional localhost aggregator), enrichment uses bring-your-own API credentials, and there is no Vera5-operated enrichment relay.

| Control | What it does |
|---------|----------------|
| **`npm run verify:security`** | Runs after every Chromium production build. Checks extension-page CSP and packaged assets, enforces background outbound fetch allowlists for declared connector modules (registry-backed live connectors), rejects `eval` / remote dynamic import, scans production bundles for sensitive logging, enforces redacted test fixture placeholders, and verifies root `.env.example` credential variables are empty. Local AI summary POSTs are validated separately in unit tests (content script, localhost-only). |
| **`npm run verify:security:firefox`** | Same security checks against `dist-firefox/` after `npm run build:firefox` (no additional telemetry hosts; Mozilla `data_collection_permissions.required: ["none"]` enforced by `verify:firefox-manifest`). |
| **`npm run audit:prod`** | Fails on moderate-or-higher vulnerabilities in production dependencies (React runtime shipped in `dist/`). CI uses the same blocking policy; full `npm audit` warns only on devDependencies. |
| **Browser E2E smokes (CI)** | Pull requests run `npm run test:e2e:critical` on unpacked `dist/` in headless Chromium with mocked enrichment HTTP—no live vendor API calls. CI also builds `dist-firefox/` as an artifact; optional local `npm run test:e2e:firefox` covers temporary add-on load and scan → enrich → export on a fixture page. |
| **Gitleaks** | Repository secret scan on pull requests and pushes to `main` (`.github/gitleaks.toml`). Run locally from the repo root: `gitleaks detect --source . --config .github/gitleaks.toml`. |
| **Outbound allowlist** | Live enrichment HTTPS calls go only to configured vendor connector endpoints; undeclared hosts are blocked before network I/O in the background worker. Localhost enrich POSTs to `127.0.0.1:8765` are allowed only when **Use local backend** is on. Local AI summary POSTs stay on `127.0.0.1` (direct endpoint or backend **`/summarize`**) when **Enable local AI summary** is on; the content script rejects non-localhost summary URLs. |
| **Trust gates** | Domain policy, internal asset lists, manual-only enrichment (default), and pre-query disclosure limit accidental vendor queries on sensitive pages. |
| **Hostile-page DOM** | Default detection reads visible text nodes only. When **Scan link attributes for IOCs** is enabled, allowlisted attribute values are read locally under the same trust gates as visible-text IOCs. Overlay UI uses `textContent` for untrusted strings; see [Malicious page DOM confusion](docs/security-model.md#malicious-page-dom-confusion). |

Security hardening checklist and operator browser confirmation steps: [docs/security-model.md](docs/security-model.md#security-hardening-review-checklist). Vulnerability reporting: [SECURITY.md](SECURITY.md). Do not commit API keys or `.env` files. Root `.env.example` documents optional repo-side tooling variables with empty credential placeholders; configure extension API keys under **Vera5 Settings**.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | Production `dist/` (Chromium) plus verify steps |
| `npm run build:firefox` | Production `dist-firefox/` plus Firefox manifest and security verify |
| `npm run build:watch` | Rebuilds popup/options/background on save—not `content.js`; run full `build` after content changes |
| `npm run dev` | Vite dev server with a stub landing page; not a loadable extension |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest path checks (`dist/`; pass `--dist=dist-firefox` for Firefox) |
| `npm run verify:firefox-manifest` | Chromium/Firefox manifest parity and declared host coverage |
| `npm run verify:security` | Bundle security checks on `dist/` |
| `npm run verify:security:firefox` | Bundle security checks on `dist-firefox/` |
| `npm run audit:prod` | Production dependency audit (blocking policy) |
| `npm run test:e2e:install` | One-time Playwright Chromium install for browser smokes |
| `npm run test:e2e:firefox:install` | One-time Playwright Firefox install for optional Firefox smokes |
| `npm run test:e2e:critical` | PR-gate browser smokes against unpacked `dist/` (mocked vendors) |
| `npm run test:e2e:firefox` | Optional Firefox smokes (temporary add-on, scan → enrich → export on fixture) |
| `npm run test:e2e` | Full Chromium browser smoke suite (includes session pin and collection CSV export paths) |

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
| `.\scripts\package-extension-firefox.ps1` | Build and zip `extension/dist-firefox/` to `release/vera5-firefox-0.1.0.zip` |
| `.\scripts\dev.ps1` | Vite dev server in `extension/` (UI shells only) |

## License

[MIT License](LICENSE). Bundled open-source components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Version history: [CHANGELOG.md](CHANGELOG.md).
