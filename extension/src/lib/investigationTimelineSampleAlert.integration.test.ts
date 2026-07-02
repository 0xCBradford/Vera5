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
import { resolveMaxIocsPerScan, scanTextNodesForIocs } from "../content/detector";
import { IOC_TYPE } from "./iocRegex";
import {
  getActiveInvestigationSession,
  recordActiveInvestigationSessionEnrichmentEvent,
  recordActiveInvestigationSessionExportEvent,
  recordActiveInvestigationSessionWatchlistTagEvent,
  syncActiveInvestigationSessionFromScan,
} from "./investigationSessionStorage";
import {
  TIMELINE_EVENT_SCHEMA_VERSION,
  TIMELINE_EVENT_TYPE,
} from "./timelineEvent";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SAMPLE_ALERT_PAGE_URL = "http://localhost:8080/sample-alert.html";
const SAMPLE_ALERT_FOCUS_IOC = "8.8.8.8";

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

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

function loadSampleAlertFixture(): void {
  const html = readFileSync(join(repoRoot, "examples", "sample-alert.html"), "utf8");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
}

function buildSampleAlertScanEntries(): PageIocScanMatch[] {
  loadSampleAlertFixture();
  const textMatches = scanTextNodesForIocs(document.body);
  return mergeVisibleTextAndAttributeIocMatches(
    textMatches,
    [],
    resolveMaxIocsPerScan({})
  );
}

describe("sample-alert.html investigation timeline flow", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("records scan, enrich, export, tag, and redetect events in order for a fixture IOC", async () => {
    const snapshotMatches = buildSampleAlertScanEntries();
    const entries = snapshotMatches.map((match) => ({
      type: match.type,
      value: match.value,
    }));

    expect(entries.length).toBeGreaterThanOrEqual(EXPECTED_SAMPLE_ALERT_IOC_VALUES.length);
    for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
      expect(entries.some((entry) => entry.value === value)).toBe(true);
    }

    const firstScan = await syncActiveInvestigationSessionFromScan({
      pageUrl: SAMPLE_ALERT_PAGE_URL,
      entries,
      now: 1_000,
    });

    expect(firstScan?.pageUrl).toBe(SAMPLE_ALERT_PAGE_URL);
    expect(
      firstScan?.timelineEvents?.filter((event) => event.type === TIMELINE_EVENT_TYPE.SCAN)
        .length
    ).toBe(entries.length);
    expect(firstScan?.timelineEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
          type: TIMELINE_EVENT_TYPE.SCAN,
          iocKey: SAMPLE_ALERT_FOCUS_IOC,
          timestamp: 1_000,
        }),
      ])
    );

    await recordActiveInvestigationSessionEnrichmentEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      iocType: IOC_TYPE.IPV4,
      now: 1_100,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    });
    await recordActiveInvestigationSessionExportEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      iocType: IOC_TYPE.IPV4,
      now: 1_200,
      templateId: "jira-comment",
    });
    await recordActiveInvestigationSessionWatchlistTagEvent({
      iocValue: SAMPLE_ALERT_FOCUS_IOC,
      label: "case-important",
      now: 1_300,
    });

    const rescan = await syncActiveInvestigationSessionFromScan({
      pageUrl: SAMPLE_ALERT_PAGE_URL,
      entries,
      now: 1_400,
    });

    const focusTimeline = rescan?.timelineEvents?.filter(
      (event) => event.iocKey === SAMPLE_ALERT_FOCUS_IOC
    );

    expect(focusTimeline).toEqual([
      expect.objectContaining({
        type: TIMELINE_EVENT_TYPE.SCAN,
        timestamp: 1_000,
      }),
      expect.objectContaining({
        type: TIMELINE_EVENT_TYPE.ENRICH,
        timestamp: 1_100,
        sourceAttributionSummary: "Source: AbuseIPDB · live",
      }),
      expect.objectContaining({
        type: TIMELINE_EVENT_TYPE.EXPORT,
        timestamp: 1_200,
        templateId: "jira-comment",
      }),
      expect.objectContaining({
        type: TIMELINE_EVENT_TYPE.WATCHLIST_TAG,
        timestamp: 1_300,
        sourceAttributionSummary: "Case important",
      }),
      expect.objectContaining({
        type: TIMELINE_EVENT_TYPE.REDETECT,
        timestamp: 1_400,
      }),
    ]);

    expect(
      rescan?.timelineEvents?.filter((event) => event.type === TIMELINE_EVENT_TYPE.REDETECT)
        .length
    ).toBe(entries.length);

    const active = await getActiveInvestigationSession();
    expect(active?.timelineEvents).toEqual(rescan?.timelineEvents);
  });
});
