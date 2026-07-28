# Testing

Quality gates for the extension workspace live under `extension/`.

## Standard commands

```bash
cd extension
npm run check      # eslint + vitest
npm run build      # dist/ + verify:dist + verify:security
npm run build:firefox   # dist-firefox/ + verify:firefox-manifest + verify:dist + verify:security:firefox
npm run test       # vitest only
npm run test:e2e   # Playwright browser harness (requires build + browser install)
npm run test:e2e:critical   # PR-gate Investigation Mode smokes only
npm run test:e2e:firefox   # Firefox temporary add-on smoke (requires build:firefox + Firefox install)
npm run typecheck  # tsc --noEmit
```

From repository root on Windows: `.\scripts\check.ps1`

## Test layout

Vitest discovers tests alongside source (`*.test.ts`, `*.test.tsx`) under `extension/src/`.

| Area | Example files |
|------|----------------|
| Detection | `detector.test.ts`, `iocRegex.test.ts`, `fixtureTuning.test.ts` (includes `examples/sample-alert.html`, `sample-blog.html`, `sample-splunk-export.html`, `sample-security-onion-alert.html`); defang/refang and match provenance coverage in `iocRegex.test.ts`, `tabScanSnapshot.test.ts`, `tabScanSummary.test.ts`, `highlighter.test.ts`, `scanPage.test.ts`, and `hoverCardTrigger.test.ts` |
| Overlay / card | `hoverCardOverlay.test.ts`, `hoverCardEnrichment.test.ts`, `hoverCardNotebook.test.ts` (notebook panel view: IOC/session/page tabs, fragment rows with hypothesis Unverified badge, explicit empty-state copy with text-only / no-screenshot hint; chronological popup session notebook timeline sort/load helpers; session fragment text search filter; screenshot-capture UI forbid catalog; inline add/edit/delete authoring helpers and scope gates; overlay renders Notebook section with Add fragment / Edit / Delete actions and switches scopes), `RiskScore.test.tsx` |
| Enrichment | `enrichmentHandler.test.ts`, `abuseipdbConnector.test.ts`, `otxConnector.test.ts` |
| Cache / cooldown | `cache.test.ts`, `enrichmentCooldown.test.ts` |
| Scoring | `scoring.test.ts`, `scoring.bands.golden.test.ts`, `scoring.vendorFixtures.golden.test.ts` |
| Export artifacts | `enrichmentExport.test.ts` (contract coverage), `enrichmentExport.golden.test.ts` (format snapshots), `exportTemplates.test.ts` (template routing; optional correlation pack appendix on non-CSV tray exports; optional Obsidian-friendly notebook fragments appendix via template hook), `exportTemplates.golden.test.ts` (per-template snapshots), `investigationSessionExport.test.ts` (session markdown/JSON/CSV; appendable **Session notebook** markdown section from session-attached fragments; markdown section order summary → indicators → enrichment → attribution → notebook; **IOC export only** omits notebook fragments; export input loads fragments from local notebook storage), `workspaceSnapshot.test.ts` (snapshot export JSON includes `notebookFragments` block) |
| Operator macros | `operatorMacro.test.ts` (schema + import validation, editor step order), `operatorMacroStepTypes.test.ts` (v1 step param schemas), `operatorMacroStorage.test.ts` (local-storage round-trip, list reorder, pack import/export), `builtInOperatorMacros.test.ts`, `operatorMacroEnrichTrust.test.ts`, `commandPaletteCommands.test.ts` (shared command-registry invocation, trust-gate abort, and export-builder delegation), `builtInOperatorMacros.sampleAlert.integration.test.ts` (CTI Deep Check / DFIR Triage on `examples/sample-alert.html` with mocked enrich) |
| Correlation clusters | `correlationCluster.test.ts` (schema fields: cluster id, member IOC keys, session ids, first/last seen, co-occurrence count; create/normalize; stable id from sorted member keys; reject empty lists and inverted timestamps; build session IOC sets from scan snapshots and co-occurrence page indexes; exact-set cross-session clustering with min member/session gates; optional Jaccard / min-shared overlap merge with configured thresholds and transitive union-find including inclusive threshold equality and `mergeCorrelationClusterPair` unions; performance caps for max clusters and max IOCs per cluster; retention prune by configurable day window (default 90 days) including inclusive cutoff boundary and empty/all-stale lists; exclude `internal` / `suppress-false-positive` labeled members from promotion; tray panel view for other sessions where a set co-appeared including drill-down title / truncated page URL / date / cluster IOC count; empty-state copy and ready-gated expander when no other sessions share a set; same-page co-occurrence link gate for current-tab scans; operator disclaimer copy (**Correlation ≠ causation**; not a detection verdict); list-only UI layout contract + forbid catalog for force-directed / canvas / global TI map call sites with source scans of `correlationCluster.ts` and `Popup.tsx`; prefer scan memory over session timeline fallback; load from investigation + co-occurrence + label storage helpers); `correlationCluster.sampleFixtures.integration.test.ts` (scan `examples/sample-alert.html` + `examples/sample-malware-blog.html` into two sessions; exact-set alone yields no cluster; min-shared / Jaccard overlap merge produces one cross-session cluster containing shared fixture IOCs); `correlationClusterStorage.test.ts` (versioned `chrome.storage.local` store, persist/list/upsert/clear, retentionDays and overlapMerge fields, prune-on-read for stale clusters, migration hook for unversioned legacy envelopes and unsupported newer schemas, rewrite-on-read after migrate, clear preserves retention/overlap settings; `buildStoredCorrelationClustersFromInvestigationMemory` applies stored overlap threshold); `correlationClusterExport.test.ts` (markdown correlation pack appendix: cluster summary, member IOC table, session refs, empty pack, pipe escaping, operator disclaimer; JSON appendix with top-level `schemaVersion`/`exportedAt`/`disclaimer` envelope aligned with enrichment export schema version, cluster members, session refs, empty pack, filenames; redaction of API keys / raw vendor payloads from markdown and JSON packs); `iocLabel.test.ts` (promotion-exclusion label set); `Popup.test.tsx` (tray **Appeared across sessions** expander lists other sessions with drill-down metadata or shows empty state when cross-session data is insufficient; disclaimer note on correlation and same-page co-occurrence trays; link opens sibling **Appeared alongside** without duplicating that list; `data-vera5-correlation-layout="list"`; no canvas/svg graph); `Options.test.tsx` (Options **Cross-session correlation** retention window, overlap merge mode/threshold, clear-all clusters) |
| Relationship edges | `relationshipEdge.test.ts` (`RelationshipEdge` schema: entityA, entityB, relationship `co_seen`/`resolved_from`, sessionIds[], firstSeen, lastSeen, weight; create/normalize; stable edge id; `co_seen` undirected entity canonicalization; `resolved_from` directed; reject invalid type/empty or equal entities/empty sessions/inverted timestamps/bad weight/unknown fields; allowlisted fields only; entity keys align with co-occurrence `type:value` member keys; builders: eligible IP/domain/hash filter; `co_seen` pairs from session scan (URL/CVE excluded as endpoints); URL-host `resolved_from` pivots; enrich-pivot `resolved_from`; combined scan+enrich builder; max co_seen pair cap; cross-session merge: pair union + weight=session count; configurable min co-occurrence filter default 2; min=1 keeps single-session; `co_seen` vs `resolved_from` stay distinct for same entity pair; known-good policy `off`/`exclude`/`down_rank`: match entity keys via known-good lists; exclude drops edges with a known-good endpoint; down_rank sorts those edges after non-matches; policy off / empty list leaves order unchanged; exclude and down_rank when enabled for IP–domain edges; max related entities per IOC normalize/cap default 64 clamp 1–256; retention prune by configurable day window default 90 days on `lastSeen` including inclusive cutoff and empty/all-stale lists; focused coverage for edge merge, IP→domain `resolved_from` rollup across sessions, and retention prune after rollup); `relationshipEdgeStorage.test.ts` (versioned `relationshipEdges` store persist/list/upsert/clear; migrate unversioned legacy + unsupported newer; clear preserves minCoOccurrenceCount/knownGoodPolicy/retentionDays; truncate to max 4096 stored edges after co-occurrence sort; prune-on-read for stale edges; `setRelationshipEdgeRetentionDays` updates window and prunes; clear-all does not touch `investigationSessions`; no-network persist); `hoverCardRelationship.test.ts` (hover **Previously appeared with** panel: type/truncated value/last seen/session count list rows; list-only layout; known-good exclude and down_rank on panel build when enabled; caps related entities per focus IOC after ranking; tray compact **Appeared with N others** summary + show gate; forbid catalog for force-directed / canvas / global TI map / graph-database surfaces (neo4j, cytoscape, vis.Network, sigma) + source scans of `hoverCardRelationship.ts`, `hoverCardOverlay.ts`, `Popup.tsx`, `Options.tsx` and extension package.json excludes those libraries; correlation-cluster link only when related IOC set overlaps a cluster containing the focus entity; relationship disclaimer reuses cross-session **Correlation ≠ causation** / not-a-verdict copy; prior-session drill-down excludes active session and formats investigation summary lines; truncated page-context origin on prior-session rows with optional site-mode page-profile label; optional investigation replay entry when prior session has replay steps; notebook fragment links for related IOC and prior sessions); `hoverCardRelationship.sampleFixtures.integration.test.ts` (scan `examples/sample-alert.html` + `examples/sample-malware-blog.html` into two sessions; shared IP `8.8.8.8` merge populates **Previously appeared with** with shared related IP/domain/hash partners); `hoverCardOverlay.test.ts` (relationship section renders list rows from loaded panel view; relationship disclaimer note on hover); `Popup.test.tsx` (tray **Appeared with N others** expander lists related entities; list-only, no canvas/svg; disclaimer note; prior-session drill-down reopens investigation session summary; prior-session page-context origin truncated; optional **Investigation replay** opens replay panel; notebook fragment links open session notebook; **See Appeared across sessions** opens overlapping correlation expander); `Options.test.tsx` (Options **Relationship memory** retention window control; **Clear all relationship memory** with confirm / cancel; clear preserves retention and policy); clear-all leaves `investigationSessions` untouched (no combined wipe on this path) |
| Noise rules | `noiseRule.test.ts` (`NoiseRule` schema: id, patternType exact/regex/domain-suffix/cidr, pattern, sourceAction suppress/internal/benign, createdAt, hitCount, enabled; create/normalize; stable id; watchlist label → source action map; human-readable summary and Options detail view without weight vectors; exact/regex/domain-suffix/CIDR match; tray partition into active vs suppressed; disabled rules skipped for matching; search filter; scan filter respects hide-suppressed default off; offline `examples/sample-alert.html` match preview (`mutatesLivePage: false`); single-step last-learned undo slot; dedicated unit coverage for watchlist rule creation (`benign` / `internal` / `suppress-false-positive`), multi-type pattern match, and tray collapse order preservation; hover match view + Options deep-link hash; opt-in `createNoiseRuleFromWatchlistLabel`; session remember/list); `noiseRuleStorage.test.ts` (local `noiseRules` store upsert/update/enable/delete/list/clear/hydrate; `noiseRuleLastLearnUndo` + `undoLastLearnedNoiseRule` single-step only; JSON export→import round-trip restoring pattern fields including `enabled`; invalid patternType / empty pattern rejected on JSON and CSV import with only valid rows stored; persist-learned path asserts no `fetch` / `sendBeacon` / `XMLHttpRequest`; team-handoff JSON export with allowlisted fields and no secrets; JSON/CSV import with schema validation, secret rejection, in-file and existing duplicate detection, add-only and replace-all merge modes with confirmation; SOC dashboard starter JSON parity with `examples/soc-dashboard-noise-starter.json` and on-demand import); `iocLabelSession.test.ts` (`setSessionIocLabel` learns a rule only when `learnNoiseRule: true` and persists to local storage; asserts `fetch` / `sendBeacon` / `XMLHttpRequest` are not called during rule learning); `Options.test.tsx` (Options **Noise rules** lists readable fields with search/edit/enable/delete; **Undo last learned rule**; **Preview matches on sample alert** offline without live-page DOM mutation; export/import/clear/starter controls; import review dialog for merge modes; replace-all requires confirmation; export handoff JSON excludes API keys; import reports duplicates skipped; starter import on demand); `Popup.test.tsx` (tray moves matching IOC rows into collapsed **Suppressed** section; collapsed summary **Why still visible?** tooltip reuses detection provenance); `hoverCardEnrichment.test.ts` (`buildWhyStillVisibleTooltip` from **Why detected?** provenance); `hoverCardOverlay.test.ts` / `HoverCard.test.tsx` (Deprioritized badge + View matched noise rule link); `scanPage.test.ts` (scan still finds noise matches unless hide-suppressed toggle is on) |
| Known-good entries | `knownGood.test.ts` (`KnownGoodEntry` schema: id, category cdn/saas/corp_vpn/vuln_scanner/internal, matchType domain/ip/cidr/asn/hash-prefix, pattern, labelText; recommended **Known benign** / **Known internal** copy; create/normalize; stable id; reject invalid category/match type/empty pattern or label; CDN/SaaS starter specs build CDN cidr + SaaS domain entries; informational-label-only invariants—reject risk/verdict/malware-negative fields; composite override flag false; disclaimer copy; domain/IP/CIDR/ASN/hash-prefix match (dedicated cases for apex/subdomain/URL host, IP exactness, CIDR boundaries including /32, ASN with/without AS prefix) + badge/provenance view with category · match type · pattern summary; category enable/disable filter skips disabled categories in `findMatchingKnownGoodEntry` and restores matches when re-enabled; tray sort deprioritizes known-good below active investigation IOCs; watchlist `benign`/`internal` ↔ known-good label map + promote helper); `knownGoodStorage.test.ts` (versioned `knownGoodList` store upsert/update/delete/clear; `categoryEnabled` toggles + `listStoredKnownGoodEntriesForMatching`; export JSON allowlisted fields without secrets; import round-trip; after clear+import, listed IOC still matches and unlisted IOC does not; reject `apiKey`/`token`; reject silent verdict fields on import; add-only duplicate skip vs replace-all with confirmation; JSON/CSV import via `importKnownGoodListFromText` with required CSV columns, invalid-row rejection, secret/verdict column rejection; CDN/SaaS starter JSON parity with `examples/known-good-cdn-saas-starter.json` and on-demand import; no-network persist/import; sync entry label text on watchlist benign/internal promote); `iocLabelSession.test.ts` (`setSessionIocLabel` benign/internal syncs matching known-good `labelText`); `Options.test.tsx` (Options **Known-good lists** skip-enrich-on-match toggle default off, category toggles, entry edit/delete, **Export list JSON** handoff excludes API keys); `enrichmentHandler.test.ts` (skip outbound vendor enrich on known-good match when policy on; enrich when off; paired contract: live call blocked under skip but cached display still returned; bypassCache still blocks live under skip; same-page: listed IOC skips while unlisted/malicious IOC still live-enriches under skip policy; cache readable before skip including partial multi-source and local-backend paths; quiet mode wins over known-good skip); `enrichmentBackgroundFetch.test.ts` (domain deny still blocks SW enrich when known-good skip is on for a matching IOC); `storage.test.ts` (`skipEnrichOnKnownGoodMatch` default false + persist); `HoverCard.test.tsx` / `hoverCardOverlay.test.ts` (known-good badge + matched-entry provenance on match; View matched known-good entry Options deep-link; Enrichment skipped (known-good policy) when skip policy applies); `Popup.test.tsx` (tray row **Known benign** badge + matched-entry provenance line; known-good tray sort below investigation IOCs) |
| Notebook fragments | `notebookFragment.test.ts` (`NotebookFragment` schema: id, type observation/tag/conclusion/hypothesis, body plain text or markdown subset, createdAt, updatedAt, optional authorLabel; create/normalize; stable id; reject invalid type/empty body/inverted timestamps; body max length 8192; reject embedded binary/screenshot payloads—data-URI image/octet-stream/pdf, markdown/HTML image embeds, common raw base64 image headers, null bytes; markdown-lite parse/render for **bold**, lists, inline/fenced `code` with XSS-safe textContent DOM (raw HTML tags remain inert text); type-specific UI hints with type labels/hints and hypothesis **Unverified** status badge; allowlisted fields only); `notebookFragmentStorage.test.ts` (versioned `notebookFragments` store `schemaVersion` v4 + `updatedAt` + `fragments[]` + `iocAttachments` + `sessionAttachments` + `pageAttachments`; migrate v1–v3→v4; upsert/update/delete/list/clear/hydrate/replace; attach/detach/list by IOC key `type:normalizedValue`, investigation session id, and page scope `origin` + optional path prefix; prune dangling attachment ids; reject wrong store version and binary body payloads on normalize; no secret fields persisted); `hoverCardNotebook.test.ts` (legacy free-text analyst note migrates to an `observation` fragment on IOC notebook read when no fragments exist yet; clears legacy note after migrate; notebook panel load includes migrated observation); `workspaceSnapshot.test.ts` (map local notebook store into snapshot `notebookFragments` JSON block with scope/content/optional type; `buildCurrentWorkspaceSnapshot` merges live notebook storage with `workspaceSnapshotState` mirror; normalize accepts optional type and rejects invalid types); `Popup.test.tsx` (active investigation session **Notebook fragments** chronological timeline with text search across session fragments, inline add/edit controls and delete action; explicit empty state with text-only / no-screenshot hint when none attached; hypothesis **Unverified** badge) |
| Investigation replay | `replaySegment.test.ts` (v1 segment action catalog, timeline-event mapping including macro run id/step index/status, create/normalize, session-store ingest, stable timestamp + tie-breaker sort, segment ordering/deduplication/redaction unit coverage, multi–macro-run chronological order among other actions, secret/API-key redaction on free-text payloads, previous/next/jump step-index helpers, navigable ioc-key check, segment detail view with truncated IOC, empty-state copy, screen/video capture API forbid catalog + source-scan guards, local-storage-only persistence (no upload endpoint), user-initiated clipboard-only copy/share, markdown transcript export with expected headings plus Macro run step rows, Markdown report / Obsidian note / Analyst update shapes plus optional IOC/enrichment session-memory appendix and copy/download helpers); `replaySegment.sampleAlert.integration.test.ts` (synthetic investigation session from `examples/sample-alert.html` → ordered local replay segments + transcript headings, no live enrich); `Popup.test.tsx` (investigation replay panel mounted in popup; previous/next/jump-to-step; negative test that step-through never sends `ENRICH_IOC` and every highlight uses `NAVIGATE_TO_IOC_ANCHOR` with `enrichmentTrigger: "none"`; current-step detail for action / indicator / attribution / template; empty state when no replayable segments; copy/download markdown transcript with transcript template picker and optional memory appendix toggle); `iocTrayNavigation.test.ts` (highlight-only navigation skips live enrichment); macro runner recording covered in `commandPaletteCommands.test.ts` and `timelineEvent.test.ts` |
| Background smoke | `messageHandler.smoke.test.ts` (`npm run test:smoke`) |

