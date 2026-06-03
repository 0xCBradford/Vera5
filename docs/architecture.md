# Vera5 architecture

High-level structure for the browser extension codebase. Describes planned layout and frozen scope for the initial release.

## Extension package (`extension/`)

| Path | Ownership |
|------|-----------|
| `extension/src/background/` | Manifest V3 service worker: message routing, enrichment fetch orchestration, cache coordination, connector calls. No DOM access. |
| `extension/src/content/` | Content scripts: IOC detection, page highlighting, production on-page hover overlay, scan and enrich wiring. Runs in page context. |
| `extension/src/popup/` | Browser action popup UI: enable/disable, quick status, shortcuts to options. |
| `extension/src/options/` | Options page: API keys (masked), enrichment source toggles, manual-only mode, auto-scan, per-type IOC and private IPv4 controls, cache TTL fields, cache clear, settings export/import. |
| `extension/src/components/` | React hover card and composite risk score UI for the dev shell and unit tests—not injected into live page tabs. |
| `extension/src/lib/` | Shared non-UI modules: IOC regex, normalization, storage schema, cache, scoring, connector client interfaces. |

**Build output:** `extension/dist/` (gitignored) — production extension package from `npm run build` (`verify:dist` and `verify:security` run post-build).

For module-level implementation detail, see [contributors/README.md](contributors/README.md).

## Repository (root)

| Path | Ownership |
|------|-----------|
| `docs/` | Public user and contributor documentation (tracked in git). |
| `examples/` | Sample pages and IOC fixtures for manual testing. |
| `scripts/` | Maintainer build/dev helper scripts. |

## MVP indicator types (frozen)

The initial Vera5 release detects and enriches **only** the indicator types below. Detector logic, options toggles, pivot templates, and connector requests must align with this list until a deliberate product revision expands scope.

| Type | Included in initial release | Notes |
|------|----------------------------|--------|
| **IPv4 address** | Yes | Public and private-space literals per detector rules; IPv6 is out of scope for the initial release. |
| **Domain name** | Yes | Hostname-style FQDNs and registrable domains; not full email addresses. |
| **URL** | Yes | `http`/`https` (and common defanged forms where supported); may overlap domain extraction—normalize to one canonical value per hover target. |
| **MD5 hash** | Yes | 32 hexadecimal characters (128-bit). |
| **SHA1 hash** | Yes | 40 hexadecimal characters (160-bit). |
| **SHA256 hash** | Yes | 64 hexadecimal characters (256-bit). |
| **CVE identifier** | Yes | `CVE-YYYY-NNNN…` form per MITRE CVE ID syntax. |

**Out of scope for the initial release** (do not implement detectors or enrichment wiring for these without an explicit scope change): email addresses, ASNs, CIDR ranges, IPv6, malware family names, MITRE ATT&CK technique IDs, cloud resource identifiers, cryptocurrency wallet addresses, and other Phase 2+ artifact types listed in [Product-Vision.md](../Product-Vision.md).

**Detection expectations**

- Scan visible page text for the types above; skip `script`, `style`, `textarea`, and metadata subtrees by default; do not scan attributes.
- Apply false-positive controls (context suppressions, conservative matching, overlap deduplication) before surfacing a hover target.
- Enrich **indicator values only**—never upload full page HTML to third parties or Vera5-operated infrastructure.

**Per-type IOC controls (current release)**

| Control | Storage schema | Options UI | Scan / detection path |
|---------|----------------|------------|------------------------|
| **Per-type enable** (`iocTypeEnabled`) | Yes — defaults all MVP types on | **Wired** — Scanning → Indicator types | **Applied** — disabled types are omitted from scan output |
| **Include private IPv4** (`includePrivateIpv4`) | Yes — default off | **Wired** — Scanning section | **Applied** — private-space literals omitted unless enabled |

Analyst-facing limits for cache TTL are listed in [README.md](../README.md). Limit exposure with per-type toggles, per-source toggles, manual-only enrichment, and choosing when to scan sensitive pages.

**Fixtures:** Public sample values for manual and automated tests live in [`examples/sample-iocs.txt`](../examples/sample-iocs.txt). Static HTML pages [`examples/sample-alert.html`](../examples/sample-alert.html) and [`examples/sample-blog.html`](../examples/sample-blog.html) embed those values plus decoy strings for manual scan checks. SOC dashboard-style pages [`examples/sample-splunk-export.html`](../examples/sample-splunk-export.html) and [`examples/sample-security-onion-alert.html`](../examples/sample-security-onion-alert.html) support repeatable validation on dense tables and alert grids—see [soc-validation-fixtures.md](soc-validation-fixtures.md).

