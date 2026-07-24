import { describe, expect, it } from "vitest";
import {
  createCorrelationCluster,
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
} from "./correlationCluster";
import { createInvestigationSession } from "./investigationSession";
import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import { IOC_TYPE } from "./iocRegex";
import {
  buildCorrelationPackClusterSection,
  buildCorrelationPackExportDocument,
  buildCorrelationPackJsonFilename,
  buildCorrelationPackMarkdownAppendix,
  buildCorrelationPackMarkdownFilename,
  containsCorrelationPackExportSecrets,
  CORRELATION_PACK_EXPORT_SCHEMA_VERSION,
  CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING,
  CORRELATION_PACK_MEMBERS_HEADING,
  CORRELATION_PACK_SESSIONS_HEADING,
  CORRELATION_PACK_SUMMARY_HEADING,
  parseCorrelationClusterMemberIocKeyForExport,
  serializeCorrelationPackExportJson,
} from "./correlationClusterExport";
import { ENRICHMENT_EXPORT_SCHEMA_VERSION } from "./enrichmentExport";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";

describe("correlationClusterExport markdown appendix", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");

  it("parses member IOC keys into type and value rows", () => {
    expect(parseCorrelationClusterMemberIocKeyForExport(ipv4Key)).toEqual({
      memberKey: ipv4Key,
      iocType: IOC_TYPE.IPV4,
      typeLabel: "IP",
      value: "8.8.8.8",
    });
    expect(parseCorrelationClusterMemberIocKeyForExport("not-a-key").value).toBe(
      "not-a-key"
    );
  });

  it("builds cluster summary, member IOC table, and session refs", () => {
    const sessionA = createInvestigationSession({
      id: "vera5-inv-a",
      title: "Alert triage",
      pageUrl: "https://example.com/alert",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });
    const sessionB = createInvestigationSession({
      id: "vera5-inv-b",
      title: "Blog revisit",
      pageUrl: "https://malware.example/post",
      createdAt: 1_700_000_200_000,
      updatedAt: 1_700_000_300_000,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: [sessionA.id, sessionB.id],
      firstSeenAt: sessionA.createdAt,
      lastSeenAt: sessionB.updatedAt,
      coOccurrenceCount: 2,
    });

    const section = buildCorrelationPackClusterSection(cluster, [sessionA, sessionB]);
    expect(section.memberCount).toBe(2);
    expect(section.sessionCount).toBe(2);
    expect(section.members.map((row) => row.value).sort()).toEqual([
      "8.8.8.8",
      "example.com",
    ]);
    expect(section.sessions.map((row) => row.title).sort()).toEqual([
      "Alert triage",
      "Blog revisit",
    ]);

    const markdown = buildCorrelationPackMarkdownAppendix({
      clusters: [cluster],
      sessionsById: [sessionA, sessionB],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });

    expect(markdown).toContain(`# ${CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING}`);
    expect(markdown).toContain(CORRELATION_CLUSTER_DISCLAIMER_TEXT);
    expect(markdown).toContain("Correlation ≠ causation");
    expect(markdown).toContain("not a detection verdict");
    expect(markdown).toContain(`#### ${CORRELATION_PACK_SUMMARY_HEADING}`);
    expect(markdown).toContain(`#### ${CORRELATION_PACK_MEMBERS_HEADING}`);
    expect(markdown).toContain(`#### ${CORRELATION_PACK_SESSIONS_HEADING}`);
    expect(markdown).toContain(cluster.clusterId);
    expect(markdown).toContain("| Type | Value | Member key |");
    expect(markdown).toContain("| IP | 8.8.8.8 |");
    expect(markdown).toContain("| DOM | example.com |");
    expect(markdown).toContain("| Session ID | Title | Page URL | Date |");
    expect(markdown).toContain(sessionA.id);
    expect(markdown).toContain("Alert triage");
    expect(markdown).toContain("https://example.com/alert");
    expect(markdown).toContain(sessionB.id);
    expect(markdown).toContain("Blog revisit");
    expect(markdown).toContain("- **Clusters:** 1");
    expect(markdown).toContain("2026-07-22T12:00:00.000Z");
  });

  it("renders an empty pack appendix when no clusters are supplied", () => {
    const markdown = buildCorrelationPackMarkdownAppendix({
      clusters: [],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });
    expect(markdown).toContain(`# ${CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING}`);
    expect(markdown).toContain(CORRELATION_CLUSTER_DISCLAIMER_TEXT);
    expect(markdown).toContain("- **Clusters:** 0");
    expect(markdown).toContain("_No correlation clusters are included in this pack._");
    expect(markdown).not.toContain(`#### ${CORRELATION_PACK_MEMBERS_HEADING}`);
  });

  it("builds a stable markdown filename from the export date", () => {
    expect(buildCorrelationPackMarkdownFilename("2026-07-22T12:00:00.000Z")).toBe(
      "vera5-correlation-pack-2026-07-22.md"
    );
  });

  it("escapes pipe characters in markdown table cells", () => {
    const session = createInvestigationSession({
      id: "vera5-inv-pipe",
      title: "A | B",
      pageUrl: "https://example.com/a|b",
      createdAt: 1,
      updatedAt: 1,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil|example.com")],
      sessionIds: [session.id],
      firstSeenAt: 1,
      lastSeenAt: 1,
      coOccurrenceCount: 1,
    });
    const markdown = buildCorrelationPackMarkdownAppendix({
      clusters: [cluster],
      sessionsById: [session],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });
    expect(markdown).toContain("evil\\|example.com");
    expect(markdown).toContain("A \\| B");
    expect(markdown).toContain("https://example.com/a\\|b");
  });
});

