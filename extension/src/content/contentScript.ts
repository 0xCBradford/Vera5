import { safeRuntimeSendMessage, runWithExtensionContextAsync } from "../lib/extensionContext";
import { setupAutoScanStorageListener, syncAutoScanWithStorage } from "./autoScan";
import {
  setupAnalystNotesStorageListener,
  syncAnalystNotesWithStorage,
} from "./analystNotesContent";
import { CONTENT_MESSAGE } from "./constants";
import { setupBackgroundEnrichmentRouting } from "./enrichmentBackgroundFetch";
import { setupHoverCardTrigger } from "./hoverCardTrigger";
import { setupHighlightStorageListener, setupScanPageListener } from "./scanPage";
import { setupNavigateToIocAnchorListener } from "./iocTrayNavigation";
import { setupWorkspaceSidebarListener } from "./workspaceSidebar";

document.documentElement.dataset.vera5Content = "active";

void safeRuntimeSendMessage({ type: CONTENT_MESSAGE.CONTENT_REGISTER });

setupScanPageListener();
setupNavigateToIocAnchorListener();
setupWorkspaceSidebarListener();
setupHighlightStorageListener();
setupAutoScanStorageListener();
void runWithExtensionContextAsync(syncAutoScanWithStorage);
setupAnalystNotesStorageListener();
void runWithExtensionContextAsync(syncAnalystNotesWithStorage);
setupBackgroundEnrichmentRouting();
setupHoverCardTrigger();
