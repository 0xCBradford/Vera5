# Contributing to Vera5

Thank you for helping improve Vera5. This project is an open-source Chromium extension for analyst-driven IOC triage: on-page detection and highlights, a production content-script overlay, popup and workspace IOC trays, live AbuseIPDB and OTX connectors (bring-your-own API keys), local cache, composite risk scoring, export templates, trust and consent gates, investigation sessions, and IOC collections—all computed and stored locally in the browser.

## Before you start

- Read [README.md](README.md) for project scope, operator surfaces, install steps, and local-first operation.
- Read [SECURITY.md](SECURITY.md) for the threat model, IOC handling, and privacy expectations.
- Read [docs/contributors/README.md](docs/contributors/README.md) for architecture, modules, connectors, cache, scoring, and testing guidance.
- Product vision: [Product-Vision.md](Product-Vision.md). High-level scope and IOC types: [docs/architecture.md](docs/architecture.md).
- SOC-style HTML fixtures and manual validation: [docs/soc-validation-fixtures.md](docs/soc-validation-fixtures.md).

## How to contribute

1. **Fork and branch** — Use a focused branch name that describes the change (for example `fix-ioc-detector-false-positive`).
2. **Keep changes small** — Prefer incremental pull requests over large mixed updates.
3. **Match existing style** — Follow patterns in the area you edit under `extension/` and `docs/`.
4. **Document behavior** — Update user-facing docs under `docs/` (and `README.md` when install or capabilities change). Update [docs/contributors/](docs/contributors/) when you change architecture, connectors, cache, scoring, or test layout. UI screenshots for public docs: [docs/screenshots.md](docs/screenshots.md).

## Development setup

The extension workspace lives under `extension/`. CI uses **Node.js 20** (see `.github/workflows/extension-quality.yml`); match that locally when possible.

From `extension/`:

```bash
npm install
npm run check       # eslint + vitest (same as lint + test)
npm run build       # dist/ popup/options/background + content.js; postbuild runs verify:dist + verify:security
npm run build:watch # vite watch for popup/options/background only — not content.js; run full npm run build after content-script changes
npm run dev         # Vite dev server for UI shells only (not a Chrome extension load)
npm run typecheck   # tsc --noEmit (optional; not part of npm run check)
npm run test:smoke  # background message-router smoke only
```

Load unpacked from `extension/dist/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked). A **fresh install** opens the Settings page once so the install quick-start flow can run; reload the extension after rebuilds during development.

See [README.md](README.md) for the full watch/build workflow, fixture pages under `examples/`, and unpacked load steps.

### Repository root scripts (Windows)

| Script | Purpose |
|--------|---------|
| `.\scripts\check.ps1` | Lint + unit tests in `extension/` |
| `.\scripts\build.ps1` | `npm install` + `npm run build` in `extension/` |
| `.\scripts\dev.ps1` | Starts the Vite dev server in `extension/` (`npm run dev`) |

### Local quality gate (before commit or pull request)

Run lint and unit tests together:

```bash
cd extension
npm run check
```

Or from the repository root on Windows:

```powershell
.\scripts\check.ps1
```

### Dependency audit (CI)

Pull request CI runs `npm audit` with a two-tier policy:

| Scope | Command | CI result |
|-------|---------|-----------|
| Production dependencies (React runtime shipped in `dist/`) | `npm run audit:prod` (`npm audit --omit=dev`) | **Fails** the workflow when moderate or higher vulnerabilities are reported |
| All dependencies, including devDependencies | `npm audit` | **Warns** only — output is logged; the step does not fail the workflow |

Before opening a PR, run the blocking production audit locally:

```bash
cd extension
npm run audit:prod
```

Review the full tree separately when upgrading dev tooling:

```bash
cd extension
npm audit
```

Production dependencies (`react`, `react-dom`) and security-sensitive dev tools (`vitest`) use **exact versions** in `extension/package.json` (no `^` range) so CI and local installs resolve the same release.

### Secret scan (CI)

Gitleaks runs on every pull request and on every push to `main` (`.github/workflows/secret-scan.yml`, config `.github/gitleaks.toml`). A failing scan blocks merge or main integration until the finding is removed or allowlisted with maintainer review.

Local pre-push check (optional):

```bash
gitleaks detect --source . --config .github/gitleaks.toml
```

### Critical browser E2E smokes (CI)

Pull request CI runs the `browser-e2e-smokes` job in `.github/workflows/extension-quality.yml`. It builds `extension/dist/`, installs Playwright Chromium (`npx playwright install chromium --with-deps` on Linux), and runs `npm run test:e2e:critical` — mocked-vendor smokes for harness load, page scan, popup tray, overlay disclaimer and composite score, command palette scan, clipboard export, and bulk enrich queue. A failing smoke **fails the workflow** when branch protection requires the **browser-e2e-smokes** status check.

Full browser coverage (including investigation session and collection export specs not yet in the PR gate):

```bash
cd extension
npm run build
npm run test:e2e:install   # first time per machine
npm run test:e2e
```

Details, limits, and flake avoidance: [docs/contributors/testing.md](docs/contributors/testing.md).

Local pre-PR check (critical subset only):

```bash
cd extension
npm run build
npm run test:e2e:critical
```

Copy root `.env.example` to `.env` only for optional maintainer tooling or future local backend experiments. The extension does **not** read API keys from `.env`; analysts configure keys in **Vera5 Settings**. Credential variables in `.env.example` use empty placeholders only.

### Optional git pre-commit hook

After `git init`, enable the repository hook template:

```bash
git config core.hooksPath .githooks
```

On Windows, ensure `pre-commit` is executable (Git Bash: `chmod +x .githooks/pre-commit`). The hook runs `npm run lint` and `npm run test` in `extension/`.

## Code and review expectations

- **No secrets in git** — Never commit API keys, `.env` files, tokens, or credential exports. Use `chrome.storage.local` in the extension or private env files for tooling only.
- **IOC-only enrichment** — Do not add full-page upload, hidden telemetry, or maintainer-operated enrichment proxies unless an explicit, documented product decision says otherwise.
- **Source attribution** — Enrichment UI must show which connector produced each field.
- **Tests** — Add or update unit tests when you change detection, normalization, caching, scoring, or connector logic. Run `npm run check` in `extension/` before opening a PR. Use placeholders from `extension/src/lib/fixtureSecrets.ts` in tests; do not commit live keys.

## Pull requests

Include in your PR description:

- What changed and why
- How you validated the change (commands run, manual browser checks on `examples/` or a real page when UI behavior changes)
- Screenshots for UI changes when applicable (redact keys; see [docs/screenshots.md](docs/screenshots.md))
- Security or privacy impact, if any

Maintainers may request revisions before merge.

## Reporting bugs

Open a GitHub issue with:

- Browser and extension version
- Steps to reproduce
- Expected vs actual behavior
- Redacted screenshots or HTML samples (no live API keys, no sensitive IOCs you cannot share)

## Security issues

Do **not** file public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE) unless stated otherwise.

## Conduct

Be respectful and constructive. Security research and analyst workflows deserve careful, good-faith collaboration.
