import { useEffect, useState } from "react";
import type { IocType } from "../lib/iocRegex";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildDisabledSourcePlaceholders,
  resolveEnrichmentDisplay,
  type EnrichmentSourceId,
  type HoverCardEnrichmentState,
} from "../lib/hoverCardEnrichment";
import { scheduleCopyFeedbackReset } from "../lib/motionPreference";
import { getPivotLinks } from "../lib/pivots";
import {
  buildEnrichmentSummaryClassName,
  ensureVera5UiStyles,
} from "../lib/vera5UiStyles";

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
  enrichmentState?: HoverCardEnrichmentState;
  errorMessage?: string;
  disabledSources?: readonly EnrichmentSourceId[];
};

export function formatHoverCardTypeLabel(type: IocType): string {
  return TYPE_LABELS[type];
}

export function HoverCard({
  value,
  type,
  summary,
  enrichmentState,
  errorMessage,
  disabledSources = [],
}: HoverCardProps) {
  const typeLabel = formatHoverCardTypeLabel(type);
  const [copied, setCopied] = useState(false);
  const pivotLinks = getPivotLinks(type, value);
  const enrichment = resolveEnrichmentDisplay({
    enrichmentState,
    summary,
    errorMessage,
  });
  const disabledSourcePlaceholders = buildDisabledSourcePlaceholders(
    disabledSources
  );
  const showFooter = pivotLinks.length > 0 || disabledSourcePlaceholders.length > 0;

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
        style={{ marginBottom: showFooter ? 8 : 0 }}
      >
        {enrichment.text}
      </p>
      {disabledSourcePlaceholders.length > 0 ? (
        <section
          className="vera5-hover-card-sources"
          aria-label="Enrichment sources"
          style={{ marginBottom: pivotLinks.length > 0 ? 8 : 0 }}
        >
          <p className="vera5-hover-card-sources-heading">Sources</p>
          <ul className="vera5-hover-card-sources-list">
            {disabledSourcePlaceholders.map((entry) => (
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
    </aside>
  );
}
