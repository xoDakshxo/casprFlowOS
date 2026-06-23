import type { Id } from "@casprflowos/shared";

import { resolveCollisions, type CollisionRect } from "./collision";
import type { CanvasProject, CanvasRect, CanvasWindow } from "./types";

export interface PlacementInput {
  readonly projects: readonly CanvasProject[];
  readonly projectId: Id<"project">;
  readonly worktreeId: Id<"worktree">;
  readonly parentWindowId?: Id<"window">;
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly preferredPosition?: {
    readonly x: number;
    readonly y: number;
  };
  readonly fallback?: {
    readonly x: number;
    readonly y: number;
  };
  readonly viewportRect?: CanvasRect;
}

export interface PlacementResult {
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
  readonly nudged: ReadonlyArray<{
    readonly id: Id<"window">;
    readonly x: number;
    readonly y: number;
  }>;
}

const SNAP_GRID = 10;
const ADJACENCY_GAP = 8;
const PLACEMENT_PLACEHOLDER_ID = "__placement_placeholder__";

const snap = (value: number): number => Math.round(value / SNAP_GRID) * SNAP_GRID;

const visibleWindows = (projects: readonly CanvasProject[]): readonly CanvasWindow[] => {
  return projects.flatMap((project) =>
    project.worktrees.flatMap((worktree) => worktree.windows.filter((window) => !window.stashed)),
  );
};

const collectRects = (projects: readonly CanvasProject[]): CollisionRect[] => {
  return visibleWindows(projects).map((window) => ({
    id: window.id,
    x: window.position.x,
    y: window.position.y,
    width: window.size.width,
    height: window.size.height,
  }));
};

const findWindow = (
  projects: readonly CanvasProject[],
  windowId: Id<"window">,
): CanvasWindow | null => {
  return visibleWindows(projects).find((window) => window.id === windowId) ?? null;
};

const windowsInWorktree = (
  projects: readonly CanvasProject[],
  projectId: Id<"project">,
  worktreeId: Id<"worktree">,
): readonly CanvasWindow[] => {
  const project = projects.find((entry) => entry.id === projectId);
  const worktree = project?.worktrees.find((entry) => entry.id === worktreeId);
  return worktree?.windows.filter((window) => !window.stashed) ?? [];
};

const rightEdge = (window: CanvasWindow): number => window.position.x + window.size.width;

const worktreeAnchor = (
  projects: readonly CanvasProject[],
  projectId: Id<"project">,
  worktreeId: Id<"worktree">,
): CanvasWindow | null => {
  const windows = windowsInWorktree(projects, projectId, worktreeId);
  const focused = windows.find((window) => window.focused);
  if (focused) {
    return focused;
  }

  return [...windows].sort((a, b) => rightEdge(b) - rightEdge(a))[0] ?? null;
};

const projectAnchor = (
  projects: readonly CanvasProject[],
  projectId: Id<"project">,
  excludeWorktreeId: Id<"worktree">,
): CanvasWindow | null => {
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }

  const windows = project.worktrees
    .filter((worktree) => worktree.id !== excludeWorktreeId)
    .flatMap((worktree) => worktree.windows.filter((window) => !window.stashed));

  return [...windows].sort((a, b) => rightEdge(b) - rightEdge(a))[0] ?? null;
};

const anchorFromViewport = (
  rect: CanvasRect,
  size: PlacementInput["size"],
): { readonly x: number; readonly y: number } => {
  return {
    x: rect.x + (rect.width - size.width) / 2,
    y: rect.y + (rect.height - size.height) / 2,
  };
};

const pickAnchor = (input: PlacementInput): { readonly x: number; readonly y: number } => {
  if (input.preferredPosition) {
    return input.preferredPosition;
  }

  if (input.parentWindowId) {
    const parent = findWindow(input.projects, input.parentWindowId);
    if (parent) {
      return {
        x: parent.position.x + parent.size.width + ADJACENCY_GAP,
        y: parent.position.y,
      };
    }
  }

  const sameWorktree = worktreeAnchor(input.projects, input.projectId, input.worktreeId);
  if (sameWorktree) {
    return {
      x: sameWorktree.position.x + sameWorktree.size.width + ADJACENCY_GAP,
      y: sameWorktree.position.y,
    };
  }

  const sameProject = projectAnchor(input.projects, input.projectId, input.worktreeId);
  if (sameProject) {
    return {
      x: sameProject.position.x + sameProject.size.width + ADJACENCY_GAP,
      y: sameProject.position.y,
    };
  }

  if (input.viewportRect) {
    return anchorFromViewport(input.viewportRect, input.size);
  }

  return input.fallback ?? { x: 0, y: 0 };
};

export const pickWindowPlacement = (input: PlacementInput): PlacementResult => {
  const anchor = pickAnchor(input);
  const position = {
    x: snap(anchor.x),
    y: snap(anchor.y),
  };
  const rects = [
    ...collectRects(input.projects),
    {
      id: PLACEMENT_PLACEHOLDER_ID,
      x: position.x,
      y: position.y,
      width: input.size.width,
      height: input.size.height,
    },
  ];

  const resolved = resolveCollisions(rects, ADJACENCY_GAP, PLACEMENT_PLACEHOLDER_ID);
  const placeholder = resolved.find((rect) => rect.id === PLACEMENT_PLACEHOLDER_ID);

  return {
    position: {
      x: placeholder?.x ?? position.x,
      y: placeholder?.y ?? position.y,
    },
    nudged: resolved
      .filter((rect) => rect.id !== PLACEMENT_PLACEHOLDER_ID)
      .flatMap((rect) => {
        const original = rects.find((entry) => entry.id === rect.id);
        if (!original || (original.x === rect.x && original.y === rect.y)) {
          return [];
        }

        return [{ id: rect.id as Id<"window">, x: rect.x, y: rect.y }];
      }),
  };
};
