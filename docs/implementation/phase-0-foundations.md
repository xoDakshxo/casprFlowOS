# Phase 0 — Foundations

**Goal:** the empty monorepo installs and boots a single Electron window. No canvas yet —
just proof the skeleton wires together and the toolchain is green.

**Why first:** every later phase ports code into this shell. Get the boundaries, build, and
dev loop right once, on an empty repo, where mistakes are cheap.

## Tasks

- [ ] Root toolchain: confirm `pnpm install` works; add `prettier`, `eslint` (flat config),
      `typescript` at root. Wire `pnpm -r build/typecheck/lint/test`.
- [ ] `tsconfig.base.json` is the base; each package has a `tsconfig.json` extending it with
      `references` for project-graph builds.
- [ ] `packages/shared`: create `src/index.ts` exporting the cross-cutting primitives the
      app will need first — `Id`/`brand` helpers, `Result`/`CapabilityResult` shapes (stub),
      a `Logger` interface + console impl, an event-bus interface. Keep it tiny.
- [ ] `packages/ui`: create the design-token CSS (`tokens.css`) from
      [`../design-language.md`](../design-language.md) and a `.glass` utility. Export a
      `<GlassPane>` and `<GlassPill>` primitive. Nothing else yet.
- [ ] `apps/desktop`: minimal Electron app —
      - `electron/main.ts`: create one `BrowserWindow` (`contextIsolation: true`,
        `nodeIntegration: false`, frameless/vibrancy as the design calls for), load the
        renderer.
      - `electron/preload.ts`: empty typed `contextBridge` surface (the seam, no methods
        yet).
      - `src/main.tsx` + `src/App.tsx`: render a centered casprFlowOS logo + name on the
        dark-glass background. Use `@casprflowos/ui` tokens.
      - Vite config (adapt TermCanvas's `vite.config.ts`, stripped to the essentials:
        `vite-plugin-electron` + react).
- [ ] `pnpm dev` script boots it.
- [ ] CI-lite: a `pnpm verify` that runs typecheck + lint + test across the graph.

## Where

`apps/desktop`, `packages/shared`, `packages/ui`. Borrow the Vite/electron-plugin setup
from `../termcanvas/vite.config.ts` but **strip it to the minimum**.

## Exit criterion

`pnpm install && pnpm dev` opens a dark, glass-backed window showing the casprFlowOS logo
and name. `pnpm verify` is green. No TermCanvas code present yet.

## Watch-outs

- Get the **preload contextBridge typing** right now — it's the security seam every later
  IPC call goes through. One typed namespace, no raw `ipcRenderer` exposed.
- Don't copy TermCanvas's whole electron config; most of it is fluff you're about to reject.
- Decide frameless + custom title bar vs native now (design calls for a quiet custom chrome).
