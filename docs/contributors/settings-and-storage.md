# Settings and storage

Vera5 persists analyst configuration in **`chrome.storage.local`** via `extension/src/lib/storage.ts`.

## Schema highlights

| Area | Behavior |
|------|----------|
| Extension enabled | Master on/off |
| Highlighting | Toggle on-page underlines |
| API keys | AbuseIPDB, OTX (masked in Options UI after save) |
| Source toggles | Per-vendor enable; URLScan and GreyNoise toggles affect pivots/preferences, not live API for those vendors in the current release |
| Manual-only enrichment | Default on; blocks automatic fetch until **›** or explicit enrich |
| Pre-query notices | Options first-run choice + **Trust & consent** toggle (`showPreQueryNotices`, `preQueryNoticePreferenceConfigured`); default shows notices until the analyst chooses. When enabled, the production hover card shows an inline disclosure (vendor names and indicator value) with **Send query** / **Cancel** before live enrichment leaves the browser; **Don't show this notice again** persists the same global preference as turning the toggle off. Gate logic: `extension/src/lib/enrichmentPolicy.ts`; content sync: `getShowPreQueryNoticesForContent()` in `enrichmentSourceStorage.ts`. |
| Auto-scan | Default off; enables mutation-driven rescan. Respects domain policy (`domainPolicyMode`, `domainAllowlist`, `domainDenylist`): allow-by-default blocks denylisted hosts; deny-by-default runs only on allowlisted hosts. Content sync via `domainPolicyStorage.ts` and `autoScan.ts`. |
| Domain policy enrich gate | Default on (`domainPolicyEnrichGateEnabled`); when enabled, live enrichment on the current tab hostname is blocked by the same allow/deny policy before any vendor request leaves the browser (`isEnrichmentAllowedForCurrentPage()` in `domainPolicyStorage.ts`, gate in `enrichmentBackgroundFetch.ts`). |
| Per-IOC-type flags | Options checkboxes; defaults all MVP types on; scan omits disabled types |
| `includePrivateIpv4` | Options checkbox; private-space IPv4 omitted in detector when off (default) |
| Enrichment cache TTL | Global seconds field on Options; optional per-source overrides |
| Analyst notes | Per-IOC notes in overlay card; stored under `analystNotes` in `chrome.storage.local` via `extension/src/lib/analystNotesStorage.ts` |
| Tab scan snapshots | Last scan per browser tab (IOC type, value, highlight anchor id, page URL, timestamp) in `chrome.storage.session` via `extension/src/lib/tabScanSnapshotStorage.ts`; cleared when the tab closes |
| Tab scan summaries | Stable consumer view (`TabScanSummary`: total count, per-type counts, entries) fetched via `GET_TAB_SCAN_SUMMARY` in `extension/src/lib/tabScanSummaryClient.ts` |

Never commit storage dumps or API keys to git.

## Options page

`extension/src/options/` reads and writes the schema, renders masked key fields, **Clear cache**, and export/import.

## Export / import

| Module | Purpose |
|--------|---------|
| `extension/src/lib/settingsExport.ts` | Full settings snapshot; API keys optional on export |
| `extension/src/lib/connectorProfileExport.ts` | Connector profile without keys: IOC types, rate-limit metadata, privacy warning text |

### Settings export (`settingsExport.ts`)

- Default export **omits** API keys unless the analyst opts in.
- Import merges known fields; invalid shapes should fail safely (see `settingsExport.test.ts`).

### Connector profile export (`connectorProfileExport.ts`)

- Always **omits** API keys; import rejects documents that include key material.
- Carries `preferences` (IOC-type and source toggles, manual-only mode, cache TTL), static `rateLimitMetadata`, and overlay `privacyWarnings`.
- Import merges preferences into current settings and **never** overwrites stored API keys (see `connectorProfileExport.test.ts`).

## Content script sync

Several flags sync on load and on `chrome.storage.onChanged`:

- `highlightStorage.ts`, `manualOnlyStorage.ts`, `includePrivateIpv4Storage.ts`, `iocTypeEnabledStorage.ts`, `enrichmentSourceStorage.ts`, `autoScanStorage.ts`, `domainPolicyStorage.ts`

When adding a new setting consumed in content scripts, follow the same listen/sync pattern to avoid stale tab state.

## Privacy

Settings and cache stay on the analyst profile. See [SECURITY.md](../../SECURITY.md) and [docs/local-mode.md](../local-mode.md).
