/**
 * Phase 18A — Investigation Paths engine unit tests.
 */

import { afterEach, describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  INVESTIGATION_CAPABILITY_ID,
  INVESTIGATION_STATUS,
  INVESTIGATION_CAPABILITY_REGISTRY,
} from "./investigationCapability";
import {
  resolveInvestigationCapabilities,
  resolveInvestigationWorkbench,
  resolveRecommendedPath,
} from "./investigationEngine";
import {
  clearAllInvestigationCapabilityState,
  markInvestigationCapabilityExecuted,
} from "./investigationState";
import { createInvestigationTarget } from "./investigationTarget";

afterEach(() => {
  clearAllInvestigationCapabilityState();
});

const emptyFacts = {
  pageIndicatorCount: 1,
  priorSightingCount: 0,
  collectionMembership: null,
  suppressed: false,
};

describe("investigationTarget", () => {
  it("builds a stable canonical target key", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: " 8.8.8.8 ",
    });
    expect(target?.targetKey).toBe("ipv4:8.8.8.8");
    expect(target?.canonicalValue).toBe("8.8.8.8");
  });
});

describe("investigationEngine capability resolution", () => {
  it("returns no-target unavailable states without fabricating findings", () => {
    const results = resolveInvestigationCapabilities({
      target: null,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(results.every((result) => result.findings.length === 0)).toBe(true);
    expect(
      results.every(
        (result) =>
          result.status === INVESTIGATION_STATUS.UNAVAILABLE ||
          result.status === INVESTIGATION_STATUS.NOT_APPLICABLE
      )
    ).toBe(true);
  });

  it("marks MITRE and malware campaign NOT_EVALUATED without enrichment evidence", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });
    const workbench = resolveInvestigationWorkbench({
      target,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK)?.status
    ).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN)?.status
    ).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK)?.findings
    ).toHaveLength(0);
  });

  it("marks vulnerability NOT_EVALUATED for non-CVE without evidence and AVAILABLE for CVE", () => {
    const ip = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "1.2.3.4",
    });
    const cve = createInvestigationTarget({
      iocType: IOC_TYPE.CVE,
      value: "CVE-2021-44228",
    });
    const ipBench = resolveInvestigationWorkbench({
      target: ip,
      relatedFacts: emptyFacts,
      availability: {},
    });
    const cveBench = resolveInvestigationWorkbench({
      target: cve,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(
      ipBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT)?.status
    ).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
    expect(
      cveBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT)?.status
    ).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(
      cveBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT)?.findings[0]
        ?.primaryValue
    ).toBe("CVE-2021-44228");
  });

  it("derives deterministic URL host/scheme relationships", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.URL,
      value: "https://evil.example/path",
    });
    const workbench = resolveInvestigationWorkbench({
      target,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.RELATED_URL_HOST)?.status
    ).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.RELATED_URL_HOST)?.findings[0]
        ?.primaryValue
    ).toBe("evil.example");
    expect(
      workbench.resultsById.get(INVESTIGATION_CAPABILITY_ID.RELATED_URL_SCHEME)?.findings[0]
        ?.primaryValue
    ).toBe("https");
    expect(
      workbench.relatedContext.relationships.some(
        (relation) => relation.relationType === "URL_HOST"
      )
    ).toBe(true);
    expect(workbench.relatedLines.some((line) => line.kind === "HOST")).toBe(true);
  });

  it("exposes local related facts as AVAILABLE and empty local as NO_FINDINGS", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.DOMAIN,
      value: "example.com",
    });
    const withFacts = resolveInvestigationWorkbench({
      target,
      relatedFacts: {
        pageIndicatorCount: 4,
        priorSightingCount: 2,
        collectionMembership: 1,
        suppressed: true,
      },
      availability: {},
    });
    expect(
      withFacts.resultsById.get(INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT)?.status
    ).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(withFacts.relatedLines.length).toBeGreaterThan(0);

    const withoutFacts = resolveInvestigationWorkbench({
      target,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(
      withoutFacts.resultsById.get(INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT)?.status
    ).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
  });

  it("gates sandbox capabilities by IOC type", () => {
    const ip = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });
    const hash = createInvestigationTarget({
      iocType: IOC_TYPE.SHA256,
      value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
    const ipBench = resolveInvestigationWorkbench({
      target: ip,
      relatedFacts: emptyFacts,
      availability: {},
    });
    const hashBench = resolveInvestigationWorkbench({
      target: hash,
      relatedFacts: emptyFacts,
      availability: {},
    });
    expect(
      ipBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.SANDBOX_JOE)?.status
    ).toBe(INVESTIGATION_STATUS.NOT_APPLICABLE);
    expect(
      hashBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.SANDBOX_JOE)?.status
    ).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(
      hashBench.resultsById.get(INVESTIGATION_CAPABILITY_ID.SANDBOX_JOE)?.executable
    ).toBe(true);
    expect(hashBench.sandboxDestinations.every((d) => d.kind !== "unsupported")).toBe(true);
  });

  it("does not treat missing malware sources as ERROR", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.MD5,
      value: "d41d8cd98f00b204e9800998ecf8427e",
    });
    const workbench = resolveInvestigationWorkbench({
      target,
      relatedFacts: emptyFacts,
      availability: {
        virustotal: { enabled: true, configured: false },
      },
    });
    const malware = workbench.resultsById.get(
      INVESTIGATION_CAPABILITY_ID.SEARCH_MALWARE_INTEL
    );
    expect(malware?.status).toBe(INVESTIGATION_STATUS.UNAVAILABLE);
    expect(malware?.reasonCode).toBe("MISSING_SOURCE_CONFIG");
  });
});

