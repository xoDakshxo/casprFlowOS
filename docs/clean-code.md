# Clean Code Guidelines — casprFlowOS

The whole point of this rewrite is a **clean codebase**. These are the rules the repo
holds itself to. They are not aspirational — code that violates them doesn't merge.

## North stars

1. **Subtract first.** This project exists because TermCanvas accreted fluff. Default to
   deleting. Every file must earn its place; if you can't say what breaks when it's gone,
   it goes.
2. **One source of truth.** Especially: the **capability registry** is the only list of
   "what the canvas can do." No parallel command lists, no duplicated type definitions, no
   copy-pasted constants. Derive, don't duplicate.
3. **Boundaries are real.** Packages talk through their public `index.ts` and through
   interfaces in `shared`. No deep imports into another package's internals.
4. **Read like the neighbours.** Match the surrounding file's naming, structure, and
   comment density. Consistency over personal style.

## Monorepo boundaries

```
shared      ← depended on by everything; depends on nothing internal
ui          ← shared
canvas-core ← shared
terminal    ← shared, (canvas-core types via shared interfaces)
voice       ← shared, ui
agents      ← shared   (acts on canvas/terminal via capability PORTS in shared)
mcp         ← shared, ui
apps/desktop← may import any package; nothing imports it
```

- **Dependency arrows point inward.** A package never imports `apps/desktop`. `agents`
  never imports `canvas-core`'s internals — it calls a `CanvasPort` interface defined in
  `shared` and implemented by the app wiring. This is what keeps the intent layer testable
  without a running canvas.
- **No circular dependencies.** If two packages need each other, the shared contract
  belongs in `shared`.
- Each package exposes exactly one entrypoint: `src/index.ts`. Everything else is private.

## TypeScript

- **Strict mode, no escapes.** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax` are on (see `tsconfig.base.json`).
  No `// @ts-ignore` without a one-line reason and a linked issue.
- **No `any`.** Use `unknown` + narrowing at boundaries. Validate external/IPC/LLM input
  with a schema (zod) and parse to a typed value at the edge.
- **Types describe intent.** Prefer discriminated unions over boolean flags and optional
  soup. Make illegal states unrepresentable.
- **Named exports only.** No default exports (except where a framework demands it, e.g. a
  React page). Easier to grep, rename, and tree-shake.

## Functions & modules

- Small, single-responsibility functions; a function that needs a section comment to
  explain its parts wants to be several functions.
- Pure core, effectful edge: keep canvas math, routing, and scene logic pure and
  unit-testable; push IPC, fs, pty, and network to the app/main boundary.
- Files stay focused. If a file crosses ~300 lines or two concerns, split it.

## React / renderer

- Function components + hooks. State in Zustand stores (as inherited), one store per
  concern; no god-store.
- Components render; they don't fetch or run business logic. Side-effects go in hooks or
  stores; orchestration goes in `agents`.
- Styling via the `ui` design tokens — **no hardcoded hex/spacing in components.** If you
  need a value that isn't a token, add a token.
- Keep the canvas render path lean (it's the perf-critical surface). No allocation in hot
  render/scroll/zoom loops; memoize projections.

## Electron / security

- `contextIsolation: true`, `nodeIntegration: false`. The renderer never touches `fs`,
  `child_process`, `net`, or `shell` directly.
- The preload exposes a **narrow, typed** `contextBridge` surface — one function per
  capability, validated args, no raw IPC passthrough.
- Anything filesystem/pty/network/shell lives in main behind a named IPC channel with
  validated payloads. Treat all renderer→main input as untrusted.
- Secrets (connector tokens, API keys) live in the OS keychain, never in the scene file,
  never in git, never logged.

## Latency discipline (the voice path)

- The FastRouter common path is **synchronous and zero-network**. Don't `await` anything
  on it. The planner LLM call is the only network on the dispatch path and only on a miss.
- Prewarm hot windows/overlays at launch; the hotkey only shows them.
- See [`voice-and-intent.md`](voice-and-intent.md) and
  [`reference/casprflow-latency.md`](reference/casprflow-latency.md).

## Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for components (match the package's
  existing convention when porting).
- Symbols: `camelCase` values, `PascalCase` types/components, `SCREAMING_SNAKE` consts.
- Names say what, not how. `focusWindow(callsign)` not `doFocus(s)`. No abbreviations that
  aren't industry-standard.
- Capabilities are `snake_case` strings (`focus_window`) — that's the model-facing name and
  matches the catalog schema.

## Comments

- Comment **why**, not what. The code says what.
- Each package/`index.ts` has a short header comment: its responsibility and its
  boundaries (what it may and may not depend on).
- No commented-out code. Delete it; git remembers.

## Tests

- Test the **pure cores**: FastRouter (table-driven utterance→call), scene/focus math,
  callsign allocation/resolution, capability `execute` against fake ports, the
  Orchestrator's threading/gating.
- Never hit the network or a real LLM in tests — stub behind the `LLMCompleting` seam.
- A bug fix lands with the test that would have caught it.
- Port only the TermCanvas tests for modules we keep; don't carry dead tests.

## Errors & logging

- Fail loud at boundaries, degrade gracefully in the UI. The voice HUD must always render
  *something* truthful — success, clarification, or a plain-English error.
- One logger from `shared`; structured, leveled. No stray `console.log` in committed code.

## Commits / PRs

- Small, reviewable, one concern per PR. A phase is many PRs, not one mega-commit.
- Each PR states which phase + checklist item it advances (see `implementation/`).
- Green typecheck + lint + tests before merge. No "fix later" TODOs without a linked issue.

## The "would I be proud of this" bar

Per the user's framing: every phase should be done **with taste**. Before merging, ask:
is this the version a careful engineer would be happy to show someone? If not, it's not
done — but also don't gold-plate beyond the phase's scope. Taste = right-sized, not maximal.
