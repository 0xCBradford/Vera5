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
.vera5-hover-card-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
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
.vera5-hover-card-pivot-recipes {
  margin-bottom: 8px;
}
.vera5-hover-card-pivot-recipes-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.vera5-hover-card-pivot-recipe {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}
.vera5-hover-card-pivot-recipe:last-child {
  margin-bottom: 0;
}
.vera5-hover-card-pivot-recipe-source {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--vera5-accent) 18%, var(--vera5-button-bg));
  color: var(--vera5-accent-text);
}
.vera5-hover-card-pivot-recipe-guidance {
  flex: 1 1 100%;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted);
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
.vera5-hover-card-section-heading {
  margin: 12px 0 10px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  color: var(--vera5-muted-label);
  line-height: 1.05;
}
.vera5-hover-card-intel-summary {
  margin-bottom: 8px;
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
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--vera5-accent);
}
.vera5-hover-card-source-item:last-child {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: none;
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
.vera5-hover-card-analyst-notes {
  margin-top: 8px;
}
.vera5-hover-card-analyst-notes-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-analyst-notes-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}
.vera5-hover-card-analyst-notes-input::placeholder {
  color: #64748b;
}
.vera5-hover-card-analyst-notes-input:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-export {
  margin-top: 8px;
}
.vera5-hover-card-export-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-actions {
  justify-content: center;
}
.vera5-hover-card-export-footer .vera5-hover-card-scan-export-template-row {
  justify-content: center;
  margin-top: 0;
  width: 100%;
}
.vera5-hover-card-export-footer .vera5-hover-card-scan-export-status {
  text-align: center;
  width: 100%;
}
.vera5-hover-card-export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vera5-hover-card-export-actions + .vera5-hover-card-export-actions {
  margin-top: 8px;
}
.vera5-hover-card-scan-export {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.vera5-hover-card-scan-export-template-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
}
.vera5-hover-card-scan-export-template-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vera5-text-muted);
}
.vera5-hover-card-scan-export-template-select {
  flex: 1 1 140px;
  min-width: 140px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  color: var(--vera5-accent-text);
  font-size: 11px;
  font-family: inherit;
}
.vera5-hover-card-scan-export-status {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-text-muted);
}
.vera5-hover-card-scan-export-status--success {
  color: var(--vera5-success-text);
}
.vera5-hover-card-scan-export-status--error {
  color: var(--vera5-danger-text);
}
.vera5-hover-card-export-button {
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
.vera5-hover-card-export-dropdown {
  position: relative;
}
.vera5-hover-card-export-dropdown-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 4px);
  z-index: 1;
  min-width: 100%;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-button-bg);
  box-shadow: var(--vera5-shadow);
}
.vera5-hover-card-export-dropdown-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: var(--vera5-accent-text);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.vera5-hover-card-export-dropdown-item:hover,
.vera5-hover-card-export-dropdown-item:focus-visible {
  background-color: color-mix(in srgb, var(--vera5-accent) 12%, transparent);
  outline: none;
}
.vera5-ioc-highlight {
  --vera5-highlight-accent: #39ff14;
  --vera5-highlight-underline: color-mix(in srgb, #39ff14 85%, transparent);
  --vera5-highlight-bg: color-mix(in srgb, #39ff14 30%, transparent);
  --vera5-highlight-badge-text: #052e16;
  --vera5-highlight-badge-bg: color-mix(in srgb, #39ff14 55%, #ffffff);
  --vera5-enrich-icon: #16a34a;
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
  .vera5-hover-card-export-button,
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
    --vera5-highlight-accent: #39ff14;
    --vera5-highlight-underline: color-mix(in srgb, #39ff14 90%, transparent);
    --vera5-highlight-bg: color-mix(in srgb, #39ff14 35%, transparent);
    --vera5-highlight-badge-text: #052e16;
    --vera5-highlight-badge-bg: color-mix(in srgb, #39ff14 72%, #000000);
    --vera5-enrich-icon: #39ff14;
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
.vera5-workspace-host {
  position: fixed;
  top: 0;
  right: 0;
  width: calc(var(--vera5-workspace-width, 380px) + var(--vera5-workspace-gutter, 8px));
  height: 100vh;
  z-index: 2147483645;
  pointer-events: auto;
  box-sizing: border-box;
  padding: 8px 8px 8px 0;
}
.vera5-workspace-host[hidden] {
  display: none !important;
}
html.vera5-workspace-open {
  margin-right: var(--vera5-workspace-width, 388px);
  transition: margin-right 0.2s ease;
}
.vera5-workspace-sidebar {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #475569;
  border-radius: 12px;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  overflow: hidden;
}
.vera5-workspace-shell {
  position: relative;
  display: flex;
  align-items: stretch;
  height: calc(100vh - 16px);
}
.vera5-workspace-edge-tab {
  position: absolute;
  left: -13px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 52px;
  padding: 0;
  margin: 0;
  border: 1px solid #475569;
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: #334155;
  color: #60a5fa;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  box-shadow: -3px 0 10px rgba(0, 0, 0, 0.28);
}
.vera5-workspace-edge-tab:hover,
.vera5-workspace-edge-tab:focus-visible {
  background: #3b4558;
  color: #93c5fd;
  outline: none;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.35);
}
.vera5-workspace-sidebar--collapsed .vera5-workspace-top,
.vera5-workspace-sidebar--collapsed .vera5-workspace-bottom,
.vera5-workspace-sidebar--collapsed .vera5-workspace-divider {
  display: none;
}
.vera5-workspace-sidebar--collapsed .vera5-workspace-title {
  display: none;
}
.vera5-workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.vera5-workspace-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #60a5fa;
  text-decoration: none;
  text-shadow:
    0 0 6px rgba(255, 255, 255, 0.28),
    0 0 14px rgba(255, 255, 255, 0.12);
}
.vera5-workspace-title:hover,
.vera5-workspace-title:focus-visible {
  color: #93c5fd;
  text-decoration: none;
  outline: none;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.45);
  border-radius: 4px;
}
.vera5-workspace-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: #dbeafe;
  cursor: pointer;
}
.vera5-workspace-top,
.vera5-workspace-bottom {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  scrollbar-color: #3b82f6 #ffffff;
  scrollbar-width: thin;
}
.vera5-workspace-top::-webkit-scrollbar,
.vera5-workspace-bottom::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.vera5-workspace-top::-webkit-scrollbar-track,
.vera5-workspace-bottom::-webkit-scrollbar-track {
  background: #ffffff;
}
.vera5-workspace-top::-webkit-scrollbar-thumb,
.vera5-workspace-bottom::-webkit-scrollbar-thumb {
  background: #3b82f6;
  border-radius: 999px;
  border: 2px solid #ffffff;
}
.vera5-workspace-top::-webkit-scrollbar-button,
.vera5-workspace-bottom::-webkit-scrollbar-button {
  background: #3b82f6;
}
.vera5-workspace-divider {
  flex-shrink: 0;
  height: 4px;
  background: #475569;
  border: 0;
  margin: 0;
}
.vera5-workspace-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}
.vera5-workspace-toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.vera5-workspace-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 1 1 calc(50% - 4px);
  min-width: 0;
  padding: 6px 8px 6px 10px;
  border-radius: 999px;
  border: 1px solid #475569;
  background: #334155;
  color: #dbeafe;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.vera5-workspace-toggle-label {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.2;
}
.vera5-workspace-toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 30px;
  height: 16px;
  border-radius: 999px;
  background: #475569;
  border: 1px solid #64748b;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.vera5-workspace-toggle-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e2e8f0;
  transition: transform 0.15s ease, background 0.15s ease;
}
.vera5-workspace-toggle--on {
  border-color: #475569;
  background: #334155;
  color: #dbeafe;
}
.vera5-workspace-toggle--on .vera5-workspace-toggle-switch {
  background: #1d4ed8;
  border-color: #2563eb;
}
.vera5-workspace-toggle--on .vera5-workspace-toggle-knob {
  transform: translateX(14px);
  background: #ffffff;
}
.vera5-workspace-toggle:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.vera5-workspace-button {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.vera5-workspace-button:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}
.vera5-workspace-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  border-color: #475569;
  background: #334155;
  color: #94a3b8;
}
.vera5-workspace-tray-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 14px 0 8px;
  padding-top: 12px;
  border-top: 1px solid #475569;
}
.vera5-workspace-tray-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #dbeafe;
}
.vera5-workspace-icon-button {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: #60a5fa;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.vera5-workspace-icon-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.vera5-workspace-icon-button--spinning {
  animation: vera5-workspace-spin 0.8s linear infinite;
}
.vera5-hover-card-detail-clear {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: #60a5fa;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.vera5-hover-card-detail-clear:hover {
  background: #3b4558;
  color: #93c5fd;
}
@keyframes vera5-workspace-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.vera5-workspace-tray-summary {
  margin: 0 0 10px;
  font-size: 12px;
  color: #94a3b8;
}
.vera5-workspace-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.vera5-workspace-filter-chip {
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid #475569;
  background: #334155;
  color: #dbeafe;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vera5-workspace-filter-chip[aria-pressed="true"] {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
}
.vera5-workspace-tray-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.vera5-workspace-tray-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #0f172a;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}
.vera5-workspace-tray-row[aria-selected="true"] {
  border-color: #60a5fa;
  background: color-mix(in srgb, #60a5fa 12%, #0f172a);
}
.vera5-workspace-tray-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: #334155;
  color: #60a5fa;
  font-size: 10px;
  font-weight: 700;
}
.vera5-workspace-tray-value {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: #e2e8f0;
}
.vera5-workspace-tray-hint {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #334155;
  color: #94a3b8;
  pointer-events: none;
  user-select: none;
}
.vera5-workspace-tray-hint--live {
  color: #bbf7d0;
}
.vera5-workspace-tray-hint--error {
  color: #fca5a5;
}
.vera5-workspace-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #fca5a5;
  line-height: 1.5;
}
.vera5-workspace-detail-panel {
  max-width: none !important;
  width: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  animation: none !important;
  padding: 0 !important;
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
  --vera5-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  html.vera5-workspace-open {
    transition: none;
  }
  .vera5-workspace-icon-button--spinning {
    animation: none;
  }
  .vera5-workspace-toggle-switch,
  .vera5-workspace-toggle-knob {
    transition: none;
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
