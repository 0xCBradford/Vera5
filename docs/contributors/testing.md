# Testing

Quality gates for the extension workspace live under `extension/`.

## Standard commands

```bash
cd extension
npm run check      # eslint + vitest
npm run build      # dist/ + verify:dist + verify:security
npm run build:firefox   # dist-firefox/ + verify:firefox-manifest + verify:dist
npm run test       # vitest only
npm run test:e2e   # Playwright browser harness (requires build + browser install)
npm run test:e2e:critical   # PR-gate Investigation Mode smokes only
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
| `e2e/fixtures/extension.ts` | Persistent Chromium context loading unpacked `dist/`; registers mocked AbuseIPDB/OTX routes and a live-vendor network guard for every test |
| `e2e/fixtures/enrichmentMockRoutes.ts` | Fixture-backed vendor JSON responses, storage seed helpers, and live-request assertions |
| `e2e/fixtures/sampleAlertFixture.ts` | Fixed `sample-alert.html` IOC expectations, stable selectors, shared scan helpers |
| `e2e/fixtures/examplesServer.ts` | Local HTTP server for `examples/` pages used by browser smokes |
| `e2e/extensionPaths.ts` | Resolves `extension/dist` for the fixture |
| `e2e/*.spec.ts` | Browser smoke specs |
| `playwright.config.ts` | Serial workers, timeouts, CI reporters |

Browser E2E does not call live vendor APIs. The shared Playwright fixture in `e2e/fixtures/extension.ts` installs mocked AbuseIPDB/OTX HTTP responses (via the extension service worker fetch path) and aborts any other request to declared vendor hosts; each test asserts zero live enrichment network calls. Scan and tray smokes use `examples/sample-alert.html` served over HTTP with exact IOC counts and values centralized in `e2e/fixtures/sampleAlertFixture.ts`; enrich flows seed fixture API keys through the service worker when a spec needs live connector behavior.

### E2E scope and limits

Browser E2E validates Investigation Mode paths against a **real unpacked extension** in Chromium. It is a smoke layer, not full product or store certification.

**What the suite covers**

| Area | Examples |
|------|----------|
| Harness | Load `dist/`, open `popup.html`, service worker availability |
| Scan + tray | Fixed IOC set on `sample-alert.html`, popup tray listing |
| Hover card | Disclaimer, mocked multi-source composite score |
| Operator surfaces | Command palette scan, clipboard export, bulk enrich queue |
| Session + collection | Investigation session pin after tray navigation; save to collection and CSV export |

**PR gate vs full suite**

- `npm run test:e2e:critical` — subset wired in `extension/package.json` (harness, scan, tray, hover card disclaimer/score, command palette, export clipboard, enrich queue). CI runs this on pull requests.
- `npm run test:e2e` — all specs under `extension/e2e/`, including session/collection smokes not yet in the critical list. Run locally before expanding the PR gate.

**Known limits (do not expect E2E to prove these)**

| Limit | Detail |
|-------|--------|
| Browser matrix | Chromium via Playwright only — not installed Chrome, Edge, or Firefox |
| Popup UX | Harness opens `popup.html` in a **background extension tab**, not the toolbar popup overlay; tab-focus semantics differ from manual use |
| Page coverage | Deterministic `examples/` HTML over `127.0.0.1:8765` — not arbitrary live sites or authenticated portals |
| Vendor network | No live AbuseIPDB/OTX (or other) calls in CI; mocks and an abort guard only |
| Store / signing | No Web Store submission, update channels, or extension signing flows |
| Parallelism | `playwright.config.ts` sets `workers: 1` and `fullyParallel: false` — specs assume a serial, shared browser context |
| Timeouts | 60s per test, 10s default `expect` — long enrich queues or slow machines may need local investigation, not silent timeout bumps |
| Clipboard / downloads | Validated with harness helpers; OS permission prompts and save paths may differ from manual Chrome |
| Active tab | Popup tray and some navigation helpers query the **active** tab — wrong active tab yields empty tray or missed navigation |
| Collections UI | Popup collections manager loads on mount; after saving from the hover card or tray, reload popup before export assertions |
| Manual parity | Does not replace unpacked Chrome checks in [Manual browser checks](#manual-browser-checks) below |

### Flake avoidance

Extension E2E is sensitive to build drift, tab focus, and overlay positioning. Prefer deterministic fixtures and shared helpers over ad-hoc waits.

**Before you run**

1. `cd extension && npm run build` — stale `dist/` is the most common local failure.
2. Install Playwright Chromium once per machine (`npm run test:e2e:install`; Linux CI uses `--with-deps`).
3. Run the full suite serially; do not raise `workers` or enable `fullyParallel` for extension specs.

**When authoring or fixing specs**

| Practice | Why |
|----------|-----|
| Extend `e2e/fixtures/sampleAlertFixture.ts` | Centralizes IOC counts, values, and stable selectors (`E2E_SELECTORS`, product aria labels) |
| Use `expect.poll` for scan counts, scores, and session text | MV3 messaging and React updates are async |
| Keep mocked enrichment | Use `setupCiEnrichmentMocks` (global fixture) plus `seedEnrichmentMockStorage` / `seedExportSmokeStorage` when a spec needs keys or export-only paths — never call live vendor hosts |
| Serve fixtures over HTTP | Use `startExamplesServer()` so content scripts match production `http(s)://` origins |
| Preserve content tab focus | Call `contentPage.bringToFront()` before popup tray assertions if another step focused a different tab |
| Popup tray → page navigation | When popup runs as its own tab, clicking tray rows targets the wrong active tab; send `NAVIGATE_TO_IOC_ANCHOR` to the content tab via the service worker (see `runPopupTrayNavigationOnContentTab`) |
| Hover card save actions | Fixed-position overlay controls can sit outside Playwright’s clickable viewport; use in-page `evaluate` clicks for save-to-collection toggles when needed |
| Collections export | After creating a collection from the hover card or tray, `reload` the popup page before using the collections manager export buttons |
| Avoid bare `sleep` | Rely on Playwright auto-wait, `waitFor`, and `expect.poll` |
| Match export filenames loosely | Assert slug/date **patterns**, not wall-clock timestamps baked into downloads |
| Clean up pages | Close content and popup pages in `finally` blocks so tabs do not leak between specs |

**When a smoke fails**

1. Rebuild `dist/` and rerun the single spec: `npx playwright test e2e/<spec>.spec.ts`.
2. Open the retained trace from `test-results/.../trace.zip` (`npx playwright show-trace ...`).
3. Confirm no unexpected live vendor requests — the shared fixture fails the test if enrichment hosts are hit without mocks.
4. If the failure is tab-focus or overlay positioning, check the practices above before increasing timeouts.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `dist/manifest.json missing — run npm run build first` | Run `npm run build` in `extension/` before `npm run test:e2e`. |
| Playwright cannot find Chromium | Run `npm run test:e2e:install` (Linux: add `--with-deps` as above). |
| Extension id / service worker timeout | Rebuild `dist/`; confirm `background.js` is present and `npm run verify:dist` passes. |
| Popup tray empty or missing IOC rows | Ensure the content fixture tab is active (`bringToFront`) before opening or asserting popup tray results. |
| Hover card click times out (outside viewport) | Scroll is unreliable on fixed overlays; use in-page `evaluate` to activate save-to-collection controls. |
| Collection export button missing | Reload popup after saving a collection from another surface so the collections manager refetches storage. |
| Intermittent pass locally, fail in CI | Run `npm run test:e2e:critical` on a clean `npm ci` + `npm run build`; inspect trace; do not add live vendor calls. |

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

GitHub Actions workflows under `.github/workflows/` run lint, unit tests, production dependency audit (`npm run audit:prod`), a non-blocking full `npm audit` report for devDependencies, Gitleaks secret scanning on pull requests and pushes to `main`, a `browser-e2e-smokes` job in `extension-quality.yml` on every pull request that builds `dist/`, installs Playwright Chromium, and runs `npm run test:e2e:critical`, and a `firefox-artifact` job in the same workflow that builds both `dist/` and `dist-firefox/` (`npm run build` then `npm run build:firefox`) and uploads the Firefox unpack directory as a workflow artifact. A failing critical smoke fails the job and the pull request workflow; enable **browser-e2e-smokes** as a required status check on the default branch to block merge. Manual workflow runs can set **Skip browser E2E smokes** when quota-sensitive; pull request checks always run the smokes. Live vendor APIs are not called in CI.

Local secret scan (same config as CI):

```bash
gitleaks detect --source . --config .github/gitleaks.toml
```

Repository root `.env.example` lists optional environment variables with empty credential placeholders; copy to `.env` locally (never commit populated `.env` files). `npm run verify:security` fails if credential keys in `.env.example` include values.

Production dependencies (`react`, `react-dom`) and `vitest` use exact versions in `extension/package.json`; bump them together with `package-lock.json` when addressing advisories.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR expectations
- [SECURITY.md](../../SECURITY.md) — reporting vulnerabilities (not public issues)
