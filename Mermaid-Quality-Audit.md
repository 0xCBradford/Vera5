# Mermaid Quality Audit — VERA5 P1 Integration

**Mode:** Verify / audit only (no documentation or source edits).  
**Date:** 2026-05-27  
**Scope:** Four public diagrams added in P1 per `Mermaid-Int-Analysis.md` and execution task.  
**Standards reference:** `.cursor/rules/architecture.mdc` (reviewed, not modified).

---

## Executive verdict

| Area | Assessment |
|------|------------|
| **Mermaid syntax validity** | **Pass** — All four blocks use supported `flowchart` and `sequenceDiagram` constructs. |
| **GitHub compatibility** | **Pass with notes** — `par`/`end`, `subgraph`, and decision nodes are GitHub-supported; recommend spot-check render on github.com after merge. |
| **Node budget (~25)** | **Pass** — Largest diagram has 9 nodes (analyst triage). |
| **Duplicate workflows** | **Pass with minor overlap** — Two sequence diagrams at different abstraction levels; acceptable per de-duplication plan. |
| **Private / internal leakage in diagrams** | **Pass** — No references in diagram blocks. |
| **Implementation detail exposure** | **Pass with notes** — `chrome.storage.local` appears in diagrams; already public elsewhere; no module filenames inside Mermaid. |

**Overall:** P1 diagrams are **fit for production** on GitHub. Issues found are **low severity** (terminology alignment, one triage-flow edge case). No blocking defects.

---

## Diagram inventory

| # | File | Section | Type | Node count (approx.) | Audience | P1 role |
|---|------|---------|------|----------------------|----------|---------|
| 1 | `docs/local-mode.md` | What runs where | `flowchart TB` | 7 | Public user | Local deployment topology |
| 2 | `docs/contributors/extension-architecture.md` | Message flow (simplified) | `sequenceDiagram` | 5 participants, 7 messages | Public contributor | Cross-surface messaging |
| 3 | `docs/analyst-workflows.md` | Typical triage flow | `flowchart TD` | 9 | Public user | Operator triage journey |
| 4 | `docs/contributors/enrichment-connectors.md` | Enrichment request flow | `sequenceDiagram` | 1 actor + 5 participants, `par` block | Public contributor | Live enrichment path |

**Out of P1 scope (not audited as P1 deliverables):**

| File | Notes |
|------|--------|
| `.internal/_DevNotes/TODO Files/Vera5-SGA-Implement.md` | Contains `flowchart TD` with week labels (W8, W9, …); **private**, roadmap-oriented; violates public hygiene if ever published. Not part of P1 public integration. |

**Tracked public repo:** Exactly **four** Mermaid blocks under `docs/` from P1 (confirmed via repository search).

---

## Per-diagram review

### 1. `docs/local-mode.md` — `flowchart TB`

| Criterion | Result |
|-----------|--------|
| Syntax | Valid `subgraph`, bidirectional and directed edges, node IDs without spaces (`CS`, `BG`, `Popup`, `Options`, `Store`, `Vendors`). |
| GitHub | Standard flowchart; widely supported. |
| Readability | Clear browser boundary; matches prior ASCII intent. |
| Node count | 7 — within budget. |
| Terminology | **Toolbar popup**, **Options page**, **Content script**, **Background worker** align with README operator surfaces. README also says **service worker** in capability prose; diagram uses **Background worker** (consistent with README code layout table). |
| Security | Edge label **HTTPS indicator only** preserves boundary; caption below diagram unchanged. |
| Implementation detail | `chrome.storage.local` as storage shape — already documented in `local-mode.md` table and SECURITY; acceptable. |

**Issues:** None blocking.

**Improvement opportunities (optional, future):**

- Subgraph label could add “hover card via content script” in prose only (diagram already crowded if added as node).
- Align README to prefer one of “background worker” / “service worker” globally (prose edit, not diagram).

---

### 2. `docs/contributors/extension-architecture.md` — `sequenceDiagram`

| Criterion | Result |
|-----------|--------|
| Syntax | Valid participants and arrows; display aliases use `as` syntax correctly. |
| GitHub | Supported. |
| Readability | Concise; shows why content does not call vendors directly. |
| Node count | 5 participants — within budget. |
| Terminology | **Toolbar popup**, **Content script**, **Background worker**, **Third-party APIs** match contributor and README language. |
| Omissions (intentional) | Does not show `enrichmentHandler`, Options-only messages separate from Popup, or React test UI — appropriate simplification. |
| Gap vs `local-mode` diagram | Options page messages to worker shown in topology diagram but sequence only lists **Popup** for UI→SW — minor inconsistency across files, not incorrect. |

