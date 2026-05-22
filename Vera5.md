# Vera5

## One-Line Concept

Vera5 is an open-source analyst browser extension and local enrichment layer that lets SOC, CTI, DFIR, and threat hunting analysts hover over indicators on any webpage and instantly see threat intelligence context without leaving their workflow.

---

## Working Tagline

Analyst-first IOC enrichment directly where investigations happen.

---

## Core Mission

Vera5 reduces investigation friction by detecting indicators of compromise on webpages, tickets, alerts, dashboards, reports, emails, and documentation, then providing fast, privacy-conscious enrichment from trusted threat intelligence sources.

The goal is not to replace SIEMs, EDRs, SOARs, MISP, OpenCTI, or analyst judgment.

The goal is to give analysts instant context at the point of investigation.

---

## Primary Use Cases

### 1. SOC Alert Triage

Analyst sees an IP, domain, hash, URL, CVE, ASN, email, or file name inside:

- Splunk
- Security Onion
- Kibana
- LimaCharlie
- Jira
- TheHive
- Email security portals
- Browser-based dashboards
- Internal case notes

Vera5 detects the IOC and shows enrichment in a hover card.

---

### 2. CTI Research

Analyst reviews threat reports, blogs, GitHub repos, leaked infrastructure notes, or OSINT pages.

Vera5 detects indicators and provides quick pivots to:

- VirusTotal
- AlienVault OTX
- AbuseIPDB
- URLScan
- Shodan
- Censys
- GreyNoise
- ThreatFox
- MalwareBazaar
- WHOIS/RDAP
- MISP
- OpenCTI

---

### 3. DFIR Investigation Support

Analyst reviews forensic timelines, browser history, logs, command output, process trees, or exported CSV/HTML reports.

Vera5 enriches:

- suspicious domains
- public IPs
- hashes
- URLs
- CVEs
- email addresses
- registry keys later
- process names later

---

### 4. Malware Analysis Support

Analyst extracts IOCs from REMnux, FLARE-VM, sandbox reports, or malware notes.

Vera5 helps pivot from extracted strings to external intel sources quickly.

---

### 5. AI-Assisted Analyst Workflow

Vera5 can optionally generate a structured local summary:

- What is this indicator?
- Why might it matter?
- What should I check next?
- What sources disagree?
- What is the confidence level?
- What ATT&CK techniques may apply?

This should be optional and local-first where possible.

---

## Product Philosophy

### Core Principles

1. Local-first where possible.
2. Bring-your-own API keys.
3. No default telemetry collection.
4. No silent cloud uploads.
5. Analyst remains in control.
6. Explain confidence and source quality.
7. Fast enrichment beats bloated dashboards.
8. Context should appear where the analyst already works.
9. Open source from day one.
10. Privacy and operational security are core features.

---

## Differentiator

Most CTI tools force analysts to leave their current workflow.

Vera5 brings enrichment into the workflow.

Most extensions are:

- abandoned
- closed source
- single-source
- ugly
- not privacy-conscious
- not analyst-native
- not built for modern SOC workflows

Vera5 should be:

- clean
- fast
- local-first
- transparent
- modular
- extensible
- useful in real investigations

---

## MVP Definition

The first usable MVP should do only the essentials extremely well.

### MVP Features

- Browser extension for Chrome/Chromium
- Detect IOCs on webpages
- Highlight or underline detected IOCs
- Hover card enrichment
- Manual enrichment trigger
- Copy IOC button
- Open source pivot links
- API key settings page
- Local cache
- Basic source confidence labels
- No telemetry
- No cloud backend required for MVP

---

## IOC Types To Detect

### MVP

- IPv4 addresses
- Domains
- URLs
- MD5 hashes
- SHA1 hashes
- SHA256 hashes
- CVEs

### Phase 2

- Email addresses
- ASNs
- CIDR ranges
- File names
- Windows paths
- Linux paths
- Registry paths
- Mutex-like strings
- Bitcoin wallets
- Ethereum wallets
- Onion domains

### Phase 3

- YARA rule names
- Sigma rule IDs
- MITRE ATT&CK technique IDs
- Malware family names
- Threat actor names
- Cloud resource identifiers
- Kubernetes objects
- AWS account IDs
- Azure tenant IDs

---

## Initial Enrichment Sources

### Free / Community Sources

