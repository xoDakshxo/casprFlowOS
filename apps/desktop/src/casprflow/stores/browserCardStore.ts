import { create } from "zustand";
import { getVisibleCanvasWorldRect } from "../canvas/viewportBounds";
import { useCanvasStore } from "./canvasStore";
import { usePinStore } from "./pinStore";
import { useSelectionStore } from "./selectionStore";
import { useWorkspaceStore } from "./workspaceStore";

export interface BrowserCardData {
  id: string;
  url: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Mobile (phone) emulation: narrow viewport + mobile user-agent. */
  mobile?: boolean;
  /** Desktop dimensions remembered while in mobile mode (to restore). */
  desktopW?: number;
  desktopH?: number;
}

// Chrome (toolbar) height in world px; the rest of the card is a 16:9 viewport.
export const BROWSER_CHROME_H = 36;
// Cap so the browser never gets absurd on a huge monitor; otherwise it sizes to
// a fraction of the visible canvas (see addCard).
const BROWSER_MAX_CONTENT_W = 1100;
const BROWSER_VIEW_FRACTION = 0.78;
export const BROWSER_DEFAULT_W = 960;
export const BROWSER_DEFAULT_H =
  Math.round((BROWSER_DEFAULT_W * 9) / 16) + BROWSER_CHROME_H;
// Phone form factor (≈iPhone logical size) for mobile mode.
export const BROWSER_MOBILE_W = 390;
export const BROWSER_MOBILE_H = 720 + BROWSER_CHROME_H;

/**
 * A 16:9 browser sized to fit the visible canvas (world units), centred in it.
 */
function defaultBrowserRect(): { x: number; y: number; w: number; h: number } {
  const cs = useCanvasStore.getState();
  const taskDrawerOpen = usePinStore.getState().openProjectPath !== null;
  const rect = getVisibleCanvasWorldRect(
    cs.viewport,
    cs.rightPanelCollapsed,
    cs.leftPanelCollapsed,
    cs.leftPanelWidth,
    cs.rightPanelWidth,
    taskDrawerOpen,
  );
  const maxW = Math.max(320, rect.w * BROWSER_VIEW_FRACTION);
  const maxContentH = Math.max(180, rect.h * BROWSER_VIEW_FRACTION - BROWSER_CHROME_H);
  let contentW = Math.min(BROWSER_MAX_CONTENT_W, maxW);
  let contentH = (contentW * 9) / 16;
  if (contentH > maxContentH) {
    contentH = maxContentH;
    contentW = (contentH * 16) / 9;
  }
  const w = Math.round(contentW);
  const h = Math.round(contentH + BROWSER_CHROME_H);
  return {
    w,
    h,
    x: Math.round(rect.x + (rect.w - w) / 2),
    y: Math.round(rect.y + (rect.h - h) / 2),
  };
}

interface BrowserCardStore {
  cards: Record<string, BrowserCardData>;
  addCard: (url: string, position?: { x: number; y: number }) => string;
  removeCard: (id: string) => void;
  updateCard: (id: string, patch: Partial<BrowserCardData>) => void;
}

let counter = 0;

function markDirty() {
  useWorkspaceStore.getState().markDirty();
}

export const useBrowserCardStore = create<BrowserCardStore>((set) => ({
  cards: {},

  addCard: (url, position) => {
    const id = `browser-${Date.now()}-${++counter}`;
    // A 16:9 browser sized to the visible canvas and centred in it. No cascade:
    // a lone browser sits dead-centre; the auto-tiler handles multi-window
    // arrangement when agents/other browsers are present.
    const base = defaultBrowserRect();
    const card: BrowserCardData = {
      id,
      url,
      title: url,
      x: position?.x ?? base.x,
      y: position?.y ?? base.y,
      w: base.w,
      h: base.h,
    };
    set((state) => ({ cards: { ...state.cards, [id]: card } }));
    markDirty();
    return id;
  },

  removeCard: (id) => {
    let removed = false;
    const selectedCardId = `browser:${id}`;
    set((state) => {
      if (!(id in state.cards)) return state;
      removed = true;
      const { [id]: _, ...rest } = state.cards;
      return { cards: rest };
    });
    if (removed) {
      useSelectionStore.setState((state) => ({
        selectedItems: state.selectedItems.filter(
          (item) => item.type !== "card" || item.cardId !== selectedCardId,
        ),
      }));
      markDirty();
    }
  },

  updateCard: (id, patch) => {
    let updated = false;
    set((state) => {
      const existing = state.cards[id];
      if (!existing) return state;
      updated = true;
      return { cards: { ...state.cards, [id]: { ...existing, ...patch } } };
    });
    if (updated) {
      markDirty();
    }
  },
}));
