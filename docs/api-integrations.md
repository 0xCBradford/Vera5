# API integrations and rate limits

Vera5 enrichment uses **bring-your-own API keys**. Requests go from the extension directly to each vendor over HTTPS; Vera5 does not proxy indicators through Vera5-operated infrastructure. For connector scope, credential storage, and parallel fetch behavior, see [architecture.md](architecture.md).

Vendor quotas change with plan tier and policy updates. Treat the tables below as orientation; confirm your effective limits in each vendor account or API usage dashboard before heavy automation.

## Per-source rate limit matrix

| Source | Live in extension | Vera5 API call (per enrichment) | Vendor quota (typical) | Quota window | HTTP 429 | Vendor reference |
|--------|-------------------|----------------------------------|------------------------|--------------|----------|------------------|
| **AbuseIPDB** | Yes (IPv4) | `GET https://api.abuseipdb.com/api/v2/check` — one check per enabled source per hover enrichment | **1,000** checks/day (free); higher tiers: 3,000–50,000/day depending on subscription | Resets **00:00 UTC** (API v2 daily limit) | Yes; includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` | [AbuseIPDB API v2 — daily rate limits](https://docs.abuseipdb.com/) |
| **AlienVault OTX** | Yes (IPv4, domain, URL, hashes, CVE) | `GET https://otx.alienvault.com/api/v1/indicators/{type}/{value}` — one indicator lookup per enabled source per hover enrichment | **10,000** requests/hour with API key; **1,000** requests/hour without a key | Hourly (vendor-documented); contact vendor for sustained higher volume | Yes (documented); may also see timeouts on heavy endpoints | [OTX API overview](https://otx.alienvault.com/api) |
| **URLScan.io** | Not yet (settings slot and pivots only) | Planned: search/result endpoints for URL and domain indicators | Per-action limits: separate **minute**, **hour**, and **day** quotas; values vary by account — use `GET /api/v1/quotas` | Fixed windows; day resets **midnight UTC** | Yes; `X-Rate-Limit-*` headers per action | [urlscan.io API rate limits](https://docs.urlscan.io/pages/api-rate-limits) |
| **GreyNoise (community)** | Not yet (settings slot and pivots only) | Planned: `GET https://api.greynoise.io/v3/community/{ip}` for IPv4 | **50** lookups/week (free community account, combined with Visualizer); unauthenticated lookups more restricted (e.g. **10**/day cited in API errors) | Weekly / daily depending on authentication tier | Yes; JSON error body describes plan and limit | [GreyNoise Community API](https://docs.greynoise.io/docs/using-the-greynoise-community-api) |

### Quota impact of multi-source enrichment

When multiple live sources are enabled for an indicator type, Vera5 issues **one vendor request per enabled source in parallel** (for example, IPv4 hover enrichment with AbuseIPDB and OTX enabled consumes **one AbuseIPDB check** and **one OTX indicator request** per enrichment). Rapid repeated hovers on the same value can trigger multiple calls; there is no shared Vera5-side request pool.

Manual-only enrichment (default) reduces accidental quota use by requiring an explicit enrich action on each indicator.

## Vera5 extension behavior

### Request timeout

Live connectors abort outbound requests after **15 seconds** (`DEFAULT_ABUSEIPDB_REQUEST_TIMEOUT_MS` and `DEFAULT_OTX_REQUEST_TIMEOUT_MS`). Aborts surface as a timeout error on the hover card for that source.

### Rate-limit handling (HTTP 429)

When a vendor returns **429 Too Many Requests**, Vera5 maps the response to a rate-limited enrichment error for that source only. Other sources in the same parallel batch can still succeed (partial success UI).

The extension reads these response headers when present:

| Header | Used for |
|--------|----------|
| `Retry-After` | Seconds until retry (shown as “Retry after N seconds.”) |
| `X-RateLimit-Limit` | Parsed for diagnostics; not shown in UI |
| `X-RateLimit-Remaining` | Parsed; if zero with no `Retry-After`, hint may say quota exhausted |
| `X-RateLimit-Reset` | Unix epoch; converted to “Limit resets at …” when no `Retry-After` |

If no usable headers are present, the hover card shows a source-attributed backoff message (for example, “AbuseIPDB rate limit reached. Back off before retrying.”) and “Try again later.”

### Global enrichment cooldown

After any live connector receives **HTTP 429**, Vera5 also starts a **global** cooldown that blocks further **automatic** enrichment until the window expires. This is separate from the per-source error row shown for the request that triggered the limit.

| Behavior | Detail |
|----------|--------|
| **Trigger** | HTTP 429 from AbuseIPDB or OTX during a live fetch |
| **Duration** | `Retry-After` seconds when the vendor sends it; otherwise **60 seconds** default |
| **Maximum** | Cooldown capped at **3600 seconds** (one hour) |
| **Multiple 429s** | Cooldown extends to the **longest** active retry window |
| **While active** | Automatic enrichment returns a shared message (“Threat intelligence rate limit reached. Back off before retrying.”) with **Retry after N seconds.** instead of calling vendors |
| **Manual refresh** | **›** on a highlight (`bypassCache`) **bypasses** the global cooldown gate and still issues live vendor requests (the vendor may still return 429) |
| **Partial success** | In a parallel multi-source batch, sources that did not return 429 can still succeed on the same enrichment; the global cooldown applies to subsequent automatic requests |

Debounced auto enrichment (~400 ms when manual-only is off) and manual-only mode (default on) reduce accidental quota use; see [analyst-workflows.md](analyst-workflows.md).

URLScan.io uses a different `X-Rate-Limit-*` shape (scope, action, window). When URLScan is implemented, connectors should map those headers using the same user-facing backoff pattern.

### Other HTTP outcomes

| Status | Typical Vera5 mapping |
|--------|------------------------|
| 401 / 403 | Unauthorized — invalid or rejected API key |
| 408 | Timeout (vendor-reported) |
| Other 4xx/5xx | Vendor error with source attribution |

### IOC-only requests

Connectors send only the sanitized indicator value required by the vendor endpoint (for example, `ipAddress` query parameter for AbuseIPDB check). API keys travel in request headers (`Key`, `X-OTX-API-KEY`) from local extension storage, never in page content or Vera5-hosted relays.

## Monitoring and verification

- **AbuseIPDB:** Account → API Usage tab on [abuseipdb.com](https://www.abuseipdb.com/).
- **OTX:** API key from [OTX settings](https://otx.alienvault.com/); monitor usage through your key issuance workflow and vendor communications for high volume.
- **URLScan.io:** `GET https://urlscan.io/api/v1/quotas` with your API key when live integration ships.
- **GreyNoise:** [Search usage monitoring](https://docs.greynoise.io/) for community tier when live integration ships.

To validate Vera5 backoff messaging locally, enable a source, trigger enrichment until the vendor returns 429, and confirm the hover card shows the rate-limit message and retry hint for that source without affecting unrelated pivot links or disabled sources. Confirm subsequent automatic enrichment shows the global cooldown message until the countdown expires; **›** manual refresh should still attempt a live fetch.

## Related documentation

- [architecture.md](architecture.md) — MVP connector order, BYOK, parallel fetch, deferred sources
- [local-mode.md](local-mode.md) — local-first enrichment and quota expectations
- [security-model.md](security-model.md) — credential handling and user responsibilities