## Page scan and mutation rescan

Vera5 supports **explicit** scans and an **optional** mutation-driven rescan. There is no silent background rescan unless the analyst turns on auto-scan in Options.

| Trigger | Module path | Behavior |
|---------|-------------|----------|
| Popup **Scan page** or `scan-page` keyboard shortcut | `serviceWorker.ts` → `scanPage.ts` | One-shot scan of visible text; highlights when highlighting is enabled. |
| **Automatically scan when the page changes** (Options, off by default) | `autoScan.ts` → `mutationRescan.ts` | Debounced `MutationObserver` (400 ms default) calls the same scan path as an explicit **Scan page** action. |

**`mutationRescan.ts` status:** Implemented and active only when auto-scan is enabled. The module is not a no-op stub: it registers a subtree observer, coalesces rapid DOM changes into one debounced scan, and tears down on disable or navigation teardown. When `enabled` is not `true`, setup returns immediately and no observer runs.

**Operator intent and defaults:**

- `autoScanEnabled` defaults to **false** in extension storage (`storage.ts` schema). Content scripts call `syncAutoScanWithStorage()` on load and react to storage changes via `setupAutoScanStorageListener()` in `autoScan.ts`.
- With auto-scan off, DOM mutations do **not** trigger rescans. Analysts scan with **Scan page** in the popup or `Ctrl+Shift+Y` / `Cmd+Shift+Y`.
- Enabling auto-scan in Options is the only path that activates mutation rescan; it is a deliberate opt-in, not an implicit page-load behavior.

## Known false positives and suppressions

The detector applies conservative matching in `extension/src/lib/iocRegex.ts`, DOM text collection in `extension/src/content/textWalker.ts`, and overlap deduplication in `extension/src/content/detector.ts`. The tables below list strings that **should not** surface as indicators, controls that suppress them, and known limitations that may still produce matches until a later tuning pass.

### Suppressed by detector rules

| Pattern or context | Affected types | Suppression | Example decoy |
|--------------------|----------------|-------------|---------------|
| Semver or `version` immediately before a dotted quad | IPv4 | Reject match when prefix looks like a product version | `version 1.2.3.4` |
| `from` … `to` upgrade range with single-digit semver-like quad | IPv4 | Reject when dotted quad is four single-digit octets in a `from X to Y` range | `from 1.2.3.4 to 2.0.0` |
| Filename-style token with common file-extension TLD | Domain | Denylist TLD (`png`, `js`, `css`, `html`, `json`, `log`, etc.) | `chart.png`, `report.csv`, `splunkd.log` |
| Local part of an email (text after `@` without whitespace before domain) | Domain | Skip when inside email local-part context | `analyst@example.com` (domain in address not scanned as standalone host) |
| Hex string inside a longer hex run | MD5, SHA1, SHA256 | Longest-match first; boundary requires non-hex neighbors | 64-char SHA256 not split into two MD5s |
| All-identical hex digits | MD5, SHA1, SHA256 | Reject trivial digests | `00000000000000000000000000000000` |
| CVE year outside 1999–2099 or short sequence segment | CVE | MITRE-style validation on year and sequence length | `CVE-1998-0001`, `CVE-2100-00001` |
| Invalid or non-http(s) URL after normalization | URL | URL parser check after defang + trim | Malformed scheme or truncated host |
| Trailing punctuation attached to URL token | URL | Strip `.,;:!?)` before validation | `https://example.com/path).` |
| Defanged `hxxp://` / `hxxps://` | URL | Normalize to `http://` / `https://` then validate | `hxxps://example.com/evil` |
| Overlapping span with higher-priority match | Domain, IPv4 | Dedupe prefers URL, then hashes, CVE, IPv4, domain | Hostname substring inside a full URL token |
| Duplicate identical match | All | Dedupe by position, type, and value | Same IP repeated in one text node |

### Suppressed by DOM scan surface

