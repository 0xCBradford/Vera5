import { describe, expect, it } from "vitest";
import {
  DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT,
  DEFAULT_RELATIONSHIP_EDGE_WEIGHT,
  RELATIONSHIP_EDGE_FIELD_KEYS,
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  RELATIONSHIP_EDGE_SCHEMA_VERSION,
  RELATIONSHIP_TYPE,
  RELATIONSHIP_TYPES,
  applyRelationshipEdgeKnownGoodPolicy,
  buildCoSeenRelationshipEdgesFromSessionScan,
  buildRelationshipEdgeId,
  buildRelationshipEdgesFromSessionScan,
  buildRelationshipEdgesFromSessionScanAndEnrichEvents,
  buildResolvedFromRelationshipEdgesFromEnrichPivots,
  buildResolvedFromRelationshipEdgesFromSessionScanUrls,
  canonicalizeRelationshipEdgeEntities,
  createRelationshipEdge,
  extractRelationshipHostEntityKeyFromUrlValue,
  filterRelationshipEligibleEntityKeys,
  isRelationshipEdgeEligibleIocType,
  isRelationshipEdgeKnownGoodPolicy,
  isRelationshipType,
  mergeRelationshipEdgePair,
  mergeRelationshipEdgesAcrossSessions,
  normalizeRelationshipEdge,
  normalizeRelationshipEdgeKnownGoodPolicy,
  normalizeRelationshipEdgeMinCoOccurrenceCount,
  normalizeRelationshipEdgeSessionIds,
  normalizeRelationshipEntityKey,
  parseRelationshipEntityKey,
  relationshipEdgeCoOccurrenceCount,
  relationshipEdgeHasOnlyAllowlistedFields,
  relationshipEdgeInvolvesKnownGoodEntity,
  relationshipEntityKeyMatchesKnownGood,
} from "./relationshipEdge";
import {
  createKnownGoodEntry,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
} from "./knownGood";

