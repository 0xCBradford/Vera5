import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOISE_RULE_ID_PREFIX,
  NOISE_RULE_LEARN_CONFIRM_MESSAGE,
  NOISE_RULE_PATTERN_TYPE,
  NOISE_RULE_SCHEMA_VERSION,
  NOISE_RULE_SOURCE_ACTION,
  buildNoiseRuleDetailView,
  buildNoiseRuleId,
  buildNoiseRuleHoverMatchView,
  buildNoiseRuleSampleAlertMatchPreview,
  buildNoiseRulesOptionsHash,
  buildSocDashboardNoiseStarterRules,
  clearLearnedNoiseRules,
  confirmLearnNoiseRule,
  createNoiseRule,
  createNoiseRuleFromWatchlistLabel,
  findMatchingNoiseRule,
  forgetLearnedNoiseRule,
  formatNoiseRuleSummary,
  formatNoiseRulesTraySuppressedSummary,
  filterScanMatchesByNoiseRules,
  filterNoiseRulesBySearch,
  HIDE_SUPPRESSED_FROM_SCAN_DEFAULT,
  isNoiseRulePatternType,
  isNoiseRuleSourceAction,
  listLearnedNoiseRules,
  noiseRuleMatchesValue,
  noiseRuleSourceActionFromIocLabel,
  normalizeNoiseRule,
  NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH,
  NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES,
  partitionTrayEntriesByNoiseRules,
  parseNoiseRulesOptionsHash,
  rememberLearnedNoiseRule,
  recordLastLearnedNoiseRuleUndo,
  peekLastLearnedNoiseRuleUndo,
  consumeLastLearnedNoiseRuleUndo,
  shouldOfferNoiseRuleLearnForLabel,
  SOC_DASHBOARD_NOISE_STARTER_SPECS,
} from "./noiseRule";

