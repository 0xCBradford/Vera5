import { registerCommandPaletteCommand } from "../lib/commandRegistry";
import {
  copyTrayTemplateExportToClipboard,
  downloadTrayTemplateExportFile,
} from "../lib/exportTemplates";
import { safeOpenOptionsPage, safeRuntimeSendMessage } from "../lib/extensionContext";
import { recordActiveInvestigationSessionExportEvent } from "../lib/investigationSessionStorage";
import { ENRICHMENT_SOURCE_OPS_SECTION_TITLE } from "../lib/enrichmentSourceOps";
import { openExtensionPopupMessage } from "../lib/messages";
import { POPUP_PANEL } from "../lib/popupPanelFocus";
import { handleEnrichSelectionRequest } from "./enrichSelection";
import { getFilteredTrayEnrichmentRecords } from "./hoverCardOverlay";
import { clearIocHighlights } from "./highlighter";
import { handleScanPageRequest } from "./scanPage";

export const CORE_COMMAND_PALETTE_COMMAND_IDS = {
  SCAN_PAGE: "scan-page",
  ENRICH_SELECTION: "enrich-selection",
  OPEN_HISTORY: "open-history",
  SOURCE_HEALTH: "source-health",
  COPY_FILTERED_MARKDOWN: "copy-filtered-markdown",
  EXPORT_TRAY_SUBSET: "export-tray-subset",
  CLEAR_HIGHLIGHTS: "clear-highlights",
  OPEN_OPTIONS: "open-options",
} as const;

function hasNonCollapsedTextSelection(doc: Document = document): boolean {
  const selection = doc.getSelection();
  return Boolean(
    selection && selection.rangeCount > 0 && !selection.isCollapsed
  );
}

export function registerCoreCommandPaletteCommands(): void {
  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE,
    label: "Scan page",
    description: "Detect indicators in visible page text",
    keywords: ["detect", "ioc", "scan"],
    run: () => {
      void handleScanPageRequest();
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION,
    label: "Enrich selection",
    description: "Look up the indicator in the current text selection",
    keywords: ["enrich", "ioc", "lookup", "selection"],
    isEnabled: () => hasNonCollapsedTextSelection(),
    run: () => {
      void handleEnrichSelectionRequest();
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_HISTORY,
    label: "Open history",
    description: "Open investigation history in the extension popup",
    keywords: ["history", "investigation", "recent", "reopen"],
    run: () => {
      void safeRuntimeSendMessage(
        openExtensionPopupMessage(POPUP_PANEL.INVESTIGATION_HISTORY)
      );
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.SOURCE_HEALTH,
    label: "Source health",
    description: `Open ${ENRICHMENT_SOURCE_OPS_SECTION_TITLE} in the extension popup`,
    keywords: ["health", "quota", "cooldown", "cache", "source", "429"],
    run: () => {
      void safeRuntimeSendMessage(
        openExtensionPopupMessage(POPUP_PANEL.SOURCE_OPERATIONS)
      );
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN,
    label: "Copy filtered Markdown",
    description: "Copy filtered tray indicators as Markdown",
    keywords: ["clipboard", "copy", "markdown", "tray"],
    run: async () => {
      const records = await getFilteredTrayEnrichmentRecords();
      if (records.length === 0) {
        return;
      }
      await copyTrayTemplateExportToClipboard("markdown-report", records);
      void recordActiveInvestigationSessionExportEvent({
        iocs: records.map((record) => ({
          value: record.value,
          type: record.type,
        })),
      });
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET,
    label: "Export tray subset",
    description: "Download filtered tray indicators as Markdown",
    keywords: ["download", "export", "markdown", "tray"],
    run: async () => {
      const records = await getFilteredTrayEnrichmentRecords();
      if (records.length === 0) {
        return;
      }
      downloadTrayTemplateExportFile("markdown-report", records);
      void recordActiveInvestigationSessionExportEvent({
        iocs: records.map((record) => ({
          value: record.value,
          type: record.type,
        })),
      });
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS,
    label: "Clear highlights",
    description: "Remove all indicator highlights on this page",
    keywords: ["clear", "highlight", "reset"],
    run: () => {
      clearIocHighlights(document.body);
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS,
    label: "Open options",
    description: "Open extension settings",
    keywords: ["options", "preferences", "settings"],
    run: () => {
      safeOpenOptionsPage();
    },
  });
}
