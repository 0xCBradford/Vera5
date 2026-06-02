# Mermaid Integration Analysis for VERA5

**Mode:** Analysis only (no documentation edits, no diagram creation, no build changes).  
**Date:** 2026-05-27  
**Standards reference:** `.cursor/rules/architecture.mdc` (reviewed, not modified).

---

## 1. Executive Summary

**Recommendation:** Proceed with **limited, public-documentation-only** Mermaid integration. Overall **risk is Low** for the Vera5 extension product: Mermaid lives in Markdown fenced blocks, is rendered by GitHub (and many IDEs), and does not participate in `npm run build`, extension packaging, Vitest, or runtime behavior.

**Safest wins:** Replace or supplement existing **ASCII architecture art** and **prose/table process flows** in tracked public docs, especially `docs/local-mode.md`, `docs/contributors/extension-architecture.md`, and `docs/analyst-workflows.md`.

**Caution:** Avoid duplicate diagrams across README, `docs/architecture.md`, and contributor topic files. Avoid diagrams in private validation artifacts unless explicitly maintainer-only. Do not diagram week/roadmap scaffolding, internal paths (`.internal/validation/`, `docs/_DevNotes/`), or implementation details that expose sensitive operational logic.

**Path note:** `.cursor/rules/architecture.mdc` references `docs/architecture/` (folder) and `docs/contributing/`; the repo uses **`docs/architecture.md`** (file) and **`docs/contributors/`**. Future diagram work should follow **actual paths**, not the rule’s legacy folder names.

---

## 2. Files Reviewed

### Tracked public Markdown (git)

| Path | Type of content | Mermaid recommended? | Reason |
|------|-----------------|----------------------|--------|
| `README.md` | Product overview, operator surfaces table, numbered configuration flow, install commands | **Optional (P2/P3)** | Tables are clear; a small operator-surface flowchart could help newcomers but duplicates contributor docs if too detailed |
| `CONTRIBUTING.md` | PR workflow, quality gate commands | **No (P3 at most)** | Short procedural text; diagram adds little |
| `SECURITY.md` | Threat model tables, IOC leakage, vendor request steps | **Yes (P2)** | Strong candidate for data-boundary flow (local vs vendor); keep logical, no key material |
| `LICENSE` | Legal text | **No** | Not applicable |
| `Product-Vision.md` | Long product narrative, use cases, principles | **No / P3 only** | Prose-heavy; diagrams risk staleness across 380+ lines; link to `docs/` instead |
| `Vera5.md` | Large product spec, tree diagrams in prose | **No / P3 only** | Same as Product-Vision; high maintenance, partial overlap with public docs |
| `docs/architecture.md` | Module tables, scan trigger table, FP tables, connector order, SemVer | **Partial (P2)** | Scan pipeline and connector order suit flowcharts; FP tables should stay tables |
| `docs/analyst-workflows.md` | Numbered triage flow, cache/score interpretation tables | **Yes (P1)** | Clear operator journey; best public home for “day in the life” flow |
| `docs/api-integrations.md` | Vendor matrix, 429/cooldown rules, HTTP mapping | **Yes (P2)** | Rate-limit and parallel-fetch behavior suits sequence/state diagrams |
| `docs/local-mode.md` | **ASCII box diagram** (“What runs where”), BYOK steps, boundaries | **Yes (P1)** | Direct ASCII replacement candidate; highest clarity gain per line changed |
| `docs/security-model.md` | Permissions, surfaces, trust boundary table | **Yes (P2)** | Complements SECURITY.md; avoid duplicating full IOC leakage diagram |
| `docs/contributors/README.md` | Index of contributor topics | **No** | Link hub only |
| `docs/contributors/extension-architecture.md` | Surfaces table, **ASCII message flow** | **Yes (P1)** | Existing `text` diagram is ideal Mermaid conversion target |
| `docs/contributors/detection-engine.md` | Numbered pipeline (walker → regex → dedup → highlight) | **Yes (P2)** | Simple `flowchart LR` or `TD` |
| `docs/contributors/hover-overlay-architecture.md` | Overlay vs React split, drift checklist | **Yes (P2)** | Two-path architecture `flowchart TD` (small) |
| `docs/contributors/settings-and-storage.md` | Schema table, sync pattern | **Low (P3)** | Tables adequate |
| `docs/contributors/enrichment-connectors.md` | Connector table, parallel fetch bullets | **Yes (P1/P2)** | **Best home** for enrichment `sequenceDiagram` (analyst → content → worker → vendors) |
| `docs/contributors/cache-and-rate-limits.md` | Cache key rules, 429/cooldown | **Yes (P2)** | `stateDiagram-v2` for cache hit/miss and cooldown gate; link to api-integrations for vendor detail |
| `docs/contributors/scoring-system.md` | Bands, disagreement thresholds, layer table | **Yes (P2)** | Decision flowchart for composite vs unknown vs disagreement |
| `docs/contributors/testing.md` | Command blocks, test file list | **No** | Commands should stay bash fences |
| `docs/contributors/documentation-governance.md` | Public/private doc rules | **Optional (P3)** | Small doc-boundary flowchart possible; low urgency |

