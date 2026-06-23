import { describe, expect, it } from "vitest";

import { pickWindowPlacement } from "./placement";
import { ids, projectFixture, windowFixture } from "./test-helpers";

describe("pickWindowPlacement", () => {
  it("places a new window beside the focused sibling", () => {
    const orion = windowFixture(ids.orion, 10, 20, true);
    const placement = pickWindowPlacement({
      projects: [projectFixture([orion])],
      projectId: ids.project,
      worktreeId: ids.worktree,
      size: { width: 320, height: 220 },
    });

    expect(placement.position).toEqual({ x: 340, y: 20 });
  });

  it("centers an empty project placement in the visible viewport", () => {
    const placement = pickWindowPlacement({
      projects: [projectFixture([])],
      projectId: ids.project,
      worktreeId: ids.worktree,
      size: { width: 300, height: 200 },
      viewportRect: { x: 100, y: 80, width: 900, height: 600 },
    });

    expect(placement.position).toEqual({ x: 400, y: 280 });
  });
});
