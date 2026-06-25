import { create } from "zustand";

/**
 * Briefly flips on during a programmatic re-layout (spawn grid / Arrange) so the
 * canvas can add a CSS transition to tile transforms — they glide to their new
 * slots instead of snapping — then turns off so normal dragging stays instant.
 */
const ARRANGE_ANIM_MS = 420;

interface ArrangingStore {
  arranging: boolean;
  begin: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useArrangingStore = create<ArrangingStore>((set) => ({
  arranging: false,
  begin: () => {
    set({ arranging: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ arranging: false }), ARRANGE_ANIM_MS);
  },
}));
