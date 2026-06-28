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
  --vera5-surface: #12171e;
  --vera5-text: #f5f7fa;
  --vera5-border: #313a45;
  --vera5-accent: #ffb224;
  --vera5-accent-text: #f5f7fa;
  --vera5-muted: #a7b0ba;
  --vera5-muted-label: #a7b0ba;
  --vera5-error: #ff4d5a;
  --vera5-ready: #f5f7fa;
  --vera5-button-bg: #19202a;
  --vera5-copy-success-bg: color-mix(in srgb, #22c7a9 16%, #12171e);
  --vera5-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
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
.vera5-hover-card-value-on-page {
  margin: 0 0 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
  color: var(--vera5-text);
}
.vera5-hover-card-refanged-value {
  margin: 0 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  word-break: break-all;
  color: var(--vera5-muted-label);
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
.vera5-pre-query-disclosure {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--vera5-border);
  border-radius: 6px;
  background-color: var(--vera5-button-bg);
}
.vera5-pre-query-disclosure__message {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vera5-accent-text);
}
.vera5-pre-query-disclosure__remember {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
  cursor: pointer;
}
.vera5-pre-query-disclosure__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
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
  color: #22c7a9;
  background-color: color-mix(in srgb, #22c7a9 16%, #12171e);
  border-color: color-mix(in srgb, #22c7a9 35%, var(--vera5-border));
}
.vera5-hover-card-source-badge--cached {
  color: #a7b0ba;
  background-color: var(--vera5-button-bg);
  border-color: var(--vera5-border);
}
.vera5-hover-card-source-last-updated {
  display: block;
  font-size: 10px;
  color: var(--vera5-muted-label);
  line-height: 1.35;
}
.vera5-hover-card-source-badge--error {
  color: #ff4d5a;
  background-color: color-mix(in srgb, #ff4d5a 14%, #12171e);
  border-color: color-mix(in srgb, #ff4d5a 35%, var(--vera5-border));
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
.vera5-why-detected {
  margin-top: 4px;
}
.vera5-why-detected-row {
  margin: 0 0 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vera5-muted-label);
}
.vera5-why-detected-context {
  word-break: break-word;
}
.vera5-why-detected-overlaps-heading {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vera5-muted-label);
}
.vera5-why-detected-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vera5-muted-label);
}
.vera5-why-detected-item {
  margin-bottom: 2px;
  word-break: break-word;
}
.vera5-tray-why-detected {
  width: 100%;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vera5-muted-label);
}
.vera5-tray-why-detected summary {
  cursor: pointer;
  color: var(--vera5-accent-text);
  font-weight: 600;
  list-style-position: outside;
}
.vera5-tray-why-detected .vera5-why-detected {
  margin-top: 4px;
}
.vera5-tray-save-collection {
  margin-top: 4px;
}
.vera5-tray-save-collection-toggle {
  border: none;
  background: transparent;
  color: var(--vera5-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 0;
}
.vera5-tray-save-collection-panel {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vera5-border);
  background: var(--vera5-surface);
}
.vera5-tray-save-collection-heading {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vera5-accent-text);
}
.vera5-tray-save-collection-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.vera5-tray-save-collection-feedback {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vera5-text-muted);
  line-height: 1.4;
}
.vera5-workspace-field-label {
  display: block;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vera5-text-muted);
}
.vera5-workspace-field-label input {
  display: block;
  width: 100%;
  margin-top: 4px;
  box-sizing: border-box;
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
  background-color: #19202a;
  color: #f5f7fa;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}
.vera5-hover-card-analyst-notes-input::placeholder {
  color: #6b7480;
}
.vera5-hover-card-analyst-notes-input:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-ioc-label {
  margin-top: 8px;
}
.vera5-hover-card-ioc-label-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-ioc-label-select {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--vera5-border);
  background-color: #19202a;
  color: #f5f7fa;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
}
.vera5-hover-card-ioc-label-select:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-ioc-timeline {
  margin-top: 8px;
}
.vera5-hover-card-ioc-timeline-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-ioc-timeline-list {
  margin: 0;
  padding-left: 16px;
  color: #a7b0ba;
  font-size: 12px;
  line-height: 1.5;
}
.vera5-hover-card-ioc-timeline-item {
  margin: 0;
}
.vera5-hover-card-ioc-pin {
  border: 1px solid var(--vera5-border);
  border-radius: 4px;
  background: #19202a;
  color: #f5f7fa;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  padding: 4px 8px;
  cursor: pointer;
}
.vera5-hover-card-ioc-pin--pinned {
  border-color: color-mix(in srgb, var(--vera5-accent) 45%, var(--vera5-border));
  color: var(--vera5-accent-text);
  background: color-mix(in srgb, var(--vera5-accent) 8%, #12171e);
}
.vera5-hover-card-ioc-pin:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-save-collection {
  margin-top: 8px;
}
.vera5-hover-card-save-collection-toggle {
  border: none;
  background: transparent;
  color: var(--vera5-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 0;
}
.vera5-hover-card-save-collection-panel {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vera5-border);
  background: var(--vera5-surface);
}
.vera5-hover-card-save-collection-heading {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vera5-accent-text);
}
.vera5-hover-card-save-collection-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.vera5-hover-card-save-collection-field {
  display: block;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vera5-text-muted);
}
.vera5-hover-card-save-collection-field input {
  display: block;
  width: 100%;
  margin-top: 4px;
  box-sizing: border-box;
}
.vera5-hover-card-save-collection-feedback {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vera5-text-muted);
  line-height: 1.4;
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
  --vera5-highlight-accent: #ffb224;
  --vera5-highlight-underline: color-mix(in srgb, #ffb224 85%, transparent);
  --vera5-highlight-bg: color-mix(in srgb, #ffb224 22%, transparent);
  --vera5-highlight-badge-text: #0b0e11;
  --vera5-highlight-badge-bg: color-mix(in srgb, #ffb224 70%, #0b0e11);
  --vera5-enrich-icon: #ffb224;
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
.vera5-ioc-highlight:focus-visible {
  outline: 2px solid var(--vera5-highlight-accent);
  outline-offset: 2px;
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
    --vera5-surface: #12171e;
    --vera5-text: #f5f7fa;
    --vera5-border: #313a45;
    --vera5-accent: #ffb224;
    --vera5-accent-text: #f5f7fa;
    --vera5-muted: #a7b0ba;
    --vera5-muted-label: #a7b0ba;
    --vera5-error: #ff4d5a;
    --vera5-ready: #f5f7fa;
    --vera5-button-bg: #19202a;
    --vera5-copy-success-bg: color-mix(in srgb, #22c7a9 16%, #12171e);
    --vera5-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  }
  .vera5-hover-card-source-badge--ok {
    color: #22c7a9;
    background-color: color-mix(in srgb, #22c7a9 22%, #12171e);
    border-color: color-mix(in srgb, #22c7a9 40%, #313a45);
  }
  .vera5-hover-card-source-badge--error {
    color: #ff4d5a;
    background-color: color-mix(in srgb, #ff4d5a 20%, #12171e);
    border-color: color-mix(in srgb, #ff4d5a 40%, #313a45);
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
  background: #12171e;
  color: #f5f7fa;
  border: 1px solid #313a45;
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
  border: 1px solid #313a45;
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: #222b36;
  color: #a7b0ba;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  box-shadow: -3px 0 10px rgba(0, 0, 0, 0.28);
}
.vera5-workspace-edge-tab:hover,
.vera5-workspace-edge-tab:focus-visible {
  background: #222b36;
  color: #ffc24d;
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 178, 36, 0.35);
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
  border-bottom: 1px solid #222b36;
  flex-shrink: 0;
}
.vera5-workspace-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #f5f7fa;
  text-decoration: none;
}
.vera5-workspace-title-mark {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}
.vera5-workspace-title-5 {
  color: #ffb224;
  text-shadow: 0 0 26px rgba(255, 178, 36, 0.22);
}
.vera5-workspace-title:hover,
.vera5-workspace-title:focus-visible {
  color: #f5f7fa;
  text-decoration: none;
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 178, 36, 0.45);
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
  border: 1px solid #313a45;
  background: #222b36;
  color: #a7b0ba;
  cursor: pointer;
}
.vera5-workspace-top,
.vera5-workspace-bottom {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  scrollbar-color: #313a45 #12171e;
  scrollbar-width: thin;
}
.vera5-workspace-top::-webkit-scrollbar,
.vera5-workspace-bottom::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.vera5-workspace-top::-webkit-scrollbar-track,
.vera5-workspace-bottom::-webkit-scrollbar-track {
  background: #12171e;
}
.vera5-workspace-top::-webkit-scrollbar-thumb,
.vera5-workspace-bottom::-webkit-scrollbar-thumb {
  background: #313a45;
  border-radius: 999px;
  border: 2px solid #12171e;
}
.vera5-workspace-top::-webkit-scrollbar-button,
.vera5-workspace-bottom::-webkit-scrollbar-button {
  background: #313a45;
}
.vera5-workspace-divider {
  flex-shrink: 0;
  height: 4px;
  background: #313a45;
  border: 0;
  margin: 0;
}
.vera5-workspace-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #a7b0ba;
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
  border: 1px solid #313a45;
  background: #222b36;
  color: #a7b0ba;
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
  background: #222b36;
  border: 1px solid #313a45;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.vera5-workspace-toggle-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #a7b0ba;
  transition: transform 0.15s ease, background 0.15s ease;
}
.vera5-workspace-toggle--on {
  border-color: #313a45;
  background: #222b36;
  color: #a7b0ba;
}
.vera5-workspace-toggle--on .vera5-workspace-toggle-switch {
  background: #ffb224;
  border-color: #ffb224;
}
.vera5-workspace-toggle--on .vera5-workspace-toggle-knob {
  transform: translateX(14px);
  background: #0b0e11;
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
  border: 1px solid transparent;
  background: #ffb224;
  color: #0b0e11;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.vera5-workspace-button:hover:not(:disabled) {
  background: #ffc24d;
  border-color: #ffc24d;
}
.vera5-workspace-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  border-color: #313a45;
  background: #222b36;
  color: #a7b0ba;
}
.vera5-workspace-tray-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 14px 0 8px;
  padding-top: 12px;
  border-top: 1px solid #313a45;
}
.vera5-workspace-tray-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #a7b0ba;
}
.vera5-workspace-icon-button {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #313a45;
  background: #222b36;
  color: #a7b0ba;
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
  border: 1px solid #313a45;
  background: #222b36;
  color: #a7b0ba;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.vera5-hover-card-detail-clear:hover {
  background: #222b36;
  color: #ffc24d;
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
  color: #a7b0ba;
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
  border: 1px solid #313a45;
  background: #222b36;
  color: #a7b0ba;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vera5-workspace-filter-chip[aria-pressed="true"] {
  border-color: #ffb224;
  background: #ffb224;
  color: #0b0e11;
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
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #313a45;
  background: #19202a;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}
.vera5-workspace-tray-row-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.vera5-workspace-tray-row--bulk-selected {
  border-color: color-mix(in srgb, #ffb224 45%, #313a45);
}
.vera5-workspace-tray-row--pinned {
  border-color: color-mix(in srgb, var(--vera5-accent) 35%, #313a45);
}
.vera5-workspace-tray-pin {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--vera5-accent-text);
  font-size: 12px;
  line-height: 1;
}
.vera5-workspace-tray-select {
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
}
.vera5-workspace-tray-bulk-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.vera5-workspace-tray-queue-status {
  margin: 8px 0 0;
  font-size: 12px;
  color: #a7b0ba;
  line-height: 1.5;
}
.vera5-tray-enrich-queue-warning-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.72);
}
.vera5-tray-enrich-queue-warning-panel {
  width: min(420px, 100%);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #313a45;
  background: #12171e;
  color: #f5f7fa;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.45);
}
.vera5-tray-enrich-queue-warning-heading {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
}
.vera5-tray-enrich-queue-warning-message {
  margin: 0 0 12px;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.5;
  color: #a7b0ba;
}
.vera5-tray-enrich-queue-warning-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.vera5-workspace-tray-row[aria-selected="true"] {
  border-color: #ffb224;
  background: color-mix(in srgb, #ffb224 12%, #19202a);
}
.vera5-workspace-tray-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: #222b36;
  color: #a7b0ba;
  font-size: 10px;
  font-weight: 700;
}
.vera5-workspace-tray-value {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: #f5f7fa;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vera5-workspace-tray-value-on-page {
  display: block;
  word-break: break-all;
  color: #f5f7fa;
}
.vera5-workspace-tray-refanged-value {
  display: block;
  word-break: break-all;
  font-size: 11px;
  line-height: 1.45;
  color: #a7b0ba;
}
.vera5-workspace-tray-hint {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #222b36;
  color: #a7b0ba;
  pointer-events: none;
  user-select: none;
}
.vera5-workspace-tray-hint--live {
  color: #22c7a9;
}
.vera5-workspace-tray-hint--error {
  color: #ff4d5a;
}
.vera5-workspace-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #ff4d5a;
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
  --vera5-surface: #12171e;
  --vera5-text: #f5f7fa;
  --vera5-border: #313a45;
  --vera5-accent: #ffb224;
  --vera5-accent-text: #f5f7fa;
  --vera5-muted: #a7b0ba;
  --vera5-muted-label: #a7b0ba;
  --vera5-error: #ff4d5a;
  --vera5-ready: #f5f7fa;
  --vera5-button-bg: #19202a;
  --vera5-copy-success-bg: color-mix(in srgb, #22c7a9 16%, #12171e);
  --vera5-shadow: none;
}
.vera5-command-palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
  background: rgba(15, 23, 42, 0.45);
}
.vera5-command-palette-panel {
  box-sizing: border-box;
  width: min(560px, 100%);
  max-height: min(70vh, 520px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #313a45;
  background: #12171e;
  color: #f5f7fa;
  font-family: system-ui, sans-serif;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
.vera5-command-palette-input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #313a45;
  border-radius: 8px;
  background: #19202a;
  color: #f5f7fa;
  font: 14px/1.4 system-ui, sans-serif;
}
.vera5-command-palette-input:focus-visible {
  outline: 2px solid #ffb224;
  outline-offset: 1px;
}
.vera5-command-palette-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  max-height: min(48vh, 360px);
}
.vera5-command-palette-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.vera5-command-palette-item:hover,
.vera5-command-palette-item--selected {
  border-color: #313a45;
  background: #19202a;
}
.vera5-command-palette-item-label {
  font-size: 14px;
  font-weight: 600;
  color: #f5f7fa;
}
.vera5-command-palette-item-description {
  font-size: 12px;
  color: #a7b0ba;
}
.vera5-command-palette-empty,
.vera5-command-palette-hint {
  margin: 0;
  font-size: 12px;
  color: #6b7480;
}
@media (prefers-color-scheme: dark) {
  .vera5-command-palette-panel {
    border-color: #313a45;
    background: #19202a;
    color: #f5f7fa;
    box-shadow: none;
  }
  .vera5-command-palette-input {
    border-color: #313a45;
    background: #12171e;
    color: #f5f7fa;
  }
  .vera5-command-palette-item:hover,
  .vera5-command-palette-item--selected {
    border-color: #313a45;
    background: #12171e;
  }
  .vera5-command-palette-item-label {
    color: #a7b0ba;
  }
  .vera5-command-palette-item-description,
  .vera5-command-palette-empty,
  .vera5-command-palette-hint {
    color: #a7b0ba;
  }
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
