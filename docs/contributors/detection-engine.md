# Detection engine

Vera5 detects indicators in **visible text nodes** on HTTP/HTTPS pages when the analyst runs **Scan page** (popup, workspace sidebar, or keyboard shortcut), **Scan selection** (popup or workspace sidebar on highlighted text), **Enrich selection** (popup or workspace sidebar when selected text resolves to an indicator), or when **auto-scan** is enabled in settings.

## Pipeline

**Detection pipeline**

```mermaid
flowchart LR
  Collect[Text collection]
  Match[Matching]
  Dedup[Deduplication]
  Highlight[Highlight generation]
  Output[Scan output]

  Collect --> Match --> Dedup --> Highlight --> Output
```

For operator scan and triage context, see [docs/analyst-workflows.md](../analyst-workflows.md).

1. **Text collection** — `extension/src/content/textWalker.ts` walks eligible DOM text nodes (skips `script`, `style`, `textarea`, and metadata subtrees by default).
2. **Matching** — `extension/src/lib/iocRegex.ts` applies conservative regex per IOC type.
3. **Dedup and overlap** — `extension/src/content/detector.ts` resolves overlapping spans using the priority order below, records suppressed competing types on `ignoredOverlaps` for **Why detected?**, and drops matches whose type is disabled in `iocTypeEnabled` storage.

**Overlap priority** (highest wins; longest match within the same hash tier):

| Priority | Type |
|----------|------|
| 1 | URL |
| 2 | Email address |
| 3 | File path (conservative) |
| 4 | Onion domain (Tor v3) |
| 5 | SHA256 |
| 6 | SHA1 |
| 7 | MD5 |
| 8 | CVE |
| 9 | IPv4 CIDR |
| 10 | IPv4 |
| 11 | ASN |
| 12 | Domain |