### Inspected but out of scope for public Mermaid

| Path | Type | Mermaid recommended? | Reason |
|------|------|----------------------|--------|
| `docs/TODO_TASKS_Prompts.md` | Execution protocol (gitignored) | **No** | Internal governance |
| `Task_Prompt.txt` | Run prompt (gitignored) | **No** | Internal |
| `TODO.md` | Roadmap (gitignored) | **No** | Week/day scaffolding; gantt would encode volatile roadmap |
| `docs/_DevNotes/**` | Private maintainer notes (gitignored) | **Optional internal only** | Never link from public docs |
| `.internal/validation/**` | Sign-off evidence (gitignored) | **Avoid** | AGENT/USER tables; risk of operational detail leakage if ever published |
| `extension/**` | TypeScript source | **No** | No Mermaid in source per safety rules |
| `extension/dist/`, `node_modules/` | Build output / deps | **No** | Generated |
| `.github/workflows/**` | CI YAML | **No** | Not Markdown documentation |
| `examples/**` | Sample HTML/IOC fixtures | **No** | Operator samples, not architecture docs |

### Other

| Path | Notes |
|------|--------|
| `.cursor/rules/architecture.mdc` | Defines Mermaid standards; uses placeholder fences; **not** a doc insertion target |
| `.internal/_DevNotes/DOCS_VALIDATION_*.md` | Private audit trail; **no** public Mermaid needed |

**Existing Mermaid in repo:** One `mermaid` block found under `.internal/_DevNotes/TODO Files/Vera5-SGA-Implement.md` (private). **No Mermaid in tracked public docs today.**

---

## 3. High-Value Mermaid Opportunities

### P1 — Do first (high clarity, low risk)

| File | Current pattern | Diagram type | Suggested title | Why improve | Public/private | Risk | Priority |
|------|-----------------|--------------|-----------------|-------------|----------------|------|----------|
| `docs/local-mode.md` | ASCII box “What runs where” (lines 21–40) | `flowchart TB` | Local mode runtime (browser boundary) | ASCII is hard to maintain and renders inconsistently; Mermaid is GitHub-native | Public | Low | **P1** |
| `docs/contributors/extension-architecture.md` | ASCII message flow (lines 30–36) | `sequenceDiagram` | Extension message routing | Shows security-relevant boundary (content vs service worker) clearly | Public | Low | **P1** |
| `docs/analyst-workflows.md` | Numbered “Typical triage flow” (steps 1–6) | `flowchart TD` or `journey` | Analyst triage on a page tab | Primary user doc for operators; reduces wall of text | Public | Low | **P1** |
| `docs/contributors/enrichment-connectors.md` | Parallel fetch bullets, BYOK | `sequenceDiagram` | Live enrichment request path | **Canonical** technical enrichment diagram (avoid duplicating full version elsewhere) | Public | Low | **P1** |

