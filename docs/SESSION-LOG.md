# Session Log — casprFlowOS shell rebuild

Working session capturing what was done, current state, and what's pending. For the
durable plan see `docs/implementation/` + `AGENTS.md`; this is the "where we left off."

## Where the build is

- **Phase 0** — done (Electron shell boots, dark glass window, `pnpm verify` green).
- **Phase 1** — partial. Codex ported the pure `canvas-core` (scene/focus/placement +
  `CanvasPort`, unit-tested) and hand-wrote a first app shell. The hand-written shell was
  poor, so this session rebuilt it (below). The **real termcanvas panel port is still
  pending** (see "Next").

## What this session changed (all in `apps/desktop`, uncommitted)

1. **Real terminals.** Replaced the `<pre>` + `<input>` pty dump with **xterm.js**
   (`@xterm/xterm` + `@xterm/addon-fit`). New `src/TerminalTile.tsx`: xterm mounts, pty
   `onData → term.write`, `term.onData → pty write`, FitAddon resize, transparent theme.
   Data is routed via a `registerWriter(ptyId, writer)` map in `App.tsx` (buffers until a
   tile mounts) — no per-byte React state.
2. **Stable shell layout** (`src/App.tsx` + `src/styles.css`): title bar + 3-col grid
   (work rail | canvas | OS rail). Both rails **collapsible** (toggles top-right, away
   from traffic lights). **Right rail hidden by default.**
3. **Liquid-glass rails.** `--glass-rail` alpha 0.30 + 46px blur. Key fix: `.app-shell`
   background is now **transparent** so rails sit over the window vibrancy and read as
   real glass; the dark plane is painted only on `.canvas-surface`.
4. **Title bar overlap fix.** Brand is **absolutely centered** in the title bar so it can
   never collide with the macOS traffic lights (left) or toggles (right). `main.ts` uses
   `titleBarStyle: hiddenInset`, `vibrancy: under-window`, transparent `backgroundColor`.
5. **Canvas pan/zoom fix.** Added a native non-passive `wheel` listener for trackpad
   **two-finger pan + pinch-zoom (toward cursor)**. Tiles `stopPropagation` on pointerdown
   so dragging empty canvas pans even with a terminal focused. Tiles drag by their header.
6. **Real diff view** (`src/DiffView.tsx`): colored +/- lines, file/hunk headers — not a
   raw `<pre>` dump.
7. **Quit crash fixed** (`electron/terminal-service.ts`): pty `onData/onExit` sends are
   guarded with `isDestroyed()` **and** try/catch, and the pty is killed on the owning
   `webContents` `"destroyed"` event. (Fixes `TypeError: Object has been destroyed`.)
8. Removed the blue `--canvas-void` glow → neutral translucent canvas plane + faint dots.

## Design guardrails added (so this stops regressing)

- `docs/design-rules.md` — the enforced floor (real-glass stack, computed/responsive
  spacing, tokens-only).
- `.codex/skills/casprflowos-design/SKILL.md` — auto-loads on UI work.
- `.stylelintrc.json` + `pnpm lint:css` — **fails the build** on raw-px padding/margin/gap
  and literal/opaque backgrounds. Referenced from `AGENTS.md`.
- Use the **`frontend-design` plugin** for net-new design (taste, non-templated).

## Verified

`pnpm --filter @casprflowos/desktop typecheck` / `lint` / `pnpm lint:css` all green.
Terminals render real TUIs (Claude Code shown working). Could not self-screenshot
(no screen-recording permission for the agent shell) — visual checks were done by the user.

## NEXT (the active directive — not yet started)

**Port termcanvas's panels verbatim**, adapting only the data boundary:
- Copy `../termcanvas/src/components/LeftPanel.tsx`, `ProjectTree.tsx`, `SessionsPanel.tsx`,
  and the whole `RightPanel/` suite (`RightPanel.tsx`, `DiffContent`, `FilesContent`,
  `GitContent`, `gitContentLayout`, `repoContext`) — the files, the **git diff**, the whole
  left panel and right panel — "same to same."
- Bring their **dependency closure**: the zustand stores they use, helper modules, and the
  relevant CSS from `../termcanvas/src/index.css`.
- **Rewire the data boundary** to casprFlowOS's existing main-process IPC
  (`window.casprFlowOS.git/workspace/...`) since termcanvas's git/file data shapes differ.
- **Strip i18n** (`useT()` → English strings); drop DROP-list deps per
  `docs/extraction-map.md`.
- A literal paste won't compile (stores/i18n/IPC/data-shape differences) — port the
  closure and adapt the edges. This is Phase 1's panel extraction done properly.

## casprOS glass re-skin (this session, uncommitted)

The codex port shipped with TermCanvas's **opaque warm-brown** palette (its
`casprflow/index.css` redefines `:root` → `--bg:#1a1918`, `--surface:#222120`, …), which
overrode the casprOS glass tokens — so nothing was actually glass. Re-skinned to casprOS:

- **New `apps/desktop/src/casprflow/caspr-glass.css`** — imported **last** in `main.tsx`
  so it wins over `index.css`. It (a) sets the canvas/app base `--bg` to **codex black**
  (`#131110`, a deep warm near-black — solid, so the canvas reads as codex black), (b)
  turns the legacy `--surface/--sidebar/--border` fills **translucent** so they layer on
  glass instead of stamping flat boxes, (c) defines **liquid-glass variants** per chrome
  tier (`--glass-rail / --glass-toolbar / --glass-pane / --glass-pill`) + a top specular
  `--glass-sheen` + hairline `--glass-edge`, and (d) nudges the accent to a soft casprOS
  blue (`#8fb6ff`) for live/focused state only.
- **`.caspr-rail`/`.caspr-toolbar`/`.caspr-pane`** classes do the real glass: translucent
  tint + `backdrop-filter: blur(44px) saturate(1.7)` + sheen + inset edge highlight.
- **Applied to roots:** `LeftPanel` → `caspr-rail caspr-rail--left`, `RightPanel` →
  `caspr-rail caspr-rail--right`, `Toolbar` → `caspr-toolbar` (dropped its opaque inline
  gradient), `BottomToolbar` pill → `--glass-pill`. Side panels are now liquid-glass
  windows floating over a codex-black canvas.
- Stylelint-safe: all raw colours live in `--*` token defs (exempt); backgrounds only
  reference `var()`. `typecheck` / `lint` / `lint:css` all green.

**Not yet glassed (next):** modal/drawer/hub bodies (CommandPalette, Hub, SearchModal,
FileEditorDrawer, SnapshotHistoryModal, Usage/Sessions overlays) still use the legacy
surfaces — give their roots `.caspr-pane` for "through and through." Also: make the glass
variants user-switchable (the "different variants" the vision wants) from the right rail.

## Run / git

- Launch: `pnpm dev` (from repo root). Main-process changes need a full restart, not HMR.
- Everything this session is **uncommitted**. Commit from the user's shell (signed; remote
  is the `github-personal` alias). See `docs/git` notes / memory.
