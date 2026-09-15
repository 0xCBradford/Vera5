import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  CONDITIONAL_CHANNEL_ID,
  resolveConditionalHeaderSummary,
  resolveConditionalIntelligenceChannels,
} from "./conditionalIntelligence";
import { createOkSourceResult } from "./enrichment";
import { INVESTIGATION_STATUS } from "./investigationCapability";

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

  it("marks MITRE and malware NOT_EVALUATED without enrichment evidence", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.IPV4,
      iocValue: "8.8.8.8",
    });
    expect(model.channels[0]?.state).toBe("not_evaluated");
    expect(model.channels[1]?.state).toBe("not_evaluated");
    expect(model.channels[2]?.state).toBe("not_evaluated");
    expect(model.channels[0]?.investigationStatus).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
    expect(model.channels.every((channel) => channel.findings.length === 0)).toBe(true);
  });

  it("marks Vulnerability Context AVAILABLE for CVE IOC at identifier level", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.CVE,
      iocValue: "CVE-2021-44228",
    });
    const vuln = model.channels.find(
      (channel) => channel.id === CONDITIONAL_CHANNEL_ID.VULNERABILITY
    );
    expect(vuln?.state).toBe("available");
    expect(vuln?.isExpandable).toBe(true);
    expect(vuln?.findings[0]?.primaryValue).toBe("CVE-2021-44228");
    expect(vuln?.detailNote ?? vuln?.findings.length).toBeTruthy();
    expect(model.channels[0]?.state).toBe("not_evaluated");
    expect(model.headerSummary).toMatch(/FINDING|EVALUATED|PARTIAL/);
  });

  it("never fabricates findings from reputation alone", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.URL,
      iocValue: "http://evil.example/",
      sourceResults: [
        createOkSourceResult({
          sourceId: "virustotal",
          summary: "20 malicious detections",
          tags: ["malicious", "phishing"],
        }),
      ],
    });
    expect(model.channels.every((channel) => channel.findings.length === 0)).toBe(true);
    expect(model.channels.every((channel) => channel.state !== "available")).toBe(true);
    expect(model.channels[0]?.state).toBe("no_association");
    expect(model.channels[1]?.state).toBe("no_association");
  });

  it("surfaces attributed findings from intelContext", () => {
    const model = resolveConditionalIntelligenceChannels({
      iocType: IOC_TYPE.SHA256,
      iocValue: "a".repeat(64),
      sourceResults: [
        createOkSourceResult({
          sourceId: "otx",
          summary: "1 pulse",
          intelContext: {
            malwareFamilies: ["Emotet"],
            attackIds: ["T1059.001"],
          },
        }),
      ],
    });
    expect(model.channels[0]?.state).toBe("available");
    expect(model.channels[0]?.findings[0]?.primaryValue).toContain("T1059.001");
    expect(model.channels[1]?.state).toBe("available");
    expect(model.channels[1]?.findings[0]?.primaryValue).toContain("Emotet");
    expect(model.channels[1]?.findings[0]?.sourceAttribution).toContain("OTX");
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
          investigationStatus: null,
          capabilityId: "mitre_attack",
        },
      ])
    ).toBeNull();
  });
});
