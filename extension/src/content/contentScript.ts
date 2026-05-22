document.documentElement.dataset.vera5Content = "active";

void chrome.runtime
  .sendMessage({ type: "CONTENT_REGISTER" })
  .catch(() => undefined);
