import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  CONDITIONAL_CHANNEL_ID,
  resolveConditionalHeaderSummary,
  resolveConditionalIntelligenceChannels,
} from "./conditionalIntelligence";

describe("conditionalIntelligence", () => {
  it("exposes three normalized channels with Vulnerability Context label", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: null,
      iocValue: null,
    });
    expect(model.channels.map((channel) => channel.id)).toEqual([
      CONDITIONAL_CHANNEL_ID.MITRE,
      CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN,
      CONDITIONAL_CHANNEL_ID.VULNERABILITY,
    ]);
    expect(model.channels.map((channel) => channel.label)).toEqual([
      "MITRE ATT&CK",
      "Malware / Campaign",
      "Vulnerability Context",
    ]);
    expect(model.headerSummary).toBeNull();
  });

  it("uses awaiting-selection when no IOC is selected", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: null,
      iocValue: null,
    });
    expect(model.channels.every((channel) => channel.state === "awaiting_selection")).toBe(true);
    expect(model.channels.every((channel) => channel.isExpandable === false)).toBe(true);
    expect(model.channels.every((channel) => channel.findings.length === 0)).toBe(true);
  });

  it("uses not-evaluated for MITRE and malware when an IOC is selected", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.IPV4,
      iocValue: "8.8.8.8",
    });
    expect(model.channels[0]?.state).toBe("not_evaluated");
    expect(model.channels[1]?.state).toBe("not_evaluated");
    expect(model.channels[2]?.state).toBe("not_evaluated");
    expect(model.channels.every((channel) => channel.isExpandable === false)).toBe(true);
    expect(model.headerSummary).toBe("0 / 3 EVALUATED");
  });

  it("marks Vulnerability Context unavailable with expandable detail for CVE IOCs", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.CVE,
      iocValue: "CVE-2021-44228",
    });
    const vuln = model.channels.find(
      (channel) => channel.id === CONDITIONAL_CHANNEL_ID.VULNERABILITY
    );
    expect(vuln?.state).toBe("unavailable");
    expect(vuln?.isExpandable).toBe(true);
    expect(vuln?.detailNote).toContain("CVE-2021-44228");
    expect(vuln?.detailNote).toContain("not available in local enrichment");
    expect(vuln?.findings).toHaveLength(0);
    expect(model.channels[0]?.state).toBe("not_evaluated");
    expect(model.headerSummary).toMatch(/EVALUATED|PARTIAL/);
  });

  it("never fabricates findings or confirmed-negative associations", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.URL,
      iocValue: "http://evil.example/",
    });
    expect(model.channels.every((channel) => channel.findings.length === 0)).toBe(true);
    expect(model.channels.every((channel) => channel.state !== "no_association")).toBe(true);
    expect(model.channels.every((channel) => channel.state !== "available")).toBe(true);
  });

  it("derives header summary only from real channel state", () => {
    expect(
      resolveConditionalHeaderSummary([
        {
          id: CONDITIONAL_CHANNEL_ID.MITRE,
          label: "MITRE ATT&CK",
          description: "",
          glyph: "mitre",
          state: "awaiting_selection",
          stateLabel: "Awaiting selection",
          summary: null,
          findings: [],
          sources: [],
          lastEvaluated: null,
          isExpandable: false,
          error: null,
          unsupportedReason: null,
          coverageState: "none",
          detailNote: null,
        },
      ])
    ).toBeNull();
  });
});
