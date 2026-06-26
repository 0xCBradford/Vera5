# Testing

Quality gates for the extension workspace live under `extension/`.

## Standard commands

```bash
cd extension
npm run check      # eslint + vitest
npm run build      # dist/ + verify:dist + verify:security
npm run test       # vitest only
npm run test:e2e   # Playwright browser harness (requires build + browser install)
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

## Browser E2E (Playwright)

Playwright loads the unpacked production build (`extension/dist/`) in Chromium for smoke tests that need a real extension context. Specs live under `extension/e2e/` and share the fixture in `e2e/fixtures/extension.ts`.

### Prerequisites

- Node.js 20 (same as CI)
- Dependencies installed: `cd extension && npm ci`
- A fresh production build: `npm run build` (writes `dist/` and runs `verify:dist` / `verify:security`)

### First-time browser install

Playwright uses its own Chromium build (not the Chrome app on your machine). Install it once per machine or after upgrading `@playwright/test`:

```bash
cd extension
npm run test:e2e:install
```

On Linux (including CI), system libraries may be required:

```bash
npx playwright install chromium --with-deps
```

### Run locally

```bash
cd extension
npm run build
npm run test:e2e
```

`test:e2e` runs `verify-dist-manifest.mjs` first, then `playwright test`. The harness launches Chromium with `--load-extension` pointed at `dist/`, waits for the MV3 background service worker, and runs specs such as popup load checks in `e2e/harness.load.spec.ts`.

Optional Playwright CLI flags:

```bash
npx playwright test e2e/harness.load.spec.ts   # single spec
npx playwright test --ui                       # interactive UI mode
npx playwright show-trace test-results/.../trace.zip
```

Traces are retained on failure (`playwright.config.ts`).

### E2E layout

| Path | Role |
|------|------|
| `e2e/fixtures/extension.ts` | Persistent Chromium context loading unpacked `dist/` |
| `e2e/extensionPaths.ts` | Resolves `extension/dist` for the fixture |
| `e2e/*.spec.ts` | Browser smoke specs |
| `playwright.config.ts` | Serial workers, timeouts, CI reporters |

Browser E2E does not call live vendor APIs. Longer investigation flows will use deterministic fixtures and mocked enrichment in dedicated specs.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `dist/manifest.json missing — run npm run build first` | Run `npm run build` in `extension/` before `npm run test:e2e`. |
| Playwright cannot find Chromium | Run `npm run test:e2e:install` (Linux: add `--with-deps` as above). |
| Extension id / service worker timeout | Rebuild `dist/`; confirm `background.js` is present and `npm run verify:dist` passes. |

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

GitHub Actions workflows under `.github/workflows/` run lint, unit tests, production dependency audit (`npm run audit:prod`), a non-blocking full `npm audit` report for devDependencies, Gitleaks secret scanning on pull requests and pushes to `main`, and a `browser-e2e-harness` job in `extension-quality.yml` that builds `dist/`, installs Playwright Chromium, and runs `npm run test:e2e`. Live vendor APIs are not called in CI.

Local secret scan (same config as CI):

```bash
gitleaks detect --source . --config .github/gitleaks.toml
```

Repository root `.env.example` lists optional environment variables with empty credential placeholders; copy to `.env` locally (never commit populated `.env` files). `npm run verify:security` fails if credential keys in `.env.example` include values.

Production dependencies (`react`, `react-dom`) and `vitest` use exact versions in `extension/package.json`; bump them together with `package-lock.json` when addressing advisories.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR expectations
- [SECURITY.md](../../SECURITY.md) — reporting vulnerabilities (not public issues)
