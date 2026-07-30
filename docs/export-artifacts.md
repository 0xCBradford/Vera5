# Export artifacts

Vera5 builds **case artifacts** from a single normalized enrichment record in `extension/src/lib/enrichmentExport.ts`. Operators can paste **markdown** into case notes, wikis, or Obsidian, or copy **JSON** for tools and automation.

Exports are **local-only**: no API keys, no full page content, and no Vera5-operated backend. Only indicator values and enrichment summaries you already loaded appear in the artifact.

## Formats

| Format | Builder | Typical use |
|--------|---------|-------------|
| **Markdown** | `buildEnrichmentExportMarkdown()` | Ticket handoff, Obsidian, wiki paste |
| **JSON** | `serializeEnrichmentExportJson()` / `copyEnrichmentExportJsonToClipboard()` | Structured import, scripts, case tooling |

Both formats derive from `buildNormalizedEnrichmentRecord()` so score, disagreement, per-source rows, and analyst notes stay aligned with the production overlay.

## JSON `schemaVersion`

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | Export contract version. **Current value: `1`**. Consumers must reject unknown versions they cannot parse. Increment when required fields or score-mode semantics change incompatibly. Additional `iocType` string values (for example email, ASN, CIDR, file path, onion) do **not** require a version bump when the document shape is unchanged. |

Implementation constant: `ENRICHMENT_EXPORT_SCHEMA_VERSION` in `enrichmentExport.ts`.

## JSON document contract (schema version 1)

Top-level object returned by `buildEnrichmentExportDocument()`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | yes | Always `1` for this contract. |
| `exportedAt` | `string` | yes | ISO-8601 timestamp when the record was built. |
| `ioc` | `string` | yes | Indicator value (trimmed). |
| `iocType` | `string` | yes | Machine type: `ipv4`, `domain`, `url`, `md5`, `sha1`, `sha256`, `cve`, `email`, `asn`, `cidr`, `filepath`, `onion`. |
| `iocTypeLabel` | `string` | yes | Human label (for example `IPv4 address`, `Email address`, `IPv4 CIDR`). |
| `enrichmentState` | `string` | yes | `empty`, `loading`, `error`, or `ready`. |
| `summary` | `string` | no | Primary enrichment summary when present. |
| `tags` | `string[]` | yes | Tag chips from enrichment (may be empty). |
| `sources` | `object[]` | yes | Per-source normalized rows (see below). |
| `disabledSources` | `string[]` | yes | Source IDs disabled in settings (`abuseipdb`, `otx`, `urlscan`, `greynoise`). |
| `score` | `object` | yes | Composite score block (see below). |
| `disagreement` | `boolean` | yes | `true` when source bands diverge materially. |
| `disagreementNotice` | `string` | no | Present when `disagreement` is `true`. Matches overlay copy. |
| `pivots` | `object[]` | yes | Static pivot links (`provider`, `label`, `href`). |
| `analystNotes` | `string` | no | Local analyst note from the overlay card when present. Omitted when empty. Resolved from the normalized record, including per-IOC notes cached in `analystNotesSession.ts`. |

### `sources[]` entry

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Vendor id (`abuseipdb`, `otx`, `urlscan`, `greynoise`). |
| `name` | `string` | Display name (for example `AbuseIPDB`). |
| `status` | `string` | `ok`, `error`, or `skipped`. |
| `summary` | `string` | Normalized detail line for this source. |
| `tags` | `string[]` | Tags returned for this source. |
| `fromCache` | `boolean` | Optional. `true` when the row used cached enrichment. |
| `lastUpdatedLine` | `string` | Optional. Human `Last updated: …` line when timestamp is known. |
| `badgeText` | `string` | Status badge (`Live`, `Cached`, `Error`, `Skipped`). |

### `score` object modes

The `score.mode` field selects which additional properties are present.