describe("correlationClusterExport JSON appendix", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");

  it("uses the same top-level schemaVersion envelope pattern as enrichment exports", () => {
    expect(CORRELATION_PACK_EXPORT_SCHEMA_VERSION).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
    expect(CORRELATION_PACK_EXPORT_SCHEMA_VERSION).toBe(1);
  });

  it("builds a JSON appendix document with schemaVersion, exportedAt, clusters, members, and session refs", () => {
    const sessionA = createInvestigationSession({
      id: "vera5-inv-json-a",
      title: "Alert triage",
      pageUrl: "https://example.com/alert",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });
    const sessionB = createInvestigationSession({
      id: "vera5-inv-json-b",
      title: "Blog revisit",
      pageUrl: "https://malware.example/post",
      createdAt: 1_700_000_200_000,
      updatedAt: 1_700_000_300_000,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: [sessionA.id, sessionB.id],
      firstSeenAt: sessionA.createdAt,
      lastSeenAt: sessionB.updatedAt,
      coOccurrenceCount: 2,
    });

    const document = buildCorrelationPackExportDocument({
      clusters: [cluster],
      sessionsById: [sessionA, sessionB],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });

    expect(document.schemaVersion).toBe(CORRELATION_PACK_EXPORT_SCHEMA_VERSION);
    expect(document.exportedAt).toBe("2026-07-22T12:00:00.000Z");
    expect(document.disclaimer).toBe(CORRELATION_CLUSTER_DISCLAIMER_TEXT);
    expect(document.disclaimer).toContain("Correlation ≠ causation");
    expect(document.disclaimer).toContain("not a detection verdict");
    expect(document.clusters).toHaveLength(1);
    expect(document.clusters[0]?.clusterId).toBe(cluster.clusterId);
    expect(document.clusters[0]?.memberCount).toBe(2);
    expect(document.clusters[0]?.sessionCount).toBe(2);
    expect(document.clusters[0]?.coOccurrenceCount).toBe(2);
    expect(document.clusters[0]?.members.map((row) => row.value).sort()).toEqual([
      "8.8.8.8",
      "example.com",
    ]);
    expect(
      document.clusters[0]?.members.find((row) => row.value === "8.8.8.8")
    ).toMatchObject({
      iocType: IOC_TYPE.IPV4,
      iocTypeLabel: "IP",
      memberKey: ipv4Key,
    });
    expect(document.clusters[0]?.sessions.map((row) => row.sessionId).sort()).toEqual(
      [sessionA.id, sessionB.id].sort()
    );
    expect(
      document.clusters[0]?.sessions.find((row) => row.sessionId === sessionA.id)
    ).toMatchObject({
      title: "Alert triage",
      pageUrl: "https://example.com/alert",
    });

    const serialized = serializeCorrelationPackExportJson({
      clusters: [cluster],
      sessionsById: [sessionA, sessionB],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });
    const parsed = JSON.parse(serialized) as {
      schemaVersion: number;
      exportedAt: string;
      clusters: unknown[];
    };
    expect(parsed.schemaVersion).toBe(CORRELATION_PACK_EXPORT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe("2026-07-22T12:00:00.000Z");
    expect(parsed.clusters).toHaveLength(1);
    expect(serialized).toContain(`"schemaVersion": ${CORRELATION_PACK_EXPORT_SCHEMA_VERSION}`);
  });

  it("serializes an empty JSON pack with schemaVersion when no clusters are supplied", () => {
    const document = buildCorrelationPackExportDocument({
      clusters: [],
      exportedAt: "2026-07-22T12:00:00.000Z",
    });
    expect(document).toEqual({
      schemaVersion: CORRELATION_PACK_EXPORT_SCHEMA_VERSION,
      exportedAt: "2026-07-22T12:00:00.000Z",
      disclaimer: CORRELATION_CLUSTER_DISCLAIMER_TEXT,
      clusters: [],
    });
  });

  it("builds a stable JSON filename from the export date", () => {
    expect(buildCorrelationPackJsonFilename("2026-07-22T12:00:00.000Z")).toBe(
      "vera5-correlation-pack-2026-07-22.json"
    );
    expect(buildCorrelationPackMarkdownFilename("2026-07-22T12:00:00.000Z")).toBe(
      "vera5-correlation-pack-2026-07-22.md"
    );
  });
});

