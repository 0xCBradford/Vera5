# PlatformWeeksPrompt.md

**Location:** repository root (roadmap expansion runner for post-MVP platform weeks **29–37** and **Week 8.5** explain-chain expansion).

Use this file as your **copy/paste prompt runner** for adding **full** week blocks to repo-root `TODO.md`. This is a separate sequence from `docs/_DevNotes/TODO Files/NewWeekPrompt.md` (Steps 1–10, MVP fractional weeks and post-MVP 13–28 stubs).

Designed so you can say: **`Do the next one.`**

---

## What this sequence delivers (10 units)

| Step | Target | Type |
|------|--------|------|
| 11 | Week **8.5** — explain-this-IOC reasoning chain | Expand existing week in-place |
| 12 | Week **29** — page context awareness | Insert **full** week after Week 28 |
| 13 | Week **30** — operator macros | Insert full week after 29 |
| 14 | Week **31** — investigation replay | Insert full week after 30 |
| 15 | Week **32** — multi-IOC correlation packs | Insert full week after 31 |
| 16 | Week **33** — human-centered noise reduction | Insert full week after 32 |
| 17 | Week **34** — portable threat profiles | Insert full week after 33 |
| 18 | Week **35** — known-good intelligence | Insert full week after 34 |
| 19 | Week **36** — analyst notebook layer | Insert full week after 35 |
| 20 | Week **37** — IOC relationship memory (deep) | Insert full week after 36 |
| 21 | Consistency pass | `TODO.md` + `WEEKS.md` alignment |

**Not in this sequence:** expanding stub weeks **19–28** to full weeks (optional later runner). Weeks **24–28** already exist as stubs in `TODO.md`; Steps 12–20 must not delete or hollow them out.

---

## Global Rules (apply to every run)

**Primary reference for week shape and quality:**

- `docs/_DevNotes/TODO Files/WEEKS.md` — week contract, task style, dependency rules, things NOT to add

**Also enforce:**

- `TODO.md` (repository root) — locked governance, non-negotiables, existing week formatting
- `docs/_DevNotes/TODO Files/Vera5-SGA-Implement.md` — philosophy and sequencing (optional detail)
- `docs/_DevNotes/TODO Files/Vera5-Strategic-Gap-Analysis.md` — gap themes (optional detail)

**Hard constraints:**

1. Edit only repo-root `TODO.md` unless the step says otherwise (progress markers in **this file** are allowed).
2. **FULL weeks only** — no stub weeks. Each new week must match the density of **Week 9.75 / 11.25** (~35–55 lines), not **Week 19–28 stub** density.
3. Preserve all locked governance sections and non-negotiables in `TODO.md`.
4. No silent drops: if replacing stub **29–37** content, merge obligations into the full week; if inserting fresh, include all day themes from the step prompt.
5. Include a **Coverage map** in chat reply (source → new task lines).
6. Acceptance artifacts: `docs/acceptance/W{n}_7_1.md` (integer weeks); fractional weeks use underscore: `W8_5_1.md`.
7. Keep diffs scoped to the step’s week block(s) only (Step 21 excepted).

**Execution discipline:**

- Prefer **1–2 steps per chat** (“Do the next one”) to keep diffs reviewable.
- Do **not** run `Task_Prompt.txt` against Weeks 29–37 until you intentionally start building them; MVP execution remains **8.5–12.5** unless reprioritized.
- Backup `TODO.md` before Step 11 if you want a rollback point.

---

## Full week template (mandatory)

Every inserted or expanded week must include, in order:

```markdown
## WEEK N - TITLE

**Description:** …
**Out of scope:** …
**Dependency:** … (when applicable)

### Day 1 - …
- [ ] … (AGENT|USER|AGENT/USER)

… Days 2–6 …

### README maintenance pass (recurring)
- [ ] **README.md accuracy pass**: … (AGENT)
- [ ] Remove stale placeholders … (AGENT)
- [ ] Confirm README obeys **DEV/ROADMAP HYGIENE** … (AGENT)
- [ ] **README validation**: … (AGENT/USER)

### Day 7 - Week N checkpoint
- [ ] Acceptance `docs/acceptance/W{N}_7_1.md` (AGENT/USER)
```

Apply `WEEKS.md` **Prompt you can send** and **Quality bar** when writing Description and Day tasks.

---

## How To Run

### First run

Paste **Prompt 0** once.

### After that

Say only:

`Do the next one.`

The assistant executes the next **PENDING** step, marks it **DONE**, and sets the following step as **NEXT**.

---

## Prompt 0 - Initialize sequence + execute Step 11

