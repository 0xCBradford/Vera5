# Cache and rate limits

## Enrichment cache

**Module:** `extension/src/lib/cache.ts`

- Keys combine **indicator value + source id**.
- Successful responses are stored in `chrome.storage.local` with a TTL (default about one hour).
- Repeat enrichment reuses cache until expiry; UI shows **Cached** vs **Live**.

**Clear cache** on the Options page wipes stored responses without removing keys or toggles.

## Manual refresh

**›** on a highlight (content script) bypasses cache for that indicator: cached entries for that value are removed before fetch, and the global rate-limit cooldown gate is bypassed (vendors may still return HTTP 429).

## HTTP 429 and global cooldown

**Module:** `extension/src/lib/enrichmentCooldown.ts`

When a vendor returns **429 Too Many Requests**:

- That source shows a rate-limit error on the card.
- Vera5 may start a **global cooldown** blocking further **automatic** enrichment until the window passes.
- Manual **›** refresh can retry despite cooldown (vendor may still 429).

User-oriented explanation: [docs/analyst-workflows.md](../analyst-workflows.md) and [docs/api-integrations.md](../api-integrations.md).

## Debounced auto enrichment

With manual-only off, rapid hover opens coalesce (~400 ms) to the last indicator via `enrichmentAutoFetch.ts` to reduce accidental quota use.

## Timeouts

Connectors use a 15-second abort window (see `DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS` / OTX equivalent in connector modules).

## Tests

- `cache.test.ts`
- `enrichmentCooldown.test.ts`
- `enrichmentPipeline.regression.test.ts` (scan → enrich → cache → refresh paths)
