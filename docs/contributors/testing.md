# Testing

Quality gates for the extension workspace live under `extension/`.

## Standard commands

```bash
cd extension
npm run check      # eslint + vitest
npm run build      # dist/ + verify:dist + verify:security
npm run test       # vitest only
npm run typecheck  # tsc --noEmit
```

From repository root on Windows: `.\scripts\check.ps1`

## Test layout

Vitest discovers tests alongside source (`*.test.ts`, `*.test.tsx`) under `extension/src/`.

| Area | Example files |
|------|----------------|
| Detection | `detector.test.ts`, `iocRegex.test.ts`, `fixtureTuning.test.ts` (includes `examples/sample-alert.html`, `sample-blog.html`, `sample-splunk-export.html`, `sample-security-onion-alert.html`); defang/refang and match provenance coverage in `iocRegex.test.ts`, `tabScanSnapshot.test.ts`, `tabScanSummary.test.ts`, `highlighter.test.ts`, `scanPage.test.ts`, and `hoverCardTrigger.test.ts` |
| Overlay / card | `hoverCardOverlay.test.ts`, `hoverCardEnrichment.test.ts`, `RiskScore.test.tsx` |
| Enrichment | `enrichmentHandler.test.ts`, `abuseipdbConnector.test.ts`, `otxConnector.test.ts` |
| Cache / cooldown | `cache.test.ts`, `enrichmentCooldown.test.ts` |
| Scoring | `scoring.test.ts`, `scoring.bands.golden.test.ts`, `scoring.vendorFixtures.golden.test.ts` |
| Export artifacts | `enrichmentExport.test.ts` (contract coverage), `enrichmentExport.golden.test.ts` (format snapshots), `exportTemplates.test.ts` (template routing), `exportTemplates.golden.test.ts` (per-template snapshots) |
| Background smoke | `messageHandler.smoke.test.ts` (`npm run test:smoke`) |

Golden tests lock band mapping, vendor fixture summaries, and markdown/JSON export artifacts; update snapshots deliberately when product rules change.

Use `fixtureSecrets.ts` placeholders for API keys in tests; do not add inline `secret-key` or similar literals. Committed vendor JSON fixtures must not contain unredacted sensitive field values.

## Security verification

```bash
cd extension
npm run verify:security
```

Runs after `npm run build` via `postbuild`. Checks extension-page CSP posture (no remote assets in popup/options HTML, no weakened manifest CSP), live fetch limited to connector hosts, no sensitive production logging (keys, bulk IOCs, raw vendor payloads), no `eval`, and no API key logging. See [docs/security-model.md](../security-model.md).

## Manual browser checks

Automated tests do not replace unpacked Chrome validation:

1. `npm run build` and load `extension/dist/`.
2. Serve `examples/` over HTTP (`python -m http.server` in `examples/`).
3. Scan `sample-alert.html`, `sample-splunk-export.html`, or `sample-security-onion-alert.html`; enrich with test keys, verify overlay score and cache labels. Fixture intent and checklist: [docs/soc-validation-fixtures.md](../soc-validation-fixtures.md).

Use redacted fixtures only in issues and PRs.

## CI

GitHub Actions workflows under `.github/workflows/` run lint, tests, production dependency audit (`npm run audit:prod`), a non-blocking full `npm audit` report for devDependencies, and Gitleaks secret scanning on pull requests and pushes to `main`. Live vendor APIs are not called in CI.

Local secret scan (same config as CI):

```bash
gitleaks detect --source . --config .github/gitleaks.toml
```

Repository root `.env.example` lists optional environment variables with empty credential placeholders; copy to `.env` locally (never commit populated `.env` files). `npm run verify:security` fails if credential keys in `.env.example` include values.

Production dependencies (`react`, `react-dom`) and `vitest` use exact versions in `extension/package.json`; bump them together with `package-lock.json` when addressing advisories.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR expectations
- [SECURITY.md](../../SECURITY.md) — reporting vulnerabilities (not public issues)