**Issues:** None blocking.

**Improvement opportunities:**

- Rename participant `SW` to `BG` for consistency with enrichment diagram, or standardize on `SW` everywhere (see Terminology section).
- Optional message: “Options settings messages” if Options→SW path should be explicit (would add one arrow).

---

### 3. `docs/analyst-workflows.md` — `flowchart TD`

| Criterion | Result |
|-----------|--------|
| Syntax | Valid decision node `Enrich{Enrich needed?}` and labeled edges. |
| GitHub | Supported. |
| Readability | Good supplement to numbered list; operator-centric. |
| Node count | 9 — within budget. |
| Terminology | **Scan the page**, **hover card**, **pivot links**, **risk score** match README and same file’s numbered steps. README says **on-page overlay** for production UI; this file consistently uses **hover card** in operator steps — pre-existing prose convention, not introduced by diagram alone. |
| Flow fidelity | **Minor logic gap:** `Enrich -->|No| Pivot` skips **Fetch** and **Score**. Analyst may open card without new live fetch but still see **cached** enrichment and **risk score** (documented later in file). Diagram simplifies “no enrich” as jump to pivot; acceptable as overview, slightly lossy. |
| Missing stage | No explicit **Decision** node (analysis task suggested Decision); dismissal acts as terminal step — acceptable. |

**Issues:**

| ID | Severity | Description |
|----|----------|-------------|
| AW-1 | Low | “No” enrich path bypasses score even when card may show cached score/reasoning. |

**Improvement opportunities:**

- Add edge `Open --> Score` via dotted “cached data” path, or note under diagram: “Score may appear after open when enrichment results already exist.”
- Optional label sync: “on-page overlay” in one node label for README alignment.

---

### 4. `docs/contributors/enrichment-connectors.md` — `sequenceDiagram`

| Criterion | Result |
|-----------|--------|
| Syntax | Valid `actor`, `participant`, `par`/`end`, responses. |
| GitHub | `par` blocks supported on GitHub Mermaid (verify on preview if paranoid). |
| Readability | Canonical enrichment path; parallel AbuseIPDB + OTX clear. |
| Node count | 6 logical actors — within budget. |
| Terminology | **AbuseIPDB**, **OTX**, **Hover overlay**, **Background worker** match shipped connectors table in same file and README live enrichment. |
| Scope | Only live connectors shown — correct (URLScan/GreyNoise pivot-only per doc). |
| Implementation detail | **No** `abuseipdbConnector.ts` or handler names inside diagram. Prose below still names modules — outside Mermaid block. |
| UI participant | **Hover overlay** as separate lifeline from **Content script** — logical split for readers; technically overlay is rendered by content script (document as simplification). |

**Issues:**

| ID | Severity | Description |
|----|----------|-------------|
| EC-1 | Low | Participant alias `BG` vs `SW` in extension-architecture diagram. |
| EC-2 | Low | **Hover overlay** vs README **on-page overlay** wording. |

**Improvement opportunities:**

- Standardize worker participant ID/name across sequence diagrams.
- Cross-link from extension-architecture: “For enrich-specific sequence, see enrichment-connectors.md” (prose only, future).

---

## Issues found (summary)

| ID | File | Severity | Issue | Recommended action (future) |
|----|------|----------|-------|------------------------------|
| AW-1 | `docs/analyst-workflows.md` | Low | No-enrich path skips score/cache display | Prose note under diagram or small diagram tweak |
| EC-1 | Cross-file | Low | `SW` vs `BG` worker naming | Pick one alias in both sequence diagrams |
| EC-2 | Cross-file | Low | Hover overlay vs on-page overlay | Align labels with README in one pass (prose + diagrams) |
| EA-1 | `extension-architecture.md` | Low | Options not shown in sequence (only Popup) | Optional arrow or footnote |
| — | `README.md` | Info | Uses both “service worker” and “Background worker” | Global terminology pass (not P1) |

**No high or medium severity issues identified.**

---

## Improvement opportunities (prioritized)