| Source | Use |
|---|---|
| VirusTotal | Hash, IP, domain, URL reputation |
| AlienVault OTX | Pulses, tags, related IOCs |
| AbuseIPDB | IP abuse confidence |
| URLScan.io | URL/domain screenshots and requests |
| GreyNoise Community | Internet scanner/noise context |
| Shodan | Exposed services and banners |
| Censys | Certificates, hosts, services |
| ThreatFox | Malware IOC associations |
| MalwareBazaar | Malware hashes and families |
| URLhaus | Malicious URLs |
| RDAP/WHOIS | Domain/IP ownership context |

---

## Optional Advanced Integrations

### Platform Integrations

- MISP
- OpenCTI
- TheHive
- Cortex
- Security Onion
- Splunk
- Elastic/Kibana
- LimaCharlie
- Microsoft Sentinel
- Defender XDR
- Jira
- GitHub Issues
- Obsidian local notes

---

## Architecture

### MVP Architecture

```text
Browser Page
    ↓
Content Script
    ↓
IOC Detector
    ↓
Hover Card UI
    ↓
Extension Background Worker
    ↓
Local Cache
    ↓
External APIs
```

### Future Architecture With Local Backend

```text
Browser Extension
    ↓
Local FastAPI Backend
    ↓
Normalizer Layer
    ↓
Cache Layer
    ↓
API Connectors
    ↓
Optional Local LLM Summary
```

### Recommended Tech Stack

**Browser Extension**

- TypeScript
- React
- Tailwind CSS
- Manifest V3
- Vite
- Chrome first
- Firefox later

**Optional Local Backend**

- Python
- FastAPI
- Pydantic
- SQLite
- httpx
- python-dotenv
- uvicorn

**Optional AI Layer**

- llama.cpp local API
- Ollama optional
- OpenAI-compatible local endpoint
- Qwen local model support
- Prompt templates stored locally

### Proposed Repository Structure

```text
Vera5/
│
├── README.md
├── ideas.md
├── LICENSE
├── .gitignore
├── SECURITY.md
├── CONTRIBUTING.md
├── CHANGELOG.md
│
├── extension/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── manifest.json
│   ├── src/
│   │   ├── background/
│   │   │   └── serviceWorker.ts
│   │   ├── content/
│   │   │   ├── detector.ts
│   │   │   ├── highlighter.ts
│   │   │   └── contentScript.ts
│   │   ├── popup/
│   │   │   ├── Popup.tsx
│   │   │   └── popup.css
│   │   ├── options/
│   │   │   ├── Options.tsx
│   │   │   └── options.css
│   │   ├── components/
│   │   │   ├── HoverCard.tsx
│   │   │   ├── SourceBadge.tsx
│   │   │   ├── RiskScore.tsx
│   │   │   └── PivotButtons.tsx
│   │   ├── lib/
│   │   │   ├── iocRegex.ts
│   │   │   ├── storage.ts
│   │   │   ├── cache.ts
│   │   │   ├── scoring.ts
│   │   │   └── normalize.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── public/
│       ├── icons/
│       └── screenshots/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   └── enrichment.py
│   │   ├── connectors/
│   │   │   ├── virustotal.py
│   │   │   ├── otx.py
│   │   │   ├── abuseipdb.py
│   │   │   ├── urlscan.py
│   │   │   ├── greynoise.py
│   │   │   ├── shodan.py
│   │   │   ├── censys.py
│   │   │   ├── threatfox.py
│   │   │   └── rdap.py
│   │   ├── services/
│   │   │   ├── enrich.py
│   │   │   ├── cache.py
│   │   │   ├── scoring.py
│   │   │   └── ai_summary.py
│   │   └── routes/
│   │       ├── health.py
│   │       └── enrich.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   ├── api-integrations.md
│   ├── analyst-workflows.md
│   ├── local-mode.md
│   ├── security-model.md
│   ├── roadmap.md
│   └── screenshots.md
│
├── examples/
│   ├── sample-iocs.txt
│   ├── sample-alert.html
│   ├── sample-splunk-export.html
│   └── sample-security-onion-alert.html
│
└── scripts/
    ├── dev.ps1
    ├── build.ps1
    ├── test.ps1
    └── package-extension.ps1
```

### MVP File Structure Only

Use this smaller structure first:

```text
Vera5/
│
├── ideas.md
├── README.md
├── .gitignore
├── LICENSE
│
└── extension/
    ├── package.json
    ├── manifest.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── content/
        │   ├── contentScript.ts
        │   ├── detector.ts
        │   └── highlighter.ts
        ├── background/
        │   └── serviceWorker.ts
        ├── components/
        │   └── HoverCard.tsx
        ├── options/
        │   └── Options.tsx
        ├── popup/
        │   └── Popup.tsx
        └── lib/
            ├── iocRegex.ts
            ├── enrichment.ts
            ├── cache.ts
            └── storage.ts
```

