# Phase 1 — Cleanup & extract the core

**Goal:** port **only** the bare-bones infra from TermCanvas — an infinite canvas with
real pty terminal tiles and the **whole Codex-style project/code panel** (file-structure
tree + diffs + git + file editor) in the left work sidebar — into `casprFlowOS`. Delete
everything else. This phase **subtracts more than it adds.**

**Why now:** before rebranding or building features, establish the clean core. Carrying
fluff into the rebrand means rebranding fluff.

> Drive every decision from [`../extraction-map.md`](../extraction-map.md). When in doubt,
> **don't port it.**

## Tasks

### Canvas → `packages/canvas-core`
- [ ] Port `src/canvas/` (XyFlow canvas, scene state/projection, focus/zoom/pan,
      placement, viewport bounds). Drop drawing/annotation/cluster/waypoint layers.
- [ ] Port the kept stores: `canvasStore`, `canvasRegistryStore`, `projectStore`,
      `selectionStore`, `projectFocus`. Rewrite imports to the new package graph.
- [ ] Define a `CanvasPort` interface in `shared` (focus/pan/zoom/list-windows/arrange) —
      the seam the intent layer will call in Phase 6. Implement it over the scene store.

### Terminals → `packages/terminal`
- [ ] Port `TerminalTile`/`WtermTile`, `terminalRuntimeStore`, `focusScheduler`,
      `fontLoader`, visibility/throttle helpers. Drop sparkline/telemetry/insights bits.
- [ ] Port the main-process **pty host**: `pty-manager`, `pty-launch`, `process-detector`,
      `render-throttling-coordinator` into `apps/desktop` main, behind typed IPC.
- [ ] Wire a terminal tile to a live pty round-trip (type in one terminal, see output).

### Project/code panel (file tree + diffs + git) → main + `ui`
- [ ] Port `git-diff`, `git-info`, `git-paths`, `git-watcher`, `file-tree-watcher`,
      `fs-copy`, `file-url` into main behind IPC.
- [ ] Port the **entire `RightPanel/` suite** — `RightPanel.tsx` + `DiffContent` +
      `GitContent` + `FilesContent` + `gitContentLayout` + `repoContext` — **kept whole**.
      This is the Codex-style project/code panel: the **project/file-structure tree**, the
      **diffs**, **git status**, and the file editor — not a reduced diff-only view.
- [ ] Mount the whole panel in the **left work sidebar** (per the vision it lives on the
      left). Rename `RightPanel` → e.g. `WorkPanel`/`CodePanel`; keep all its tabs/parts.

### Sessions (left-rail) → main + `ui`
- [ ] Port `session-discovery/list/scanner/watcher` (trim search-index/fork if unused) +
      `sessionStore`. Port `LeftPanel` + `ProjectTree` + `SessionsPanel` render.

### Delete (do not port)
- [ ] Everything marked DROP in the extraction map: pet, insights, usage, telemetry,
      pins, memory, hub, hydra, browse, eval, server, headless-runtime, supabase, i18n,
      drawing, clustering, command-palette (rebuild later), snapshot-history UI,
      auth/updater.
- [ ] As you port each file, **delete its `useT()`/i18n usage** and replace with English
      strings (i18n is dropped).

## Where

`packages/canvas-core`, `packages/terminal`, `apps/desktop` (main pty + git IPC),
`packages/ui` (rail render). Source: `../termcanvas/{src,electron}`.

## Exit criterion

`pnpm dev` opens a canvas where you can: add a project, see worktrees, open terminal tiles
that run a **real shell**, focus/pan/zoom windows, and use the **full project/code panel**
in the left work sidebar (browse the file-structure tree, see live diffs and git status,
open a file) as files change. None of the DROP features exist in the tree (`grep` for `pet`, `insights`,
`usage`, `pin`, `hydra` returns nothing in `src`/`packages`).

## Watch-outs

- Port in **dependency order**: types → stores → pure logic → components. Rewrite imports
  as you go; don't leave a half-ported store importing dead modules.
- The canvas render path is perf-critical — preserve TermCanvas's throttling/visibility
  optimizations; don't naively re-render on every pty byte.
- Resist "I'll keep this, might need it." The extraction map already decided. Delete.
- Keep PRs small: "port canvas scene state", "port pty host", "port diff rail" are
  separate PRs.
