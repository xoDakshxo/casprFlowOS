/// <reference types="vite/client" />

import type { CasprFlowOSAPI } from "./casprflow/types";

declare global {
  interface Window {
    readonly casprFlowOS: CasprFlowOSAPI;
  }
}