describe("noiseRule schema", () => {
  afterEach(() => {
    clearLearnedNoiseRules();
  });
  it("exposes required pattern types and source actions", () => {
    expect(isNoiseRulePatternType("exact")).toBe(true);
    expect(isNoiseRulePatternType("regex")).toBe(true);
    expect(isNoiseRulePatternType("domain-suffix")).toBe(true);
    expect(isNoiseRulePatternType("cidr")).toBe(true);
    expect(isNoiseRulePatternType("glob")).toBe(false);

    expect(isNoiseRuleSourceAction("suppress")).toBe(true);
    expect(isNoiseRuleSourceAction("internal")).toBe(true);
    expect(isNoiseRuleSourceAction("benign")).toBe(true);
    expect(isNoiseRuleSourceAction("case-important")).toBe(false);
  });

  it("maps watchlist labels to noise source actions", () => {
    expect(noiseRuleSourceActionFromIocLabel("suppress-false-positive")).toBe(
      NOISE_RULE_SOURCE_ACTION.SUPPRESS
    );
    expect(noiseRuleSourceActionFromIocLabel("internal")).toBe(
      NOISE_RULE_SOURCE_ACTION.INTERNAL
    );
    expect(noiseRuleSourceActionFromIocLabel("benign")).toBe(
      NOISE_RULE_SOURCE_ACTION.BENIGN
    );
    expect(noiseRuleSourceActionFromIocLabel("case-important")).toBeNull();
    expect(noiseRuleSourceActionFromIocLabel(null)).toBeNull();
  });

  it("creates a rule with id, pattern type, pattern, source action, createdAt, hitCount", () => {
    const rule = createNoiseRule({
      id: "nr-test-exact",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.8.8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1_700_000_000_000,
      hitCount: 3,
    });

    expect(rule).toEqual({
      schemaVersion: NOISE_RULE_SCHEMA_VERSION,
      id: "nr-test-exact",
      patternType: "exact",
      pattern: "8.8.8.8",
      sourceAction: "suppress",
      createdAt: 1_700_000_000_000,
      hitCount: 3,
      enabled: true,
    });
  });

  it("defaults hitCount to 0 and builds a stable id when omitted", () => {
    const first = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
      pattern: ".corp.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 1_700_000_000_000,
    });
    const second = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
      pattern: ".corp.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 1_700_000_000_001,
    });

    expect(first.hitCount).toBe(0);
    expect(first.id.startsWith(NOISE_RULE_ID_PREFIX)).toBe(true);
    expect(first.id).toBe(second.id);
    expect(
      buildNoiseRuleId({
        patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
        pattern: ".corp.example",
        sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      })
    ).toBe(first.id);
  });

  it("normalizes valid records and rejects invalid shapes", () => {
    const valid = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "10.0.0.0/8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 1_700_000_000_000,
      hitCount: 1,
    });
    expect(normalizeNoiseRule(valid)).toEqual(valid);
    expect(normalizeNoiseRule({ ...valid, pattern: "  10.0.0.0/8  " })).toEqual(
      valid
    );

    expect(normalizeNoiseRule(null)).toBeNull();
    expect(normalizeNoiseRule({ ...valid, schemaVersion: 99 })).toBeNull();
    expect(normalizeNoiseRule({ ...valid, patternType: "glob" })).toBeNull();
    expect(normalizeNoiseRule({ ...valid, sourceAction: "case-important" })).toBeNull();
    expect(normalizeNoiseRule({ ...valid, pattern: "   " })).toBeNull();
    expect(normalizeNoiseRule({ ...valid, hitCount: -1 })).toBeNull();
    expect(normalizeNoiseRule({ ...valid, createdAt: Number.NaN })).toBeNull();
  });

  it("rejects create inputs that violate the schema", () => {
    expect(() =>
      createNoiseRule({
        patternType: NOISE_RULE_PATTERN_TYPE.REGEX,
        pattern: "",
        sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      })
    ).toThrow(/non-empty pattern/i);

    expect(() =>
      createNoiseRule({
        patternType: NOISE_RULE_PATTERN_TYPE.REGEX,
        pattern: ".*\\.local$",
        sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
        hitCount: -2,
      })
    ).toThrow(/hitCount/i);
  });

  it("formats a human-readable summary without hidden weights", () => {
    const rule = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
      hitCount: 4,
    });
    expect(formatNoiseRuleSummary(rule)).toBe(
      "Suppress false positive · Exact match · noise.example (hits: 4)"
    );
  });

  it("builds inspectable Options detail fields without weight vectors", () => {
    const rule = createNoiseRule({
      id: "nr-detail",
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "10.0.0.0/8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 1_700_000_000_000,
      hitCount: 2,
    });
    const detail = buildNoiseRuleDetailView(rule);
    expect(detail).toEqual({
      summary: "Internal · IPv4 CIDR · 10.0.0.0/8 (hits: 2)",
      sourceActionLabel: "Internal",
      patternTypeLabel: "IPv4 CIDR",
      pattern: "10.0.0.0/8",
      hitCountLabel: "2",
      createdAtLabel: new Date(1_700_000_000_000).toISOString(),
      enabled: true,
      enabledLabel: "Enabled",
      id: "nr-detail",
    });
    expect(JSON.stringify(detail)).not.toMatch(/weight/i);
  });

  it("matches exact, regex, domain-suffix, and cidr patterns", () => {
    const exact = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
    });
    expect(noiseRuleMatchesValue(exact, "Noise.Example")).toBe(true);
    expect(noiseRuleMatchesValue(exact, "other.example")).toBe(false);

    const regex = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.REGEX,
      pattern: "^cdn[0-9]+\\.noise\\.test$",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 2,
    });
    expect(noiseRuleMatchesValue(regex, "cdn12.noise.test")).toBe(true);
    expect(noiseRuleMatchesValue(regex, "cdn.noise.test")).toBe(false);

    const badRegex = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.REGEX,
      pattern: "[unterminated",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 3,
    });
    expect(noiseRuleMatchesValue(badRegex, "anything")).toBe(false);

    const suffix = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
      pattern: ".corp.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 4,
    });
    expect(noiseRuleMatchesValue(suffix, "mail.corp.example")).toBe(true);
    expect(noiseRuleMatchesValue(suffix, "corp.example")).toBe(true);
    expect(noiseRuleMatchesValue(suffix, "https://vpn.corp.example/path")).toBe(true);
    expect(noiseRuleMatchesValue(suffix, "corp.example.evil")).toBe(false);

    const cidr = createNoiseRule({
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "10.0.0.0/8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
      createdAt: 5,
    });
    expect(noiseRuleMatchesValue(cidr, "10.1.2.3")).toBe(true);
    expect(noiseRuleMatchesValue(cidr, "11.0.0.1")).toBe(false);
  });

  it("partitions tray entries into active and suppressed buckets", () => {
    const suppressRule = createNoiseRule({
      id: "nr-suppress-exact",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
    });
    const entries = [
      { value: "8.8.8.8", anchorId: "a" },
      { value: "noise.example", anchorId: "b" },
      { value: "example.com", anchorId: "c" },
    ];
    const partitioned = partitionTrayEntriesByNoiseRules(entries, [suppressRule]);
    expect(partitioned.active.map((entry) => entry.anchorId)).toEqual(["a", "c"]);
    expect(partitioned.suppressed).toHaveLength(1);
    expect(partitioned.suppressed[0]?.entry.anchorId).toBe("b");
    expect(partitioned.suppressed[0]?.matchedRule.id).toBe("nr-suppress-exact");
    expect(findMatchingNoiseRule([suppressRule], "noise.example")?.id).toBe(
      "nr-suppress-exact"
    );
    expect(formatNoiseRulesTraySuppressedSummary(2)).toBe("Suppressed (2)");
  });

  it("keeps scan matches by default and omits them only when hide-suppressed is on", () => {
    expect(HIDE_SUPPRESSED_FROM_SCAN_DEFAULT).toBe(false);
    const suppressRule = createNoiseRule({
      id: "nr-scan-filter",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
    });
    const matches = [
      { value: "8.8.8.8" },
      { value: "noise.example" },
      { value: "example.com" },
    ];
    expect(
      filterScanMatchesByNoiseRules(matches, [suppressRule], false).map((entry) => entry.value)
    ).toEqual(["8.8.8.8", "noise.example", "example.com"]);
    expect(
      filterScanMatchesByNoiseRules(matches, [suppressRule], true).map((entry) => entry.value)
    ).toEqual(["8.8.8.8", "example.com"]);
  });

  it("builds hover match view and Options deep-link hash for a matched rule", () => {
    const rule = createNoiseRule({
      id: "nr-hover-link",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
      hitCount: 1,
    });
    const view = buildNoiseRuleHoverMatchView(rule);
    expect(view.badgeLabel).toBe("Deprioritized");
    expect(view.ruleId).toBe("nr-hover-link");
    expect(view.ruleSummary).toContain("Suppress false positive");
    expect(view.viewRuleLabel).toBe("View matched noise rule");
    expect(buildNoiseRulesOptionsHash(rule.id)).toBe("#noise-rules/nr-hover-link");
    expect(parseNoiseRulesOptionsHash("#noise-rules/nr-hover-link")).toEqual({
      section: "noise-rules",
      ruleId: "nr-hover-link",
    });
    expect(parseNoiseRulesOptionsHash("#noise-rules")).toEqual({
      section: "noise-rules",
      ruleId: null,
    });
    expect(parseNoiseRulesOptionsHash("#backup")).toBeNull();
  });

  it("creates an exact rule from a watchlist label only when opted in", () => {
    expect(
      createNoiseRuleFromWatchlistLabel({
        iocValue: "8.8.8.8",
        label: "suppress-false-positive",
        learnNoiseRule: false,
      })
    ).toBeNull();

    expect(shouldOfferNoiseRuleLearnForLabel("case-important")).toBe(false);
    expect(shouldOfferNoiseRuleLearnForLabel("benign")).toBe(true);

    const rule = createNoiseRuleFromWatchlistLabel({
      iocValue: " 8.8.8.8 ",
      label: "suppress-false-positive",
      learnNoiseRule: true,
      createdAt: 1_700_000_000_000,
    });
    expect(rule).toMatchObject({
      patternType: "exact",
      pattern: "8.8.8.8",
      sourceAction: "suppress",
      hitCount: 0,
      createdAt: 1_700_000_000_000,
    });

    clearLearnedNoiseRules();
    const remembered = rememberLearnedNoiseRule(rule!);
    expect(listLearnedNoiseRules()).toEqual([remembered]);
    expect(rememberLearnedNoiseRule({ ...rule!, hitCount: 9 })).toEqual(remembered);
  });

  it("ships an optional SOC dashboard noise starter without applying it", () => {
    expect(listLearnedNoiseRules()).toEqual([]);
    const rules = buildSocDashboardNoiseStarterRules();
    expect(rules.length).toBe(SOC_DASHBOARD_NOISE_STARTER_SPECS.length);
    expect(rules.every((rule) => rule.id.startsWith("nr-starter-soc-"))).toBe(true);
    expect(rules.every((rule) => rule.enabled)).toBe(true);
    expect(rules.some((rule) => rule.pattern === "8.8.8.8")).toBe(true);
    expect(rules.some((rule) => rule.pattern === "10.0.0.0/8")).toBe(true);
    expect(listLearnedNoiseRules()).toEqual([]);
  });

  it("searches rules and skips disabled matches", () => {
    const enabled = createNoiseRule({
      id: "nr-on",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
    });
    const disabled = createNoiseRule({
      id: "nr-off",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "noise.example",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 2,
      enabled: false,
    });
    expect(filterNoiseRulesBySearch([enabled, disabled], "benign")).toEqual([disabled]);
    expect(findMatchingNoiseRule([disabled, enabled], "noise.example")?.id).toBe("nr-on");
    expect(findMatchingNoiseRule([disabled], "noise.example")).toBeNull();
  });

  it("confirmLearnNoiseRule delegates to window.confirm", () => {
    const confirm = vi.fn(() => true);
    expect(confirmLearnNoiseRule({ confirm })).toBe(true);
    expect(confirm).toHaveBeenCalledWith(NOISE_RULE_LEARN_CONFIRM_MESSAGE);
  });

  it("previews sample-alert matches offline without mutating a live page", () => {
    expect(NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH).toBe("examples/sample-alert.html");
    expect(NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES).toContain("8.8.8.8");
    expect(NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES).toContain("192.0.2.1");

    const empty = buildNoiseRuleSampleAlertMatchPreview([]);
    expect(empty.mutatesLivePage).toBe(false);
    expect(empty.fixturePath).toBe(NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH);
    expect(empty.indicatorCount).toBe(NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES.length);
    expect(empty.matched).toEqual([]);
    expect(empty.activeValues).toEqual([...NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES]);

    const suppressPublicDns = createNoiseRule({
      id: "nr-preview-8888",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.8.8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 1,
    });
    const disabled = createNoiseRule({
      id: "nr-preview-disabled",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "192.0.2.1",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 2,
      enabled: false,
    });
    const preview = buildNoiseRuleSampleAlertMatchPreview([suppressPublicDns, disabled]);
    expect(preview.mutatesLivePage).toBe(false);
    expect(preview.matched.map((row) => row.value)).toEqual(["8.8.8.8"]);
    expect(preview.matched[0]?.matchedRule.id).toBe("nr-preview-8888");
    expect(preview.activeValues).toContain("192.0.2.1");
    expect(preview.activeValues).not.toContain("8.8.8.8");

    const starterPreview = buildNoiseRuleSampleAlertMatchPreview(
      buildSocDashboardNoiseStarterRules()
    );
    expect(starterPreview.mutatesLivePage).toBe(false);
    expect(starterPreview.matched.some((row) => row.value === "8.8.8.8")).toBe(true);
  });

  it("tracks a single-step undo slot for the last learned rule", () => {
    const first = createNoiseRule({
      id: "nr-undo-a",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.8.8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
      createdAt: 1,
    });
    const second = createNoiseRule({
      id: "nr-undo-b",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "1.1.1.1",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
      createdAt: 2,
    });
    recordLastLearnedNoiseRuleUndo(first);
    expect(peekLastLearnedNoiseRuleUndo()?.id).toBe("nr-undo-a");
    recordLastLearnedNoiseRuleUndo(second);
    expect(peekLastLearnedNoiseRuleUndo()?.id).toBe("nr-undo-b");
    expect(consumeLastLearnedNoiseRuleUndo()?.id).toBe("nr-undo-b");
    expect(peekLastLearnedNoiseRuleUndo()).toBeNull();
    forgetLearnedNoiseRule("nr-undo-a");
    recordLastLearnedNoiseRuleUndo(first);
    forgetLearnedNoiseRule("nr-undo-a");
    expect(peekLastLearnedNoiseRuleUndo()).toBeNull();
  });
});