Collection order in `detectIocsInText` reserves spans for higher-priority types before lower-priority finders run (for example email before domain, CIDR before IPv4, filepath before bare IPv4 inside UNC paths). `dedupeOverlappingMatches` applies the same priority table to any remaining collisions. Per-type overlap examples are in [phase2-ioc-detector-spec.md](../phase2-ioc-detector-spec.md#overlap-priority).
4. **Highlighting** — `extension/src/content/highlighter.ts` underlines matches when highlighting is enabled and assigns stable `data-vera5-anchor-id` values for tray navigation.
5. **Scan snapshot** — after each scan, `extension/src/content/scanPage.ts` publishes a versioned per-tab snapshot (IOC type, value, anchor linkage) to `chrome.storage.session` via the service worker (`extension/src/lib/tabScanSnapshotStorage.ts`).
6. **Scan summary** — popup and content consumers read a stable `TabScanSummary` view model through `GET_TAB_SCAN_SUMMARY` (`extension/src/lib/tabScanSummaryClient.ts`, `extension/src/content/tabScanSummaryContent.ts`).

Scan entry: `extension/src/content/scanPage.ts`, invoked from the service worker on `scan-page` messages and from popup/workspace controls on `SCAN_SELECTION` for range-limited scans on dense dashboards. Selection enrich entry: `extension/src/content/enrichSelection.ts` on `ENRICH_SELECTION`, resolving a single indicator from the active selection (including scanned highlights) and opening the hover card or workspace detail with a manual enrichment fetch.

## Supported types (MVP)

IPv4, domain, URL, MD5, SHA1, SHA256, CVE. Frozen list and out-of-scope types are in [docs/architecture.md](../architecture.md).

## Phase 2 types (specification)

Email address, ASN, IPv4 CIDR, conservative file path, and Tor v3 onion domain grammar—with positive and negative fixture tables—is in [docs/phase2-ioc-detector-spec.md](../phase2-ioc-detector-spec.md). Per-type enable toggles for all five types are in `iocTypeEnabled` (schema version 3); Options exposes checkboxes for each type. Regex finders and overlap resolution are implemented in `iocRegex.ts` and `detector.ts`; update the spec when regex behavior changes.

**Type badges:** Popup tray rows and filter chips use short codes from `IOC_TYPE_TRAY_LABEL` in `tabScanSummary.ts` (`EML`, `ASN`, `CIDR`, `PATH`, `ONION`). The on-page hover card header uses long labels from `formatDetectionTypeLabel` in `hoverCardEnrichment.ts` (for example **Email address**, **IPv4 CIDR**). On-page highlight badges reuse the same short codes via `TYPE_BADGE_LABEL` in `highlighter.ts`.

## False-positive controls

Rules live in `iocRegex.ts` and `detector.ts`. Public reference tables (decoys, suppressions, limitations) are maintained in [docs/architecture.md](../architecture.md#known-false-positives-and-suppressions).

Notable behaviors:

- Filename-style domains with denylisted TLDs (`chart.png`, `splunkd.log`) are rejected.
- Semver-like prefixes and `from X to Y` upgrade ranges can suppress dotted quads mistaken for IPv4.
- Private-space IPv4 is omitted when `includePrivateIpv4` is false in storage (default).
- Disabled IOC types (`iocTypeEnabled`) are omitted after deduplication; Options exposes one checkbox per MVP and Phase 2 type.
- **Conservative file paths** — Windows `\Windows\`, `\Program Files\`, and Unix `/usr/bin`, `/etc` denylist tables are in [phase2-ioc-detector-spec.md — File path (conservative)](../phase2-ioc-detector-spec.md#file-path-conservative); implement denylist checks after grammar in `iocRegex.ts`.
- **Defanged indicators** — `iocRegex.ts` refangs common analyst-safe forms before validation: `hxxp`/`hxxps` schemes, bracket dots (`[.]`, `(.)`, `[dot]`, `(dot)`), and bracket scheme separators (`[:]//`, `[://]`) on URLs, domains, and IPv4 literals. Stored match values are refanged for enrichment; optional `displayValue` preserves the on-page defanged text. Hover card and tray UIs show **On page** and **Refanged** rows when those differ; highlight spans still cover the original visible text. Copy actions let analysts copy either form; URL indicators add a confirmed **Open live URL** action for the refanged value.
- Scan stops after a text-node cap (performance guardrail) per `textWalker.ts` (`DEFAULT_MAX_TEXT_NODES_PER_SCAN`, default 2500 eligible text nodes). Page scans return a `profile` object on the scan response: `textNodesScanned`, `textNodeCap`, `capReached`, `iocCount`, `iocCap`, `iocCapReached`, and `durationMs`. When `capReached` is true, additional visible text on the page was not scanned—use **Scan selection** on the region you need. When `iocCapReached` is true, detection stopped after reaching `DEFAULT_MAX_IOCS_PER_SCAN` (500) matches; narrow the scan with **Scan selection** or disable noisy IOC types in Options.
- **Scan selection** walks only text nodes intersecting the active browser selection (`scanTextNodesForIocsInRange` in `detector.ts`), so analysts can triage one table row or log block on heavy SOC exports without hitting the full-page text-node cap.

## Auto-scan

`extension/src/content/autoScan.ts` and `mutationRescan.ts` register a debounced `MutationObserver` when `autoScanEnabled` is true (default **false**). Mutations do not rescan unless the analyst opts in via Options.

## Tests

- `detector.test.ts`, `iocRegex.test.ts`, `textWalker.test.ts`
- `fixtureTuning.test.ts` against `examples/sample-alert.html`, `examples/sample-blog.html`, `examples/sample-splunk-export.html`, `examples/sample-security-onion-alert.html`, and `examples/sample-extended-ioc-alert.html` (see [docs/soc-validation-fixtures.md](../soc-validation-fixtures.md))

When changing regex or walker defaults, update golden/fixture expectations and the architecture FP tables if behavior shifts.
