import type { Id } from "@casprflowos/shared";

import type { CanvasProject, CanvasWindow } from "./types";

const visibleWindows = (projects: readonly CanvasProject[]): readonly CanvasWindow[] => {
  return projects.flatMap((project) =>
    project.worktrees.flatMap((worktree) =>
      worktree.windows.filter((window) => !window.stashed && !window.minimized),
    ),
  );
};

const verticallyOverlap = (a: CanvasWindow, b: CanvasWindow): boolean => {
  return (
    a.position.y < b.position.y + b.size.height && a.position.y + a.size.height > b.position.y
  );
};

const distanceSquared = (a: CanvasWindow, b: CanvasWindow): number => {
  const ax = a.position.x + a.size.width / 2;
  const ay = a.position.y + a.size.height / 2;
  const bx = b.position.x + b.size.width / 2;
  const by = b.position.y + b.size.height / 2;
  return (ax - bx) ** 2 + (ay - by) ** 2;
};

const pickClosest = (
  candidates: readonly CanvasWindow[],
  pivot: CanvasWindow,
): CanvasWindow | null => {
  return (
    [...candidates].sort((a, b) => distanceSquared(a, pivot) - distanceSquared(b, pivot))[0] ??
    null
  );
};

const pickRightmostLeftOf = (
  candidates: readonly CanvasWindow[],
  pivot: CanvasWindow,
): CanvasWindow | null => {
  return (
    [...candidates].sort((a, b) => {
      const aRight = a.position.x + a.size.width;
      const bRight = b.position.x + b.size.width;
      if (aRight !== bRight) {
        return bRight - aRight;
      }

      return (
        Math.abs(a.position.y - pivot.position.y) - Math.abs(b.position.y - pivot.position.y)
      );
    })[0] ?? null
  );
};

export const pickCloseFocusTarget = (
  projects: readonly CanvasProject[],
  closedWindowId: Id<"window">,
): Id<"window"> | null => {
  const all = visibleWindows(projects);
  const closed = all.find((window) => window.id === closedWindowId);
  if (!closed) {
    return null;
  }

  const survivors = all.filter((window) => window.id !== closedWindowId);
  if (survivors.length === 0) {
    return null;
  }

  const sameWorktree = survivors.filter(
    (window) => window.projectId === closed.projectId && window.worktreeId === closed.worktreeId,
  );
  const rowLeft = pickRightmostLeftOf(
    sameWorktree.filter(
      (window) =>
        window.position.x + window.size.width <= closed.position.x &&
        verticallyOverlap(window, closed),
    ),
    closed,
  );
  if (rowLeft) {
    return rowLeft.id;
  }

  const anyLeft = pickRightmostLeftOf(
    sameWorktree.filter((window) => window.position.x + window.size.width <= closed.position.x),
    closed,
  );
  if (anyLeft) {
    return anyLeft.id;
  }

  const sameWorktreeNearest = pickClosest(sameWorktree, closed);
  if (sameWorktreeNearest) {
    return sameWorktreeNearest.id;
  }

  const sameProject = survivors.filter((window) => window.projectId === closed.projectId);
  const sameProjectNearest = pickClosest(sameProject, closed);
  if (sameProjectNearest) {
    return sameProjectNearest.id;
  }

  return pickClosest(survivors, closed)?.id ?? null;
};