---

## MVP Build Roadmap

### Phase 0: Planning

**Goal:** Define product scope and avoid building a bloated mess.

**Tasks:**

- [ ] Define MVP IOC types
- [ ] Define first three enrichment sources
- [ ] Define UI principles
- [ ] Define privacy model
- [ ] Define local storage model
- [ ] Create README.md
- [ ] Create SECURITY.md
- [ ] Create .env.example if backend exists
- [ ] Decide Chrome first, Firefox later
- [ ] Decide local-only MVP first

**Deliverable:** Clear repo with ideas.md, README.md, and initial extension scaffold.

---

### Phase 1: Extension Scaffold

**Goal:** Create a working Manifest V3 extension.

**Tasks:**

- [ ] Create Vite React TypeScript project
- [ ] Add manifest.json
- [ ] Add content script
- [ ] Add background service worker
- [ ] Add popup page
- [ ] Add options page
- [ ] Add icons
- [ ] Load unpacked in Chrome
- [ ] Confirm extension loads with no errors

**Deliverable:** A browser extension that loads successfully.

---

### Phase 2: IOC Detection Engine

**Goal:** Detect indicators on webpages.

**Tasks:**

- [ ] Add regex for IPv4
- [ ] Add regex for domains
- [ ] Add regex for URLs
- [ ] Add regex for MD5
- [ ] Add regex for SHA1
- [ ] Add regex for SHA256
- [ ] Add regex for CVEs
- [ ] Avoid matching false positives
- [ ] Avoid matching inside script/style tags
- [ ] Avoid breaking page layout
- [ ] Add unit tests for detector logic

**Deliverable:** Content script can detect IOCs on arbitrary pages.

---

### Phase 3: Highlighting and Hover Card

**Goal:** Make detected IOCs usable.

**Tasks:**

- [ ] Underline or badge detected IOCs
- [ ] Add hover card component
- [ ] Show IOC type
- [ ] Show raw value
- [ ] Add copy button
- [ ] Add pivot links
- [ ] Add loading state
- [ ] Add error state
- [ ] Add source attribution section

**Deliverable:** Analyst can hover IOC and see a clean card.

---

### Phase 4: Settings Page

**Goal:** Allow analyst to configure the tool.

**Tasks:**

- [ ] API key storage
- [ ] Enable/disable sources
- [ ] Enable/disable IOC types
- [ ] Enable/disable automatic scanning
- [ ] Toggle hover cards
- [ ] Toggle manual-only mode
- [ ] Clear cache button
- [ ] Export settings
- [ ] Import settings

**Deliverable:** Usable options page with analyst controls.

---

### Phase 5: First Enrichment Source

Recommended first source: AbuseIPDB or OTX.

**Why:** Simpler than VirusTotal quota and licensing issues.

**Tasks:**

- [ ] Build connector
- [ ] Store API key locally
- [ ] Query source
- [ ] Normalize response
- [ ] Show enrichment in hover card
- [ ] Handle rate limits
- [ ] Handle missing API key
- [ ] Handle network errors

**Deliverable:** Real enrichment appears in browser.

---

### Phase 6: Multi-Source Enrichment

**Goal:** Aggregate multiple sources into one analyst card.

**Sources:**

- AbuseIPDB
- OTX
- URLScan
- GreyNoise Community
- VirusTotal later

**Tasks:**

- [ ] Build connector abstraction
- [ ] Normalize source responses
- [ ] Add source badges
- [ ] Add risk score
- [ ] Add source confidence labels
- [ ] Add raw JSON expand panel
- [ ] Add source error handling

**Deliverable:** Hover card shows multi-source context.

---

### Phase 7: Caching

**Goal:** Avoid burning API quotas.

**Tasks:**

- [ ] Cache enrichment results
- [ ] Configurable TTL
- [ ] Source-specific TTL
- [ ] Manual refresh button
- [ ] Show cached vs live label
- [ ] Clear cache button

**Deliverable:** Practical daily-use analyst workflow.

---

### Phase 8: Threat Score Model

**Goal:** Provide quick triage signal without pretending to be perfect.

**Initial scoring:**

```
VT malicious count
+ AbuseIPDB confidence
+ GreyNoise malicious tag
+ OTX pulse count
+ ThreatFox match
+ MalwareBazaar match
+ URLScan malicious indicators
= Vera5 score
```

