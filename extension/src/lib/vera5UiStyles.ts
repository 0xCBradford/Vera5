import type { HoverCardEnrichmentState } from "./hoverCardEnrichment";

export const VERA5_UI_STYLE_ID = "vera5-ui-styles";

export const HOVER_CARD_ENRICHMENT_MODIFIER_CLASS: Record<
  HoverCardEnrichmentState,
  string
> = {
  empty: "vera5-hover-card-enrichment--empty",
  loading: "vera5-hover-card-enrichment--loading",
  error: "vera5-hover-card-enrichment--error",
  ready: "vera5-hover-card-enrichment--ready",
};

export function buildEnrichmentSummaryClassName(
  variant: HoverCardEnrichmentState,
  baseClass = "vera5-hover-card-enrichment"
): string {
  return `${baseClass} ${HOVER_CARD_ENRICHMENT_MODIFIER_CLASS[variant]}`;
}

export function buildVera5UiStylesCss(): string {
  return `
.vera5-hover-card-panel {
  --vera5-surface: #f8fafc;
  --vera5-text: #1a1a1a;
  --vera5-border: #c5d4e8;
  --vera5-accent: #1a5fb4;
  --vera5-accent-text: #1a3f6b;
  --vera5-muted: #4a5568;
  --vera5-muted-label: #6b7280;
  --vera5-error: #9b2c2c;
  --vera5-ready: #1a3f6b;
  --vera5-button-bg: #ffffff;
  --vera5-copy-success-bg: #e8f4ea;
  --vera5-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  box-sizing: border-box;
  min-width: 220px;
  max-width: 320px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-surface);
  color: var(--vera5-text);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: var(--vera5-shadow);
  pointer-events: auto;
  animation: vera5-panel-reveal 0.16s ease-out;
}
@keyframes vera5-panel-reveal {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.vera5-hover-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.vera5-hover-card-type {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-accent);
}
.vera5-hover-card-value {
  margin: 0 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
.vera5-hover-card-enrichment {
  margin: 0;
  font-size: 12px;
}
.vera5-hover-card-enrichment--empty,
.vera5-hover-card-enrichment--loading {
  color: var(--vera5-muted);
}
.vera5-hover-card-enrichment--loading {
  font-style: italic;
  animation: vera5-loading-pulse 1.4s ease-in-out infinite;
}
@keyframes vera5-loading-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
.vera5-hover-card-enrichment--error {
  color: var(--vera5-error);
}
.vera5-hover-card-enrichment--ready {
  color: var(--vera5-ready);
}
.vera5-hover-card-risk-score {
  margin: 8px 0;
}
.vera5-hover-card-risk-score-label {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-score-unavailable {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-score-insufficient {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-score-unavailable-detail {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-disagreement {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vera5-error);
}
.vera5-hover-card-risk-reasoning {
  margin: 0 0 6px;
}
.vera5-hover-card-risk-reasoning-heading {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-reasoning-chain {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-accent-text);
}
.vera5-hover-card-risk-reasoning-step {
  margin: 0 0 2px;
}
.vera5-hover-card-risk-reasoning-empty {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-risk-contributions {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.vera5-hover-card-risk-contribution {
  margin: 0;
}
.vera5-hover-card-risk-contribution-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-accent-text);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
}
.vera5-hover-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.vera5-hover-card-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.vera5-hover-card-attribution {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--vera5-border);
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-disclaimer {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--vera5-border);
  font-size: 10px;
  line-height: 1.35;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-disclaimer p {
  margin: 0 0 4px;
}
.vera5-hover-card-disclaimer p:last-child {
  margin-bottom: 0;
}
.vera5-hover-card-action {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-accent-text);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.vera5-hover-card-retry-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-copy {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-accent-text);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.vera5-hover-card-copy--copied {
  background-color: var(--vera5-copy-success-bg);
}
.vera5-hover-card-pivots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vera5-hover-card-pivot-link {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-accent-text);
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.vera5-hover-card-sources {
  margin-bottom: 8px;
}
.vera5-hover-card-sources-heading {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-sources-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.vera5-hover-card-source-item {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--vera5-muted-label);
  line-height: 1.4;
}
.vera5-hover-card-source-badge {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  white-space: nowrap;
}
.vera5-hover-card-source-badge--ok {
  color: #166534;
  background-color: color-mix(in srgb, #22c55e 16%, white);
  border-color: color-mix(in srgb, #22c55e 35%, var(--vera5-border));
}
.vera5-hover-card-source-badge--cached {
  color: #1e40af;
  background-color: color-mix(in srgb, #3b82f6 14%, white);
  border-color: color-mix(in srgb, #3b82f6 35%, var(--vera5-border));
}
.vera5-hover-card-source-last-updated {
  display: block;
  font-size: 10px;
  color: var(--vera5-muted-label);
  line-height: 1.35;
}
.vera5-hover-card-source-badge--error {
  color: #991b1b;
  background-color: color-mix(in srgb, #ef4444 14%, white);
  border-color: color-mix(in srgb, #ef4444 35%, var(--vera5-border));
}
.vera5-hover-card-source-badge--skipped {
  color: var(--vera5-muted-label);
  background-color: var(--vera5-button-bg);
}
.vera5-hover-card-source-detail {
  display: block;
  color: var(--vera5-text);
}
.vera5-hover-card-raw-json {
  margin-top: 4px;
}
.vera5-hover-card-raw-json summary {
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  color: var(--vera5-accent-text);
  list-style-position: outside;
}
.vera5-hover-card-raw-json-body {
  margin: 4px 0 0;
  padding: 6px 8px;
  max-height: 160px;
  overflow: auto;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vera5-text);
}
.vera5-ioc-highlight {
  --vera5-highlight-accent: #1a5fb4;
  --vera5-highlight-underline: color-mix(in srgb, #1a5fb4 75%, transparent);
  --vera5-highlight-bg: color-mix(in srgb, #1a5fb4 12%, transparent);
  --vera5-highlight-badge-text: #1a3f6b;
  --vera5-highlight-badge-bg: color-mix(in srgb, #1a5fb4 18%, white);
  --vera5-enrich-icon: #1a5fb4;
  display: inline;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  text-decoration-color: var(--vera5-highlight-underline);
  background-color: var(--vera5-highlight-bg);
  border-radius: 2px;
  padding: 0 1px;
  margin: 0;
  vertical-align: baseline;
  white-space: inherit;
  cursor: pointer;
}
.vera5-ioc-badge {
  display: inline;
  font-size: 0.65em;
  font-weight: 600;
  line-height: 1;
  margin-left: 2px;
  padding: 0 3px;
  vertical-align: super;
  border-radius: 3px;
  color: var(--vera5-highlight-badge-text);
  background-color: var(--vera5-highlight-badge-bg);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.vera5-ioc-enrich-icon {
  display: inline;
  font-size: 0.6em;
  line-height: 1;
  margin-left: 2px;
  vertical-align: super;
  color: var(--vera5-enrich-icon);
  opacity: 0.9;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .vera5-hover-card-panel,
  .vera5-hover-card-copy,
  .vera5-hover-card-pivot-link,
  .vera5-hover-card-enrichment--loading,
  .vera5-ioc-highlight {
    animation: none !important;
    transition: none !important;
  }
  .vera5-hover-card-enrichment--loading {
    font-style: normal;
  }
}
@media (prefers-color-scheme: dark) {
  .vera5-hover-card-panel {
    --vera5-surface: #1e293b;
    --vera5-text: #e2e8f0;
    --vera5-border: #475569;
    --vera5-accent: #60a5fa;
    --vera5-accent-text: #dbeafe;
    --vera5-muted: #94a3b8;
    --vera5-muted-label: #94a3b8;
    --vera5-error: #fca5a5;
    --vera5-ready: #93c5fd;
    --vera5-button-bg: #334155;
    --vera5-copy-success-bg: #14532d;
    --vera5-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  }
  .vera5-ioc-highlight {
    --vera5-highlight-accent: #60a5fa;
    --vera5-highlight-underline: color-mix(in srgb, #60a5fa 80%, transparent);
    --vera5-highlight-bg: color-mix(in srgb, #60a5fa 20%, transparent);
    --vera5-highlight-badge-text: #dbeafe;
    --vera5-highlight-badge-bg: color-mix(in srgb, #60a5fa 24%, #1e293b);
    --vera5-enrich-icon: #93c5fd;
  }
  .vera5-hover-card-source-badge--ok {
    color: #bbf7d0;
    background-color: color-mix(in srgb, #22c55e 22%, #1e293b);
    border-color: color-mix(in srgb, #22c55e 40%, #475569);
  }
  .vera5-hover-card-source-badge--error {
    color: #fecaca;
    background-color: color-mix(in srgb, #ef4444 20%, #1e293b);
    border-color: color-mix(in srgb, #ef4444 40%, #475569);
  }
}
`.trim();
}

export function ensureVera5UiStyles(doc: Document = document): void {
  if (doc.getElementById(VERA5_UI_STYLE_ID)) {
    return;
  }

  const style = doc.createElement("style");
  style.id = VERA5_UI_STYLE_ID;
  style.textContent = buildVera5UiStylesCss();
  doc.head?.appendChild(style);
}
