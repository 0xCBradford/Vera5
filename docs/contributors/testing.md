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
| Detection | `detector.test.ts`, `iocRegex.test.ts`, `fixtureTuning.test.ts` (includes `examples/sample-alert.html`, `sample-blog.html`, `sample-splunk-export.html`, `sample-security-onion-alert.html`) |
| Overlay / card | `hoverCardOverlay.test.ts`, `hoverCardEnrichment.test.ts`, `RiskScore.test.tsx` |
| Enrichment | `enrichmentHandler.test.ts`, `abuseipdbConnector.test.ts`, `otxConnector.test.ts` |
| Cache / cooldown | `cache.test.ts`, `enrichmentCooldown.test.ts` |
| Scoring | `scoring.test.ts`, `scoring.bands.golden.test.ts`, `scoring.vendorFixtures.golden.test.ts` |
| Export artifacts | `enrichmentExport.test.ts` (contract coverage), `enrichmentExport.golden.test.ts` (format snapshots), `exportTemplates.test.ts` (template routing), `exportTemplates.golden.test.ts` (per-template snapshots) |
| Background smoke | `messageHandler.smoke.test.ts` (`npm run test:smoke`) |

Golden tests lock band mapping, vendor fixture summaries, and markdown/JSON export artifacts; update snapshots deliberately when product rules change.

## Security verification

```bash
cd extension
npm run verify:security
```

Runs after `npm run build` via `postbuild`. Checks production bundles for unsafe patterns (no `eval`, no remote script URLs). See [docs/security-model.md](../security-model.md).

## Manual browser checks

Automated tests do not replace unpacked Chrome validation:

1. `npm run build` and load `extension/dist/`.
2. Serve `examples/` over HTTP (`python -m http.server` in `examples/`).
3. Scan `sample-alert.html`, `sample-splunk-export.html`, or `sample-security-onion-alert.html`; enrich with test keys, verify overlay score and cache labels. Fixture intent and checklist: [docs/soc-validation-fixtures.md](../soc-validation-fixtures.md).

Use redacted fixtures only in issues and PRs.

## CI

GitHub Actions workflows under `.github/workflows/` run lint, tests, and secret scanning on pull requests. Live vendor APIs are not called in CI.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR expectations
- [SECURITY.md](../../SECURITY.md) — reporting vulnerabilities (not public issues)
