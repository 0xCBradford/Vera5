# Vera5

Browser extension for on-demand indicator detection on pages you browse. After a scan, matching indicators can be highlighted; clicking a highlight opens a hover card with copy and static deep-links to threat-intelligence sites. Live API enrichment is not enabled in this build. API keys and connectors are bring-your-own and local-only when that layer ships—Vera5 does not operate a shared enrichment backend.

**This release:** Unpacked Chromium load from `extension/dist/`—service worker, HTTP/HTTPS content script, popup (**Extension enabled**, **Highlight indicators**, **Scan page**), `Ctrl+Shift+Y` / `Cmd+Shift+Y` scan shortcut, options page shell, regex-based IOC detection, on-page highlights, click-to-open hover card with copy and static pivot URLs, dark-friendly styling, `prefers-reduced-motion` support, icons, and `verify:dist` / `verify:security` on build. The extension does not call vendor enrichment APIs.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled** (`extensionEnabled`); **Highlight indicators** (`highlightEnabled`, default on); **Scan page** scans the active tab and shows a match count. |
| **Keyboard shortcut** | `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS)—runs the same scan as the popup; the count appears in the popup only when you use **Scan page** there. |
| **On-page highlights** | After scan, detected indicators get an inline underline and type badge when highlighting is enabled. |
| **Hover card** | Click a highlighted indicator for a fixed-position card: type, value, default empty summary, **Copy**, and pivot links. Dismiss with Escape or an outside click. |
| **Static pivots** | Opens VirusTotal, OTX, AbuseIPDB (IPv4), or URLScan in a new tab when supported for that indicator type. Vera5 does not proxy those requests. |
| **Options page** | Placeholder page only—no API keys or per-source toggles. |
| **Background worker** | Routes messages between popup and content script; forwards the keyboard scan command. |
| **IOC detection** | On demand on visible text nodes; skips `script`, `style`, `textarea`, and metadata subtrees by default; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Stops after 2,500 text nodes per scan. |
| **Build** | `postbuild` runs `verify:dist` and `verify:security`; unit tests cover regex, walker, detector, highlights, hover card, pivots, and scan messaging. |

Not in this build: live enrichment API calls, reputation scoring, API key storage, per-source toggles, automatic DOM rescan on page changes, enrichment cache.

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, false-positive notes, connector scope (documentation). |
| `docs/security-model.md` | Permission and host-access rationale. |
| `examples/sample-iocs.txt` | Indicator strings for automated tests. |
| `examples/sample-alert.html`, `examples/sample-blog.html` | HTML fixtures for manual scans and hover-card checks. |
| `.github/workflows/` | Extension lint/test on pull requests; Gitleaks secret scan. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker and keyboard scan command. |
| `extension/src/content/` | Content script, detector, highlighter, hover card overlay, enrich trigger. |
| `extension/src/components/` | Hover card React component (tests and dev shell). |
| `extension/src/lib/` | IOC regex, messages, storage, pivot URL templates, shared UI styles. |
| `extension/src/popup/` | Toolbar popup. |
| `extension/src/options/` | Options page UI. |

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
3. After code changes: `npm run build` or `npm run build:watch`, then **Reload** the extension.

### Try detection and hover card locally

1. Build and load as above.
2. Open `examples/sample-alert.html` or `examples/sample-blog.html` (`file://` or a local static server).
3. In the popup, enable **Extension enabled** and **Highlight indicators**, then **Scan page**.
4. Click a highlighted indicator. Confirm the card shows the value, summary, **Copy**, and pivot links. Copy should place the indicator on the clipboard; a pivot link should open the vendor site in a new tab.

## Permissions

| Permission / access | Use in this release |
|---------------------|---------------------|
| `storage` | `extensionEnabled` and `highlightEnabled` in `chrome.storage.local`. |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest; scans use the registered content script. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content script injection and on-demand read of visible page text. Pivot links are normal browser navigation to vendor URLs. |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Enrichment

Live enrichment is off: no API keys are stored and the extension does not send enrichment requests.

**Static pivot links** only—your browser opens the vendor page for the clicked indicator. Vera5 does not receive or proxy that traffic.

For documented connector scope and privacy rules (not implemented here), see [docs/architecture.md](docs/architecture.md).

## Privacy and keys (BYOK/BYOA)

- Vendor API keys stay on your machine when connector support is added; Vera5 does not host a shared enrichment service.
- Stored settings: **Extension enabled** and **Highlight indicators** in `chrome.storage.local`.
- No maintainer telemetry or crash reporting by default.
- Scans run locally; only match counts are shown in the popup. Page text is not sent to Vera5. Pivot URLs contain only the indicator value you chose to open.

[SECURITY.md](SECURITY.md) covers IOC handling and third-party sites.

## Security

Packaged scripts only. `npm run verify:security` rejects `eval`, remote script URLs, and weakened CSP overrides. See [docs/security-model.md](docs/security-model.md). Do not commit API keys or `.env` files.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | `dist/` plus `verify:dist` and `verify:security` |
| `npm run build:watch` | Rebuild on save; reload the extension in Chrome |
| `npm run dev` | Vite dev shell—not a loaded extension |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest paths (also runs on `build`) |
| `npm run verify:security` | Bundle security checks (also runs on `build`) |

Windows helpers: `.\scripts\check.ps1`, `.\scripts\dev.ps1` from the repository root.

[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE).
