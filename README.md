# Vera5

Browser extension for on-demand indicator detection on pages you browse. After a scan, matching indicators can be highlighted; clicking a highlight opens a hover card with copy, static deep-links, and—when configured—live threat intelligence from the enrichment sources you enable. Settings, API keys, and enrichment preferences are stored locally in the browser. Vera5 does not operate a shared enrichment backend; keys are bring-your-own and stay on your machine.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled**; **Highlight indicators** (default on); **Scan page** scans the active tab and shows a match count. |
| **Keyboard shortcut** | `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS)—runs the same scan as the popup; the count appears in the popup only when you use **Scan page** there. |
| **On-page highlights** | After scan, detected indicators get an inline underline, type badge, and **›** enrich affordance when highlighting is enabled. |
| **Hover card** | Click a highlighted indicator for a fixed-position card: type, value, enrichment summary, tag chips, **Copy**, pivot links, and source attribution on single-source results. When multiple live sources are enabled, the card lists each source with a status badge (Live, Error, or Skipped), per-source detail, and an expandable **Raw response** panel with redacted vendor JSON. Dismiss with Escape or an outside click. |
| **Live enrichment** | **AbuseIPDB** (IPv4 only) and **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE) when each source is enabled and its API key is saved. Enabled sources are queried in parallel from the service worker; partial success keeps working sources on the card while failed sources show their own error. Only the indicator value is sent in vendor requests. |
| **Enrichment errors** | Missing API key shows an actionable message and **Open settings** on single-source failures; rate limits show a backoff message and retry hint per source; invalid keys, timeouts, and vendor errors surface honest messages with source attribution. |
| **Static pivots** | Opens VirusTotal, OTX, AbuseIPDB (IPv4), or URLScan in a new tab when supported for that indicator type. Vera5 does not proxy those navigation requests. |
| **Options page** | Masked API key fields for **AbuseIPDB** and **OTX**; per-source enable toggles for AbuseIPDB, OTX, URLScan.io, and GreyNoise; auto-scan toggle; manual-only enrichment toggle (default on); enrichment cache clear; settings export/import (keys excluded from export by default). |
| **Auto-scan** | When enabled in options, rescans the page after DOM changes (debounced). Off by default. |
| **Background worker** | Routes popup/content messages, keyboard scan command, and parallel live enrichment through the AbuseIPDB and OTX connectors. |
| **IOC detection** | On demand on visible text nodes; skips `script`, `style`, `textarea`, and metadata subtrees by default; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Stops after 2,500 text nodes per scan. |
| **Build** | `postbuild` runs `verify:dist` and `verify:security`; unit tests cover regex, walker, detector, highlights, hover card, pivots, enrichment connectors, mocked fetch paths, scan messaging, storage, cache, and settings export/import. |

Not supported today: live enrichment from URLScan.io or GreyNoise (toggles and pivot links only; no API key fields for those sources in options), composite reputation scoring across sources, per-type IOC toggles in the options UI, or reading/writing enrichment cache on the live fetch path.

## Configuration flow

1. Build and load the extension (see below).
2. Open **Vera5 Settings** from the extension options page.
3. Enter **AbuseIPDB** and/or **OTX** API keys for the live connectors you use.
4. Enable each enrichment source you want under **Enrichment sources**. URLScan.io and GreyNoise toggles are stored locally but do not trigger live API calls.
5. Set **Manual-only enrichment** (default on) to fetch only when you click the **›** icon on a highlight, or turn it off to fetch automatically when opening the hover card.
6. Set **Automatically scan when the page changes** to match your workflow.
7. Use **Export settings** to back up preferences; API keys are omitted unless you explicitly include them.

Connector scope and vendor rate limits: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md).

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, false-positive notes, connector scope. |
| `docs/api-integrations.md` | Per-source API limits and Vera5 rate-limit handling. |
| `docs/security-model.md` | Permission and host-access rationale. |
| `docs/local-mode.md` | Extension-only deployment (no required backend). |
| `examples/sample-iocs.txt` | Indicator strings for automated tests. |
| `examples/sample-alert.html`, `examples/sample-blog.html` | HTML fixtures for manual scans and hover-card checks. |
| `.github/workflows/` | Extension lint/test and Gitleaks secret scan on pull requests. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security policy, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker, message routing, and parallel live enrichment handler. |
| `extension/src/content/` | Content script, detector, highlighter, hover card overlay, enrichment fetch client, auto-scan. |
| `extension/src/components/` | Hover card React component (tests and dev shell). |
| `extension/src/lib/` | IOC regex, enrichment types and connectors, messages, storage, cache, settings export/import, pivot URL templates, shared UI styles. |
| `extension/src/popup/` | Toolbar popup. |
| `extension/src/options/` | Settings UI (keys, toggles, cache, backup). |

See [docs/architecture.md](docs/architecture.md).

## Browser support

Chromium with Manifest V3 (Chrome, Edge, Brave, and similar). On-page UI respects system light/dark preference and `prefers-reduced-motion`.

## Load unpacked (Chrome)

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select **`extension/dist`** (must contain `manifest.json`).
2. Pin the toolbar action if needed.
3. After code changes: run `npm run build`, then **Reload** the extension.

### Try detection, hover card, and enrichment locally

Content scripts run on `http://` and `https://` pages only (see manifest `content_scripts` matches). Serve the example HTML over HTTP:

