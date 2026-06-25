import { create } from "zustand";

/**
 * Controls the App Launcher modal — a Cmd-P-style picker for spawning agents
 * (and, later, apps). Opened from the dock's drawer button.
 */
interface AppLauncherStore {
  open: boolean;
  openLauncher: () => void;
  closeLauncher: () => void;
  toggleLauncher: () => void;
}

export const useAppLauncherStore = create<AppLauncherStore>((set) => ({
  open: false,
  openLauncher: () => set({ open: true }),
  closeLauncher: () => set({ open: false }),
  toggleLauncher: () => set((s) => ({ open: !s.open })),
}));
