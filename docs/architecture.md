# Vera5 architecture

High-level structure for the browser extension codebase. Details expand as features ship.

## Extension package (`extension/`)

| Path | Ownership |
|------|-----------|
| `extension/src/background/` | Manifest V3 service worker: message routing, enrichment fetch orchestration, cache coordination, connector calls. No DOM access. |
| `extension/src/content/` | Content scripts: IOC detection, page highlighting, hover trigger wiring. Runs in page context. |
| `extension/src/popup/` | Browser action popup UI: enable/disable, quick status, shortcuts to options. |
| `extension/src/options/` | Options page: API keys (masked), source toggles, IOC type toggles, manual-only mode, cache controls. |
| `extension/src/components/` | Shared React UI: hover card, source badges, risk display, pivot actions. Used by popup, options, and content-injected UI. |
| `extension/src/lib/` | Shared non-UI modules: IOC regex, normalization, storage schema, cache, scoring, connector client interfaces. |

**Scaffold note:** `extension/src/placeholder.ts` is temporary tooling placeholder until background/content entrypoints land.

**Build output:** `extension/dist/` (gitignored) — Vite emit target; manifest wiring added when the extension build pipeline is finalized.

## Repository (root)

| Path | Ownership |
|------|-----------|
| `docs/` | Public and internal documentation. |
| `docs/acceptance/` | Internal sign-off checklists only. |
| `examples/` | Sample pages and IOC fixtures for manual testing. |
| `scripts/` | Maintainer build/dev helper scripts. |

## Principles

- Local-first enrichment; bring-your-own API keys.
- No required Vera5-hosted backend for MVP.
- IOC values only to configured third-party sources—not full page uploads.
