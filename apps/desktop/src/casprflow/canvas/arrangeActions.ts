import { useArrangingStore } from "../stores/arrangingStore";
import { useCanvasStore } from "../stores/canvasStore";
import { usePinStore } from "../stores/pinStore";
import { useProjectStore } from "../stores/projectStore";
import {
  clampCenterX,
  getCanvasLeftInset,
  getCanvasRightInset,
  getVisibleCanvasWorldRect,
} from "./viewportBounds";
import { clampScale } from "./viewportZoom";
import { computeCompactOffsets } from "./worktreeCompactLayout";

/**
 * Animate the camera to frame a worktree's tiles, capped at 100% — so a small
 * grid shows at exactly 100% (never blown up) and a large one zooms out just
 * enough to keep everything visible. Keeps the user from roaming the canvas.
 */
function frameWorktree(projectId: string, worktreeId: string): void {
  const { projects } = useProjectStore.getState();
  const project = projects.find((p) => p.id === projectId);
  const worktree = project?.worktrees.find((w) => w.id === worktreeId);
  if (!worktree) return;
  const tiles = worktree.terminals.filter((t) => !t.stashed);
  if (tiles.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.width);
    maxY = Math.max(maxY, t.y + t.height);
  }
  const sizeW = maxX - minX;
  const sizeH = maxY - minY;

  const cs = useCanvasStore.getState();
  const leftOffset = getCanvasLeftInset(
    cs.leftPanelCollapsed,
    cs.leftPanelWidth,
    usePinStore.getState().openProjectPath !== null,
  );
  const rightOffset = getCanvasRightInset(
    cs.rightPanelCollapsed,
    cs.rightPanelWidth,
  );
  const padding = 80;
  const viewW = window.innerWidth - leftOffset - rightOffset - padding * 2;
  const viewH = window.innerHeight - padding * 2;
  // Cap at 1 (100%): only zoom OUT to fit a big grid, never zoom in.
  const scale = clampScale(Math.min(1, viewW / sizeW, viewH / sizeH));

  const centerX = clampCenterX(minX, sizeW, scale, leftOffset, rightOffset);
  const centerY = -(minY + sizeH / 2) * scale + window.innerHeight / 2;
  cs.animateTo(centerX, centerY, scale);
}

/**
 * Window arranger — tidies the focused worktree's tiles into a chosen layout
 * and frames them. User-invoked (from the canvas toolbar), so it only ever
 * rearranges on demand — manual placement is respected until the user asks.
 */
export type ArrangeLayout = "grid" | "columns" | "rows";

function targetWorktree(): { projectId: string; worktreeId: string } | null {
  const { projects, focusedProjectId, focusedWorktreeId } =
    useProjectStore.getState();

  const hasTiles = (projectId: string, worktreeId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const worktree = project?.worktrees.find((w) => w.id === worktreeId);
    return !!worktree && worktree.terminals.some((t) => !t.stashed);
  };

  if (
    focusedProjectId &&
    focusedWorktreeId &&
    hasTiles(focusedProjectId, focusedWorktreeId)
  ) {
    return { projectId: focusedProjectId, worktreeId: focusedWorktreeId };
  }

  for (const project of projects) {
    for (const worktree of project.worktrees) {
      if (worktree.terminals.some((t) => !t.stashed)) {
        return { projectId: project.id, worktreeId: worktree.id };
      }
    }
  }
  return null;
}

const SPAWN_GRID_GAP = 16;

/**
 * Lay a worktree's tiles into a compact, square-ish grid filled COLUMN-MAJOR
 * (tile 1 top-left, 2 below it, 3 starts the next column, …), then frame it.
 *
 * Used on spawn so adding agents always builds a tidy, predictable grid that
 * stays in view — the camera frames the whole worktree afterwards rather than
 * chasing a single tile off into empty canvas. Anchored at the existing
 * cluster's top-left so the grid doesn't jump around.
 */
export function gridLayoutWorktree(
  projectId: string,
  worktreeId: string,
  newTileId?: string,
): void {
  const { projects } = useProjectStore.getState();
  const project = projects.find((p) => p.id === projectId);
  const worktree = project?.worktrees.find((w) => w.id === worktreeId);
  if (!worktree) return;

  const tiles = worktree.terminals.filter((t) => !t.stashed);
  if (tiles.length === 0) return;

  // Anchor at the top-left of the tiles that were already placed (excluding the
  // just-spawned one, which may have landed anywhere); fall back to the new
  // tile's own spot, then the origin.
  const anchorPool = newTileId
    ? tiles.filter((t) => t.id !== newTileId)
    : tiles;
  const pool = anchorPool.length > 0 ? anchorPool : tiles;
  const anchorX = Math.min(...pool.map((t) => t.x));
  const anchorY = Math.min(...pool.map((t) => t.y));

  const cellW = Math.max(...tiles.map((t) => t.width)) + SPAWN_GRID_GAP;
  const cellH = Math.max(...tiles.map((t) => t.height)) + SPAWN_GRID_GAP;
  const rows = Math.max(1, Math.ceil(Math.sqrt(tiles.length)));

  const updates = tiles.map((t, i) => ({
    projectId,
    worktreeId,
    terminalId: t.id,
    x: Math.round(anchorX + Math.floor(i / rows) * cellW),
    y: Math.round(anchorY + (i % rows) * cellH),
  }));

  // Glide tiles into place: flag the arrange so the canvas adds a transform
  // transition, then apply positions next frame (after the class lands).
  useArrangingStore.getState().begin();
  const apply = () => {
    useProjectStore.getState().updateTerminalPositions(updates);
    frameWorktree(projectId, worktreeId);
  };
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(apply);
  } else {
    apply();
  }
}

export function arrangeFocusedWorktree(layout: ArrangeLayout): void {
  const target = targetWorktree();
  if (!target) return;

  const { projects } = useProjectStore.getState();
  const project = projects.find((p) => p.id === target.projectId);
  const worktree = project?.worktrees.find((w) => w.id === target.worktreeId);
  if (!worktree) return;

  const tiles = worktree.terminals.filter((t) => !t.stashed);
  if (tiles.length === 0) return;

  const columns =
    layout === "rows"
      ? 1
      : layout === "columns"
        ? tiles.length
        : Math.ceil(Math.sqrt(tiles.length));

  const offsets = computeCompactOffsets(
    tiles.map((t) => ({ id: t.id, width: t.width, height: t.height })),
    columns,
  );

  // Anchor the tidy block at the visible viewport's top-left (+ margin) so it
  // lands where the user is looking.
  const cs = useCanvasStore.getState();
  const rect = getVisibleCanvasWorldRect(
    cs.viewport,
    cs.rightPanelCollapsed,
    cs.leftPanelCollapsed,
    cs.leftPanelWidth,
    cs.rightPanelWidth,
    usePinStore.getState().openProjectPath !== null,
  );
  const baseX = Math.round(rect.x + 24);
  const baseY = Math.round(rect.y + 24);

  const updates = tiles.map((t) => {
    const off = offsets.get(t.id) ?? { x: 0, y: 0 };
    return {
      projectId: target.projectId,
      worktreeId: target.worktreeId,
      terminalId: t.id,
      x: baseX + off.x,
      y: baseY + off.y,
    };
  });

  useArrangingStore.getState().begin();
  const apply = () => {
    useProjectStore.getState().updateTerminalPositions(updates);
    frameWorktree(target.projectId, target.worktreeId);
  };
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(apply);
  } else {
    apply();
  }
}
