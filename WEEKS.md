# Week-by-week TODO optimization (Vera5 roadmap expansion)

**`TODO.md` is the build framework for Vera5**—not a wishlist. Every week's tasks exist to drive **execution** (ship behavior), **validation** (prove it with tests, safety checks, and realistic operator scenarios), and **sign-off** (explicit done that can be defended in acceptance docs and release readiness).

Standing instructions for tightening or extending `TODO.md` one week at a time, including fractional insertions (**8.5, 9.5, 10.5, 11.5**) and post-MVP reordering.

**North star (current roadmap):** public open-source Chromium release with local-first, BYOK/BYOA enrichment and no telemetry/default cloud dependency.

**Correctness over checkbox count:** fewer lines are acceptable if no critical obligation is hidden: trust UX, source attribution, disagreement visibility, rate limits, privacy controls, negative paths, and USER validation.

---

## Pre-flight (before prompting)

1. In `TODO.md`, note the exact week heading you want changed (match casing).
2. Decide scope: whole week or day range (`Week N, Days 1-4 only`).
3. If adding new weeks, confirm insertion point (`8.5`, `9.5`, etc.) and acceptance filename pattern.
4. Confirm dependencies from `Vera5-SGA-Implement.md` so sequence is not broken.

---

## Prompt you can send

> Apply `WEEKS.md` to Week [N] in `TODO.md` (heading: paste exact `## ...` line). Rewrite only that week's Description (dense contract paragraph + Out of scope) and Day 1-7 tasks (or only the day range I name). Preserve every distinct obligation; merge only true duplicates; if merged, explicitly enumerate covered items (privacy controls, error paths, tests, USER checks, documentation parity, acceptance artifacts). Every task must support execution, validation, or sign-off. Use verb + object + constraint. End every line with `(AGENT)`, `(USER)`, or `(AGENT/USER)`. In your reply (not inside `TODO.md` unless I ask), include a short Coverage map (old bullets -> new task lines) so I can verify no silent drops.

---

## Quality bar

1. **Description is a contract**: launch-relevant outcome, constraints, and out-of-scope boundaries.
2. **Tasks are executable**: each checkbox implies what ships and how it is verified.
3. **Day 7 is explicit sign-off**: acceptance checklist + concrete done artifact.
4. **No silent deletion**: retain failure modes, policy checks, and USER obligations.
5. **Vera5 constraints stay locked**:
   - local-first
   - BYOK/BYOA
   - no default telemetry
   - IOC-only external queries
   - source attribution and disagreement visibility
   - no SIEM/SOAR/EDR/sandbox sprawl
6. **Public docs stay honest**: README/SECURITY/CONTRIBUTING must match implemented behavior.

---

## Avoid (common regressions)

- One vague checkbox that hides multiple obligations.
- Moving ahead with AGENT weeks while USER validation debt remains open.
- Docs that over-promise (for example claiming scoring unavailable when it is shipped, or vice versa).
- Reordering weeks without updating phase table / dependencies.
- Introducing tasks that violate non-goals (hosted proxy, hidden telemetry, black-box scoring).

---

## Workflow

1. Pre-flight.
2. Send focused week prompt.
3. Review diff + coverage map.
4. Commit `TODO.md` after each accepted week-level edit.

If rewrite is wrong: restore `TODO.md` to last good commit before re-prompting.

---

## Vera5 week insertion guidance (authoritative for expansions)

Use this table as the completeness check when adding or tightening roadmap weeks.

