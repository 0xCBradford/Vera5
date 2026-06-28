# Local AI summary (optional)

Vera5 may offer an **opt-in, localhost-only** narrative summary: normalized enrichment JSON in, analyst-readable markdown out. The summary helps triage handoffs; it **does not** replace the local composite risk score, the deterministic **How this score was computed** explain chain, or per-source vendor rows on the hover card.

**Default posture:** Off until the operator enables it in settings. No cloud LLM provider is bundled or required. Vera5 does not operate, host, or proxy the model.

## What the feature does

| Aspect | Behavior |
|--------|----------|
| **Input** | A single normalized enrichment export document (JSON) for one indicator |
| **Output** | Markdown prose for paste into tickets, wikis, or case notes |
| **Runtime** | User-operated model on `http://127.0.0.1` (direct extension call or optional localhost backend bridge) |
| **Scope** | Summarizes fields already present on the enrichment card—never full page content |

**Out of scope for this capability:** cloud LLM as default; LLM-generated risk bands replacing composite score; sending raw vendor HTTP bodies, API keys, or page DOM to the model.

## Input contract

The summary service accepts **only** the JSON document produced by `buildEnrichmentExportDocument()` in `extension/src/lib/enrichmentExport.ts`—the same artifact as **Copy JSON** on the hover card and the contract in [export-artifacts.md](export-artifacts.md).

### Required properties