| Priority | Opportunity | Effort |
|----------|-------------|--------|
| 1 | Add one-line note under analyst triage diagram clarifying score may appear from cache without **Fetch** | Trivial |
| 2 | Unify worker participant: `Background worker` / `BG` in both sequence diagrams | Small |
| 3 | Prefer **on-page overlay** in enrichment sequence display label while keeping file title “Hover overlay” section naming | Small |
| 4 | GitHub preview check on a test branch (four files) | Manual |
| 5 | P2 diagrams (`SECURITY.md`, `api-integrations.md`) per `Mermaid-Int-Analysis.md` — do not expand P1 files | Separate task |

---

## Duplicate detection results

### Workflow overlap matrix

|  | local-mode TB | extension-arch seq | analyst triage TD | enrichment seq |
|--|---------------|-------------------|------------------|----------------|
| **local-mode TB** | — | Related | Different | Related |
| **extension-arch seq** | Related | — | Different | **Overlaps** |
| **analyst triage TD** | Different | Different | — | Different |
| **enrichment seq** | Related | **Overlaps** | Different | — |

### Interpretation

| Relationship | Diagrams | Verdict |
|--------------|----------|---------|
| **Same workflow, same abstraction** | None | No harmful duplicates. |
| **Related, different abstraction** | extension-architecture ↔ enrichment-connectors | **Acceptable.** Extension-arch: generic messages + storage + vendor call. Enrichment: analyst-triggered enrich with **parallel** vendors and UI badges. Per `Mermaid-Int-Analysis.md` de-duplication table, enrichment-connectors owns the **canonical enrich sequence**. |
| **Related, different purpose** | local-mode ↔ extension-arch | **Acceptable.** local-mode = static topology; extension-arch = message sequence. |
| **Operator vs technical** | analyst-workflows ↔ enrichment-connectors | **Acceptable.** Triage is user steps; enrichment is component interaction. |

**Conclusion:** No duplicate diagram should be removed. Optional future cross-links in prose can reduce perceived redundancy without deleting diagrams.

---

## Terminology consistency vs README.md and contributor docs

| Term | README.md | P1 diagrams | Contributor prose | Match? |
|------|-----------|-------------|-------------------|--------|
| Primary page UI | On-page overlay | Hover overlay (enrichment seq only) | Hover card / overlay | Partial |
| Page UI (analyst doc) | On-page overlay | Hover card (triage) | hover card | Partial (analyst doc convention) |
| Worker | Service worker (table: Background worker) | Background worker | Background worker | Partial |
| Worker ID | — | `SW` vs `BG` | — | Inconsistent across diagrams |
| Popup | Toolbar popup | Toolbar popup | Popup | Yes |
| Settings | Settings (options) page | Options page | Options | Yes |
| Storage | chrome.storage.local (implied) | chrome.storage.local | chrome.storage.local | Yes |
| Vendors | AbuseIPDB, OTX (live) | Third-party APIs; named in enrichment | AbuseIPDB, OTX | Yes |
| Enrichment constraint | Indicator value only | HTTPS indicator only | Indicator only (prose) | Yes |

**Assessment:** Terminology is **good enough** for P1. Minor overlay and worker-alias inconsistencies are documentation-wide, not diagram-only failures.

---

## Implementation detail and sensitivity exposure

| Check | In diagram blocks? | Verdict |
|-------|---------------------|---------|
| API keys / secrets | No | Pass |
| `.internal/validation/` | No | Pass |
| `docs/_DevNotes/` | No | Pass |
| Week / AGENT / roadmap | No (public P1) | Pass |
| Module filenames (`*.ts`) | No | Pass |
| `enrichmentHandler`, `sanitizeEnrichmentIoc` | No | Pass |
| `chrome.storage.local` | Yes (2 diagrams) | Acceptable — public docs already disclose |
| Vendor names AbuseIPDB / OTX | Yes (enrichment only) | Acceptable — public product scope |

**Prose outside diagrams** in `enrichment-connectors.md` still references TypeScript modules; that predates P1 and is appropriate for contributor docs.

---

## Private / internal reference check (P1 files only)

| File | `_DevNotes` | `.internal` | `Task_Prompt` | `W*_` validation | In Mermaid block |
|------|------------|-------------|---------------|------------------|------------------|
| `docs/local-mode.md` | No | No | No | No | No |
| `docs/analyst-workflows.md` | No | No | No | No | No |
| `docs/contributors/extension-architecture.md` | No | No | No | No | No |
| `docs/contributors/enrichment-connectors.md` | No | No | No | No | No |

