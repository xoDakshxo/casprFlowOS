import { describe, expect, it } from "vitest";
import { shouldBrowserCaptureInput } from "./browserInteraction";

describe("shouldBrowserCaptureInput", () => {
  it("keeps an unselected browser passive", () => {
    expect(shouldBrowserCaptureInput(false, false)).toBe(false);
  });

  it("keeps a box-selected but unfocused browser passive", () => {
    expect(shouldBrowserCaptureInput(false, true)).toBe(false);
  });

  it("allows interaction after explicit focus and selection", () => {
    expect(shouldBrowserCaptureInput(true, true)).toBe(true);
  });
});
