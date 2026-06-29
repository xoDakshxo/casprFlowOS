import { create } from "zustand";

/**
 * Transient hover-preview state for the side panels.
 *
 * The panels are no longer always-visible: a panel shows either because it is
 * PINNED (clicked open — insets the canvas, glass bg) or because it is being
 * PREVIEWED (hovering its toolbar toggle or the panel itself — floats over the
 * canvas with an opaque bg, auto-closes on leave).
 *
 * The open/close timers live at module scope (not per component) so moving the
 * cursor from the toolbar toggle INTO the panel cancels the pending close even
 * though those are two different components — they share one timer per side.
 */
type Side = "left" | "right";

interface PanelHoverState {
  leftPreview: boolean;
  rightPreview: boolean;
  openPreview: (side: Side) => void;
  closePreviewSoon: (side: Side) => void;
  closePreviewNow: (side: Side) => void;
}

const timers: Record<Side, ReturnType<typeof setTimeout> | null> = {
  left: null,
  right: null,
};

// Long enough to bridge the gap between the top-bar toggle and the panel below.
const CLOSE_DELAY_MS = 160;

function clearTimer(side: Side) {
  const t = timers[side];
  if (t) {
    clearTimeout(t);
    timers[side] = null;
  }
}

export const usePanelHoverStore = create<PanelHoverState>((set) => ({
  leftPreview: false,
  rightPreview: false,
  openPreview: (side) => {
    clearTimer(side);
    set(side === "left" ? { leftPreview: true } : { rightPreview: true });
  },
  closePreviewSoon: (side) => {
    clearTimer(side);
    timers[side] = setTimeout(() => {
      timers[side] = null;
      set(side === "left" ? { leftPreview: false } : { rightPreview: false });
    }, CLOSE_DELAY_MS);
  },
  closePreviewNow: (side) => {
    clearTimer(side);
    set(side === "left" ? { leftPreview: false } : { rightPreview: false });
  },
}));
