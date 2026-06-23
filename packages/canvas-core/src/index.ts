/**
 * Canvas core owns pure scene state, placement, focus, and the CanvasPort implementation.
 * It may depend on shared contracts but not on Electron, React, terminal, or agents.
 */

export { resolveCollisions } from "./collision";
export type { CollisionRect } from "./collision";
export { pickCloseFocusTarget } from "./focus";
export { pickWindowPlacement } from "./placement";
export type { PlacementInput, PlacementResult } from "./placement";
export {
  createCanvasScene,
  DEFAULT_VIEWPORT,
  focusWindow,
  getFocusedWindow,
  isRenderableWindow,
  listRenderableWindows,
  listWindowSummaries,
  toWindowSummary,
  updateWindowPositions,
} from "./scene";
export { createCanvasPort, createInMemorySceneStore } from "./port";
export type {
  CanvasProject,
  CanvasRect,
  CanvasScene,
  CanvasWindow,
  CanvasWorktree,
  MutableCanvasSceneStore,
} from "./types";
