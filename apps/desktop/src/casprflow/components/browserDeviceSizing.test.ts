import { describe, expect, it } from "vitest";
import { resolveBrowserWindowSize, resolveCenteredBrowserBounds } from "./browserDeviceSizing";

describe("resolveBrowserWindowSize", () => {
  it("adds browser chrome to the desktop viewport", () => {
    expect(resolveBrowserWindowSize({ width: 1920, height: 1080 }, 36)).toEqual({
      width: 1920,
      height: 1116,
    });
  });

  it("adds browser chrome to a device viewport", () => {
    expect(resolveBrowserWindowSize({ width: 393, height: 852 }, 36)).toEqual({
      width: 393,
      height: 888,
    });
  });

  it("preserves the canvas-window center when applying a preset", () => {
    expect(
      resolveCenteredBrowserBounds(
        { x: 100, y: 200, width: 1920, height: 1116 },
        { width: 393, height: 852 },
        36,
      ),
    ).toEqual({ x: 863.5, y: 314, width: 393, height: 888 });
  });

  it("grows back to desktop around the same center", () => {
    expect(
      resolveCenteredBrowserBounds(
        { x: 863.5, y: 314, width: 393, height: 888 },
        { width: 1920, height: 1080 },
        36,
      ),
    ).toEqual({ x: 100, y: 200, width: 1920, height: 1116 });
  });
});
