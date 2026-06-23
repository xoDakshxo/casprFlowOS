# @casprflowos/canvas-core

The infinite canvas: scene state, window placement, focus/zoom/pan, viewport.

## Responsibility
- The spatial canvas (ported from TermCanvas `src/canvas/`, fluff removed): scene state &
  projection, node placement, focus chain, zoom/pan, viewport bounds.
- Scene persistence (serialize/restore the canvas document so the app reopens to your
  agents).
- Implements the behaviour behind `CanvasPort` (focus/pan/zoom/list-windows/arrange) — the
  seam the intent layer calls.

## Boundaries
- May depend on `@casprflowos/shared` (types, ports). Provides the `CanvasPort`
  implementation; **does not** import `agents`.
- Terminal rendering lives in `terminal`; this package owns *placement and the scene*, not
  pty.

## Perf
This is the latency-critical render surface. No allocation in hot pan/zoom/scroll loops;
memoize projections; preserve the throttling/visibility optimizations carried from
TermCanvas. See [`../../docs/extraction-map.md`](../../docs/extraction-map.md).
