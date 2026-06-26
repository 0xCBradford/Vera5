import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Options } from "./Options";
import "../styles/tokens.css";
import "./options.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Options />
    </StrictMode>
  );
}
