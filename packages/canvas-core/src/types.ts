import type {
  CanvasPoint,
  CanvasSize,
  CanvasViewport,
  CanvasWindowStatus,
  Id,
} from "@casprflowos/shared";

export type {
  CanvasPoint,
  CanvasSize,
  CanvasViewport,
  CanvasWindowStatus,
} from "@casprflowos/shared";

export interface CanvasWindow {
  readonly id: Id<"window">;
  readonly callsign: string;
  readonly agentLabel: string;
  readonly projectId: Id<"project">;
  readonly worktreeId: Id<"worktree">;
  readonly position: CanvasPoint;
  readonly size: CanvasSize;
  readonly focused: boolean;
  readonly minimized: boolean;
  readonly stashed: boolean;
  readonly status: CanvasWindowStatus;
}

export interface CanvasWorktree {
  readonly id: Id<"worktree">;
  readonly name: string;
  readonly path: string;
  readonly isPrimary: boolean;
  readonly windows: readonly CanvasWindow[];
}

export interface CanvasProject {
  readonly id: Id<"project">;
  readonly name: string;
  readonly path: string;
  readonly worktrees: readonly CanvasWorktree[];
}

export interface CanvasScene {
  readonly version: 1;
  readonly viewport: CanvasViewport;
  readonly projects: readonly CanvasProject[];
}

export interface CanvasRect extends CanvasPoint, CanvasSize {}

export interface MutableCanvasSceneStore {
  readonly getScene: () => CanvasScene;
  readonly setScene: (scene: CanvasScene) => void;
}
