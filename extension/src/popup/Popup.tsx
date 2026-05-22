import { useEffect, useState } from "react";
import {
  getExtensionEnabled,
  setExtensionEnabled,
} from "../lib/storage";

export function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getExtensionEnabled().then((value) => {
      setEnabled(value);
      setReady(true);
    });
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    void setExtensionEnabled(checked);
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
    </main>
  );
}