**Score labels:**

- Unknown
- Low
- Suspicious
- High
- Critical

**Rules:**

- Never hide source disagreement
- Never claim certainty
- Always show source basis
- Always let analyst inspect raw data

**Deliverable:** Simple risk score with explainability.

---

### Phase 9: Export and Notes

**Goal:** Turn pivots into investigation artifacts.

**Tasks:**

- [ ] Copy markdown summary
- [ ] Copy JSON summary
- [ ] Copy IOC only
- [ ] Export enrichment result
- [ ] Add analyst note field
- [ ] Optional Obsidian markdown export

**Deliverable:** Analyst can move findings into notes, tickets, or reports.

---

### Phase 10: Local Backend Option

**Goal:** Support advanced users and better API security.

**Tasks:**

- [ ] FastAPI backend
- [ ] Local API key storage
- [ ] SQLite cache
- [ ] Backend enrichment aggregation
- [ ] Extension talks to localhost
- [ ] Rate limit management
- [ ] Optional local AI summary

**Deliverable:** Local analyst enrichment server.

---

### Phase 11: AI Summary Layer

**Goal:** Optional analyst assistant, not magical AI nonsense.

**Tasks:**

- [ ] Add local LLM endpoint config
- [ ] Support llama.cpp API
- [ ] Support Ollama API later
- [ ] Prompt templates
- [ ] Strict JSON input
- [ ] Strict markdown output
- [ ] Include only enrichment data
- [ ] Never send API keys
- [ ] Never hallucinate source facts
- [ ] Add confidence disclaimer

**Output format:**

```
Summary:
Why it matters:
Likely category:
Recommended pivots:
Source disagreement:
Next analyst action:
```

**Deliverable:** Local AI-assisted enrichment summaries.

---

### Phase 12: Security Onion and Splunk Workflow Support

**Goal:** Make it useful in CyberHub lab.

**Tasks:**

- [ ] Test against Splunk pages
- [ ] Test against Security Onion pages
- [ ] Test against Kibana pages
- [ ] Test against LimaCharlie pages
- [ ] Avoid DOM breaking
- [ ] Add domain allowlist/denylist
- [ ] Add manual scan mode for complex dashboards

**Deliverable:** Works in real analyst dashboards.

---

## Integration Roadmap

### Priority 1

- AbuseIPDB
- OTX
- URLScan
- GreyNoise Community
- RDAP

### Priority 2

- VirusTotal
- Shodan
- Censys
- ThreatFox
- MalwareBazaar
- URLhaus

### Priority 3

- MISP
- OpenCTI
- TheHive
- Cortex
- Security Onion
- Splunk

### Priority 4

- Local LLM
- Obsidian export
- Jira ticket helper
- GitHub issue enrichment

---

## UI Concepts

### Hover Card Sections

```
IOC: 185.220.101.4
Type: IPv4
Score: High

Summary:
Known Tor exit node with scanner activity.

Sources:
- AbuseIPDB: 87 confidence
- GreyNoise: benign/noisy
- OTX: 4 pulses
- VT: 3 malicious vendors

Tags:
tor, scanner, ssh, suspicious

Actions:
Copy | Open VT | Open OTX | Open AbuseIPDB | Export Markdown
```

### MVP Hover Card Layout

```text
┌────────────────────────────────────┐
│ Vera5                              │
│ 185.220.101.4                      │
│ IPv4 | Score: Suspicious           │
├────────────────────────────────────┤
│ AbuseIPDB: 74% confidence          │
│ OTX: 3 pulses                      │
│ GreyNoise: Internet scanner        │
├────────────────────────────────────┤
│ Tags: scanner, tor, ssh            │
├────────────────────────────────────┤
│ Copy | VT | OTX | Abuse | More     │
└────────────────────────────────────┘
```

---

## Security Model

### Must-Have Protections

- API keys stored locally
- No default telemetry
- No external Vera5 cloud required
- No automatic upload of page contents
- Only enrich detected IOC values
- User can disable all auto-enrichment
- Manual-only mode available
- Source errors displayed honestly
- Rate limit handling
- No hidden analytics
- No secrets in logs
- No keys in GitHub
- No keys in screenshots

---

## Privacy Model

Vera5 should never silently collect:

- browsing history
- page content
- analyst identity
- API keys
- organization names
- ticket content
- cookies
- session tokens

Default stance:
The analyst owns the data.
Vera5 enriches only what the analyst chooses.

---

## Threat Model

### Risks