| `score.mode` | When | Key fields |
|--------------|------|------------|
| `available` | Two or more parseable OK signals produced a blended composite | `label`, `summaryText`, `compositeSignal`, `reasoningLines`, optional `reasoningEmptyDetail` |
| `insufficient` | Enrichment ran but blending requirements were not met (for example one OK source, unrecognized summaries, or all live connectors skipped for the indicator type) | Same as `available`, plus `insufficientDetail` |
| `unavailable` | Every enrichment source is disabled in settings | `headline`, `detail` |
| `none` | No enrichment source results on the record yet | `headline`, `detail` |

**Score labels** (`label` / band): `unknown`, `low`, `suspicious`, `high`, `critical`.  
**`summaryText`**: Human headline such as `High risk (84/100)` or `Unknown risk`.  
**`compositeSignal`**: Numeric 0–100 when blended; `null` when not blendable.  
**`reasoningLines`**: Ordered per-source contribution strings (same rules as overlay **How this score was computed**).

When `disagreement` is `true`, `disagreementNotice` repeats the overlay **Sources disagree** callout so JSON consumers do not need to reconstruct it.

## Markdown sections

Markdown export uses the same normalized record:

1. **Header** — `## Vera5 IOC Summary`, IOC, type, optional summary and tags.
2. **Score** — `Risk score: …` with reasoning list and disagreement line when scoring data exists; explicit **Risk score unavailable** block when sources are disabled or enrichment is absent.
3. **Source Summary** — Single-source attribution or multi-source bullet rows; disabled-source placeholders when applicable.
4. **Analyst notes** — `### Analyst notes` section with overlay note text when a note exists for the IOC; omitted when empty.

## Example JSON (schema version 1)

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-02T12:00:00.000Z",
  "ioc": "8.8.8.8",
  "iocType": "ipv4",
  "iocTypeLabel": "IPv4 address",
  "enrichmentState": "ready",
  "summary": "84 abuse confidence",
  "tags": ["US"],
  "sources": [
    {
      "sourceId": "abuseipdb",
      "name": "AbuseIPDB",
      "status": "ok",
      "summary": "84 abuse confidence",
      "tags": ["US"],
      "fromCache": false,
      "badgeText": "Live"
    },
    {
      "sourceId": "otx",
      "name": "OTX",
      "status": "ok",
      "summary": "3 threat pulses",
      "tags": [],
      "badgeText": "Live"
    }
  ],
  "disabledSources": [],
  "score": {
    "mode": "available",
    "label": "high",
    "summaryText": "High risk (82/100)",
    "compositeSignal": 82,
    "reasoningLines": [
      "AbuseIPDB: High (84/100, weight 1.00).",
      "OTX: Suspicious (65/100, weight 0.85)."
    ]
  },
  "disagreement": false,
  "pivots": [
    {
      "provider": "virustotal",
      "label": "VirusTotal",
      "href": "https://www.virustotal.com/gui/ip-address/8.8.8.8"
    }
  ]
}
```

## Connector profile JSON

**Module:** `extension/src/lib/connectorProfileExport.ts`

Operators can share **connector preferences** across profiles without exposing API keys. The export is a separate artifact from enrichment case JSON and from full settings export in `settingsExport.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `connectorProfileSchemaVersion` | `number` | Profile contract version. **Current value: `1`**. |
| `exportedAt` | `string` | ISO-8601 timestamp when the profile was built. |
| `preferences` | `object` | IOC-type toggles, source toggles, manual-only mode, private IPv4 flag, and cache TTL fields — **never** API keys. |
| `rateLimitMetadata` | `object` | Static cooldown defaults, per-source timeout hints, quota summary strings, and rate-limit header names for documentation. |
| `privacyWarnings` | `object` | Overlay disclaimer strings (`enrichmentDisclaimer`, `riskScoreDisclaimer`) so shared profiles carry the same privacy copy. |

**Export:** `serializeConnectorProfileExport()` / `exportConnectorProfileJson()`  
**Import:** `parseConnectorProfileDocument()` / `importConnectorProfileJson()` — rejects any document containing `apiKeys`; merge preserves stored keys.

Default filename constant: `CONNECTOR_PROFILE_EXPORT_FILENAME` (`vera5-connector-profile.json`).

## Workspace snapshot Obsidian package links

**Module:** `extension/src/lib/workspaceSnapshot.ts`