Golden tests lock band mapping, vendor fixture summaries, and markdown/JSON export artifacts; update snapshots deliberately when product rules change.

Use `fixtureSecrets.ts` placeholders for API keys in tests; do not add inline `secret-key` or similar literals. Committed vendor JSON fixtures must not contain unredacted sensitive field values.

## Browser E2E (Playwright)

Playwright loads the unpacked production build (`extension/dist/`) in Chromium for smoke tests that need a real extension context. Specs live under `extension/e2e/` and share the fixture in `e2e/fixtures/extension.ts`.

### Prerequisites

- Node.js 20 (same as CI)
- Dependencies installed: `cd extension && npm ci`
- A fresh production build: `npm run build` (writes `dist/` and runs `verify:dist` / `verify:security`)

### First-time browser install

Playwright uses its own Chromium build (not the Chrome app on your machine). Install it once per machine or after upgrading `@playwright/test`:

```bash
cd extension
npm run test:e2e:install
```

On Linux (including CI), system libraries may be required:

```bash
npx playwright install chromium --with-deps
```

### Run locally

```bash
cd extension
npm run build
npm run test:e2e
```

`test:e2e` runs `verify-dist-manifest.mjs` first, then `playwright test`. The harness launches Chromium with `--load-extension` pointed at `dist/`, waits for the MV3 background service worker, and runs specs such as popup load checks in `e2e/harness.load.spec.ts`.

