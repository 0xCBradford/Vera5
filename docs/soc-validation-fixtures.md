# SOC validation fixtures

Repeatable HTML pages under `examples/` for validating Vera5 detection on analyst-facing surfaces: alert narratives, dense search-export tables, and SOC grid layouts. Values are **public test data** (RFC 5737 addresses, sample hashes, MITRE CVE IDs)—not live incident intelligence.

Canonical value list: [`examples/sample-iocs.txt`](../examples/sample-iocs.txt).

Automated regression: `extension/src/content/fixtureTuning.test.ts` loads each HTML file, runs the same visible-text scan path as production, and asserts expected matches plus selected decoy suppressions.

---

## How to run manual validation

1. Build and load the extension (`npm run build` in `extension/`, load `extension/dist/` in Chrome).
2. Serve fixtures over HTTP (content scripts match `http://` and `https://` only):

   ```bash
   cd examples
   python -m http.server 8080
   ```

3. Open a fixture URL, enable the extension and **Highlight indicators**, then **Scan page** (or `Ctrl+Shift+Y` / `Cmd+Shift+Y`). On dense table fixtures such as `sample-splunk-export.html`, highlight one result row and use **Scan selection** in the popup or workspace sidebar to scan only that range. To enrich without a full-page scan, select an indicator value (or part of a scanned highlight) and use **Enrich selection**.
4. Confirm highlights and popup **Detected indicators** tray counts match the expectations in the table below.
5. Optional: enrich one or two IOCs with saved AbuseIPDB/OTX keys to exercise overlay triage on dashboard-shaped pages.

For triage flow context, see [analyst-workflows.md](analyst-workflows.md). For detector rules and false-positive tables, see [architecture.md](architecture.md#known-false-positives-and-suppressions).

---

## Fixture catalog

| File | Simulated surface | Layout intent | Primary validation goal |
|------|-------------------|---------------|-------------------------|
| [`sample-alert.html`](../examples/sample-alert.html) | Ticket-style security alert | Short article with summary, bullet list, embedded non-visible decoys | Baseline multi-type detection; tray navigation on a dense but readable page |
| [`sample-blog.html`](../examples/sample-blog.html) | Blog / prose page | Paragraphs with semver and asset-name noise | Suppress filename and version decoys while still finding embedded IOCs |
| [`sample-splunk-export.html`](../examples/sample-splunk-export.html) | Saved Splunk search export | Dark table with 32 result rows, raw JSON event panel | Detection on repeated IOCs in table cells; performance on heavier DOM text volume |
| [`sample-security-onion-alert.html`](../examples/sample-security-onion-alert.html) | Security Onion alert detail | Field grid, Zeek conn.log excerpt, Suricata summary | Detection in monospace log blocks and labeled indicator fields |

---

## Expected indicators (visible text)

All fixtures embed a subset of [`sample-iocs.txt`](../examples/sample-iocs.txt). At minimum, automated tests expect these types on each page:

### `sample-alert.html`

| Type | Example values |
|------|----------------|
| IPv4 | `192.0.2.1`, `8.8.8.8` |
| Domain | `malware.testcategory.com` |
| URL | `https://example.com/login`, `https://example.com/login?ref=analyst` (also appears defanged as `hxxps://example.com/login?ref=analyst` in the expanded indicator list) |
| MD5 | `d41d8cd98f00b204e9800998ecf8427e` |
| CVE | `CVE-2021-44228`, `CVE-2017-0144` |

### `sample-blog.html`

| Type | Example values |
|------|----------------|
| IPv4 | `192.0.2.1`, `8.8.8.8` |
| URL | `http://192.0.2.1/resource?id=1` |
| CVE | `CVE-2021-44228` |

### `sample-splunk-export.html`

| Type | Example values |
|------|----------------|
| IPv4 | `185.220.101.4`, `192.0.2.1`, `8.8.8.8` |
| URL | `https://example.com/login`, `https://example.com/login?ref=analyst`, `http://192.0.2.1/resource?id=1`, `https://malware.testcategory.com/gate` |
| MD5 | `d41d8cd98f00b204e9800998ecf8427e`, `098f6bcd4621d373cade4e832627b4f6` |
| SHA1 | `aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8` |
| SHA256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, `2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117` |
| CVE | `CVE-2021-44228`, `CVE-2017-0144` |

Automated test expects **at least 20** visible matches (deduplicated spans may repeat across table rows).

### `sample-security-onion-alert.html`

| Type | Example values |
|------|----------------|
| IPv4 | `185.220.101.4`, `192.0.2.1`, `8.8.8.8` |
| Domain | `malware.testcategory.com` |
| URL | `https://example.com/login`, `https://example.com/login?ref=analyst`, `http://192.0.2.1/resource?id=1` |
| MD5 | `d41d8cd98f00b204e9800998ecf8427e`, `098f6bcd4621d373cade4e832627b4f6` |
| SHA1 | `aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8` |
| SHA256 | `2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117`, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| CVE | `CVE-2021-44228`, `CVE-2017-0144` |

Automated test expects **at least 12** visible matches.

---

## Decoys and non-scanned content

Each fixture includes strings that **should not** surface as indicators, plus content in `script` and `textarea` nodes that the text walker skips.

| Fixture | Decoys in visible text (should stay unhighlighted) | Hidden (never scanned) |
|---------|-----------------------------------------------------|-------------------------|
| `sample-alert.html` | `1.2.3.4` (semver context), `chart.png`, `report.csv` | `10.0.0.1` in `<script>` / `<textarea>` |
| `sample-blog.html` | `1.2.3.4`, `hero-banner.png`, `stylesheet.min.css` | — |
| `sample-splunk-export.html` | `1.2.3.4`, `dashboard.png`, `splunkd.log` | `10.0.0.1` in `<script>` / `<textarea>` |
| `sample-security-onion-alert.html` | `alert-screenshot.png`, `zeek-export.csv`, `1.2.3.4` (upgrade range) | `10.0.0.1` in `<script>` / `<textarea>` |

Automated regression in `fixtureTuning.test.ts` asserts these decoys stay unhighlighted on each fixture page.

---

## Repeatable validation checklist

Use the same order for manual SOC checks and pre-release smoke:

1. **Baseline alert** — `http://localhost:8080/sample-alert.html`: confirm multi-type tray filters and row navigation.
2. **Prose decoys** — `http://localhost:8080/sample-blog.html`: confirm semver and `.png` filenames stay unhighlighted.
3. **Dense table** — `http://localhost:8080/sample-splunk-export.html`: scan completes without hanging; tray shows elevated IOC count; spot-check IPv4, URL, and CVE highlights in table cells.
4. **SOC grid + logs** — `http://localhost:8080/sample-security-onion-alert.html`: confirm IOCs in field grid and Zeek excerpt; open overlay on one IPv4 and one hash row.
5. **Regression gate** — from `extension/`, run `npm run check` (includes `fixtureTuning.test.ts`).

When adding or changing fixture HTML, update this document, `fixtureTuning.test.ts`, and the fixture tables in [architecture.md](architecture.md) and [contributors/detection-engine.md](contributors/detection-engine.md).

---

## Related

- [architecture.md](architecture.md) — MVP IOC types and false-positive reference tables
- [contributors/testing.md](contributors/testing.md) — automated test commands
- [contributors/detection-engine.md](contributors/detection-engine.md) — scan pipeline implementation
