/**
 * Phase 18B — Conditional Intelligence normalize + resolve tests.
 * Conservative: no Score→MITRE, no phishing→T1566, no port→CVE fabrication.
 */

import { describe, expect, it } from "vitest";
import { createOkSourceResult, ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  corroborateObservations,
  CONDITIONAL_INTEL_EVIDENCE_QUALITY,
  CONDITIONAL_INTEL_OBSERVATION_KIND,
  isGenericMalwareLabel,
  normalizeCveId,
  normalizeMalwareFamilyName,
  normalizeMitreTechniqueId,
  sanitizeIntelReferenceUrl,
} from "./conditionalIntelNormalize";
import {
  resolveMalwareCampaignCapability,
  resolveMitreAttackCapability,
  resolveVulnerabilityContextCapability,
} from "./conditionalIntelResolve";
import { createInvestigationTarget } from "./investigationTarget";
import { IOC_TYPE } from "./iocRegex";
import { INVESTIGATION_STATUS } from "./investigationCapability";
import { normalizeOtxIndicatorResponse } from "./otxConnector";
import { normalizeVirustotalResponse } from "./virustotalConnector";
import otxConditionalFixture from "./fixtures/otx/indicator-conditional-intel.json";
import vtPopularThreatFixture from "./fixtures/virustotal/file-popular-threat.json";

