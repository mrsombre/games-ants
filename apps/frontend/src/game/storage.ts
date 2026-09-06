import { type Cell, cellKey, point } from "./cells";
import { isFlooded } from "./flood";
import type { Item } from "./items";
import type { Game } from "./model";

export const STORAGE_SLOTS = 3;
type StoredFood = Item & { kind: "food"; location: { kind: "cell"; cell: Cell } };

export function storedFood(game: Game) {
  return game.items.filter(
    (item): item is StoredFood =>
      item.kind === "food" &&
      item.location.kind === "cell" &&
      game.colony[cellKey(item.location.cell)] === "storage" &&
      !isFlooded(game, cellKey(item.location.cell)),
  );
}
export const foodStock = (game: Game, cellId?: string) =>
  storedFood(game).reduce(
    (sum, item) => sum + (cellId === undefined || cellKey(item.location.cell) === cellId ? item.portions : 0),
    0,
  );
const itemSize = (item: Item | undefined) => (item?.kind === "food" ? item.portions : 1);
export function storageOccupancy(game: Game, id: string, exceptUnit?: number) {
  const stored = game.items
    .filter((item) => item.location.kind === "cell" && cellKey(item.location.cell) === id)
    .reduce((sum, item) => sum + itemSize(item), 0);
  return game.units.reduce((sum, unit) => {
    const job = unit.job;
    if (unit.hp <= 0 || unit.id === exceptUnit || job?.kind !== "haul" || cellKey(job.destination) !== id) return sum;
    return sum + itemSize(game.items.find((item) => item.id === job.itemId));
  }, stored);
}
export const freeSlots = (game: Game, id: string, exceptUnit?: number) =>
  Math.max(0, STORAGE_SLOTS - storageOccupancy(game, id, exceptUnit));
export function foodStorageCells(game: Game) {
  return Object.entries(game.colony).flatMap(([id, tile]) =>
    tile === "storage" && !isFlooded(game, id) && freeSlots(game, id) > 0 ? [point(id)] : [],
  );
}
export const storageCapacity = (game: Game) =>
  Object.entries(game.colony).reduce(
    (sum, [id, tile]) => sum + (tile === "storage" && !isFlooded(game, id) ? freeSlots(game, id) : 0),
    0,
  );
export function consumeFood(game: Game, amount: number) {
  if (foodStock(game) < amount) return false;
  let remaining = amount;
  for (const item of storedFood(game)) {
    if (remaining <= 0) break;
    const eaten = Math.min(item.portions, remaining);
    item.portions -= eaten;
    remaining -= eaten;
  }
  game.items = game.items.filter((item) => item.kind !== "food" || item.portions > 0);
  return true;
}
