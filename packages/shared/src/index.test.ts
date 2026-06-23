import { describe, expect, it } from "vitest";

import { createEventBus, createId, err, ok } from "./index";

describe("shared primitives", () => {
  it("brands ids without changing their runtime value", () => {
    expect(createId("window", "orion")).toBe("window:orion");
  });

  it("creates result unions", () => {
    expect(ok("ready")).toEqual({ ok: true, value: "ready" });
    expect(err("nope")).toEqual({ ok: false, error: "nope" });
  });

  it("publishes typed events to subscribers", () => {
    const bus = createEventBus<{ ready: { readonly message: string } }>();
    const messages: string[] = [];

    const unsubscribe = bus.subscribe("ready", (payload) => {
      messages.push(payload.message);
    });

    bus.publish("ready", { message: "booted" });
    unsubscribe();
    bus.publish("ready", { message: "ignored" });

    expect(messages).toEqual(["booted"]);
  });
});
