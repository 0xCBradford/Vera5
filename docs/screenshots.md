# Screenshots and capture guide

Public-facing images for README, store listings, and onboarding. Each asset below maps to a **shipped operator surface** in the current extension build.

**Status:** SVG placeholders stand in until PNG or WebP captures replace them. Placeholders use Vera5 token colors so layout slots are visible in docs previews.

**Asset directory:** `docs/screenshots/assets/` (paths relative to this file use `assets/`).

## Before you capture

1. Build and load unpacked from `extension/dist/` (see [README.md](../README.md#load-unpacked-chrome)).
2. Serve fixtures over HTTP, for example from the repository root:

   ```powershell
   npx --yes serve . -p 4173
   ```

   Open `http://127.0.0.1:4173/examples/sample-alert.html` for most captures below. Use `sample-splunk-export.html` or `sample-security-onion-alert.html` when a dense SOC-style layout is called out.

3. **Redact before publish:** mask or omit API keys, real customer IOCs, internal hostnames, and inbox content. Use fixture pages and demo keys only. See [SECURITY.md](../SECURITY.md#secrets-and-repository-hygiene).

4. **Recommended format:** PNG or WebP, 1280×720 or 1440×900, sRGB. Name files exactly as listed (replace `.svg` with `.png` or `.webp` and update the extension in the markdown image line when you drop in real captures).

5. **Theme:** capture light mode unless the doc calls for dark-mode variants. Chrome default zoom 100%.

## Capture checklist

| # | File (placeholder) | Surface | What must appear in the capture |
|---|-------------------|---------|----------------------------------|
| 1 | `scan-highlights-page.svg` | On-page highlights | `sample-alert.html` after **Scan page**: inline underlines, type badges, and **›** controls on several indicator types (IPv4, domain, URL, hash, CVE). |
| 2 | `on-page-overlay-enrichment.svg` | On-page overlay | Overlay open on a highlight showing **Risk score**, **How this score was computed**, per-source rows (mocked or cached OK), **Recommended next pivots**, copy actions, and analyst notes area. |
| 3 | `pre-query-disclosure.svg` | Trust — pre-query | Inline pre-query notice naming enabled vendors and the indicator value; **Send query** / **Cancel** visible (trigger with live sources enabled and manual enrich). |
| 4 | `command-palette.svg` | Command palette | **Ctrl+Shift+K** / **Cmd+Shift+K** palette on a scanned tab: filter field and commands such as **Scan page**, **Enrich selection**, **Copy filtered Markdown**, **Open options**. |
| 5 | `popup-session-tray.svg` | Toolbar popup | Active **Investigation session** title, IOC rollups from latest scan, **Detected indicators** tray with type filter chips and row list. |
| 6 | `popup-collections.svg` | IOC collections | Popup **IOC collections** section with at least one named collection, member count, **View members** / export actions visible. |
| 7 | `popup-source-operations.svg` | Source operations | Popup **Source operations**: cache entry count, cooldown state if applicable, per-source last status rows. |
| 8 | `workspace-sidebar.svg` | Page workspace sidebar | **Open sidebar** panel docked on the page: scan controls, filtered IOC list, **Why detected?** expanded on one row, **Save to collection…**. |
| 9 | `overlay-export-templates.svg` | Export templates | Overlay **Template** row or export menu showing ticket templates (**Jira comment**, **TheHive case note**, **Analyst update**, etc.) and filtered-subset export actions. |
| 10 | `options-keys-sources.svg` | Settings — keys | Options page **Enrichment Sources** with **Use local backend** (off by default), masked key fields, per-source enable toggles, **Manual-only enrichment**, and **Indicator types** checkboxes. |
| 11 | `options-trust-consent.svg` | Settings — trust | **Trust & consent**: pre-query toggle, domain policy mode, allow/deny lists or preset control, internal asset lists, analyst workflow preset selector. |
| 12 | `bulk-enrich-selection.svg` | Bulk enrich | Workspace tray with multiple row checkboxes selected, **Enrich selected (N)** and quota confirmation or **Enriching X of N…** progress visible. |

Optional follow-ups (not required for MVP placeholder set): context menu **Enrich with Vera5**, **Session export** download menu, **Promote session to collection…**, dark-mode variants of captures 1–2.

## Gallery (placeholders)

Replace each image file under `assets/` and update the extension in the line below if you switch from SVG to PNG/WebP.

### Scan and on-page triage

![Page scan — highlights on sample alert fixture (placeholder)](assets/scan-highlights-page.svg)

*Capture brief:* #1 — highlights on `examples/sample-alert.html`.

![On-page overlay — risk score, sources, and pivots (placeholder)](assets/on-page-overlay-enrichment.svg)

*Capture brief:* #2 — enriched overlay with scoring and pivot links.

![Pre-query disclosure before vendor fetch (placeholder)](assets/pre-query-disclosure.svg)

*Capture brief:* #3 — trust gate on overlay before live enrich.

![Command palette on active tab (placeholder)](assets/command-palette.svg)

*Capture brief:* #4 — palette open with core commands listed.

### Popup and sidebar

![Toolbar popup — investigation session and IOC tray (placeholder)](assets/popup-session-tray.svg)

*Capture brief:* #5 — session header and detected-indicators tray.

![Toolbar popup — IOC collections (placeholder)](assets/popup-collections.svg)

*Capture brief:* #6 — collections manager in popup.

![Toolbar popup — source operations (placeholder)](assets/popup-source-operations.svg)

*Capture brief:* #7 — cache and per-source status panel.

![Page workspace sidebar (placeholder)](assets/workspace-sidebar.svg)

*Capture brief:* #8 — docked sidebar on fixture page.

### Export, settings, bulk actions

![Overlay export templates (placeholder)](assets/overlay-export-templates.svg)

*Capture brief:* #9 — template and export controls on overlay.

![Settings — API keys and enrichment sources (placeholder)](assets/options-keys-sources.svg)

*Capture brief:* #10 — **Use local backend**, masked keys, and source toggles.

![Settings — trust and consent (placeholder)](assets/options-trust-consent.svg)

*Capture brief:* #11 — domain policy and trust controls.

![Workspace bulk enrich selection (placeholder)](assets/bulk-enrich-selection.svg)

*Capture brief:* #12 — multi-select tray and enrich queue UI.

## Using captures elsewhere

| Destination | Suggested assets |
|-------------|------------------|
| [README.md](../README.md) | #1 overlay flow, #5 popup tray, #10 settings keys (after PNG/WebP swap) |
| Store listing draft | #1, #2, #5, #11 — no keys visible |
| Social / release notes | #4 palette or #2 scoring — crop to 1200×630 if needed |

Link to this guide from README or CONTRIBUTING when real captures land; keep gallery filenames stable so links do not rot.

## Related docs

- [Chrome Web Store listing draft](store-listing.md) — copy-paste descriptions, single purpose, and permission justifications
- [Operator surfaces](../README.md#operator-surfaces)
- [Analyst workflows](analyst-workflows.md)
- [SOC validation fixtures](soc-validation-fixtures.md)
- [SECURITY.md](../SECURITY.md) — redaction and secrets in images
