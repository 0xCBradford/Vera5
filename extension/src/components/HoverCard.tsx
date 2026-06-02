import { useEffect, useState } from "react";
import type { IocType } from "../lib/iocRegex";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildSourceStatusBadgeClassName,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_RAW_JSON_SUMMARY_LABEL,
  resolveEffectiveSourceAttribution,
  resolveHoverCardDisplayView,
  resolveHoverCardDisclaimerAriaLabel,
  type EnrichmentSourceAttribution,
  type EnrichmentSourceId,
  type HoverCardDisclaimerInput,
  type HoverCardEnrichmentState,
  type HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import { scheduleCopyFeedbackReset } from "../lib/motionPreference";
import { getPivotLinks } from "../lib/pivots";
import {
  buildEnrichmentSummaryClassName,
  ensureVera5UiStyles,
} from "../lib/vera5UiStyles";
import { RiskScore } from "./RiskScore";

export {
  DEFAULT_HOVER_CARD_SUMMARY,
} from "../lib/hoverCardEnrichment";

const TYPE_LABELS: Record<IocType, string> = {
  ipv4: "IPv4 address",
  domain: "Domain",
  url: "URL",
  md5: "MD5 hash",
  sha1: "SHA1 hash",
  sha256: "SHA256 hash",
  cve: "CVE ID",
};

export type HoverCardProps = {
  value: string;
  type: IocType;
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  enrichmentState?: HoverCardEnrichmentState;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
};

export function formatHoverCardTypeLabel(type: IocType): string {
  return TYPE_LABELS[type];
}

