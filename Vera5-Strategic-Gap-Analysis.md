# Vera5 Strategic Gap Analysis (Read-Only)

Analysis based on `TODO.md`, `Vera5.md`, `Product-Vision.md`, `README.md`, `docs/`, `extension/` implementation (~463 unit tests), `examples/`, `.github/workflows/`, and governance files. No files were modified.

---

## 1. Executive Summary

- **Shipped core is real and strong** for an MVP extension: IOC detection, highlights, vanilla hover overlay, parallel AbuseIPDB + OTX enrichment, cache/TTL, rate-limit cooldown, multi-source UI, pivots, settings export/import, scoring module, and solid unit-test coverage.
- **Largest product gap:** Week 8 scoring exists in React/tests but is **not mounted in the production content-script hover card**; README still says composite scoring is unsupported—operators cannot get the MVP’s promised “explainable composite score” in daily use.
- **Documentation drift is an adoption risk:** `CONTRIBUTING.md` still claims detection/connectors are unimplemented; `SECURITY.md` documents per-type IOC toggles that are **not wired** in options or the detector (storage schema only).
- **TODO is execution-heavy but product-thin** on operator ergonomics: no scan summary / IOC tray, no selection-based enrich, no context menu, no “query vendor now?” consent UX, no investigation history, no source health dashboard.
- **Many USER validation checkboxes remain open** (Weeks 6–8, global MVP acceptance)—the roadmap advances AGENT tasks faster than real-operator proof.
- **Vision docs (`Vera5.md`, `Product-Vision.md`) overshoot TODO** by 2–3 years: VT/Shodan/MISP/LLM/email/ASN paths are aspirational while MVP is still finishing scoring, export, and SOC fixtures.
- **Third/fourth live connectors (URLScan, GreyNoise) are deferred** with toggles only—vision lists them as near-term; operators still tab-hop for URL noise context.
- **Detection surface is narrow** (visible text only, no attributes)—hurts Splunk/Kibana/ticket UIs where IOCs live in `href`, table cells, or JSON blobs.
- **Export + case-note workflow (Week 9) is critical for stickiness** and is not started; without markdown/JSON + local notes, Vera5 stays a “peek tool” not a “case artifact tool.”
- **Trust features are under-roadmapped:** sensitive-domain defaults, pre-query disclosure, key-rotation reminders, malicious-page hardening, and Chrome Web Store privacy narrative need explicit tasks before public launch.
- **No browser E2E layer**—only Vitest/happy-dom; regression risk on overlay, keyboard, and MV3 service worker lifecycle.
- **Post-MVP backend (Week 13+) is well placed** but should not distract until overlay parity, export, and Week 10 SOC fixtures land.
- **Highest-impact near-term adds:** (1) RiskScore in overlay + README sync, (2) scan summary / IOC list panel, (3) export to markdown, (4) per-type IOC + cache TTL in options UI, (5) selection enrich + context menu, (6) URLScan/GreyNoise live connectors, (7) trust UX pack, (8) Firefox port as post-MVP track item.

---

## 2. Current Product Assessment

### What Vera5 already does well

| Area | Assessment |
|------|------------|
| **Governance & hygiene** | Locked BYOK, no telemetry, IOC-only queries, write allowlists, acceptance checklists—unusually disciplined for an OSS extension. |
| **Detection quality** | Conservative regex, overlap dedupe, script/style/textarea skips, fixture-driven tuning, decoy coverage in `examples/`. |
| **Enrichment architecture** | Service-worker fetch, parallel `allSettled`, per-source errors, cache keying, bypass refresh, global 429 cooldown—production-minded. |
| **Transparency** | Source badges, raw JSON (redacted), cached vs live, disagreement logic in `scoring.ts`, disclaimer copy. |
| **Testing** | Broad unit/golden tests for connectors, cache, scoring bands, messages, boundaries. |
| **Docs (subset)** | `api-integrations.md`, `analyst-workflows.md`, `security-model.md` are product-native and useful. |

### Unusually strong

- **Honest partial-success UX** (one vendor fails, others remain visible).
- **Manual-only default** aligned with classified/SOC workflows.
- **Settings export without keys by default**—rare and trust-building.

