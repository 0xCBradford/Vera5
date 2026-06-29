import "../lib/browserCompat";
import { safeRuntimeSendMessage, runWithExtensionContextAsync } from "../lib/extensionContext";
import { setupAutoScanStorageListener, syncAutoScanWithStorage } from "./autoScan";
import {
  setupLocalBackendStorageListener,
  syncLocalBackendWithStorage,
} from "./localBackendStorage";
import {
  setupLocalLlmSummaryStorageListener,
  syncLocalLlmSummaryWithStorage,
} from "./localLlmSummaryStorage";
import {
  setupAnalystNotesStorageListener,
  syncAnalystNotesWithStorage,
} from "./analystNotesContent";
import {
  setupIocLabelStorageListener,
  syncIocLabelsWithStorage,
} from "./iocLabelContent";
import { setupAnalystModeStorageListener } from "./analystModeStorage";
import { CONTENT_MESSAGE } from "./constants";
import { setupBackgroundEnrichmentRouting } from "./enrichmentBackgroundFetch";
import { setupCommandPaletteListener } from "./commandPalette";
import { setupHoverCardTrigger } from "./hoverCardTrigger";
import { setupEnrichSelectionListener } from "./enrichSelection";
import { setupHighlightStorageListener, setupScanPageListener } from "./scanPage";
import { setupNavigateToIocAnchorListener } from "./iocTrayNavigation";
import { setupWorkspaceSidebarListener } from "./workspaceSidebar";

const contentScriptAlreadyInitialized =
  document.documentElement.dataset.vera5ContentInit === "1";

if (!contentScriptAlreadyInitialized) {
  document.documentElement.dataset.vera5ContentInit = "1";
  document.documentElement.dataset.vera5Content = "active";

  void safeRuntimeSendMessage({ type: CONTENT_MESSAGE.CONTENT_REGISTER });

  setupScanPageListener();
  setupEnrichSelectionListener();
  setupNavigateToIocAnchorListener();
  setupHighlightStorageListener();
  setupAutoScanStorageListener();
  void runWithExtensionContextAsync(syncAutoScanWithStorage);
  setupAnalystNotesStorageListener();
  setupIocLabelStorageListener();
  setupAnalystModeStorageListener();
  setupLocalLlmSummaryStorageListener();
  setupLocalBackendStorageListener();
  void runWithExtensionContextAsync(syncLocalLlmSummaryWithStorage);
  void runWithExtensionContextAsync(syncLocalBackendWithStorage);
  void runWithExtensionContextAsync(syncAnalystNotesWithStorage);
  void runWithExtensionContextAsync(syncIocLabelsWithStorage);
  setupBackgroundEnrichmentRouting();
  setupCommandPaletteListener();
  setupHoverCardTrigger();
}

setupWorkspaceSidebarListener();
