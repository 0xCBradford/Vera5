import { safeRuntimeSendMessage, runWithExtensionContextAsync } from "../lib/extensionContext";
import { setupAutoScanStorageListener, syncAutoScanWithStorage } from "./autoScan";
import {
  setupAnalystNotesStorageListener,
  syncAnalystNotesWithStorage,
} from "./analystNotesContent";
import { setupAnalystModeStorageListener } from "./analystModeStorage";
import { CONTENT_MESSAGE } from "./constants";
import { setupBackgroundEnrichmentRouting } from "./enrichmentBackgroundFetch";
import { setupCommandPaletteListener } from "./commandPalette";
import { setupHoverCardTrigger } from "./hoverCardTrigger";
import { setupEnrichSelectionListener } from "./enrichSelection";
import { setupHighlightStorageListener, setupScanPageListener } from "./scanPage";
import { setupNavigateToIocAnchorListener } from "./iocTrayNavigation";
import { setupWorkspaceSidebarListener } from "./workspaceSidebar";

document.documentElement.dataset.vera5Content = "active";

void safeRuntimeSendMessage({ type: CONTENT_MESSAGE.CONTENT_REGISTER });

setupScanPageListener();
setupEnrichSelectionListener();
setupNavigateToIocAnchorListener();
setupWorkspaceSidebarListener();
setupHighlightStorageListener();
setupAutoScanStorageListener();
void runWithExtensionContextAsync(syncAutoScanWithStorage);
setupAnalystNotesStorageListener();
setupAnalystModeStorageListener();
void runWithExtensionContextAsync(syncAnalystNotesWithStorage);
setupBackgroundEnrichmentRouting();
setupCommandPaletteListener();
setupHoverCardTrigger();