describe("recommended path", () => {
  it("derives recommendations from capability state and keeps future paths non-executable", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.URL,
      value: "https://example.com/a",
    });
    const workbench = resolveInvestigationWorkbench({
      target,
      relatedFacts: emptyFacts,
      availability: {
        virustotal: { enabled: true, configured: true },
      },
    });
    const path = resolveRecommendedPath(workbench.resultsById);
    expect(path.map((item) => item.step)).toEqual(["01", "02", "03", "04"]);
    const review = path.find(
      (item) => item.id === INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS
    );
    expect(review?.executable).toBe(true);
    const infra = path.find(
      (item) => item.id === INVESTIGATION_CAPABILITY_ID.FIND_RELATED_INFRASTRUCTURE
    );
    const campaign = path.find(
      (item) => item.id === INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS
    );
    expect(campaign?.executable).toBe(false);
    expect(campaign?.status).toBe(INVESTIGATION_STATUS.NOT_EVALUATED);
  });

  it("marks executed recommendations completed and scoped per target", () => {
    const targetA = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    })!;
    const targetB = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "1.1.1.1",
    })!;
    markInvestigationCapabilityExecuted(
      targetA.targetKey,
      INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS
    );
    const benchA = resolveInvestigationWorkbench({
      target: targetA,
      relatedFacts: emptyFacts,
      availability: {},
    });
    const benchB = resolveInvestigationWorkbench({
      target: targetB,
      relatedFacts: emptyFacts,
      availability: {},
    });
    const reviewA = benchA.recommendedPath.find(
      (item) => item.id === INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS
    );
    const reviewB = benchB.recommendedPath.find(
      (item) => item.id === INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS
    );
    expect(reviewA?.completionState).toBe("completed");
    expect(reviewA?.executable).toBe(false);
    expect(reviewB?.completionState).toBe("pending");
    expect(reviewB?.executable).toBe(true);
  });
});

describe("registry contracts", () => {
  it("registers stable capability IDs without executable FUTURE handlers inventing data", () => {
    const ids = INVESTIGATION_CAPABILITY_REGISTRY.map((entry) => entry.id);
    expect(ids).toContain(INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK);
    expect(ids).toContain(INVESTIGATION_CAPABILITY_ID.SANDBOX_ANYRUN);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
