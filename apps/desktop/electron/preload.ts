import { contextBridge } from "electron";

export type CasprFlowOSApi = Record<never, never>;

const api: CasprFlowOSApi = Object.freeze({});

contextBridge.exposeInMainWorld("casprFlowOS", api);