- Browser extension sees page content
- API keys can be mishandled
- External APIs receive queried IOCs
- Sensitive internal indicators could leak to third-party APIs
- Malicious pages may try to confuse DOM scanning
- False positives may create analyst noise

### Controls

- Manual-only mode
- Domain allowlist
- API source toggles
- Local backend option
- No full-page upload
- Clear source attribution
- Raw query preview
- Cache controls
- Export controls

---

## Development TODO

### Immediate TODO

- [ ] Create README.md
- [ ] Create LICENSE
- [ ] Create SECURITY.md
- [ ] Create CONTRIBUTING.md
- [ ] Create extension scaffold
- [ ] Create Manifest V3 config
- [ ] Build IOC regex detector
- [ ] Build content script
- [ ] Build hover card prototype
- [ ] Build settings page
- [ ] Add local storage
- [ ] Add first enrichment source
- [ ] Add cache
- [ ] Add test IOC page

### MVP TODO

- [ ] IPv4 detection
- [ ] Domain detection
- [ ] URL detection
- [ ] Hash detection
- [ ] CVE detection
- [ ] Hover card
- [ ] Copy button
- [ ] Pivot links
- [ ] AbuseIPDB integration
- [ ] OTX integration
- [ ] URLScan integration
- [ ] Settings page
- [ ] API key storage
- [ ] Cache
- [ ] Error handling
- [ ] README demo screenshots

### Quality TODO

- [ ] Unit tests for IOC regex
- [ ] Test on GitHub pages
- [ ] Test on Splunk
- [ ] Test on Security Onion
- [ ] Test on Jira
- [ ] Test on generic blogs
- [ ] Test dark mode
- [ ] Test page performance
- [ ] Test false positives
- [ ] Test API errors
- [ ] Test disabled sources

---

## Build Steps

### Step 1: Create Extension Project

```bash
# From Vera5 root
mkdir extension
cd extension
npm create vite@latest . -- --template react-ts
npm install
```

### Step 2: Add Manifest V3

Create: `extension/manifest.json`

Core permissions:

```json
{
  "manifest_version": 3,
  "name": "Vera5",
  "version": "0.1.0",
  "description": "Analyst-first IOC enrichment overlay for SOC, CTI, DFIR, and threat hunting workflows.",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/serviceWorker.ts"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/contentScript.ts"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "index.html"
  },
  "options_page": "options.html"
}
```

This will need Vite build adjustments later.

### Step 3: Build Detector

Create: `extension/src/content/detector.ts`

Responsibilities:

- identify IOC strings
- classify IOC type
- avoid duplicates
- avoid false positives
- return structured results

### Step 4: Build Hover UI

Create: `extension/src/components/HoverCard.tsx`

Responsibilities:

- show IOC
- show type
- show enrichment state
- show sources
- show actions

### Step 5: Build Enrichment Layer

Create: `extension/src/lib/enrichment.ts`

Responsibilities:

- call APIs
- normalize responses
- return consistent object shape

### Step 6: Build Settings

Create: `extension/src/options/Options.tsx`

Settings:

- API keys
- enabled sources
- enabled IOC types
- manual mode
- cache TTL
- clear cache

### Example Normalized Enrichment Object

```json
{
  "ioc": "185.220.101.4",
  "type": "ipv4",
  "score": "suspicious",
  "sources": [
    {
      "name": "AbuseIPDB",
      "status": "ok",
      "summary": "74 abuse confidence",
      "tags": ["ssh", "scanner"]
    },
    {
      "name": "OTX",
      "status": "ok",
      "summary": "3 pulses",
      "tags": ["tor", "scanner"]
    }
  ],
  "pivots": {
    "virustotal": "https://www.virustotal.com/gui/ip-address/185.220.101.4",
    "abuseipdb": "https://www.abuseipdb.com/check/185.220.101.4"
  },
  "cached": true,
  "lastUpdated": "2026-05-22T10:00:00Z"
}
```

---

## API Key Handling

### Rules

- Never hardcode keys
- Never commit keys
- Never log keys
- Never show keys after save
- Mask keys in UI
- Use browser local storage for MVP
- Use local backend encrypted storage later

### Suggested .gitignore

```
node_modules/
dist/
build/
.env
.env.*
*.log
.DS_Store
Thumbs.db
__pycache__/
*.pyc
*.pyo
*.pyd
.vscode/
.idea/
```

### Future Local Backend Environment

