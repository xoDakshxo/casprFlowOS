import { describe, expect, it } from "vitest";

import { resolveCollisions } from "./collision";

describe("resolveCollisions", () => {
  it("nudges overlapping non-anchored rects apart", () => {
    const resolved = resolveCollisions(
      [
        { id: "a", x: 0, y: 0, width: 100, height: 100 },
        { id: "b", x: 50, y: 0, width: 100, height: 100 },
      ],
      8,
    );

    expect(resolved[0]?.x).toBeLessThan(0);
    expect(resolved[1]?.x).toBeGreaterThan(50);
  });

  it("keeps an anchored rect fixed", () => {
    const resolved = resolveCollisions(
      [
        { id: "anchor", x: 0, y: 0, width: 100, height: 100 },
        { id: "other", x: 50, y: 0, width: 100, height: 100 },
      ],
      8,
      "anchor",
    );

    expect(resolved.find((rect) => rect.id === "anchor")).toMatchObject({ x: 0, y: 0 });
    expect(resolved.find((rect) => rect.id === "other")?.x).toBeGreaterThan(50);
  });
});
