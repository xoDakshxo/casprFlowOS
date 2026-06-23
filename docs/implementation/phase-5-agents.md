# Phase 5 — Agents on the canvas

**Goal:** turn terminals into **named agents**. Add Claude Code, Codex, and other agents to
the canvas; assign each a sci-fi **callsign**; show agent identity + status everywhere.

**Why here:** the canvas + terminals + rails exist; now make them *agentic*. Callsigns are
a prerequisite for voice/text targeting (Phase 6+).

## Tasks

- [ ] **Agent adapters.** Port/trim TermCanvas's agent integration (`cli-launchers`,
      `cli-registration`, `agent-service`, `claude-code-driver`, `opencode-session`) into a
      clean `terminal` agent-adapter interface:
      ```ts
      interface AgentAdapter {
        id: "claude-code" | "codex" | string;
        label: string;            // "Claude Code", "Codex"
        badge: ReactNode;         // icon
        launch(opts: LaunchOpts): PtySpec;   // how to start it in a pty
        detectStatus(signal: PtySignal): AgentStatus;  // idle/running/waiting/done/error
      }
      ```
- [ ] **Registry** of available adapters; "Add agent" UI (toolbar + right-click canvas +
      command later) lets you pick an agent + project/worktree and spawn a tile.
- [ ] **Callsigns.** Implement `CallsignAllocator` (see
      [`../window-naming.md`](../window-naming.md)) in `shared`; assign on spawn; show on
      tile header, left-rail row, and (later) HUD. Support rename.
- [ ] **Status model.** Each agent tile surfaces status (idle/running/waiting/done/error)
      via a status dot using the design tokens; the left rail mirrors it.
- [ ] **Spawn flow** is the seam the `spawn_agent` capability (Phase 6) will call — expose
      it as a typed function on the `TerminalPort`/`CanvasPort` in `shared`, not just UI.
- [ ] **Default-open canvas.** On launch, restore the favourite project's canvas with its
      agents (or offer a one-click "open my agents" if none saved) — delivering "comes in
      and straight up sees an agent canvas for their fav project."

## Where

`packages/terminal` (adapters, spawn), `packages/shared` (callsign allocator, ports,
status types), `packages/ui` (add-agent UI, badges, status dots), `apps/desktop` (adapter
launch in main pty host).

## Exit criterion

- You can add a Claude Code agent and a Codex agent to the canvas; each gets a distinct
  callsign and agent badge; status updates live; the left rail lists them by callsign.
- Relaunching the app reopens the favourite project's agent canvas.

## Watch-outs

- Status detection from raw pty output is fiddly — keep `detectStatus` per-adapter and
  conservative; a wrong "done" is worse than a late "running".
- Callsign phonetic-distinctness matters for voice — test the allocator's collision
  avoidance now, before voice lands.
- Keep the spawn path callable headlessly (a function on a port), so Phase 6's capability
  and Phase 7's voice both reuse it — no logic trapped in a click handler.
