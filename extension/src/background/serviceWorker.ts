import { routeIncomingMessage } from "./messageRouter";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  sendResponse(routeIncomingMessage(message));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {});