| Week | Vera5-critical themes to keep explicit |
|------|----------------------------------------|
| **8.5** | Production scoring parity: mount risk/disagreement in `hoverCardOverlay`, align README/docs, resolve `iocTypeEnabled` truth (wire or remove claim), add settings parity (per-type IOC toggles, cache TTL, private IPv4 toggle), close Week 6-8 USER validation debt where possible. |
| **9** | Export/artifacts: markdown + JSON schemaVersion, source attribution in exports, local notes, score/disagreement fields in exports, USER case-note paste validation, acceptance artifact. |
| **9.5** | IOC tray / scan summary: per-tab IOC list, type filters/counts, row -> highlight/card jump, copy/export subsets, USER triage on dense sample page. |
| **10** | Analyst workflow hardening: Splunk/Security Onion fixtures, selection/manual scan on heavy DOMs, performance caps, false-positive tuning, keyboard navigation improvements, fixture-based non-breakage USER checks. |
| **10.5** | Trust UX + query transparency: pre-query disclosure UX, domain allow/deny policies, sensitive-domain defaults guidance, policy tests, USER trust-path validation on webmail + SOC fixture. |
| **11** | Security hardening and CI: dependency policy, CSP/remote-origin review, logging hygiene/redaction, secret-scan verification, threat scenarios and checklist closure. |
| **11.5** | Browser E2E: Playwright harness for unpacked extension, scan/open/export smoke paths, CI gating, deterministic mocks (no live vendor API calls in CI). |
| **12** | OSS release prep: docs/screenshots/changelog/templates, full regression, store draft assets, release notes, final MVP acceptance closure. |
| **12.5** *(optional)* | Pre-launch buffer: resolve remaining USER matrix tasks, onboarding polish, no net-new risky features. |
| **13** *(recommended reorder)* | URLScan live connector before backend work (daily-use value and architecture connector order). |
| **14** *(recommended reorder)* | GreyNoise community live connector with quota/error handling and docs parity. |
| **15** | Optional local FastAPI backend (moved from old Week 13). |
| **16** | VT/Shodan/Censys expansion (moved from old Week 14). |
| **17** | Phase 2 IOC types (moved from old Week 15). |
| **18** | Optional local LLM summary (moved from old Week 16). |
| **19** | Firefox MV3 port and packaging parity. |
| **20** | Operator UX pack: context menu enrich, source health panel, local investigation history. |
| **21** | Connector SDK/registry + storage schema migrations + compatibility checks. |
| **22** | Opt-in attribute/`href` IOC extraction with strict safety/perf controls. |
| **23** | RDAP/WHOIS and team-adjacent settings packs (still local-first and non-SaaS by default). |

---

## Dependency rules (do not violate)

1. **8.5 before 9/9.5**: scoring must be visible in production overlay before export/tray claims.
2. **9 before 9.5 export subset features**: tray reuse of export builders depends on Week 9 schema.
3. **10.5 before store-facing trust claims**: query transparency must land before Week 12 listing copy.
4. **11.5 before Week 12 release sign-off**: no launch prep without browser E2E smoke guard.
5. **URLScan/GreyNoise before backend (recommended)** if roadmap is optimized for analyst daily value.

---

## Things NOT to add as roadmap work

- Vera5-hosted enrichment proxy by default
- Shared/team cloud API keys
- Default telemetry or hidden analytics
- Full-page uploads to Vera5 infrastructure
- Black-box AI risk scoring
- SIEM/SOAR/EDR/sandbox feature sprawl
- Mandatory cloud LLM path

If a candidate task conflicts with `TODO.md` non-goals or non-negotiables, reject it or mark it explicitly out-of-scope.

---

## Before accepting a week rewrite

- [ ] Coverage map reviewed (no lost obligations)
- [ ] Description + Out of scope are explicit and tight
- [ ] Every task ends with `(AGENT)`, `(USER)`, `(AGENT/USER)`
- [ ] Day 7 includes acceptance/sign-off artifact
- [ ] README/security/contributor parity obligations remain explicit where relevant
- [ ] Diff touches only intended week block(s)
- [ ] Added week numbers also reflected in phase/dependency expectations when needed

---

## Notes

- Keep this file internal planning guidance (same class as roadmap tooling docs).
- Use `Vera5-SGA-Implement.md` as the detailed mapping source and this file as the operational rewrite standard.
