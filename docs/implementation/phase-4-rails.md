# Phase 4 — Rails (left work-rail + right OS-rail)

**Goal:** the two glass rails that frame the canvas. **Left** = the work (projects,
worktrees, sessions, and the **whole project/code panel** — file-structure tree, diffs, git,
editor). **Right** = the OS (projects, automations, skills, MCP connectors, profiles).

**Why here:** the rails are the persistent frame around the canvas and the home for many
later features. Build their shells now so Phases 5–9 plug into known slots.

## Tasks

### Left rail (work) — mostly assembling Phase 1 pieces
- [ ] Collapsible glass rail hosting the **whole project/code panel kept in Phase 1**, with
      its tabs/sections intact: **Sessions** (live projects → worktrees → terminals, click a
      row to pan to it), **Files** (the project/file-structure tree), **Diff** (live diffs),
      **Git** (status/branch). The full Codex-style panel, not a diff-only view.
- [ ] Each terminal/session row shows its **callsign** (Phase 5 fills these in) + agent
      badge + status dot.
- [ ] Files tree, Diff, and Git sections are live (git/file watchers) and
      click-to-open a file or its diff.

### Right rail (OS) — new
- [ ] Collapsible glass rail with OS sections, each a list surface over a local
      **OS object model** (define in `shared`): 
      - **Projects** — registered projects/favourites; pick the "favourite" that opens on
        launch.
      - **Automations** — saved command sequences / triggers (stub model now; wired in
        Phase 9).
      - **Skills** — reusable agent instructions/prompts (stub now).
      - **MCP Connectors** — installed connectors + connect/disconnect (framework in
        Phase 9; show empty-state now).
      - **Profiles** — user/workspace profiles & preferences (theme, terminal opacity,
        hotkey, model keys).
- [ ] Define `OsStore` + the `OsObject` discriminated union in `shared`; right-rail
      sections render from it. Persist locally; secrets to keychain (not the store).
- [ ] Rail open/close + resize, remembered in preferences.

## Where

`packages/ui` (rail components + section primitives), `packages/shared` (OS object model +
`OsStore`), `apps/desktop` (persistence/keychain IPC). Left-rail data from Phase 1.

## Exit criterion

- Both rails render in glass, collapsible, resizable, state remembered.
- Left rail: clicking a session row pans the canvas to that terminal; diff is live.
- Right rail: all five OS sections present; Projects lets you mark a **favourite project**
  that the app opens to on next launch (delivers the "opens straight to your favourite
  project" promise).

## Watch-outs

- The "favourite project opens on launch" flow touches scene restore — coordinate with the
  scene persistence from Phase 1.
- Right-rail sections are mostly **shells** here; don't build automations/MCP logic yet
  (Phase 9). Just the model + empty/stub UI.
- Keep the OS object model in `shared` so `agents` (Phase 6+) can read connectors/profiles
  for context without importing the rail.
