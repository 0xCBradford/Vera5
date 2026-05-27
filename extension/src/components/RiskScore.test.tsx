/**
 * @vitest-environment happy-dom
 */
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../lib/hoverCardEnrichment";
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

  it("does not render when all enrichment sources are disabled", () => {
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
    expect(mounted.container.textContent).toBe("");
    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score")
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
    expect(mounted.container.textContent).toContain("Risk score:");
    expect(mounted.container.textContent).toContain("Unknown risk");
  });

  it("shows blended label and per-source tooltip contributions", () => {
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
  });
});