Optional Playwright CLI flags:

```bash
npx playwright test e2e/harness.load.spec.ts   # single spec
npx playwright test --ui                       # interactive UI mode
npx playwright show-trace test-results/.../trace.zip
```

Traces are retained on failure (`playwright.config.ts`).

### Firefox E2E smoke

Firefox has no Chromium-style `--load-extension` flag. The harness launches Playwright Firefox with a remote-debugging server, installs `dist-firefox/` as a temporary add-on over RDP, then opens `examples/sample-alert.html` over the local examples server and asserts the content-script readiness marker.

The investigation smoke seeds mocked enrichment via the examples-server bridge (pre-populated cache entries, no live vendor HTTP), scans the page, opens the hover card, checks the composite score, and runs Copy all export. Playwright Firefox E2E always runs headless because headed runs with Juggler/RDP can hang on Windows.

```bash
cd extension
npm run build:firefox
npm run test:e2e:firefox:install   # once per machine
npm run test:e2e:firefox
```

`test:e2e:firefox` runs `verify-dist-manifest.mjs --dist=dist-firefox` first, then `e2e/firefox.harness.load.spec.ts` and `e2e/firefox.scan.hover.export.spec.ts`. This smoke is local/optional today — the PR gate still runs Chromium-only `test:e2e:critical`.

