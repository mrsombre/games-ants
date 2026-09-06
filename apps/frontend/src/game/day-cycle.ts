import { EPSILON } from "./model";

export const DAY_PHASE_SECONDS = 150;
export const DAY_PHASES = ["утро", "полдень", "вечер", "ночь"] as const;
export const dayPhase = (elapsedSeconds: number) => Math.floor((elapsedSeconds + EPSILON) / DAY_PHASE_SECONDS);
