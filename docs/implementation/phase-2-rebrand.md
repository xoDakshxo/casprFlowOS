# Phase 2 — Rebrand

**Goal:** erase the TermCanvas identity and establish casprFlowOS — name, app id, logo,
loading animation, window chrome. After this phase nothing says "TermCanvas."

**Why here:** the core is clean (Phase 1) but still wears TermCanvas's skin. Rebrand on a
small, clean tree before the surface area grows.

## Tasks

- [ ] **Identity sweep.** Replace across the repo:
      - `termcanvas` / `TermCanvas` → `casprflowos` / `casprFlowOS`
      - package names → `@casprflowos/*`
      - Electron `appId`, product name, `userData` dir, app `name`
      - IPC channel prefixes, window title, About text
      - Remove `blueberrycongee`, TermCanvas URLs, update feeds, analytics keys.
- [ ] **Logo + animation.** Wire `assets/logo/logo-white.svg` as the app/menu logo. Build a
      React port (or inline SVG) of `logo-loading.svg` as `<LogoSpinner>` in `ui` — keep the
      `cubic-bezier(0.23, 1, 0.32, 1)` fill loop; recolor to `--accent`. This becomes the
      voice HUD processing spinner later.
- [ ] **App icon.** Generate `.icns`/`.ico`/`png` from the logo for `electron-builder`.
- [ ] **Window chrome.** Custom frameless title bar (quiet, dark, glass) with the logo +
      app name + window controls. No native chrome clutter.
- [ ] **Strip remaining i18n.** Remove the `i18n` package/dir entirely and the Chinese
      locale; English-only (any `useT()` survivors from Phase 1 get inlined).
- [ ] **electron-builder config.** Product name, appId (`dev.casprflowos.app` or chosen),
      artifact naming, icon paths. Drop TermCanvas's release/notarization specifics until
      Phase 10.
- [ ] **README/docs** in code comments point to the new identity.

## Where

Whole tree — but it's mostly find/replace + asset wiring. `apps/desktop` (electron config,
title bar), `packages/ui` (`LogoSpinner`), `assets/`.

## Exit criterion

- `grep -ri "termcanvas\|blueberrycongee" packages apps` returns nothing (outside
  `docs/reference` history notes).
- The app launches showing the casprFlow logo, casprFlowOS name, custom dark title bar.
- The loading spinner is the casprFlow fill animation in the brand accent.

## Watch-outs

- Don't rebrand the **CasprFlow reference docs** in `docs/reference/` — those are historical
  source material; leave them as-is.
- Bundle id / userData dir rename means existing dev state resets — fine, we're pre-release.
- Keep the find/replace surgical; don't rename variables that merely contain "canvas"
  (that's our domain word) — only the product name `TermCanvas`.
