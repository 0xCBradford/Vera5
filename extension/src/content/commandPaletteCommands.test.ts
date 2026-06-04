/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandPaletteCommands,
  executeCommandPaletteCommand,
  getCommandPaletteCommandById,
  listCommandPaletteCommands,
} from "../lib/commandRegistry";
import * as exportTemplates from "../lib/exportTemplates";
import * as extensionContext from "../lib/extensionContext";
import * as enrichSelection from "./enrichSelection";
import * as hoverCardOverlay from "./hoverCardOverlay";
import * as highlighter from "./highlighter";
import * as scanPage from "./scanPage";
import {
  CORE_COMMAND_PALETTE_COMMAND_IDS,
  registerCoreCommandPaletteCommands,
} from "./commandPaletteCommands";

describe("registerCoreCommandPaletteCommands", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    clearCommandPaletteCommands();
    registerCoreCommandPaletteCommands();
  });

  afterEach(() => {
    document.body.replaceChildren();
    clearCommandPaletteCommands();
    vi.restoreAllMocks();
  });

  it("registers all six core palette commands", () => {
    const ids = listCommandPaletteCommands().map((command) => command.id);
    expect(ids).toEqual([
      CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS,
      CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN,
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION,
      CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET,
      CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS,
      CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE,
    ]);
  });

  it("runs scan page through handleScanPageRequest", async () => {
    const handleScanPageRequest = vi
      .spyOn(scanPage, "handleScanPageRequest")
      .mockResolvedValue({ ok: true, payload: { count: 0 } });

    await executeCommandPaletteCommand(CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE);

    expect(handleScanPageRequest).toHaveBeenCalledTimes(1);
  });

  it("runs enrich selection through handleEnrichSelectionRequest", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "1.2.3.4";
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = document.getSelection();
    expect(selection).not.toBeNull();
    selection!.removeAllRanges();
    selection!.addRange(range);

    const handleEnrichSelectionRequest = vi
      .spyOn(enrichSelection, "handleEnrichSelectionRequest")
      .mockResolvedValue({ ok: true, payload: { value: "1.2.3.4", type: "ipv4" } });

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION
    );

    expect(handleEnrichSelectionRequest).toHaveBeenCalledTimes(1);
  });

  it("disables enrich selection when nothing is selected", () => {
    document.getSelection()?.removeAllRanges();

    const command = getCommandPaletteCommandById(
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION
    );
    expect(command?.isEnabled?.()).toBe(false);
  });

  it("copies filtered tray markdown when records exist", async () => {
    const records = [{ exportedAt: "2026-01-01T00:00:00.000Z" }] as const;
    vi.spyOn(hoverCardOverlay, "getFilteredTrayEnrichmentRecords").mockResolvedValue(
      records
    );
    const copyTrayTemplateExportToClipboard = vi
      .spyOn(exportTemplates, "copyTrayTemplateExportToClipboard")
      .mockResolvedValue(true);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN
    );

    expect(copyTrayTemplateExportToClipboard).toHaveBeenCalledWith(
      "markdown-report",
      records
    );
  });

  it("downloads filtered tray markdown when records exist", async () => {
    const records = [{ exportedAt: "2026-01-01T00:00:00.000Z" }] as const;
    vi.spyOn(hoverCardOverlay, "getFilteredTrayEnrichmentRecords").mockResolvedValue(
      records
    );
    const downloadTrayTemplateExportFile = vi
      .spyOn(exportTemplates, "downloadTrayTemplateExportFile")
      .mockImplementation(() => undefined);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET
    );

    expect(downloadTrayTemplateExportFile).toHaveBeenCalledWith(
      "markdown-report",
      records
    );
  });

  it("clears page highlights", async () => {
    const clearIocHighlights = vi
      .spyOn(highlighter, "clearIocHighlights")
      .mockReturnValue(2);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS
    );

    expect(clearIocHighlights).toHaveBeenCalledWith(document.body);
  });

  it("opens the options page", async () => {
    const safeOpenOptionsPage = vi
      .spyOn(extensionContext, "safeOpenOptionsPage")
      .mockImplementation(() => undefined);

    await executeCommandPaletteCommand(CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS);

    expect(safeOpenOptionsPage).toHaveBeenCalledTimes(1);
  });
});
