import { setupAutoScanStorageListener, syncAutoScanWithStorage } from "./autoScan";
import { CONTENT_MESSAGE } from "./constants";
import { setupHoverCardTrigger } from "./hoverCardTrigger";
import { setupHighlightStorageListener, setupScanPageListener } from "./scanPage";

document.documentElement.dataset.vera5Content = "active";

void chrome.runtime
  .sendMessage({ type: CONTENT_MESSAGE.CONTENT_REGISTER })
  .catch(() => undefined);

setupScanPageListener();
setupHighlightStorageListener();
setupAutoScanStorageListener();
void syncAutoScanWithStorage();
setupHoverCardTrigger();
