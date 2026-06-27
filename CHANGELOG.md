# Changelog

All notable user-facing changes to the Vera5 browser extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for public releases. Version numbers in this file match tagged GitHub releases and `extension/public/manifest.json` (**0.1.0** for the public MVP snapshot).

## [Unreleased]

### Added

- Nothing yet.

## [0.1.0] — 2026-06-26

First **public MVP** release: **Investigation Mode** for local-first IOC triage in Chromium—scan → tray → enrich with your keys → score → export → sessions and collections—without Vera5-operated enrichment backends.

### Added

- **Investigation Mode flow** — On-demand page scan with highlights and on-page overlay; popup **Detected indicators** tray and workspace sidebar; manual and bulk enrich queue; composite risk score with **How this score was computed** reasoning chain; ticket export templates; named investigation sessions; persistent IOC collections.
- **Live enrichment (BYOK/BYOA)** — Parallel **AbuseIPDB** (IPv4) and **OTX** (multi-type) HTTPS queries when you enable sources and save API keys; indicator values only, never full page content; TTL cache, manual refresh, and rate-limit cooldown handling.
- **Trust and consent** — Pre-query disclosure before vendor calls; hostname domain policy with sensitive webmail denylist; internal asset lists and enrich gates; analyst workflow presets (SOC, CTI, DFIR); **manual-only enrichment** and **auto-scan off** by default.
- **Operator workflows** — Command palette (**Ctrl+Shift+K** / **Cmd+Shift+K**); keyboard scan (**Ctrl+Shift+Y** / **Cmd+Shift+Y**) and highlight triage; **Enrich with Vera5** context menu; defang/refang and **Why detected?** provenance; **Recommended next pivots** with source attribution.
- **Install quick start** — Settings opens on first install; wizard covers install checklist, optional live-source API keys (auto-enables source when saved), manual-only default, trust summary, and pre-query notice choice.
- **Open-source release** — README, [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), analyst docs under `docs/`, GitHub issue/PR templates, Chrome Web Store listing draft (`docs/store-listing.md`), packaging script (`scripts/package-extension.ps1` → `release/vera5-0.1.0.zip`), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled dependencies.
- **Quality gates** — Pull request CI: lint, unit tests, production dependency audit, Gitleaks secret scan, and Playwright critical browser smokes on unpacked `extension/dist/` with mocked vendor HTTP (no live API calls in CI).

### Security

- Documented local-first posture: no maintainer API keys, no Vera5 enrichment proxy, no default telemetry; outbound fetch allowlist for declared vendor hosts only.

### Changed

- Manifest and packaged release version set to **0.1.0** (`extension/public/manifest.json`; attach `release/vera5-0.1.0.zip` at GitHub release `v0.1.0`).

## [0.0.9] — 2026-06-20

### Added

- **IOC collections** — Named persistent indicator groupings separate from investigation sessions: save from popup tray, workspace sidebar, or overlay; bulk add filtered tray subset; **Promote session to collection…**; manage members in popup; export Markdown, JSON, or CSV per collection.
- **Collection export contract** — `schemaVersion` metadata, cached enrichment snippets when available, redacted secrets in exports.

## [0.0.8] — 2026-06-15

### Added

- **Investigation sessions** — Named local case workspace in popup: editable title, IOC rollups from latest tab scan, enrich/export activity counts, recent sessions (reopen, rename, archive, delete), auto-create on first scan.
- **Session IOC memory** — Overlay **Label**, **Pin**, and **Session timeline** (first seen, enrich, export events); pinned indicators sort first in workspace tray.
- **Session export** — Copy or download Markdown, JSON, or CSV from popup using active tab scan rows and cached enrichment snippets.

## [0.0.7] — 2026-06-10

### Added

- **Trust and consent** — Pre-query disclosure before live vendor calls; hostname domain policy (allow/deny lists, sensitive webmail default denylist, **Sensitive sites denylist** preset); optional internal asset lists (domains, IPv4 CIDR, vendor hostname patterns) with enrich gates.
- **Analyst workflow presets** — SOC triage, CTI research, and DFIR investigation defaults for enrichment toggles, export template, and pivot ordering.
- **Selection and bulk enrich** — **Enrich with Vera5** context menu; workspace tray multi-select with quota confirmation and sequential **Enrich selected (N)** queue; **Scan selection** / **Enrich selection** from popup and sidebar.