| Pattern or context | Suppression | Example decoy |
|--------------------|-------------|---------------|
| Text inside `<script>` | Skipped by default (`skipScript: true`) | `const ip = "10.0.0.1";` in script body |
| Text inside `<style>` | Skipped by default (`skipStyle: true`) | CSS or inline style content |
| Text inside `<textarea>` | Skipped by default (`skipTextarea: true`) | Form defaults with private-space literals |
| Text under `head`, `meta`, `link`, `noscript`, `template`, `title` | Metadata subtree skip | Head-only or template placeholders |
| Attribute values (`href`, `src`, `class`, `id`, `data-*`, `aria-*`, event handlers, etc.) | Attributes are not scanned; only text nodes | `href="https://evil.example.com"` with unrelated link label |
| Empty or whitespace-only text nodes | Eligibility check | Layout spacing |

Configurable walker flags can set `skipScript`, `skipStyle`, or `skipTextarea` to `false` for maintainer debugging only; default production behavior keeps them skipped.

### Analyst-controlled options

| Control | Effect |
|---------|--------|
| `includePrivateIpv4: false` | Omits RFC1918, loopback, and link-local literals (`10.0.0.0/8`, `192.168.0.0/16`, `127.0.0.1`, etc.) while keeping documentation ranges such as `192.0.2.0/24` when present in text |

### Known limitations (may still match)

| Pattern | Why it may still match | Mitigation direction |
|---------|------------------------|----------------------|
| `localhost` | Treated as a valid hostname for local analyst workflows | Options toggle per IOC type (future) |
| Documentation and benign IPs (`8.8.8.8`, `192.0.2.1`) | Literals are syntactically valid IPv4 | Context scoring or allowlists (future) |
| `example.com` and test domains in prose | Valid domain grammar | Same as above |
| CVE IDs cited in non-security articles | Valid CVE syntax | Type toggle or section-aware scanning (future) |
| Private-space IPs when `includePrivateIpv4` is enabled in settings | Intended for lab and SOC pages | Off by default in settings schema; enable when private literals are required |
| Same indicator repeated in separate text nodes | Each node scanned independently | Hover dedupe by value (UI layer, future) |
| Very long pages | Performance caps apply in later phases | Scan limits and debounce (see performance guardrails in implementation) |

### Manual validation

Use **Scan page** in the popup (or the `scan-page` keyboard shortcut) on the sample HTML files and compare counts to dev-console output (`detection count` only in development builds). Record unexpected highlights on these pages before changing regex rules so tuning stays tied to reproducible fixtures. SOC dashboard fixtures and a repeatable checklist are documented in [soc-validation-fixtures.md](soc-validation-fixtures.md).

## MVP enrichment connectors (frozen)

Live enrichment sources for the initial release ship in the **fixed order** below. Options UI, connector modules under `extension/src/lib/`, cache keys, and hover-card attribution must use this sequence and naming unless a deliberate product revision changes scope.

| Order | Source | Role | Primary indicator types | Credential (local only) |
|------:|--------|------|-------------------------|-------------------------|
| 1 | **AbuseIPDB** | First live connector; IP reputation baseline | IPv4 | `ABUSEIPDB_API_KEY` |
| 2 | **AlienVault OTX** | Second live connector; multi-type pulse context | IPv4, domain, URL, hashes, CVE | `OTX_API_KEY` |
| 3 | **URLScan.io** | URL submission and scan summary | URL, domain | `URLSCAN_API_KEY` |
| 4 | **GreyNoise (community)** | Internet noise / RIOT context on community API tier | IPv4 | `GREYNOISE_API_KEY` |

**Release minimum:** At least **two** configured live sources must work end-to-end—**AbuseIPDB** and **OTX** satisfy that bar. **URLScan** and **GreyNoise (community)** follow in table order after those two are stable.

**Connector rules**

- **Bring-your-own keys** — Analysts create API keys in each vendor portal; Vera5 stores them locally (extension storage). No Vera5-operated enrichment proxy and no maintainer-shared keys.
- **Per-source toggles** — Each source can be enabled or disabled independently in options.
- **Parallel fetch** — When multiple sources are enabled, requests run in parallel with per-source errors surfaced in the hover card.
- **Source attribution** — Every enriched field shows which connector produced it; cached vs live state is visible.
- **IOC-only requests** — Send the indicator value (and required request metadata only), not full page content.

