import { useEffect, useState } from "react";
import type { IgnoredOverlapMatch, IocRuleId, IocType } from "../lib/iocRegex";
import {
  getSessionAnalystNote,
  primeAnalystNoteForIoc,
  setSessionAnalystNote,
} from "../lib/analystNotesSession";
import {
  getSessionIocLabel,
  primeIocLabelForIoc,
  setSessionIocLabel,
} from "../lib/iocLabelSession";
import { IOC_LABEL_IDS, formatIocLabelDisplay, type IocLabelId } from "../lib/iocLabel";
import {
  buildNoiseRuleHoverMatchView,
  buildNoiseRulesOptionsHash,
  confirmLearnNoiseRule,
  findMatchingNoiseRule,
  shouldOfferNoiseRuleLearnForLabel,
  type NoiseRuleHoverMatchView,
} from "../lib/noiseRule";
import { listStoredNoiseRules } from "../lib/noiseRuleStorage";
import {
  buildKnownGoodMatchBadgeView,
  buildKnownGoodOptionsHash,
  findMatchingKnownGoodEntry,
  KNOWN_GOOD_ENRICH_SKIPPED_LABEL,
  KNOWN_GOOD_MATCH_SECTION_ARIA_LABEL,
  type KnownGoodMatchBadgeView,
} from "../lib/knownGood";
import { listStoredKnownGoodEntriesForMatching } from "../lib/knownGoodStorage";
import { safeOpenOptionsPageWithHash } from "../lib/extensionContext";
import { ENRICHMENT_ERROR_CODE } from "../lib/enrichment";
import {
  getActiveInvestigationSession,
  toggleActiveInvestigationSessionIocPin,
} from "../lib/investigationSessionStorage";
import { isInvestigationSessionIocPinned } from "../lib/investigationSession";
import { copyTextToClipboard } from "../lib/copyText";
import {
  buildSourceStatusBadgeClassName,
  buildSourceMetadataChipClassName,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_ANALYST_NOTES_INPUT_ID,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_ANALYST_NOTES_PLACEHOLDER,
  HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL,
  HOVER_CARD_IOC_LABEL_LABEL,
  HOVER_CARD_IOC_LABEL_NONE_VALUE,
  HOVER_CARD_IOC_LABEL_SECTION_ARIA_LABEL,
  HOVER_CARD_IOC_LABEL_SELECT_ID,
  HOVER_CARD_IOC_PIN_ARIA_LABEL,
  HOVER_CARD_IOC_PIN_LABEL,
  HOVER_CARD_IOC_PINNED_LABEL,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_RAW_JSON_SUMMARY_LABEL,
  HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP,
  HOVER_CARD_WHY_DETECTED_SECTION_ARIA_LABEL,
  HOVER_CARD_ON_PAGE_VALUE_LABEL,
  HOVER_CARD_REFANGED_VALUE_LABEL,
  HOVER_CARD_COPY_COPIED_LABEL,
  HOVER_CARD_OPEN_LIVE_URL_LABEL,
  HOVER_CARD_OPEN_LIVE_URL_CONFIRM_MESSAGE,
  buildWhyDetectedView,
  openLiveUrlInNewTab,
  resolveEffectiveSourceAttribution,
  resolveHoverCardDisplayView,
  resolveHoverCardDisclaimerAriaLabel,
  resolveIndicatorCopyActions,
  resolveIndicatorValuePresentation,
  shouldOfferLiveUrlOpen,
  type EnrichmentSourceAttribution,
  type EnrichmentSourceId,
  type HoverCardDisclaimerInput,
  type HoverCardEnrichmentState,
  type HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import {
  formatSaveToCollectionFeedback,
  IOC_COLLECTION_CREATE_NEW_LABEL,
  IOC_COLLECTION_NEW_NAME_PLACEHOLDER,
  IOC_COLLECTION_NO_COLLECTIONS_TEXT,
  IOC_COLLECTION_PICKER_HEADING,
  IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL,
  IOC_COLLECTION_SAVE_TO_NEW_LABEL,
  normalizeIocCollectionName,
  type IocCollection,
} from "../lib/iocCollection";
import {
  requestAddIocToCollection,
  requestCreateIocCollection,
  requestListIocCollections,
} from "../lib/iocCollectionClient";
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
  email: "Email address",
  asn: "ASN",
  cidr: "IPv4 CIDR",
  filepath: "File path",
  onion: "Onion domain",
};

