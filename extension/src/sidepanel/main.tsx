import "../lib/browserCompat";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import { Popup } from "../popup/Popup";
import { subscribeActiveTabChange } from "./sidePanelActiveTab";

/**
 * Native Chrome side panel host for the Vera5 analyst workspace.
 *
 * The panel mounts the canonical shared workspace as a permanent
 * three-panel shell: top-left triage, top-right detail/casework, and
 * a full-width Intel Feed row. Tab-scoped state remounts on active tab
 * change; storage-backed state reloads from local storage.
 */
function SidePanelWorkspace() {
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
