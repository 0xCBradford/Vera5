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
| Auto-scan | Default off; enables mutation-driven rescan |
| `includePrivateIpv4` | Schema flag; private-space IPv4 omitted in detector when false |
| Per-IOC-type flags | Present in schema; dedicated Options UI wiring may lag README limitations |

Never commit storage dumps or API keys to git.

## Options page

`extension/src/options/` reads and writes the schema, renders masked key fields, **Clear cache**, and export/import.

## Export / import

**Module:** `extension/src/lib/settingsExport.ts`

- Default export **omits** API keys unless the analyst opts in.
- Import merges known fields; invalid shapes should fail safely (see `settingsExport.test.ts`).

## Content script sync

Several flags sync on load and on `chrome.storage.onChanged`:

- `highlightStorage.ts`, `manualOnlyStorage.ts`, `includePrivateIpv4Storage.ts`, `enrichmentSourceStorage.ts`, `autoScanStorage.ts`

When adding a new setting consumed in content scripts, follow the same listen/sync pattern to avoid stale tab state.

## Privacy

Settings and cache stay on the analyst profile. See [SECURITY.md](../../SECURITY.md) and [docs/local-mode.md](../local-mode.md).
