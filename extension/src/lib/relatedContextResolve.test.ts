/**
 * Phase 18C — Related Context relationship resolver tests.
 */

import { describe, expect, it } from "vitest";
import { createOkSourceResult } from "./enrichment";
import { IOC_TYPE } from "./iocRegex";
import { INVESTIGATION_STATUS } from "./investigationCapability";
import { createInvestigationTarget } from "./investigationTarget";
import { RELATION_TYPE } from "./relatedContextModel";
import {
  normalizeAsnValue,
  resolveRelatedContext,
} from "./relatedContextResolve";
import { normalizeShodanDomainResponse, normalizeShodanHostResponse } from "./shodanConnector";
import { normalizeCensysHostResponse } from "./censysConnector";
import { normalizeRdapDomainPayload } from "./rdapWhoisConnector";

describe("relatedContextNormalize ASN", () => {
  it("normalizes ASN values", () => {
    expect(normalizeAsnValue("AS15169")).toBe("AS15169");
    expect(normalizeAsnValue("15169")).toBe("AS15169");
    expect(normalizeAsnValue("AS0")).toBeNull();
    expect(normalizeAsnValue("ASN")).toBeNull();
  });
});

describe("adapter network/registration context", () => {
  it("extracts Shodan ASN and organization", () => {
    const normalized = normalizeShodanHostResponse({
      ip_str: "8.8.8.8",
      asn: "AS15169",
      org: "Google LLC",
      country_code: "US",
      ports: [53],
      data: [{ port: 53, product: "dns" }],
    });
    expect(normalized?.networkContext?.asn).toBe("AS15169");
    expect(normalized?.networkContext?.organization).toBe("Google LLC");
  });

  it("extracts Shodan domain resolved A records without live DNS", () => {
    const normalized = normalizeShodanDomainResponse({
      domain: "example.com",
      data: [{ subdomain: "", type: "A", value: "93.184.216.34" }],
      subdomains: [],
      tags: [],
    });
    expect(normalized?.networkContext?.resolvedIps).toEqual(["93.184.216.34"]);
  });

  it("extracts Censys numeric ASN", () => {
    const normalized = normalizeCensysHostResponse({
      code: 200,
      result: {
        ip: "8.8.8.8",
        autonomous_system: { asn: 15169, name: "GOOGLE" },
        services: [{ port: 443, service_name: "HTTP" }],
      },
    });
    expect(normalized?.networkContext?.asn).toBe("15169");
  });

  it("extracts RDAP registrar and nameservers", () => {
    const normalized = normalizeRdapDomainPayload({
      objectClassName: "domain",
      ldhName: "example.com",
      entities: [
        {
          roles: ["registrar"],
          vcardArray: [
            "vcard",
            [
              ["version", {}, "text", "4.0"],
              ["fn", {}, "text", "Example Registrar"],
            ],
          ],
        },
      ],
      events: [
        { eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" },
      ],
      nameservers: [{ ldhName: "a.iana-servers.net" }],
    });
    expect(normalized?.registrationContext?.registrar).toBe("Example Registrar");
    expect(normalized?.registrationContext?.nameservers?.[0]).toMatch(/iana-servers/i);
  });
});

describe("resolveRelatedContext", () => {
  it("derives URL structural context without network calls", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.URL,
      value: "https://evil.example:8443/login/path",
    });
    const model = resolveRelatedContext({ target, sourceResults: [] });
    expect(model.status).toBe(INVESTIGATION_STATUS.AVAILABLE);
    expect(model.relationships.some((r) => r.relationType === RELATION_TYPE.URL_SCHEME)).toBe(
      true
    );
    expect(model.relationships.some((r) => r.relationType === RELATION_TYPE.URL_HOST)).toBe(true);
    expect(model.relationships.some((r) => r.relationType === RELATION_TYPE.URL_PORT)).toBe(true);
    expect(model.relationships.some((r) => r.relationType === RELATION_TYPE.URL_PATH)).toBe(true);
    const host = model.relationships.find((r) => r.relationType === RELATION_TYPE.URL_HOST);
    expect(host?.pivotable).toBe(true);
    expect(host?.iocType).toBe(IOC_TYPE.DOMAIN);
    expect(host?.displayValue).toBe("evil.example");
  });

  it("does not treat path tokens as IOCs", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.URL,
      value: "https://safe.example/download/malware.example.com.exe",
    });
    const model = resolveRelatedContext({ target });
    const domains = model.relationships.filter((r) => r.iocType === IOC_TYPE.DOMAIN);
    expect(domains.every((r) => r.displayValue === "safe.example")).toBe(true);
  });

  it("surfaces ASN from structured network context and keeps find_related_infra separate", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "shodan",
          summary: "ok",
          networkContext: { asn: "AS15169", organization: "Google LLC" },
        }),
      ],
    });
    const asn = model.relationships.find((r) => r.relationType === RELATION_TYPE.IP_ASN);
    expect(asn?.displayValue).toBe("AS15169");
    expect(asn?.pivotable).toBe(true);
    const org = model.relationships.find(
      (r) => r.relationType === RELATION_TYPE.IP_ORGANIZATION
    );
    expect(org?.pivotable).toBe(false);
  });

  it("does not fabricate relationships from same ASN text alone", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "1.2.3.4",
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "otx",
          summary: "Seen near AS15169 infrastructure",
          tags: ["AS15169"],
        }),
      ],
    });
    expect(model.relationships.some((r) => r.relationType === RELATION_TYPE.IP_ASN)).toBe(false);
  });

  it("does not fabricate hash→URL relationships", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.SHA256,
      value: "a".repeat(64),
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "virustotal",
          summary: "12 malicious detections",
          tags: ["malicious"],
        }),
      ],
    });
    expect(model.status).toBe(INVESTIGATION_STATUS.NO_FINDINGS);
    expect(model.relationships).toHaveLength(0);
  });

  it("merges multi-source ASN provenance", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "shodan",
          summary: "ok",
          networkContext: { asn: "AS15169" },
        }),
        createOkSourceResult({
          sourceId: "censys",
          summary: "ok",
          networkContext: { asn: "15169" },
        }),
      ],
    });
    const asn = model.relationships.filter((r) => r.relationType === RELATION_TYPE.IP_ASN);
    expect(asn).toHaveLength(1);
    expect(asn[0]?.provenanceLabels).toEqual(
      expect.arrayContaining(["Shodan", "Censys"])
    );
  });

  it("isolates relationships by target", () => {
    const a = createInvestigationTarget({ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" });
    const b = createInvestigationTarget({ iocType: IOC_TYPE.IPV4, value: "1.1.1.1" });
    const withAsn = [
      createOkSourceResult({
        sourceId: "shodan",
        summary: "ok",
        networkContext: { asn: "AS15169" },
      }),
    ];
    const modelA = resolveRelatedContext({ target: a, sourceResults: withAsn });
    const modelB = resolveRelatedContext({
      target: b,
      sourceResults: [
        createOkSourceResult({
          sourceId: "shodan",
          summary: "ok",
          networkContext: { organization: "Cloudflare" },
        }),
      ],
    });
    expect(modelA.relationships.some((r) => r.displayValue === "AS15169")).toBe(true);
    expect(modelB.relationships.some((r) => r.displayValue === "AS15169")).toBe(false);
  });

  it("promotes only structured CVE associations", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.DOMAIN,
      value: "evil.example",
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "otx",
          summary: "mentions CVE-2021-44228 in prose only",
          intelContext: { cveIds: ["CVE-2021-44228"] },
        }),
      ],
    });
    expect(
      model.relationships.some((r) => r.relationType === RELATION_TYPE.VULNERABILITY_ASSOCIATION)
    ).toBe(true);
    const incidental = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "otx",
          summary: "unrelated note about CVE-2021-44228 in history",
        }),
      ],
    });
    expect(
      incidental.relationships.some(
        (r) => r.relationType === RELATION_TYPE.VULNERABILITY_ASSOCIATION
      )
    ).toBe(false);
  });

  it("prevents self-relationships", () => {
    const target = createInvestigationTarget({
      iocType: IOC_TYPE.DOMAIN,
      value: "example.com",
    });
    const model = resolveRelatedContext({
      target,
      sourceResults: [
        createOkSourceResult({
          sourceId: "rdap_whois",
          summary: "ok",
          registrationContext: {
            nameservers: ["example.com"],
            registrar: "Example Registrar",
          },
        }),
      ],
    });
    expect(
      model.relationships.some(
        (r) =>
          r.iocType === IOC_TYPE.DOMAIN &&
          r.canonicalValue.toLowerCase() === "example.com"
      )
    ).toBe(false);
    expect(
      model.relationships.some((r) => r.relationType === RELATION_TYPE.DOMAIN_REGISTRAR)
    ).toBe(true);
  });
});
