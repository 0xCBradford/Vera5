# Contributor documentation

Guides for developers working on the Vera5 browser extension. These documents describe **how the codebase is organized** and **how major subsystems behave**. They do not replace [SECURITY.md](../../SECURITY.md) for threat modeling or [docs/analyst-workflows.md](../analyst-workflows.md) for operator usage.

## Start here

| Document | Topics |
|----------|--------|
| [extension-architecture.md](extension-architecture.md) | Package layout, build output, background vs content vs UI |
| [documentation-governance.md](documentation-governance.md) | Public vs private docs, link hygiene, naming |
| [testing.md](testing.md) | Lint, unit tests, golden fixtures, verify scripts |

## Subsystems

| Document | Topics |
|----------|--------|
| [detection-engine.md](detection-engine.md) | Regex, text walker, scan triggers, false-positive controls |
| [hover-overlay-architecture.md](hover-overlay-architecture.md) | Production overlay vs React test card, shared enrichment view-model |
| [settings-and-storage.md](settings-and-storage.md) | `chrome.storage.local` schema, export/import, keys |
| [enrichment-connectors.md](enrichment-connectors.md) | AbuseIPDB, OTX, parallel fetch, attribution |
| [cache-and-rate-limits.md](cache-and-rate-limits.md) | TTL cache, 429 cooldown, manual refresh |
| [scoring-system.md](scoring-system.md) | Composite bands, weights, disagreement, reasoning chain |
| [export-artifacts.md](../export-artifacts.md) | JSON `schemaVersion` and markdown/JSON field contract |

## Related public docs

- [docs/architecture.md](../architecture.md) — frozen MVP IOC and connector scope
- [docs/soc-validation-fixtures.md](../soc-validation-fixtures.md) — SOC HTML fixtures and repeatable validation checklist
- [docs/export-artifacts.md](../export-artifacts.md) — case artifact export field contract
- [docs/api-integrations.md](../api-integrations.md) — vendor quotas (user-oriented)
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — PR workflow and quality gate
