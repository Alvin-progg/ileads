import { create } from "zustand";

/**
 * Decouples "take the tour" triggers (sidebar, Help) from wherever
 * GuidedTour happens to be mounted. Not persisted: plain in-memory state
 * would need sessionStorage to survive a hard reload, but that risks a
 * hydration mismatch against the server-rendered hasSeenTour flag for
 * negligible benefit — a reload mid-tour just means restarting it.
 */
type TourState = {
  requestId: number;
  start: () => void;
};

export const useTourStore = create<TourState>((set) => ({
  requestId: 0,
  start: () => set((s) => ({ requestId: s.requestId + 1 })),
}));
