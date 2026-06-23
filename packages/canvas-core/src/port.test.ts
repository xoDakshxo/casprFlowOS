import { describe, expect, it } from "vitest";

import { createCanvasPort, createInMemorySceneStore } from "./port";
import { createCanvasScene } from "./scene";
import { ids, projectFixture, windowFixture } from "./test-helpers";

describe("createCanvasPort", () => {
  it("lists and focuses windows through the shared port", async () => {
    const store = createInMemorySceneStore(
      createCanvasScene([
        projectFixture([windowFixture(ids.orion, 0, 0), windowFixture(ids.vega, 328, 0)]),
      ]),
    );
    const port = createCanvasPort(store);

    expect(port.listWindows()).toHaveLength(2);
    await expect(port.focusWindow(ids.vega)).resolves.toMatchObject({
      ok: true,
      message: "Focused Vega.",
    });
    expect(port.getFocusedWindow()?.id).toBe(ids.vega);
  });

  it("arranges windows in a deterministic row", async () => {
    const store = createInMemorySceneStore(
      createCanvasScene([
        projectFixture([windowFixture(ids.orion, 100, 50), windowFixture(ids.vega, 100, 500)]),
      ]),
    );

    await createCanvasPort(store).arrange();

    expect(store.getScene().projects[0]?.worktrees[0]?.windows[0]?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(store.getScene().projects[0]?.worktrees[0]?.windows[1]?.position).toEqual({
      x: 344,
      y: 0,
    });
  });
});