### Underdeveloped

- **Production UI path** (`hoverCardOverlay.ts`) lags React `HoverCard.tsx` / `RiskScore.tsx`.
- **Popup** is minimal (enable, highlight, scan count)—no IOC inventory or triage queue.
- **Options** lack per-type IOC toggles, cache TTL controls, domain policies (despite storage/schema support for some).
- **Pivot matrix** is static links only—no live VT/GreyNoise/URLScan despite vision prominence.
- **Operator validation** backlog in `_DevNotes` and open USER tasks.

### What could block adoption

1. **README/implementation mismatch** on scoring.
2. **No export to tickets** (Week 9 not done).
3. **SIEM/dashboard pages** where IOCs aren’t in plain text nodes.
4. **Stale contributor docs** → wasted PRs and mistrust.
5. **Broad `host_permissions`** without compensating trust UX (query consent, domain denylist).
6. **Chrome-only, unpacked-only** until Week 12 store prep.

---

## 3. Top 25 Roadmap Additions

| # | Name | Why it matters | User impact | Placement | Complexity | Risk | Horizon | In TODO? |
|---|------|----------------|-------------|-----------|------------|------|---------|----------|
| 1 | **Risk score in content overlay** | MVP promises explainable score; code exists but not shown in browser | Analysts see label, tooltips, disagreement on real pages | Insert before W8 D7 / immediate | Medium | Low | MVP | Partial (W8 UI tasks done in React only) |
| 2 | **README + public docs sync for scoring** | Trust breaks when docs deny shipped behavior | Accurate expectations | W8 README pass | Low | Low | MVP | Yes (recurring pass) |
| 3 | **Scan summary / IOC tray** | Daily use needs “what did we find?” without clicking each highlight | Faster triage on alerts with 10–50 IOCs | New: between W9–W10 | Medium | Low | MVP | **No** |
| 4 | **Markdown + JSON export (card actions)** | Case notes are the sticky surface | Paste into Jira/TheHive/Obsidian | W9 (planned) | Medium | Low | MVP | Yes |
| 5 | **Per-IOC-type toggles in options** | Reduce noise on blogs vs alerts | Fewer false positives | W4 gap / new W8.5 day | Low | Low | MVP | Mentioned in arch, not tasked |
| 6 | **Cache TTL in options UI** | Power users tune quota vs freshness | Control cost/latency | W7 extension | Low | Low | MVP | **No** (storage exists) |
| 7 | **Selection-based enrich** | Analysts highlight text in tickets | Enrich without full page scan | W10 partial | Medium | Medium | Post-MVP | Partial (W10 manual scan) |
| 8 | **Context menu: “Enrich with Vera5”** | Standard extension affordance | Right-click from any selection | New operator week | Medium | Low | Post-MVP | **No** |
| 9 | **Pre-query vendor disclosure** | Enterprise trust / informed consent | Modal or inline “sending X to AbuseIPDB” | New trust week | Medium | Low | MVP | **No** |
| 10 | **Domain allow/deny for auto-scan** | Prevent accidental enrichment on webmail/HR | W10 planned | W10 | Medium | Medium | MVP | Yes |
| 11 | **URLScan.io live connector** | URL-heavy triage still tab-hops | URL/domain context in-card | Post W6 (arch order #3) | High | Medium | Post-MVP | Deferred in W6 |
| 12 | **GreyNoise community live connector** | Noise vs malicious for internet IPs | Better IPv4 interpretation | Post W6 (arch order #4) | Medium | Medium | Post-MVP | Deferred |
| 13 | **SOC dashboard HTML fixtures** | Prove value on Splunk/Kibana exports | Week 10 goal | W10 | Medium | Low | MVP | Yes |
| 14 | **Source health / quota panel** | Analysts manage API budget | Remaining quota hints, last error | New ops week | Medium | Low | Post-MVP | **No** |
| 15 | **Investigation history (local)** | “What did I look at today?” | Re-open recent IOCs without rescan | New stickiness week | Medium | Medium | Post-MVP | **No** |
| 16 | **Connector interface + registry** | 3rd source adds shouldn’t fork patterns | Maintainer velocity | Arch hardening | Medium | Low | Post-MVP | Implicit only |
| 17 | **Export schema versioning** | Integrations need stable JSON | W9 planned | W9 | Low | Low | MVP | Yes |
| 18 | **Browser E2E smoke (Playwright)** | MV3 + overlay regressions | Release confidence | W11–W12 | High | Medium | MVP | **No** |
| 19 | **Keyboard: next/prev IOC on page** | Power-user speed | Triage without mouse | W10 a11y partial | Medium | Low | Post-MVP | Partial |
| 20 | **Attribute / `href` IOC extraction (opt-in)** | SIEM tables hide IOCs in attributes | Detection on real dashboards | New detection week | High | High | Long-term | **No** |
| 21 | **Firefox MV3 port** | CTI community uses Firefox | Wider adoption | Post W12 track | High | Medium | Long-term | Mentioned, not weeked |
| 22 | **Onboarding wizard (keys + test page)** | First-run drop-off | Keys saved, one successful enrich | W12 polish | Medium | Low | MVP | **No** |
| 23 | **Team settings packs (export/import profiles)** | Optional team use without SaaS | Share toggles, not keys | Post-MVP enterprise | Medium | Medium | Long-term | Partial (export exists) |
| 24 | **VirusTotal connector (flagged)** | Vision default; high licensing complexity | Hash/IP enrichment | W14 | High | High | Long-term | Yes |
| 25 | **RDAP/WHOIS pivot + optional enrich** | Domain triage staple | Ownership context | New intel week | Medium | Medium | Long-term | Pivots only today |

---

## 4. Missing Daily-Use Features

| Feature | Why operators would open Vera5 repeatedly |
|---------|-------------------------------------------|
| **IOC tray after scan** | Review all findings on dense alert pages in one panel; sort by type/risk. |
| **One-click “copy all IOCs” / export block** | Paste into ticket without per-click hover. |
| **Recent lookups list** | Return to indicators from earlier in the shift. |
| **Pinned / watched IOCs** | Track 3–5 hot indicators across tabs (local only). |
| **Bulk enrich selected subset** | Queue 5 IPs with quota awareness—not 50 blind fetches. |
| **Keyboard-driven triage** | Scan → next IOC → enrich → copy markdown → next. |
| **Risk label visible in overlay** | Glanceable severity without reading two vendor summaries. |
| **“Same as last time” cache affordance** | Stronger visual when case reopened within TTL. |
| **Quick pivot strip on highlight** | Middle-click VT/OTX without opening full card. |
| **Case ID tag on notes** (local) | Tie exports to ticket reference. |

Currently Vera5 is optimized for **single-IOC hover** workflows, not **alert-wide** or **shift-long** workflows.

---

## 5. Missing Trust and Safety Requirements

| Gap | Detail |
|-----|--------|
| **Pre-enrichment consent UX** | No explicit “this will contact AbuseIPDB with value X” step; enterprise buyers expect it. |
| **Sensitive site defaults** | Week 10 allowlist planned; no default deny for `mail.*`, banking, health, internal HR patterns. |
| **Per-type toggles documented but not implemented** | `SECURITY.md` / `architecture.md` claim controls that options/detector don’t enforce. |
| **Key rotation / expiry reminders** | No local “key age” or “test key” nudge. |
| **Malicious page DOM attacks** | Week 11 threat scenarios partial; need overlay clickjacking, fake highlight, prototype pollution review. |
| **Storage encryption at rest** | Chrome `storage.local` is not encrypted; document limit + optional OS profile guidance. |
| **Clipboard exfil awareness** | Copy actions could land in shared clipboards; optional clear-after-copy. |
| **Export with keys opt-in** | Exists—needs stronger UI warning when enabled. |
| **Quota burn guardrails** | Cooldown after 429; missing “you are about to fire N parallel requests” for bulk future. |
| **Extension update supply chain** | CI secret scan exists; missing pinned lockfile policy, SBOM, signed releases (Week 11 partial). |
| **Chrome Web Store single-purpose narrative** | Week 12 draft—not yet tied to data-flow diagram for reviewers. |

---

## 6. Missing Operator UX Improvements

| Area | Current state | Gap |
|------|---------------|-----|
| **Hover card** | Vanilla DOM overlay; disclaimers added | No `RiskScore` block; dense on small screens |
| **Keyboard** | Scan shortcut only | No focus trap, no card navigation shortcuts |
| **Context menu** | None | No selection enrich |
| **Command palette** | None | Power users want fuzzy actions |
| **Popup** | 3 toggles + scan count | No IOC list, no last error, no cooldown timer |
| **Bulk IOC table** | None | Critical for CTI reports |
| **Source health** | Per-row errors only | No global “OTX degraded today” |
| **Rate-limit visibility** | Retry hint on card | No popup-level cooldown banner |
| **Accessibility** | Some ARIA | Week 10 keyboard path incomplete |
| **Export from card** | Copy value only | Week 9 markdown/JSON pending |

**Architectural UX debt:** Two UI stacks (React components vs `hoverCardOverlay`) guarantee drift unless unified or overlay generated from shared render helpers.

---

## 7. Missing Intelligence / Enrichment Capabilities

| Capability | Status |
|------------|--------|
| **Live VT / Shodan / Censys / ThreatFox** | Vision + pivots; not in MVP TODO until W14+ |
| **URLScan / GreyNoise live** | Toggles + pivots; deferred post-OTX/AbuseIPDB |
| **AbuseIPDB on hashes** | IPv4 only for live AbuseIPDB |
| **Cross-source normalization** | Summary strings; no unified object model (ASN, geo, malware family) |
| **First-seen / last-seen** | Not tracked locally across sessions |
| **Relationship graph** | No “related pulses” expansion beyond OTX summary line |
| **ATT&CK / malware family** | Vision Phase 3; not roadmapped in weeks 1–16 |
| **RDAP/WHOIS** | Not in pivots or connectors |
| **Infrastructure clustering** | Out of scope (correct) |
| **Noise vs malicious (GreyNoise)** | Critical for internet IPs; still pivot-only |
| **Defanged IOC variants** | URL defang supported; email/hxxp variants partial |
| **Scoring inputs** | Regex on summary text only—fragile if vendor copy changes |

**Disagreement UX:** Logic exists in `scoring.ts` + React `RiskScore`; operators on overlay see disclaimer text but not the callout UI.

---

## 8. Missing Architecture Improvements

| Topic | Gap |
|-------|-----|
| **UI single path** | Merge RiskScore/disagreement into overlay or shared DOM builder. |
| **Connector SDK** | `abuseipdbConnector.ts` / `otxConnector.ts` patterns not formalized (interface, mocks, capability matrix). |
| **Normalized enrichment schema** | Ad-hoc summaries; Week 9 JSON export should define `schemaVersion`. |
| **Storage migrations** | Settings keys evolve; no versioned migration runner. |
| **`iocTypeEnabled` dead schema** | Stored but detector ignores—technical debt. |
| **Service worker lifecycle** | Long enrichment + tab close edge cases; needs E2E |
| **Cache size / IndexedDB** | `chrome.storage` limits; large raw JSON may hurt; max-size guard tested but operator visibility weak |
| **Content script performance** | 2,500 node cap documented; no adaptive scan for SPAs |
| **Backend folder** | Planned Week 13; repo has zero `backend/`—fine, but extension shouldn’t assume it |
| **Testing** | No Playwright; no contract tests against vendor OpenAPI |
| **Release** | `version: 0.0.0`; no `CHANGELOG.md`; package script Week 12 |
| **Firefox / Edge** | Chromium-only manifest assumptions |

---

## 9. Missing Documentation and OSS Growth Work

| Item | Status |
|------|--------|
| **CONTRIBUTING.md** | **Stale** (“detection not implemented”) |
| **CHANGELOG.md** | Missing |
| **Issue/PR templates** | Week 12 only |
| **Screenshots / demo GIF** | Week 12; none in README |
| **Good-first-issues** | Not curated |
| **Analyst recipes** | `analyst-workflows.md` good; missing Splunk/Jira-specific recipes |
| **`docs/roadmap.md`, `docs/screenshots.md`** | In `Vera5.md` tree; **not present** |
| **Public positioning** | Strong vision docs; README honest but lags scoring |
| **Third-party notices** | Week 12 |
| **Codecov / coverage badge** | Optional |
| **Discord/community** | Not mentioned—may be intentional |

**Discoverability:** GitHub topics, demo video, and “compare to X” positioning are absent—important for OSS adoption.

---

## 10. Conflicts and Misalignments

| Conflict | Evidence |
|----------|----------|
| **Scoring: built vs documented vs shipped** | `scoring.ts` + `RiskScore.tsx` exist; README says not supported; overlay has no risk UI. |
| **MVP acceptance vs Week 8 progress** | Global MVP criteria still largely unchecked while scoring tasks marked done. |
| **SECURITY/arch vs options** | Per-type toggles documented; no UI; detector doesn’t read `iocTypeEnabled`. |
| **CONTRIBUTING vs reality** | Claims pre-implementation state. |
| **Product-Vision source list vs TODO** | Vision lists 10+ sources; MVP locks two live + deferred URLScan/GreyNoise. |
| **Vera5.md AI summary vs NON-GOALS** | Optional local LLM in vision; TODO Week 16—must stay opt-in; risk of “black box” perception if poorly scoped. |
| **React HoverCard vs overlay** | Tests cover React path; users get overlay path. |
| **USER task backlog** | Many Weeks 6–7 USER items open while Week 8 AGENT tasks complete—validation debt. |
| **`ideas.md` duplicate of Vera5.md`** | Maintenance burden; risk of drift. |

---

## 11. Suggested TODO.md Additions (Proposed Only — Do Not Edit)

### Phase suggestion: **MVP completion buffer (insert after Week 8, before Week 9)**

**Description:** Close the gap between implemented scoring/React UI and the production hover overlay; align public docs with behavior.

**Out of scope:** New connectors; ML scoring.

| Day | Tasks |
|-----|--------|
| 1 | Mount composite risk label, per-source chips, disagreement callout in `hoverCardOverlay` (AGENT) |
| 2 | Shared render helpers or DOM builder used by overlay + React to prevent drift (AGENT) |
| 3 | Overlay tests for risk/disagreement/disabled-sources (AGENT) |
| 4 | README + `analyst-workflows.md` scoring section (AGENT) |
| 5 | USER SOC triage on `sample-alert.html` including visible risk label (USER) |
| 6 | Acceptance `docs/acceptance/W8_7_1.md` completion (AGENT/USER) |
| 7 | Score fixture parity checklist (AGENT) |

**Validation:** Overlay shows Unknown–Critical with disagreement; README accurate; USER sign-off.

---

### **Week 8.5 — Operator surface: scan summary (Post-MVP or late MVP)**

**Description:** Popup or side panel listing IOCs found on current tab; filter by type; open card from list.

**Out of scope:** Cross-tab sync.

- Day 1: Data model from last scan result (AGENT)
- Day 2: Popup panel UI (AGENT)
- Day 3: Click row → open hover card at highlight (AGENT)
- Day 4: Copy-all / copy-filtered (AGENT)
- Day 5: Tests (AGENT)
- Day 6: USER triage on `sample-alert.html` with 10+ IOCs (USER)
- Day 7: Acceptance checklist (AGENT/USER)

---

### **Week 9.5 — Trust and query transparency (MVP hardening)**

**Description:** Analyst-visible controls before vendor queries; domain policies for auto-scan.

**Out of scope:** Enterprise SSO.

- Day 1: “About to query” inline notice or first-run preference (AGENT)
- Day 2: Domain denylist/allowlist wired to auto-scan + optional enrich (AGENT)
- Day 3: Default sensitive-domain suggestions in docs (AGENT)
- Day 4: Options UI for lists (AGENT)
- Day 5: Tests (AGENT)
- Day 6: USER validates on webmail + SOC fixture (USER)
- Day 7: Security checklist update (AGENT/USER)

---

### **Week 10.5 — Settings completeness (MVP)**

**Description:** Expose storage schema already partially built.

- Day 1: Per-IOC-type toggles in options + detector respect (AGENT)
- Day 2: Global and per-source cache TTL in options (AGENT)
- Day 3: `includePrivateIpv4` in options (AGENT)
- Day 4: Tests + README (AGENT)
- Day 5: USER validation (USER)

---

### **Week 17 — Firefox MV3 port (Post-MVP)**

**Description:** Port extension; `browser.*` polyfill; store-agnostic packaging.

**Out of scope:** Safari.

- Days 1–5: manifest, build target, smoke tests (AGENT)
- Day 6–7: USER load temporary add-on (USER)

---

### **Week 18 — Browser E2E harness (Post-MVP)**

**Description:** Playwright against unpacked extension; scan → enrich → export smoke.

- CI job on PR (AGENT)
- Fixture pages in `examples/` (AGENT)

---

## 12. Things NOT To Add

| Idea | Why reject or defer |
|------|---------------------|
| **Vera5-hosted enrichment proxy** | Violates BYOK/local-first locked principles. |
| **Shared team API keys in cloud** | Same; becomes SaaS CTI. |
| **Default telemetry / product analytics** | Violates non-negotiables unless opt-in governance added. |
| **Full-page or ticket upload to Vera5** | Violates IOC-only model. |
| **Black-box ML risk score** | Violates explainability; locked non-goal. |
| **Auto-block / EDR response actions** | SOAR/EDR sprawl. |
| **Built-in sandbox detonation** | Sandbox non-goal. |
| **SIEM replacement dashboards** | SIEM non-goal. |
| **MISP/OpenCTI write-back in MVP** | Platform sprawl; keep read-only pivots later. |
| **Mandatory LLM summaries** | Trust and hallucination risk; keep Week 16 opt-in localhost only. |
| **Browser history database** | Privacy creep; investigation history should be IOC-scoped and clearable only. |
| **Cryptocurrency wallet auto-trading / blocklists** | Off-mission. |
| **Dark-web crawling** | Non-goal. |
| **Chrome extension crypto miner “threat checks”** | Scope creep. |

---

## 13. Final Recommendation

### Add immediately (before treating Week 8 as “done”)

1. **RiskScore + disagreement in `hoverCardOverlay`** — closes MVP pillar “basic composite score with source basis.”
2. **README maintenance pass for Week 8** — remove “scoring not supported”; document bands and disagreement honestly.
3. **Complete open USER validations** (Weeks 6–8) — without them, roadmap checkboxes are fiction.
4. **Wire `iocTypeEnabled` or remove from docs/schema** — pick one; silence is worse than absence.

### Defer (post-MVP, but plan explicitly)

- URLScan + GreyNoise **live** connectors (high daily-use value).
- Scan summary / IOC tray.
- Selection enrich + context menu.
- VT/Shodan (licensing + quota complexity).
- Local FastAPI backend (Week 13)—only for users who need centralized keys on a jump box.
- Local LLM summaries (Week 16)—strictly opt-in, enrichment-JSON-only input.

### Cut or shrink

- **Duplicate mega-docs:** consolidate `ideas.md` / `Vera5.md` maintenance or mark one archival.
- **Recurring README 4-pack every week** — collapse to one checklist item post-Week 12 to reduce checkbox noise.
- **Vision doc feature lists in operator-facing paths** — keep aspirational content out of install docs.

### Validate with real users first

1. **SOC analyst on exported Splunk/HTML alert** (Week 10 fixture goal)—does detection find IOCs without breaking layout?
2. **CTI researcher on long blog**—false positive rate vs speed.
3. **“Would you paste export into ticket?”** — validates Week 9 priority over new connectors.
4. **Trust question:** “Do you understand what left the browser?” — validates query-transparency UX before store submission.

---

### Roadmap strategy in one paragraph

Finish the **MVP loop**: detect → scan summary (optional but high leverage) → enrich with attributed multi-source data → **visible explainable score** → **export to case notes** → trust controls → SOC fixtures → security/CI → OSS launch. Expand sources and Firefox only after daily-use proof. Keep the product a **thin, honest context layer**—not a platform. The biggest current failure mode is not missing VirusTotal; it is **shipping scoring in tests while operators still see a pre-scoring hover card and a README that denies scoring exists.**

---

**Analysis mode:** Read-only; no repository files were modified.
