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
| Local AI summary | Global opt-in default **off** (`localLlmSummaryEnabled`); Options **Local AI Summary** toggle must be on before Vera5 requests narrative summaries from a user-operated model on `127.0.0.1` |
| Install quick start | Options four-step flow on first visit (`installQuickStartCompleted`); fresh installs also open the options page from `chrome.runtime.onInstalled` (`reason === "install"`). Covers install checklist, optional AbuseIPDB/OTX keys (auto-enables source when saved), manual-only default, trust summary, and pre-query notice choice. Legacy profiles with only `preQueryNoticePreferenceConfigured` skip the wizard. Completion: `completeInstallQuickStart()` in `storage.ts`. |
| Pre-query notices | Options quick-start final step + **Trust & consent** toggle (`showPreQueryNotices`, `preQueryNoticePreferenceConfigured`); default shows notices until the analyst chooses. When enabled, the production hover card shows an inline disclosure (vendor names and indicator value) with **Send query** / **Cancel** before live enrichment leaves the browser; **Don't show this notice again** persists the same global preference as turning the toggle off. Gate logic: `extension/src/lib/enrichmentPolicy.ts`; content sync: `getShowPreQueryNoticesForContent()` in `enrichmentSourceStorage.ts`. |
| Auto-scan | Default off; enables mutation-driven rescan. Respects domain policy (`domainPolicyMode`, `domainAllowlist`, `domainDenylist`): default mode is **allow by default** with a **default sensitive webmail denylist** (`DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES` in `domainPolicy.ts`); allow-by-default blocks denylisted hosts; deny-by-default runs only on allowlisted hosts. Options **Trust & consent** edits mode and lists. Content sync via `domainPolicyStorage.ts` and `autoScan.ts`. |
| Domain policy enrich gate | Default on (`domainPolicyEnrichGateEnabled`); when enabled, live enrichment on the current tab hostname is blocked by the same allow/deny policy before any vendor request leaves the browser (`isEnrichmentAllowedForCurrentPage()` in `domainPolicyStorage.ts`, gate in `enrichmentBackgroundFetch.ts`). Toggle and lists in Options **Trust & consent**. |
| Domain policy presets | Shipped **Sensitive sites denylist** preset merges banking, health-portal, and HR SaaS patterns beyond the default webmail denylist. Options **Trust & consent** applies presets via `applyDomainPolicyPresetToLists()`. Storage schema version 2 backfills webmail defaults when upgrading from an empty denylist. |
| Internal asset lists | Optional indicator-level blocks for internal domains, IPv4 CIDR ranges, and labeled vendor/SaaS hostname patterns (`internalAssetDomains`, `internalAssetCidrRanges`, `internalAssetVendorLabels`). Default gate on (`internalAssetEnrichGateEnabled`); empty lists impose no block. Gate in `enrichmentBackgroundFetch.ts` via `isOutboundEnrichmentAllowedForIndicator()` in `internalAssetPolicyStorage.ts`; matcher in `internalAssetPolicy.ts`. Options **Trust & consent** editors. |
| Analyst workflow presets | SOC, CTI, and DFIR presets in Options **Trust & consent** apply default toggles (manual-only, auto-scan, pre-query notices, private IPv4, workspace source display, live enrichment sources), `defaultExportTemplateId`, and `pivotEmphasisProviders` via `applyAnalystModePreset()` in `storage.ts`. Definitions in `analystModePresets.ts`; content sync in `analystModeStorage.ts`; pivot ordering in `pivots.ts`. |
| Per-IOC-type flags | Options checkboxes; defaults all MVP and Phase 2 types on; scan omits disabled types |
| `includePrivateIpv4` | Options checkbox; private-space IPv4 omitted in detector when off (default) |
| Enrichment cache TTL | Global seconds field on Options; optional per-source overrides |
| Analyst notes | Per-IOC notes in overlay card; stored under `analystNotes` in `chrome.storage.local` via `extension/src/lib/analystNotesStorage.ts` |
| Tab scan snapshots | Last scan per browser tab (IOC type, value, highlight anchor id, page URL, timestamp) in `chrome.storage.session` via `extension/src/lib/tabScanSnapshotStorage.ts`; cleared when the tab closes |
| Tab scan summaries | Stable consumer view (`TabScanSummary`: total count, per-type counts, entries) fetched via `GET_TAB_SCAN_SUMMARY` in `extension/src/lib/tabScanSummaryClient.ts` |

