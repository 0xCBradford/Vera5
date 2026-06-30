import { handleScanPageRequest } from "./scanPage";

const EXAMPLES_FIXTURE_HOST = "127.0.0.1";
const EXAMPLES_FIXTURE_PORT = "8765";
const EXAMPLES_FIXTURE_BRIDGE_FLAG = "vera5ExamplesFixtureBridge";

type ExamplesFixtureBridgeMessage = {
  vera5ExamplesFixtureBridge?: boolean;
  action?: "setStorage" | "setStorageDone" | "scanPage";
  payload?: Record<string, unknown>;
};

function isExamplesFixtureOrigin(): boolean {
  return (
    window.location.hostname === EXAMPLES_FIXTURE_HOST &&
    window.location.port === EXAMPLES_FIXTURE_PORT
  );
}

function postExamplesFixtureBridgeAck(action: "setStorageDone"): void {
  window.postMessage(
    {
      [EXAMPLES_FIXTURE_BRIDGE_FLAG]: true,
      action,
    },
    "*"
  );
}

export function setupExamplesFixtureBridge(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !isExamplesFixtureOrigin()) {
      return;
    }

    const data = event.data as ExamplesFixtureBridgeMessage;
    if (!data?.[EXAMPLES_FIXTURE_BRIDGE_FLAG]) {
      return;
    }

    if (data.action === "setStorage" && data.payload) {
      void chrome.storage.local.set(data.payload).then(() => {
        postExamplesFixtureBridgeAck("setStorageDone");
      });
      return;
    }

    if (data.action === "scanPage") {
      void handleScanPageRequest();
    }
  });
}
