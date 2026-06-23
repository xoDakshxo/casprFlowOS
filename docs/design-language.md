# Design Language — casprFlowOS

> **Dark plane. Hints of glass. Quiet until you act.**
> The interface should feel like a calm operating system, not a busy IDE. Surfaces are
> dark and matte; panes and rails are glass; the agents and the diff are the only things
> that draw the eye.

## Principles

1. **Dark by default, not "dark mode."** There is no light theme. The base is a near-black
   plane with subtle depth, not flat `#000`.
2. **Glass is for chrome, never content.** Rails, panes, the voice HUD, modals, and
   connector surfaces use glass / gradient-glass. Terminal text and diffs stay crisp and
   opaque-enough to read. Glass frames content; it never sits on top of text you must read.
3. **Translucency with restraint.** Terminals are *translucent surfaces* (you sense the
   canvas behind them) but text legibility wins every time — clamp background opacity so
   contrast never drops below WCAG AA for terminal foreground text.
4. **The canvas is themeable.** Replace TermCanvas's fixed dotted grid with a small set of
   user-selectable **canvas themes** (see below). The default is a quiet gradient void.
5. **Motion is meaningful and fast.** Animation communicates state changes (focus, spawn,
   HUD appear). Spring-based, sub-250ms, never decorative loops except the logo spinner.
6. **One accent, used sparingly.** A single brand accent for active/interactive state.
   Everything else is greyscale glass. Color = "this is alive / focused / yours."

## Color tokens (starting palette — tune in `ui`)

Defined as CSS variables in `packages/ui`. These are a **starting point**; refine with
taste, but keep the structure (base / surface / glass / text / accent / semantic).

```css
:root {
  /* base plane */
  --bg-void:        #07080b;   /* deepest background, behind the canvas */
  --bg-base:        #0b0d12;   /* app base */
  --bg-raised:      #11141b;   /* raised opaque surfaces */

  /* glass surfaces (use with backdrop-filter: blur) */
  --glass-rail:     rgba(18, 21, 28, 0.55);
  --glass-pane:     rgba(22, 26, 34, 0.50);
  --glass-hud:      rgba(20, 24, 32, 0.62);
  --glass-stroke:   rgba(255, 255, 255, 0.08);   /* 1px hairline border */
  --glass-stroke-strong: rgba(255, 255, 255, 0.14);

  /* gradient-glass (top-light, used on rails/panes) */
  --glass-gradient: linear-gradient(
                      180deg,
                      rgba(255,255,255,0.06) 0%,
                      rgba(255,255,255,0.00) 28%
                    );

  /* text */
  --text-primary:   rgba(237, 240, 245, 0.95);
  --text-secondary: rgba(237, 240, 245, 0.62);
  --text-muted:     rgba(237, 240, 245, 0.38);

  /* accent (single brand color — pull exact hue from casprFlow logo) */
  --accent:         #6ea8ff;   /* placeholder; reconcile with logo navy/blue */
  --accent-soft:    rgba(110, 168, 255, 0.16);
  --focus-ring:     rgba(110, 168, 255, 0.55);

  /* semantic (diff + status) */
  --diff-add:       #3fb950;
  --diff-del:       #f85149;
  --status-running: #d8a657;
  --status-done:    #3fb950;
  --status-error:   #f85149;

  /* depth */
  --shadow-pane:    0 18px 48px rgba(0,0,0,0.45);
  --shadow-hud:     0 12px 36px rgba(0,0,0,0.50);
  --radius-pane:    16px;
  --radius-tile:    12px;
  --radius-pill:    999px;
}
```

> **Accent reconciliation:** the casprFlow logo fill animates to `rgb(14, 45, 84)` (a deep
> navy). Decide whether the live accent is that navy or a brighter derived blue for
> on-dark legibility, and set `--accent` once, in `ui`. Don't scatter hex values.

## The glass recipe

A reusable surface treatment (implement as a `.glass` utility / styled primitive in `ui`):

```css
.glass {
  background: var(--glass-pane);
  background-image: var(--glass-gradient);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid var(--glass-stroke);
  border-radius: var(--radius-pane);
  box-shadow: var(--shadow-pane);
}
```

