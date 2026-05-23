import { useEffect, useState } from "react";
import { scanPageMessage } from "../lib/messages";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  setExtensionEnabled,
  setHighlightEnabled,
} from "../lib/storage";

export function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [highlightEnabled, setHighlightEnabledState] = useState(true);
  const [ready, setReady] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error">(
    "idle"
  );
  const [scanCount, setScanCount] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([getExtensionEnabled(), getHighlightEnabled()]).then(
      ([extensionValue, highlightValue]) => {
        setEnabled(extensionValue);
        setHighlightEnabledState(highlightValue);
        setReady(true);
      }
    );
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    void setExtensionEnabled(checked);
    if (!checked) {
      setScanState("idle");
      setScanCount(null);
    }
  };

  const handleHighlightToggle = (checked: boolean) => {
    setHighlightEnabledState(checked);
    void setHighlightEnabled(checked);
  };

  const handleScanPage = () => {
    if (!enabled) {
      return;
    }
    setScanState("scanning");
    setScanCount(null);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          setScanState("error");
          return;
        }
        try {
          const response = await chrome.tabs.sendMessage(tab.id, scanPageMessage());
          if (
            response &&
            typeof response === "object" &&
            "ok" in response &&
            response.ok === true &&
            response.payload &&
            typeof response.payload === "object" &&
            "count" in response.payload &&
            typeof (response.payload as { count: unknown }).count === "number"
          ) {
            setScanCount((response.payload as { count: number }).count);
            setScanState("done");
            return;
          }
          setScanState("error");
        } catch {
          setScanState("error");
        }
      });
  };

  return (
    <main
      style={{
        minWidth: 220,
        padding: 12,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>Vera5</h1>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: ready ? "pointer" : "wait",
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          onChange={(event) => handleToggle(event.target.checked)}
          aria-label="Extension enabled"
        />
        Extension enabled
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: ready && enabled ? "pointer" : "not-allowed",
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={highlightEnabled}
          disabled={!ready || !enabled}
          onChange={(event) => handleHighlightToggle(event.target.checked)}
          aria-label="Highlight indicators"
        />
        Highlight indicators
      </label>
      <button
        type="button"
        disabled={!ready || !enabled || scanState === "scanning"}
        onClick={handleScanPage}
        style={{
          width: "100%",
          padding: "8px 12px",
          cursor: !ready || !enabled ? "not-allowed" : "pointer",
        }}
      >
        {scanState === "scanning" ? "Scanning…" : "Scan page"}
      </button>
      {scanState === "done" && scanCount !== null ? (
        <p style={{ fontSize: 12, margin: "8px 0 0" }}>
          Found {scanCount} indicator{scanCount === 1 ? "" : "s"}.
        </p>
      ) : null}
      {scanState === "error" ? (
        <p style={{ fontSize: 12, margin: "8px 0 0", color: "#b00020" }}>
          Scan failed. Reload the tab and try again.
        </p>
      ) : null}
    </main>
  );
}
