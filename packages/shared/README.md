# @casprflowos/shared

The cross-cutting substrate every other package builds on. Smallest possible surface.

## Responsibility
- Core types: `Id`/brand helpers, `Result`, `CapabilityResult`, `Plan`.
- The **ports** the intent layer acts through: `CanvasPort`, `TerminalPort`, `OsPort`
  (interfaces; implemented by the app wiring, not here).
- Intent primitives: `Capability`, `CapabilityCall`, `ExecutionContext`, `LLMCompleting`
  seam.
- The **OS object model** (`OsObject` union) + `OsStore` contract.
- `CallsignAllocator` (sci-fi window callsigns) + name pool data.
- Logger interface + console impl; a small typed event bus.

## Boundaries
- **Depends on nothing internal.** Everything depends on it.
- No React, no Electron, no fs/network here — pure types + tiny pure utilities, so it's
  trivially testable and importable from main or renderer.

## Why ports live here
`agents` must drive the canvas/terminals **without importing their internals** — it calls
these interfaces, which the app implements. That's what keeps the intent layer unit-testable
with fakes. See [`../../docs/architecture.md`](../../docs/architecture.md).
