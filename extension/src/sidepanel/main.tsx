import "../lib/browserCompat";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import { Popup } from "../popup/Popup";
import { subscribeActiveTabChange } from "./sidePanelActiveTab";

/**
 * Native Chrome side panel host for the Vera5 analyst workspace.
 *
 * The panel reuses the existing `Popup` workspace verbatim — the popup already
 * runs out-of-page and drives scans on the active tab via background/content
 * messaging, which is exactly the model a side panel needs. The only behaviour
 * the panel adds is tab-switch awareness: tab-scoped state (the detected
 * indicator tray and detail pane) is re-read whenever the active tab changes,
 * while storage-backed state (sessions, collections, notes, settings) survives
 * the remount because it is reloaded from local storage.
 */
function SidePanelWorkspace(): JSX.Element {
  const [activeTabEpoch, setActiveTabEpoch] = useState(0);

  useEffect(
    () =>
      subscribeActiveTabChange(() => {
        setActiveTabEpoch((epoch) => epoch + 1);
      }),
    []
  );

  return <Popup key={activeTabEpoch} />;
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <SidePanelWorkspace />
    </StrictMode>
  );
}