## [0.0.6] — 2026-06-05

### Added

- **Command palette** — **Ctrl+Shift+K** / **Cmd+Shift+K** filterable actions: scan page, enrich selection, tray copy/export, clear highlights, open options.
- **Keyboard triage** — **Ctrl+Shift+Y** / **Cmd+Shift+Y** scan shortcut; highlight focus with **ArrowDown** / **ArrowUp**, **Enter** / **Space** open overlay, **Escape** close.
- **Popup and workspace IOC tray** — Detected indicators list with type filters, **Why detected?**, navigation to highlights, optional cached status hints; docked workspace sidebar with bulk enrich checkboxes and save-to-collection actions.
- **Tab scan summary** — Per-tab IOC counts and entries synced to popup tray via service worker storage.

## [0.0.5] — 2026-05-28

### Added

- **Composite risk score** — Locally computed advisory band and optional **/100** on overlay when multiple sources return parseable results; **How this score was computed** reasoning chain; **Sources disagree** callout.
- **Export templates and artifacts** — Per-indicator Markdown, JSON, plain text, and ticket templates (Jira comment, TheHive case note, analyst update, Obsidian note, Markdown report, CSV rows); filtered-subset copy/export on overlay and via palette; documented field contract in `docs/export-artifacts.md`.
- **Analyst notes** — Per-IOC notes on overlay persisted locally.

## [0.0.4] — 2026-05-20

### Added

- **Live enrichment connectors** — Parallel HTTPS queries to **AbuseIPDB** (IPv4) and **OTX** (IPv4, domain, URL, hashes, CVE) when enabled with saved keys; IOC values only—never full page content.
- **Enrichment cache and cooldown** — TTL cache (global and per-source overrides), manual refresh bypassing cache, HTTP 429 global cooldown, popup **Source operations** panel.
- **Registered connector shells** — Twelve sources in settings and overlay registry with pivot links; only AbuseIPDB and OTX perform live queries today.
- **Outbound fetch allowlist** — Service worker blocks undeclared vendor hosts before network I/O.

## [0.0.3] — 2026-05-12

### Added

- **On-page overlay** — Production content-script triage card on scanned highlights: copy (indicator, defanged, refanged), enrichment control, pivots, export, trust gates, and session controls when active.
- **Defang and refang** — Detection of common defanged forms in visible text with refanged values for enrichment and copy.
- **Detection provenance** — Rule id and **Why detected?** context on overlay and tray rows.
- **Pivot recipes** — **Recommended next pivots** with source badges and workflow guidance; confirmed **Open live URL** for URL indicators.

## [0.0.2] — 2026-05-05

### Added

- **IOC detection engine** — On-demand scan of visible text nodes on `http://` and `https://` tabs: IPv4, domain, URL, MD5, SHA1, SHA256, CVE with overlap dedupe and SOC-style false-positive guards; 2,500 text-node cap per scan.
- **On-page highlights** — Inline underlines, type badges, and enrich control after scan.
- **Settings page** — Masked API key storage, per-source and per-type toggles, manual-only enrichment (default on), auto-scan (default off), settings export/import (keys omitted unless opted in).
- **SOC fixtures** — Sample HTML pages under `examples/` for repeatable validation.

## [0.0.1] — 2026-04-28

### Added

- **Extension scaffold** — Manifest V3 Chromium extension under `extension/`: service worker, content script, popup, and options UI shells.
- **Local-first storage** — `chrome.storage.local` for settings, keys, and enrichment cache; no maintainer telemetry by default.
- **Build and verify** — `npm run build` emits `extension/dist/` with post-build manifest and security verification scripts.

### Security

- Documented BYOK/BYOA model and IOC-only vendor queries in [SECURITY.md](SECURITY.md) and [docs/security-model.md](docs/security-model.md).

---

[Unreleased]: https://github.com/0xCBradford/Vera5/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/0xCBradford/Vera5/releases/tag/v0.1.0
[0.0.9]: https://github.com/0xCBradford/Vera5/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/0xCBradford/Vera5/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/0xCBradford/Vera5/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/0xCBradford/Vera5/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/0xCBradford/Vera5/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/0xCBradford/Vera5/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/0xCBradford/Vera5/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/0xCBradford/Vera5/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/0xCBradford/Vera5/releases/tag/v0.0.1