```text
You are executing roadmap edits in sequence using c:\Projects\VERA5\PlatformWeeksPrompt.md.

Reference and follow (WEEKS.md is the primary week-writing standard):
- c:\Projects\VERA5\docs\_DevNotes\TODO Files\WEEKS.md
- c:\Projects\VERA5\TODO.md
- c:\Projects\VERA5\docs\_DevNotes\TODO Files\Vera5-SGA-Implement.md (optional)
- c:\Projects\VERA5\docs\_DevNotes\TODO Files\Vera5-Strategic-Gap-Analysis.md (optional)

Task:
1) Read PlatformWeeksPrompt.md.
2) Execute Step 11 only.
3) Update PlatformWeeksPrompt.md progress markers:
   - Mark Step 11 as DONE.
   - Mark Step 12 as NEXT.
4) Edit only TODO.md + PlatformWeeksPrompt.md.

Output requirements in chat:
- Summary of TODO.md edits
- Coverage map (old -> new)
- Risks/checks
- "READY FOR NEXT STEP: Yes/No"
```

---

## Step 11 - Expand Week 8.5 (explain-this-IOC reasoning chain)

**Status:** DONE  
**Goal:** Add deterministic explainability to Week 8.5 without LLM summaries.

```text
Apply WEEKS.md to TODO.md for Step 11:

Expand WEEK 8.5 only (in-place; do not renumber the week):

Add "explain-this-IOC" reasoning chain UX (NOT AI summary):
- Deterministic chain from composite score + per-source normalized fields + disagreement
- Visible in production overlay / card alongside existing score work
- Explicit empty/insufficient-data path

Suggested placement (merge with existing days; do not remove overlay/scoring tasks):
- Day 1–2: reasoning chain panel + shared logic with score display
- Day 3: tests for chain visibility, disagreement path, no-score path
- Day 4: docs/analyst-workflows.md — explain vs score vs AI (forbid marketing "AI says bad")
- Day 7: acceptance evidence includes reasoning chain

Requirements:
- No silent drops of existing Week 8.5 tasks.
- Every new line ends with (AGENT), (USER), or (AGENT/USER).
- Preserve README pass and W8_5_1.md acceptance.
- Keep edits scoped to Week 8.5 only.

Return in chat:
- Coverage map (old Week 8.5 -> expanded Week 8.5)
- Notes for Step 12 (page context may reference explain chain in docs only).
```

---

## Step 12 - Insert full Week 29 (page context awareness)

**Status:** DONE  
**Goal:** Local page-type detection drives analyst-native UI defaults.

```text
Apply WEEKS.md to TODO.md for Step 12:

Replace or insert FULL week block after WEEK 28 and before MANUAL SETUP TRACKING
(or after existing WEEK 29 stub if present — expand to full, no stub left):

## WEEK 29 - PAGE CONTEXT AWARENESS

Themes to cover in Days 1-7:
- Day 1: Local page classifier (URL + DOM heuristics): Splunk, Security Onion, Kibana/Sentinel/Elastic-style, Jira, GitHub issues, TheHive/MISP/OpenCTI-style, OTX, malware blogs, sandbox reports, generic fallback
- Day 2: Context -> IOC priority + UI layout profile per page type
- Day 3: Wire context to Week 10.5 analyst presets and Week 9.75 default export template
- Day 4: User override "treat this site as …" in options
- Day 5: Tests using fixtures per page type
- Day 6: USER validation on real Splunk (or SOC fixture) + malware blog tab
- Day 7: W29_7_1.md

Out of scope: cloud page fingerprinting; telemetry; full-page upload for classification.

Dependency: Weeks 10 fixtures, 10.5 presets, 11.25 sessions (optional cross-ref).

Requirements:
- FULL week per PlatformWeeksPrompt.md template.
- No silent drops if stub Week 29 existed.

Return in chat:
- Coverage map
- Dependency notes for Step 13 (macros).
```

---

## Step 13 - Insert full Week 30 (operator macros)

**Status:** DONE  
**Goal:** Programmable local analyst workflows without cloud automation.

```text
Apply WEEKS.md to TODO.md for Step 13:

Insert FULL week after WEEK 29:

## WEEK 30 - OPERATOR MACROS

Themes:
- Day 1: Macro schema + storage (local only)
- Day 2: Built-in macros (e.g. CTI Deep Check, DFIR Triage)
- Day 3: User-defined macros: steps enrich, export markdown, open pivots, note template, queue related IOCs
- Day 4: Integrate with Week 10.75 command palette and 9.5 tray; respect 10.5 trust gates
- Day 5: Tests
- Day 6: USER creates and runs one custom macro on sample page
- Day 7: W30_7_1.md

Out of scope: server-side automation; macros that bypass disclosure/domain policy; silent auto-enrich all IOCs.

Dependency: Week 10.75, 10.5, 9.5, 9.

Cross-ref: Week 20 stub — do not duplicate; note macros supersede fixed palette-only UX where applicable.

Requirements: FULL week template.

Return in chat:
- Coverage map
- Notes for Step 14.
```