### E2E layout

| Path | Role |
|------|------|
| `e2e/fixtures/extension.ts` | Persistent Chromium context loading unpacked `dist/`; registers mocked AbuseIPDB/OTX routes and a live-vendor network guard for every test |
| `e2e/fixtures/enrichmentMockRoutes.ts` | Fixture-backed vendor JSON responses, storage seed helpers, and live-request assertions |
| `e2e/fixtures/sampleAlertFixture.ts` | Fixed `sample-alert.html` IOC expectations, stable selectors, shared scan helpers |
| `e2e/fixtures/examplesServer.ts` | Local HTTP server for `examples/` pages used by browser smokes |
| `e2e/extensionPaths.ts` | Resolves `extension/dist` and `extension/dist-firefox` for fixtures |
| `e2e/fixtures/firefoxExtension.ts` | Launches headless Playwright Firefox, installs `dist-firefox/` via RDP `installTemporaryAddon` |
| `e2e/fixtures/firefoxRdp.ts` | Minimal Firefox Remote Debugging Protocol client for temporary add-on install |
| `e2e/firefox.harness.load.spec.ts` | Firefox smoke: temporary add-on load and `sample-alert.html` content-script readiness |
| `e2e/firefox.scan.hover.export.spec.ts` | Firefox smoke: scan, mocked hover enrich, and Copy all export on `sample-alert.html` |
| `e2e/fixtures/examplesFixtureBridge.ts` | Posts storage/scan commands to the content script on the local examples server (Firefox cannot open `moz-extension://` pages from Playwright) |
| `e2e/fixtures/extensionRuntime.ts` | Runs extension API calls in the Chromium MV3 service worker; Firefox uses the examples bridge instead |
| `e2e/*.spec.ts` | Browser smoke specs |
| `playwright.config.ts` | Serial workers, timeouts, CI reporters |

