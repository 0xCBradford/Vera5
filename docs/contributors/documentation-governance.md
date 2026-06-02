# Documentation governance

Rules for keeping Vera5 documentation accurate, public-appropriate, and separated by audience.

## Directory roles

| Location | Audience | In git (public repo) |
|----------|----------|----------------------|
| `docs/` (except `contributors/` topics) | Analysts and operators | Yes |
| `docs/contributors/` | Open-source contributors | Yes |
| `README.md`, `SECURITY.md`, `CONTRIBUTING.md` | Users and contributors | Yes |
| `.internal/` | Maintainers only | No (gitignored) |
| `.internal/validation/` | Maintainer sign-off and verification evidence | No |

Treat **`docs/` as public**. Do not place maintainer-only validation checklists under `docs/`.

## Private validation artifacts

Maintainer validation files live under **`.internal/validation/`**.

- Filename pattern: `<capability>-validation.md` (for example `cache-rate-limits-validation.md`).
- May include sign-off tables, test counts, dated evidence, and references to manual setup notes.
- Must **not** be linked from any public markdown file.

Forbidden in public docs: paths such as `.internal/validation/`, legacy week-based validation filenames, and instructions to open private checklists.

## Public user documentation

**Purpose:** Install, configure, operate, troubleshoot, and interpret the product.

**Typical files:** `README.md`, `docs/analyst-workflows.md`, `docs/api-integrations.md`, `docs/local-mode.md`, `docs/security-model.md`, `SECURITY.md`.

**Rules:**

- Product-native language describing **shipped** behavior.
- Link only to files that exist in the public git tree (`git ls-files`).
- No internal validation paths, no private governance file names, no roadmap-style artifact IDs in prose.

## Public contributor documentation

**Purpose:** Explain architecture, modules, connectors, cache, scoring, and how to test changes.

**Location:** `docs/contributors/` (this directory).

**Rules:**

- Extract stable design from code and tests; do not copy private sign-off tables into public files.
- When behavior changes, update the relevant contributor doc in the same change set as code (or immediately after).
- Cross-link `SECURITY.md` for threat model and secret handling instead of duplicating full policy in every file.

## Link hygiene

Before merging documentation changes:

1. Confirm every relative markdown link target is tracked publicly (or is a valid external URL).
2. Search public markdown for `.internal/`, `acceptance/`, and legacy `W*_*.md` validation names.
3. Private validation may link **to** public docs; public docs must not link **to** private validation.

## Naming conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Private validation | `<capability>-validation.md` | `composite-scoring-validation.md` |
| Contributor topic | `<topic>.md` under `docs/contributors/` | `enrichment-connectors.md` |
| User guide | Existing product names | `analyst-workflows.md` |

## When to update which doc

| Change type | Update |
|-------------|--------|
| Analyst-visible UI or workflow | `README.md`, `docs/analyst-workflows.md` |
| Vendor limits or 429 behavior | `docs/api-integrations.md` |
| Permissions or manifest | `docs/security-model.md`, `SECURITY.md`, manifest |
| Module layout, connectors, cache, scoring | Relevant `docs/contributors/*.md`, optionally trim `docs/architecture.md` |
| Maintainer sign-off only | `.internal/validation/<capability>-validation.md` |

## Hygiene expectations for contributors

- Do not add roadmap-scaffold headings, execution-report jargon, or private checklist pointers to public files.
- Prefer capability names ("overlay scoring", "multi-source enrichment") over internal artifact IDs in PR descriptions and public docs.
- Run `npm run check` in `extension/` when code changes; documentation-only PRs should still pass link and grep review above.

## Related

- [README.md](README.md) — contributor doc index
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR workflow