---

## Step 14 - Insert full Week 31 (investigation replay)

**Status:** DONE  
**Goal:** Local workflow playback for training and DFIR documentation.

```text
Apply WEEKS.md to TODO.md for Step 14:

Insert FULL week after WEEK 30:

## WEEK 31 - INVESTIGATION REPLAY

Themes:
- Day 1: Replay model from session/event log (Week 24 timeline concepts)
- Day 2: Step-through UI: scan -> select -> enrich -> export -> note
- Day 3: Export replay transcript as markdown (training handoff)
- Day 4: Privacy: no screen/video capture; local-only
- Day 5: Tests
- Day 6: USER runs replay on completed sample investigation
- Day 7: W31_7_1.md

Out of scope: screen recording; cloud-shared replays.

Dependency: Week 11.25 sessions; Week 24 timeline (cross-ref if 24 still stub).

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 15 - Insert full Week 32 (multi-IOC correlation packs)

**Status:** DONE  
**Goal:** Local cross-session IOC correlation without global TI graph.

```text
Apply WEEKS.md to TODO.md for Step 15:

Insert FULL week after WEEK 31:

## WEEK 32 - MULTI-IOC CORRELATION PACKS (LOCAL)

Themes:
- Day 1: Local cluster model: IOC sets seen together across sessions
- Day 2: UI: "these appeared together" across sessions (not graph engine)
- Day 3: Correlation pack export as markdown/JSON appendix
- Day 4: Limits, retention, "correlation != causation" copy
- Day 5: Tests
- Day 6: USER validates repeat visit to same malware blog / alert context
- Day 7: W32_7_1.md

Out of scope: global threat graph; cloud correlation; ML relationship inference.

Dependency: Week 11.25, 9.5 scan model, Week 26 co-occurrence (same-page vs cross-session).

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 16 - Insert full Week 33 (human-centered noise reduction)

**Status:** DONE  
**Goal:** Privacy-safe local personalization from explicit suppress patterns.

```text
Apply WEEKS.md to TODO.md for Step 16:

Insert FULL week after WEEK 32:

## WEEK 33 - HUMAN-CENTERED NOISE REDUCTION

Themes:
- Day 1: Learn-from-suppress rules (explicit, inspectable, local storage)
- Day 2: Deprioritize/collapse repeatedly suppressed IOC patterns
- Day 3: Importable scanner/noise pattern lists
- Day 4: Options UI to review/edit learned rules
- Day 5: Tests; document no telemetry / no cloud learning
- Day 6: USER confirms rules match intent on noisy dashboard page
- Day 7: W33_7_1.md

Out of scope: opaque ML personalization; telemetry-based training.

Dependency: Week 11.25 watchlist; Week 10.25 FP tuning.

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 17 - Insert full Week 34 (portable threat profiles)

**Status:** PENDING  
**Goal:** Community-style workflow profiles without keys or cloud.

```text
Apply WEEKS.md to TODO.md for Step 17:

Insert FULL week after WEEK 33:

## WEEK 34 - PORTABLE THREAT PROFILES

Themes:
- Day 1: Profile bundle schema: pivots, enabled connectors, templates, quiet mode default, analyst mode
- Day 2: Import/export profiles without API keys
- Day 3: Built-in profiles (malware research, SOC triage, CTI, etc.)
- Day 4: Community profile install guidance + trust/signature expectations in docs (no hosted store required)
- Day 5: Tests round-trip
- Day 6: USER switches profile and observes behavior change
- Day 7: W34_7_1.md

Out of scope: key sharing in profiles; Vera5-hosted profile marketplace.

Dependency: Week 9 connector profiles, 10.5 presets, 21 SDK, 23 settings packs.

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 18 - Insert full Week 35 (known-good intelligence)

**Status:** PENDING  
**Goal:** Reduce fatigue via known-benign and known-internal labeling.