describe("correlationClusterExport redaction", () => {
  const leakyVendorPayload = JSON.stringify({
    api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    data: { abuseConfidenceScore: 74 },
  });

  it("redacts API keys and raw vendor payloads from markdown and JSON pack exports", () => {
    const session = createInvestigationSession({
      id: "vera5-inv-leaky",
      title: leakyVendorPayload,
      pageUrl: leakyVendorPayload,
      createdAt: 1,
      updatedAt: 2,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [
        buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com"),
      ],
      sessionIds: [session.id, "vera5-inv-other"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });
    const exportInput = {
      clusters: [cluster],
      sessionsById: [session],
      exportedAt: "2026-07-22T12:00:00.000Z",
    };

    const markdown = buildCorrelationPackMarkdownAppendix(exportInput);
    const json = serializeCorrelationPackExportJson(exportInput);
    const document = buildCorrelationPackExportDocument(exportInput);

    for (const payload of [markdown, json]) {
      expect(payload).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
      expect(payload).not.toContain("rawVendorJson");
      expect(containsCorrelationPackExportSecrets(payload)).toBe(false);
    }

    expect(json).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(document.clusters[0]?.sessions[0]?.title).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(document.clusters[0]?.sessions[0]?.pageUrl).toContain(REDACTED_VALUE_PLACEHOLDER);
  });

  it("flags payloads that still contain forbidden secret fields", () => {
    expect(
      containsCorrelationPackExportSecrets(
        JSON.stringify({ rawVendorJson: '{"api_key":"secret"}' })
      )
    ).toBe(true);
    expect(
      containsCorrelationPackExportSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(
      containsCorrelationPackExportSecrets(
        JSON.stringify({ api_key: REDACTED_VALUE_PLACEHOLDER })
      )
    ).toBe(false);
  });
});