| Rule | Detail |
|------|--------|
| **Schema** | `schemaVersion` must be **`1`** (current `ENRICHMENT_EXPORT_SCHEMA_VERSION`). Reject unknown versions. |
| **Shape** | Top-level object only—no wrapper arrays, no `{ "documents": [...] }` batch envelope unless a future schema version defines one. |
| **Fields** | Required and optional fields match [JSON document contract (schema version 1)](export-artifacts.md#json-document-contract-schema-version-1): `exportedAt`, `ioc`, `iocType`, `iocTypeLabel`, `enrichmentState`, `tags`, `sources`, `disabledSources`, `score`, `disagreement`, `pivots`, optional `summary`, `disagreementNotice`, `analystNotes`. |
| **Source rows** | Each `sources[]` entry uses normalized fields only (`sourceId`, `name`, `status`, `summary`, `tags`, optional cache metadata, `badgeText`). |
| **Score block** | Use the exported `score` object (`mode`: `available`, `insufficient`, `unavailable`, or `none`) with its documented subfields—especially `summaryText`, `reasoningLines`, and `insufficientDetail` when present. |

### Recommended input state

| `enrichmentState` | Summary behavior |
|-------------------|------------------|
| `ready` | Primary path—per-source rows and score block are populated from completed enrichment. |
| `loading` | Do not call the model; wait until enrichment finishes. |
| `empty` / `error` | Do not call the model; show overlay error or empty state instead. |

### Forbidden inputs

The model request payload must **not** include any of the following—even if they exist elsewhere in the extension:

| Forbidden | Why |
|-----------|-----|
| API keys, tokens, or connector credentials | BYOK secrets stay in local storage or operator `.env`; never sent to the model. |
| Full page HTML, DOM snapshots, or selection text | Detection stays local; only the indicator value is in scope for enrichment and summary. |
| Raw vendor HTTP responses (`rawVendorJson` and similar) | Export JSON already carries normalized `sources[].summary` lines; raw bodies may contain secrets or irrelevant PII. |
| Settings export blobs, connector profile exports, or storage dumps | Unrelated to a single-indicator enrichment record. |
| Multiple unrelated IOC documents in one prompt | One summary request maps to one `EnrichmentExportDocument`. |
| Composite score inputs not present in the JSON | Do not re-fetch vendors or invent signals inside the prompt. |

Implementations should validate JSON against the schema before calling the model and **fail closed** when forbidden fields appear at the top level.

### Example input (abbreviated)

Full field reference: [export-artifacts.md — Example JSON](export-artifacts.md#example-json-schema-version-1).

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-28T15:00:00.000Z",
  "ioc": "8.8.8.8",
  "iocType": "ipv4",
  "iocTypeLabel": "IPv4 address",
  "enrichmentState": "ready",
  "summary": "84 abuse confidence",
  "tags": ["US"],
  "sources": [
    {
      "sourceId": "abuseipdb",
      "name": "AbuseIPDB",
      "status": "ok",
      "summary": "84 abuse confidence",
      "tags": ["US"],
      "badgeText": "Live"
    }
  ],
  "disabledSources": [],
  "score": {
    "mode": "insufficient",
    "label": "unknown",
    "summaryText": "Unknown risk",
    "compositeSignal": null,
    "reasoningLines": [],
    "insufficientDetail": "Blended scoring needs at least two parseable OK source signals."
  },
  "disagreement": false,
  "pivots": []
}
```

## Output format

The model returns **markdown only** (no JSON wrapper). The extension displays it in a panel labeled **AI summary (local, unverified)**—separate from **Risk score** and **How this score was computed**.

### Required sections (in order)

1. **Title line** — `# IOC summary: {ioc}` using the input `ioc` value verbatim.
2. **Type line** — `**Type:** {iocTypeLabel}` from input.
3. **Overview** — One short paragraph describing what the enabled sources reported, using only `summary`, `tags`, and `sources[].summary` / `sources[].tags`. Do not introduce new threat names or counts.
4. **Per-source notes** — Bullet list, one bullet per `sources[]` row with `status: ok`, `error`, or `skipped`. Format: `**{name}** ({badgeText}): {summary}`. For `skipped`, quote the skip reason from `summary` without implying live vendor data exists.
5. **Risk score (from enrichment JSON)** — Single line: `**Risk score:** {score.summaryText}` when `score.mode` is `available` or `insufficient`; use `score.headline` / `score.detail` when `mode` is `unavailable` or `none`. **Do not** invent a `/100` value when `compositeSignal` is `null`.
6. **Explain chain (when present)** — If `score.reasoningLines` is non-empty, subheading `### How this score was computed` followed by a numbered list copying those strings verbatim (same content as the overlay explain chain).
7. **Disagreement (when present)** — If `disagreement` is `true`, include `disagreementNotice` verbatim in a block quote or bold callout.
8. **Analyst notes (when present)** — If `analystNotes` is set, section `### Analyst notes (local)` with the text unchanged; label it as operator-authored, not model-generated.
9. **Footer disclaimers** — Always append the [fixed disclaimer block](#fixed-disclaimers) below the body.

### Output constraints (guardrails)

| Constraint | Requirement |
|------------|-------------|
| **Grounding** | Every factual claim must trace to a field in the input JSON. |
| **No new IOCs** | Do not list indicators, URLs, or hashes not present in `ioc`, `pivots`, or source summaries. |
| **No severity override** | Do not upgrade or downgrade the band beyond `score.summaryText` / `score.label`. |
| **No verdict language** | Avoid “confirmed malicious/benign”; prefer “sources report …” aligned with vendor summaries. |
| **Skipped sources** | Do not fabricate live results for `status: skipped` rows. |
| **Length** | Target 120–250 words for the overview and per-source sections combined unless the operator configures a higher limit locally. |

### Example output (illustrative)

```markdown
# IOC summary: 8.8.8.8

**Type:** IPv4 address

AbuseIPDB returned a live result with 84 abuse confidence and a US tag. OTX did not contribute parseable OK data in this export.

- **AbuseIPDB** (Live): 84 abuse confidence

**Risk score:** Unknown risk

> Blended scoring needs at least two parseable OK source signals.

---

**AI summary (local, unverified)** — Generated on your machine from enrichment JSON only. Not a risk verdict. Verify per-source rows, pivots, and the local composite score before acting.
```

## Fixed disclaimers

Use these strings in the UI panel and at the end of every generated markdown artifact.

### Panel heading (UI)

```text
AI summary (local, unverified)
```

### Panel body disclaimer (UI, above generated text)

```text
This narrative is generated by a model you run on localhost from normalized enrichment JSON only. It is not a risk verdict and does not replace the local composite score or per-source vendor rows. Verify all claims against the enrichment card before acting.
```

### Output footer (markdown, required)

```markdown
---

**AI summary (local, unverified)** — Generated on your machine from enrichment JSON only. Vera5 does not operate the model or store prompts. Not a risk verdict. Verify per-source rows, pivots, and the local composite score before acting.
```

### Operator-facing expectations

| Topic | Copy |
|-------|------|
| **Local-only** | Requests go to `http://127.0.0.1` (or an optional user-run backend on the same host)—never to Vera5-operated infrastructure. |
| **Opt-in** | Global setting default **off**; per-enrichment **Generate summary** action when enabled. |
| **No key exfiltration** | API keys and vendor credentials never enter the prompt. |
| **No page upload** | Page text and DOM are never sent—only the export JSON for the selected indicator. |

## Relationship to other enrichment surfaces

```mermaid
flowchart LR
  Enrich[Enrichment completes]
  Export[Normalized export JSON]
  Score[Local composite score]
  Explain[How this score was computed]
  Summary[Local AI summary markdown]

  Enrich --> Export
  Enrich --> Score
  Enrich --> Explain
  Export --> Summary
  Score -.->|read separately| Summary
  Explain -.->|reasoningLines copied when present| Summary
```

| Surface | Role | LLM summary interaction |
|---------|------|-------------------------|
| **Composite risk score** | Deterministic local blend from parseable vendor summaries | Summary **quotes** `score.summaryText`; must not replace or override the band. |
| **How this score was computed** | Ordered per-source reasoning lines | Summary may **copy** `score.reasoningLines` verbatim; must not invent alternate math. |
| **Per-source rows** | Live / Cached / Error / Skipped badges | Summary describes each row; must not imply Live data for Skipped rows. |
| **Copy JSON export** | Same input artifact | Summary input must byte-match the export contract, not an ad-hoc subset. |

## Implementation notes (for contributors)

- **Module home (planned):** summary client in `extension/src/lib/`; optional `/summarize` route on the localhost backend when enabled.
- **Prompt templates:** versioned template files in the repository (separate deliverable); templates reference JSON field paths, not live page context.
- **Safety tests (planned):** reject outputs that cite vendor counts or IOCs absent from fixture input; reject service invocation when the global toggle is off.

See [export-artifacts.md](export-artifacts.md) for the authoritative JSON schema and [analyst-workflows.md](analyst-workflows.md) for score and explain-chain operator guidance.

## Related documentation

- [Export artifacts](export-artifacts.md) — normalized enrichment JSON schema (summary input)
- [Analyst workflows](analyst-workflows.md) — composite score, disagreement, and explain chain
- [Local mode](local-mode.md) — extension-only posture and optional localhost backend
- [Scoring system (contributors)](contributors/scoring-system.md) — band math and insufficient-data rules
