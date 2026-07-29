import type { HoverCardEnrichmentState } from "./hoverCardEnrichment";
import {
  buildVera5ContentFontFaceCss,
  buildVera5ContentUiTokenDeclarations,
} from "./theme";

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

const VERA5_CONTENT_UI_TOKEN_ROOTS = [
  ".vera5-hover-card-panel",
  ".vera5-workspace-host",
  ".vera5-workspace-detail-panel",
  ".vera5-command-palette-panel",
  ".vera5-quiet-mode-banner",
  ".vera5-ioc-highlight",
].join(",\n");

export function buildVera5UiStylesCss(): string {
  return `
${buildVera5ContentFontFaceCss()}
${VERA5_CONTENT_UI_TOKEN_ROOTS} {
  ${buildVera5ContentUiTokenDeclarations()}
}
.vera5-hover-card-panel {
  box-sizing: border-box;
  min-width: 240px;
  max-width: 340px;
  max-height: min(78vh, 640px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px 16px;
  border-radius: var(--vera5-radius-md);
  border: 1px solid var(--vera5-border);
  background-color: var(--vera5-surface);
  color: var(--vera5-text);
  font-family: var(--vera5-font-ui);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--vera5-shadow);
  pointer-events: auto;
  animation: vera5-panel-reveal 0.2s var(--vera5-ease-out);
}
@keyframes vera5-panel-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
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
.vera5-hover-card-identity {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 0 0 10px;
  padding: 0 12px 12px;
  border-radius: 10px 4px 10px 4px;
  border: 0;
  background:
    radial-gradient(
      130px 84px at 16% 0%,
      color-mix(in srgb, var(--vera5-accent) 15%, transparent),
      transparent 72%
    ),
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--vera5-surface-raised, var(--vera5-button-bg)) 92%, transparent),
      color-mix(in srgb, var(--vera5-button-bg) 72%, var(--vera5-surface)) 66%
    ),
    var(--vera5-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    inset 0 -8px 20px rgba(0, 0, 0, 0.12),
    0 9px 24px rgba(0, 0, 0, 0.28);
}
.vera5-hover-card-identity::before {
  display: none;
}
.vera5-hover-card-identity::after {
  content: "";
  position: absolute;
  z-index: -1;
  top: 34px;
  right: -12px;
  width: 92px;
  height: 62px;
  opacity: 0.14;
  background-image: radial-gradient(
    circle,
    var(--vera5-accent) 0 1px,
    transparent 1.25px
  );
  background-size: 8px 8px;
  transform: skewX(-12deg);
  pointer-events: none;
}
.vera5-hover-card-lens-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 0 -12px 10px;
  padding: 8px 12px;
  background:
    linear-gradient(
      90deg,
      rgba(34, 43, 54, 0.42),
      rgba(48, 58, 70, 0.92) 24%,
      rgba(48, 58, 70, 0.92) 76%,
      rgba(34, 43, 54, 0.42)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 20px rgba(0, 0, 0, 0.16);
}
.vera5-hover-card-lens-brand {
  font-family: var(--vera5-font-wordmark, var(--vera5-font-ui));
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.11em;
  color: var(--vera5-accent);
}
.vera5-hover-card-lens-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--vera5-text);
}
.vera5-hover-card-lens-label::before {
  content: "|";
  color: var(--vera5-muted-label);
  font-weight: 500;
}
.vera5-hover-card-identity .vera5-hover-card-header {
  position: relative;
  z-index: 1;
  margin-bottom: 8px;
}
.vera5-hover-card-identity .vera5-hover-card-value,
.vera5-hover-card-identity .vera5-hover-card-value-on-page,
.vera5-hover-card-identity .vera5-hover-card-refanged-value {
  position: relative;
  z-index: 1;
  margin-bottom: 0;
}
.vera5-hover-card-identity .vera5-hover-card-action {
  margin-top: 10px;
}
.vera5-hover-card-type {
  display: inline-grid;
  gap: 1px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vera5-accent);
}
.vera5-hover-card-type::before {
  content: "Indicator type";
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-noise-rule-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--vera5-radius-sm);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
  background: color-mix(in srgb, var(--vera5-muted-label) 16%, transparent);
}
.vera5-hover-card-known-good-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--vera5-radius-sm);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--vera5-muted-label);
  background: color-mix(in srgb, var(--vera5-muted-label) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--vera5-border) 70%, transparent);
}
.vera5-hover-card-known-good-match {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--vera5-border) 80%, transparent);
  background: color-mix(in srgb, var(--vera5-surface-raised, var(--vera5-page)) 88%, transparent);
}
.vera5-hover-card-known-good-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--vera5-text);
  word-break: break-word;
}
.vera5-hover-card-known-good-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-known-good-id {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
  word-break: break-all;
}
.vera5-hover-card-noise-rule-match {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--vera5-border) 80%, transparent);
  background: color-mix(in srgb, var(--vera5-surface-raised, var(--vera5-page)) 88%, transparent);
}
.vera5-hover-card-noise-rule-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--vera5-text);
  word-break: break-word;
}
.vera5-hover-card-noise-rule-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-value {
  margin: 0 0 10px;
  font-family: var(--vera5-font-mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-all;
  color: var(--vera5-text);
}
.vera5-hover-card-value-on-page {
  margin: 0 0 4px;
  font-family: var(--vera5-font-mono);
  font-size: 13px;
  font-weight: 700;
  word-break: break-all;
  color: var(--vera5-text);
}
.vera5-hover-card-refanged-value {
  margin: 0 0 10px;
  font-family: var(--vera5-font-mono);
  font-size: 11px;
  line-height: 1.45;
  word-break: break-all;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-enrichment {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
.vera5-hover-card-enrichment--empty,
.vera5-hover-card-enrichment--loading {
  color: var(--vera5-muted);
  font-weight: 600;
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
@keyframes vera5-enrich-settle {
  from {
    opacity: 0.55;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.vera5-hover-card-enrichment--error {
  color: var(--vera5-error);
}
.vera5-hover-card-enrichment--ready {
  color: var(--vera5-text);
  animation: vera5-enrich-settle 0.28s var(--vera5-ease-out);
}
.vera5-hover-card-local-llm-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--vera5-border);
}
.vera5-hover-card-local-llm-summary-heading {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--vera5-text);
}
.vera5-hover-card-local-llm-summary-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.vera5-hover-card-local-llm-summary-status {
  margin: 8px 0 0;
  font-size: 12px;
}
.vera5-hover-card-local-llm-summary-status--loading {
  color: var(--vera5-muted);
  font-style: italic;
  animation: vera5-loading-pulse 1.4s ease-in-out infinite;
}
.vera5-hover-card-local-llm-summary-status--error {
  color: var(--vera5-error);
}
.vera5-hover-card-local-llm-summary-disclaimer {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-local-llm-summary-body {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  color: var(--vera5-text);
}
.vera5-hover-card-risk-score {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--vera5-border) 75%, transparent);
}
.vera5-hover-card-risk-score-label {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vera5-text);
}
.vera5-hover-card-risk-score-label strong {
  color: var(--vera5-accent);
  font-weight: 800;
}
.vera5-hover-card-risk-score-unavailable {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
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
.vera5-hover-card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  font-size: 11px;
  font-weight: 700;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--vera5-accent) 40%, var(--vera5-border));
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.02) 45%,
      rgba(0, 0, 0, 0.14) 100%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--vera5-accent) 28%, var(--vera5-button-bg)),
      var(--vera5-button-bg)
    );
  color: var(--vera5-text);
  cursor: pointer;
  transition: filter 0.15s ease, border-color 0.15s ease;
}
.vera5-hover-card-action:hover,
.vera5-hover-card-action:focus-visible {
  filter: brightness(1.08);
  border-color: var(--vera5-accent);
  outline: none;
}
.vera5-live-url-warning-backdrop {
  position: fixed;
  z-index: 2147483647;
  inset: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 18px;
  background:
    radial-gradient(
      circle at center,
      rgba(255, 178, 36, 0.08),
      transparent 42%
    ),
    rgba(3, 5, 7, 0.84);
  backdrop-filter: blur(5px);
}
.vera5-live-url-warning {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  width: min(540px, 100%);
  padding: 0 24px 24px;
  border: 0;
  border-radius: 14px 6px 14px 6px;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--vera5-surface-raised, #222b36) 94%, #111),
      var(--vera5-surface, #12171e) 66%
    );
  box-shadow:
    inset 0 18px 40px -34px rgba(255, 77, 90, 0.8),
    0 28px 80px rgba(0, 0, 0, 0.66);
  color: var(--vera5-text, #f5f7fa);
  font-family: var(--vera5-font-ui);
}
.vera5-live-url-warning::after {
  content: "";
  position: absolute;
  top: 52px;
  right: -18px;
  width: 132px;
  height: 86px;
  opacity: 0.11;
  background-image: radial-gradient(
    circle,
    var(--vera5-danger, #ff4d5a) 0 1px,
    transparent 1.25px
  );
  background-size: 9px 9px;
  transform: skewX(-12deg);
  pointer-events: none;
}
.vera5-live-url-warning-signal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -24px 14px;
  padding: 12px 18px 12px 24px;
  background: rgba(5, 7, 10, 0.58);
}
.vera5-live-url-warning-brand {
  font-family: var(--vera5-font-wordmark, var(--vera5-font-ui));
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--vera5-accent, #ffb224);
}
.vera5-live-url-warning-risk {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vera5-danger, #ff4d5a);
}
.vera5-live-url-warning-title {
  position: relative;
  z-index: 1;
  margin: 0 0 10px;
  font-size: 24px;
  line-height: 1.25;
  text-align: center;
  color: var(--vera5-text, #f5f7fa);
}
.vera5-live-url-warning-message {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.55;
  text-align: center;
  color: var(--vera5-muted-label, #a7b0ba);
}
.vera5-live-url-warning-destination-label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vera5-accent, #ffb224);
}
.vera5-live-url-warning-destination {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-height: 96px;
  overflow: auto;
  padding: 12px 14px;
  border-radius: 8px;
  background: #293541;
  color: #f5f7fa;
  font-family: var(--vera5-font-mono);
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.vera5-live-url-warning-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr);
  gap: 12px;
  margin-top: 20px;
}
.vera5-live-url-warning-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid color-mix(in srgb, var(--vera5-accent) 62%, transparent);
  border-radius: 8px;
  font: 700 13px/1.2 var(--vera5-font-ui);
  cursor: pointer;
  color: var(--vera5-on-accent, #0b0e11);
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.05) 42%,
      rgba(0, 0, 0, 0.14) 100%
    ),
    linear-gradient(
      135deg,
      var(--vera5-accent-strong, #ffc24d),
      var(--vera5-accent, #ffb224)
    );
  background-color: var(--vera5-accent, #ffb224);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12),
    0 3px 0 color-mix(in srgb, var(--vera5-accent, #ffb224) 55%, #8a5a00),
    0 6px 16px rgba(255, 178, 36, 0.22);
  transition: filter 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease,
    transform 0.12s ease;
}
.vera5-live-url-warning-cancel {
  /* Shares yellow glass treatment with confirm; slightly quieter depth. */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    0 2px 0 color-mix(in srgb, var(--vera5-accent, #ffb224) 50%, #8a5a00),
    0 4px 12px rgba(255, 178, 36, 0.16);
}
.vera5-live-url-warning-confirm {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    inset 0 -1px 0 rgba(0, 0, 0, 0.14),
    0 4px 0 color-mix(in srgb, var(--vera5-accent, #ffb224) 48%, #7a4f00),
    0 8px 20px rgba(255, 178, 36, 0.3);
}
.vera5-live-url-warning-button:hover,
.vera5-live-url-warning-button:focus-visible {
  filter: brightness(1.06);
  border-color: var(--vera5-accent-strong, #ffc24d);
  outline: 2px solid var(--vera5-accent, #ffb224);
  outline-offset: 2px;
}
.vera5-live-url-warning-button:active {
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.16),
    0 1px 0 color-mix(in srgb, var(--vera5-accent, #ffb224) 45%, #8a5a00),
    0 3px 10px rgba(255, 178, 36, 0.18);
}
.vera5-hover-card-retry-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-copy {
  font-size: 11px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--vera5-accent) 62%, transparent);
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.04) 45%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    linear-gradient(
      135deg,
      var(--vera5-accent-strong, #ffc24d),
      var(--vera5-accent)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 3px 9px rgba(255, 178, 36, 0.16);
  color: var(--vera5-on-accent, #0b0e11);
  cursor: pointer;
  transition: filter 0.15s ease, border-color 0.15s ease;
}
.vera5-hover-card-copy:hover,
.vera5-hover-card-copy:focus-visible {
  filter: brightness(1.06);
  border-color: var(--vera5-accent-strong, #ffc24d);
  outline: none;
}
.vera5-hover-card-copy--copied {
  background-image: none;
  background-color: var(--vera5-copy-success-bg);
  color: var(--vera5-text);
}
.vera5-hover-card-pivots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vera5-hover-card-pivot-recipes {
  margin: 10px 0 8px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--vera5-border) 80%, transparent);
}
.vera5-hover-card-pivot-recipes .vera5-hover-card-section-heading {
  margin: 0 0 6px;
  color: var(--vera5-accent);
}
.vera5-hover-card-section-hint {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-pivot-recipes-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vera5-hover-card-pivot-recipe {
  display: block;
  margin: 0;
}
.vera5-hover-card-pivot-recipe-source,
.vera5-hover-card-pivot-recipe-guidance {
  display: none;
}
.vera5-hover-card-pivot-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  min-height: 28px;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--vera5-accent) 55%, transparent);
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.04) 42%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    linear-gradient(135deg, var(--vera5-accent-strong, #ffc24d), var(--vera5-accent));
  background-color: var(--vera5-accent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 2px 8px rgba(255, 178, 36, 0.18);
  color: var(--vera5-on-accent, #0b0e11);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: filter 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.vera5-hover-card-pivot-link:hover,
.vera5-hover-card-pivot-link:focus-visible {
  filter: brightness(1.06);
  border-color: var(--vera5-accent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    0 3px 10px rgba(255, 178, 36, 0.28);
  outline: none;
}
.vera5-hover-card-more-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--vera5-border);
}
.vera5-hover-card-more {
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--vera5-border-hard, var(--vera5-border)) 90%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--vera5-surface-raised, var(--vera5-button-bg)) 72%, transparent);
}
.vera5-hover-card-more > summary.vera5-hover-card-more-summary {
  list-style: none;
  cursor: pointer;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-text);
  user-select: none;
}
.vera5-hover-card-more > summary.vera5-hover-card-more-summary::-webkit-details-marker {
  display: none;
}
.vera5-hover-card-more > summary.vera5-hover-card-more-summary::before {
  content: "+";
  display: inline-block;
  width: 1em;
  margin-right: 6px;
  color: var(--vera5-accent);
  font-weight: 700;
}
.vera5-hover-card-more[open] > summary.vera5-hover-card-more-summary::before {
  content: "−";
}
.vera5-hover-card-more[open] > summary.vera5-hover-card-more-summary {
  border-bottom: 1px solid var(--vera5-border);
  color: var(--vera5-accent);
  background: color-mix(in srgb, var(--vera5-accent) 8%, transparent);
}
.vera5-hover-card-more > :not(summary) {
  padding: 8px;
}
.vera5-hover-card-casework-details {
  border: 0;
  background:
    radial-gradient(
      74px 42px at 100% 0%,
      color-mix(in srgb, var(--vera5-accent) 9%, transparent),
      transparent 76%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--vera5-accent) 6%, transparent),
      color-mix(in srgb, var(--vera5-button-bg) 84%, transparent)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 5px 14px rgba(0, 0, 0, 0.15);
}
.vera5-hover-card-casework-details > summary.vera5-hover-card-more-summary {
  color: var(--vera5-text);
}
.vera5-hover-card-casework-details[open] > summary.vera5-hover-card-more-summary {
  color: var(--vera5-accent);
}
.vera5-hover-card-casework-details > section {
  margin: 0;
  border: 0;
  background: transparent;
}
.vera5-hover-card-sources {
  margin-bottom: 0;
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
  margin: 10px 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: left;
  color: var(--vera5-muted-label);
  line-height: 1.3;
}
.vera5-hover-card-intel-summary {
  position: relative;
  overflow: hidden;
  margin: 0 0 12px;
  padding: 12px 12px 10px;
  border-radius: 8px;
  border: 0;
  background:
    radial-gradient(
      130px 86px at 92% 4%,
      color-mix(in srgb, var(--vera5-accent) 14%, transparent),
      transparent 72%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--vera5-accent) 10%, transparent),
      color-mix(in srgb, var(--vera5-button-bg) 82%, transparent) 48%
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 -18px 36px -32px rgba(255, 178, 36, 0.5),
    0 10px 26px rgba(0, 0, 0, 0.24);
}
.vera5-hover-card-intel-summary > .vera5-hover-card-section-heading {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--vera5-accent);
}
.vera5-hover-card-intel-summary > .vera5-hover-card-enrichment {
  margin-bottom: 0;
}
.vera5-hover-card-sources-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vera5-hover-card-source-item {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--vera5-muted-label);
  line-height: 1.4;
  padding: 8px 10px;
  border-radius: 6px;
  border: 0;
  background:
    radial-gradient(
      70px 40px at 100% 0%,
      color-mix(in srgb, var(--vera5-accent) 8%, transparent),
      transparent 76%
    ),
    color-mix(in srgb, var(--vera5-button-bg) 80%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.035),
    0 5px 14px rgba(0, 0, 0, 0.14);
}
.vera5-hover-card-source-item:last-child {
  margin-bottom: 0;
}
.vera5-hover-card-source-badge {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 3px 8px;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--vera5-text);
}
.vera5-hover-card-source-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 0;
  order: 3;
}
.vera5-hover-card-source-item > .vera5-hover-card-source-badge {
  order: 0;
}
.vera5-hover-card-source-item > .vera5-hover-card-source-detail {
  order: 1;
}
.vera5-hover-card-source-item > .vera5-hover-card-source-tags,
.vera5-hover-card-source-item > .vera5-hover-card-source-last-updated,
.vera5-hover-card-source-item > .vera5-hover-card-retry-hint,
.vera5-hover-card-source-item > .vera5-hover-card-raw-json {
  order: 4;
}
.vera5-hover-card-source-metadata-chip {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid color-mix(in srgb, var(--vera5-border) 80%, transparent);
  color: var(--vera5-text-low, var(--vera5-muted-label));
  background-color: transparent;
  white-space: nowrap;
  opacity: 0.9;
}
.vera5-hover-card-source-metadata-chip--reliability {
  color: #8eb4ff;
  border-color: color-mix(in srgb, #8eb4ff 35%, var(--vera5-border));
}
.vera5-hover-card-source-metadata-chip--freshness {
  color: #c9b46a;
  border-color: color-mix(in srgb, #c9b46a 35%, var(--vera5-border));
}
.vera5-hover-card-source-metadata-chip--sourceClass {
  color: #9fd4b0;
  border-color: color-mix(in srgb, #9fd4b0 35%, var(--vera5-border));
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
  font-family: var(--vera5-font-mono);
  font-size: 10px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vera5-text);
}
.vera5-why-detected {
  margin-top: 0;
}
.vera5-why-detected-row {
  display: grid;
  grid-template-columns: 7.5em 1fr;
  gap: 6px;
  align-items: start;
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vera5-muted-label);
}
.vera5-why-detected-label {
  font-weight: 700;
  color: var(--vera5-text);
}
.vera5-why-detected-value {
  color: var(--vera5-muted-label);
  word-break: break-word;
}
.vera5-why-detected-context {
  word-break: break-word;
}
.vera5-why-detected-overlaps-heading {
  margin: 4px 0 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--vera5-text);
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
  color: var(--vera5-muted-label);
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
  color: var(--vera5-muted-label);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 0;
}
.vera5-workspace-tray-row .vera5-tray-save-collection-toggle,
.vera5-workspace-tray-row .vera5-tray-why-detected summary,
.vera5-workspace-tray-row .vera5-tray-co-occurrence summary,
.vera5-workspace-tray-row .vera5-tray-relationship summary {
  opacity: 0.55;
  transition: opacity 0.14s ease;
}
.vera5-workspace-tray-row:hover .vera5-tray-save-collection-toggle,
.vera5-workspace-tray-row:focus-within .vera5-tray-save-collection-toggle,
.vera5-workspace-tray-row[aria-selected="true"] .vera5-tray-save-collection-toggle,
.vera5-workspace-tray-row:hover .vera5-tray-why-detected summary,
.vera5-workspace-tray-row:focus-within .vera5-tray-why-detected summary,
.vera5-workspace-tray-row[aria-selected="true"] .vera5-tray-why-detected summary,
.vera5-workspace-tray-row:hover .vera5-tray-co-occurrence summary,
.vera5-workspace-tray-row:focus-within .vera5-tray-co-occurrence summary,
.vera5-workspace-tray-row[aria-selected="true"] .vera5-tray-co-occurrence summary,
.vera5-workspace-tray-row:hover .vera5-tray-relationship summary,
.vera5-workspace-tray-row:focus-within .vera5-tray-relationship summary,
.vera5-workspace-tray-row[aria-selected="true"] .vera5-tray-relationship summary {
  opacity: 1;
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
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #526274;
  background-color: #2b3744;
  color: #f5f7fa;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}
.vera5-hover-card-analyst-notes-input::placeholder {
  color: #b6c0ca;
  opacity: 1;
}
.vera5-hover-card-analyst-notes-input:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-ioc-label {
  margin: 0 0 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--vera5-border) 85%, transparent);
}
.vera5-hover-card-ioc-label-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-text);
}
.vera5-hover-card-ioc-label-select {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #526274;
  background-color: #2b3744;
  color: #f5f7fa;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
}
.vera5-hover-card-ioc-label-select:focus {
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 35%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-export-notes-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 8px 8px;
}
.vera5-hover-card-export-investigation {
  width: 100%;
  margin-bottom: 6px;
}
.vera5-hover-card-export-investigation > .vera5-hover-card-export-investigation-body {
  display: flex;
  flex-direction: column;
  padding: 4px 8px 6px;
}
.vera5-hover-card-export-notes-pin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 8px;
  padding: 0 0 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--vera5-border) 78%, transparent);
}
.vera5-hover-card-export-notes-pin-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-text);
}
.vera5-hover-card-export-notes-pin-row .vera5-hover-card-ioc-pin {
  min-width: 64px;
}
.vera5-hover-card-export-investigation-body > .vera5-hover-card-casework-details {
  width: 100%;
  margin-top: 8px;
}
.vera5-hover-card-export-notes-body > .vera5-hover-card-casework-details {
  width: 100%;
  margin-top: 8px;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-templates > .vera5-hover-card-export-notes-body {
  padding-top: 4px;
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
.vera5-hover-card-co-occurrence {
  margin-top: 8px;
}
.vera5-hover-card-co-occurrence-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-co-occurrence-context {
  margin: 0 0 4px;
  color: #8f98a3;
  font-size: 11px;
  line-height: 1.4;
}
.vera5-hover-card-co-occurrence-feedback {
  margin: 0 0 4px;
  color: #f0b429;
  font-size: 11px;
  line-height: 1.4;
}
.vera5-hover-card-co-occurrence-list {
  margin: 0;
  padding-left: 16px;
  color: #a7b0ba;
  font-size: 12px;
  line-height: 1.5;
}
.vera5-hover-card-co-occurrence-item {
  margin: 0;
}
.vera5-hover-card-co-occurrence-item-button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.vera5-hover-card-co-occurrence-item-button:hover,
.vera5-hover-card-co-occurrence-item-button:focus-visible {
  text-decoration: underline;
  outline: none;
}
.vera5-hover-card-relationship {
  margin-top: 8px;
}
.vera5-hover-card-relationship-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-muted-label);
}
.vera5-hover-card-relationship-list {
  margin: 0;
  padding-left: 16px;
  color: #a7b0ba;
  font-size: 12px;
  line-height: 1.5;
  list-style: disc;
}
.vera5-hover-card-relationship-item {
  margin: 0;
}
.vera5-hover-card-relationship-disclaimer {
  margin: 8px 0 0;
  color: var(--vera5-muted-label);
  font-size: 11px;
  line-height: 1.4;
}
.vera5-hover-card-notebook {
  margin-top: 0;
}
.vera5-hover-card-notebook-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vera5-accent);
}
.vera5-hover-card-notebook-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 8px;
}
.vera5-hover-card-notebook-tab {
  margin: 0;
  padding: 4px 8px;
  border: 1px solid var(--vera5-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--vera5-button-bg) 80%, transparent);
  color: var(--vera5-muted-label);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vera5-hover-card-notebook-tab--active,
.vera5-hover-card-notebook-tab:focus-visible {
  border-color: var(--vera5-accent);
  color: var(--vera5-on-accent, #0b0e11);
  background-image: linear-gradient(
    135deg,
    var(--vera5-accent-strong, #ffc24d),
    var(--vera5-accent)
  );
  outline: none;
}
.vera5-hover-card-notebook-empty {
  margin: 0;
  color: #8f98a3;
  font-size: 12px;
  line-height: 1.4;
}
.vera5-hover-card-notebook-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.vera5-hover-card-notebook-item {
  margin: 0 0 6px;
  padding: 6px 8px;
  border: 1px solid #2f3945;
  border-radius: 4px;
}
.vera5-hover-card-notebook-item-type {
  display: inline-block;
  margin: 0 6px 2px 0;
  font-size: 11px;
  font-weight: 600;
  color: #c5ced8;
}
.vera5-hover-card-notebook-item-badge {
  display: inline-block;
  margin: 0 0 2px;
  padding: 0 5px;
  border-radius: 3px;
  background: #3a3420;
  color: #e6c35c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.vera5-hover-card-notebook-item-body {
  margin: 2px 0 0;
  color: #a7b0ba;
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}
.vera5-hover-card-notebook-item-body .vera5-notebook-md-paragraph {
  margin: 0 0 4px;
  white-space: pre-wrap;
}
.vera5-hover-card-notebook-item-body .vera5-notebook-md-paragraph:last-child {
  margin-bottom: 0;
}
.vera5-hover-card-notebook-item-body .vera5-notebook-md-ul,
.vera5-hover-card-notebook-item-body .vera5-notebook-md-ol {
  margin: 0 0 4px;
  padding-left: 1.25em;
}
.vera5-hover-card-notebook-item-body .vera5-notebook-md-codeblock {
  margin: 0 0 4px;
  padding: 4px 6px;
  border-radius: 3px;
  background: #141a22;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  white-space: pre;
}
.vera5-hover-card-notebook-item-body code {
  padding: 0 3px;
  border-radius: 3px;
  background: #141a22;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.vera5-hover-card-notebook-item-body strong {
  color: #e8eef5;
  font-weight: 700;
}
.vera5-hover-card-notebook-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.vera5-hover-card-notebook-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #c5ced8;
  font-size: 11px;
}
.vera5-hover-card-notebook-select,
.vera5-hover-card-notebook-textarea {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #526274;
  border-radius: 6px;
  background: #2b3744;
  color: #f5f7fa;
  font: inherit;
  font-size: 12px;
}
.vera5-hover-card-notebook-textarea::placeholder {
  color: #b6c0ca;
  opacity: 1;
}
.vera5-hover-card-notebook-select:focus,
.vera5-hover-card-notebook-textarea:focus {
  border-color: var(--vera5-accent);
  outline: 2px solid color-mix(in srgb, var(--vera5-accent) 24%, transparent);
  outline-offset: 1px;
}
.vera5-hover-card-notebook-textarea {
  resize: vertical;
  min-height: 96px;
}
.vera5-hover-card-notebook-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.vera5-hover-card-notebook-action {
  margin: 0;
  padding: 2px 8px;
  border: 1px solid #3a4553;
  border-radius: 4px;
  background: transparent;
  color: #c5ced8;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.vera5-hover-card-notebook-action:hover,
.vera5-hover-card-notebook-action:focus-visible {
  border-color: #6b7c90;
  color: #e8eef5;
  outline: none;
}
.vera5-hover-card-notebook-action:disabled {
  opacity: 0.55;
  cursor: default;
}
.vera5-hover-card-notebook-action--primary {
  width: 100%;
  min-height: 32px;
  padding: 6px 12px;
  border-color: color-mix(in srgb, var(--vera5-accent) 65%, transparent);
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.04) 45%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    linear-gradient(
      135deg,
      var(--vera5-accent-strong, #ffc24d),
      var(--vera5-accent)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 3px 10px rgba(255, 178, 36, 0.2);
  color: var(--vera5-on-accent, #0b0e11);
  font-weight: 800;
}
.vera5-hover-card-notebook-action--primary:hover,
.vera5-hover-card-notebook-action--primary:focus-visible {
  border-color: var(--vera5-accent-strong, #ffc24d);
  color: var(--vera5-on-accent, #0b0e11);
  filter: brightness(1.06);
}
.vera5-hover-card-notebook-feedback {
  margin: 6px 0 0;
  color: #8f98a3;
  font-size: 11px;
  line-height: 1.4;
}
.vera5-tray-co-occurrence-item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.vera5-tray-co-occurrence-item:hover,
.vera5-tray-co-occurrence-item:focus-visible {
  text-decoration: underline;
  outline: none;
}
.vera5-tray-relationship-list {
  margin: 0;
  padding-left: 16px;
  color: inherit;
  font-size: 12px;
  line-height: 1.5;
}
.vera5-tray-relationship-item {
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
  margin-top: 6px;
}
.vera5-hover-card-export-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-actions {
  justify-content: center;
}
.vera5-hover-card-export-footer .vera5-hover-card-scan-export-template-row {
  justify-content: center;
  margin-top: 0;
  width: 100%;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-templates {
  width: 100%;
  margin: 0;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-templates > :not(summary) {
  padding: 0;
}
.vera5-hover-card-export-footer .vera5-hover-card-export-templates > .vera5-hover-card-export-notes-body {
  padding: 4px 8px 8px;
}
.vera5-hover-card-export-notes-body .vera5-hover-card-scan-export-template-row {
  margin-top: 0;
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
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin-top: 8px;
}
.vera5-hover-card-scan-export-template-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--vera5-text);
}
.vera5-hover-card-scan-export-template-select {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #526274;
  background-color: #2b3744;
  color: var(--vera5-accent-text);
  font-size: 11px;
  font-family: inherit;
}
.vera5-hover-card-scan-export-template-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vera5-hover-card-scan-export-template-actions .vera5-hover-card-export-button {
  flex: 1 1 120px;
  border-color: rgba(255, 194, 77, 0.5);
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.16) 0%,
      rgba(255, 255, 255, 0.03) 45%,
      rgba(0, 0, 0, 0.1) 100%
    ),
    linear-gradient(
      135deg,
      rgba(255, 194, 77, 0.68),
      rgba(255, 178, 36, 0.58)
    );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  color: var(--vera5-on-accent, #0b0e11);
  font-weight: 700;
}
.vera5-hover-card-scan-export-template-actions .vera5-hover-card-export-button:hover,
.vera5-hover-card-scan-export-template-actions .vera5-hover-card-export-button:focus-visible {
  border-color: rgba(255, 194, 77, 0.8);
  filter: brightness(1.06);
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
.vera5-hover-card-intel-export-actions {
  width: 100%;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--vera5-accent) 18%, var(--vera5-border));
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.vera5-hover-card-intel-export-actions .vera5-hover-card-export-dropdown,
.vera5-hover-card-intel-export-actions .vera5-hover-card-export-button {
  width: 100%;
}
.vera5-hover-card-intel-export-actions .vera5-hover-card-export-button {
  min-height: 30px;
  border-color: color-mix(in srgb, var(--vera5-accent) 45%, var(--vera5-border));
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.01)
    ),
    color-mix(in srgb, var(--vera5-accent) 14%, var(--vera5-button-bg));
  color: var(--vera5-text);
  font-weight: 700;
}
.vera5-hover-card-intel-export-status {
  width: 100%;
  margin-bottom: 0;
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
  .vera5-hover-card-enrichment--ready,
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
  background: var(--vera5-surface);
  color: var(--vera5-text);
  border: 1px solid var(--vera5-border);
  border-radius: var(--vera5-radius-lg);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
  font-family: var(--vera5-font-ui);
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
  color: #ffb224;
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
.vera5-workspace-sidebar--collapsed .vera5-workspace-header {
  justify-content: center;
  padding-left: 8px;
  padding-right: 8px;
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
  border: 1px solid #313a45;
  background: #19202a;
  color: #f5f7fa;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease,
    box-shadow 0.14s ease;
}
.vera5-workspace-button:hover:not(:disabled) {
  background: #222b36;
  border-color: rgba(255, 178, 36, 0.38);
}
.vera5-workspace-button--primary {
  border-color: transparent;
  background: #ffb224;
  color: #0b0e11;
}
.vera5-workspace-button--primary:hover:not(:disabled) {
  background: #ffc24d;
  border-color: #ffc24d;
}
.vera5-workspace-sidebar button:hover:not(:disabled),
.vera5-workspace-sidebar .vera5-hover-card-pivot-link:hover {
  box-shadow: 0 0 0 1.5px rgba(255, 178, 36, 0.45), 0 4px 16px rgba(255, 178, 36, 0.18);
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
  font-size: 15px;
  font-weight: 600;
  color: #f5f7fa;
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
  border: 1px solid transparent;
  background: #19202a;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.14s ease;
}
.vera5-workspace-tray-row:hover {
  background: #222b36;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
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
  --vera5-shadow: none;
}
.vera5-quiet-mode-banner-host {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483644;
  pointer-events: none;
}
.vera5-quiet-mode-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  background: #6b5a2e;
  color: var(--vera5-text);
  font-family: var(--vera5-font-ui);
  font-size: 12px;
  line-height: 1.4;
  box-shadow: var(--vera5-shadow-low);
  pointer-events: auto;
}
.vera5-quiet-mode-banner__label {
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 11px;
}
.vera5-quiet-mode-banner__message {
  color: #f5f7fa;
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
  border-radius: var(--vera5-radius-md);
  border: 1px solid var(--vera5-border);
  background: var(--vera5-surface);
  color: var(--vera5-text);
  font-family: var(--vera5-font-ui);
  box-shadow: var(--vera5-shadow);
}
.vera5-command-palette-input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--vera5-border);
  border-radius: var(--vera5-radius-sm);
  background: var(--vera5-button-bg);
  color: var(--vera5-text);
  font: 14px/1.4 var(--vera5-font-ui);
}
.vera5-command-palette-input:focus-visible {
  outline: 2px solid var(--vera5-accent);
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