### P2 — Useful next

| File | Current pattern | Diagram type | Suggested title | Why improve | Public/private | Risk | Priority |
|------|-----------------|--------------|-----------------|-------------|----------------|------|----------|
| `SECURITY.md` | “Stays local” vs “May leave browser” tables | `flowchart LR` | IOC and data boundary | Security reviewers benefit from one visual trust boundary | Public | Low | **P2** |
| `docs/security-model.md` | Manifest surfaces table | `flowchart TD` | Extension surfaces and permissions | Lighter than SECURITY; show popup/content/background/options only | Public | Low | **P2** |
| `docs/api-integrations.md` | 429 handling, global cooldown table | `stateDiagram-v2` | Automatic enrichment gating after HTTP 429 | Cooldown + manual refresh bypass is stateful | Public | Low | **P2** |
| `docs/architecture.md` | Scan trigger table (`serviceWorker` → `scanPage`, mutation rescan) | `flowchart TD` | Page scan triggers | Contributor-facing; keep module names minimal | Public | Low | **P2** |
| `docs/contributors/detection-engine.md` | Four-step pipeline list | `flowchart LR` | Detection pipeline | Matches code path without file-level detail | Public | Low | **P2** |
| `docs/contributors/cache-and-rate-limits.md` | TTL, manual refresh, cooldown prose | `stateDiagram-v2` | Per-indicator cache and refresh | Complements api-integrations; avoid repeating full 429 diagram | Public | Low | **P2** |
| `docs/contributors/scoring-system.md` | Disagreement rules, layer table | `flowchart TD` | Composite score decision | Clarifies unknown vs blended vs disagreement callout | Public | Low | **P2** |
| `docs/contributors/hover-overlay-architecture.md` | Overlay vs React narrative | `flowchart TD` | Production overlay vs test UI | Prevents contributor confusion about injection | Public | Low | **P2** |

### P3 — Optional / later

| File | Current pattern | Diagram type | Suggested title | Why improve | Public/private | Risk | Priority |
|------|-----------------|--------------|-----------------|-------------|----------------|------|----------|
| `README.md` | Operator surfaces table | `flowchart LR` | Operator surfaces (summary) | Link to detailed docs; keep README diagram ≤6 nodes | Public | Low | **P3** |
| `README.md` | Numbered configuration flow | `flowchart TD` | First-time setup | Only if README diagram stays minimal | Public | Low | **P3** |
| `docs/architecture.md` | SemVer milestone table | `stateDiagram-v2` | Release maturity (0.1→1.0) | Low churn if version gates change infrequently | Public | Medium | **P3** |
| `Product-Vision.md` / `Vera5.md` | Narrative architecture | `flowchart TD` | Product component map | Large files; high drift risk | Public | Medium | **P3** |
| `docs/contributors/documentation-governance.md` | Public vs private rules | `flowchart TD` | Documentation audiences | Nice onboarding for contributors | Public | Low | **P3** |

### De-duplication rule (critical)

| Topic | Single best location | Do not duplicate in |
|-------|---------------------|---------------------|
| Browser local-mode deployment | `docs/local-mode.md` | README, SECURITY (text cross-link only) |
| Enrichment IOC → vendors | `docs/contributors/enrichment-connectors.md` | README, analyst-workflows (summarize in prose) |
| Extension messaging | `docs/contributors/extension-architecture.md` | `docs/architecture.md` (table reference only) |
| Analyst triage steps | `docs/analyst-workflows.md` | README |
| HTTP 429 / global cooldown | `docs/api-integrations.md` | cache contributor doc (short cross-link) |
| IOC data boundaries | `SECURITY.md` | security-model (one-line pointer) |

---

## 4. Files Where Mermaid Should NOT Be Added

