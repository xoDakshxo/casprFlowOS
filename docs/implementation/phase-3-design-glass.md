# Phase 3 — Design system & glass

**Goal:** the app *looks* like casprFlowOS — dark plane, glass rails/panes, translucent
terminals, and a themeable canvas background replacing the dotted grid.

**Why here:** with a clean, rebranded core, lock the visual language before building the
rails and features so everything after inherits it.

## Tasks

- [ ] **Tokens.** Finalize `packages/ui/tokens.css` from
      [`../design-language.md`](../design-language.md). Reconcile `--accent` to the
      casprFlow navy (or a derived on-dark blue) — set it **once**.
- [ ] **Primitives.** Build the `ui` kit: `GlassPane`, `GlassRail`, `GlassPill`,
      `LogoSpinner`, `Button`, `IconButton`, `Tooltip`, `ContextMenu`, `Divider`, status
      dots. All consume tokens; zero hardcoded hex/spacing.
- [ ] **Transparent terminals.** Make terminal tiles render on a translucent surface; add a
      per-user **terminal opacity** preference (default ~88%, clamped floor for legibility).
      Focused tile lifts toward opaque + accent focus ring.
- [ ] **Canvas themes.** Replace the fixed dotted background with a theme layer:
      `Void` (default), `Grid`, `Dots`, `Aurora`, `Carbon`. Theme = data
      (`{ id, name, layer, params }`) in `assets/themes/`; a `canvasThemeStore` holds the
      selection; the canvas renders the chosen background layer behind tiles/rails.
- [ ] **Glass everywhere chrome lives.** Apply glass to rails, modals, menus, the (stub)
      HUD pill. Hairline borders + faint top-light gradient; never glass under read-text.
- [ ] **Motion.** Standardize spring/easing constants in `ui` (focus, spawn, HUD appear).
      Sub-250ms, meaningful only.

## Where

`packages/ui` (the system), `packages/terminal` (translucent surface), `packages/canvas-core`
+ `assets/themes` (background themes), a `canvasThemeStore`.

## Exit criterion

- Rails, menus, and the HUD stub use the glass system; the canvas has a theme switcher with
  ≥3 working themes; terminals are translucent with a working opacity setting; the focused
  terminal is unmistakably the brightest element.
- No component contains a raw hex color or magic spacing number.

## Watch-outs

- `backdrop-filter` blur is GPU-costly; don't stack many large blurred layers — measure on
  a real canvas with several terminals.
- Keep terminal text contrast ≥ AA at the opacity floor; clamp, don't trust the user to.
- Themes are background-only — they must not affect tile/rail styling or readability.
