import { scanPageMessage, toggleWorkspaceMessage } from "../lib/messages";
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

async function sendMessageToActiveTab(message: unknown): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return;
  }
}

async function sendScanPageToActiveTab(): Promise<void> {
  await sendMessageToActiveTab(scanPageMessage());
}

async function toggleWorkspaceOnActiveTab(): Promise<void> {
  await sendMessageToActiveTab(toggleWorkspaceMessage());
}

chrome.action.onClicked.addListener(() => {
  void toggleWorkspaceOnActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "scan-page") {
    void sendScanPageToActiveTab();
  }
});