```text
Apply WEEKS.md to TODO.md for Step 18:

Insert FULL week after WEEK 34:

## WEEK 35 - KNOWN-GOOD INTELLIGENCE

Themes:
- Day 1: Known-good list model (CDN, SaaS, corp VPN ASN, vuln scanners)
- Day 2: Match -> label known benign / known internal; reduce alert noise
- Day 3: Import lists; integrate with 11.25 watchlist
- Day 4: Optional policy: skip external enrich for known-good matches
- Day 5: Tests
- Day 6: USER triage page with CDN + true malicious IOC
- Day 7: W35_7_1.md

Out of scope: global goodware cloud API; hidden reputation scoring.

Dependency: Week 10.5 internal assets; Week 11.25.

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 19 - Insert full Week 36 (analyst notebook layer)

**Status:** PENDING  
**Goal:** Investigation fragments attached to IOC, session, and page.

```text
Apply WEEKS.md to TODO.md for Step 19:

Insert FULL week after WEEK 35:

## WEEK 36 - ANALYST NOTEBOOK LAYER

Themes:
- Day 1: Fragment types: observation, tag, conclusion, hypothesis
- Day 2: Attach fragments to IOC, session, page
- Day 3: Text-first fragments; screenshot capture out of scope or optional stretch goal only in Out of scope
- Day 4: Export fragments via Week 25 snapshot concepts
- Day 5: Tests
- Day 6: USER builds notebook on one investigation session
- Day 7: W36_7_1.md

Out of scope: cloud notebook sync; full document management system.

Dependency: Week 11.25, 9 notes, 25 snapshots.

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 20 - Insert full Week 37 (IOC relationship memory deep)

**Status:** PENDING  
**Goal:** Operator memory augmentation across entities and sessions.

```text
Apply WEEKS.md to TODO.md for Step 20:

Insert FULL week after WEEK 36:

## WEEK 37 - IOC RELATIONSHIP MEMORY (DEEP)

Themes:
- Day 1: Entity rollup: IP <-> domains <-> hashes co-seen
- Day 2: "Previously appeared with" panel on card/tray
- Day 3: Link to prior session/investigation
- Day 4: Retention limits + clear-all memory
- Day 5: Tests
- Day 6: USER traces one IP across two sessions
- Day 7: W37_7_1.md

Out of scope: global graph database; cross-user intelligence.

Dependency: Weeks 32, 35, 11.25, 29 page context (optional).

Requirements: FULL week template.

Return in chat:
- Coverage map
```

---

## Step 21 - Consistency pass (29–37 + 8.5 + WEEKS.md)

**Status:** PENDING  
**Goal:** Roadmap coherence after platform weeks are inserted.

```text
Apply WEEKS.md for Step 21:

Perform minimal targeted edits only:

TODO.md:
- Post-MVP sequence line lists 13 through 37 with 29-37 platform weeks named
- ARCHITECTURE PHASE H reflects Weeks 13-37 (or appropriate split)
- No duplicate week numbers
- Week 20/30 cross-references where macros/palette overlap
- Week 8.5 Description mentions reasoning chain if not already
- Fractional MVP weeks 9.75-11.25 unchanged unless broken by typo

docs/_DevNotes/TODO Files/WEEKS.md:
- Add rows 29-37 to insertion guidance table (full themes, not stub)
- Add dependency rules: 29 before 30; 31 after 24; 32 after 11.25+26; 21 before 28; etc.

Do NOT expand weeks 19-28 from stub unless explicitly listed (out of scope).

Return in chat:
- Consistency report
- Exact fixes applied
- Final ordered list: weeks 8.5 through 37 (fractional noted)
- READY FOR PLATFORM SEQUENCE: Complete / Not complete
```

---

## Progress Tracker (update as you execute)

- [x] Step 11 DONE — Expand Week 8.5 explain chain
- [x] Step 12 DONE — Full Week 29
- [x] Step 13 DONE — Full Week 30
- [x] Step 14 DONE — Full Week 31
- [x] Step 15 DONE — Full Week 32
- [x] Step 16 DONE — Full Week 33
- [ ] Step 17 DONE — Full Week 34 (**NEXT**)
- [ ] Step 18 DONE — Full Week 35
- [ ] Step 19 DONE — Full Week 36
- [ ] Step 20 DONE — Full Week 37
- [ ] Step 21 DONE — Consistency pass / ALL COMPLETE

---

## Optional follow-on runners (not this file)

| Runner | Scope |
|--------|--------|
| Expand **24–28** stub → full | Separate prompt file recommended |
| Expand **19–23** stub → full | After connector weeks execute |
| Dedupe **Week 20** vs **10.75 / 30 / 11.25** | Cleanup step after 30 ships |

---

## Minimal command phrase

```text
Do the next one.
```

(Use with **PlatformWeeksPrompt.md** — not `NewWeekPrompt.md`, unless you intend the MVP expansion sequence.)