**Out of scope for the initial connector set** (static pivot links or later phases may reference them; do not treat as MVP live connectors without scope change): VirusTotal, Shodan, MISP, OpenCTI, TheHive, and other providers listed under enrichment philosophy in [Product-Vision.md](../Product-Vision.md).

## Initial release exclusions (frozen)

The first shippable extension release is **browser-only enrichment**. The following are explicitly **out of scope** until a documented product revision expands the surface. Implementation, manifest permissions, and public docs must not imply these capabilities ship in the initial release.

| Exclusion | Requirement |
|-----------|-------------|
| **No Vera5 backend** | No required or default FastAPI (or other) Vera5-operated enrichment service. Optional localhost/self-hosted backend may be explored in a later phase only. |
| **No LLM features** | No local or cloud LLM summaries, narrative report generation, or AI-driven scoring bundled with enrichment. |
| **No telemetry** | No usage analytics, crash reporting to Vera5, browsing-history collection, or hidden phone-home endpoints. Any future diagnostics must be opt-in and off by default. |

**Also excluded from the initial release** (aligned with frozen indicator and connector scope above):

- Vera5 user accounts or maintainer-hosted API key relay
- Firefox store distribution (Chrome unpacked → store-ready first)
- MISP, OpenCTI, TheHive, and similar platform connectors as live enrichment sources
- Phase 2+ indicator types (email, ASN, IPv6, wallets, etc.)
- Full-page upload or silent exfiltration of page HTML to Vera5 infrastructure (there is no Vera5 enrichment cloud in the initial release)

## Extension versioning (frozen)

The Vera5 browser extension uses **[Semantic Versioning 2.0.0](https://semver.org/)** (`MAJOR.MINOR.PATCH`). The canonical version lives in `extension/package.json` and must match the extension manifest `version` field once the manifest ships.

| Field | Policy |
|-------|--------|
| **MAJOR** | Breaking changes to enrichment contracts, storage schema migrations, or permission model that require analyst action. |
| **MINOR** | Backward-compatible capability: new connector, IOC type, UI surface, or option—within frozen scope unless scope is explicitly revised in this document. |
| **PATCH** | Bug fixes, detector tuning, copy clarifications, and non-breaking dependency security updates. |

**Pre-1.0 behavior:** While `MAJOR` is `0`, treat `MINOR` bumps as the primary milestone marker and document breaking changes in release notes even though SemVer allows API instability below `1.0.0`.

**Current baseline:** `0.0.0` in `extension/package.json` is the pre-1.0 package version while capabilities advance toward the 0.2.x enrichment milestone. Do not tag a public store release until version and sign-off policy align with [Product-Vision.md](../Product-Vision.md).

**Milestone mapping (extension package only)**

| Version line | Capability gate |
|--------------|-----------------|
| **0.1.x** | Manifest V3 scaffold, IOC detection, highlight/hover shell, static pivot card; no required live enrichment. |
| **0.2.x** | At least two live BYOK connectors (AbuseIPDB + OTX minimum), cache with cached/live labeling, options for keys and source toggles. |
| **0.3.x** | Public OSS readiness: polished README, SECURITY alignment, store submission prep; still no telemetry or required backend. |
| **1.0.0** | First stable analyst-facing release after dogfood sign-off; breaking changes thereafter follow strict SemVer MAJOR bumps. |

**Release process rules**

- Bump `extension/package.json` and manifest together in one commit per release.
- Prefer git annotated tags `v{version}` (e.g. `v0.2.0`) on the commit that sets the version.
- Record user-visible changes in `CHANGELOG.md` when that file exists; entries describe shipped capability only.
- Do not encode build metadata in the version string (no `-beta` suffix in `package.json`; use release channels or tags for pre-releases if needed later).

## Principles

These invariants apply to the initial release and are expanded in [SECURITY.md](../SECURITY.md):

- **Bring-your-own keys / bring-your-own API (BYOK/BYOA)** — Analyst-supplied vendor credentials in local extension storage; no Vera5-operated enrichment proxy and no maintainer-shared keys.
- **IOC-only enrichment queries** — Live connectors send the sanitized indicator value and required request metadata only—not full page HTML or browsing history to Vera5 infrastructure (there is no Vera5 enrichment cloud in the MVP).
- **No telemetry by default** — No usage analytics, crash reporting to Vera5, or hidden phone-home endpoints; any future diagnostics must be opt-in and off by default.
- **Local-first** — No required Vera5-hosted backend for enrichment or settings.
