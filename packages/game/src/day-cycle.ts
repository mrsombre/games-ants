import { EPSILON } from "./model";

export const DAY_PHASE_SECONDS = 150;
export const DAY_PHASE_IDS = ["morning", "noon", "evening", "night"] as const;
export type DayPhaseId = (typeof DAY_PHASE_IDS)[number];
export const DAY_PHASES = ["утро", "полдень", "вечер", "ночь"] as const;
export const dayPhase = (elapsedSeconds: number) => Math.floor((elapsedSeconds + EPSILON) / DAY_PHASE_SECONDS);

export const DAY_SECONDS = DAY_PHASE_SECONDS * DAY_PHASE_IDS.length;
