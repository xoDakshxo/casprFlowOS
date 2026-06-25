import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@casprflowos/ui/tokens.css";
import "./casprflow/index.css";
import "./styles.css";
// casprOS glass identity — must load LAST so it overrides the ported
// TermCanvas palette (codex-black canvas + liquid-glass chrome).
import "./casprflow/caspr-glass.css";
import { App } from "./App";
import { ErrorBoundary } from "./casprflow/components/ErrorBoundary";
import "./casprflow/monacoEnvironment";
import "./casprflow/scrollFade";

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error("Missing #root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
