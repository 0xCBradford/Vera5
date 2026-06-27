# Chrome Web Store listing draft

Copy-paste source for a **draft** Chrome Web Store submission. This is not a live listing. Align screenshots with [screenshots.md](screenshots.md) before publish.

For permission rationale and trust controls, see [security-model.md](security-model.md) and [SECURITY.md](../SECURITY.md#trust-and-query-checklist).

---

## Listing identity

| Field | Draft value |
|-------|-------------|
| **Extension name** | Vera5 |
| **Category** | Productivity (or Developer Tools — choose the category that best matches your analyst audience) |
| **Language** | English |

---

## Short description (≤132 characters)

Detect IOCs on pages you view. Enrich selected indicators with your own threat-intel API keys. Local-first; no Vera5 cloud.

*(Character count: 131)*

---

## Detailed description

Vera5 is a local-first browser extension for security analysts who triage indicators on web pages—alert tickets, search exports, CTI articles, and SOC dashboards.

**What Vera5 does**

- Scan visible page text on demand for indicators of compromise (IPv4, domain, URL, MD5, SHA1, SHA256, CVE).
- Highlight matches on the page and list them in a popup **Detected indicators** tray and optional workspace sidebar.
- Open an on-page triage overlay for copy, export, pivot links, and—when you configure keys—live threat intelligence from sources you enable.
- Run investigation sessions and IOC collections locally: rollups, labels, pins, session export, and collection export for ticket handoff.
- Use keyboard shortcuts and a command palette for scan, enrich selection, and tray actions.

**What Vera5 does not do**

- Vera5 does not operate a shared enrichment backend, team workspace, or cloud sync for your keys or sessions.
- Vera5 does not collect maintainer telemetry or crash reports by default.
- Vera5 does not upload full page HTML to Vera5-operated infrastructure (there is none in this release).
- Only **AbuseIPDB** and **OTX** perform live HTTPS enrichment today. Other registered sources show status rows and pivot links where supported—not live vendor queries unless implemented in a future release.

**Bring your own keys (BYOK)**

You create API keys in vendor portals and enter them in **Vera5 Settings**. Keys stay in local browser storage on your profile. Live enrichment sends **only the indicator value you choose to enrich**—plus API fields each vendor requires—directly from the extension service worker to vendors you enable.

**Trust and consent before vendor queries**

Vera5 ships analyst-visible gates so accidental queries on sensitive sites are unlikely:

1. **Manual-only enrichment** (default on) — live fetches require an explicit enrich action unless you turn manual-only off.
2. **Pre-query disclosure** (default on until you choose in Settings) — before a live vendor call on an allowed page, the overlay names enabled vendors and the indicator value. **Send query** proceeds; **Cancel** aborts without sending data.
3. **Domain policy** (default **allow by default** with a sensitive webmail denylist) — hostname allow/deny lists gate auto-scan and live enrichment. Denylisted hosts block vendor calls **before** pre-query disclosure when the domain enrich gate is on (default). Merge the **Sensitive sites denylist** preset for banking, health, and HR patterns.
4. **Internal asset lists** (enrich gate on by default) — indicator-level domain, IPv4 CIDR, and labeled vendor/SaaS patterns can block live enrichment for matching values even on otherwise allowed SOC pages.
5. **Auto-scan** (default off) — optional DOM rescans respect the same domain policy as live enrichment.

Manage all trust controls under **Trust & consent** in Vera5 Settings. Gate order and verification steps: [SECURITY.md — Trust and query checklist](../SECURITY.md#trust-and-query-checklist).

**Permissions in plain language**

| Permission | Why Vera5 needs it |
|------------|-------------------|
| `storage` | Save your settings, masked API keys, enrichment cache, investigation sessions, and IOC collections locally in the browser. |
| `activeTab` | Run extension actions on the tab you are viewing when you invoke Vera5. |
| `scripting` | Inject or update page scripts when needed for on-demand scan and sidebar flows. |
| `contextMenus` | **Enrich with Vera5** on a text selection. |
| Host access (`http://*/*`, `https://*/*`) | Read visible text on pages you open for IOC detection. Analyst destinations vary; a narrow allowlist would block legitimate SOC workflows. Only indicator values you enrich leave the browser to vendors you configure—not full pages to Vera5. |

**Getting started**

Build or install from source, load unpacked from `extension/dist/` for evaluation (manifest **0.1.0**), or use a packaged build when published. On **first install**, Settings opens once for the install quick-start wizard (manual-only enrichment and auto-scan off by default). Serve `examples/` over HTTP to practice on public test fixtures. See [README.md](../README.md) for install steps and limitations.

**Support and security**

Report vulnerabilities privately per [SECURITY.md](../SECURITY.md). Do not paste API keys or live incident data into public issues.

---

## Single purpose (Privacy practices)

Use this text in the Chrome Web Store **Privacy** → **Single purpose** field (or equivalent single-purpose declaration):

> Vera5 has one purpose: help security analysts detect indicators of compromise in visible text on web pages they choose to view, review matches locally, and optionally enrich **individual selected indicators** using threat-intelligence APIs **the user configures**—without routing data through Vera5-operated infrastructure.

---

## Privacy practices — data handling summary

Paste or adapt these bullets in the store privacy questionnaire. Wording matches shipped extension behavior.

| Topic | Draft disclosure |
|-------|------------------|
| **Data collected by Vera5 maintainers** | None by default. No usage analytics, crash telemetry, or browsing history sent to Vera5-operated servers. |
| **Data processed locally** | Visible page text for IOC detection; settings; API keys; enrichment cache; investigation sessions; IOC collections; analyst notes—all in local browser storage. |
| **Data sent to third parties** | Only when **you** trigger live enrichment (or allow automatic fetch when manual-only is off): the **indicator value** and required API fields go **directly** to threat-intelligence vendors **you** enabled (AbuseIPDB and/or OTX today), using **your** API keys. Full page HTML is not sent. |
| **User control** | Pre-query disclosure, domain allow/deny policy, internal asset lists, per-source toggles, manual-only mode (default on), and auto-scan off by default. |
| **Sensitive sites** | Default denylist blocks auto-scan and live enrichment on common webmail hosts. Optional presets add banking, health, and HR hostname patterns. |
| **Pivot links** | Static vendor URLs open in your browser when **you** click them; Vera5 does not proxy that navigation. |
| **Settings export** | JSON backup you save locally; API keys omitted unless you opt in. |

**Certification alignment**

When the dashboard asks whether the extension handles personal or sensitive data: Vera5 reads page content locally for detection and may send **user-selected indicator values** to **user-configured** third-party APIs. Users control when enrichment runs and which hosts are blocked. Document this honestly; do not claim “no data leaves the device” if live enrichment is enabled.

---

## Permission justifications (store dashboard)

Use one paragraph per permission when Chrome Web Store requests justification text.

**storage** — Persist analyst-controlled settings, masked API keys, enrichment cache entries, investigation sessions, IOC collections, and related preferences in local browser storage only. No Vera5 cloud sync.

**activeTab** — Operate on the tab the analyst is viewing when they invoke the toolbar action, keyboard shortcut, or context menu, without requesting unrelated tab access up front.

**scripting** — Inject or update content scripts on demand for scan, workspace sidebar, and related page-local triage flows declared in the manifest.

**contextMenus** — Add **Enrich with Vera5** to the browser context menu when the analyst selects indicator text, using the same trust gates as **Enrich selection**.

**Host permissions (`http://*/*`, `https://*/*`)** — Security analysts triage on diverse internal and external HTTP/HTTPS origins (SOC consoles, CTI portals, ticket mirrors). Vera5 reads visible text on pages the analyst opens to detect IOCs. Only indicator values the analyst chooses to enrich are sent to third-party APIs the analyst configured—not full page content to Vera5 infrastructure.

---

## Suggested screenshots

Replace SVG placeholders in [screenshots.md](screenshots.md) with redacted PNG or WebP before upload. Recommended store set:

| Priority | Asset | Shows |
|----------|-------|-------|
| 1 | `scan-highlights-page` | On-page detection |
| 2 | `on-page-overlay-enrichment` | Triage overlay and risk score |
| 3 | `popup-session-tray` | Popup tray and session |
| 4 | `options-trust-consent` | Domain policy and trust controls |
| 5 | `pre-query-disclosure` | Consent before vendor fetch |

**Small promo tile:** 440×280 PNG. **Marquee / screenshot slots:** 1280×800 or 640×400 per current Chrome Web Store requirements—verify dimensions in the Developer Dashboard before upload.

---

## Store listing metadata checklist

Before submitting (operator task):

- [ ] Short and detailed descriptions pasted; no overstated live connector claims beyond AbuseIPDB and OTX.
- [ ] Single purpose and privacy answers match [SECURITY.md](../SECURITY.md) and [security-model.md](security-model.md).
- [ ] Permission justifications match [manifest.json](../extension/public/manifest.json).
- [ ] Screenshots redacted (no real keys, customer IOCs, or inbox content).
- [ ] Support URL and privacy policy URL set (link to public repo `SECURITY.md` or project policy page when published).
- [ ] Version in dashboard matches packaged `manifest.json` semver when release task completes.

---

## Related

- [screenshots.md](screenshots.md) — capture guide and gallery placeholders
- [security-model.md](security-model.md) — domain policy, internal asset lists, sensitive-domain guidance
- [SECURITY.md](../SECURITY.md) — trust and query checklist, BYOK, IOC leakage boundaries
- [README.md](../README.md) — capabilities, limitations, install path
