/// <reference types="vite/client" />

import type { CasprFlowOSApi } from "../electron/preload";

declare global {
  interface Window {
    readonly casprFlowOS: CasprFlowOSApi;
  }
}
