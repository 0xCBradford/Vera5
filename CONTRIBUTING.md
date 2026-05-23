# Contributing to Vera5

Thank you for helping improve Vera5. This project is an open-source browser extension for analyst-driven IOC enrichment. The extension scaffold and CI are in place; detection, UI, and connectors are not implemented yet.

## Before you start

- Read [README.md](README.md) for project scope and local-first operation.
- Read [SECURITY.md](SECURITY.md) for the threat model, IOC handling, and privacy expectations.
- Product and architecture notes live in [Product-Vision.md](Product-Vision.md).

## How to contribute

1. **Fork and branch** — Use a focused branch name that describes the change (for example `fix-ioc-detector-false-positive`).
2. **Keep changes small** — Prefer incremental pull requests over large mixed updates.
3. **Match existing style** — Follow patterns in the area you edit under `extension/` and `docs/`.
4. **Document behavior** — Update user-facing docs when you change install steps, permissions, connectors, or configuration.

## Development setup

The extension workspace lives under `extension/`. From that directory:

```bash
npm install
npm run check       # lint + unit tests
npm run build       # dist/ for unpacked Chrome load (+ manifest verify)
npm run build:watch # rebuild dist/ on save; reload extension in chrome://extensions
npm run dev         # Vite dev server for UI shells only (not a Chrome extension load)
```

See [README.md](README.md) for the full watch/build workflow and unpacked load steps.

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

### Optional git pre-commit hook

After `git init`, enable the repository hook template:

```bash
git config core.hooksPath .githooks
```

On Windows, ensure `pre-commit` is executable (Git Bash: `chmod +x .githooks/pre-commit`). The hook runs `npm run lint` and `npm run test` in `extension/`.

## Code and review expectations

- **No secrets in git** — Never commit API keys, `.env` files, tokens, or credential exports. Use local storage or private env files only.
- **IOC-only enrichment** — Do not add full-page upload, hidden telemetry, or maintainer-operated enrichment proxies unless an explicit, documented product decision says otherwise.
- **Source attribution** — When enrichment UI exists, show which connector produced each field.
- **Tests** — Add or update unit tests when you change detection, normalization, caching, or connector logic (as those modules land).

## Pull requests

Include in your PR description:

- What changed and why
- How you validated the change (commands run, manual browser checks)
- Screenshots for UI changes when applicable
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
