# Security Policy

Vera5 is a local-first browser extension for indicator detection and threat-intelligence enrichment. This document describes the security and privacy model for the extension as shipped in the repository: on-page detection, settings and key storage, cache controls, and static pivot links. Live vendor API enrichment uses the rules below when connectors are enabled; Vera5 does not operate a required cloud enrichment service.

For permission rationale and manifest details, see [docs/security-model.md](docs/security-model.md). For codebase layout and connector scope, see [docs/architecture.md](docs/architecture.md).

## Scope

Vera5 runs in your browser on pages you open. It may read visible page text to detect indicators of compromise (IOCs). Enrichment and pivots use **your** threat-intelligence API keys and **your** choice of sources (bring-your-own keys / bring-your-own API). Requests to vendors go directly from the extension over TLS—not through Vera5-operated infrastructure.

**Privacy and enrichment invariants (unchanged in the MVP):**

- **Bring-your-own keys / bring-your-own API (BYOK/BYOA)** — You create and control vendor API keys in local extension storage. Vera5 does not supply shared maintainer keys or require routing enrichment through Vera5-hosted infrastructure.
- **IOC-only enrichment queries** — Live enrichment sends the **indicator value** (and API fields each vendor requires) to sources **you** enable—not full page HTML, browsing history, or bulk content to Vera5-operated services (there is no Vera5 enrichment cloud in the MVP).
- **No telemetry by default** — Vera5 does not collect maintainer usage analytics, crash telemetry, or browsing history by default. See [Telemetry and analytics](#telemetry-and-analytics).

## Threat model

| Risk | Mitigation |
|------|------------|
| Extension access to page DOM | Scan visible text for IOC detection; skip `script`, `style`, `textarea`, and metadata subtrees by default; do not scan attributes. Highlighting and cards operate on detected values only. |
| API key exposure | Keys stored in `chrome.storage.local` on your profile; masked in the options UI after save; excluded from settings export by default; never committed to the repository. |
| IOC disclosure to third parties | Only indicator values you enrich (or open via pivot links) reach vendors you choose—not full page HTML to Vera5 infrastructure. Per-source toggles and manual-only mode limit automatic requests. |
| Sensitive internal IOCs leaving the org | You control which sources are enabled, whether auto-fetch runs, and when to click enrich or pivot links. |
| Malicious or confusing page content | Conservative regex matching, overlap deduplication, and documented false-positive suppressions reduce noise. DOM confusion scenarios (decoy IOCs, fake UI chrome, selection tricks) and implemented mitigations are documented in [docs/security-model.md](docs/security-model.md#malicious-page-dom-confusion). |
| Analyst misinterpretation | Source attribution on enrichment results; static pivots open vendor sites in a new tab under your browser session. |

## IOC leakage

Understanding what stays on your machine versus what can leave the browser is central to using Vera5 safely in SOC, CTI, and DFIR workflows.

**IOC and data boundary**

```mermaid
flowchart LR
  subgraph Vera5Ext[Vera5 Extension]
    Page[Page content]
    Detect[Local detection]
    IOC[Detected IOC]
    Review[User review]
    Action[User enrichment action]
    Store[(Local storage)]
  end
  Vendors[Third-party vendor APIs]

  Page --> Detect
  Detect --> IOC
  IOC --> Review
  Review --> Action
  Action -->|When you choose| Vendors
  Store --- Review
```

Page text and detection stay in the browser. Only the **indicator value** may reach third-party vendor APIs you enable, and only when you review and trigger enrichment (or allow automatic fetch when manual-only is off). Settings and cache remain in local storage. Vera5 does not operate a required enrichment cloud or page-upload service.

Runtime component layout: [docs/local-mode.md](docs/local-mode.md). Enrichment message path: [docs/contributors/enrichment-connectors.md](docs/contributors/enrichment-connectors.md).

### Stays local (does not go to Vera5)

| Data | Handling |
|------|----------|
| Full page HTML and DOM | Processed in the browser for detection only. Not uploaded to Vera5-operated servers (there is no Vera5 enrichment cloud). |
| Browsing history and tab URLs | Not collected or transmitted to Vera5 maintainers. |
| Tickets, email bodies, session tokens | Not extracted or uploaded as bulk content; only text nodes walked for indicator patterns. |
| Scan results before you act | Match counts in the popup and on-page highlights remain local until you open a card or follow a link. |

### May leave the browser (your choice)

| Action | What is transmitted | Destination |
|--------|---------------------|-------------|
| **Live enrichment** (when a connector is enabled and you trigger or allow fetch) | The **indicator value** and request fields required by that vendor’s API (for example IP, hash, or domain in URL or JSON body). | Directly to the third-party API you configured, using your API key. |
| **Static pivot links** | The indicator value embedded in the vendor URL you click (for example a VirusTotal or AbuseIPDB lookup URL). | The vendor site, via normal browser navigation in a new tab. Vera5 does not proxy pivot traffic. |
| **Settings export** | Preferences you export as JSON. API keys are **omitted unless you explicitly choose to include them**. | A file you save locally; Vera5 does not receive the export. |

### Controls that reduce unintended leakage

- **Manual-only enrichment** (default on): Threat-intelligence fetch runs only when you use the enrich control, not automatically when you open the on-page triage overlay.
- **Per-source enable flags**: Disabled sources are not queried and are omitted from automatic enrichment paths.
- **Pre-query disclosure** (default on until you choose in Settings): When live enrichment is allowed, the overlay shows an inline notice naming enabled vendors and the indicator value before any HTTPS vendor call. **Send query** proceeds; **Cancel** aborts; **Don't show this notice again** turns off future notices (same as the **Trust & consent** toggle).
- **Domain policy** (default allow-by-default with sensitive webmail denylist): Hostname allow/deny lists gate auto-scan and live enrichment. Denylisted origins skip mutation rescans and block vendor calls before pre-query disclosure when the domain enrich gate is on (default). Manage under **Trust & consent** in Vera5 Settings.
- **Internal asset lists** (enrich gate on by default): Indicator-level domain, IPv4 CIDR, and labeled vendor/SaaS patterns can block live enrichment for matching IOC values even on otherwise allowed pages—before pre-query disclosure runs.
- **Supported IOC types (current release)**: Options exposes per-type detection toggles (IPv4, domain, URL, MD5, SHA1, SHA256, CVE). Disabled types are omitted from page scans; defaults enable all MVP types.
- **Private-space IPv4**: Omitted from detection by default (RFC1918, loopback, link-local). Options includes a checkbox to include them when needed for lab or internal pages.
- **Auto-scan off by default**: Page rescans on DOM changes run only when you enable auto-scan; when enabled, rescans respect the same domain policy as live enrichment.

### What Vera5 never sends to its own infrastructure

Vera5 does not operate a default enrichment proxy, telemetry ingest, or page-content upload service. Maintainer-hosted servers are not part of the MVP privacy model.

## Third-party APIs

### Bring-your-own keys / bring-your-own API

You create API keys in each vendor’s portal and enter them in the Vera5 options page. Keys are stored locally in extension storage. Vera5 does not supply shared maintainer keys or require routing enrichment through a Vera5-hosted backend.

### Registered enrichment sources (MVP scope)

Twelve sources appear in Vera5 Settings and the on-page overlay registry: **AbuseIPDB**, **OTX**, **VirusTotal**, **URLScan.io**, **GreyNoise**, **Shodan**, **Google Safe Browsing**, **Pulsedive**, **MalwareBazaar**, **Censys**, **ThreatFox**, and **URLhaus**. Only **AbuseIPDB** and **OTX** perform live HTTPS enrichment in this release. Other enabled sources may show missing-key, unsupported-type, or not-implemented status rows; pivot links still appear where the registry defines them for the indicator type. Saved API keys for non-live sources stay in local storage and are not sent to those vendors.

### How vendor requests work

1. You enable a source and provide a valid API key (where required).
2. You scan a page or open an indicator card and request enrichment (manually or, if manual-only is off, automatically on card open when connectors are wired).
3. The extension’s background worker sends an HTTPS request **directly** to the vendor endpoint, including only the indicator and parameters the API requires.
4. Responses are normalized for display, attributed to the source, and may be cached locally (see below).

### Static pivots versus live enrichment

| Mechanism | Network from Vera5 extension | Your responsibility |
|-----------|------------------------------|---------------------|
| **Static pivot links** | No API call from the extension; your browser opens a vendor URL. | You choose when to click; the URL contains the indicator. |
| **Live enrichment** | HTTPS API call with your key and the indicator value. | You enable the source, trust the vendor’s terms, and understand quota and retention policies. |

### Your responsibilities when using third-party APIs

- Choose which vendors to enable and which keys to store.
- Read each vendor’s privacy policy, data retention, subprocessors, and jurisdictional terms.
- Avoid sending highly sensitive or classified indicators to vendors your organization has not approved.
- Monitor API quota, rate limits, and audit logs on the vendor side where available.

Per-vendor terms and privacy links for all registered enrichment sources: [docs/api-integrations.md — Vendor terms, privacy, and acceptable use](docs/api-integrations.md#vendor-terms-privacy-and-acceptable-use).

Vera5 surfaces source attribution on enrichment results so you can see which connector produced each field.

## Data retained locally

All Vera5-controlled persistence uses the browser’s **local extension storage** (`chrome.storage.local` or equivalent on Chromium derivatives). Data is bound to your browser profile and is removed when you uninstall the extension or clear extension site data for Vera5.

### Settings and preferences

| Storage key (concept) | Contents | Default / notes |
|-----------------------|----------|-----------------|
| Extension enabled | Whether Vera5 runs on pages. | On. |
| Highlight enabled | Whether detected indicators are underlined after scan. | On. |
| Auto-scan enabled | Whether DOM changes trigger rescans. | Off. |
| Manual-only mode | When on, enrichment fetch requires explicit user action. | On. |
| Include private IPv4 | Whether private-space IPv4 literals are detected. | Off (default). Options checkbox persists the flag; the scan path reads it on each scan. |
| Enrichment source enabled | Per-vendor on/off for all twelve registered sources listed above. | All off until you enable. |
| IOC type enabled | Per-type detection toggles (IPv4, domain, URL, hashes, CVE). | Defaults all MVP types **on**. Options checkboxes persist flags; the scan path omits disabled types. |
| Enrichment cache TTL | Seconds cached responses remain valid (used when cache is populated). | Default 3600. Options exposes a global seconds field and optional per-source overrides. |
| Settings schema version | Migration marker for stored preferences. | Managed by the extension. |

### API keys

| Storage key (concept) | Contents | Notes |
|-----------------------|----------|-------|
| API keys | Vendor credentials you enter (AbuseIPDB, OTX, etc.). | Plaintext in local storage (browser sandbox); masked in the UI after save; never logged by Vera5 build checks; excluded from export unless you opt in. |

### Enrichment cache

| Storage key (concept) | Contents | Notes |
|-----------------------|----------|-------|
| Enrichment cache | Cached vendor JSON responses keyed by indicator and source, with fetch timestamp. | Populated when live enrichment runs; clearable from options; does not include full page content—only normalized enrichment payloads for indicators you queried. |

### Settings backup files

Export produces a JSON file on your machine. By default it contains preferences and toggles **without** API keys. Import merges preferences and preserves existing keys unless the file explicitly included keys and you imported that file.

### What is not retained by Vera5

- No maintainer telemetry or crash reports by default.
- No cloud sync of settings or keys to Vera5 servers.
- No copy of page HTML or browsing history in extension storage.

### Clearing retained data

| Goal | Action |
|------|--------|
| Remove cached enrichment responses | **Clear cache** on the options page. |
| Remove API keys | Delete keys in the options UI or clear extension storage. |
| Remove all Vera5 local data | Uninstall the extension or clear its storage in browser settings. |

## Telemetry and analytics

**Default stance: no telemetry.**

Vera5 is not designed to collect usage analytics, crash telemetry, or browsing history for the maintainers. If optional diagnostics are ever offered, they must be explicit, documented, and off by default.

## Secrets and repository hygiene

- Do not commit API keys, `.env` files, or credential exports.
- Use the project `.gitignore` and local secret storage only.
- Do not paste keys into screenshots, issues, or public discussions.
- CI runs secret scanning (Gitleaks) on pull requests and on every push to `main`; treat any leaked key as compromised and rotate it at the vendor.

## Local-first and optional backend

The extension is intended to work without a Vera5-hosted backend. An optional **localhost / self-hosted** backend may be used in future releases to keep keys off the extension surface; that mode remains under your control and is not required for the extension-only MVP.

## Trust and query checklist

Use this checklist to confirm consent and hostname controls before live threat-intelligence queries leave the browser. Detailed pattern guidance and permission rationale: [docs/security-model.md](docs/security-model.md) (domain policy, internal asset lists, sensitive-site presets).

### Outbound query gate order (live enrichment)

When you trigger live enrichment (AbuseIPDB and/or OTX when enabled), the extension evaluates gates in this order:

| Step | Gate | When blocked |
|------|------|--------------|
| 1 | Enabled live sources for the IOC type | Overlay shows a settings guidance message; no vendor call. |
| 2 | Domain policy enrich gate (default **on**) | Overlay shows that queries are blocked for this site by domain policy; no vendor call and no pre-query disclosure. |
| 3 | Internal asset enrich gate (default **on**) | Overlay shows that the indicator matches a configured internal asset list; no vendor call and no pre-query disclosure. |
| 4 | Pre-query disclosure (default **on** until first Settings choice) | Inline notice names enabled vendors and the indicator value; **Cancel** aborts without a vendor call. |
| 5 | Service worker fetch | HTTPS request with the indicator value and your API key directly to the vendor you enabled. |

Only the **indicator value** (plus API fields each vendor requires) is transmitted. Full page HTML is not sent.

### Pre-query disclosure — verify

| Check | Expected shipped behavior |
|-------|---------------------------|
| First visit to Settings | **Pre-query notices** card prompts you to enable or disable inline notices before vendor calls. |
| Notices enabled | Opening live enrich on an allowed host shows an inline notice listing enabled live vendors and the indicator value before fetch. |
| **Send query** | Proceeds to the service worker fetch when prior gates pass. |
| **Cancel** | Aborts; overlay returns without sending the indicator to vendors. |
| **Don't show this notice again** | Persists off for future enrichments (same as disabling pre-query notices under **Trust & consent**). |
| Notices disabled | Live enrich skips the inline notice when other gates pass. |
| No live sources enabled for the IOC type | Disclosure does not run; enrichment stops at the disabled-sources message. |

Disclosure applies only to **live** connector fetches (AbuseIPDB and OTX today). Static pivot links open vendor URLs in your browser separately when you click them.

### Domain policy — verify

| Check | Expected shipped behavior |
|-------|---------------------------|
| Default mode | **Allow by default** — scan and enrich on all hosts except denylisted entries. |
| Default denylist | Sensitive webmail patterns (`mail.*`, `webmail.*`, `outlook.office.com`, `outlook.live.com`, `mail.google.com`, `mail.yahoo.com`) block auto-scan and live enrich without manual setup. |
| Deny-by-default mode (optional) | Auto-scan and live enrich run **only** on allowlisted hosts. |
| Domain enrich gate (default **on**) | Denylisted or non-allowlisted hosts (per mode) block vendor calls **before** pre-query disclosure. |
| Domain enrich gate off | Hostname lists do not block live enrich (auto-scan still follows lists when enabled). |
| Auto-scan enabled | Mutation rescans run only on hosts allowed by domain policy; denylisted origins do not schedule rescans. |
| **Sensitive sites denylist** preset | Merges banking, health, and HR hostname patterns into the denylist under allow-by-default mode. |

Manage mode, lists, enrich gate, and presets under **Trust & consent** in Vera5 Settings.

### Internal asset lists — verify

| Check | Expected shipped behavior |
|-------|---------------------------|
| Lists empty (default) | No indicator-level blocks. |
| Domain, IPv4 CIDR, or labeled vendor/SaaS entries configured | Matching IOC values block live enrich before pre-query disclosure, even on otherwise allowed SOC pages. |
| Internal asset enrich gate off | Lists are ignored for live enrich blocking. |

### Analyst quick review before sensitive browsing

- [ ] Confirm **Manual-only enrichment** matches your workflow (default on).
- [ ] Review **Trust & consent**: pre-query notices, domain mode, allow/deny lists, domain enrich gate, internal asset lists.
- [ ] Apply the **Sensitive sites denylist** preset or add org-specific denylist entries for webmail, banking, health, or HR hosts you use.
- [ ] Enable only live sources (AbuseIPDB / OTX) and keys you are authorized to use.
- [ ] On a denylisted host, confirm scan/rescan and live enrich stay blocked without vendor calls.
- [ ] On an allowed host with notices on, confirm the inline disclosure appears before the first vendor fetch.

## Reporting a vulnerability

If you believe you have found a security issue in Vera5:

1. **Do not** open a public issue with exploit details or live secrets.
2. Report privately via [GitHub Security Advisories](https://github.com/0xCBradford/Vera5/security/advisories/new) or through the repository maintainer contact on GitHub.
3. Include reproduction steps, affected version, and impact assessment.

We aim to acknowledge reports in a reasonable timeframe and coordinate fixes before public disclosure when appropriate.

## Related documents

- [docs/security-model.md](docs/security-model.md) — manifest permissions, host access, domain policy, internal asset lists, and sensitive-domain guidance
- [docs/architecture.md](docs/architecture.md) — IOC types, connector order, data boundaries
- [README.md](README.md) — install, development, and capability summary