```bash
cd examples
python -m http.server 8080
```

1. Open `http://localhost:8080/sample-alert.html` or `http://localhost:8080/sample-blog.html`.
2. In the popup, enable **Extension enabled** and **Highlight indicators**, then **Scan page**.
3. In **Vera5 Settings**, save **AbuseIPDB** and **OTX** API keys and enable the sources you configured.
4. Click a highlighted **IPv4** indicator (or click **›** first when manual-only enrichment is on). Confirm loading, then summary/tags; with both live sources enabled, confirm the **Enrichment sources** list shows each vendor with Live, Error, or Skipped badges. Expand **Raw response** on a successful source to inspect redacted vendor JSON.
5. Try a **domain**, **URL**, or **hash** highlight with OTX enabled to confirm OTX-only enrichment for non-IPv4 types.
6. Confirm **Copy** places the indicator on the clipboard; pivot links open vendor pages in a new tab.

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Extension preferences, masked API keys, per-source toggles, enrichment cache storage, and related settings in `chrome.storage.local`. |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest for extension actions; page scans use the registered content script. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content script injection, on-demand read of visible page text, and HTTPS calls from the service worker to enrichment APIs you configure (indicator values only—not page HTML). Pivot links are normal browser navigation to vendor URLs. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Enrichment

Live connectors are **AbuseIPDB** (IPv4) and **OTX** (IPv4, domain, URL, MD5, SHA1, SHA256, CVE). The service worker calls each enabled connector in parallel, normalizes vendor fields into shared summary and tag vocabulary, and returns per-source results to the hover card. **Manual-only enrichment** (default on) requires **›** on the highlight unless you disable that setting. **Static pivot links** open vendor pages in your browser without Vera5 proxying navigation.

Further detail: [docs/architecture.md](docs/architecture.md), [docs/api-integrations.md](docs/api-integrations.md), [docs/local-mode.md](docs/local-mode.md).

## Privacy and keys (BYOK/BYOA)

- Vendor API keys you enter stay in `chrome.storage.local` on your profile; Vera5 does not host a shared enrichment service.
- Enrichment HTTP requests use keys you supply and go directly from the extension service worker to each vendor; Vera5-operated infrastructure is not in the path.
- Settings export omits API keys by default so backups can be shared safely.
- Manual-only enrichment is on by default; live API fetch requires explicit user action via **›** unless you disable that setting.
- No maintainer telemetry or crash reporting by default.
- Scans run locally; only match counts are shown in the popup. Page text is not sent to Vera5. Enrichment queries send only the selected indicator value. Raw response panels show vendor JSON with sensitive key fields redacted before display. Pivot URLs contain only the indicator value you chose to open.

[SECURITY.md](SECURITY.md) covers IOC leakage, third-party APIs, and data retained locally. [docs/local-mode.md](docs/local-mode.md) describes extension-only deployment.

## Security

Packaged scripts only. `npm run verify:security` rejects `eval`, remote script URLs, API key logging in bundles, enrichment GET requests without bodies, and weakened CSP overrides. See [docs/security-model.md](docs/security-model.md). Do not commit API keys or `.env` files.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | `dist/` plus `verify:dist` and `verify:security` |
| `npm run build:watch` | Rebuild popup/options/background on save (does not rebuild `content.js`; use `npm run build` after content-script changes) |
| `npm run dev` | Vite dev shell for UI components—not a loaded extension |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest paths (also runs on `build`) |
| `npm run verify:security` | Bundle security checks (also runs on `build`) |

Windows helpers: `.\scripts\check.ps1`, `.\scripts\dev.ps1` from the repository root.

[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE).
