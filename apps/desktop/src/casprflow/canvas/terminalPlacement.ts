import type { ProjectData } from "../types";
import { resolveCollisions } from "./collisionResolver";

export interface PlacementInput {
  projects: ProjectData[];
  projectId: string;
  worktreeId: string;
  parentTerminalId?: string;
  width: number;
  height: number;
  /**
   * Preferred world-space position. When provided (e.g. for a right-click
   * spawn), the placement is anchored at this point and only the collision
   * resolver is allowed to nudge it.
   */
  preferredPosition?: { x: number; y: number };
  /**
   * Fallback viewport center used when no parent or sibling tiles are
   * available to anchor against.
   */
  fallback?: { x: number; y: number };
  /**
   * Current visible canvas area in world space. When provided and the
   * placement falls through to the "no anchor" case (target project has no
   * terminals anywhere), the new tile is centred inside this rect so it
   * lands where the user is actually looking instead of at the origin.
   */
  viewportRect?: { x: number; y: number; w: number; h: number };
}

const SNAP_GRID = 10;
const ADJACENCY_GAP = 8;

function snap(value: number): number {
  return Math.round(value / SNAP_GRID) * SNAP_GRID;
}

interface RectInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectRects(projects: ProjectData[]): RectInput[] {
  const rects: RectInput[] = [];
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.stashed) continue;
        rects.push({
          id: terminal.id,
          x: terminal.x,
          y: terminal.y,
          width: terminal.width,
          height: terminal.height,
        });
      }
    }
  }
  return rects;
}

function findTerminal(
  projects: ProjectData[],
  terminalId: string,
): RectInput | null {
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.id === terminalId) {
          return {
            id: terminal.id,
            x: terminal.x,
            y: terminal.y,
            width: terminal.width,
            height: terminal.height,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Grid auto-placement. New terminals fill the worktree's tiles into a compact
 * grid anchored at the cluster's top-left, filling COLUMN-MAJOR (down, then
 * across) — so tile 1 sits top-left, tile 2 below it, tile 3 starts the next
 * column, etc. The number of rows is chosen to fit the visible viewport height,
 * so the grid stays in view and the most tiles are visible. Returns null when
 * the worktree has no tiles yet (caller falls through to viewport-centre).
 */
function gridSlotAnchor(
  projects: ProjectData[],
  projectId: string,
  worktreeId: string,
  width: number,
  height: number,
  viewportRect?: { x: number; y: number; w: number; h: number },
): { x: number; y: number } | null {
  const project = projects.find((entry) => entry.id === projectId);
  const worktree = project?.worktrees.find((entry) => entry.id === worktreeId);
  if (!worktree) {
    return null;
  }

  const tiles = worktree.terminals.filter((t) => !t.stashed);
  if (tiles.length === 0) {
    return null;
  }

  // Cluster origin: top-left of the existing tiles.
  let minX = Infinity;
  let minY = Infinity;
  for (const tile of tiles) {
    minX = Math.min(minX, tile.x);
    minY = Math.min(minY, tile.y);
  }

  // Rows that fit the visible viewport height (clamped to a sensible band so
  // we always make a real grid, never a single row).
  const cellH = height + ADJACENCY_GAP;
  let rows = 2;
  if (viewportRect && viewportRect.h > 0 && cellH > 0) {
    rows = Math.max(1, Math.floor(viewportRect.h / cellH));
  }
  rows = Math.max(2, Math.min(rows, 4));

  const index = tiles.length; // slot for the new tile
  const col = Math.floor(index / rows);
  const row = index % rows;

  return {
    x: minX + col * (width + ADJACENCY_GAP),
    y: minY + row * (height + ADJACENCY_GAP),
  };
}

/**
 * Fallback anchor when the target worktree is empty but other worktrees in
 * the same project still have terminals. Picks the project-wide rightmost
 * tile so the new terminal clusters with its "relatives" instead of landing
 * at the origin.
 */
function projectAnchor(
  projects: ProjectData[],
  projectId: string,
  excludeWorktreeId: string,
): { x: number; y: number; right: number } | null {
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }

  let rightmost: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  for (const worktree of project.worktrees) {
    if (worktree.id === excludeWorktreeId) continue;
    for (const tile of worktree.terminals) {
      if (tile.stashed) continue;
      if (!rightmost || tile.x + tile.width > rightmost.x + rightmost.width) {
        rightmost = {
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
        };
      }
    }
  }

  if (!rightmost) {
    return null;
  }
  return {
    x: rightmost.x,
    y: rightmost.y,
    right: rightmost.x + rightmost.width,
  };
}

export interface PlacementResult {
  x: number;
  y: number;
  /** Other terminals nudged out of the way (already collision-resolved). */
  nudged: Array<{ id: string; x: number; y: number }>;
}

export function pickPlacement(input: PlacementInput): PlacementResult {
  const { projects, parentTerminalId, width, height } = input;

  let anchor: { x: number; y: number };

  if (input.preferredPosition) {
    anchor = input.preferredPosition;
  } else if (parentTerminalId) {
    const parent = findTerminal(projects, parentTerminalId);
    if (parent) {
      anchor = {
        x: parent.x + parent.width + ADJACENCY_GAP,
        y: parent.y,
      };
    } else {
      anchor = input.fallback ?? { x: 0, y: 0 };
    }
  } else {
    // Anchor priority when neither preferredPosition nor parent is given:
    //   1. next slot in a compact GRID of the target worktree's tiles
    //      (column-major, sized to the viewport — keeps the most tiles visible)
    //   2. rightmost terminal in another worktree of the same project
    //      ("climb up to find relatives")
    //   3. viewport centre (empty project → drop the first tile in front of
    //      the user, not at the origin)
    //   4. provided fallback or {0, 0}
    const grid = gridSlotAnchor(
      projects,
      input.projectId,
      input.worktreeId,
      width,
      height,
      input.viewportRect,
    );
    if (grid) {
      anchor = grid;
    } else {
      const relative = projectAnchor(
        projects,
        input.projectId,
        input.worktreeId,
      );
      if (relative) {
        anchor = {
          x: relative.right + ADJACENCY_GAP,
          y: relative.y,
        };
      } else if (input.viewportRect) {
        anchor = {
          x: input.viewportRect.x + (input.viewportRect.w - width) / 2,
          y: input.viewportRect.y + (input.viewportRect.h - height) / 2,
        };
      } else {
        anchor = input.fallback ?? { x: 0, y: 0 };
      }
    }
  }

  const x = snap(anchor.x);
  const y = snap(anchor.y);

  const placeholderId = "__placement_placeholder__";
  const allRects = collectRects(projects);
  allRects.push({ id: placeholderId, x, y, width, height });

  const resolved = resolveCollisions(allRects, ADJACENCY_GAP, placeholderId);
  const placeholder = resolved.find((rect) => rect.id === placeholderId);

  const nudged: Array<{ id: string; x: number; y: number }> = [];
  for (const rect of resolved) {
    if (rect.id === placeholderId) continue;
    const original = allRects.find((entry) => entry.id === rect.id);
    if (original && (original.x !== rect.x || original.y !== rect.y)) {
      nudged.push({ id: rect.id, x: rect.x, y: rect.y });
    }
  }

  return {
    x: placeholder?.x ?? x,
    y: placeholder?.y ?? y,
    nudged,
  };
}
