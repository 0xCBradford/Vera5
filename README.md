# Vera5

Browser extension for on-demand indicator detection on pages you browse. Threat-intelligence enrichment is not enabled in this build. BYOK/BYOA design: you supply vendor API keys locally; Vera5 does not operate a shared enrichment backend.

**This release:** Unpacked Chromium load from `extension/dist/`—service worker, HTTP/HTTPS content script, popup (enable/disable and **Scan page**), `Ctrl+Shift+Y` / `Cmd+Shift+Y` scan shortcut, options page shell, regex-based IOC detection (no third-party API calls), icons, and `verify:dist` / `verify:security` on build.

## What works today

| Capability | Behavior |
|------------|----------|
| **Install** | `npm run build` in `extension/`, then load `extension/dist/` in Chrome. |
| **Toolbar popup** | **Extension enabled** toggle (`extensionEnabled` in `chrome.storage.local`); **Scan page** scans the active tab and shows a match count. |
| **Keyboard shortcut** | `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS)—triggers the same scan as the popup; the count appears in the popup only when you use **Scan page** there. |
| **Options page** | Static layout only; no API keys, source toggles, or connector settings. |
| **Background worker** | Message routing between popup and content script; forwards the keyboard scan command. |
| **IOC detection** | On demand: visible text nodes only; skips `script`, `style`, `textarea`, and metadata subtrees by default; does not scan attributes. Types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE—with false-positive guards and overlap deduplication. Stops after 2,500 text nodes per scan. |
| **Build** | `postbuild` runs `verify:dist` and `verify:security`; unit tests cover regex, walker, detector, and scan messaging. |

Not implemented: on-page highlighting, hover cards, enrichment requests, per-source configuration UI.

## Repository contents

| Area | Role |
|------|------|
| `extension/` | Vite + React + TypeScript; build output in `extension/dist/`. |
| `docs/architecture.md` | IOC types, false-positive notes, connector scope (documentation). |
| `docs/security-model.md` | Permission and host-access rationale. |
| `examples/sample-iocs.txt` | Indicator strings for automated tests. |
| `examples/sample-alert.html`, `examples/sample-blog.html` | HTML fixtures with indicators and decoys for manual scans. |
| `.github/workflows/` | Extension lint/test on pull requests; Gitleaks secret scan. |
| [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) | Security, contribution, license. |

## Code layout

| Path | Role |
|------|------|
| `extension/src/background/` | Service worker and keyboard scan command. |
| `extension/src/content/` | Content script, text walker, detector, scan handler. |
| `extension/src/lib/` | IOC regex, messages, storage helpers. |
| `extension/src/popup/` | Toolbar popup. |
| `extension/src/options/` | Options page UI. |

See [docs/architecture.md](docs/architecture.md).

## Browser support

Chromium with Manifest V3 (Chrome, Edge, Brave, and similar).

## Load unpacked (Chrome)

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select **`extension/dist`** (must contain `manifest.json`).
2. Pin the toolbar action if needed. Open **Options** from the extension menu or the Vera5 entry on `chrome://extensions`.
3. After code changes: `npm run build` or `npm run build:watch`, then **Reload** the extension.

### Try detection locally

1. Build and load as above.
2. Open `examples/sample-alert.html` or `examples/sample-blog.html` (`file://` or a local static server).
3. Open the popup, enable the extension, click **Scan page** and note the indicator count.

## Permissions

| Permission / access | Use in this release |
|---------------------|---------------------|
| `storage` | `extensionEnabled` flag only. |
| `activeTab` | Tab-scoped extension actions. |
| `scripting` | Declared in the manifest; scans use the registered content script. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Content script injection; on-demand scan reads visible text in the tab only (no network exfiltration of page content or matches in this build). |

[docs/security-model.md](docs/security-model.md), [SECURITY.md](SECURITY.md), [`extension/public/manifest.json`](extension/public/manifest.json).

## Enrichment

Disabled in this build. Detection is local to the tab. Connector scope is documented in [docs/architecture.md](docs/architecture.md).

## Privacy and keys (BYOK/BYOA)

- You obtain API keys from vendors you choose; Vera5 does not host a shared enrichment service.
- The only persisted setting today is **Extension enabled** in `chrome.storage.local`.
- No maintainer telemetry or crash reporting by default.
- Scans count matches in the popup; page text is not uploaded to Vera5 or third parties in this build.

[SECURITY.md](SECURITY.md) covers IOC handling and third-party API use.

## Security

Packaged scripts only. `npm run verify:security` rejects `eval`, remote script URLs, and weakened CSP overrides. See [docs/security-model.md](docs/security-model.md). Do not commit API keys or `.env` files.

## Development

From `extension/` after `npm install`:

| Command | Purpose |
|---------|---------|
| `npm run check` | Lint and unit tests |
| `npm run build` | `dist/` plus `verify:dist` and `verify:security` |
| `npm run build:watch` | Rebuild on save; reload the extension in Chrome |
| `npm run dev` | Vite UI preview—not a loaded extension |
| `npm run test:smoke` | Background message-handler tests |
| `npm run typecheck` | TypeScript |
| `npm run verify:dist` | Manifest paths (also runs on `build`) |
| `npm run verify:security` | Bundle security checks (also runs on `build`) |

Windows helpers: `.\scripts\check.ps1`, `.\scripts\dev.ps1` from the repository root.

[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE).
