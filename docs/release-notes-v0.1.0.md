# Vera5 v0.1.0 — Investigation Mode (draft GitHub release)

Paste the **Release description** section below into a GitHub release for tag `v0.1.0`. Attach `release/vera5-0.1.0.zip` from `scripts/package-extension.ps1` when publishing.

---

## Suggested release title

`Vera5 v0.1.0 — Investigation Mode (MVP)`

---

## Release description (copy from here)

**Vera5 v0.1.0** is the first public MVP snapshot of a local-first Chromium extension for security analysts: detect indicators on pages you browse, triage in a tray and on-page overlay, enrich with your own threat-intelligence keys, score and export results, and track cases with investigation sessions and IOC collections—without routing data through Vera5-operated infrastructure.

### Investigation Mode — end-to-end flow

| Stage | What you get |
|-------|----------------|
| **Detect** | On-demand scan of visible text on `http://` and `https://` tabs (IPv4, domain, URL, MD5, SHA1, SHA256, CVE). Highlights, type badges, **Why detected?** provenance, defang/refang support, and SOC-style fixture pages under `examples/`. |
| **Tray** | Popup **Detected indicators** list and optional workspace sidebar: type filters, row navigation to highlights, cached status hints, save-to-collection actions, and bulk selection. |
| **Queue** | Workspace **Enrich selected (N)** with quota confirmation and sequential bulk enrich; cancel mid-run. Context-menu and palette **Enrich selection** for single IOCs. |
| **Enrich** | Live HTTPS enrichment from **AbuseIPDB** (IPv4) and **OTX** (multi-type) when you enable sources and supply keys. Manual-only mode on by default; parallel multi-source fetch with per-source attribution. |
| **Score** | Locally computed composite **Risk score**, **How this score was computed** reasoning chain, and **Sources disagree** callout when vendor bands diverge. |
| **Templates** | Ticket-oriented export templates (Jira comment, TheHive case note, analyst update, Obsidian note, Markdown report, CSV rows) plus per-indicator Markdown/JSON and filtered-subset copy/export. |
| **Session** | Named investigation workspace: IOC rollups, **Label** / **Pin** / **Session timeline**, session export (Markdown, JSON, CSV), and **Recent sessions** in local storage. |
| **Trust** | Pre-query disclosure before vendor calls; hostname domain policy (allow-by-default with sensitive webmail denylist and optional presets); internal asset lists; analyst workflow presets (SOC, CTI, DFIR). |

**Also in this release:** command palette (**Ctrl+Shift+K** / **Cmd+Shift+K**), keyboard triage shortcuts, IOC collections (separate from sessions), install quick-start in Settings, pull-request CI with lint, unit tests, Gitleaks, and Playwright critical smokes (mocked vendors—no live API calls in CI).

### Install (unpacked)

```bash
git clone https://github.com/0xCBradford/Vera5.git
cd Vera5/extension
npm install
npm run build
```

Load **`extension/dist/`** at `chrome://extensions` (Developer mode → Load unpacked). Pin the toolbar action. Optional: serve `examples/` over HTTP and walk through the manual walkthrough in [README.md](README.md#try-detection-and-enrichment-locally).

Package a store-ready zip from the repository root:

```powershell
.\scripts\package-extension.ps1
```

Output: `release/vera5-0.1.0.zip` (manifest version **0.1.0** at zip root).

### Bring your own keys (BYOK/BYOA)

Enter **AbuseIPDB** and/or **OTX** API keys in **Vera5 Settings**. Keys stay in local browser storage. Vera5 does not ship maintainer credentials or proxy enrichment through Vera5-hosted backends. Live enrichment sends **only the indicator value you choose**—not full page HTML.

Review vendor terms before enabling sources: [docs/api-integrations.md — Vendor terms](docs/api-integrations.md#vendor-terms-privacy-and-acceptable-use).

### Honest limitations

- Chromium Manifest V3 only (no Firefox build in this repository).
- Unpacked load or packaged zip for evaluation; Chrome Web Store submission is separate operator work.
- Only **AbuseIPDB** and **OTX** perform live enrichment today; other registered sources show status rows and pivot links where supported.
- No Vera5 cloud sync, team workspace, or maintainer telemetry by default.
- Pull request browser smokes do not replace manual unpacked Chrome validation before production triage.

### Documentation

- [README.md](README.md) — install, capabilities, limitations
- [CHANGELOG.md](CHANGELOG.md) — full version history
- [SECURITY.md](SECURITY.md) — threat model and reporting
- [docs/store-listing.md](docs/store-listing.md) — Chrome Web Store listing draft
- [docs/screenshots.md](docs/screenshots.md) — capture guide for README and store assets

### Verify this build

From `extension/`:

```bash
npm run check
npm run test:e2e:critical
```

---

## Maintainer checklist (do not paste into GitHub)

- [ ] Tag `v0.1.0` on the commit that sets `extension/public/manifest.json` version **0.1.0**.
- [ ] Attach `release/vera5-0.1.0.zip` built with `.\scripts\package-extension.ps1`.
- [ ] Paste **Release description** above; confirm links resolve on the default branch.
- [ ] Redact any screenshots before upload (no real keys or customer IOCs).
