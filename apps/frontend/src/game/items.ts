import { type Cell, sameCell } from "./cells";
import type { Game } from "./model";
import type { Unit } from "./units";

export type FoodKind = "apple" | "mushroom" | "caterpillar";
export type ItemLocation = { kind: "cell"; cell: Cell } | { kind: "carried"; unitId: number };
export type Item = { id: number; location: ItemLocation } & (
  | { kind: "egg" }
  | { kind: "food"; food: FoodKind; portions: number }
);
export const foodValue: Record<FoodKind, number> = { apple: 1, mushroom: 1, caterpillar: 2 };
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
  if (game.spawns.some((spawn) => spawn.eggId === item.id)) {
    if (unit.faction === "colony") return false;
    game.spawns = game.spawns.filter((spawn) => spawn.eggId !== item.id);
  }
  item.location = { kind: "carried", unitId: unit.id };
  return true;
}
export function dropCargo(game: Game, unit: Unit) {
  const item = carriedItem(game, unit);
  if (item) item.location = { kind: "cell", cell: unit.cell };
  return item;
}
