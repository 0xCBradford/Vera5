# Security Policy

Vera5 is a local-first browser extension for IOC enrichment. This document describes the security and privacy model for the repository as it exists today (foundation and scaffold). Update it when manifest permissions, connectors, and UI behavior ship.

## Scope

Vera5 runs in the analyst’s browser. It may read page content to detect indicators of compromise (IOCs). Enrichment uses **your** threat-intelligence API keys (bring-your-own keys / bring-your-own API). Vera5 does not operate a required cloud service for enrichment.

## Threat model

| Risk | Mitigation (design intent) |
|------|----------------------------|
| Extension access to page DOM | Design intent: scan only for IOC detection; skip script/style where possible; optional manual-only mode when implemented |
| API key exposure | Design intent: keys in extension storage or optional self-hosted env; never committed to the repository |
| IOC disclosure to third parties | Design intent: only indicator values sent to vendors you enable—not full page HTML to Vera5 infrastructure |
| Sensitive internal IOCs leaving the org | Design intent: analyst controls sources, toggles, and manual mode |
| Malicious or confusing page content | Design intent: conservative matching, allowlist/denylist options, honest error states |
| Analyst misinterpretation | Design intent: source attribution and visible uncertainty |

## IOC leakage and third-party APIs

When you enrich an IOC, the **indicator value** and necessary request metadata are sent to the **third-party APIs you configure** (for example AbuseIPDB, OTX, VirusTotal). Those requests do not go through a Vera5-operated enrichment proxy by default.

**You are responsible for:**

- Choosing which sources to enable
- Understanding each vendor’s data handling, retention, and jurisdictional terms
- Avoiding enrichment of highly sensitive indicators on vendors you do not trust

Vera5 does not upload your browsing history, full page text, tickets, or session tokens to Vera5-maintained servers.

## Telemetry and analytics

**Default stance: no telemetry.**

Vera5 is not designed to collect usage analytics, crash telemetry, or browsing history for the maintainers. If optional diagnostics are ever offered, they must be explicit, documented, and off by default.

## Secrets and repository hygiene

- Do not commit API keys, `.env` files, or credential exports.
- Use the project `.gitignore` and local secret storage only.
- Do not paste keys into screenshots, issues, or public discussions.

## Local-first and optional backend

The extension is intended to work without a Vera5-hosted backend. An optional **localhost / self-hosted** backend may be used later to keep keys off the extension surface; that mode remains under your control.

## Reporting a vulnerability

If you believe you have found a security issue in Vera5:

1. **Do not** open a public issue with exploit details or live secrets.
2. Report privately to the repository maintainers (contact method will be listed in `README.md` when published).
3. Include reproduction steps, affected version, and impact assessment.

We aim to acknowledge reports in a reasonable timeframe and coordinate fixes before public disclosure when appropriate.

## Document status

Matches foundation-phase behavior and documented design intent. Revise when install steps, manifest permissions, and connectors are implemented so the policy reflects shipped behavior only.