**Pass.** (`documentation-governance.md` mentions `.internal/` in rules text, not in a diagram.)

---

## GitHub compatibility assessment

| Feature used | Diagram(s) | GitHub support | Risk |
|--------------|------------|----------------|------|
| `flowchart TB` / `TD` | local-mode, analyst-workflows | Stable | Low |
| `subgraph` + quoted title | local-mode | Stable | Low |
| Decision `{text}` | analyst-workflows | Stable | Low |
| `sequenceDiagram` | extension-arch, enrichment | Stable | Low |
| `participant X as Label` | Both sequences | Stable | Low |
| `actor` | enrichment | Stable | Low |
| `par` / `end` | enrichment | Supported (modern GitHub) | Low |
| Solid/dashed arrows `-->>` | Both sequences | Stable | Low |
| Node IDs without spaces | All | Required — **met** | — |
| Cylinder DB shape `[(storage)]` | local-mode | Supported | Low |

**Not used (per P1 constraints):** `erDiagram`, `gantt`, `gitGraph`, `journey`, class diagrams, click callbacks, custom themes.

**Recommended validation:** Open each file on GitHub blob view or PR preview; confirm four diagrams render. Local VS Code preview may differ slightly from GitHub.

---

## Diagram size and complexity

| Diagram | Nodes | Edges/messages (approx.) | Complexity rating |
|---------|-------|--------------------------|-----------------|
| local-mode | 7 | 8 | Low |
| extension-architecture | 5 | 7 | Low |
| analyst-workflows | 9 | 10 | Low–medium |
| enrichment-connectors | 6 | 9 incl. par | Medium |

All diagrams are **below ~25 nodes** and suitable for GitHub without splitting.

---

## Node naming consistency

| Pattern | Observation |
|---------|-------------|
| IDs | `CS`, `BG`, `Popup`, `Options`, `Store`, `Vendors` — no spaces in IDs — **correct**. |
| Sequence participants | `SW` vs `BG` for same role — **inconsistent**. |
| Display labels | Sentence case, readable — **good**. |
| Vendor nodes | Proper nouns AbuseIPDB, OTX — **good**. |

---

## Readability assessment

| Diagram | Strength | Weakness |
|---------|----------|----------|
| local-mode | Replaces brittle ASCII; clear trust boundary to vendors | Does not label hover card explicitly inside subgraph |
| extension-architecture | Explains security boundary in one glance | Does not distinguish enrich vs scan message types |
| analyst-workflows | Fast onboarding for new analysts | Simplified enrich/no branch |
| enrichment-connectors | Best technical enrich reference | UI as separate actor may confuse overlay location |

---

## Compliance with `.cursor/rules/architecture.mdc`

| Rule | P1 compliance |
|------|----------------|
| Mermaid in fenced blocks | Yes |
| GitHub-supported types only | Yes |
| Under ~25 nodes | Yes |
| No secrets in public diagrams | Yes |
| Logical relationships vs hidden ops | Yes |
| Placement paths (`docs/contributors/` vs `docs/contributing/`) | Repo uses **`docs/contributors/`** — diagrams follow actual paths; rule file paths are stale (informational) |

---

## Final audit checklist

| Requirement | Status |
|-------------|--------|
| Mermaid syntax validity | **Pass** |
| GitHub compatibility | **Pass** (confirm via preview) |
| Diagram readability | **Pass** |
| Node naming consistency | **Pass with minor SW/BG note** |
| Terminology consistency | **Pass with minor overlay naming note** |
| No duplicate canonical workflows | **Pass** |
| Node count ≤ ~25 | **Pass** |
| No private/internal refs in diagrams | **Pass** |
| No inappropriate implementation exposure | **Pass** |
| Documentation files not modified by this audit | **Pass** |

---

## Recommended follow-up (execution, not part of this audit)

1. GitHub render smoke test on all four files.
2. Optional micro-fix pass: AW-1 prose note, EC-1 worker alias alignment (two files only).
3. Proceed to P2 scope from `Mermaid-Int-Analysis.md` only when explicitly requested; do not add diagrams to README or SECURITY without a new task.

---

*Audit complete. Only `Mermaid-Quality-Audit.md` was created; no other files were modified.*
