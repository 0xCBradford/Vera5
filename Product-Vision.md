# Vera5 Product Vision

## Overview

Vera5 is an open-source browser-based IOC enrichment platform designed for SOC analysts, CTI researchers, DFIR operators, malware analysts, and threat hunters.

The platform detects indicators of compromise directly on webpages and enriches them with contextual threat intelligence without forcing analysts to leave their workflow.

Vera5 is built around a simple philosophy:

> Context should appear where investigations already happen.

Rather than replacing SIEMs, EDRs, CTI platforms, or analyst judgment, Vera5 acts as a lightweight analyst context layer that reduces friction during investigations.

---

# Core Mission

Modern investigations are fragmented.

Analysts constantly pivot between:
- SIEM dashboards
- threat intelligence portals
- browser tabs
- tickets
- case notes
- sandbox reports
- spreadsheets
- OSINT pages
- documentation
- exported logs

Vera5 reduces that operational friction by bringing enrichment directly into the analyst workflow.

The objective is simple:

- faster pivots
- less repetitive lookup work
- cleaner investigations
- improved analyst context
- privacy-conscious enrichment
- local-first operation where possible

---

# Design Philosophy

## Analyst-First

Vera5 is designed for real operational workflows, not demo environments.

Every feature should answer:
- Does this reduce investigation friction?
- Does this improve analyst context?
- Does this help operators move faster without sacrificing clarity?

---

## Local-First Operation

Vera5 prioritizes local processing whenever possible.

The platform should:
- avoid unnecessary cloud dependency
- avoid hidden telemetry
- avoid centralized data collection
- avoid silent uploads
- minimize operational exposure

Analysts remain in control of:
- API sources
- enrichment behavior
- caching
- IOC handling
- query destinations

---

## BYOK / BYOA (Bring Your Own Keys / Bring Your Own API)

Vera5 is permanently BYOK/BYOA.

Vera5 does not:
- host shared API keys
- proxy enrichment traffic through maintainer infrastructure by default
- pool vendor quotas
- resell API access
- require Vera5-managed accounts

All enrichment credentials are:
- user-owned
- user-controlled
- locally stored

This model improves:
- privacy
- transparency
- operational trust
- portability
- analyst control

---

## Open Source From Day One

Vera5 is designed as an open-source project from inception.

The goals of open sourcing include:
- transparency
- trust
- extensibility
- community contribution
- analyst customization
- educational value
- operational credibility

The project should remain understandable, modular, and contributor-friendly.

---

# Primary Use Cases

## SOC Alert Triage

Analysts reviewing alerts inside:
- Splunk
- Elastic/Kibana
- Security Onion
- LimaCharlie
- Microsoft Sentinel
- Defender XDR
- Jira
- TheHive
- browser-based dashboards

can immediately enrich:
- IP addresses
- domains
- URLs
- hashes
- CVEs

without leaving the page.

---

## CTI Research

Threat researchers reviewing:
- threat reports
- OSINT blogs
- infrastructure reports
- GitHub repositories
- malware tracking pages
- leaked infrastructure notes

can pivot indicators directly into enrichment sources from within the browser.

---

## DFIR Investigations

During forensic review workflows, Vera5 assists analysts working with:
- logs
- timelines
- CSV exports
- HTML reports
- browser artifacts
- command output
- sandbox reports
- process trees

by providing fast contextual enrichment for suspicious indicators.

---

## Malware Analysis

Malware analysts can quickly pivot extracted:
- domains
- IPs
- URLs
- hashes
- infrastructure references

into enrichment sources without repeatedly opening new tabs or manually copying indicators.

---

# Supported Indicator Types

## Initial Focus

The initial Vera5 releases focus on:
- IPv4 addresses
- domains
- URLs
- MD5 hashes
- SHA1 hashes
- SHA256 hashes
- CVEs

Future releases may expand into:
- email addresses
- ASNs
- CIDR ranges
- malware family names
- MITRE ATT&CK identifiers
- cloud resource identifiers
- wallet addresses
- additional DFIR artifacts

---

# Enrichment Philosophy

Vera5 aggregates contextual information from analyst-configured enrichment providers.

Potential integrations include:
- VirusTotal
- AlienVault OTX
- AbuseIPDB
- URLScan
- GreyNoise
- Shodan
- Censys
- ThreatFox
- MalwareBazaar
- URLhaus
- RDAP / WHOIS
- MISP
- OpenCTI

Vera5 does not attempt to replace those platforms.

Instead, it accelerates analyst access to them.

---

# Security Model

Security and operational trust are core design priorities.

## Vera5 Must Never

- silently upload browsing history
- transmit full page contents by default
- expose stored API keys
- hide enrichment destinations
- proxy analyst traffic without consent
- perform hidden analytics collection
- require unnecessary cloud dependencies

---

## Core Security Principles

- API keys remain local
- enrichment actions are transparent
- analysts can disable sources
- manual-only mode is supported
- caching behavior is visible
- source attribution is always shown
- raw data access remains available
- source disagreement should never be hidden

---

# Privacy Model

Vera5 is intentionally privacy-conscious.

The default stance is:

> The analyst owns the data.

Vera5 should never silently collect:
- browsing history
- organization data
- page contents
- analyst identity
- credentials
- cookies
- tokens
- internal case notes

Only indicators selected for enrichment should ever be queried externally.

---

# Architecture Direction

## Browser Extension First

The primary Vera5 experience begins as a browser extension built for Chromium-based browsers.

Core extension responsibilities include:
- IOC detection
- indicator highlighting
- hover-card enrichment
- analyst pivots
- settings management
- local caching

---

## Optional Local Backend

Future versions may support an optional self-hosted local backend for:
- centralized enrichment normalization
- local API key management
- caching
- advanced scoring
- optional AI-assisted summaries

The backend remains:
- local-first
- self-hosted
- optional

---

# AI Philosophy

AI features in Vera5 are optional and should remain operationally grounded.

The objective is not:
- magical automation
- black-box scoring
- hallucinated intelligence

The objective is:
- structured summaries
- analyst assistance
- pivot recommendations
- context consolidation

Any AI-assisted capability should:
- remain explainable
- preserve source attribution
- avoid fabricated claims
- prioritize local execution where possible

---

# Non-Goals

Vera5 is not intended to become:
- a SIEM
- a SOAR platform
- an EDR
- a malware sandbox
- a vulnerability scanner
- a dark web crawler
- a replacement for analyst judgment
- a black-box AI engine

The mission remains intentionally focused:

> Deliver fast, contextual IOC enrichment directly inside analyst workflows.

---

# Public Roadmap Direction

## Initial Releases

Early releases focus on:
- browser extension stability
- IOC detection
- enrichment workflows
- analyst usability
- local-first architecture
- privacy protections
- source integrations
- caching
- export workflows

---

## Future Expansion

Long-term roadmap areas may include:
- local backend support
- advanced caching
- analyst note export
- Obsidian integration
- local AI summaries
- ATT&CK overlays
- graph pivots
- case exports
- CLI workflows
- Firefox support

---

# Long-Term Vision

The long-term vision for Vera5 is not simply a browser extension.

The long-term vision is an analyst productivity layer that sits between:
- investigations
- enrichment sources
- case workflows
- local tooling
- threat intelligence
- operational context

and reduces the friction analysts experience every day.

Vera5 aims to remain:
- lightweight
- transparent
- extensible
- privacy-conscious
- operationally useful
- community-driven

while helping analysts investigate faster with better context and fewer interruptions.