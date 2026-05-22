# TODO Task Execution Protocol — Vera5

This document is the execution protocol authority for Cursor runs driven by repository root `Task_Prompt.txt`. `TODO.md` is the task source of truth; this file defines how tasks are selected, executed, verified, and closed.

---

## Purpose

- **Safe** — Only allowlisted paths are modified; secrets and API keys are never committed.
- **Deterministic** — Exactly one task per run; verification before checkbox closure.
- **Local-first** — No telemetry, no silent cloud uploads, no full-page exfiltration.
- **DEV/ROADMAP hygiene** — Internal build scaffolding never leaks into public-facing artifacts.

---

## DEV/ROADMAP HYGIENE (LOCKED)

Aligned with `TODO.md` **DEV/ROADMAP HYGIENE (LOCKED)**.

**Allowed only in:** `TODO.md`, `Task_Prompt.txt`, `docs/TODO_TASKS_Prompts.md`, `Reqd_User_Config.txt` (manual setup blocks).

**Never in:** source code, comments, filenames, folder names, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, public documentation, UI/extension copy, package metadata, manifest descriptions, generated examples, release notes, screenshot captions.

**Forbidden leakage examples:** Week/Day/Task numbering; AGENT/USER/AGENT/USER markers; Cursor/Claude/AI notes; roadmap/TODO/build-task labels; execution report / verification report / prompt protocol / internal governance wording; roadmap-sequenced placeholder names.

**Required:**

- Public docs and UI use product-native language (behavior, usage, architecture, security).
- Comments state technical reasoning only, not the TODO task that prompted the change.
- Names are domain-based, not roadmap-based.
- Release notes describe shipped capability, not AI/Cursor execution.
- `docs/acceptance/` may retain internal week/task references as internal-only artifacts; do not link them from public user docs.

**Enforcement per run:**

1. **Before edit** — Inspect intended paths; refuse edits that would leak scaffolding into public files.
2. **During edit** — No roadmap or AI-build references in comments, headers, names, docs (except allowlisted files), UI, config keys, metadata, or release text.
3. **At verification** — Confirm explicitly: *No internal roadmap, week/day/task, agent, Cursor, Claude, or prompt-protocol language was added to public-facing files.*

---

## BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) (LOCKED)

Aligned with `TODO.md` **BYOK/BYOA (Bring Your Own Keys / Bring Your Own API) GOVERNANCE (LOCKED)**.

During execution and verification, enforce:

- No shared or maintainer-hosted third-party API keys
- No default proxy of vendor enrichment through Vera5-operated infrastructure
- Credentials user-supplied and locally stored; never committed to git
- Optional backend modes localhost/self-hosted only unless a future governance decision says otherwise

---

## Core principles

- Execute **exactly one** unchecked task line from `TODO.md` per run.
- Bind to the **exact** task line text; on mismatch, output **TASK TEXT MISMATCH** and stop.
- Do not batch tasks or skip prerequisites.
- Prefer extending existing modules under `extension/`, `backend/`, `docs/`, `examples/`, `scripts/`.
- If behavior already exists, do not duplicate; run validation and report.
- **Idempotent** — Same task twice must not duplicate logic.

---

## Task selection

- If the operator supplies **Current TODO Objective** (week/day/task), locate that exact `- [ ]` line in `TODO.md`.
- If not supplied, select the earliest unchecked task whose prerequisites are complete.
- **Mismatch rule:** Stated task must match the `TODO.md` line exactly or stop.

---

## Write allowlist

May create or modify only:

- `extension/`
- `backend/` (when present)
- `docs/` (including `docs/acceptance/` when the task requires internal checklists)
- `examples/`
- `scripts/`
- `.github/`
- `Reqd_User_Config.txt` (repository root — manual backlog only)

**Task-explicit root public files:** When the exact `TODO.md` task line names a root public artifact, that file may be created or modified **for that run only**: `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`, `ideas.md`. Content must stay product-native per **DEV/ROADMAP HYGIENE**.

**Excluded during EXECUTE (unless task-explicit above or VERIFY-AND-CLOSE):** `TODO.md`, `Task_Prompt.txt`, `Vera5.md`, and any root public file not named on the task line.

**VERIFY-AND-CLOSE only:** `TODO.md` — flip **one** verified task checkbox from `- [ ]` to `- [x]`.

