import type { CanvasPort, CanvasZoomMode, Id } from "@casprflowos/shared";

import {
  focusWindow,
  getFocusedWindow,
  listWindowSummaries,
  updateWindowPositions,
} from "./scene";
import type { CanvasScene, MutableCanvasSceneStore } from "./types";

const ZOOM_STEP = 0.15;

const zoomViewport = (scene: CanvasScene, mode: CanvasZoomMode): CanvasScene => {
  const current = scene.viewport.zoom;
  const zoom =
    mode === "in"
      ? Math.min(2, current + ZOOM_STEP)
      : mode === "out"
        ? Math.max(0.25, current - ZOOM_STEP)
        : 1;

  return {
    ...scene,
    viewport: {
      ...scene.viewport,
      zoom,
    },
  };
};

export const createInMemorySceneStore = (initialScene: CanvasScene): MutableCanvasSceneStore => {
  let scene = initialScene;

  return {
    getScene: () => scene,
    setScene: (nextScene) => {
      scene = nextScene;
    },
  };
};

export const createCanvasPort = (store: MutableCanvasSceneStore): CanvasPort => {
  return {
    listWindows: () => listWindowSummaries(store.getScene()),
    getFocusedWindow: () => getFocusedWindow(store.getScene()),
    focusWindow: (windowId: Id<"window">) => {
      const before = store.getScene();
      const target = listWindowSummaries(before).find((window) => window.id === windowId);
      if (!target) {
        return Promise.resolve({ ok: false, message: "Window not found.", data: {} });
      }

      store.setScene(focusWindow(before, windowId));
      return Promise.resolve({ ok: true, message: `Focused ${target.callsign}.`, data: {} });
    },
    panZoom: (mode: CanvasZoomMode) => {
      store.setScene(zoomViewport(store.getScene(), mode));
      return Promise.resolve({ ok: true, message: `Canvas zoom ${mode}.`, data: {} });
    },
    arrange: () => {
      const windows = listWindowSummaries(store.getScene());
      const positions = new Map(
        windows.map((window, index) => [
          window.id,
          { x: index * (window.size.width + 24), y: 0 },
        ]),
      );
      store.setScene(updateWindowPositions(store.getScene(), positions));
      return Promise.resolve({ ok: true, message: "Arranged canvas windows.", data: {} });
    },
  };
};