describe("conditionalIntelNormalize validators", () => {
  it("validates MITRE technique IDs and rejects malformed", () => {
    expect(normalizeMitreTechniqueId("T1059")).toBe("T1059");
    expect(normalizeMitreTechniqueId("t1059.001")).toBe("T1059.001");
    expect(normalizeMitreTechniqueId("1059")).toBeNull();
    expect(normalizeMitreTechniqueId("TXYZ")).toBeNull();
    expect(normalizeMitreTechniqueId("T1.2.3")).toBeNull();
    expect(normalizeMitreTechniqueId("ATTACK-T1059")).toBeNull();
  });

  it("normalizes CVE identifiers and rejects malformed", () => {
    expect(normalizeCveId("cve-2025-1234")).toBe("CVE-2025-1234");
    expect(normalizeCveId("CVE-2021-44228")).toBe("CVE-2021-44228");
    expect(normalizeCveId("CVE-2021-42")).toBeNull();
    expect(normalizeCveId("not-a-cve")).toBeNull();
  });

  it("filters generic malware labels", () => {
    expect(isGenericMalwareLabel("Trojan")).toBe(true);
    expect(isGenericMalwareLabel("phishing")).toBe(true);
    expect(isGenericMalwareLabel("Malware.Generic")).toBe(true);
    expect(isGenericMalwareLabel("Emotet")).toBe(false);
    expect(normalizeMalwareFamilyName("Trojan")).toBeNull();
    expect(normalizeMalwareFamilyName("Trojan.Win32.Emotet.A")).toBe("Emotet");
  });

  it("rejects unsafe reference schemes", () => {
    expect(sanitizeIntelReferenceUrl("https://example.com/report")).toMatch(/^https:/);
    expect(sanitizeIntelReferenceUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeIntelReferenceUrl("data:text/html,hi")).toBeUndefined();
  });

  it("corroborates identical observations across sources once each", () => {
    const findings = corroborateObservations([
      {
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY,
        value: "Emotet",
        displayValue: "Emotet",
        sourceId: "otx",
        sourceLabel: "OTX",
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      },
      {
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY,
        value: "emotet",
        displayValue: "emotet",
        sourceId: "threatfox",
        sourceLabel: "ThreatFox",
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      },
      {
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY,
        value: "EMOTET",
        displayValue: "EMOTET",
        sourceId: "otx",
        sourceLabel: "OTX",
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.sourceCount).toBe(2);
  });
});

describe("adapter intelContext extraction", () => {
  it("extracts OTX malware_families and attack_ids; rejects malformed ATT&CK", () => {
    const normalized = normalizeOtxIndicatorResponse(otxConditionalFixture);
    expect(normalized?.intelContext?.malwareFamilies).toEqual(
      expect.arrayContaining(["Emotet", "QakBot"])
    );
    expect(normalized?.intelContext?.attackIds).toEqual(
      expect.arrayContaining(["T1071.001", "T1059.001"])
    );
    expect(normalized?.intelContext?.attackIds).not.toContain("TXYZ");
    expect(normalized?.tags).toEqual(expect.arrayContaining(["malware", "phishing"]));
  });

  it("extracts VT popular threat names without treating category as family", () => {
    const normalized = normalizeVirustotalResponse(vtPopularThreatFixture);
    expect(normalized?.intelContext?.malwareFamilies?.some((name) => /emotet/i.test(name))).toBe(
      true
    );
    expect(normalized?.intelContext?.malwareFamilies).not.toContain("trojan");
  });
});

describe("conditionalIntelResolve", () => {
  const target = createInvestigationTarget({
    iocType: IOC_TYPE.IPV4,
    value: "198.51.100.99",
  });

  it("returns NOT_EVALUATED when no enrichment evidence exists", () => {
    expect(
      resolveMitreAttackCapability({ target, sourceResults: [] }).status
    ).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
    expect(
      resolveMalwareCampaignCapability({ target, sourceResults: [] }).status
    ).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
  });

  it("does not fabricate MITRE from malicious reputation alone", () => {
    const maliciousOnly = createOkSourceResult({
      sourceId: "virustotal",
      summary: "12 malicious detections",
      tags: ["malicious"],
    });
    const result = resolveMitreAttackCapability({
      target,
      sourceResults: [maliciousOnly],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
    expect(result.findings).toHaveLength(0);
  });

  it("does not map phishing tag to T1566", () => {
    const phishing = createOkSourceResult({
      sourceId: "otx",
      summary: "2 pulses",
      tags: ["phishing"],
    });
    const result = resolveMitreAttackCapability({
      target,
      sourceResults: [phishing],
    });
    expect(result.findings).toHaveLength(0);
    expect(result.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
  });

  it("does not treat Trojan tag as malware family", () => {
    const trojan = createOkSourceResult({
      sourceId: "otx",
      summary: "1 pulse",
      tags: ["Trojan", "malware"],
      intelContext: { malwareFamilies: ["Trojan"] },
    });
    const result = resolveMalwareCampaignCapability({
      target,
      sourceResults: [trojan],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
  });

  it("surfaces real MITRE techniques with corroboration", () => {
    const otx = createOkSourceResult({
      sourceId: "otx",
      summary: "2 pulses",
      intelContext: { attackIds: ["T1071.001", "T1059.001"] },
    });
    const other = createOkSourceResult({
      sourceId: "virustotal",
      summary: "ok",
      intelContext: { attackIds: ["T1071.001"] },
    });
    const result = resolveMitreAttackCapability({
      target,
      sourceResults: [otx, other],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.AVAILABLE);
    const t1071 = result.findings.find((f) => f.primaryValue.includes("T1071.001"));
    expect(t1071?.primaryValue).toContain("2 sources");
    expect(result.findings.some((f) => f.primaryValue.includes("T1059.001"))).toBe(true);
  });

  it("preserves conflicting malware families", () => {
    const otx = createOkSourceResult({
      sourceId: "otx",
      summary: "ok",
      intelContext: { malwareFamilies: ["Emotet"] },
    });
    const tf = createOkSourceResult({
      sourceId: "threatfox",
      summary: "ok",
      intelContext: { malwareFamilies: ["QakBot"] },
    });
    const result = resolveMalwareCampaignCapability({
      target,
      sourceResults: [otx, tf],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => f.primaryValue).join(" ")).toMatch(/Emotet/);
    expect(result.findings.map((f) => f.primaryValue).join(" ")).toMatch(/QakBot/);
  });

  it("corroborates identical family across sources", () => {
    const otx = createOkSourceResult({
      sourceId: "otx",
      summary: "ok",
      intelContext: { malwareFamilies: ["Emotet"] },
    });
    const tf = createOkSourceResult({
      sourceId: "threatfox",
      summary: "ok",
      intelContext: { malwareFamilies: ["emotet"] },
    });
    const result = resolveMalwareCampaignCapability({
      target,
      sourceResults: [otx, tf],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.primaryValue).toContain("2 sources");
  });

  it("does not fabricate CVE from open-port style summaries", () => {
    const shodan = createOkSourceResult({
      sourceId: "shodan",
      summary: "Open ports: 22, 80, 443",
      tags: ["ssh", "http"],
    });
    const result = resolveVulnerabilityContextCapability({
      target,
      sourceResults: [shodan],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
    expect(result.findings).toHaveLength(0);
  });

  it("deduplicates CVE references across sources", () => {
    const a = createOkSourceResult({
      sourceId: "otx",
      summary: "mentions CVE-2021-44228",
      intelContext: { cveIds: ["cve-2021-44228"] },
    });
    const b = createOkSourceResult({
      sourceId: "virustotal",
      summary: "ok",
      tags: ["CVE-2021-44228"],
    });
    const c = createOkSourceResult({
      sourceId: "urlscan",
      summary: "Related to CVE-2021-44228 in analysis",
    });
    const result = resolveVulnerabilityContextCapability({
      target,
      sourceResults: [a, b, c],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.primaryValue).toContain("CVE-2021-44228");
    expect(result.findings[0]?.primaryValue).toContain("3 sources");
  });

  it("makes vulnerability AVAILABLE for CVE IOC at identifier level", () => {
    const cveTarget = createInvestigationTarget({
      iocType: IOC_TYPE.CVE,
      value: "cve-2021-44228",
    });
    const result = resolveVulnerabilityContextCapability({
      target: cveTarget,
      sourceResults: [],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(result.findings[0]?.primaryValue).toBe("CVE-2021-44228");
    expect(result.reasonDetail).toContain("CVSS");
  });

  it("isolates findings by target evidence (no cross-contamination)", () => {
    const withFamily = createOkSourceResult({
      sourceId: "otx",
      summary: "ok",
      intelContext: { malwareFamilies: ["Emotet"] },
    });
    const a = resolveMalwareCampaignCapability({
      target,
      sourceResults: [withFamily],
    });
    const bTarget = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "1.1.1.1",
    });
    const b = resolveMalwareCampaignCapability({
      target: bTarget,
      sourceResults: [
        createOkSourceResult({
          sourceId: "otx",
          summary: "1 pulse",
          tags: ["scanner"],
        }),
      ],
    });
    expect(a.status).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(b.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
    expect(b.findings).toHaveLength(0);
  });

  it("ignores ERROR sources for observations but still evaluates", () => {
    const result = resolveMitreAttackCapability({
      target,
      sourceResults: [
        {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.ERROR,
          errorCode: "vendor_error",
        },
      ],
    });
    expect(result.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
  });
});
