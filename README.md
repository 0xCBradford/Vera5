# Vera5

Browser extension for on-demand indicator detection on pages you browse. After a scan, matching indicators can be highlighted; clicking a highlight opens a hover card with copy, static deep-links, and—when configured—live threat intelligence from AbuseIPDB for IPv4 addresses. Settings, API keys, and enrichment preferences are stored locally in the browser. Vera5 does not operate a shared enrichment backend; keys are bring-your-own and stay on your machine.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled**; **Highlight indicators** (default on); **Scan page** scans the active tab and shows a match count. |
| **Keyboard shortcut** | `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS)—runs the same scan as the popup; the count appears in the popup only when you use **Scan page** there. |
| **On-page highlights** | After scan, detected indicators get an inline underline, type badge, and **›** enrich affordance when highlighting is enabled. |
| **Hover card** | Click a highlighted indicator for a fixed-position card: type, value, enrichment summary (when available), tag chips, **Copy**, pivot links, and source attribution. Dismiss with Escape or an outside click. |
| **Live enrichment (AbuseIPDB)** | For **IPv4** indicators, when AbuseIPDB is enabled and an API key is saved, Vera5 fetches reputation through the service worker and shows summary, tags, and **Source: AbuseIPDB · live**. Only the indicator value is sent in the vendor request URL. |
| **Enrichment errors** | Missing API key shows an actionable message and **Open settings**; rate limits show a backoff message and retry hint; invalid keys, timeouts, and vendor errors surface honest messages with source attribution. |
| **Static pivots** | Opens VirusTotal, OTX, AbuseIPDB (IPv4), or URLScan in a new tab when supported for that indicator type. Vera5 does not proxy those navigation requests. |
| **Options page** | Masked API key fields (AbuseIPDB, OTX); per-source enable for AbuseIPDB, OTX, URLScan.io, and GreyNoise; auto-scan toggle; manual-only enrichment toggle (default on); enrichment cache clear; settings export/import (keys excluded from export by default). |
| **Auto-scan** | When enabled in options, rescans the page after DOM changes (debounced). Off by default. |
| **Background worker** | Routes popup/content messages, keyboard scan command, and live enrichment requests through the AbuseIPDB connector. |
| **IOC detection** | On demand on visible text nodes; skips `script`, `style`, `textarea`, and metadata subtrees by default; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Stops after 2,500 text nodes per scan. |
| **Build** | `postbuild` runs `verify:dist` and `verify:security`; unit tests cover regex, walker, detector, highlights, hover card, pivots, enrichment connectors, mocked fetch paths, scan messaging, storage, cache, and settings export/import. |

Not supported today: live enrichment for non-IPv4 types, multi-source merge in one card, composite reputation scoring, per-type IOC toggles in the options UI.

## Configuration flow

1. Build and load the extension (see below).
2. Open **Vera5 Settings** from the extension options page.
3. Enter an **AbuseIPDB** API key for live IPv4 enrichment. You may save an **OTX** key in the same panel; only AbuseIPDB is queried for live data.
4. Enable **AbuseIPDB** under enrichment sources. Other source toggles and key fields are stored locally but do not trigger live API calls.
5. Set **Manual-only enrichment** (default on) to fetch only when you click the **›** icon on a highlight, or turn it off to fetch automatically when opening the hover card.
6. Set **Automatically scan when the page changes** to match your workflow.
7. Use **Export settings** to back up preferences; API keys are omitted unless you explicitly include them.
8. Use **Clear cache** to remove locally stored enrichment responses.

Supported enrichment sources (configuration and storage slots): **AbuseIPDB** (live for IPv4), **OTX**, **URLScan.io**, **GreyNoise**. See [docs/architecture.md](docs/architecture.md) for connector scope.

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, false-positive notes, connector scope. |
| `docs/security-model.md` | Permission and host-access rationale. |
| `docs/local-mode.md` | Extension-only deployment (no required backend). |
| `examples/sample-iocs.txt` | Indicator strings for automated tests. |
| `examples/sample-alert.html`, `examples/sample-blog.html` | HTML fixtures for manual scans and hover-card checks. |
| `.github/workflows/` | Extension lint/test and Gitleaks secret scan on pull requests. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security policy, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker, message routing, and live enrichment handler. |
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
3. In **Vera5 Settings**, save an AbuseIPDB API key and enable the AbuseIPDB source.
4. Click a highlighted **IPv4** indicator (or click **›** first when manual-only enrichment is on). Confirm the card shows loading, then summary/tags and **Source: AbuseIPDB · live** when the key is valid.
5. Confirm **Copy** places the indicator on the clipboard; pivot links open vendor pages in a new tab.

## Permissions

| Permission / access | Purpose |
|---------------------|---------|
| `storage` | Extension preferences, masked API keys, per-source toggles, enrichment cache, and related settings in `chrome.storage.local`. |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest; scans use the registered content script. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content script injection, on-demand read of visible page text, and HTTPS calls from the service worker to enrichment APIs you configure (indicator values only in request URLs). Pivot links are normal browser navigation to vendor URLs. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Enrichment

**Live connector:** **AbuseIPDB** for **IPv4** addresses. The content script asks the service worker to enrich the indicator; the worker reads your API key from local storage, calls the AbuseIPDB check API with only the IP in the query string, normalizes the response, and returns summary and tags to the hover card. Requests do not include page HTML or surrounding text.

**Manual-only mode (default on):** Opening the hover card by clicking the highlight does not call vendors until you click **›** on the highlight or disable manual-only in settings.

**Static pivot links**—your browser opens the vendor page for the clicked indicator. Vera5 does not receive or proxy that navigation traffic.

Connector scope, privacy boundaries, and extension-only deployment are documented in [docs/architecture.md](docs/architecture.md) and [docs/local-mode.md](docs/local-mode.md).

## Privacy and keys (BYOK/BYOA)

- Vendor API keys you enter stay in `chrome.storage.local` on your profile; Vera5 does not host a shared enrichment service.
- Enrichment HTTP requests use keys you supply and go directly from the extension service worker to the vendor; Vera5-operated infrastructure is not in the path.
- Settings export omits API keys by default so backups can be shared safely.
- Manual-only enrichment is on by default; live API fetch requires explicit user action via **›** unless you disable that setting.
- No maintainer telemetry or crash reporting by default.
- Scans run locally; only match counts are shown in the popup. Page text is not sent to Vera5. Enrichment queries send only the selected indicator value. Pivot URLs contain only the indicator value you chose to open.

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
