import { createId } from "@casprflowos/shared";

import type { CanvasProject, CanvasWindow } from "./types";

export const ids = {
  project: createId("project", "alpha"),
  secondProject: createId("project", "beta"),
  worktree: createId("worktree", "main"),
  secondWorktree: createId("worktree", "feature"),
  orion: createId("window", "orion"),
  vega: createId("window", "vega"),
  nova: createId("window", "nova"),
} as const;

export const windowFixture = (
  id: CanvasWindow["id"],
  x: number,
  y: number,
  focused = false,
): CanvasWindow => ({
  id,
  callsign: id === ids.orion ? "Orion" : id === ids.vega ? "Vega" : "Nova",
  agentLabel: "Codex",
  projectId: ids.project,
  worktreeId: ids.worktree,
  position: { x, y },
  size: { width: 320, height: 220 },
  focused,
  minimized: false,
  stashed: false,
  status: "idle",
});

export const projectFixture = (
  windows: readonly CanvasWindow[],
  worktreeId = ids.worktree,
  projectId = ids.project,
): CanvasProject => ({
  id: projectId,
  name: projectId === ids.project ? "Alpha" : "Beta",
  path: projectId === ids.project ? "/repo/alpha" : "/repo/beta",
  worktrees: [
    {
      id: worktreeId,
      name: "main",
      path: "/repo/alpha",
      isPrimary: true,
      windows,
    },
  ],
});