export function HoverCard({
  value,
  type,
  summary,
  tags = [],
  sourceAttribution,
  enrichmentState,
  errorMessage,
  errorCode,
  retryHint,
  disabledSources = [],
  sourceResults = [],
}: HoverCardProps) {
  const typeLabel = formatHoverCardTypeLabel(type);
  const [copied, setCopied] = useState(false);
  const pivotLinks = getPivotLinks(type, value);
  const view = resolveHoverCardDisplayView({
    enrichmentState,
    summary,
    tags,
    sourceAttribution,
    errorMessage,
    errorCode,
    retryHint,
    disabledSources,
    sourceResults,
    pivotLinkCount: pivotLinks.length,
  });
  const enrichment = view.enrichment;
  const effectiveSourceAttribution = resolveEffectiveSourceAttribution(
    sourceAttribution,
    sourceResults
  );
  const disclaimerInput: HoverCardDisclaimerInput = {
    enrichmentState: enrichment.variant,
    includeRiskScoreDisclaimer: view.includeRiskScoreDisclaimer,
  };

  useEffect(() => {
    ensureVera5UiStyles(document);
  }, []);

  const handleCopy = () => {
    void copyTextToClipboard(value).then((success) => {
      if (!success) {
        return;
      }
      setCopied(true);
      scheduleCopyFeedbackReset(() => {
        setCopied(false);
      });
    });
  };

  return (
    <aside
      className="vera5-hover-card-panel"
      role="region"
      aria-label={`Indicator details for ${value}`}
    >
      <div className="vera5-hover-card-header">
        <span className="vera5-hover-card-type">{typeLabel}</span>
        <button
          type="button"
          className={
            copied
              ? "vera5-hover-card-copy vera5-hover-card-copy--copied"
              : "vera5-hover-card-copy"
          }
          onClick={handleCopy}
          aria-label={`Copy indicator ${value}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="vera5-hover-card-value">{value}</p>
      <p
        className={buildEnrichmentSummaryClassName(enrichment.variant)}
        role={enrichment.variant === "error" ? "alert" : "status"}
        aria-live={enrichment.variant === "loading" ? "polite" : undefined}
        aria-busy={enrichment.variant === "loading" ? true : undefined}
        style={{ marginBottom: view.showBelowSummary ? 8 : 0 }}
      >
        {enrichment.text}
      </p>
      <RiskScore
        disabledSources={disabledSources}
        sourceResults={sourceResults}
      />
      {view.showMissingKeyAction ? (
        <button
          type="button"
          className="vera5-hover-card-action"
          aria-label="Open Vera5 Settings to add an API key"
          onClick={() => {
            void chrome.runtime.openOptionsPage();
          }}
          style={{ marginBottom: view.showBelowSummary ? 8 : 0 }}
        >
          {HOVER_CARD_OPEN_SETTINGS_LABEL}
        </button>
      ) : null}
      {view.showRateLimitRetryHint ? (
        <p
          className="vera5-hover-card-retry-hint"
          role="note"
          style={{ marginBottom: view.showBelowSummary ? 8 : 0 }}
        >
          {retryHint}
        </p>
      ) : null}
      {view.showSingleSourceRawJson && view.singleSourceRawJson ? (
        <details
          className="vera5-hover-card-raw-json"
          style={{ marginBottom: view.showFooter ? 8 : 0 }}
        >
          <summary>{HOVER_CARD_RAW_JSON_SUMMARY_LABEL}</summary>
          <pre className="vera5-hover-card-raw-json-body">{view.singleSourceRawJson}</pre>
        </details>
      ) : null}
      {view.singleSourceLastUpdatedLine ? (
        <p
          className="vera5-hover-card-source-last-updated"
          role="note"
          style={{ marginBottom: view.showFooter ? 8 : 0 }}
        >
          {view.singleSourceLastUpdatedLine}
        </p>
      ) : null}
      {view.showTags ? (
        <div
          className="vera5-hover-card-tags"
          role="list"
          aria-label="Threat intelligence tags"
          style={{ marginBottom: view.showFooter ? 8 : 0 }}
        >
          {view.enrichmentTags.map((tag) => (
            <span
              key={tag}
              className="vera5-hover-card-tag"
              role="listitem"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {view.showMultiSourceResults ? (
        <section
          className="vera5-hover-card-sources"
          aria-label="Enrichment source results"
          style={{ marginBottom: pivotLinks.length > 0 ? 8 : 0 }}
        >
          <p className="vera5-hover-card-sources-heading">Enrichment sources</p>
          <ul className="vera5-hover-card-sources-list">
            {sourceResults.map((entry) => (
              <li key={entry.sourceId} className="vera5-hover-card-source-item">
                <span
                  className={buildSourceStatusBadgeClassName(
                    entry.status,
                    entry.fromCache
                  )}
                >
                  {entry.label} · {entry.badgeText}
                </span>
                <span className="vera5-hover-card-source-detail">{entry.detail}</span>
                {entry.lastUpdatedLine ? (
                  <span
                    className="vera5-hover-card-source-last-updated"
                    role="note"
                  >
                    {entry.lastUpdatedLine}
                  </span>
                ) : null}
                {entry.retryHint ? (
                  <span className="vera5-hover-card-retry-hint" role="note">
                    {entry.retryHint}
                  </span>
                ) : null}
                {entry.rawVendorJson ? (
                  <details className="vera5-hover-card-raw-json">
                    <summary>{HOVER_CARD_RAW_JSON_SUMMARY_LABEL}</summary>
                    <pre className="vera5-hover-card-raw-json-body">
                      {entry.rawVendorJson}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.disabledSourcePlaceholders.length > 0 ? (
        <section
          className="vera5-hover-card-sources"
          aria-label="Enrichment sources"
          style={{ marginBottom: pivotLinks.length > 0 ? 8 : 0 }}
        >
          <p className="vera5-hover-card-sources-heading">Sources</p>
          <ul className="vera5-hover-card-sources-list">
            {view.disabledSourcePlaceholders.map((entry) => (
              <li key={entry.sourceId} className="vera5-hover-card-source-item">
                <span style={{ fontWeight: 600 }}>{entry.label}</span>
                {" — "}
                {entry.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pivotLinks.length > 0 ? (
        <nav
          className="vera5-hover-card-pivots"
          aria-label="Open indicator in external sources"
        >
          {pivotLinks.map((link) => (
            <a
              key={link.provider}
              className="vera5-hover-card-pivot-link"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
      {view.showAttribution && effectiveSourceAttribution ? (
        <p className="vera5-hover-card-attribution" role="note">
          {formatEnrichmentSourceAttribution(
            effectiveSourceAttribution,
            enrichment.variant
          )}
        </p>
      ) : null}
      {view.showDisclaimer ? (
        <footer
          className="vera5-hover-card-disclaimer"
          aria-label={resolveHoverCardDisclaimerAriaLabel(disclaimerInput)}
        >
          {view.disclaimerLines.map((line) => (
            <p key={line} role="note">
              {line}
            </p>
          ))}
        </footer>
      ) : null}
    </aside>
  );
}