describe("RelationshipEdge schema", () => {
  it("accepts co_seen and resolved_from relationship types", () => {
    expect(isRelationshipType("co_seen")).toBe(true);
    expect(isRelationshipType("resolved_from")).toBe(true);
    expect(isRelationshipType("appears_with")).toBe(false);
    expect(isRelationshipType("")).toBe(false);
    expect(RELATIONSHIP_TYPES).toEqual([
      RELATIONSHIP_TYPE.CO_SEEN,
      RELATIONSHIP_TYPE.RESOLVED_FROM,
    ]);
  });

  it("creates an edge with entityA, entityB, relationship, sessionIds, firstSeen, lastSeen, weight", () => {
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-b", "vera5-inv-a"],
      firstSeen: 1_700_000_000_000,
      lastSeen: 1_700_000_000_500,
      weight: 2,
    });

    expect(edge).toEqual({
      schemaVersion: RELATIONSHIP_EDGE_SCHEMA_VERSION,
      edgeId: expect.stringMatching(/^re-/),
      entityA: "domain:example.com",
      entityB: "ipv4:8.8.8.8",
      relationship: "co_seen",
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 1_700_000_000_000,
      lastSeen: 1_700_000_000_500,
      weight: 2,
    });
    expect(relationshipEdgeHasOnlyAllowlistedFields(edge)).toBe(true);
    expect(Object.keys(edge).sort()).toEqual(
      [...RELATIONSHIP_EDGE_FIELD_KEYS].sort()
    );
  });

  it("canonicalizes co_seen entity order and keeps resolved_from directed", () => {
    expect(
      canonicalizeRelationshipEdgeEntities({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:a.example",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
      })
    ).toEqual({
      entityA: "domain:a.example",
      entityB: "ipv4:1.1.1.1",
    });

    expect(
      canonicalizeRelationshipEdgeEntities({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:a.example",
        relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      })
    ).toEqual({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:a.example",
    });

    const directed = createRelationshipEdge({
      entityA: "sha256:abc",
      entityB: "domain:cdn.example",
      relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      sessionIds: ["vera5-inv-1"],
      firstSeen: 10,
      lastSeen: 20,
    });
    expect(directed.entityA).toBe("sha256:abc");
    expect(directed.entityB).toBe("domain:cdn.example");
  });

  it("builds a stable edge id for the same co_seen pair regardless of input order", () => {
    const left = buildRelationshipEdgeId({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
    });
    const right = buildRelationshipEdgeId({
      entityA: "domain:example.com",
      entityB: "ipv4:8.8.8.8",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
    });
    expect(left).toBe(right);
    expect(left).toMatch(/^re-[0-9a-f]+-co_seen$/);
  });

  it("defaults weight and timestamps when omitted", () => {
    const before = Date.now();
    const edge = createRelationshipEdge({
      entityA: "ipv4:9.9.9.9",
      entityB: "domain:dns.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-1"],
    });
    const after = Date.now();
    expect(edge.weight).toBe(DEFAULT_RELATIONSHIP_EDGE_WEIGHT);
    expect(edge.firstSeen).toBeGreaterThanOrEqual(before);
    expect(edge.firstSeen).toBeLessThanOrEqual(after);
    expect(edge.lastSeen).toBe(edge.firstSeen);
  });

  it("rejects invalid type, empty entities, self-edge, empty sessions, inverted timestamps, bad weight", () => {
    expect(() =>
      createRelationshipEdge({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:x.example",
        relationship: "linked",
        sessionIds: ["vera5-inv-1"],
      })
    ).toThrow(/Relationship edge type/);

    expect(() =>
      createRelationshipEdge({
        entityA: "  ",
        entityB: "domain:x.example",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: ["vera5-inv-1"],
      })
    ).toThrow(/distinct non-empty entity/);

    expect(() =>
      createRelationshipEdge({
        entityA: "ipv4:1.1.1.1",
        entityB: "ipv4:1.1.1.1",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: ["vera5-inv-1"],
      })
    ).toThrow(/distinct non-empty entity/);

    expect(() =>
      createRelationshipEdge({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:x.example",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: [],
      })
    ).toThrow(/sessionIds/);

    expect(() =>
      createRelationshipEdge({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:x.example",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: ["vera5-inv-1"],
        firstSeen: 200,
        lastSeen: 100,
      })
    ).toThrow(/lastSeen must be >= firstSeen/);

    expect(() =>
      createRelationshipEdge({
        entityA: "ipv4:1.1.1.1",
        entityB: "domain:x.example",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: ["vera5-inv-1"],
        weight: Number.NaN,
      })
    ).toThrow(/weight/);
  });

  it("normalizes valid edges and rejects unknown fields or bad shapes", () => {
    const created = createRelationshipEdge({
      entityA: "domain:b.example",
      entityB: "ipv4:2.2.2.2",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-2", "vera5-inv-2", "vera5-inv-1"],
      firstSeen: 50,
      lastSeen: 60,
      weight: 3,
      edgeId: "re-custom",
    });

    expect(normalizeRelationshipEdge(created)).toEqual(created);
    expect(created.sessionIds).toEqual(["vera5-inv-1", "vera5-inv-2"]);

    expect(
      normalizeRelationshipEdge({
        ...created,
        extra: true,
      })
    ).toBeNull();

    expect(
      normalizeRelationshipEdge({
        ...created,
        schemaVersion: 99,
      })
    ).toBeNull();

    expect(
      normalizeRelationshipEdge({
        ...created,
        relationship: "friend",
      })
    ).toBeNull();

    expect(normalizeRelationshipEdge(null)).toBeNull();
    expect(normalizeRelationshipEntityKey("  ipv4:1.1.1.1  ")).toBe(
      "ipv4:1.1.1.1"
    );
    expect(normalizeRelationshipEntityKey("")).toBeNull();
    expect(normalizeRelationshipEdgeSessionIds([" a ", "a", "b"])).toEqual([
      "a",
      "b",
    ]);
    expect(normalizeRelationshipEdgeSessionIds([])).toBeNull();
  });
});