```
VERA5_ABUSEIPDB_KEY=
VERA5_OTX_KEY=
VERA5_VT_KEY=
VERA5_URLSCAN_KEY=
VERA5_GREYNOISE_KEY=
VERA5_SHODAN_KEY=
VERA5_CENSYS_ID=
VERA5_CENSYS_SECRET=
VERA5_LLM_ENDPOINT=http://127.0.0.1:8080
```

---

## Example Analyst Workflow

### Scenario

Analyst opens Security Onion alert showing:

185.220.101.4 connected to WIN10-VICTIM over SSH.

Vera5 detects:

185.220.101.4

Hover card shows:

- Tor exit node
- AbuseIPDB score
- GreyNoise context
- OTX pulse count
- VT reputation
- pivot links

Analyst exports markdown into Obsidian or case notes.

### Example Exported Markdown

```markdown
## Vera5 IOC Summary

IOC: 185.220.101.4
Type: IPv4
Score: Suspicious

### Source Summary

- AbuseIPDB: 74% abuse confidence
- OTX: 3 related pulses
- GreyNoise: Known internet scanner
- VirusTotal: 3 detections

### Analyst Notes

This IP appears to be associated with Tor/scanning activity. Recommend checking endpoint logs, firewall logs, and authentication attempts around first-seen timestamp.

### Recommended Next Pivots

- Review Security Onion Zeek conn logs
- Search Splunk for this IP
- Check Windows event logs for authentication attempts
- Check EDR process tree around network connection
```

---

## Possible CyberHub Integration

Vera5 can become part of the CyberHub learning ecosystem.

### CyberHub Lab Uses

- Session evidence review
- IOC enrichment during labs
- Security Onion alerts
- Splunk investigations
- Malware analysis reports
- OSINT/CTI workflows
- Obsidian note generation
- GitHub portfolio writeups

---

## Public Positioning

### Short Description

Vera5 is an open-source browser-based IOC enrichment overlay for analysts, built for SOC, CTI, DFIR, and threat hunting workflows.

### Longer Description

Vera5 helps analysts investigate faster by detecting indicators of compromise directly on webpages and enriching them with contextual intelligence from trusted sources. It is designed for local-first, privacy-conscious workflows where analysts bring their own API keys and control what gets queried.

---

## Why This Matters

Analysts lose time to repetitive enrichment.

Vera5 reduces that friction.

The point is not automation for automation's sake.

The point is better analyst context, faster pivots, fewer tabs, and cleaner investigation notes.

### Non-Goals

Vera5 should NOT become:

- a full SIEM
- a full SOAR
- an EDR
- a malware sandbox
- a dark web crawler
- a credential market scraper
- a vulnerability scanner
- a replacement for analyst judgment
- a black-box AI risk engine

Keep the mission tight.

### Success Criteria

MVP is successful when:

- [ ] Extension loads in Chrome
- [ ] It detects common IOCs
- [ ] It displays hover cards
- [ ] It enriches from at least 2 sources
- [ ] It caches results
- [ ] It supports BYO API keys
- [ ] It works on GitHub, Splunk, Security Onion, Jira, and regular webpages
- [ ] It does not collect telemetry
- [ ] It has clean documentation
- [ ] It is safe to open source

### Long-Term Vision

Vera5 becomes a lightweight, open-source analyst context layer.

It sits between:

- browser
- SIEM
- CTI portals
- case management
- local AI
- analyst notes

and makes investigation faster.

The long-term win is not just a browser extension.

The long-term win is an analyst productivity layer for modern cyber operations.

---

## Version Roadmap

### v0.1.0

- Chrome extension scaffold
- IOC detection
- hover card
- static pivot links
- no external API calls yet

### v0.2.0

- API key settings
- AbuseIPDB integration
- OTX integration
- cache

### v0.3.0

- URLScan integration
- GreyNoise integration
- risk score
- markdown export

### v0.4.0

- VirusTotal integration
- Shodan integration
- Censys integration
- improved false positive handling

### v0.5.0

- local FastAPI backend option
- SQLite cache
- backend normalization layer

### v0.6.0

- local LLM summary
- llama.cpp/Ollama support
- structured analyst summaries

### v1.0.0

- stable Chrome release
- documentation
- screenshots
- install guide
- demo workflow
- public GitHub launch

---

## Immediate Next Step

Start with this order:

1. Create README.md
2. Scaffold extension
3. Detect IPv4, domain, hash, CVE
4. Add static hover card
5. Add copy and pivot links
6. Add settings page
7. Add first API integration
8. Add cache
9. Document everything
10. Publish early open-source MVP
