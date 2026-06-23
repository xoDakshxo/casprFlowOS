---
name: casprflowos-design
description: How to build UI in casprFlowOS without breaking the glass look or shipping non-responsive layouts. Use whenever creating or editing any component, stylesheet, design token, the Electron window, rails, panes, HUD, modals, or anything visual. Enforces real macOS glass (vibrancy + translucent layers), computed/responsive spacing, and tokens-only styling.
---

# casprFlowOS Design

Read [`docs/design-rules.md`](../../../docs/design-rules.md) (the enforced checklist) and
[`docs/design-language.md`](../../../docs/design-language.md) (the visual intent) before
writing UI. This skill is the short version + the traps that have actually bitten us.

## The two things that keep getting broken

### 1. Glass must be REAL glass
Glass only works if what's behind shows through. **Four layers must all stay translucent —
one opaque layer anywhere kills it:**

1. Window (`apps/desktop/electron/main.ts`): `vibrancy: "under-window"`,
   `visualEffectState: "active"`, `backgroundColor: "#00000000"`. Never opaque.
2. `html, body`: `background: transparent`. Never opaque.
3. App plane (`.app-shell`): `--bg-plane` (translucent, alpha < 1). Never an opaque fill.
4. Surfaces: `.glass` / `<GlassPane>`/`<GlassPill>` — translucent `--glass-*` tint **plus**
   `backdrop-filter: blur(...)`. Never an opaque background; never drop the blur.

If you write an opaque hex as a surface/background color, you're almost certainly wrong —
use a translucent `--glass-*` token. **Verify by running the app and looking:** panes must
look translucent against the desktop wallpaper, not like flat dark rectangles.

### 2. Spacing is COMPUTED + RESPONSIVE — never magic px
- Container padding/gaps → **fluid tokens**: `--pad-xs|sm|md|lg|xl`, `--gap-sm|md|lg`
  (each a `clamp(min, vw, max)`). The window resizes constantly; spacing must breathe.
- Fixed `--space-1..8` scale is ONLY for fine details (hairlines, icon gaps, 1px borders).
- ❌ Never a raw `px` in `padding`/`margin`/`gap`/`inset`. ❌ Layout-anchoring font sizes
  use `clamp()`, not fixed px.
- Flexible widths/heights use `min()/max()/clamp()/%/fr`/flex/grid — not fixed px.
- **Verify:** resize 920px → full-screen. Nothing clips; padding visibly breathes.

## Always

- **Tokens only.** Colors/radii/shadows/motion/spacing come from `packages/ui/tokens.css`.
  Need a value that isn't a token? Add a token, then use it. No inline hex/magic numbers.
- **Use `ui` primitives** (`GlassPane`, `GlassPill`, …) — don't hand-roll panels.
- **One accent** (`--accent`); greyscale otherwise.
- Honor `prefers-reduced-motion`; keep read-text (terminal/diff) at ≥ AA contrast.

## Never

- Opaque background anywhere in the glass stack (window / body / plane / surface).
- Raw px in padding/margin/gap/inset; magic hex/radius/shadow/duration.
- Glass under text that must be read.
- "It typechecks" treated as "the UI is done." UI is done only after you **ran it, looked
  at it, and resized it.**

## Before committing UI — the checklist in `docs/design-rules.md` §5 must pass.
Run `pnpm lint:css` (the stylelint guard fails the build on raw-px spacing and literal/
opaque backgrounds), then run the app and eyeball it at min and full-screen size.

## Net-new design (a new screen / surface look)
Beyond the floor above, use the **`frontend-design` plugin/skill** to avoid generic
AI-default UI: make deliberate palette/type/layout choices and one signature element that
fits casprFlowOS (dark + glass, agentic OS). Plan → critique against the brief → build →
run it and look.
