# @casprflowos/terminal

Terminal tiles and the agents that run inside them.

## Responsibility
- Terminal tiles (ported from TermCanvas `src/terminal/`): xterm/wterm rendering, runtime
  store, focus scheduler, font loading, visibility/throttle. Rendered on a **translucent**
  surface (design-language transparent terminals).
- **Agent adapters**: Claude Code, Codex, and others — `AgentAdapter` interface
  (launch spec, status detection, badge). A registry of available adapters.
- The spawn path (callable as a function on `TerminalPort`, not trapped in UI) so the
  `spawn_agent` capability and voice both reuse it.
- Agent status model (idle/running/waiting/done/error) surfaced to tiles + left rail.

## Boundaries
- May depend on `@casprflowos/shared` (ports, callsign allocator, status types) and
  `@casprflowos/ui` (tile chrome). The actual pty process runs in `apps/desktop` main; this
  package talks to it through the typed IPC/port — **no `child_process`/`node-pty` import
  here.**
- Implements `TerminalPort`; does not import `agents`.

See [`../../docs/implementation/phase-5-agents.md`](../../docs/implementation/phase-5-agents.md).