- **Rails** (left/right): `--glass-rail`, full-height, hairline inner border on the canvas
  edge, gradient-glass top light.
- **Voice HUD**: `--glass-hud`, pill shape (`--radius-pill`), stronger blur, soft shadow,
  centered bottom. Mirrors CasprFlow's capsule HUD but in our palette.
- **Connector surfaces** (Spotify player, etc.): `--glass-pane`, larger radius, album/art
  can bleed a tasteful gradient behind the glass.

## Transparent terminals

- Terminal tiles render on a **translucent** background so the canvas theme shows through.
- Provide a per-user **terminal opacity** setting (e.g. 70–100%) with a sane default
  (~88%). Below the floor, legibility breaks — clamp it.
- The tile frame is glass (hairline border + soft shadow + gradient top light); the text
  area is the translucent terminal surface.
- Focused terminal: lift opacity slightly toward opaque + accent focus ring, so the active
  agent is unmistakably the brightest thing on screen.

## Canvas themes (replaces the dotted grid)

Ship a small curated set in `assets/themes/`, user-switchable from the right rail. Each
theme is just a background layer spec (no effect on tiles/rails):

| Theme | Background |
|---|---|
| **Void** (default) | radial dark gradient, near-black center to `--bg-void` edges |
| **Grid** | faint 1px line grid on `--bg-base` (the "classic", muted) |
| **Dots** | subtle dot matrix (TermCanvas-style, but dimmer) |
| **Aurora** | very slow, very dim gradient-glass aurora drift (motion off by default) |
| **Carbon** | flat matte with a barely-there noise texture |

Theme = `{ id, name, layer: 'gradient'|'grid'|'dots'|'aurora'|'flat', params }`. Keep the
contract small so adding a theme is data, not code.

## Typography

- **UI:** a clean geometric/grotesk sans (e.g. Geist, inherited from TermCanvas) for rails,
  HUD, labels.
- **Terminal & diff:** a crisp mono (the user's terminal font; default to a good mono).
- Tight, legible sizes; secondary text drops to `--text-secondary`, never below
  `--text-muted` for anything meaningful.

## Logo & motion

- Logo assets live in [`../assets/logo/`](../assets/logo/): `logo-white.svg`,
  `logo-black.svg`, and `logo-loading.svg` (the fill-loop spinner from CasprFlow).
- Use `logo-loading.svg` (or a React port of its fill animation) as the **processing
  spinner** in the voice HUD while the orchestrator runs — exactly as CasprFlow uses
  `CasprFlowLogoMark`.
- Recolor the loading fill to the reconciled `--accent` for on-dark use; keep the
  cubic-bezier `(0.23, 1, 0.32, 1)` easing — it's the casprFlow signature.

## Voice HUD anatomy (visual spec)

```
            ╭───────────────────────────────────────────╮
            │  ◗ ))   focus orion and run the tests       │   ← live transcript (listening)
            ╰───────────────────────────────────────────╯
                          glass pill, centered bottom

            ╭───────────────────────────────────────────╮
            │  ⟳   working…                                │   ← logo-loading spinner (processing)
            ╰───────────────────────────────────────────╯

            ╭───────────────────────────────────────────╮
            │  ✓   Focused Orion · queued: npm test        │   ← result readout (what it did)
            ╰───────────────────────────────────────────╯
```

- **Listening:** mic/level glyph + live partial transcript, text easing in.
- **Processing:** the logo-fill spinner + "working…".
- **Result:** check/▲ glyph + a one-line plain-English summary of the action(s) taken —
  this is the "write what it did in a text box on screen" requirement.
- **Error/clarify:** warning glyph + short message, or an inline one-tap clarification.
- Pill: `width ~360`, `height ~56`, `--radius-pill`, `--glass-hud`, hairline border, soft
  shadow, spring-in `(response 0.22, damping 0.82)`.

## Do / Don't

- **Do** let the canvas breathe: lots of dark negative space, few bright elements.
- **Do** keep glass subtle — blur + hairline + faint top-light, not frosted milk.
- **Don't** put glass under terminal/diff text you must read.
- **Don't** introduce a second accent color. One accent, greyscale otherwise.
- **Don't** animate idle decoration (except the logo spinner during processing).
