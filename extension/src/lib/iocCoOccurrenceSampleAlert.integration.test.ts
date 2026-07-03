/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeVisibleTextAndAttributeIocMatches,
  type PageIocScanMatch,
} from "../content/attributeHrefExtractor";
import { setAutoEnrichmentFetcherForTests } from "../content/enrichmentAutoFetch";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "../content/enrichmentSourceStorage";
import { resolveMaxIocsPerScan, scanTextNodesForIocs } from "../content/detector";
import { highlightDetectedIocs } from "../content/highlighter";
import { HOVER_CARD_PANEL_CLASS } from "../content/hoverCardOverlay";
import { handleNavigateToIocAnchorRequest } from "../content/iocTrayNavigation";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "../content/manualOnlyStorage";
import {
  buildIocCoOccurrenceMemberKey,
  buildIocCoOccurrencePairKey,
  buildPageIocCoOccurrenceIndexFromSnapshot,
  countUniqueCoOccurrenceMembersFromSnapshot,
  IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL,
  IOC_CO_OCCURRENCE_SCHEMA_VERSION,
  listCoOccurrencePairsForKey,
  listCoOccurringMembersForKey,
} from "./iocCoOccurrence";
import { IOC_TYPE } from "./iocRegex";
import {
  buildTabScanSnapshotPayload,
  type TabScanSnapshotPayload,
} from "./tabScanSnapshot";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SAMPLE_ALERT_PAGE_URL = "http://localhost:8080/sample-alert.html";

const EXPECTED_SAMPLE_ALERT_IOC_VALUES = [
  "192.0.2.1",
  "8.8.8.8",
  "malware.testcategory.com",
  "https://example.com/login",
  "d41d8cd98f00b204e9800998ecf8427e",
  "098f6bcd4621d373cade4e832627b4f6",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "CVE-2021-44228",
  "CVE-2017-0144",
  "analyst@example.com",
] as const;

function loadSampleAlertFixture(): void {
  const html = readFileSync(join(repoRoot, "examples", "sample-alert.html"), "utf8");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
}

function buildSampleAlertScanMatches(): PageIocScanMatch[] {
  loadSampleAlertFixture();
  const textMatches = scanTextNodesForIocs(document.body);
  return mergeVisibleTextAndAttributeIocMatches(
    textMatches,
    [],
    resolveMaxIocsPerScan({})
  );
}

function stubContentChromeForNavigation(): void {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "test stub" }),
    },
    storage: {
      local: {
        get: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
              result[key] = true;
            }
            if (key === CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED) {
              result[key] = {
                abuseipdb: false,
                otx: false,
                urlscan: false,
                greynoise: false,
              };
            }
          }
          return Promise.resolve(result);
        },
      },
    },
  });
}

function findHighlightedIoc(value: string, type: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-vera5-anchor-id]")).find(
    (highlight) => highlight.dataset.vera5Value === value && highlight.dataset.vera5Type === type
  );
}

function buildSampleAlertSnapshotPayload(): TabScanSnapshotPayload {
  const matches = buildSampleAlertScanMatches();
  return buildTabScanSnapshotPayload({
    pageUrl: SAMPLE_ALERT_PAGE_URL,
    scannedAt: 1_700_000_000_000,
    entries: matches.map((match, index) => ({
      type: match.type,
      value: match.value,
      anchorId: `vera5-hl-${index + 1}`,
      ruleId: match.ruleId,
      sourceTextHint: match.sourceTextHint,
      ...(match.displayValue ? { displayValue: match.displayValue } : {}),
    })),
  });
}