export type HoverCardProps = {
  value: string;
  type: IocType;
  displayValue?: string;
  ruleId?: IocRuleId;
  sourceTextHint?: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
  summary?: string;
  tags?: readonly string[];
  sourceAttribution?: EnrichmentSourceAttribution;
  enrichmentState?: HoverCardEnrichmentState;
  errorMessage?: string;
  errorCode?: string;
  retryHint?: string;
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
  analystNotes?: string;
  iocLabel?: IocLabelId;
};

export function formatHoverCardTypeLabel(type: IocType): string {
  return TYPE_LABELS[type];
}

function HoverCardSaveToCollectionSection({
  iocType,
  value,
}: {
  iocType: IocType;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<IocCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void requestListIocCollections().then((list) => {
      if (!cancelled) {
        setCollections(list);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const member = { iocType, value };

  const handleAddToExisting = async (collection: IocCollection) => {
    const result = await requestAddIocToCollection({
      collectionId: collection.id,
      member,
    });
    if (!result) {
      setFeedback("Could not save to collection.");
      return;
    }
    setFeedback(
      formatSaveToCollectionFeedback({
        collectionName: result.collection.name,
        added: result.added,
      })
    );
  };

  const handleCreateAndAdd = async () => {
    const created = await requestCreateIocCollection({ name: newName });
    if (!created) {
      setFeedback("Could not create collection.");
      return;
    }

    const result = await requestAddIocToCollection({
      collectionId: created.id,
      member,
    });
    if (!result) {
      setFeedback("Collection created, but indicator was not saved.");
      return;
    }

    setCollections((previous) => [
      result.collection,
      ...previous.filter((collection) => collection.id !== result.collection.id),
    ]);
    setNewName("");
    setFeedback(
      formatSaveToCollectionFeedback({
        collectionName: result.collection.name,
        added: result.added,
      })
    );
  };

  const canCreate = normalizeIocCollectionName(newName) !== null;

  return (
    <section
      className="vera5-hover-card-save-collection"
      aria-label={IOC_COLLECTION_PICKER_HEADING}
      style={{ marginBottom: 8 }}
    >
      <button
        type="button"
        className="vera5-hover-card-save-collection-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => {
            if (current) {
              setFeedback(null);
            }
            return !current;
          });
        }}
      >
        {IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL}
      </button>
      {open ? (
        <div
          className="vera5-hover-card-save-collection-panel"
          role="group"
          aria-label={IOC_COLLECTION_PICKER_HEADING}
        >
          <p className="vera5-hover-card-save-collection-heading">
            {IOC_COLLECTION_PICKER_HEADING}
          </p>
          {loading ? (
            <p style={{ margin: "0 0 8px", fontSize: 12 }}>Loading collections…</p>
          ) : collections.length === 0 ? (
            <p style={{ margin: "0 0 8px", fontSize: 12 }}>
              {IOC_COLLECTION_NO_COLLECTIONS_TEXT}
            </p>
          ) : (
            <div className="vera5-hover-card-save-collection-list">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  className="vera5-hover-card-action"
                  onClick={() => void handleAddToExisting(collection)}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          )}
          <label className="vera5-hover-card-save-collection-field">
            {IOC_COLLECTION_CREATE_NEW_LABEL}
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
              aria-label={IOC_COLLECTION_NEW_NAME_PLACEHOLDER}
            />
          </label>
          <button
            type="button"
            className="vera5-hover-card-action"
            disabled={!canCreate}
            onClick={() => void handleCreateAndAdd()}
          >
            {IOC_COLLECTION_SAVE_TO_NEW_LABEL}
          </button>
          {feedback ? (
            <p
              className="vera5-hover-card-save-collection-feedback"
              aria-live="polite"
            >
              {feedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function HoverCard({
  value,
  type,
  displayValue,
  ruleId,
  sourceTextHint,
  ignoredOverlaps,
  summary,
  tags = [],
  sourceAttribution,
  enrichmentState,
  errorMessage,
  errorCode,
  retryHint,
  disabledSources = [],
  sourceResults = [],
  analystNotes,
  iocLabel,
}: HoverCardProps) {
  const typeLabel = formatHoverCardTypeLabel(type);
  const valuePresentation = resolveIndicatorValuePresentation({ value, displayValue });
  const copyActions = resolveIndicatorCopyActions(valuePresentation);
  const whyDetectedView = buildWhyDetectedView({
    type,
    ruleId,
    sourceTextHint,
    ignoredOverlaps,
  });
  const [copiedCopyValue, setCopiedCopyValue] = useState<string | null>(null);
  const [note, setNote] = useState(() =>
    analystNotes ?? getSessionAnalystNote(value)
  );
  const [label, setLabel] = useState<IocLabelId | null>(() =>
    iocLabel ?? getSessionIocLabel(value)
  );
  const [pinned, setPinned] = useState(false);
  const [noiseRuleMatch, setNoiseRuleMatch] = useState<NoiseRuleHoverMatchView | null>(
    null
  );
  const [knownGoodMatch, setKnownGoodMatch] = useState<KnownGoodMatchBadgeView | null>(
    null
  );
  const [liveUrlConfirmOpen, setLiveUrlConfirmOpen] = useState(false);
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

  useEffect(() => {
    setNote(analystNotes ?? getSessionAnalystNote(value));
    primeAnalystNoteForIoc(value, (storedNote) => {
      setNote((current) => (current.length > 0 ? current : storedNote));
    });
  }, [analystNotes, value]);

  useEffect(() => {
    setLabel(iocLabel ?? getSessionIocLabel(value));
    primeIocLabelForIoc(value, (storedLabel) => {
      setLabel((current) => (current ? current : storedLabel));
    });
  }, [iocLabel, value]);

  useEffect(() => {
    setLiveUrlConfirmOpen(false);
  }, [value]);

  useEffect(() => {
    void getActiveInvestigationSession().then((session) => {
      setPinned(session ? isInvestigationSessionIocPinned(session, value) : false);
    });
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    setNoiseRuleMatch(null);
    setKnownGoodMatch(null);
    void listStoredNoiseRules()
      .then((rules) => {
        if (cancelled) {
          return;
        }
        const matched = findMatchingNoiseRule(rules, value);
        setNoiseRuleMatch(matched ? buildNoiseRuleHoverMatchView(matched) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setNoiseRuleMatch(null);
        }
      });
    void listStoredKnownGoodEntriesForMatching()
      .then((entries) => {
        if (cancelled) {
          return;
        }
        const matched = findMatchingKnownGoodEntry(entries, value);
        setKnownGoodMatch(matched ? buildKnownGoodMatchBadgeView(matched) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setKnownGoodMatch(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleCopy = (copyValue: string) => {
    void copyTextToClipboard(copyValue).then((success) => {
      if (!success) {
        return;
      }
      setCopiedCopyValue(copyValue);
      scheduleCopyFeedbackReset(() => {
        setCopiedCopyValue(null);
      });
    });
  };

  const handleOpenLiveUrl = () => {
    setLiveUrlConfirmOpen(true);
  };

  const handleConfirmOpenLiveUrl = () => {
    setLiveUrlConfirmOpen(false);
    openLiveUrlInNewTab(value, window);
  };

  const handleNoteChange = (nextNote: string) => {
    setNote(nextNote);
    setSessionAnalystNote(value, nextNote);
  };

  const handleLabelChange = (nextValue: string) => {
    const nextLabel =
      nextValue === HOVER_CARD_IOC_LABEL_NONE_VALUE
        ? null
        : (nextValue as IocLabelId);
    const learnNoiseRule =
      shouldOfferNoiseRuleLearnForLabel(nextLabel) && confirmLearnNoiseRule(window);
    setLabel(nextLabel);
    setSessionIocLabel(value, nextLabel, { learnNoiseRule });
  };

  const handlePinToggle = () => {
    void toggleActiveInvestigationSessionIocPin({
      iocValue: value,
      iocType: type,
    }).then((session) => {
      setPinned(session ? isInvestigationSessionIocPinned(session, value) : false);
    });
  };

  return (
    <aside
      className="vera5-hover-card-panel"
      role="region"
      aria-label={`Indicator details for ${value}`}
      data-vera5-rule-id={ruleId}
      data-vera5-source-text-hint={sourceTextHint}
    >
      {liveUrlConfirmOpen ? (
        <div
          className="vera5-live-url-warning-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setLiveUrlConfirmOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setLiveUrlConfirmOpen(false);
            }
          }}
        >
          <section
            className="vera5-live-url-warning"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="vera5-react-live-url-warning-title"
            aria-describedby="vera5-react-live-url-warning-message"
          >
            <div className="vera5-live-url-warning-signal">
              <span className="vera5-live-url-warning-brand">
                VERA5 // NAVIGATION GATE
              </span>
              <span className="vera5-live-url-warning-risk">
                High-risk redirect
              </span>
            </div>
            <h2
              id="vera5-react-live-url-warning-title"
              className="vera5-live-url-warning-title"
            >
              Open live indicator?
            </h2>
            <p
              id="vera5-react-live-url-warning-message"
              className="vera5-live-url-warning-message"
            >
              {HOVER_CARD_OPEN_LIVE_URL_CONFIRM_MESSAGE}
            </p>
            <p className="vera5-live-url-warning-destination-label">
              Destination
            </p>
            <code className="vera5-live-url-warning-destination">{value}</code>
            <div className="vera5-live-url-warning-actions">
              <button
                type="button"
                className="vera5-live-url-warning-button vera5-live-url-warning-cancel"
                onClick={() => setLiveUrlConfirmOpen(false)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="vera5-live-url-warning-button vera5-live-url-warning-confirm"
                onClick={handleConfirmOpenLiveUrl}
              >
                Yes, open live URL
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="vera5-hover-card-header">
        <span className="vera5-hover-card-type">{typeLabel}</span>
        {knownGoodMatch ? (
          <span
            className="vera5-hover-card-known-good-badge"
            data-vera5-known-good-badge="true"
            data-vera5-known-good-entry-id={knownGoodMatch.entryId}
          >
            {knownGoodMatch.badgeLabel}
          </span>
        ) : null}
        {noiseRuleMatch ? (
          <span
            className="vera5-hover-card-noise-rule-badge"
            data-vera5-noise-deprioritized-badge="true"
          >
            {noiseRuleMatch.badgeLabel}
          </span>
        ) : null}
        <button
          type="button"
          className={
            pinned
              ? "vera5-hover-card-ioc-pin vera5-hover-card-ioc-pin--pinned"
              : "vera5-hover-card-ioc-pin"
          }
          aria-pressed={pinned}
          aria-label={HOVER_CARD_IOC_PIN_ARIA_LABEL}
          onClick={handlePinToggle}
        >
          {pinned ? HOVER_CARD_IOC_PINNED_LABEL : HOVER_CARD_IOC_PIN_LABEL}
        </button>
        {copyActions.map((action) => {
          const copied = copiedCopyValue === action.copyValue;
          return (
            <button
              key={action.label}
              type="button"
              className={
                copied
                  ? "vera5-hover-card-copy vera5-hover-card-copy--copied"
                  : "vera5-hover-card-copy"
              }
              onClick={() => {
                handleCopy(action.copyValue);
              }}
              aria-label={action.ariaLabel}
            >
              {copied ? HOVER_CARD_COPY_COPIED_LABEL : action.label}
            </button>
          );
        })}
      </div>
      {knownGoodMatch ? (
        <section
          className="vera5-hover-card-known-good-match"
          aria-label={KNOWN_GOOD_MATCH_SECTION_ARIA_LABEL}
          data-vera5-known-good-entry-id={knownGoodMatch.entryId}
          data-vera5-known-good-category={knownGoodMatch.category}
          data-vera5-known-good-match-type={knownGoodMatch.matchType}
          data-vera5-known-good-pattern={knownGoodMatch.pattern}
          style={{ marginBottom: 8 }}
        >
          <p className="vera5-hover-card-known-good-summary">
            {knownGoodMatch.entrySummary}
          </p>
          <p className="vera5-hover-card-known-good-hint">{knownGoodMatch.hint}</p>
          <p className="vera5-hover-card-known-good-id">
            Entry id: {knownGoodMatch.entryId}
          </p>
          {errorCode === ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY ||
          sourceResults.some(
            (entry) => entry.errorCode === ENRICHMENT_ERROR_CODE.KNOWN_GOOD_POLICY
          ) ? (
            <p
              className="vera5-hover-card-known-good-enrich-skipped"
              data-vera5-known-good-enrich-skipped="true"
              role="status"
            >
              {KNOWN_GOOD_ENRICH_SKIPPED_LABEL}
            </p>
          ) : null}
          <button
            type="button"
            className="vera5-hover-card-action"
            data-vera5-known-good-entry-link="true"
            aria-label={knownGoodMatch.viewEntryAriaLabel}
            onClick={() => {
              safeOpenOptionsPageWithHash(
                buildKnownGoodOptionsHash(knownGoodMatch.entryId)
              );
            }}
          >
            {knownGoodMatch.viewEntryLabel}
          </button>
        </section>
      ) : null}
      {noiseRuleMatch ? (
        <section
          className="vera5-hover-card-noise-rule-match"
          aria-label="Matched noise rule"
          data-vera5-noise-rule-id={noiseRuleMatch.ruleId}
          style={{ marginBottom: 8 }}
        >
          <p className="vera5-hover-card-noise-rule-summary">{noiseRuleMatch.ruleSummary}</p>
          <p className="vera5-hover-card-noise-rule-hint">{noiseRuleMatch.hint}</p>
          <button
            type="button"
            className="vera5-hover-card-action"
            data-vera5-noise-rule-link="true"
            aria-label={noiseRuleMatch.viewRuleAriaLabel}
            onClick={() => {
              safeOpenOptionsPageWithHash(buildNoiseRulesOptionsHash(noiseRuleMatch.ruleId));
            }}
          >
            {noiseRuleMatch.viewRuleLabel}
          </button>
        </section>
      ) : null}
      {valuePresentation.showRefangedPair ? (
        <>
          <p className="vera5-hover-card-value-on-page">
            {HOVER_CARD_ON_PAGE_VALUE_LABEL} {valuePresentation.onPageValue}
          </p>
          <p className="vera5-hover-card-refanged-value">
            {HOVER_CARD_REFANGED_VALUE_LABEL} {valuePresentation.refangedValue}
          </p>
        </>
      ) : (
        <p className="vera5-hover-card-value">{valuePresentation.refangedValue}</p>
      )}
      {shouldOfferLiveUrlOpen(type) ? (
        <button
          type="button"
          className="vera5-hover-card-action"
          aria-label={HOVER_CARD_OPEN_LIVE_URL_LABEL}
          onClick={handleOpenLiveUrl}
          style={{ marginBottom: 8 }}
        >
          {HOVER_CARD_OPEN_LIVE_URL_LABEL}
        </button>
      ) : null}
      {whyDetectedView ? (
        <section
          className="vera5-why-detected"
          aria-label={HOVER_CARD_WHY_DETECTED_SECTION_ARIA_LABEL}
          style={{ marginBottom: 8 }}
        >
          <p className="vera5-hover-card-section-heading">Why detected?</p>
          <p className="vera5-why-detected-row">Type: {whyDetectedView.typeLabel}</p>
          <p className="vera5-why-detected-row">Reason: {whyDetectedView.reason}</p>
          <p className="vera5-why-detected-row vera5-why-detected-context">
            Source context: {whyDetectedView.sourceTextHint}
          </p>
          {whyDetectedView.ignoredOverlaps.length > 0 ? (
            <>
              <p className="vera5-why-detected-overlaps-heading">Ignored overlaps:</p>
              <ul className="vera5-why-detected-list">
                {whyDetectedView.ignoredOverlaps.map((overlap) => (
                  <li
                    key={`${overlap.typeLabel}-${overlap.value}`}
                    className="vera5-why-detected-item"
                  >
                    {overlap.typeLabel} {overlap.value} — {overlap.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="vera5-why-detected-row">Ignored overlaps: none</p>
          )}
        </section>
      ) : null}
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
                {(entry.metadataChips?.length ?? 0) > 0 ? (
                  <div
                    className="vera5-hover-card-source-metadata"
                    role="list"
                    aria-label="Source metadata"
                    title={HOVER_CARD_SOURCE_METADATA_INFORMATIONAL_TOOLTIP}
                  >
                    {entry.metadataChips!.map((chip) => (
                      <span
                        key={`${entry.sourceId}-${chip.kind}`}
                        className={buildSourceMetadataChipClassName(chip.kind)}
                        role="listitem"
                        title={chip.tooltip}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : null}
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
      <HoverCardSaveToCollectionSection iocType={type} value={value} />
      <section
        className="vera5-hover-card-ioc-label"
        aria-label={HOVER_CARD_IOC_LABEL_SECTION_ARIA_LABEL}
        style={{ marginBottom: view.showFooter ? 8 : 0 }}
      >
        <label
          className="vera5-hover-card-ioc-label-label"
          htmlFor={HOVER_CARD_IOC_LABEL_SELECT_ID}
        >
          {HOVER_CARD_IOC_LABEL_LABEL}
        </label>
        <select
          id={HOVER_CARD_IOC_LABEL_SELECT_ID}
          className="vera5-hover-card-ioc-label-select"
          value={label ?? HOVER_CARD_IOC_LABEL_NONE_VALUE}
          aria-label={HOVER_CARD_IOC_LABEL_LABEL}
          onChange={(event) => {
            handleLabelChange(event.target.value);
          }}
        >
          <option value={HOVER_CARD_IOC_LABEL_NONE_VALUE}>None</option>
          {IOC_LABEL_IDS.map((labelId) => (
            <option key={labelId} value={labelId}>
              {formatIocLabelDisplay(labelId)}
            </option>
          ))}
        </select>
      </section>
      <section
        className="vera5-hover-card-analyst-notes"
        aria-label={HOVER_CARD_ANALYST_NOTES_SECTION_ARIA_LABEL}
        style={{ marginBottom: view.showFooter ? 8 : 0 }}
      >
        <label
          className="vera5-hover-card-analyst-notes-label"
          htmlFor={HOVER_CARD_ANALYST_NOTES_INPUT_ID}
        >
          {HOVER_CARD_ANALYST_NOTES_LABEL}
        </label>
        <textarea
          id={HOVER_CARD_ANALYST_NOTES_INPUT_ID}
          className="vera5-hover-card-analyst-notes-input"
          placeholder={HOVER_CARD_ANALYST_NOTES_PLACEHOLDER}
          rows={3}
          value={note}
          aria-label={HOVER_CARD_ANALYST_NOTES_LABEL}
          onChange={(event) => {
            handleNoteChange(event.target.value);
          }}
        />
      </section>
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
