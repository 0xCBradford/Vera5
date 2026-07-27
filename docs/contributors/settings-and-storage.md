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
| Domain policy enrich gate | Default on (`domainPolicyEnrichGateEnabled`); when enabled, live enrichment on the current tab hostname is blocked by the same allow/deny policy before any vendor request leaves the browser (`isEnrichmentAllowedForCurrentPage()` in `domainPolicyStorage.ts`, gate in `enrichmentBackgroundFetch.ts`). Toggle and lists in Options **Trust & consent**. Domain deny wins over noise rules: noise rules deprioritize indicator display (and optionally omit from scan) but never authorize enrich or auto-scan on a blocked hostname. |
| Domain policy presets | Shipped **Sensitive sites denylist** preset merges banking, health-portal, and HR SaaS patterns beyond the default webmail denylist. Options **Trust & consent** applies presets via `applyDomainPolicyPresetToLists()`. Storage schema version 2 backfills webmail defaults when upgrading from an empty denylist. |
| Internal asset lists | Optional indicator-level blocks for internal domains, IPv4 CIDR ranges, and labeled vendor/SaaS hostname patterns (`internalAssetDomains`, `internalAssetCidrRanges`, `internalAssetVendorLabels`). Default gate on (`internalAssetEnrichGateEnabled`); empty lists impose no block. Gate in `enrichmentBackgroundFetch.ts` via `isOutboundEnrichmentAllowedForIndicator()` in `internalAssetPolicyStorage.ts`; matcher in `internalAssetPolicy.ts`. Options **Trust & consent** editors. |
| Analyst workflow presets | SOC, CTI, and DFIR presets in Options **Trust & consent** apply default toggles (manual-only, auto-scan, pre-query notices, private IPv4, workspace source display, live enrichment sources), `defaultExportTemplateId`, and `pivotEmphasisProviders` via `applyAnalystModePreset()` in `storage.ts`. Definitions in `analystModePresets.ts`; content sync in `analystModeStorage.ts`; pivot ordering in `pivots.ts`. |
| Active threat profile | Imported profile id/name and last-import timestamp in `activeThreatProfile` (`settingsPack.ts`); Options **Settings Backup** indicator; updated on threat profile import |
| Per-IOC-type flags | Options checkboxes; defaults all MVP and Phase 2 types on; scan omits disabled types |
| `includePrivateIpv4` | Options checkbox; private-space IPv4 omitted in detector when off (default) |
| `hideSuppressedFromScan` | Options **Noise rules** toggle; default **off** so detection still finds noise-rule matches; when on, matching indicators are omitted from page/selection scans |
| `skipEnrichOnKnownGoodMatch` | Options **Known-good lists** toggle; default **off**; when on, live vendor enrichment is skipped for indicators that match an enabled known-good entry (TTL-valid local cache remains readable and is consulted before the skip; does not bypass domain deny or quiet mode—domain/quiet gates run first) |
| Enrichment cache TTL | Global seconds field on Options; optional per-source overrides |
| Analyst notes | Per-IOC notes in overlay card; stored under `analystNotes` in `chrome.storage.local` via `extension/src/lib/analystNotesStorage.ts` |
| Tab scan snapshots | Last scan per browser tab (IOC type, value, highlight anchor id, page URL, timestamp) in `chrome.storage.session` via `extension/src/lib/tabScanSnapshotStorage.ts`; cleared when the tab closes |
| Tab page context | Last classified page context per browser tab (`pageContextType`, page URL, matched signal ids, timestamp) in `chrome.storage.session` via `extension/src/lib/pageContextStorage.ts`; updated on page scan; cleared when the tab closes. When the classified page type changes, Vera5 applies the matching analyst workflow preset (SOC, CTI, or DFIR) unless the site origin has a stored mode override in `pageContextSiteModeOverrides` |
| Page context site overrides | Per-hostname page-type overrides in `pageContextSiteModeOverrides` (`chrome.storage.local`); Options **Trust & Consent → Treat this site as …** add/remove entries via `setPageContextSiteModeOverrides()`, **Reset to auto-detect**, and **Clear all overrides**; popup tray header shows override vs auto-detected state with inline reset |
| Tab scan summaries | Stable consumer view (`TabScanSummary`: total count, per-type counts, entries) fetched via `GET_TAB_SCAN_SUMMARY` in `extension/src/lib/tabScanSummaryClient.ts` |
| Correlation clusters | Cross-session IOC-set clusters in `chrome.storage.local` under `correlationClusters` via `extension/src/lib/correlationClusterStorage.ts` (store `schemaVersion`, `updatedAt`, `clusters[]`, `retentionDays`, `overlapMerge`); `migrateCorrelationClustersStore()` upgrades unversioned legacy envelopes and is applied on read; retention prune drops clusters older than the configured day window (default 90) on read; Options **Cross-session correlation** edits retention days, overlap-merge mode/threshold, and clear-all (preserves retention/overlap preferences) |
| Noise rules | Inspectable local suppress/internal/benign pattern rules in `chrome.storage.local` under `noiseRules` via `extension/src/lib/noiseRuleStorage.ts` (store `schemaVersion`, `updatedAt`, `rules[]`, max 256); learned from explicit watchlist label opt-in; last watchlist learn recorded under `noiseRuleLastLearnUndo` for single-step Options **Undo last learned rule**; Options **Noise rules** lists rules with search, enable/disable, edit, and delete; **Preview matches on sample alert** runs an offline match against the fixed `examples/sample-alert.html` indicator set without opening or changing any live page; human-readable action/pattern type/pattern/hits/created/id (no hidden weight vectors), **Export rules JSON** for team handoff (`schemaVersion` + `exportedAt` + `rules`, allowlisted fields only including `enabled`, never API keys), **Import rules JSON/CSV** with schema validation, duplicate detection, and merge modes (**add-only** skip duplicates vs **replace-all** with confirmation), optional **Import SOC dashboard starter** (`examples/soc-dashboard-noise-starter.json`; never auto-applied), clear-all, and **Hide suppressed indicators from scan** (`hideSuppressedFromScan`, default **off**); popup tray moves matching **enabled** noise-rule IOC rows into a default-collapsed **Suppressed** section; hover card shows **Deprioritized** badge and deep-links to the matched rule in Options |
| Known-good list | Curated inspectable known-good entries in `chrome.storage.local` under `knownGoodList` via `extension/src/lib/knownGoodStorage.ts` (store `schemaVersion`, `updatedAt`, `entries[]`, `categoryEnabled`, max 512); entry fields id/category/matchType/pattern/labelText; Options **Known-good lists** per-category matching toggles, entry edit/delete, optional **Skip outbound vendor enrich on known-good match** (`skipEnrichOnKnownGoodMatch`, default **off**), and **Export list JSON** for team handoff (`schemaVersion` + `exportedAt` + `entries`, allowlisted fields only, never API keys); JSON/CSV import with schema validation, secret rejection, duplicate detection, and merge modes (**add-only** vs **replace-all** with confirmation) via `importKnownGoodListFromText`; optional CDN/SaaS starter (`examples/known-good-cdn-saas-starter.json`; never auto-applied); watchlist promote to `benign`/`internal` syncs matching entry `labelText` to **Known benign** / **Known internal** via `syncKnownGoodEntryLabelFromWatchlistPromotion`; matching paths use `listStoredKnownGoodEntriesForMatching` (skips disabled categories); `shouldSkipOutboundEnrichForKnownGoodMatch` gates live vendor enrich when the Options skip toggle is on |

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
| `extension/src/lib/noiseRuleStorage.ts` | Noise rules JSON export for team handoff (allowlisted fields; never API keys); JSON/CSV import with schema validation, duplicate detection, and merge modes (add-only vs replace-all with confirmation); optional SOC dashboard starter serialize/import |
| `extension/src/lib/knownGoodStorage.ts` | Known-good list JSON export for team handoff (allowlisted fields; never API keys); JSON import with schema validation, secret rejection, duplicate detection, and merge modes (add-only vs replace-all with confirmation); optional CDN/SaaS starter serialize/import |

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