Browser E2E does not call live vendor APIs. The shared Playwright fixture in `e2e/fixtures/extension.ts` installs mocked AbuseIPDB/OTX HTTP responses (via the extension service worker fetch path) and aborts any other request to declared vendor hosts; each test asserts zero live enrichment network calls. Scan and tray smokes use `examples/sample-alert.html` served over HTTP with exact IOC counts and values centralized in `e2e/fixtures/sampleAlertFixture.ts`; enrich flows seed fixture API keys through the service worker when a spec needs live connector behavior.

### E2E scope and limits

Browser E2E validates Investigation Mode paths against a **real unpacked extension** in Chromium. It is a smoke layer, not full product or store certification.

**What the suite covers**

| Area | Examples |
|------|----------|
| Harness | Load `dist/`, open `popup.html`, service worker availability |
| Scan + tray | Fixed IOC set on `sample-alert.html`, popup tray listing |
| Hover card | Disclaimer, mocked multi-source composite score |
| Operator surfaces | Command palette scan, clipboard export, bulk enrich queue |
| Session + collection | Investigation session pin after tray navigation; save to collection and CSV export |

**PR gate vs full suite**

- `npm run test:e2e:critical` — subset wired in `extension/package.json` (harness, scan, tray, hover card disclaimer/score, command palette, export clipboard, enrich queue). CI runs this on pull requests.
- `npm run test:e2e` — all specs under `extension/e2e/`, including session/collection smokes not yet in the critical list. Run locally before expanding the PR gate.