| Location | Why avoid |
|----------|-----------|
| `extension/src/**`, `extension/public/**` | Source and manifest; no runtime benefit; violates analysis scope |
| `**/*.test.ts`, `**/*.test.tsx` | Tests assert behavior, not render docs |
| `package.json`, `vite.config.*`, `tsconfig.*`, ESLint config | Config; diagrams do not belong |
| `extension/dist/`, `node_modules/` | Generated or vendored |
| `.github/workflows/*.yml` | CI definitions |
| `TODO.md`, `Task_Prompt.txt`, `docs/TODO_TASKS_Prompts.md` | Internal execution scaffolding |
| `.internal/validation/**` | Sign-off evidence; week/AGENT/USER content; not for public visual export |
| `docs/_DevNotes/**` | Private; must not be linked from public docs |
| `ideas.md` (gitignored) | Internal product notes |
| `examples/*.html`, `examples/*.txt` | Fixtures, not architecture documentation |
| Lockfiles, binaries, images | Not Markdown |
| Long narrative specs (`Vera5.md`) unless selectively edited | Maintenance burden outweighs benefit |

**Noise risk:** Converting large false-positive tables in `docs/architecture.md` to diagrams would **reduce** clarity and searchability. Keep FP/suppression content as tables.

---

## 5. Public vs Private Documentation Guidance

### Safe for public diagrams (tracked docs)

Show only **logical, product-level** relationships:

- Analyst actions (scan, open card, enrich, pivot)
- Extension surfaces (popup, content overlay, options, background worker)
- Data categories (page text, IOC value, API key storage, cache entry)
- Vendor names as configured third parties (AbuseIPDB, OTX), not API keys or headers with secrets
- States: Live/Cached/Error, cooldown active/inactive, manual-only on/off
- Scoring outcomes: Unknown, band labels, disagreement callout (thresholds as documented numbers are OK)

### Keep internal / do not diagram publicly

- `.internal/validation/` sign-off flows, test counts, evidence paths
- `docs/_DevNotes/` execution protocol, Contributor_Docs_Sync routing tied to roadmap weeks
- TODO week dependency graphs (roadmap gantt)
- Exact storage key names beyond what is already in public contributor docs
- Future unshipped connectors beyond “planned” labels already in tables
- CI secret-scan internals, pre-commit hook paths as operational runbooks

### If private diagrams are ever added (optional future)

- Location: `.internal/_DevNotes/` or `.internal/validation/` only
- Content: maintainer checkpoint flows, **not** for GitHub public render
- Rule: never link from `docs/contributors/`, README, or CONTRIBUTING

---

## 6. Recommended Diagram Types

Types that fit Vera5’s **actual** documentation (aligned with `.cursor/rules/architecture.mdc`):

| Type | Vera5 use cases |
|------|-----------------|
| **flowchart TD** | Local-mode browser layout; detection pipeline; scan triggers; scoring decision tree; documentation audience split |
| **flowchart LR** | IOC data boundary (local → optional vendor); left-to-right enrichment overview |
| **sequenceDiagram** | Popup/content → service worker → vendor APIs; parallel multi-source responses |
| **stateDiagram-v2** | Cache hit/miss + manual refresh; global cooldown vs automatic enrichment; hover card enrichment states |
| **journey** | Optional alternative for analyst-workflows triage (human-readable steps) |

**Likely not useful (this repo today):**

| Type | Why skip |
|------|----------|
| **erDiagram** | No SQL/database schema; `chrome.storage` is key-value, not relational ERD-friendly |
| **gantt** | Roadmap lives in gitignored `TODO.md`; public gantt would leak roadmap framing |
| **gitGraph** | No contributor branching policy doc requiring it |
| **pie/bar charts** | No quantitative metrics in public docs suitable for chart syntax |

**GitHub compatibility (from architecture.mdc):** Use supported diagram types only; node IDs without spaces; keep blocks under ~25 nodes; split if larger.

---

## 7. Proposed Execution Plan for Later

**Do not execute in this task.** Suggested order for a follow-up prompt:

### Phase A — Replace existing ASCII (P1)

