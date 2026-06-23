# Design Rules (enforced) — read before writing ANY UI

These are **hard rules**, not suggestions. They exist because UI here keeps regressing in
the same ways. If you touch a component, a stylesheet, tokens, or the Electron window, you
follow these. When in doubt, re-read this file. The full visual intent is in
[`design-language.md`](design-language.md); this file is the **checklist that must pass.**

> **Two layers.** This file is the **floor** — correctness, enforced by `pnpm lint:css`.
> For **net-new design** (a new screen, the look of a rail/HUD/surface), also use the
> **`frontend-design` plugin/skill**: make deliberate, non-templated choices and pick one
> signature element. Generic dark-glass-with-a-blue-accent that could belong to any app is
> a fail even if every rule below passes. Distinctive + correct, not one or the other.

---

## 1. Glass must be REAL glass (the #1 thing that gets broken)

casprFlowOS is a translucent, glass app. Glass only works when **light/content from behind
shows through**. The trap: painting an opaque layer somewhere in the stack, which buries the
effect and leaves flat dark boxes. This has already happened once. Do not repeat it.

**How the glass stack works — all four layers must cooperate:**

1. **The window** (`apps/desktop/electron/main.ts`) provides the macOS material:
   `vibrancy: "under-window"`, `visualEffectState: "active"`, and a **transparent**
   `backgroundColor: "#00000000"`. ❌ Never set an opaque `backgroundColor`.
2. **`html, body`** are `background: transparent`. ❌ Never give them an opaque background.
3. **The app plane** (`.app-shell`) uses `--bg-plane`, which is **translucent** (alpha < 1)
   so the vibrancy shows through. ❌ Never use a fully opaque plane fill.
4. **Glass surfaces** use the `.glass` class / `<GlassPane>`/`<GlassPill>`: a translucent
   tint (`--glass-*`, alpha < 1) **plus** `backdrop-filter: blur(...)`. ❌ Never give a
   glass surface an opaque `background`. ❌ Never remove `backdrop-filter`.

**Rules:**
- Any background color that participates in the glass stack is `rgba()`/token with **alpha
  < 1**. If you write a hex like `#11141b` as a surface background, you are almost certainly
  wrong — use a `--glass-*` token.
- Use the `.glass` class or the `ui` primitives for every pane, rail, modal, HUD, menu,
  card. Don't hand-roll a "panel" with a solid background.
- **Never** put glass *under text that must be read* (terminal output, diffs). Glass frames
  chrome; content stays crisp. (See design-language.)
- If you need a new surface tint, add a translucent `--glass-*` token — don't inline a color.

**Self-check:** after any window/background change, the splash/panes must look translucent
against the desktop wallpaper, not like flat dark rectangles. Verify by *running the app*,
not by reading the code.

---

## 2. Spacing is COMPUTED and RESPONSIVE — never magic px

Padding and gaps must adapt to window size. casprFlowOS is a resizable desktop OS shell; a
hard `padding: 24px` looks cramped at 1600px and bloated at 920px.

**Rules:**
- **Container padding & gaps → fluid tokens**: `--pad-xs|sm|md|lg|xl`, `--gap-sm|md|lg`
  (each is a `clamp(min, vw, max)`). Use these for panes, rails, sections, cards, the HUD.
- **Fine details** (hairline offsets, icon-to-label gaps, 1px borders) → the fixed
  `--space-1..8` scale. These are the *only* place fixed px spacing is allowed.
- ❌ **Never** write a raw `px` value directly in `padding`, `margin`, `gap`, `row-gap`,
  `column-gap`, or `inset`. Always a token (fluid for layout, fixed scale for details).
- Font sizes that anchor a layout (titles, headings) use `clamp(min, vw, max)`, not a fixed
  px. Body/label text may use a fixed size from the type scale.
- Widths/heights of flexible regions use `min()`, `max()`, `clamp()`, `%`, `fr`, or
  flex/grid that reflows — not fixed px. Fixed px is fine only for things that are genuinely
  fixed (a 1px divider, a 28px icon button).

**Self-check:** resize the window from 920px to full-screen. Nothing clips, nothing leaves
awkward dead space, padding visibly breathes. If it doesn't, it's not done.

---

## 3. Tokens only — no inline design values

- Colors, radii, shadows, motion, spacing all come from `packages/ui/tokens.css`. ❌ No raw
  hex, no magic radius/shadow/duration in a component or stylesheet.
- Need a value that isn't a token? **Add a token**, then use it. One source of truth.
- One accent (`--accent`). Greyscale otherwise. ❌ No second accent color.

---

## 4. Responsive & adaptive layout

- Build with CSS grid/flex that reflows; assume the window resizes constantly and the rails
  collapse. Test at min size and full-screen.
- Use container-relative sizing; avoid absolute pixel positioning except for genuinely fixed
  chrome (traffic-light inset, a fixed-size icon).
- Honor `prefers-reduced-motion` (dampen/disable non-essential motion).
- Keep text legible: terminal/diff foreground contrast ≥ WCAG AA at the translucency floor;
  clamp opacity, don't trust input.

---

## 5. Before you commit any UI — run this checklist

- [ ] Ran the app and **looked at it**. Glass reads as translucent against the desktop.
- [ ] Resized 920px → full-screen: padding breathes, nothing clips, no dead space.
- [ ] No opaque background anywhere in the glass stack (window / body / plane / surfaces).
- [ ] Every `padding`/`margin`/`gap`/`inset` uses a token; layout spacing uses **fluid**
      tokens, only fine details use the fixed scale.
- [ ] No raw hex / magic radius / magic shadow / magic duration — all tokens.
- [ ] Used `ui` primitives (`GlassPane`/`GlassPill`/…) instead of hand-rolled panels.
- [ ] One accent color; greyscale otherwise.
- [ ] `prefers-reduced-motion` respected; AA contrast on read-text.

If any box is unchecked, the UI is not done. "It typechecks" is not "it's done" for UI.