describe("RelationshipEdge builders from session scan / enrich", () => {
  it("filters eligible IP / domain / hash keys and parses member keys", () => {
    expect(isRelationshipEdgeEligibleIocType("ipv4")).toBe(true);
    expect(isRelationshipEdgeEligibleIocType("url")).toBe(false);
    expect(parseRelationshipEntityKey("domain:Example.COM")).toEqual({
      iocType: "domain",
      value: expect.any(String),
    });
    expect(
      filterRelationshipEligibleEntityKeys([
        "ipv4:1.1.1.1",
        "url:https://evil.example/path",
        "cve:CVE-2024-0001",
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "ipv4:1.1.1.1",
      ])
    ).toEqual([
      "ipv4:1.1.1.1",
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
  });

  it("builds co_seen edges for co-detected IP / domain / hash on one session scan", () => {
    const edges = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-scan",
      memberIocKeys: [
        "ipv4:8.8.8.8",
        "domain:example.com",
        "md5:0123456789abcdef0123456789abcdef",
        "url:https://example.com/phish",
        "cve:CVE-2024-1",
      ],
      firstSeen: 100,
      lastSeen: 200,
    });

    expect(edges).toHaveLength(3);
    expect(edges.every((edge) => edge.relationship === "co_seen")).toBe(true);
    expect(
      edges.every(
        (edge) =>
          edge.sessionIds.length === 1 && edge.sessionIds[0] === "vera5-inv-scan"
      )
    ).toBe(true);
    expect(
      edges
        .map((edge) => [edge.entityA, edge.entityB] as const)
        .sort((left, right) =>
          `${left[0]}\0${left[1]}`.localeCompare(`${right[0]}\0${right[1]}`)
        )
    ).toEqual([
      ["domain:example.com", "ipv4:8.8.8.8"],
      ["domain:example.com", "md5:0123456789abcdef0123456789abcdef"],
      ["ipv4:8.8.8.8", "md5:0123456789abcdef0123456789abcdef"],
    ]);
  });

  it("extracts URL host and builds resolved_from pivot edges", () => {
    expect(
      extractRelationshipHostEntityKeyFromUrlValue("hxxps://Evil.Example/path")
    ).toBe("domain:evil.example");

    const edges = buildResolvedFromRelationshipEdgesFromSessionScanUrls({
      sessionId: "vera5-inv-url",
      memberIocKeys: [
        "url:https://cdn.example/payload",
        "ipv4:203.0.113.10",
        "sha1:0123456789abcdef0123456789abcdef01234567",
        "domain:cdn.example",
      ],
      firstSeen: 10,
      lastSeen: 20,
    });

    expect(edges.every((edge) => edge.relationship === "resolved_from")).toBe(
      true
    );
    expect(
      edges.some(
        (edge) =>
          edge.entityA === "ipv4:203.0.113.10" &&
          edge.entityB === "domain:cdn.example"
      )
    ).toBe(true);
    expect(
      edges.some(
        (edge) =>
          edge.entityA ===
            "sha1:0123456789abcdef0123456789abcdef01234567" &&
          edge.entityB === "domain:cdn.example"
      )
    ).toBe(true);
    expect(
      edges.some((edge) => edge.entityA === "domain:cdn.example")
    ).toBe(false);
  });

  it("builds resolved_from edges from enrich pivot hints", () => {
    const edges = buildResolvedFromRelationshipEdgesFromEnrichPivots([
      {
        sessionId: "vera5-inv-enrich",
        subjectEntityKey: "ipv4:198.51.100.1",
        relatedEntityKeys: ["domain:dns.example", "cve:CVE-2020-1", "ipv4:198.51.100.1"],
        seenAt: 55,
      },
    ]);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      entityA: "ipv4:198.51.100.1",
      entityB: "domain:dns.example",
      relationship: "resolved_from",
      sessionIds: ["vera5-inv-enrich"],
      firstSeen: 55,
      lastSeen: 55,
    });
  });

  it("combines scan co_seen, URL pivots, and enrich pivots", () => {
    const edges = buildRelationshipEdgesFromSessionScanAndEnrichEvents({
      scan: {
        sessionId: "vera5-inv-combo",
        memberIocKeys: [
          "ipv4:1.2.3.4",
          "domain:host.example",
          "url:https://host.example/a",
        ],
        firstSeen: 1,
        lastSeen: 2,
      },
      enrichPivots: [
        {
          sessionId: "vera5-inv-combo",
          subjectEntityKey: "ipv4:1.2.3.4",
          relatedEntityKeys: ["domain:extra.example"],
          seenAt: 3,
        },
      ],
    });

    expect(edges.some((edge) => edge.relationship === "co_seen")).toBe(true);
    expect(
      edges.some(
        (edge) =>
          edge.relationship === "resolved_from" &&
          edge.entityB === "domain:host.example"
      )
    ).toBe(true);
    expect(
      edges.some(
        (edge) =>
          edge.relationship === "resolved_from" &&
          edge.entityB === "domain:extra.example"
      )
    ).toBe(true);
    expect(buildRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-combo",
      memberIocKeys: ["ipv4:1.2.3.4"],
    })).toEqual([]);
  });

  it("respects max co_seen pair cap", () => {
    const edges = buildCoSeenRelationshipEdgesFromSessionScan(
      {
        sessionId: "vera5-inv-cap",
        memberIocKeys: [
          "ipv4:1.1.1.1",
          "ipv4:2.2.2.2",
          "ipv4:3.3.3.3",
          "domain:a.example",
        ],
      },
      { maxCoSeenPairsPerSession: 2 }
    );
    expect(edges).toHaveLength(2);
  });
});