1. `docs/local-mode.md` — replace “What runs where” ASCII with `flowchart TB`; retain “nothing sends page HTML to Vera5” caption below diagram.
2. `docs/contributors/extension-architecture.md` — replace message-flow `text` block with `sequenceDiagram`.
3. `docs/analyst-workflows.md` — add triage `flowchart TD` under “Typical triage flow”; keep numbered list as accessible fallback or remove if redundant.
4. `docs/contributors/enrichment-connectors.md` — add enrichment `sequenceDiagram` (single canonical technical flow).

### Phase B — Security and policy flows (P2)

5. `SECURITY.md` — IOC leakage boundary diagram (one diagram only).
6. `docs/api-integrations.md` — 429/cooldown `stateDiagram-v2`.
7. `docs/contributors/scoring-system.md` — composite/disagreement decision `flowchart TD`.
8. `docs/contributors/detection-engine.md` — detection pipeline `flowchart LR`.
9. `docs/contributors/hover-overlay-architecture.md` — overlay vs React `flowchart TD`.
10. `docs/architecture.md` — scan triggers `flowchart TD` (short; link to detection-engine for detail).

### Phase C — Optional polish (P3)

11. `README.md` — minimal operator-surface diagram (≤6 nodes) **or** skip if README stays table-only.
12. `docs/security-model.md` — surfaces diagram only if not duplicating SECURITY.

### Files to avoid in execution

- All of Section 4
- Duplicate diagrams for the same flow (see de-duplication table)
- `Product-Vision.md`, `Vera5.md` unless explicitly requested

### Validation steps (non-regression)

| Step | Command / action | Expected |
|------|------------------|----------|
| Markdown only | `git diff --name-only` | Only `*.md` under allowed paths |
| No extension impact | `cd extension && npm run check` | Pass (unchanged by doc-only work) |
| No build coupling | Confirm no `mermaid` npm dependency added | package.json unchanged |
| GitHub render | Push to branch; open Preview on GitHub for each edited file | Diagrams render |
| Public hygiene grep | `git ls-files '*.md' \| xargs rg 'docs/_DevNotes\|\.internal/validation'` on edited files | No new private path links |
| Node ID lint | Manual review: no spaces in Mermaid node IDs | Valid syntax |
| Accessibility | Keep prose summary before/after each diagram | Screen-reader friendly |

### Optional future consideration (not required now)

- Align `.cursor/rules/architecture.mdc` placement paths with `docs/contributors/` and `docs/architecture.md` when rules are next edited.
- Add a one-line note in `docs/contributors/documentation-governance.md` that diagrams follow GitHub Mermaid (no new governance file).

---

## 8. Final Recommendation

**Proceed** with Mermaid integration in a **narrow, documentation-only** follow-up task.

**Safest scope for the next execution prompt:**

- **In scope:** P1 files only (four files), plus validation steps above.
- **Explicitly out of scope:** Source code, tests, configs, CI, private folders, README unless user expands scope, roadmap/gantt, erDiagram, new governance files, Task_Prompt changes.
- **Success criteria:** GitHub renders all new diagrams; zero `npm`/`extension` diffs; no private path references; ASCII replaced where listed, not duplicated elsewhere.

**Overall risk level:** **Low** for product/build/runtime. **Medium** maintenance risk only if too many diagrams are added to `Product-Vision.md` or duplicated across files (mitigate with de-duplication table).

---

## Appendix: Example syntax (report only)

Example local-mode style (not inserted into repo docs):

[FENCE:MERMAID]
flowchart TB
  subgraph browser [Chromium MV3 extension]
    CS[Content script]
    BG[Background worker]
    UI[Popup and Options]
    STORE[(chrome.storage.local)]
    CS <-->|messages| BG
    UI <-->|settings| BG
    BG --> STORE
    CS --> STORE
  end
  Vendors[Third-party APIs]
  BG -->|HTTPS indicator only| Vendors
[/FENCE]

---

*End of analysis. Only `Mermaid-Int-Analysis.md` was created; no other files were modified.*
