import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Options } from "./Options";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Options />
    </StrictMode>
  );
}