**Known limits (do not expect E2E to prove these)**

| Limit | Detail |
|-------|--------|
| Browser matrix | Chromium via Playwright for the PR gate — not installed Chrome or Edge; Firefox covered only by optional `test:e2e:firefox` |
| Popup UX | Harness opens `popup.html` in a **background extension tab**, not the toolbar popup overlay; tab-focus semantics differ from manual use |
| Page coverage | Deterministic `examples/` HTML over `127.0.0.1:8765` — not arbitrary live sites or authenticated portals |
| Vendor network | No live AbuseIPDB/OTX (or other) calls in CI; mocks and an abort guard only |
| Store / signing | No Web Store submission, update channels, or extension signing flows |
| Parallelism | `playwright.config.ts` sets `workers: 1` and `fullyParallel: false` — specs assume a serial, shared browser context |
| Timeouts | 60s per test, 10s default `expect` — long enrich queues or slow machines may need local investigation, not silent timeout bumps |
| Clipboard / downloads | Validated with harness helpers; OS permission prompts and save paths may differ from manual Chrome |
| Active tab | Popup tray and some navigation helpers query the **active** tab — wrong active tab yields empty tray or missed navigation |
| Collections UI | Popup collections manager loads on mount; after saving from the hover card or tray, reload popup before export assertions |
| Manual parity | Does not replace unpacked Chrome checks in [Manual browser checks](#manual-browser-checks) below |

### Flake avoidance

Extension E2E is sensitive to build drift, tab focus, and overlay positioning. Prefer deterministic fixtures and shared helpers over ad-hoc waits.

**Before you run**

1. `cd extension && npm run build` — stale `dist/` is the most common local failure.
2. Install Playwright Chromium once per machine (`npm run test:e2e:install`; Linux CI uses `--with-deps`).
3. Run the full suite serially; do not raise `workers` or enable `fullyParallel` for extension specs.

**When authoring or fixing specs**

| Practice | Why |
|----------|-----|
| Extend `e2e/fixtures/sampleAlertFixture.ts` | Centralizes IOC counts, values, and stable selectors (`E2E_SELECTORS`, product aria labels) |
| Use `expect.poll` for scan counts, scores, and session text | MV3 messaging and React updates are async |
| Keep mocked enrichment | Use `setupCiEnrichmentMocks` (global fixture) plus `seedEnrichmentMockStorage` / `seedExportSmokeStorage` when a spec needs keys or export-only paths — never call live vendor hosts |
| Serve fixtures over HTTP | Use `startExamplesServer()` so content scripts match production `http(s)://` origins |
| Preserve content tab focus | Call `contentPage.bringToFront()` before popup tray assertions if another step focused a different tab |
| Popup tray → page navigation | When popup runs as its own tab, clicking tray rows targets the wrong active tab; send `NAVIGATE_TO_IOC_ANCHOR` to the content tab via the service worker (see `runPopupTrayNavigationOnContentTab`) |
| Hover card save actions | Fixed-position overlay controls can sit outside Playwright’s clickable viewport; use in-page `evaluate` clicks for save-to-collection toggles when needed |
| Collections export | After creating a collection from the hover card or tray, `reload` the popup page before using the collections manager export buttons |
| Avoid bare `sleep` | Rely on Playwright auto-wait, `waitFor`, and `expect.poll` |
| Match export filenames loosely | Assert slug/date **patterns**, not wall-clock timestamps baked into downloads |
| Clean up pages | Close content and popup pages in `finally` blocks so tabs do not leak between specs |

**When a smoke fails**

1. Rebuild `dist/` and rerun the single spec: `npx playwright test e2e/<spec>.spec.ts`.
2. Open the retained trace from `test-results/.../trace.zip` (`npx playwright show-trace ...`).
3. Confirm no unexpected live vendor requests — the shared fixture fails the test if enrichment hosts are hit without mocks.
4. If the failure is tab-focus or overlay positioning, check the practices above before increasing timeouts.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `dist/manifest.json missing — run npm run build first` | Run `npm run build` in `extension/` before `npm run test:e2e`. |
| Playwright cannot find Chromium | Run `npm run test:e2e:install` (Linux: add `--with-deps` as above). |
| Extension id / service worker timeout | Rebuild `dist/`; confirm `background.js` is present and `npm run verify:dist` passes. |
| Popup tray empty or missing IOC rows | Ensure the content fixture tab is active (`bringToFront`) before opening or asserting popup tray results. |
| Hover card click times out (outside viewport) | Scroll is unreliable on fixed overlays; use in-page `evaluate` to activate save-to-collection controls. |
| Collection export button missing | Reload popup after saving a collection from another surface so the collections manager refetches storage. |
| Intermittent pass locally, fail in CI | Run `npm run test:e2e:critical` on a clean `npm ci` + `npm run build`; inspect trace; do not add live vendor calls. |

## Security verification

```bash
cd extension
npm run verify:security
npm run verify:security:firefox   # after npm run build:firefox
```

Runs after `npm run build` via `postbuild` on `dist/`. The Firefox build runs the same checks on `dist-firefox/` via `verify:security:firefox`. Checks extension-page CSP posture (no remote assets in popup/options HTML, no weakened manifest CSP), absence of common analytics/crash-reporting hosts in production bundles (host tokens must not match identifier prefixes such as `segment.iocKey`), live fetch limited to connector hosts, no sensitive production logging (keys, bulk IOCs, raw vendor payloads), no `eval`, and no API key logging. See [docs/security-model.md](../security-model.md).

## Manual browser checks

Automated tests do not replace unpacked Chrome validation:

1. `npm run build` and load `extension/dist/`.
2. Serve `examples/` over HTTP (`python -m http.server` in `examples/`).
3. Scan `sample-alert.html`, `sample-splunk-export.html`, or `sample-security-onion-alert.html`; enrich with test keys, verify overlay score and cache labels. Fixture intent and checklist: [docs/soc-validation-fixtures.md](../soc-validation-fixtures.md).

Use redacted fixtures only in issues and PRs.

## CI

GitHub Actions workflows under `.github/workflows/` run lint, unit tests, production dependency audit (`npm run audit:prod`), a non-blocking full `npm audit` report for devDependencies, Gitleaks secret scanning on pull requests and pushes to `main`, a `browser-e2e-smokes` job in `extension-quality.yml` on every pull request that builds `dist/`, installs Playwright Chromium, and runs `npm run test:e2e:critical`, and a `firefox-artifact` job in the same workflow that builds both `dist/` and `dist-firefox/` (`npm run build` then `npm run build:firefox`) and uploads the Firefox unpack directory as a workflow artifact. A failing critical smoke fails the job and the pull request workflow; enable **browser-e2e-smokes** as a required status check on the default branch to block merge. Manual workflow runs can set **Skip browser E2E smokes** when quota-sensitive; pull request checks always run the smokes. Live vendor APIs are not called in CI.

Local secret scan (same config as CI):

```bash
gitleaks detect --source . --config .github/gitleaks.toml
```

Repository root `.env.example` lists optional environment variables with empty credential placeholders; copy to `.env` locally (never commit populated `.env` files). `npm run verify:security` fails if credential keys in `.env.example` include values.

Production dependencies (`react`, `react-dom`) and `vitest` use exact versions in `extension/package.json`; bump them together with `package-lock.json` when addressing advisories.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR expectations
- [SECURITY.md](../../SECURITY.md) — reporting vulnerabilities (not public issues)