Optional workspace snapshot export builds a vault folder with an index note, a timeline note, and one note per tray indicator. The index note links to those files with **Obsidian wikilinks** (`[[note]]`), not standard Markdown `[label](path)` links, so navigation works when the folder is copied into an Obsidian vault.

| Package file | Wikilink target in index note | Example wikilink |
|--------------|-------------------------------|------------------|
| `timeline.md` | `timeline` | `[[timeline\|Investigation timeline appendix]]` |
| `iocs/{slug}.md` | `iocs/{slug}` | `[[iocs/8-8-8-8\|8.8.8.8]]` |

**Rules**

- Wikilink targets omit the `.md` extension.
- Nested indicator notes use forward slashes (`iocs/…`).
- `{slug}` is a lowercase hyphenated basename derived from the indicator value; duplicate values receive a type prefix or numeric suffix.
- Aliases (`[[target\|label]]`) use the live indicator value when it is safe for wikilink syntax; otherwise the target-only form `[[target]]` is used.
- Package assembly and link builders are documented in code as `WORKSPACE_SNAPSHOT_OBSIDIAN_LINK_FORMAT_DOCS`.

Copy the exported root folder into your vault (or open it as a vault). Obsidian resolves wikilinks relative to that vault root. No API keys or raw vendor secrets are included in package notes.

## Operator-visible vs library-only exports

Use this table when advancing copy/export UX. Prefer wiring thin Options/workspace controls for library-only builders before inventing new formats.

| Surface | Operator-visible today | Notes |
|---------|------------------------|-------|
| Per-IOC Markdown / JSON / ticket templates | Overlay **Copy** / **Export** / **Template** row; palette filtered copy | Templates: Jira, TheHive, Analyst update, Obsidian, Markdown report, CSV rows |
| Session MD / JSON / CSV | Extension workspace session export | Full Markdown can append **Session notebook** |
| Collection MD / JSON / CSV | Workspace **IOC collections** | `schemaVersion` + redaction; never API keys |
| Timeline appendix | Workspace timeline export | Ticket templates or versioned JSON |
| Investigation replay transcript | Workspace **Investigation replay** | Markdown / Obsidian / Analyst update shapes |
| Settings Backup | Options **Settings Backup** | Keys optional |
| Settings packs / threat profiles | Options **Settings Backup** | Never API keys; diff preview |
| Noise rules / known-good list JSON | Options export controls | Known-good **Import** UI is thinner than Noise rules—priority handoff gap |
| Workspace snapshot / correlation pack / connector profile JSON | **Library helpers only** (no dedicated Options/workspace export button) | Documented in code; do not claim UI until wired |

### Next advancements (reassessment — not yet built)

1. **Known-good Import** — Mirror Noise rules JSON/CSV import (add-only / replace-all) so list handoff is bidirectional.
2. **Demote or wire library-only packs** — Either add thin workspace actions for correlation pack / workspace snapshot, or keep them contributor-only and omit from analyst docs.
3. **Notebook + ticket templates** — Optional append of Indicator-scope notebook fragments on template copy (session Markdown already appends session notebook).
4. **Filtered copy + side panel** — Bind palette “filtered” copy to the Chromium side panel tray filter (docs should not require a separate in-page sidebar).
5. **Threat profile export matrix** — Document recommended SOC / CTI / DFIR profile presets (default template + quiet mode) without a marketplace.

## IOC collections (where data lives)

Collections are **local-only** in `chrome.storage.local` (see `iocCollectionStorage.ts`). Create and manage them from the extension workspace; save members from the overlay, tray, or selection context menu **Case → Save to collection**. There is no Vera5 cloud sync and no separate “ongoing vs later review” queue in this release—use collection names or Labels for that workflow until a dedicated status feature ships.

## Related documentation

- [Analyst workflows](analyst-workflows.md) — overlay triage, cache, and score interpretation
- [Scoring system (contributors)](contributors/scoring-system.md) — band math, disagreement thresholds, reasoning chain
- [Extension architecture (contributors)](contributors/extension-architecture.md) — module layout and build commands
