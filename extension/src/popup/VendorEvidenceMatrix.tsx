/**
 * Phase 10B — VERA5 Intel Feed vendor evidence matrix.
 * Presentation-only: uses Phase 7 selectors and existing display ordering.
 * Does not initiate enrichment, mutate results, or change scoring.
 * Phase 18D — ready-state bay supports optional action slot (no fake vendor rows).
 */

import type { ReactNode } from "react";
import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import {
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "../lib/enrichmentSourceRegistry";
import type { PivotLink } from "../lib/pivots";
import {
  WORKSPACE_STATE_COPY,
  resolveVendorCardPresentation,
  type WorkspaceEnrichmentPresentation,
} from "../lib/workspacePresentationState";
import { VendorMark } from "../lib/vendorAssets";
import {
  resolveIntelVendorCardStatus,
  resolveIntelVendorNumericScore,
  type IntelSourceAvailabilityRecord,
} from "./intelVendorOrdering";

export type VendorScoreBand = "red" | "orange" | "yellow" | "gold" | "zero";

export type VendorEvidenceRowModel = {
  sourceId: EnrichmentSourceId;
  displayName: string;
  description: string;
  status: ReturnType<typeof resolveIntelVendorCardStatus>;
  presentationKind: ReturnType<typeof resolveVendorCardPresentation>["kind"];
  sourceState: string;
  scoreBand: VendorScoreBand | undefined;
  scoreValue: number | null;
  riskLabel: "CRITICAL" | "HIGH" | "SUSPICIOUS" | "LOW" | null;
  resultLabel: string;
  resultAriaLabel: string;
  classificationText: string | null;
  evidenceText: string;
  evidenceProvenance: string | null;
  evidenceConclusion: string;
  fromCache: boolean;
  hasSourceEntry: boolean;
  sourceLoading: boolean;
  title: string;
  detailBody: string;
  lastUpdatedLine: string | null;
  errorCode: string | null;
  retryHint: string | null;
  metadataChips: HoverCardSourceEntry["metadataChips"];
  stateLabel: string;
};

function resolveScoreBand(scoreValue: number): VendorScoreBand {
  if (scoreValue >= 65) return "red";
  if (scoreValue >= 30) return "orange";
  if (scoreValue >= 15) return "yellow";
  if (scoreValue >= 1) return "gold";
  return "zero";
}

function resolveRiskLabel(scoreValue: number): "CRITICAL" | "HIGH" | "SUSPICIOUS" | "LOW" | null {
  if (scoreValue === 0) return null;
  if (scoreValue >= 65) return "CRITICAL";
  if (scoreValue >= 30) return "HIGH";
  if (scoreValue >= 15) return "SUSPICIOUS";
  return "LOW";
}

/** Builds one matrix row from normalized source + Phase 7 presentation. */
export function buildVendorEvidenceRowModel(input: {
  sourceId: EnrichmentSourceId;
  source: HoverCardSourceEntry | undefined;
  availability: IntelSourceAvailabilityRecord[EnrichmentSourceId];
  loading: boolean;
}): VendorEvidenceRowModel {
  const { sourceId, source, availability, loading } = input;
  const definition = getEnrichmentSourceDefinition(sourceId);
  const status = resolveIntelVendorCardStatus(sourceId, source, availability);
  const assessment = source?.assessment;
  const scoreValue = resolveIntelVendorNumericScore(source);
  const scoreBand = scoreValue === null ? undefined : resolveScoreBand(scoreValue);
  const riskLabel = scoreValue === null ? null : resolveRiskLabel(scoreValue);
  const sourceLoading = loading && !source;
  const okDetail =
    source?.status === "ok" ? (assessment?.verdict ?? source.detail ?? "") : "";
  const vendorPresentation = resolveVendorCardPresentation({
    source,
    loading,
    cardStatus: status,
    numericScore: scoreValue,
    okDetail,
  });
  const sourceState = scoreBand ?? vendorPresentation.sourceState;
  const stateLabel =
    riskLabel ??
    (vendorPresentation.stateLabel ||
      source?.badgeText ||
      WORKSPACE_STATE_COPY.source.unavailable);
  const signalText =
    vendorPresentation.kind === "scored"
      ? okDetail
      : vendorPresentation.signalText && vendorPresentation.signalText !== stateLabel
        ? vendorPresentation.signalText
        : "";

  const fromCache = source?.fromCache === true;
  let evidenceProvenance: string | null = null;
  let evidenceConclusion = signalText;
  let evidenceText = signalText;
  if (vendorPresentation.kind === "scored" && fromCache) {
    evidenceProvenance = "Cached";
    if (signalText) {
      evidenceText = `Cached · ${signalText}`;
      evidenceConclusion = signalText;
    } else if (source?.badgeText === "Cached") {
      evidenceText = "Cached";
      evidenceConclusion = "";
    } else {
      evidenceText = "Cached evidence";
      evidenceProvenance = null;
      evidenceConclusion = "";
    }
  }

  const resultLabel =
    scoreValue !== null ? `${scoreValue}/100` : stateLabel;
  const resultAriaLabel =
    scoreValue !== null
      ? `${scoreValue} out of 100`
      : stateLabel;

  const classificationText =
    riskLabel !== null
      ? `[${riskLabel}]`
      : fromCache && vendorPresentation.kind === "scored"
        ? "CACHED"
        : null;

  return {
    sourceId,
    displayName: definition.displayName,
    description: definition.description,
    status,
    presentationKind: vendorPresentation.kind,
    sourceState,
    scoreBand,
    scoreValue,
    riskLabel,
    resultLabel,
    resultAriaLabel,
    classificationText,
    evidenceText,
    evidenceProvenance,
    evidenceConclusion,
    fromCache,
    hasSourceEntry: Boolean(source),
    sourceLoading,
    title:
      vendorPresentation.kind === "pivot_only"
        ? WORKSPACE_STATE_COPY.source.pivotSupport
        : vendorPresentation.kind === "not_queried"
          ? WORKSPACE_STATE_COPY.enrichment.availableForEnrichment
          : (source?.detail ?? definition.description),
    detailBody: source?.detail ?? definition.description,
    lastUpdatedLine: source?.lastUpdatedLine ?? null,
    errorCode: source?.errorCode ?? null,
    retryHint: source?.retryHint ?? null,
    metadataChips: source?.metadataChips ?? [],
    stateLabel,
  };
}

function VendorEvidenceRow({
  model,
  detailsOpen,
  onToggleDetails,
  pivotLink,
  onOpenPivot,
}: {
  model: VendorEvidenceRowModel;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  pivotLink: PivotLink | undefined;
  onOpenPivot: (link: PivotLink) => void;
}) {
  const actionable =
    Boolean(pivotLink) &&
    model.status !== "disabled" &&
    model.status !== "not-configured";

  const activatePivot = () => {
    if (actionable && pivotLink) {
      onOpenPivot(pivotLink);
    }
  };

  return (
    <div
      role="row"
      className={
        actionable ? "vera5-evidence-row vera5-evidence-row--actionable" : "vera5-evidence-row"
      }
      data-vera5-source-id={model.sourceId}
      data-vera5-source-status={model.status}
      data-vera5-source-state={model.sourceState}
      data-vera5-presentation-kind={model.presentationKind}
      data-vera5-score-band={model.scoreBand}
      data-vera5-info-open={detailsOpen}
      data-vera5-actionable={actionable ? "true" : "false"}
      aria-busy={model.sourceLoading || undefined}
      title={model.title}
      aria-label={
        actionable
          ? `${model.displayName}, ${model.resultLabel}. Open vendor result for the selected indicator`
          : undefined
      }
      tabIndex={actionable ? 0 : undefined}
      onClick={actionable ? activatePivot : undefined}
      onKeyDown={
        actionable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activatePivot();
              }
            }
          : undefined
      }
    >
      <div className="vera5-evidence-rail" role="presentation" aria-hidden="true" />
      <div className="vera5-evidence-source" role="cell">
        <VendorMark sourceId={model.sourceId} size="sm" />
        <span className="vera5-evidence-source-name">{model.displayName}</span>
      </div>
      <div className="vera5-evidence-result" role="cell">
        {model.scoreValue !== null ? (
          <strong className="vera5-evidence-score" aria-label={model.resultAriaLabel}>
            {model.scoreValue}
            <span>/100</span>
          </strong>
        ) : (
          <strong className="vera5-evidence-state">{model.resultLabel}</strong>
        )}
      </div>
      <div className="vera5-evidence-classification" role="cell">
        {model.classificationText ? (
          <span
            className="vera5-risk-label"
            aria-label={
              model.riskLabel ? `Risk ${model.riskLabel}` : model.classificationText
            }
          >
            {model.classificationText}
          </span>
        ) : (
          <span className="vera5-evidence-classification-empty" aria-hidden="true">
            —
          </span>
        )}
      </div>
      <div className="vera5-evidence-detail" role="cell">
        {model.evidenceText ? (
          <p className="vera5-evidence-signal" title={model.evidenceText}>
            {model.evidenceProvenance && model.evidenceConclusion ? (
              <>
                <span className="vera5-evidence-signal-provenance">
                  {model.evidenceProvenance}
                </span>
                <span className="vera5-evidence-signal-sep" aria-hidden="true">
                  {" · "}
                </span>
                <span className="vera5-evidence-signal-conclusion">
                  {model.evidenceConclusion}
                </span>
              </>
            ) : model.evidenceProvenance && !model.evidenceConclusion ? (
              <span className="vera5-evidence-signal-provenance">
                {model.evidenceProvenance}
              </span>
            ) : (
              model.evidenceText
            )}
          </p>
        ) : (
          <p className="vera5-evidence-signal vera5-evidence-signal--empty" />
        )}
      </div>
      <div className="vera5-evidence-utility" role="cell">
        <button
          type="button"
          className="vera5-intel-info-button"
          aria-label={`Inspect ${model.displayName} evidence`}
          aria-expanded={detailsOpen}
          aria-controls={`vera5-intel-source-details-${model.sourceId}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleDetails();
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span className="vera5-info-badge-glyph" aria-hidden="true">
            i
          </span>
        </button>
        <div
          id={`vera5-intel-source-details-${model.sourceId}`}
          className="vera5-intel-info-surface vera5-intel-source-details"
          role="dialog"
          aria-label={`${model.displayName} details`}
          hidden={!detailsOpen}
          onClick={(event) => event.stopPropagation()}
        >
          <strong>{model.displayName}</strong>
          <p>{model.detailBody}</p>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{model.stateLabel}</dd>
            </div>
            {model.hasSourceEntry ? (
              <div>
                <dt>Response</dt>
                <dd>{model.fromCache ? "Cached" : "Live"}</dd>
              </div>
            ) : null}
            {model.lastUpdatedLine ? (
              <div>
                <dt>Updated</dt>
                <dd>{model.lastUpdatedLine.replace(/^Last updated:\s*/i, "")}</dd>
              </div>
            ) : null}
            {model.errorCode ? (
              <div>
                <dt>Error code</dt>
                <dd>{model.errorCode}</dd>
              </div>
            ) : null}
          </dl>
          {model.retryHint ? <p>{model.retryHint}</p> : null}
          {model.metadataChips.length ? (
            <ul>
              {model.metadataChips.map((chip) => (
                <li key={`${chip.kind}-${chip.label}`} title={chip.tooltip}>
                  {chip.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function VendorEvidenceMatrix({
  orderedSourceIds,
  sourceEntryById,
  availability,
  loading,
  enrichment: _enrichment,
  openInfoId,
  onOpenInfoIdChange,
  pivotBySourceId,
  onOpenPivot,
  emptyStateMessage,
  emptyStateSupport,
  emptyStateAction,
}: {
  orderedSourceIds: readonly EnrichmentSourceId[];
  sourceEntryById: ReadonlyMap<EnrichmentSourceId, HoverCardSourceEntry>;
  availability: IntelSourceAvailabilityRecord;
  loading: boolean;
  enrichment: WorkspaceEnrichmentPresentation;
  openInfoId: string | null;
  onOpenInfoIdChange: (id: string | null) => void;
  pivotBySourceId: ReadonlyMap<EnrichmentSourceId, PivotLink>;
  onOpenPivot: (link: PivotLink) => void;
  emptyStateMessage?: string;
  emptyStateSupport?: string;
  emptyStateAction?: ReactNode;
}) {
  void _enrichment;

  const rows = orderedSourceIds.map((sourceId) =>
    buildVendorEvidenceRowModel({
      sourceId,
      source: sourceEntryById.get(sourceId),
      availability: availability[sourceId],
      loading,
    })
  );

  return (
    <section className="vera5-evidence-matrix" aria-label="Vendor evidence">
      {orderedSourceIds.length === 0 ? (
        <div
          className="vera5-evidence-matrix-shell vera5-evidence-matrix-shell--empty vera5-intel-feed-sources"
          role="status"
        >
          <div className="vera5-evidence-matrix-empty">
            <p className="vera5-evidence-matrix-empty-primary">
              {emptyStateMessage ?? "No applicable enrichment sources are enabled."}
            </p>
            {emptyStateSupport ? (
              <p className="vera5-evidence-matrix-empty-support">{emptyStateSupport}</p>
            ) : null}
            {emptyStateAction ?? null}
          </div>
        </div>
      ) : (
      <div
        className="vera5-evidence-matrix-shell vera5-intel-feed-sources"
        role="table"
        aria-label="Vendor assessments"
      >
        <div className="vera5-evidence-matrix-head" role="row">
          <div className="vera5-evidence-rail" role="presentation" aria-hidden="true" />
          <div className="vera5-evidence-source" role="columnheader">
            Source
          </div>
          <div className="vera5-evidence-result" role="columnheader">
            Result
          </div>
          <div className="vera5-evidence-classification" role="columnheader">
            Classification
          </div>
          <div className="vera5-evidence-detail" role="columnheader">
            Evidence
          </div>
          <div className="vera5-evidence-utility" role="columnheader">
            <span className="vera5-evidence-sr-only">Details</span>
          </div>
        </div>
        {rows.map((model) => {
          const detailsOpen = openInfoId === model.sourceId;
          return (
            <VendorEvidenceRow
              key={model.sourceId}
              model={model}
              detailsOpen={detailsOpen}
              onToggleDetails={() =>
                onOpenInfoIdChange(detailsOpen ? null : model.sourceId)
              }
              pivotLink={pivotBySourceId.get(model.sourceId)}
              onOpenPivot={onOpenPivot}
            />
          );
        })}
      </div>
      )}
    </section>
  );
}
