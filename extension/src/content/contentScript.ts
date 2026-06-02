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

document.documentElement.dataset.vera5Content = "active";

void safeRuntimeSendMessage({ type: CONTENT_MESSAGE.CONTENT_REGISTER });

setupScanPageListener();
setupHighlightStorageListener();
setupAutoScanStorageListener();
void runWithExtensionContextAsync(syncAutoScanWithStorage);
setupAnalystNotesStorageListener();
void runWithExtensionContextAsync(syncAnalystNotesWithStorage);
setupBackgroundEnrichmentRouting();
setupHoverCardTrigger();