describe("sample-alert.html co-occurrence pairs and groups", () => {
  beforeEach(() => {
    loadSampleAlertFixture();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("builds full same-page pair and group index from fixture scan", () => {
    const snapshot = buildSampleAlertSnapshotPayload();
    const index = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);

    const memberCount = countUniqueCoOccurrenceMembersFromSnapshot(snapshot);
    const expectedPairCount = (memberCount * (memberCount - 1)) / 2;

    expect(memberCount).toBeGreaterThanOrEqual(EXPECTED_SAMPLE_ALERT_IOC_VALUES.length);
    for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
      expect(index.members.some((member) => member.value === value)).toBe(true);
    }

    expect(index.schemaVersion).toBe(IOC_CO_OCCURRENCE_SCHEMA_VERSION);
    expect(index.pageUrl).toBe(SAMPLE_ALERT_PAGE_URL);
    expect(index.scannedAt).toBe(snapshot.scannedAt);
    expect(index.members).toHaveLength(memberCount);
    expect(index.pairs).toHaveLength(expectedPairCount);
    expect(index.computationCapped).toBeUndefined();
    expect(index.groups).toHaveLength(1);

    const group = index.groups[0]!;
    expect(group.contextLabel).toBe(IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL);
    expect(group.members).toHaveLength(memberCount);
    expect(group.memberKeys).toHaveLength(memberCount);
    expect(group.pairCount).toBe(expectedPairCount);
    expect(group.groupId).toContain(SAMPLE_ALERT_PAGE_URL);
  });

  it("links fixture IOCs through pair keys and per-member lookups", () => {
    const snapshot = buildSampleAlertSnapshotPayload();
    const index = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);

    const focusKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
    const domainKey = buildIocCoOccurrenceMemberKey(
      IOC_TYPE.DOMAIN,
      "malware.testcategory.com"
    );
    const cveKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228");

    const expectedPairKey = buildIocCoOccurrencePairKey(focusKey, domainKey);
    expect(index.pairs.some((pair) => pair.pairKey === expectedPairKey)).toBe(true);

    const focusPairs = listCoOccurrencePairsForKey(index, focusKey);
    const focusPeers = listCoOccurringMembersForKey(index, focusKey);

    expect(focusPairs).toHaveLength(index.members.length - 1);
    expect(focusPeers).toHaveLength(index.members.length - 1);
    expect(focusPeers.some((member) => member.memberKey === domainKey)).toBe(true);
    expect(focusPeers.some((member) => member.memberKey === cveKey)).toBe(true);

    for (const pair of focusPairs) {
      expect(
        pair.memberKeyA === focusKey || pair.memberKeyB === focusKey
      ).toBe(true);
    }
  });
});

describe("sample-alert.html co-occurrence navigation", () => {
  beforeEach(() => {
    stubContentChromeForNavigation();
    setAutoEnrichmentFetcherForTests(null);
    loadSampleAlertFixture();
    highlightDetectedIocs(scanTextNodesForIocs(document.body), {
      root: document.body,
    });
  });

  afterEach(() => {
    setAutoEnrichmentFetcherForTests(null);
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("opens the hover card for the related fixture IOC after navigation", async () => {
    const focusHighlight = findHighlightedIoc("8.8.8.8", IOC_TYPE.IPV4);
    const relatedHighlight = findHighlightedIoc("malware.testcategory.com", IOC_TYPE.DOMAIN);
    expect(focusHighlight).toBeDefined();
    expect(relatedHighlight).toBeDefined();

    expect(
      handleNavigateToIocAnchorRequest(focusHighlight!.dataset.vera5AnchorId!)
    ).toEqual({ ok: true });

    await vi.waitFor(() => {
      const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
      expect(panel?.getAttribute("aria-label")).toBe("Indicator details for 8.8.8.8");
    });

    expect(
      handleNavigateToIocAnchorRequest({
        anchorId: relatedHighlight!.dataset.vera5AnchorId!,
        iocType: IOC_TYPE.DOMAIN,
        value: "malware.testcategory.com",
      })
    ).toEqual({ ok: true });

    await vi.waitFor(() => {
      const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
      expect(panel?.getAttribute("aria-label")).toBe(
        "Indicator details for malware.testcategory.com"
      );
      expect(panel?.textContent).toContain("malware.testcategory.com");
    });
  });
});