describe("RelationshipEdge merge across sessions", () => {
  it("normalizes configurable min co-occurrence count", () => {
    expect(normalizeRelationshipEdgeMinCoOccurrenceCount(undefined)).toBe(
      DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT
    );
    expect(normalizeRelationshipEdgeMinCoOccurrenceCount(3)).toBe(3);
    expect(normalizeRelationshipEdgeMinCoOccurrenceCount(0)).toBe(1);
    expect(normalizeRelationshipEdgeMinCoOccurrenceCount(Number.NaN)).toBe(
      DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT
    );
  });

  it("merges a pair: unions sessions, expands timestamps, weight = co-occurrence", () => {
    const left = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a"],
      firstSeen: 100,
      lastSeen: 150,
      weight: 1,
    });
    const right = createRelationshipEdge({
      entityA: "domain:example.com",
      entityB: "ipv4:8.8.8.8",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-b", "vera5-inv-a"],
      firstSeen: 50,
      lastSeen: 200,
      weight: 1,
    });

    const merged = mergeRelationshipEdgePair(left, right);
    expect(merged.sessionIds).toEqual(["vera5-inv-a", "vera5-inv-b"]);
    expect(merged.firstSeen).toBe(50);
    expect(merged.lastSeen).toBe(200);
    expect(relationshipEdgeCoOccurrenceCount(merged)).toBe(2);
    expect(merged.weight).toBe(2);
    expect(merged.edgeId).toBe(
      buildRelationshipEdgeId({
        entityA: "domain:example.com",
        entityB: "ipv4:8.8.8.8",
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
      })
    );
  });

  it("rejects merge of mismatched entity pairs or relationship types", () => {
    const left = createRelationshipEdge({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:a.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-1"],
      firstSeen: 1,
      lastSeen: 1,
    });
    const right = createRelationshipEdge({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:b.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-2"],
      firstSeen: 2,
      lastSeen: 2,
    });
    expect(() => mergeRelationshipEdgePair(left, right)).toThrow(/matching relationship/);

    const directed = createRelationshipEdge({
      entityA: "ipv4:1.1.1.1",
      entityB: "domain:a.example",
      relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      sessionIds: ["vera5-inv-2"],
      firstSeen: 2,
      lastSeen: 2,
    });
    expect(() => mergeRelationshipEdgePair(left, directed)).toThrow(
      /matching relationship/
    );
  });

  it("merges across sessions and filters by default min co-occurrence (2)", () => {
    const sessionA = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-a",
      memberIocKeys: ["ipv4:1.1.1.1", "domain:shared.example", "md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      firstSeen: 10,
      lastSeen: 20,
    });
    const sessionB = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-b",
      memberIocKeys: ["ipv4:1.1.1.1", "domain:shared.example"],
      firstSeen: 30,
      lastSeen: 40,
    });
    const sessionCOnly = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-c",
      memberIocKeys: ["ipv4:9.9.9.9", "domain:alone.example"],
      firstSeen: 50,
      lastSeen: 60,
    });

    const merged = mergeRelationshipEdgesAcrossSessions([
      ...sessionA,
      ...sessionB,
      ...sessionCOnly,
    ]);

    expect(
      merged.every(
        (edge) =>
          relationshipEdgeCoOccurrenceCount(edge) >=
          DEFAULT_RELATIONSHIP_EDGE_MIN_CO_OCCURRENCE_COUNT
      )
    ).toBe(true);
    expect(
      merged.some(
        (edge) =>
          edge.entityA === "domain:shared.example" &&
          edge.entityB === "ipv4:1.1.1.1" &&
          edge.sessionIds.includes("vera5-inv-a") &&
          edge.sessionIds.includes("vera5-inv-b") &&
          edge.weight === 2
      )
    ).toBe(true);
    expect(
      merged.some(
        (edge) =>
          edge.entityA === "domain:alone.example" ||
          edge.entityB === "domain:alone.example"
      )
    ).toBe(false);
  });

  it("keeps single-session edges when min co-occurrence is set to 1", () => {
    const edges = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: "vera5-inv-solo",
      memberIocKeys: ["ipv4:1.1.1.1", "domain:solo.example"],
      firstSeen: 1,
      lastSeen: 2,
    });
    expect(mergeRelationshipEdgesAcrossSessions(edges)).toEqual([]);
    expect(
      mergeRelationshipEdgesAcrossSessions(edges, { minCoOccurrenceCount: 1 })
    ).toHaveLength(1);
  });

  it("keeps resolved_from direction distinct from co_seen for the same entity pair", () => {
    const coSeen = createRelationshipEdge({
      entityA: "ipv4:203.0.113.1",
      entityB: "domain:pivot.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-1"],
      firstSeen: 1,
      lastSeen: 1,
    });
    const coSeen2 = createRelationshipEdge({
      entityA: "ipv4:203.0.113.1",
      entityB: "domain:pivot.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-2"],
      firstSeen: 2,
      lastSeen: 2,
    });
    const resolved = createRelationshipEdge({
      entityA: "ipv4:203.0.113.1",
      entityB: "domain:pivot.example",
      relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      sessionIds: ["vera5-inv-1"],
      firstSeen: 1,
      lastSeen: 1,
    });
    const resolved2 = createRelationshipEdge({
      entityA: "ipv4:203.0.113.1",
      entityB: "domain:pivot.example",
      relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      sessionIds: ["vera5-inv-2"],
      firstSeen: 2,
      lastSeen: 2,
    });

    const merged = mergeRelationshipEdgesAcrossSessions([
      coSeen,
      coSeen2,
      resolved,
      resolved2,
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.filter((edge) => edge.relationship === "co_seen")).toHaveLength(
      1
    );
    expect(
      merged.filter((edge) => edge.relationship === "resolved_from")
    ).toHaveLength(1);
  });
});

