import { type Cell, type CellId, HOME } from "./cells";
import type { Colony } from "./colony";
import type { Blueprint } from "./construction";
import type { FoodKind, Item } from "./items";
import type { IncidentKind, Narrator } from "./narrator";
import type { Spawn } from "./spawning";
import type { Unit } from "./units";

export type GameEvent =
  | { kind: "scout-delivered"; scoutId: number; cargo: FoodKind; food: number }
  | { kind: "food-discarded"; scoutId: number; cargo: FoodKind }
  | { kind: "incident-warned"; incident: IncidentKind; seconds: number }
  | { kind: "incident-started"; incident: IncidentKind; size: number }
  | { kind: "incident-ended"; incident: IncidentKind }
  | { kind: "queen-died" };
export type Game = {
  elapsedSeconds: number;
  colony: Colony;
  flood: CellId[];
  blueprints: Record<string, Blueprint>;
  units: Unit[];
  items: Item[];
  spawns: Spawn[];
  narrator: Narrator;
  eggTimer: number;
  nestTimer: number;
  nextItemId: number;
  nextUnitId: number;
  readonly revision: number;
  deliveries: number;
};
export const SIMULATION_STEP = 0.05;
export const EPSILON = 1e-9;
export const queenOf = (game: Game) => game.units.find((unit) => unit.faction === "colony" && unit.role === "queen");
export const homeOf = (game: Game): Cell => queenOf(game)?.cell ?? HOME;
