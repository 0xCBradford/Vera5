/**
 * @vitest-environment happy-dom
 */
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../lib/hoverCardEnrichment";
import { COMPOSITE_SCORE_DISAGREEMENT_NOTICE } from "../lib/scoring";
import { RiskScore } from "./RiskScore";

function renderRiskScore(
  props: ComponentProps<typeof RiskScore>
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<RiskScore {...props} />);
  });
  return { container, root };
}

describe("RiskScore", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
  });

  it("does not render when no source results exist", () => {
    mounted = renderRiskScore({ sourceResults: [] });
    expect(mounted.container.textContent).toBe("");
  });

  it("shows explicit unavailable state when all enrichment sources are disabled", () => {
    mounted = renderRiskScore({
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "4 threat pulses",
        },
      ],
    });
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score-unavailable")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Risk score unavailable");
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score-label")
    ).toBeNull();
  });

  it("shows unknown when insufficient source evidence exists", () => {
    mounted = renderRiskScore({
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "84 abuse confidence",
        },
      ],
    });
    expect(mounted.container.textContent).toContain("Unknown risk");
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score-insufficient")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("How this score was computed");
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain(
      "Blended score steps are not available"
    );
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-chain")
    ).toBeNull();
  });

  it("shows blended label, reasoning chain, and per-source tooltip contributions", () => {
    mounted = renderRiskScore({
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "84 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "4 threat pulses",
        },
      ],
    });
    expect(mounted.container.textContent).toContain("Risk score:");
    expect(mounted.container.textContent).toContain(
      "How this score was computed"
    );
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-chain")
    ).not.toBeNull();
    expect(mounted.container.textContent).not.toContain("Unknown risk");
    const chips = mounted.container.querySelectorAll(
      ".vera5-hover-card-risk-contribution-chip"
    );
    expect(chips).toHaveLength(2);
    expect(chips[0]?.getAttribute("title")).toContain("AbuseIPDB:");
    expect(chips[1]?.getAttribute("title")).toContain("OTX:");
  });

  it("shows a disagreement callout when sources conflict", () => {
    mounted = renderRiskScore({
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "95 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "1 threat pulse",
        },
      ],
    });
    const callout = mounted.container.querySelector(
      ".vera5-hover-card-risk-disagreement"
    );
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toContain("Sources disagree:");
    expect(callout?.getAttribute("role")).toBe("note");
    const scoreSection = mounted.container.querySelector(
      ".vera5-hover-card-risk-score"
    );
    const reasoning = scoreSection?.querySelector(
      ".vera5-hover-card-risk-reasoning-chain"
    );
    expect(
      reasoning?.compareDocumentPosition(callout!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("reasoning chain presentation paths", () => {
  const agreeingSourceResults = [
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      label: "AbuseIPDB",
      status: "ok" as const,
      badgeText: "Live",
      detail: "74 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      label: "OTX",
      status: "ok" as const,
      badgeText: "Live",
      detail: "74 abuse confidence",
    },
  ];

  const disagreeingSourceResults = [
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      label: "AbuseIPDB",
      status: "ok" as const,
      badgeText: "Live",
      detail: "95 abuse confidence",
    },
    {
      sourceId: ENRICHMENT_SOURCE.OTX,
      label: "OTX",
      status: "ok" as const,
      badgeText: "Live",
      detail: "1 threat pulse",
    },
  ];

  const insufficientSourceResults = [
    {
      sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
      label: "AbuseIPDB",
      status: "ok" as const,
      badgeText: "Live",
      detail: "12 abuse confidence",
    },
  ];

  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
  });

  it("shows the reasoning chain section when blended composite evidence is available", () => {
    mounted = renderRiskScore({ sourceResults: agreeingSourceResults });
    const reasoning = mounted.container.querySelector(
      ".vera5-hover-card-risk-reasoning"
    );

    expect(reasoning).not.toBeNull();
    expect(reasoning?.getAttribute("aria-label")).toBe("How this score was computed");
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-chain")
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).toBeNull();
  });

  it("lists per-source reasoning lines in connector order", () => {
    mounted = renderRiskScore({ sourceResults: agreeingSourceResults });
    const steps = mounted.container.querySelectorAll(
      ".vera5-hover-card-risk-reasoning-step"
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]?.textContent).toContain("AbuseIPDB:");
    expect(steps[1]?.textContent).toContain("OTX:");
    expect(steps[0]?.textContent).toContain("74/100");
    expect(steps[1]?.textContent).toContain("74/100");
  });

  it("shows the disagreement callout only when sources diverge materially", () => {
    mounted = renderRiskScore({ sourceResults: agreeingSourceResults });
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-disagreement")
    ).toBeNull();

    mounted.root.unmount();
    mounted.container.remove();
    mounted = renderRiskScore({ sourceResults: disagreeingSourceResults });

    const callout = mounted.container.querySelector(
      ".vera5-hover-card-risk-disagreement"
    );
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toBe(COMPOSITE_SCORE_DISAGREEMENT_NOTICE);
  });

  it("shows the empty reasoning state instead of a chain when blend evidence is insufficient", () => {
    mounted = renderRiskScore({ sourceResults: insufficientSourceResults });

    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-empty")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain(
      "Blended score steps are not available"
    );
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-reasoning-chain")
    ).toBeNull();
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-disagreement")
    ).toBeNull();
  });
});