Versioned profile schema (`ThreatProfile` / `ThreatProfileDocument` in `settingsPack.ts`, `threatProfileSchemaVersion: 1`):

| Field | Role |
|-------|------|
| `id` | Stable profile identifier |
| `name` | Display name (legacy `label` normalizes into `name`) |
| `description` | Human-readable summary |
| `enabledConnectors[]` | Connector registry ids to enable (no API keys) |
| `pivotRecipeSetId` | Pivot recipe set reference |
| `defaultExportTemplateId` | Default case-export template id |
| `analystMode` | Analyst workflow preset id (`soc` / `cti` / `dfir`) |
| `quietModeDefault` | Quiet mode on/off when the profile applies |
| `noiseListRef` | Optional local noise-rule list / starter reference |
| `knownGoodListRef` | Optional local known-good list / starter reference |

Built-in profile ids (constants in `settingsPack.ts`, not Chrome manifest metadata): `soc-triage`, `cti-research`, `malware-research` via `BUILT_IN_THREAT_PROFILE_IDS` / `isBuiltInThreatProfileId()`.

**Shipped built-ins** (`listShippedBuiltInThreatProfiles` / `getBuiltInThreatProfileById`):

| Id | Name | Highlights |
|----|------|------------|
| `malware-research` | Malware Research | Domain-forward pivots (`BUILT_IN_MALWARE_RESEARCH_DOMAIN_FORWARD_PIVOTS`), CTI `markdown-report` export template, enrich-friendly connector set (OTX, VirusTotal, URLScan, MalwareBazaar, ThreatFox, URLhaus, AbuseIPDB, RDAP), CTI analyst mode, quiet mode off |
| `soc-triage` | SOC Triage | SOC analyst mode, Splunk-oriented `csv-row` export template, abuse-first pivots (`soc-triage` recipe), conservative connectors (AbuseIPDB + OTX), quiet mode off; applying the SOC preset keeps auto-scan off and manual enrich on |
| `cti-research` | CTI Hunting | CTI analyst mode, `markdown-report` export, pivot emphasis from CTI platform page-context layout (`BUILT_IN_CTI_HUNTING_PIVOT_EMPHASIS` / `getPageContextPivotRecipeOrder(cti_platform)`), tray-first workspace via `showDisabledSourcesInWorkspace` from the CTI preset |

