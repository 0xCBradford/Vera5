# TODO.md — Vera5 IOC Enrichment Extension

**FILE ROLE (LOCKED):** tasks + statuses only. No narrative essays inside this file beyond week **Description** contracts.  
**This file is the single execution source of truth for building Vera5.**

**Product reference (context only, not tasks):** `Vera5.md` / `ideas.md` — analyst-first, local-first, open-source browser extension for IOC enrichment.

---

## STATUS LEGEND

- [x] Done
- [ ] Not started

**Task suffix:** every task line ends with **(AGENT)**, **(USER)**, or **(AGENT/USER)** — who implements and/or who must validate (often browser load, API portal, or store).

**Correctness over checkbox count:** Fewer lines per day is acceptable if every obligation stays explicit (security, rate limits, cache, attribution, negative paths).

---

## NORTH STAR (LOCKED)

By **Week 12**, Vera5 is a **public open-source** Chromium extension that lets SOC, CTI, DFIR, and threat-hunting analysts **hover IOCs on real investigation pages** and see **fast, attributed, privacy-conscious enrichment** from **bring-your-own API keys** — with **no Vera5 cloud**, **no telemetry**, and **no full-page uploads**.

Long-term: optional local FastAPI backend, Firefox port, advanced IOC types, optional local LLM summaries — **after** MVP trust is proven.

---

## PRODUCT SCOPE (LOCKED)

**Vera5 is:**

- Open-source browser extension (Chrome/Chromium first)
- Local-first IOC detection on webpages
- Hover-card enrichment from external threat-intel APIs (user keys)
- Pivot links, copy/export, cache, source badges, honest error states
- Manual-only mode and per-source toggles

**Primary users:** SOC triage, CTI research, DFIR review, malware-analysis notes, dashboard-heavy workflows (Splunk, Security Onion, Kibana, tickets, reports).

**Core transformation:** `Webpage IOC → Attributed enrichment card → Analyst pivot/export`

---

## NON-GOALS (LOCKED)

Vera5 is **not**:

- A SIEM, SOAR, EDR, sandbox, vuln scanner, or dark-web crawler
- A replacement for MISP, OpenCTI, VirusTotal, or analyst judgment
- A hosted SaaS with accounts, billing, or team workspaces (MVP)
- A black-box “AI risk engine” that hides source disagreement
- A product that uploads browsing history, full pages, tickets, or session tokens to Vera5 infrastructure

---

## NON-NEGOTIABLES (LOCKED)

1. **Secrets never in git** — API keys, tokens, `.env`, `.env.*`, and local credential files are **never committed** (enforced in `.gitignore`, CI secret scan, and review).
2. **No default telemetry** — no analytics SDK, crash reporter, or usage beacon unless a future task explicitly adds opt-in, documented telemetry (default remains off; MVP has none).
3. **IOC-only queries** — external APIs receive **indicator values the analyst triggered**, not full page HTML (unless a future explicit “selection-only” feature says otherwise).
4. **Source attribution** — every enrichment field shows **which connector** produced it; disagreements remain visible.
5. **Rate limits and caching** — respect vendor limits; cache with TTL; show **cached vs live**.
6. **Extension security** — minimal Manifest V3 permissions; no remote code; supply-chain hygiene in CI.
7. **Local-first MVP** — extension works without any Vera5-operated backend; optional user-operated localhost/self-hosted backend is post-MVP.
8. **Honest errors** — missing keys, 401/403, 429, timeouts shown clearly; no fabricated scores.
9. **MVP before platform sprawl** — Chrome + core IOC types + 2+ sources before MISP/OpenCTI/LLM backend.
10. **Open source from day one** — LICENSE, SECURITY.md, CONTRIBUTING.md, and reproducible build before public announcement.

---

## BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) GOVERNANCE (LOCKED)

Vera5 is permanently BYOK/BYOA.

Vera5 must never:

- host shared third-party API keys
- proxy vendor enrichment traffic through Vera5-owned infrastructure by default
- pool user API quotas
- resell threat intelligence API access
- require Vera5-managed accounts for enrichment
- transmit stored user API credentials to Vera5-controlled servers
- silently relay IOC queries through maintainer infrastructure

All enrichment credentials are:

- user-owned
- user-supplied
- locally stored
- user-controlled

Optional local backend modes must remain localhost/self-hosted by default unless a future governance decision explicitly changes product direction.

---

## DEV/ROADMAP HYGIENE (LOCKED)

**Core rule:** Internal execution scaffolding is allowed **only** inside:

- `TODO.md`
- `Task_Prompt.txt`
- `docs/TODO_TASKS_Prompts.md`
- `Reqd_User_Config.txt` (manual user-setup tracking only)

It must **never** appear in:

- source code
- code comments
- filenames
- folder names
- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- public documentation
- UI text
- extension copy
- package metadata
- manifest descriptions
- generated examples
- release notes
- screenshots/docs captions