describe("noise rule unit coverage: watchlist create, pattern match, collapse", () => {
  afterEach(() => {
    clearLearnedNoiseRules();
  });

  it("creates exact rules from benign, internal, and suppress watchlist actions", () => {
    const benign = createNoiseRuleFromWatchlistLabel({
      iocValue: "1.1.1.1",
      label: "benign",
      learnNoiseRule: true,
      createdAt: 10,
    });
    expect(benign).toMatchObject({
      patternType: "exact",
      pattern: "1.1.1.1",
      sourceAction: "benign",
      hitCount: 0,
      enabled: true,
      createdAt: 10,
    });

    const internal = createNoiseRuleFromWatchlistLabel({
      iocValue: "intranet.corp.example",
      label: "internal",
      learnNoiseRule: true,
      createdAt: 11,
    });
    expect(internal).toMatchObject({
      patternType: "exact",
      pattern: "intranet.corp.example",
      sourceAction: "internal",
      hitCount: 0,
      enabled: true,
    });

    const suppress = createNoiseRuleFromWatchlistLabel({
      iocValue: "noise.example",
      label: "suppress-false-positive",
      learnNoiseRule: true,
      createdAt: 12,
    });
    expect(suppress).toMatchObject({
      patternType: "exact",
      pattern: "noise.example",
      sourceAction: "suppress",
    });

    expect(
      createNoiseRuleFromWatchlistLabel({
        iocValue: "noise.example",
        label: "case-important",
        learnNoiseRule: true,
      })
    ).toBeNull();
    expect(
      createNoiseRuleFromWatchlistLabel({
        iocValue: "   ",
        label: "benign",
        learnNoiseRule: true,
      })
    ).toBeNull();
  });

  it("matches candidate IOC values across supported pattern types", () => {
    const rules = [
      createNoiseRule({
        id: "nr-match-exact",
        patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
        pattern: "8.8.8.8",
        sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
        createdAt: 1,
      }),
      createNoiseRule({
        id: "nr-match-suffix",
        patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
        pattern: ".noise.test",
        sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
        createdAt: 2,
      }),
      createNoiseRule({
        id: "nr-match-cidr",
        patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
        pattern: "192.168.0.0/16",
        sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
        createdAt: 3,
      }),
      createNoiseRule({
        id: "nr-match-regex",
        patternType: NOISE_RULE_PATTERN_TYPE.REGEX,
        pattern: "^cdn[0-9]+\\.example\\.com$",
        sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
        createdAt: 4,
      }),
    ];

    expect(noiseRuleMatchesValue(rules[0]!, "8.8.8.8")).toBe(true);
    expect(noiseRuleMatchesValue(rules[1]!, "foo.noise.test")).toBe(true);
    expect(noiseRuleMatchesValue(rules[2]!, "192.168.10.5")).toBe(true);
    expect(noiseRuleMatchesValue(rules[3]!, "cdn7.example.com")).toBe(true);
    expect(noiseRuleMatchesValue(rules[0]!, "9.9.9.9")).toBe(false);

    expect(findMatchingNoiseRule(rules, "8.8.8.8")?.id).toBe("nr-match-exact");
    expect(findMatchingNoiseRule(rules, "bar.noise.test")?.id).toBe("nr-match-suffix");
    expect(findMatchingNoiseRule(rules, "192.168.1.1")?.id).toBe("nr-match-cidr");
    expect(findMatchingNoiseRule(rules, "cdn99.example.com")?.id).toBe("nr-match-regex");
    expect(findMatchingNoiseRule(rules, "unrelated.example")).toBeNull();
  });

  it("collapses matching tray rows into suppressed while preserving order", () => {
    const rules = [
      createNoiseRule({
        id: "nr-collapse-a",
        patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
        pattern: "noise.a",
        sourceAction: NOISE_RULE_SOURCE_ACTION.SUPPRESS,
        createdAt: 1,
      }),
      createNoiseRule({
        id: "nr-collapse-b",
        patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
        pattern: "noise.b",
        sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
        createdAt: 2,
      }),
      createNoiseRule({
        id: "nr-collapse-off",
        patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
        pattern: "noise.c",
        sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
        createdAt: 3,
        enabled: false,
      }),
    ];
    const entries = [
      { value: "active.one", order: 1 },
      { value: "noise.a", order: 2 },
      { value: "active.two", order: 3 },
      { value: "noise.b", order: 4 },
      { value: "noise.c", order: 5 },
    ];

    expect(partitionTrayEntriesByNoiseRules(entries, [])).toEqual({
      active: entries,
      suppressed: [],
    });

    const partitioned = partitionTrayEntriesByNoiseRules(entries, rules);
    expect(partitioned.active.map((entry) => entry.value)).toEqual([
      "active.one",
      "active.two",
      "noise.c",
    ]);
    expect(
      partitioned.suppressed.map(({ entry, matchedRule }) => [entry.value, matchedRule.id])
    ).toEqual([
      ["noise.a", "nr-collapse-a"],
      ["noise.b", "nr-collapse-b"],
    ]);
    expect(formatNoiseRulesTraySuppressedSummary(partitioned.suppressed.length)).toBe(
      "Suppressed (2)"
    );
  });
});