describe("RelationshipEdge known-good policy", () => {
  const cdnIp = createKnownGoodEntry({
    category: KNOWN_GOOD_CATEGORY.CDN,
    matchType: KNOWN_GOOD_MATCH_TYPE.IP,
    pattern: "1.1.1.1",
    labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
  });
  const saasDomain = createKnownGoodEntry({
    category: KNOWN_GOOD_CATEGORY.SAAS,
    matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
    pattern: "cdn.cloudflare.com",
    labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
  });

  const investigationEdge = createRelationshipEdge({
    entityA: "ipv4:185.220.101.1",
    entityB: "domain:evil.example",
    relationship: RELATIONSHIP_TYPE.CO_SEEN,
    sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    firstSeen: 10,
    lastSeen: 20,
    weight: 2,
  });
  const knownGoodEdge = createRelationshipEdge({
    entityA: "ipv4:1.1.1.1",
    entityB: "domain:cdn.cloudflare.com",
    relationship: RELATIONSHIP_TYPE.CO_SEEN,
    sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    firstSeen: 10,
    lastSeen: 20,
    weight: 2,
  });
  const mixedEdge = createRelationshipEdge({
    entityA: "ipv4:1.1.1.1",
    entityB: "domain:evil.example",
    relationship: RELATIONSHIP_TYPE.CO_SEEN,
    sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    firstSeen: 10,
    lastSeen: 20,
    weight: 2,
  });

  it("defaults policy to off and recognizes policy values", () => {
    expect(normalizeRelationshipEdgeKnownGoodPolicy(undefined)).toBe(
      DEFAULT_RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY
    );
    expect(normalizeRelationshipEdgeKnownGoodPolicy("exclude")).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE
    );
    expect(normalizeRelationshipEdgeKnownGoodPolicy("down_rank")).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK
    );
    expect(normalizeRelationshipEdgeKnownGoodPolicy("drop")).toBe(
      RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF
    );
    expect(isRelationshipEdgeKnownGoodPolicy("off")).toBe(true);
    expect(isRelationshipEdgeKnownGoodPolicy("ban")).toBe(false);
  });

  it("matches known-good entity keys and edges involving those entities", () => {
    expect(
      relationshipEntityKeyMatchesKnownGood("ipv4:1.1.1.1", [cdnIp])
    ).toBe(true);
    expect(
      relationshipEntityKeyMatchesKnownGood("ipv4:185.220.101.1", [cdnIp])
    ).toBe(false);
    expect(
      relationshipEdgeInvolvesKnownGoodEntity(knownGoodEdge, [cdnIp, saasDomain])
    ).toBe(true);
    expect(
      relationshipEdgeInvolvesKnownGoodEntity(mixedEdge, [cdnIp])
    ).toBe(true);
    expect(
      relationshipEdgeInvolvesKnownGoodEntity(investigationEdge, [cdnIp, saasDomain])
    ).toBe(false);
  });

  it("leaves edges unchanged when policy is off", () => {
    const edges = [knownGoodEdge, investigationEdge];
    expect(
      applyRelationshipEdgeKnownGoodPolicy(edges, {
        policy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF,
        knownGoodEntries: [cdnIp, saasDomain],
      })
    ).toEqual(edges);
  });

  it("excludes edges involving known-good entities when exclude policy is enabled", () => {
    const result = applyRelationshipEdgeKnownGoodPolicy(
      [investigationEdge, knownGoodEdge, mixedEdge],
      {
        policy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
        knownGoodEntries: [cdnIp, saasDomain],
      }
    );
    expect(result).toEqual([investigationEdge]);
  });

  it("down-ranks edges involving known-good entities when down_rank policy is enabled", () => {
    const result = applyRelationshipEdgeKnownGoodPolicy(
      [knownGoodEdge, investigationEdge, mixedEdge],
      {
        policy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK,
        knownGoodEntries: [cdnIp],
      }
    );
    expect(result.map((edge) => edge.edgeId)).toEqual([
      investigationEdge.edgeId,
      knownGoodEdge.edgeId,
      mixedEdge.edgeId,
    ]);
  });

  it("does not apply exclude/down-rank when known-good list is empty", () => {
    const edges = [knownGoodEdge, investigationEdge];
    expect(
      applyRelationshipEdgeKnownGoodPolicy(edges, {
        policy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
        knownGoodEntries: [],
      })
    ).toEqual(edges);
  });
});