Options **Settings Backup** lists **Apply … profile** for each shipped built-in, opening the threat-profile import review dialog (default apply-as-new-active). No API keys are included.

**Export** (`buildThreatProfileDocumentFromSettings` / `exportThreatProfileJson` / `downloadThreatProfileExport`):

- File name default: `vera5-threat-profile.json`; schema field `threatProfileSchemaVersion: 1`.
- Builds the active profile snapshot (`id: active`) from current settings: enabled connectors, analyst mode (or `custom`), pivot recipe set, default export template, quiet mode, and optional confidence metadata overrides.
- Never includes API keys; export runs `validateThreatProfileExport()` (secret-key walk + complete-profile check).
- Options **Export threat profile** downloads the JSON file.

**Import** (`parseThreatProfileDocument` / `importThreatProfileJson`):

- Validates `threatProfileSchemaVersion` and profile shape; rejects settings-pack JSON.
- Rejects documents whose keys look like `apiKey` / `apiKeys`, `token`, `secret`, `password`, or `credential` (nested keys included).
- Merge modes (`THREAT_PROFILE_IMPORT_MERGE_MODE`):
  - **merge-into-current** — overlay only fields present in the profile onto current settings.
  - **apply-as-new-active** — reset overlapping workflow fields to defaults (connectors, analyst mode, export template, pivot emphasis, quiet mode, related analyst toggles, confidence overrides), preserve API keys and pack-only settings (cache TTL, domain policy), then apply the profile.
- Diff preview via `buildThreatProfileImportPreview` / `buildThreatProfileImportDiff`; Options shows a review dialog with mode radios before apply.
- **Never** overwrites stored API keys.
- Active profile indicator + last-import timestamp persist under `activeThreatProfile` (`getActiveThreatProfileState` / `recordThreatProfileImport`); Options **Settings Backup** shows them. No API keys in this metadata.

Parse/normalize (`normalizeThreatProfileDocument` / `parseThreatProfileDocument`) calls the same secret-key walk as settings packs and **rejects** documents whose keys look like `apiKey` / `apiKeys`, `token`, `secret`, `password`, or `credential` (nested keys included). Profiles never carry raw vendor credentials.

**Field → storage mapping** (`mapThreatProfileToConnectorProfilePreferences`, `mapThreatProfileToAnalystModeStorage`, `mergeImportedThreatProfile`):

| Threat profile field | Connector profile shape | Analyst / Vera5 settings |
|----------------------|-------------------------|---------------------------|
| `enabledConnectors[]` | `preferences.enrichmentSourceEnabled` (listed ids on; other registry ids off) | `enrichmentSourceEnabled` |
| `analystMode` | *(none)* | Applies matching analyst preset (`analystModePresetId`, preset export template, pivot emphasis, quiet/manual toggles from preset), then profile overlays win |
| `defaultExportTemplateId` | *(none)* | `defaultExportTemplateId` |
| `pivotRecipeSetId` | *(none)* | Resolves aliases (`soc-triage`→`soc`, `cti-hunt`/`cti-research`→`cti`, …) to preset `pivotEmphasis` → `pivotEmphasisProviders`; `malware-research` applies domain-forward pivots instead of the CTI preset order |
| `quietModeDefault` | *(none)* | `quietMode` |
| `noiseListRef` | *(none)* | Reserved optional noise-list import slot — **not** written to settings storage |
| `knownGoodListRef` | *(none)* | Reserved optional known-good list import slot — **not** written to settings storage; does **not** auto-import or replace the local known-good list |
| confidence overrides (optional) | `preferences.connectorConfidenceMetadataOverrides` | `connectorConfidenceMetadataOverrides` |

API keys are never read from or written by this mapping.

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
