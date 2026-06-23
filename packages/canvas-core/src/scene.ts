import type { CanvasWindowSummary, Id } from "@casprflowos/shared";

import type { CanvasProject, CanvasScene, CanvasWindow } from "./types";

export const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
} as const;

export const createCanvasScene = (projects: readonly CanvasProject[] = []): CanvasScene => {
  return {
    version: 1,
    viewport: DEFAULT_VIEWPORT,
    projects,
  };
};

export const isRenderableWindow = (window: CanvasWindow): boolean => {
  return !window.stashed;
};

export const listRenderableWindows = (
  projects: readonly CanvasProject[],
): readonly CanvasWindow[] => {
  return projects.flatMap((project) =>
    project.worktrees.flatMap((worktree) => worktree.windows.filter(isRenderableWindow)),
  );
};

export const toWindowSummary = (window: CanvasWindow): CanvasWindowSummary => {
  return {
    id: window.id,
    callsign: window.callsign,
    agentLabel: window.agentLabel,
    projectId: window.projectId,
    worktreeId: window.worktreeId,
    position: window.position,
    size: window.size,
    focused: window.focused,
    minimized: window.minimized,
    status: window.status,
  };
};

export const listWindowSummaries = (scene: CanvasScene): readonly CanvasWindowSummary[] => {
  return listRenderableWindows(scene.projects).map(toWindowSummary);
};

export const getFocusedWindow = (scene: CanvasScene): CanvasWindowSummary | null => {
  const focused = listRenderableWindows(scene.projects).find((window) => window.focused);
  return focused ? toWindowSummary(focused) : null;
};

export const focusWindow = (scene: CanvasScene, windowId: Id<"window">): CanvasScene => {
  return {
    ...scene,
    projects: scene.projects.map((project) => ({
      ...project,
      worktrees: project.worktrees.map((worktree) => ({
        ...worktree,
        windows: worktree.windows.map((window) => ({
          ...window,
          focused: window.id === windowId && isRenderableWindow(window),
        })),
      })),
    })),
  };
};

export const updateWindowPositions = (
  scene: CanvasScene,
  positions: ReadonlyMap<Id<"window">, { readonly x: number; readonly y: number }>,
): CanvasScene => {
  return {
    ...scene,
    projects: scene.projects.map((project) => ({
      ...project,
      worktrees: project.worktrees.map((worktree) => ({
        ...worktree,
        windows: worktree.windows.map((window) => {
          const position = positions.get(window.id);
          return position ? { ...window, position } : window;
        }),
      })),
    })),
  };
};
