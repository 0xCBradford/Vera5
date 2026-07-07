# Extension architecture

Vera5 ships as a Manifest V3 Chromium extension under `extension/`. TypeScript, React, and Vite compile to `extension/dist/`, which you load unpacked in Chrome.

## Runtime surfaces

| Surface | Path | Context |
|---------|------|---------|
| Service worker | `extension/src/background/` | No DOM. Routes messages, runs enrichment, cache, cooldown. |
| Content scripts | `extension/src/content/` | Page DOM. Detection, highlights, **production hover overlay** (`hoverCardOverlay.ts`). |
| Popup | `extension/src/popup/` | Toolbar UI: enable, highlights, scan, IOC tray with type filters, count summary, copy-all/copy-filtered actions, Markdown/JSON subset export, ticket template export, source-attributed non-blocking per-row enrichment hints from stored cache, empty/post-scan states, row navigation to page highlights, and stale-highlight feedback when the page DOM changed. |
| Options | `extension/src/options/` | Settings page: keys, toggles, cache clear, export/import. |
| React components | `extension/src/components/` | Hover card and risk score for **unit tests and dev shell only** — not injected into live tabs. |

Analyst-facing behavior on real pages uses the **content-script overlay**, not the React hover card. See [hover-overlay-architecture.md](hover-overlay-architecture.md).

## Shared library

`extension/src/lib/` holds non-UI logic used by background and content:

- `iocRegex.ts`, detector helpers — indicator matching
- `storage.ts` — settings schema and defaults
- `cache.ts` — enrichment response cache
- `enrichment*.ts`, `abuseipdbConnector.ts`, `otxConnector.ts` — vendor calls and normalization
- `scoring.ts`, `hoverCardEnrichment.ts` — composite score and card view-model
- `enrichmentExport.ts`, `exportTemplates.ts` — normalized enrichment records; markdown and JSON export; tray subset export; pluggable ticket templates
- `aiSummaryPrompt.ts`, `aiSummaryService.ts` — versioned enrichment-summary prompt template and localhost-only (`127.0.0.1`) LLM summary requests with typed timeout, connection, HTTP, and malformed-response failures
- `tabScanSnapshot.ts`, `tabScanSummary.ts`, `tabScanSummaryClient.ts` — per-tab scan snapshot storage, summary consumers, and tray subset export record builders
- `pageContext.ts` — versioned `PageContextType` enum, bounded DOM probe (`probePageContextDomSignalsFromDocument`), local page-context classifier, static IOC type priority hints, and UI layout profiles (tray sort default, hover card field emphasis, pivot recipe ordering) per page context
- `pageContextStorage.ts` — session-local last classified page context per tab (`chrome.storage.session`); cleared on tab close
- `pageContextClient.ts` — popup and tray consumers fetch tab page context via `GET_TAB_PAGE_CONTEXT`
- `analystModeStorage.ts` — content-script cache for profile export defaults, pivot emphasis, and effective export template id (`resolveEffectiveDefaultExportTemplateId` + tab page context)
- Generic page context is a neutral fallback: tray sort stays `all`, IOC priority and layout profiles preserve baseline ordering, and detection, enrich, and export are never gated by page type
- On page-context type change, `pageContextStorage.ts` applies the matching analyst workflow preset (SOC, CTI, or DFIR) unless the page origin has a stored mode override in `pageContextSiteModeOverrides`
- `PAGE_CONTEXT_DEFAULT_EXPORT_TEMPLATE_BY_TYPE` in `pageContext.ts` maps each classified page type to a default export template id (`jira-comment`, `markdown-report`, `thehive-case-note`); generic pages keep the profile default
- `pivots.ts`, `settingsExport.ts`, `vera5UiStyles.ts` — pivots, export, shared styles

## Message flow (simplified)

```mermaid
sequenceDiagram
  participant Popup as Toolbar popup
  participant Content as Content script
  participant SW as Background worker
  participant Store as chrome.storage.local
  participant Vendor as Third-party APIs

  Popup->>Content: Scan and navigate-to-anchor messages
  Popup->>SW: GET_TAB_SCAN_SUMMARY
  Popup->>SW: GET_TAB_PAGE_CONTEXT
  Content->>SW: Enrich, scan snapshot, and summary messages
  SW->>Store: Read and write settings and cache
  SW->>Vendor: HTTPS enrichment (indicator only)
  Vendor-->>SW: Vendor response
  SW-->>Content: Enrichment results via messages
  Content->>Store: Settings sync when applicable
```

Content scripts request enrichment through the background worker so API keys and fetch logic stay out of the page JavaScript context exposed to hostile pages.

## Build and verify

From `extension/`:

| Command | Purpose |
|---------|---------|
| `npm run build` | Emit `dist/`, run `verify:dist` and `verify:security` |
| `npm run build:firefox` | Emit `dist-firefox/` from shared sources with Firefox manifest, run `verify:firefox-manifest` (permission parity, default CSP posture, declared connector host coverage), `verify:dist`, and `verify:security:firefox` against that output |
| `npm run check` | ESLint + Vitest |
| `npm run build:watch` | Rebuild popup/options/background; full `build` after content changes |

Manifest: `extension/public/manifest.json` (Chromium service worker background). Firefox MV3 variant: `extension/public/manifest.firefox.json` (`browser_specific_settings.gecko`, `background.scripts` event background, permission and `host_permissions` parity with Chromium). Declared enrichment API hosts are centralized in `src/lib/iocRequestBoundaries.ts` and audited by `verify:firefox-manifest` and `verify:security`. Built manifests and bundles land under `extension/dist/` (Chromium) or `extension/dist-firefox/` when the dual-target build is enabled.

## Repository neighbors

- `examples/` — HTML fixtures for manual scan checks
- `docs/architecture.md` — frozen IOC types and connector order
- `scripts/check.ps1` — root helper to run extension checks on Windows
