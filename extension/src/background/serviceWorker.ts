import { scanPageMessage } from "../lib/messages";
import { clearTabScanSnapshot } from "../lib/tabScanSnapshotStorage";
import { routeIncomingMessageAsync } from "./messageRouter";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void routeIncomingMessageAsync(message, sender).then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(() => {});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabScanSnapshot(tabId);
});

async function sendScanPageToActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, scanPageMessage());
  } catch {
    return;
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "scan-page") {
    void sendScanPageToActiveTab();
  }
});