**Forbidden public leakage examples (non-exhaustive):**

- Week 0, Week 1, Week X
- Day 1, Day 2, Day X
- Task 1, Task 2, Task X
- AGENT, USER, AGENT/USER markers
- Cursor notes, Claude notes, AI-generated notes
- roadmap task, implementation task, TODO task, build task
- execution report, verification report, prompt protocol, internal governance
- placeholder names based on roadmap sequencing

**Required behavior:**

- Public-facing files describe **finished product behavior**, user usage, architecture, security, contribution process, and extension operation.
- Internal build process remains **invisible** to users, contributors, recruiters, and extension reviewers.
- Tasks that require public documentation must be written in **product-native language**, not roadmap-native language.
- Source comments explain **technical reasoning only**, never the roadmap task that caused the code.
- File and folder names are **product/domain-based**, not roadmap/task-based.
- Release notes describe **shipped capability**, not how Cursor/AI built it.
- Acceptance checklists under `docs/acceptance/` may use internal week/task references **only** as intentionally internal artifacts; they must **not** be linked or presented as public user docs.

**Every execution run** must enforce this via `Task_Prompt.txt` and `docs/TODO_TASKS_Prompts.md` before edit, during edit, and at verification.

---

## README MAINTENANCE (LOCKED — RECURRING)

**Mandatory every development week** (once, near end of week, before Day 7 sign-off):

`README.md` is public product documentation. It must evolve with the build and never drift stale, misleading, or ahead of implemented behavior.

**Recurring task pattern (each week):**

### README maintenance pass (recurring)