Never commit storage dumps or API keys to git.

## Per-IOC-type toggles (`iocTypeEnabled`)

Storage schema version **3** stores one boolean per indicator type under `iocTypeEnabled`. Options **Scanning → Indicator types** renders a checkbox for each entry in `IOC_TYPE_SETTINGS_ORDER` (`storage.ts`).

| Key | Options label |
|-----|---------------|
| `ipv4` | IPv4 addresses |
| `domain` | Domain names |
| `url` | URLs |
| `md5` | MD5 hashes |
| `sha1` | SHA1 hashes |
| `sha256` | SHA256 hashes |
| `cve` | CVE identifiers |
| `email` | Email addresses |
| `asn` | ASNs |
| `cidr` | IPv4 CIDR ranges |
| `filepath` | File paths |
| `onion` | Onion domains |

Defaults are **on** for every type. Upgrading from schema version 2 merges missing Phase 2 keys with default **on** via `migrateVera5StorageRaw()`. Content scripts read toggles through `iocTypeEnabledStorage.ts`; disabled types are omitted after deduplication in `detector.ts`. Phase 2 regex matchers land in a separate change set—toggles are wired first.

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

### Settings pack export (`settingsPack.ts`)

- File name default: `vera5-settings-pack.json`; schema version `1`.
- Carries connector toggles, global/per-source cache TTL, domain policy, and analyst mode—**never** API keys.
- Export runs `validateSettingsPackExport()`; import rejects secret key names and threat-profile-shaped JSON.
- Options **Import settings pack** shows a diff preview before apply; stored API keys are unchanged.
- See [Threat profile vs settings pack precedence](#threat-profile-vs-settings-pack-precedence) below.

### Threat profile vs settings pack precedence

Threat profiles (portable workflow bundles) supersede **overlapping** settings pack fields when both are in play. Settings packs remain authoritative for **cache TTL** and **domain policy** unless a profile later defines those areas.

| Overlapping (profile wins) | Pack-only (pack wins) |
|----------------------------|------------------------|
| Connector enablement | Global enrichment cache TTL |
| Analyst mode preset / manual-only / workspace display toggles | Per-source cache TTL overrides |
| Default export template | Domain policy mode, allowlist, denylist, enrich gate |
| Pivot emphasis or recipe set | |
| Quiet mode default (profiles only) | |

Implementation notes:

- `isThreatProfileDocument()` / `assertSettingsPackNotThreatProfile()` in `settingsPack.ts` keep profile JSON out of the pack importer until threat profile import ships.
- `SETTINGS_PACK_THREAT_PROFILE_PRECEDENCE_NOTE` is surfaced in the Options pack import dialog.
- Full analyst-facing merge order: [security-model.md](../security-model.md) (Portable profiles section).

## Content script sync

Several flags sync on load and on `chrome.storage.onChanged`:

- `highlightStorage.ts`, `manualOnlyStorage.ts`, `includePrivateIpv4Storage.ts`, `iocTypeEnabledStorage.ts`, `enrichmentSourceStorage.ts`, `autoScanStorage.ts`, `domainPolicyStorage.ts`, `internalAssetPolicyStorage.ts`, `analystModeStorage.ts`

When adding a new setting consumed in content scripts, follow the same listen/sync pattern to avoid stale tab state.

## Privacy

Settings and cache stay on the analyst profile. See [SECURITY.md](../../SECURITY.md) and [docs/local-mode.md](../local-mode.md).
