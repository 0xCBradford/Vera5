/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as analystNotesSession from "../lib/analystNotesSession";
import {
  BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE,
  createBuiltInOperatorMacroCtiDeepCheck,
  createBuiltInOperatorMacroDfirTriage,
} from "../lib/builtInOperatorMacros";
import * as copyText from "../lib/copyText";
import * as exportTemplates from "../lib/exportTemplates";
import { IOC_TYPE } from "../lib/iocRegex";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import { IOC_RULE_ID } from "../lib/iocRegex";
import { runOperatorMacro } from "./commandPaletteCommands";
import * as enrichSelection from "./enrichSelection";
import * as hoverCardOverlay from "./hoverCardOverlay";
import * as hoverCardTrigger from "./hoverCardTrigger";
import * as trayEnrichQueue from "./trayEnrichQueue";
import { scanTextNodesForIocs } from "./detector";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
  return wrapper;
}

function selectFixtureIocText(value: string): void {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    const index = text.indexOf(value);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + value.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`Fixture IOC text not found: ${value}`);
}

function stubChrome(): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
      session: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
    },
    runtime: {
      id: "test-extension-id",
      sendMessage: vi.fn(async () => ({ ok: true })),
    },
  });
}

describe("built-in macros on sample-alert.html", () => {
  beforeEach(() => {
    stubChrome();
    Object.defineProperty(document, "location", {
      configurable: true,
      value: {
        href: "http://localhost:8080/sample-alert.html",
        hostname: "localhost",
      },
    });
    mountFixture(loadFixture("sample-alert.html"));
    const matches = scanTextNodesForIocs(document.body);
    expect(matches.some((match) => match.value === "192.0.2.1")).toBe(true);
    selectFixtureIocText("192.0.2.1");
  });

  afterEach(() => {
    document.body.replaceChildren();
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs CTI Deep Check against a selected fixture IOC with mocked enrich", async () => {
    const enrichSpy = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "192.0.2.1",
        type: IOC_TYPE.IPV4,
        trustGateBlocked: false,
      });
    vi.spyOn(hoverCardOverlay, "getLastHoverCardPayload").mockReturnValue({
      value: "192.0.2.1",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "Fixture enrich summary",
    });
    vi.spyOn(hoverCardOverlay, "buildExportRecordFromPayload").mockReturnValue({
      ioc: "192.0.2.1",
      iocType: "ipv4",
      iocTypeLabel: "IPv4",
      enrichmentState: "ready",
      tags: [],
      sources: [],
      disabledSources: [],
      riskScore: null,
      pivots: [],
      exportedAt: "2026-07-15T00:00:00.000Z",
      summary: "Fixture enrich summary",
    });
    const copySpy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);
    vi.spyOn(exportTemplates, "renderExportTemplate").mockReturnValue(
      "# sample-alert CTI report\n\n192.0.2.1"
    );
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const result = await runOperatorMacro(
      createBuiltInOperatorMacroCtiDeepCheck(),
      document
    );

    expect(result).toEqual({ status: "completed" });
    expect(enrichSpy).toHaveBeenCalledTimes(1);
    expect(copySpy).toHaveBeenCalledWith("# sample-alert CTI report\n\n192.0.2.1");
    expect(openSpy).toHaveBeenCalled();
  });

  it("runs DFIR Triage against a selected fixture IOC with mocked enrich and tray queue", async () => {
    const enrichSpy = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "192.0.2.1",
        type: IOC_TYPE.IPV4,
        trustGateBlocked: false,
      });
    vi.spyOn(hoverCardOverlay, "getLastHoverCardPayload").mockReturnValue({
      value: "192.0.2.1",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "Fixture enrich summary",
    });

    const traySummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "http://localhost:8080/sample-alert.html",
        scannedAt: 1_700_000_000_000,
        entries: [
          {
            type: IOC_TYPE.IPV4,
            value: "192.0.2.1",
            anchorId: "vera5-hl-fixture-1",
            ruleId: IOC_RULE_ID.IPV4,
            sourceTextHint: "192.0.2.1",
          },
          {
            type: IOC_TYPE.IPV4,
            value: "8.8.8.8",
            anchorId: "vera5-hl-fixture-2",
            ruleId: IOC_RULE_ID.IPV4,
            sourceTextHint: "8.8.8.8",
          },
          {
            type: IOC_TYPE.CVE,
            value: "CVE-2021-44228",
            anchorId: "vera5-hl-fixture-3",
            ruleId: IOC_RULE_ID.CVE,
            sourceTextHint: "CVE-2021-44228",
          },
        ],
      }),
      tabId: 1,
    });

    vi.spyOn(hoverCardOverlay, "loadScanListExportContext").mockResolvedValue({
      summary: traySummary,
      filter: "all",
    });
    const queueSpy = vi
      .spyOn(trayEnrichQueue, "runSequentialTrayEnrichQueue")
      .mockResolvedValue({ completedCount: 3, cancelled: false });
    vi.spyOn(hoverCardTrigger, "openHoverCardForHighlight").mockReturnValue(true);
    const noteSpy = vi.spyOn(analystNotesSession, "setSessionAnalystNote");
    vi.spyOn(analystNotesSession, "getSessionAnalystNote").mockReturnValue("");

    const result = await runOperatorMacro(
      createBuiltInOperatorMacroDfirTriage(),
      document
    );

    expect(result).toEqual({ status: "completed" });
    expect(enrichSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        "vera5-hl-fixture-1",
        "vera5-hl-fixture-2",
        "vera5-hl-fixture-3",
      ]),
      expect.any(Function)
    );
    expect(noteSpy).toHaveBeenCalledWith(
      "192.0.2.1",
      BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE
    );
  });
});