**Never commit:** API keys, secrets, `.env`, `.env.*`, local config with credentials, `chrome.storage` export dumps containing keys.

---

## Forbidden actions

- Execute more than one task per run.
- Invent scope not on the task line or week **Description** / **Out of scope**.
- Change unrelated files, public connector contracts, or manifest permissions unless the task requires it.
- **DEV/ROADMAP hygiene violation** — Add week/day/task labels, AGENT/USER markers, Cursor/Claude/AI-build notes, execution/verification-report jargon, prompt-protocol references, or internal governance wording to any public-facing file (see **DEV/ROADMAP HYGIENE**).
- Add week/day/task references in code, comments, filenames, folders, public docs, UI text, package metadata, manifest descriptions, examples, release notes, or captions (`docs/acceptance/` internal checklists excepted).
- Add developer notes or narrative to production code.
- Log or persist API keys in plaintext outside approved storage (extension secure storage / local backend env).

---

## Mandatory Execution Report

| Section | Content |
|---------|---------|
| **Task identifier** | Exact `- [ ]` line from `TODO.md`. |
| **Files modified** | Paths only. |
| **Summary of implementation** | What shipped or what already existed. |
| **Commands executed** | Exact commands. |
| **Test results** | Pass/fail per command. |
| **READY FOR VERIFY** | `Yes` or `No`. |

If blocked: report **BLOCKERS**, set READY FOR VERIFY = `No`, stop.

---

## Mandatory Verification Checklist

When READY FOR VERIFY = `Yes`:

1. Run minimum relevant tests/lint/build for the touched surface.
2. Inspect modified files — implementation matches the task line.
3. Confirm privacy/security invariants: no default telemetry; no key leakage; IOC-only enrichment queries where applicable; honest error handling when connectors exist.
4. Confirm **BYOK/BYOA** invariants when touching enrichment, storage, backend, or credentials (user-owned keys; no Vera5 credential relay).
5. Confirm **DEV/ROADMAP hygiene** — no internal roadmap, week/day/task, agent, Cursor, Claude, or prompt-protocol language in public-facing files; state this explicitly in the verification report.
6. Confirm no unrelated files changed.
7. Record exact paths, commands, and output.

---

## Mandatory Verification Report

| Section | Content |
|---------|---------|
| **Files inspected** | Exact paths. |
| **Commands executed** | Exact commands. |
| **Command output** | Pass/fail with relevant output. |
| **PASS or FAIL** | Single result. |

**PASS:** Mark **only** that task’s checkbox `- [x]` in `TODO.md`.  
**FAIL:** Output **FOLLOW-UP WORK**; do not modify `TODO.md`.

---

## Manual configuration

If the task requires user-only steps (API keys, Chrome load, store accounts, external dashboards):

- List under **Manual Steps Required** (what, why, where).
- Append to `Reqd_User_Config.txt` per `Task_Prompt.txt` (no duplicates).
- If none: state **NO MANUAL CONFIGURATION OR SETUP REQUIRED — PROCEED** in ALL CAPS.

---

## Non-regression

Previously completed tasks must keep working. Run minimal tests for dependent modules after edits.

---

## Protocol parity with `TODO.md` (confirmation checklist)

This file must stay aligned with repository governance. When confirming or updating the protocol, verify:

| `TODO.md` governance | Covered here |
|----------------------|--------------|
| Single-task execution, idempotency, TASK TEXT MISMATCH | Core principles, Task selection |
| Write allowlist + task-explicit root public files | Write allowlist |
| VERIFY-AND-CLOSE (one checkbox only) | Write allowlist, Verification Report |
| DEV/ROADMAP HYGIENE | DEV/ROADMAP HYGIENE |
| BYOK/BYOA | BYOK/BYOA |
| Mandatory Execution / Verification reports | Mandatory Execution Report, Verification Report |
| Manual setup → `Reqd_User_Config.txt` | Manual configuration |
| Secrets never in git | Write allowlist, Forbidden actions |
| `docs/acceptance/` internal-only week references | DEV/ROADMAP HYGIENE, Write allowlist |

`Task_Prompt.txt` must reference this file as protocol authority and mirror before-edit, during-edit, and verification hygiene rules.
