import { scanPageMessage } from "../lib/messages";
import { routeIncomingMessageAsync } from "./messageRouter";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void routeIncomingMessageAsync(message).then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(() => {});

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
