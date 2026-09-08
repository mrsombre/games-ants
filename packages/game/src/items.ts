import { type Cell, sameCell } from "./cells";
import type { Game } from "./model";
import { logItemDropped, logItemPickedUp } from "./simulation-log";
import type { Unit } from "./units";

export type FoodKind = "apple" | "mushroom" | "caterpillar";
export type ItemLocation = { kind: "cell"; cell: Cell } | { kind: "carried"; unitId: number };
export type Item = { id: number; location: ItemLocation } & (
  | { kind: "egg" }
  | { kind: "food"; food: FoodKind; portions: number }
);
export const foodValue: Record<FoodKind, number> = { apple: 1, mushroom: 1, caterpillar: 2 };
export const forageWeight: Record<FoodKind, number> = { apple: 0.4, mushroom: 0.4, caterpillar: 0.2 };
export function forage(roll: number, weights: Record<FoodKind, number> = forageWeight): FoodKind {
  let threshold = 0;
  for (const kind of Object.keys(weights) as FoodKind[]) {
    threshold += weights[kind];
    if (roll < threshold) return kind;
  }
  return "caterpillar";
}
export const carriedItem = (game: Game, unit: Unit) =>
  game.items.find((item) => item.location.kind === "carried" && item.location.unitId === unit.id);
export const itemReserved = (game: Game, id: number, exceptUnit?: number) =>
  game.units.some(
    (unit) => unit.hp > 0 && unit.id !== exceptUnit && unit.job?.kind === "haul" && unit.job.itemId === id,
  );
export function canCarry(unit: Unit, item: Item) {
  return item.kind === "egg" ? unit.role === "worker" : unit.role === "scout";
}
export function pickUp(game: Game, unit: Unit, item: Item) {
  if (
    !canCarry(unit, item) ||
    carriedItem(game, unit) ||
    itemReserved(game, item.id, unit.id) ||
    item.location.kind !== "cell" ||
    !sameCell(item.location.cell, unit.cell)
  )
    return false;
  item.location = { kind: "carried", unitId: unit.id };
  logItemPickedUp(game, item, unit);
  return true;
}
export function dropCargo(game: Game, unit: Unit, reason = "interrupted") {
  const item = carriedItem(game, unit);
  if (item) {
    item.location = { kind: "cell", cell: unit.cell };
    if (reason !== "delivered") logItemDropped(game, item, unit, reason);
  }
  return item;
}