- [ ] **README.md accuracy pass** — update `README.md` for capability **shipped through that week only**: current architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated steps, speculative future features, marketing fluff, and claims that exceed what exists in the repo (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** — no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol references, or internal governance scaffolding (AGENT)
- [ ] **README validation** — setup/install instructions still work; documented feature list matches implemented functionality; refresh or remove screenshots if UI changed that week (AGENT/USER)

**Forbidden in README:** roadmap leakage, AI-build notes, internal execution scaffolding, placeholder “coming soon” sections for unbuilt features, exaggerated capability claims.

---

## PRODUCT PILLARS (LOCKED)

| Pillar | Meaning |
|--------|---------|
| **Speed** | Hover enrichment faster than tab-churn pivots |
| **Trust** | Attribution, raw inspect, no false certainty |
| **Privacy** | Analyst owns data; BYO keys; no silent collection |
| **Portability** | Copy markdown/JSON; pivot deep-links |
| **Lean ops** | No mandatory cloud; cheap to run for maintainers |

---

## MVP SURFACE (LOCKED)

**MVP includes:**

- Manifest V3 extension (Chrome unpacked → store-ready)
- IOC types: IPv4, domain, URL, MD5, SHA1, SHA256, CVE
- Highlight/underline + hover card + manual enrich trigger
- Static pivot links + at least **two** live API sources (e.g. AbuseIPDB + OTX)
- Options: API keys (masked), source toggles, manual-only mode, cache clear
- Local cache with TTL; cached/live label
- Basic composite score with **source basis** (not hidden)
- Examples + docs + SECURITY.md
- CI: lint, test, secret scan

**MVP excludes:**

- Firefox store release (later)
- MISP / OpenCTI / TheHive connectors
- Local FastAPI backend (Week 13+ track)
- Local LLM summaries
- Phase 2+ IOC types (email, ASN, wallets, etc.)
- Telemetry or accounts

---

## ARCHITECTURE PHASES (LOCKED)

| Phase | Focus | Target |
|-------|--------|--------|
| **A — Foundation** | Repo, extension scaffold, hygiene, protocol | Week 0–1 |
| **B — Detection & UI** | Regex engine, highlight, hover shell | Week 2–3 |
| **C — Settings & privacy** | Storage, keys, toggles, threat model docs | Week 4 |
| **D — Enrichment** | Connectors, normalize, multi-source card | Week 5–6 |
| **E — Operations** | Cache, rate limits, scoring, export | Week 7–9 |
| **F — Analyst workflows** | SOC pages, allowlist, performance | Week 10 |
| **G — Hardening & OSS** | CI security, acceptance, GitHub release | Week 11–12 |
| **H — Post-MVP** | Local backend, more sources, Firefox, LLM | Week 13+ |

**Canonical MVP layout:** `extension/` (TypeScript, React, Vite, MV3). Optional later: `backend/` (FastAPI), `docs/`, `examples/`, `scripts/`.

---

## VALIDATION EXPECTATIONS (GLOBAL)

- **Unit tests** for IOC regex, normalizers, cache keys, scoring helpers — run via `npm test` / documented script in `extension/`.
- **Extension build** — `npm run build` produces loadable `dist/` without errors.
- **Manual browser validation (USER)** — unpacked Chrome load, sample pages under `examples/`, hover/enrich/copy paths.
- **Security checks** — `git` clean of secrets; CI secret scan; no API keys in logs or fixtures.
- **Negative paths** — missing key, 429, timeout, disabled source, manual-only mode, empty detection.
- **Day 7** — week acceptance checklist under `docs/acceptance/` (naming: `W{n}_7_1.md`) + sign-off line in TODO.

---

## SECURITY AND PRIVACY REQUIREMENTS (LOCKED)

- API keys in `chrome.storage.local` (or backend `.env` only on optional local server — never in repo).
- Mask keys in UI after save; never log keys.
- Content script: skip `script`/`style`; avoid exfiltrating DOM text blobs.
- Domain allowlist/denylist for auto-scan (Week 10).
- Document third-party IOC leakage risk in `SECURITY.md` (queries leave the browser to vendor APIs).
- No Vera5-operated ingestion endpoint or credential relay (MVP or by default).

---

## OPEN-SOURCE READINESS PATH (LOCKED)

| Milestone | Version | Outcome |
|-----------|---------|---------|
| Internal alpha | v0.1.x | Scaffold + detection + static card |
| Private dogfood | v0.2.x | Live enrichment + cache |
| Public repo | v0.3.x | README, screenshots, CONTRIBUTING |
| Store-ready | v1.0.0 | Chrome Web Store listing, SECURITY.md, support docs |

Week 12 delivers **public GitHub launch** readiness (not necessarily store approval same week).

---

## ACCEPTANCE CRITERIA — MVP (LOCKED)

- [ ] Extension loads unpacked in Chrome without console errors (USER)
- [ ] Detects IPv4, domain, URL, hashes, CVE on sample pages (AGENT tests + USER spot-check)
- [ ] Hover card shows type, value, sources, pivot actions (USER)
- [ ] At least two connectors return live data with BYO keys (USER)
- [ ] Cache reduces repeat calls; cached vs live visible (AGENT/USER)
- [ ] No telemetry endpoints in extension (AGENT inspect + USER network check optional)
- [ ] `SECURITY.md`, `LICENSE`, install docs complete (AGENT/USER)
- [ ] CI green: lint, test, secret scan (AGENT)

---

# BUILD ROADMAP — WEEK BY WEEK

---

## WEEK 0 - FOUNDATION AND REPO SETUP

**Description:** Establish repository structure, legal/docs skeleton, hygiene, and execution protocol before feature code. Lock MVP IOC list, first connectors (AbuseIPDB + OTX recommended), and folder contracts (`extension/`, `docs/`, `examples/`, `scripts/`). Enforce **no secrets in git** via `.gitignore` and documented env templates. Deliverable: clean tree, `docs/TODO_TASKS_Prompts.md`, `Task_Prompt.txt`, and reproducible dev commands.

**Out of scope:** Enrichment connectors, store submission, backend service.

### Day 1 - Repository scaffolding
- [x] Create root `README.md` with project one-liner and local-only stance (AGENT)
- [x] Add `LICENSE` (open-source license chosen and recorded) (AGENT)
- [x] Add root `.gitignore` blocking `node_modules/`, `dist/`, `.env`, `.env.*`, keys, logs (AGENT)
- [x] Copy or link product spec to `ideas.md` from `Vera5.md` (AGENT)
- [x] Add `SECURITY.md` skeleton (threat model, IOC leakage, no telemetry) (AGENT)
- [x] Add `CONTRIBUTING.md` skeleton (AGENT)

### Day 2 - Execution protocol and governance
- [x] Confirm `docs/TODO_TASKS_Prompts.md` matches allowlist and verification rules (AGENT)
- [x] Confirm root `Task_Prompt.txt` references protocol and `Reqd_User_Config.txt` rules (AGENT)
- [x] Add `docs/acceptance/` directory for week checklists (AGENT)
- [x] Document single-task execution flow in `README.md` (pointer to `Task_Prompt.txt`) (AGENT)

### Day 3 - Extension directory contract
- [x] Create `extension/` package skeleton (`package.json`, `tsconfig`, Vite placeholder) (AGENT)
- [x] Document folder ownership: `extension/src/{background,content,popup,options,components,lib}` (AGENT)
- [x] Add `examples/` with `sample-iocs.txt` placeholder (AGENT)
- [x] Add `scripts/` with `dev.ps1` / `build.ps1` stubs or npm script equivalents (AGENT)

### Day 4 - Quality gates
- [x] Add ESLint + Prettier (or equivalent) for `extension/` (AGENT)
- [x] Add unit test runner (Vitest/Jest) baseline config (AGENT)
- [x] Add `npm run lint`, `npm run test`, `npm run build` scripts (AGENT)
- [x] Add pre-commit or documented local check (lint + test) (AGENT)

### Day 5 - CI and secret safety
- [ ] Add GitHub Actions (or CI) job: install, lint, test on PR (AGENT)
- [ ] Add CI secret scan (gitleaks/trufflehog or equivalent) failing on keys (AGENT)
- [ ] Add `.env.example` only if backend stub exists; otherwise document BYO keys in README (AGENT)
- [ ] Add `Reqd_User_Config.txt` template header explaining manual backlog format (AGENT)

### Day 6 - MVP scope freeze
- [ ] Freeze MVP IOC type list in `docs/architecture.md` (AGENT)
- [ ] Freeze MVP connector order (AbuseIPDB, OTX, URLScan, GreyNoise community) (AGENT)
- [ ] Freeze v0.1 exclusions (no backend, no LLM, no telemetry) (AGENT)
- [ ] Freeze versioning policy for extension semver (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 0 checkpoint
- [ ] Repo clones cleanly; `npm install` + `npm run lint` succeed in `extension/` (AGENT)
- [ ] Confirm zero tracked `.env` or key files (`git status`, secret scan) (AGENT)
- [ ] Week 0 acceptance checklist `docs/acceptance/W0_7_1.md` complete (AGENT/USER)
- [ ] Mark Week 0 sign-off in checklist; no open critical blockers (USER)

---

## WEEK 1 - EXTENSION SCAFFOLD (MANIFEST V3)

**Description:** Working Manifest V3 extension: service worker, content script entry, popup, options page, icons, unpacked load. Vite/React/TypeScript build outputs valid `dist/`. No enrichment yet.

**Out of scope:** IOC regex, API calls, backend.

### Day 1 - Tooling and manifest
- [ ] Initialize Vite + React + TypeScript in `extension/` (AGENT)
- [ ] Add `manifest.json` MV3: `storage`, `activeTab`, `scripting`, `host_permissions` justified (AGENT)
- [ ] Wire build to emit service worker + content script bundles (AGENT)

### Day 2 - Background and content entrypoints
- [ ] Implement `serviceWorker.ts` message router stub (AGENT)
- [ ] Implement `contentScript.ts` registration stub (no scan yet) (AGENT)
- [ ] Add typed message envelope in `lib/messages.ts` (AGENT)

### Day 3 - Popup and options shells
- [ ] Add `popup/` with enable/disable extension toggle placeholder (AGENT)
- [ ] Add `options/` page route in manifest + React shell (AGENT)
- [ ] Persist trivial setting in `chrome.storage.local` (AGENT)

### Day 4 - Icons and packaging
- [ ] Add extension icons under `public/icons/` (AGENT)
- [ ] Document unpacked load steps in `README.md` (AGENT)
- [ ] Verify `npm run build` output structure matches manifest paths (AGENT)

### Day 5 - Dev ergonomics
- [ ] Add watch/build dev workflow documented (AGENT)
- [ ] Add minimal smoke test (e.g. message handler unit test) (AGENT)
- [ ] Confirm no console errors on install (USER)

### Day 6 - Permission review
- [ ] Document why each manifest permission is required in `docs/security-model.md` (AGENT)
- [ ] Confirm no `eval`, remote scripts, or unsafe CSP (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 1 checkpoint
- [ ] Extension loads unpacked in Chrome (USER)
- [ ] Popup and options open without errors (USER)
- [ ] Acceptance checklist `docs/acceptance/W1_7_1.md` signed (AGENT/USER)

---

## WEEK 2 - IOC DETECTION ENGINE

**Description:** Regex/classifier for MVP IOC types with false-positive controls; skip script/style; unit tests with golden vectors.

**Out of scope:** Highlighting UI, API calls.

### Day 1 - Regex module
- [ ] Implement `lib/iocRegex.ts` with IPv4, domain, URL detectors (AGENT)
- [ ] Add hash detectors MD5, SHA1, SHA256 (AGENT)
- [ ] Add CVE detector (AGENT)

### Day 2 - Classification and dedupe
- [ ] Return structured `{ value, type, start, end }[]` from detector (AGENT)
- [ ] Dedupe overlapping matches (AGENT)
- [ ] Add tests for edge cases (private IP option, defanged URLs if in scope) (AGENT)

### Day 3 - DOM safety
- [ ] Walker skips `script`, `style`, `textarea` (configurable) (AGENT)
- [ ] Avoid matching inside attributes that break layout (AGENT)
- [ ] Unit tests for skip rules (AGENT)

### Day 4 - Content integration
- [ ] `detector.ts` scans text nodes on demand (AGENT)
- [ ] Message: `SCAN_PAGE` from popup/keyboard stub (AGENT)
- [ ] Log detection count only in dev (no production telemetry) (AGENT)

### Day 5 - False positive harness
- [ ] Add `examples/sample-alert.html` and generic blog fixture (AGENT)
- [ ] Record known false positive list in `docs/architecture.md` (AGENT)
- [ ] Tune regex with test updates (AGENT)

### Day 6 - Performance guardrails
- [ ] Cap nodes scanned per invocation (AGENT)
- [ ] Debounce rescan on mutation observer optional stub (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 2 checkpoint
- [ ] Unit tests green for all MVP IOC types (AGENT)
- [ ] USER validates detection on `examples/` pages (USER)
- [ ] Acceptance `docs/acceptance/W2_7_1.md` (AGENT/USER)

---

## WEEK 3 - HIGHLIGHTING AND HOVER CARD SHELL

**Description:** Visual affordance on IOCs; hover card UI with loading/empty/error; copy button; static pivot links (no live API).

**Out of scope:** Live enrichment, scoring.

### Day 1 - Highlighter
- [ ] Implement `highlighter.ts` underline/badge without breaking layout (AGENT)
- [ ] Toggle highlight on/off from storage (AGENT)

### Day 2 - Hover card component
- [ ] Build `HoverCard.tsx`: IOC, type, placeholder summary (AGENT)
- [ ] Position card near anchor; handle viewport edges (AGENT)

### Day 3 - Actions row
- [ ] Copy IOC button (AGENT)
- [ ] Static pivot links (VT, OTX, AbuseIPDB, URLScan templates) (AGENT)
- [ ] Tests for link templating per IOC type (AGENT)

### Day 4 - States
- [ ] Loading, error, disabled-source placeholders (AGENT)
- [ ] Manual enrich trigger (click/icon) opens card (AGENT)

### Day 5 - UX polish
- [ ] Dark-friendly styles (AGENT)
- [ ] `prefers-reduced-motion` respect (AGENT)

### Day 6 - Integration tests
- [ ] Component tests for HoverCard states (AGENT)
- [ ] USER walkthrough on GitHub + plain HTML example (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 3 checkpoint
- [ ] Hover + copy + pivots work without network (USER)
- [ ] Acceptance `docs/acceptance/W3_7_1.md` (AGENT/USER)

---

## WEEK 4 - SETTINGS, STORAGE, AND PRIVACY BASELINE

**Description:** Options page for keys (masked), per-source enable, IOC type toggles, auto-scan vs manual-only, cache clear. Formalize privacy rules in docs.

**Out of scope:** Live connector calls (Week 5).

### Day 1 - Storage layer
- [ ] `lib/storage.ts` typed settings schema (AGENT)
- [ ] Migrate-safe defaults (AGENT)

### Day 2 - API key UX
- [ ] Masked inputs for AbuseIPDB + OTX keys (AGENT)
- [ ] Never display full key after save; never log keys (AGENT)
- [ ] USER registers keys in vendor portals (USER) — record in `Reqd_User_Config.txt` if blocked

### Day 3 - Toggles
- [ ] Enable/disable auto-scan (AGENT)
- [ ] Manual-only mode disables auto API fetch (AGENT)
- [ ] Per-source enable flags (AGENT)

### Day 4 - Cache controls
- [ ] Clear cache button (AGENT)
- [ ] Export/import settings JSON (no keys in export by default) (AGENT)

### Day 5 - Privacy docs
- [ ] Complete `SECURITY.md`: IOC leakage, third-party APIs, data retained (AGENT)
- [ ] Add `docs/local-mode.md` (extension-only MVP) (AGENT)

### Day 6 - Validation
- [ ] Tests for settings round-trip (AGENT)
- [ ] Confirm secrets absent from `git status` (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 4 checkpoint
- [ ] USER saves test keys and reloads extension (USER)
- [ ] Acceptance `docs/acceptance/W4_7_1.md` (AGENT/USER)

---

## WEEK 5 - FIRST LIVE ENRICHMENT CONNECTOR

**Description:** One production connector end-to-end (recommend **AbuseIPDB** for IP or **OTX** for multi-type). Normalize response; show in hover card; handle 401/429/timeout.

**Out of scope:** Multi-source merge, composite score.

### Day 1 - Connector interface
- [ ] Define `EnrichmentResult` normalized shape in `lib/enrichment.ts` (AGENT)
- [ ] Add connector interface `{ name, enrich(ioc), healthCheck? }` (AGENT)

### Day 2 - AbuseIPDB or OTX client
- [ ] Implement chosen connector with API key from storage (AGENT)
- [ ] Rate limit header handling stub (AGENT)

### Day 3 - Background fetch
- [ ] Route enrich requests through service worker (AGENT)
- [ ] Ensure only IOC string sent in request URL/body (AGENT)

### Day 4 - UI binding
- [ ] Show source summary + tags in hover card (AGENT)
- [ ] Source attribution footer (AGENT)

### Day 5 - Error paths
- [ ] Missing key → actionable message (AGENT)
- [ ] 429 → backoff message + retry hint (AGENT)
- [ ] Tests with mocked fetch (AGENT)

### Day 6 - Manual validation
- [ ] USER tests live IP/hash against vendor dashboard (USER)
- [ ] Record API key steps in `Reqd_User_Config.txt` if not done (AGENT/USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 5 checkpoint
- [ ] Live enrichment works for at least one IOC type (USER)
- [ ] Acceptance `docs/acceptance/W5_7_1.md` (AGENT/USER)

---

## WEEK 6 - MULTI-SOURCE ENRICHMENT

**Description:** Second connector (OTX/AbuseIPDB whichever was second); parallel fetch; per-source errors; badges in card.

**Out of scope:** Composite score (Week 8).

### Day 1 - Second connector
- [ ] Implement second MVP source using same interface (AGENT)
- [ ] Respect per-source toggle (AGENT)

### Day 2 - Parallel fetch
- [ ] `Promise.allSettled` pattern in worker (AGENT)
- [ ] Partial success UI (AGENT)

### Day 3 - Normalization
- [ ] Map vendor fields to unified tags/summary (AGENT)
- [ ] Tests per vendor fixture JSON (AGENT)

### Day 4 - URLScan or GreyNoise stub (optional)
- [ ] Add third source OR document deferral in week Out of scope note (AGENT)

### Day 5 - Raw inspect panel
- [ ] Expandable raw JSON per source (redacted keys) (AGENT)

### Day 6 - Rate limit matrix
- [ ] Document per-source limits in `docs/api-integrations.md` (AGENT)
- [ ] USER verifies quota behavior with intentional repeat clicks (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 6 checkpoint
- [ ] Two sources show on same IOC card (USER)
- [ ] Acceptance `docs/acceptance/W6_7_1.md` (AGENT/USER)

---

## WEEK 7 - CACHE AND RATE-LIMIT OPERATIONS

**Description:** TTL cache in extension storage; cache key by IOC+source; manual refresh; cached vs live label.

**Out of scope:** SQLite backend cache.

### Day 1 - Cache module
- [ ] `lib/cache.ts` with TTL from settings (AGENT)
- [ ] Source-specific TTL optional (AGENT)

### Day 2 - Integration
- [ ] Skip network on valid cache hit (AGENT)
- [ ] Manual refresh bypasses cache (AGENT)

### Day 3 - Eviction
- [ ] Clear all + per-IOC invalidate (AGENT)
- [ ] Max cache size guard (AGENT)

### Day 4 - UI truthfulness
- [ ] Show `cached` badge and `lastUpdated` (AGENT)
- [ ] Tests for TTL expiry (AGENT)

### Day 5 - Quota protection
- [ ] Debounce rapid hover refetch (AGENT)
- [ ] Global cooldown after 429 (AGENT)

### Day 6 - Docs
- [ ] Analyst workflow note in `docs/analyst-workflows.md` (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 7 checkpoint
- [ ] Repeat hover uses cache until refresh (USER)
- [ ] Acceptance `docs/acceptance/W7_7_1.md` (AGENT/USER)

---

## WEEK 8 - SCORING AND SOURCE ATTRIBUTION

**Description:** Explainable composite score (Unknown/Low/Suspicious/High/Critical) from normalized signals; never hide disagreement.

**Out of scope:** ML/LLM scoring.

### Day 1 - Scoring module
- [ ] `lib/scoring.ts` with weighted inputs from sources (AGENT)
- [ ] Unknown when insufficient data (AGENT)

### Day 2 - UI
- [ ] `RiskScore.tsx` shows label + tooltips per source contribution (AGENT)
- [ ] Disagreement callout when sources conflict (AGENT)

### Day 3 - Tests
- [ ] Golden tests for score bands (AGENT)
- [ ] No score when all sources disabled (AGENT)

### Day 4 - Pivot link matrix
- [ ] Complete pivot templates per IOC type in `lib/pivots.ts` (AGENT)

### Day 5 - Confidence copy
- [ ] Disclaimer strings in hover card (AGENT)

### Day 6 - USER triage walkthrough
- [ ] USER runs SOC-style triage on sample alert HTML (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 8 checkpoint
- [ ] Score matches documented rules on fixtures (AGENT)
- [ ] Acceptance `docs/acceptance/W8_7_1.md` (AGENT/USER)

---

## WEEK 9 - EXPORT AND ANALYST ARTIFACTS

**Description:** Copy markdown/JSON summary; analyst notes field; optional Obsidian-friendly export.

**Out of scope:** Jira/Slack integrations.

### Day 1 - Markdown export
- [ ] Build markdown from normalized enrichment (AGENT)
- [ ] Include source attribution section (AGENT)

### Day 2 - JSON export
- [ ] Clipboard JSON with schema version (AGENT)

### Day 3 - Notes
- [ ] Per-session or per-IOC note field in card (AGENT)
- [ ] Notes stay local (storage) (AGENT)

### Day 4 - Tests
- [ ] Snapshot tests for export formats (AGENT)

### Day 5 - Docs
- [ ] Example exported markdown in `README.md` (AGENT)

### Day 6 - USER
- [ ] USER pastes export into case notes (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 9 checkpoint
- [ ] Acceptance `docs/acceptance/W9_7_1.md` (AGENT/USER)

---

## WEEK 10 - ANALYST WORKFLOW HARDENING

**Description:** Validate on Splunk/Security Onion/Kibana-like fixtures; domain allowlist/denylist; manual scan for heavy DOMs; performance caps.

**Out of scope:** Vendor-specific authenticated APIs.

### Day 1 - Fixtures
- [ ] Add `examples/sample-splunk-export.html` and Security Onion sample (AGENT)
- [ ] Detection regression tests on fixtures (AGENT)

### Day 2 - Allowlist
- [ ] Options: allowlist/denylist domains for auto-scan (AGENT)
- [ ] Default deny sensitive webmail if desired (documented) (AGENT)

### Day 3 - Manual scan mode
- [ ] Selection-based or page scan button for large dashboards (AGENT)

### Day 4 - Performance
- [ ] Profile scan on large table pages; cap work (AGENT)
- [ ] USER tests on real internal dashboard (optional) (USER)

### Day 5 - False positive pass
- [ ] Tune regex from dashboard samples (AGENT)

### Day 6 - Accessibility
- [ ] Keyboard focus path to hover card (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 10 checkpoint
- [ ] No DOM breakage on fixtures (USER)
- [ ] Acceptance `docs/acceptance/W10_7_1.md` (AGENT/USER)

---

## WEEK 11 - SECURITY HARDENING AND CI

**Description:** Threat review, dependency audit, CSP/manifest review, supply chain, extension threat model tests.

**Out of scope:** Store submission.

### Day 1 - Dependency audit
- [ ] CI `npm audit` policy (fail or warn documented) (AGENT)
- [ ] Pin critical dependency versions (AGENT)

### Day 2 - Extension CSP
- [ ] Review extension pages CSP and remote origins (AGENT)
- [ ] Block unexpected outbound domains except declared APIs (AGENT)

### Day 3 - Logging hygiene
- [ ] Ensure no key/IOC bulk logging in production paths (AGENT)
- [ ] Redact fixtures in tests (AGENT)

### Day 4 - Secret scan
- [ ] Verify CI secret scan on main (AGENT)
- [ ] `.env.example` documents vars without values (AGENT)

### Day 5 - Pen-test style review
- [ ] Complete `docs/security-model.md` checklist (AGENT/USER)

### Day 6 - Threat scenarios
- [ ] Document malicious page DOM confusion mitigations (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 11 checkpoint
- [ ] CI green + security checklist signed (AGENT/USER)
- [ ] Acceptance `docs/acceptance/W11_7_1.md` (AGENT/USER)

---

## WEEK 12 - OPEN-SOURCE RELEASE PREP

**Description:** Public launch readiness: README, screenshots, CHANGELOG, issue templates, v1.0.0 tag prep, Chrome store **draft** assets (submission may slip).

**Out of scope:** Firefox release; paid features.

### Day 1 - Documentation
- [ ] README: install, BYO keys, privacy, limitations (AGENT)
- [ ] `docs/screenshots.md` + capture placeholders (AGENT/USER)

### Day 2 - Community files
- [ ] Issue/PR templates under `.github/` (AGENT)
- [ ] `CHANGELOG.md` v0.x entries (AGENT)

### Day 3 - Full regression
- [ ] Run lint, test, build clean (AGENT)
- [ ] USER full manual matrix on examples + one real SOC page (USER)

### Day 4 - Store draft
- [ ] Store listing draft text + privacy single purpose (AGENT/USER)
- [ ] Package zip build script `scripts/package-extension.ps1` (AGENT)

### Day 5 - License and attribution
- [ ] Third-party notices file if required (AGENT)
- [ ] Connector ToS references in docs (AGENT)

### Day 6 - Release tag prep
- [ ] Version bump manifest semver (AGENT)
- [ ] Draft GitHub release notes (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 12 / MVP sign-off
- [ ] MVP acceptance criteria (global section) all checked (AGENT/USER)
- [ ] `docs/acceptance/W12_7_1.md` public launch sign-off (AGENT/USER)
- [ ] Confirm: **no API keys or .env committed** (AGENT)
- [ ] Open-source publish checklist complete (USER)

---

# POST-MVP TRACK (WEEKS 13+)

Execute only after Week 12 sign-off unless operator reprioritizes.

---

## WEEK 13 - OPTIONAL LOCAL FASTAPI BACKEND

**Description:** Local-only enrichment aggregator on localhost; extension talks to `127.0.0.1`; SQLite cache; keys in `.env` not committed.

**Out of scope:** Hosted cloud deployment.

### Day 1 - Backend scaffold
- [ ] `backend/app/main.py` FastAPI health route (AGENT)
- [ ] `backend/.env.example` with `VERA5_*` vars (AGENT)

### Day 2 - Connectors port
- [ ] Move one connector to Python; parity test with extension (AGENT)

### Day 3 - Extension bridge
- [ ] Options: use local backend toggle (AGENT)
- [ ] CORS localhost only (AGENT)

### Day 4 - SQLite cache
- [ ] TTL cache table + tests (AGENT)

### Day 5 - Rate limits
- [ ] Central rate limiter in backend (AGENT)

### Day 6 - Docs
- [ ] `docs/local-mode.md` backend section (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 13 checkpoint
- [ ] USER runs backend + extension against localhost (USER)
- [ ] Acceptance `docs/acceptance/W13_7_1.md` (AGENT/USER)

---

## WEEK 14 - EXPANDED SOURCES (VT, SHODAN, CENSYS)

**Description:** Add Priority-2 connectors behind feature flags; respect vendor license/quota.

**Out of scope:** MISP/OpenCTI.

### Day 1 - VirusTotal connector (flagged)
- [ ] Implement VT client + tests with mocks (AGENT)

### Day 2 - Shodan
- [ ] IP/service enrichment path (AGENT)

### Day 3 - Censys
- [ ] Credential pair from env/backend only (AGENT)

### Day 4 - Options UI
- [ ] Keys and enable flags for new sources (AGENT)

### Day 5 - Rate limits
- [ ] Per-source quotas documented (AGENT)

### Day 6 - USER keys
- [ ] USER adds keys in vendor portals (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 14 checkpoint
- [ ] Acceptance `docs/acceptance/W14_7_1.md` (AGENT/USER)

---

## WEEK 15 - PHASE 2 IOC TYPES

**Description:** Email, ASN, CIDR, file paths (conservative), onion domains.

**Out of scope:** ATT&CK IDs until spec stable.

### Day 1 - Spec
- [ ] Extend detector spec in docs (AGENT)

### Day 2 - Regex + tests
- [ ] Implement types with false-positive controls (AGENT)

### Day 3 - UI labels
- [ ] Hover card type display (AGENT)

### Day 4 - Pivots
- [ ] Pivot links for new types (AGENT)

### Day 5 - Regression
- [ ] Full test suite green (AGENT)

### Day 6 - USER
- [ ] Validate on CTI blog fixtures (USER)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 15 checkpoint
- [ ] Acceptance `docs/acceptance/W15_7_1.md` (AGENT/USER)

---

## WEEK 16 - OPTIONAL LOCAL LLM SUMMARY

**Description:** Opt-in summaries from localhost LLM endpoint only; strict JSON in, markdown out; disclaimer; never send keys.

**Out of scope:** Cloud LLM default.

### Day 1 - Prompt templates local file
- [ ] `docs/ai-summary.md` contract (AGENT)

### Day 2 - Summary service
- [ ] Only enrichment JSON as model input (AGENT)

### Day 3 - UI toggle
- [ ] Opt-in per enrichment (AGENT)

### Day 4 - Safety tests
- [ ] No hallucinated vendor counts in tests (AGENT)

### Day 5 - USER Ollama/llama.cpp
- [ ] USER runs local endpoint (USER)

### Day 6 - Docs
- [ ] Security notes for LLM path (AGENT)

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: update `README.md` for capability shipped through this week only — architecture, install/load path, manifest permissions, supported enrichment sources (if any), configuration flow, local-first and BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) posture, security/privacy expectations, browser support, extension behavior, and screenshots when applicable; concise, mature, product-native (AGENT)
- [ ] Remove stale placeholders, deprecated instructions, speculative future features, marketing fluff, and README claims that exceed implemented behavior (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** (no week/day/task labels, AGENT/USER markers, Cursor/AI-build notes, prompt-protocol text, or internal governance scaffolding) (AGENT)
- [ ] **README validation**: install/setup steps still work; documented feature list matches the repo; refresh or remove screenshots if UI changed this week (AGENT/USER)

### Day 7 - Week 16 checkpoint
- [ ] Acceptance `docs/acceptance/W16_7_1.md` (AGENT/USER)

---

## MANUAL SETUP TRACKING (LOCKED)

All user-only setup (API keys, Chrome Web Store developer account, local backend `.env`, Firefox signing, etc.) must be recorded in **`Reqd_User_Config.txt`** at repository root when a task cannot be closed by automation alone.

**Format per block:**

```
Source: [Current TODO Objective line]
Summary: [one sentence]
Manual steps:
- WHAT: ...
  WHY: ...
  WHERE: ...
```

Do not duplicate open items; cross-reference existing blocks instead.

---

## TASK EXECUTION (LOCKED)

1. Operator sets **Current TODO Objective** and **Task scope** in `Task_Prompt.txt`.
2. Cursor executes **one** task per `docs/TODO_TASKS_Prompts.md`.
3. Verification PASS → mark **only** that checkbox in this file.
4. Manual steps → append `Reqd_User_Config.txt`.

**Protocol files:** `Task_Prompt.txt`, `docs/TODO_TASKS_Prompts.md`, this `TODO.md`.

**Hygiene:** `DEV/ROADMAP HYGIENE (LOCKED)` applies to every run; public artifacts stay free of internal scaffolding.
