# @casprflowos/ui

The glass design system: tokens, primitives, rails, and the voice HUD view.

## Responsibility
- **Tokens** (`tokens.css`): the dark-glass palette, radii, shadows, motion constants —
  the single source of visual truth. See
  [`../../docs/design-language.md`](../../docs/design-language.md).
- **Primitives**: `GlassPane`, `GlassRail`, `GlassPill`, `LogoSpinner`, `Button`,
  `IconButton`, `Tooltip`, `ContextMenu`, status dots, dividers.
- **Composites**: left rail, right (OS) rail, the voice HUD view + states, the command bar,
  connector surface shells.

## Boundaries
- May depend on `@casprflowos/shared`. **No business logic** — components render and emit
  events; orchestration lives in `agents`, data in stores.
- **No hardcoded hex or magic spacing** in any component — consume tokens. If a value isn't
  a token, add a token.

## Rules
- Glass frames chrome, never sits under read-text (terminal/diff).
- One accent color; greyscale otherwise.
- Reduced-motion honored.
