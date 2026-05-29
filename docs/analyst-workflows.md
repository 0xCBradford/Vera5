# Analyst workflows

Practical guidance for using Vera5 during alert triage, blog review, and case-note research. Vera5 runs locally in your browser; you supply API keys for live sources. Indicator values—not full page content—are sent only to vendors you enable.

For install steps, see [README.md](../README.md). For quotas, HTTP 429 handling, and vendor limits, see [api-integrations.md](api-integrations.md).

## Before you start

1. Load the extension and open **Vera5 Settings**.
2. Save API keys for **AbuseIPDB** and/or **OTX** if you need live enrichment.
3. Enable only the sources you intend to use under **Enrichment sources**.
4. Leave **Manual-only enrichment** on (default) when working sensitive cases or when you want tight control over API usage. Turn it off only when you are comfortable with automatic fetches each time you open a hover card.

URLScan.io and GreyNoise toggles store preferences and provide pivot links; they do not perform live API enrichment in the current release.

## Typical triage flow

1. **Scan the page** from the toolbar popup (**Scan page**) or the keyboard shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y`).
2. **Review highlights** on indicators Vera5 detected in visible page text.
3. **Open the hover card** by clicking a highlighted value (or focus it and press Enter).
4. **Enrich when needed:**
   - With **manual-only** on, click the **›** icon on the highlight to request live threat intelligence.
   - With manual-only off, opening the card schedules enrichment automatically (see [Rapid clicks and quota protection](#rapid-clicks-and-quota-protection)).
5. **Copy** the indicator or use **pivot links** to open VirusTotal, OTX, AbuseIPDB, or URLScan in a new tab for deeper review.
6. **Dismiss** the card with Escape or by clicking outside it.

Use [examples/sample-blog.html](../examples/sample-blog.html) or [examples/sample-alert.html](../examples/sample-alert.html) for local practice after a build.

## Local enrichment cache

Vera5 keeps recent successful vendor responses in **local extension storage** so repeat lookups on the same indicator and source do not always call the API again.

| Concept | What it means for you |
|---------|------------------------|
| **Cache key** | One entry per indicator value **and** per source (for example, `8.8.8.8` from AbuseIPDB is separate from `8.8.8.8` from OTX). |
| **Time to live** | Entries expire after a default window (about one hour). After expiry, the next enrichment issues a fresh vendor request if you trigger enrichment again. |
| **Clear cache** | On the options page, **Clear cache** removes all stored responses. Settings and API keys stay in place. Use this after key rotation, when vendor data may have changed, or when you want to force fresh results without using manual refresh on each indicator. |

Cached data never leaves your machine except when you explicitly enrich or open a pivot link.

## Cached vs live on the hover card

When enrichment succeeds, the hover card shows whether data came from cache or a new API call:

| UI signal | Meaning |
|-----------|---------|
| **Live** badge (multi-source list) | That source returned a fresh response for this open. |
| **Cached** badge (multi-source list) | That source’s result was served from the local cache within the TTL window. |
| **Last updated: …** | When the cached or live response was recorded (single-source layout shows one line; multi-source shows per row). |
| **Source: … · live** or **· cached** (footer) | Single-source attribution for the primary summary. |

If one source is cached and another is live, read each row independently—partial cache use is normal when you have multiple sources enabled.

## Forcing a fresh lookup (manual refresh)

To bypass the cache for one indicator, click the **›** enrich control on the highlight (or use the same control while the hover card is open). Manual refresh:

- Skips cached responses for that indicator.
- Removes cached entries for that indicator before fetching.
- Bypasses the **global rate-limit cooldown** so you can retry deliberately (the vendor may still return 429).

Use manual refresh when case notes must reflect “as of now,” after you cleared the cache, or when cached summary looks stale.

## Rapid clicks and quota protection

Vera5 reduces accidental API churn in two ways:

1. **Debounced auto enrichment** — When manual-only mode is off, rapid opens of different highlights coalesce into one background fetch for the **last** indicator you opened (about 400 ms wait). Clicking through a list quickly should not fire a vendor request per click.
2. **Global cooldown after HTTP 429** — If a vendor returns **429 Too Many Requests**, Vera5 starts a short **global** backoff before further **automatic** enrichment runs. While cooldown is active, opening a card without manual-only (or waiting for debounced auto-fetch) shows a shared message (“Threat intelligence rate limit reached…”) and a **Retry after N seconds** hint instead of calling vendors again. **›** manual refresh bypasses that gate when you choose to retry.

Per-source rate-limit errors can still appear when only one vendor is throttled but others succeed; see [api-integrations.md](api-integrations.md).

## Multi-source review

With AbuseIPDB and OTX both enabled for IPv4:

- Vera5 queries each enabled source **in parallel**.
- The card summary prefers a successful primary source; failed sources remain visible with **Error** or **Skipped** badges.
- Expand **Raw response** on a source row to inspect redacted vendor JSON when you need audit detail.

Disable sources you do not need for a case to save quota and simplify the card.

## Operational checklist

| Goal | Suggested approach |
|------|-------------------|
| Minimize API usage | Manual-only on; avoid repeated **›** on the same IOC; rely on cache for repeat hovers. |
| Fresh data for one IOC | **›** manual refresh or clear cache then enrich. |
| Fresh data everywhere | **Clear cache** on the options page, then re-enrich indicators you care about. |
| Hit a rate limit | Read the retry hint; wait for cooldown; check vendor usage dashboards listed in [api-integrations.md](api-integrations.md). |
| Sensitive / classified work | Manual-only on; enable only approved sources; do not export settings with keys unless policy allows. |

## Troubleshooting

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| No enrichment, only pivots | Source disabled or no API key | Enable source and save key in settings. |
| “Add your … API key” | Missing key for that source | Open settings from the card action. |
| Cached summary but you need live data | Valid cache entry | Use **›** manual refresh. |
| All sources show rate-limit backoff | Global cooldown after 429 | Wait for the countdown hint; reduce hover churn. |
| AbuseIPDB works, OTX errors | Partial success | Read per-source badge and message; fix OTX key or quota. |
| Highlights missing | Extension off, highlight off, or scan not run | Enable extension and highlighting; scan the page. |

## Foundation capability traceability

Internal acceptance checklists in [`docs/acceptance/`](acceptance/) record sign-off criteria for each foundation capability layer through cache and rate-limit operations. Use the checklist that matches the behavior you are validating in the browser or in tests—not a single monolithic doc.

| Capability layer | What it covers | Acceptance checklist |
|------------------|----------------|----------------------|
| **Extension scaffold** | Manifest V3 load path, service worker, popup, options, build output | [`W1_7_1.md`](acceptance/W1_7_1.md) |
| **IOC detection** | Regex engine, on-demand scan, fixture tuning, false-positive guards | [`W2_7_1.md`](acceptance/W2_7_1.md) |
| **Highlights and hover shell** | On-page highlights, hover card, copy, static pivot links | [`W3_7_1.md`](acceptance/W3_7_1.md) |
| **Settings and privacy** | Masked API keys, toggles, manual-only mode, cache clear, settings export/import | [`W4_7_1.md`](acceptance/W4_7_1.md) |
| **First live enrichment** | AbuseIPDB IPv4 connector, worker routing, error paths | [`W5_7_1.md`](acceptance/W5_7_1.md) |
| **Multi-source enrichment** | OTX + parallel fetch, per-source badges, expandable raw JSON | [`W6_7_1.md`](acceptance/W6_7_1.md) |
| **Cache and rate limits** | TTL cache, Live/Cached labels, manual **›** refresh, 429 cooldown | [`W7_7_1.md`](acceptance/W7_7_1.md) |

Production-path foundation closure (overlay parity with the enrichment behaviors above) is tracked in [`W8_25_1.md`](acceptance/W8_25_1.md). Composite scoring acceptance is in [`W8_7_1.md`](acceptance/W8_7_1.md).

These artifacts are for maintainers and operator sign-off; they are not required reading for day-to-day triage.

## Related documentation

- [api-integrations.md](api-integrations.md) — per-source limits, 429 headers, and monitoring links
- [local-mode.md](local-mode.md) — what stays on your machine vs what reaches vendors
- [security-model.md](security-model.md) — permissions and host access
- [architecture.md](architecture.md) — supported indicator types and connector scope
