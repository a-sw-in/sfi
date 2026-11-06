import { create } from "zustand";

export type Mode = "menu" | "playing" | "paused" | "over";
type State = { mode: Mode; score: number; coins: number; best: number; muted: boolean; start: () => void; pause: () => void; resume: () => void; over: () => void; reset: () => void; addCoin: () => void; setScore: (score: number) => void; toggleMute: () => void };
const saved = typeof window !== "undefined" ? Number(window.localStorage.getItem("subway-best") ?? 0) : 0;

export const useGame = create<State>((set, get) => ({
  mode: "menu", score: 0, coins: 0, best: saved, muted: false,
  start: () => set({ mode: "playing", score: 0, coins: 0 }),
  pause: () => set({ mode: "paused" }),
  resume: () => set({ mode: "playing" }),
  over: () => {
    const best = Math.max(get().best, get().score);
    if (typeof window !== "undefined") window.localStorage.setItem("subway-best", String(best));
    set({ mode: "over", best });
  },
  reset: () => set({ mode: "menu", score: 0, coins: 0 }),
  addCoin: () => set((state) => ({ coins: state.coins + 1, score: state.score + 50 })),
  setScore: (score) => set({ score }),
  toggleMute: () => set((state) => ({ muted: !state.muted })),
}));
