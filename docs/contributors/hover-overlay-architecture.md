# Hover overlay architecture

Vera5 has two hover UIs that share enrichment and scoring logic but serve different runtimes.

**Production overlay vs test UI**

```mermaid
flowchart TD
  CS[Content script]
  Enrich[Enrichment actions]
  VM[Shared view model]
  Overlay[Production overlay]
  React[React test UI]

  CS --> Enrich
  Enrich --> VM
  VM --> Overlay
  VM --> React
```

Enrichment actions on the page feed the shared view model; production overlay and React test UI consume the same normalized data and scoring presentation rules.

## Production overlay (content script)

**Module:** `extension/src/content/hoverCardOverlay.ts`

- Rendered in the page as DOM built by the content script (not React on live tabs).
- Opened when the analyst clicks a highlight after scan.
- Shows type, value, enrichment rows, Live/Cached/Error badges, raw JSON panel, copy, recommended next pivots with source-attributed links, composite risk score, reasoning chain when data allows, and a local **Analyst notes** textarea keyed per indicator (`extension/src/lib/analystNotesSession.ts` with persistence in `extension/src/lib/analystNotesStorage.ts`).

This is the **primary operator surface** documented in [README.md](../../README.md) and [docs/analyst-workflows.md](../analyst-workflows.md).

## React hover card (tests and dev)

**Modules:** `extension/src/components/HoverCard.tsx`, `RiskScore.tsx`, `RiskScoreReasoningChain.tsx`

- Used by Vitest and optional Vite dev shell (`npm run dev`).
- **Not** injected into arbitrary web pages in production builds.
- May render **per-source contribution chips** that the overlay omits; scoring rules still come from `extension/src/lib/scoring.ts`.
- Mirrors the overlay **Analyst notes** textarea for tests and dev.

## Shared view-model

**Module:** `extension/src/lib/hoverCardEnrichment.ts`

Centralizes:

- Normalized per-source summaries and badges
- Risk score presentation (`resolveHoverCardRiskScorePresentation`)
- Reasoning chain construction (`buildHoverCardRiskReasoningChain`)

Pivot recipe suggestions (`extension/src/lib/pivots.ts` → `getPivotRecipes`) supply static, type-specific recommended pivots with vendor attribution in the production overlay panel. Guidance copy lives in `PIVOT_RECIPE_RULES` and describes analyst workflow steps only; it never reflects live enrichment scores, vendor ratios, cache state, or other API-derived facts.

Filtered tray subset export in the overlay **Export** / **Copy** menus and the template row call `buildTraySubsetEnrichmentRecords()` and route Markdown through `renderTraySubsetExportTemplate()` / `downloadTrayTemplateExportFile()` in `extension/src/lib/exportTemplates.ts`. JSON subset export still uses the Week 9 JSON builders in `enrichmentExport.ts`.

Both overlay and React paths should call these helpers to avoid drift. Regression tests:

- `hoverCardOverlay.test.ts`
- `hoverCardEnrichment.test.ts`
- `RiskScore.test.tsx`

## Enrich trigger on page

- **›** on a highlight requests enrichment (respects manual-only mode).
- Debounced auto-fetch when manual-only is off: `extension/src/content/enrichmentAutoFetch.ts`.
- Messages to background: `extension/src/content/enrichmentMessageClient.ts` → `enrichmentHandler.ts`.

## Drift checklist for PRs

When changing card layout or score copy, update **both**:

1. `hoverCardOverlay.ts` (production)
2. Shared lib + React tests (or explicitly document intentional overlay-only differences)

Document intentional differences in the PR (for example chips only in React tests).
