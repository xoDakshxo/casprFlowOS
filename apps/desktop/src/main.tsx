import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@casprflowos/ui/tokens.css";
import "./casprflow/index.css";
import "./styles.css";
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
