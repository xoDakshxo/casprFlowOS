import { describe, expect, it } from "vitest";

import { GlassPane, GlassPill } from "./index";

describe("glass primitives", () => {
  it("exports renderable React components", () => {
    expect(typeof GlassPane).toBe("function");
    expect(typeof GlassPill).toBe("function");
  });
});
