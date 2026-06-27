## Summary

<!-- What changed and why? Keep the scope focused. -->

## Validation

<!-- Commands you ran and any manual browser checks. -->

- [ ] `cd extension && npm run check`
- [ ] `cd extension && npm run build`
- [ ] `cd extension && npm run audit:prod` (if dependencies changed)
- [ ] `cd extension && npm run test:e2e:critical` (if UI, scan, tray, overlay, export, palette, or enrich-queue behavior changed)
- [ ] Manual unpacked Chrome check on `examples/` or a redacted real page (if UI or extension load behavior changed)

**Commands and results:**

```text
(paste exact commands and pass/fail)
```

## UI / docs

<!-- Delete sections that do not apply. -->

- [ ] UI change — screenshots attached (keys and sensitive IOCs redacted; see docs/screenshots.md)
- [ ] User-facing docs updated (`README.md`, `docs/`, etc.)
- [ ] Contributor docs updated (`docs/contributors/`) — architecture, connectors, cache, scoring, or tests

## Security and privacy

<!-- Required when touching enrichment, storage, permissions, network fetch, or trust gates. -->

- [ ] No API keys, `.env` files, or credentials in this PR
- [ ] Enrichment still sends **indicator values only** to user-enabled vendors (no full-page upload, no maintainer proxy)
- [ ] Source attribution preserved for enrichment UI
- [ ] Security or privacy impact described below (or N/A)

**Impact notes:**

## Linked issues

<!-- Fixes #123 or relates to #456 -->
