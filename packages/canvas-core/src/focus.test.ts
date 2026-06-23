import { describe, expect, it } from "vitest";

import { pickCloseFocusTarget } from "./focus";
import { ids, projectFixture, windowFixture } from "./test-helpers";

describe("pickCloseFocusTarget", () => {
  it("returns the row-aligned left sibling first", () => {
    const project = projectFixture([
      windowFixture(ids.orion, 0, 0),
      windowFixture(ids.vega, 328, 0, true),
      windowFixture(ids.nova, 700, 260),
    ]);

    expect(pickCloseFocusTarget([project], ids.vega)).toBe(ids.orion);
  });

  it("falls back to the nearest same-project window", () => {
    const project = projectFixture([
      { ...windowFixture(ids.orion, 0, 0), worktreeId: ids.secondWorktree },
      { ...windowFixture(ids.vega, 800, 0), worktreeId: ids.worktree },
    ]);

    expect(pickCloseFocusTarget([project], ids.vega)).toBe(ids.orion);
  });
});
