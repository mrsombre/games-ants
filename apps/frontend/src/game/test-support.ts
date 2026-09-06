import { type Cell, HOME } from "./cells";
import type { Game } from "./model";
import { createGame, stepGame } from "./simulation";
import { createUnit, type Faction, type Role } from "./units";

export function world() {
  const game = createGame(() => 0.5);
  game.units = game.units.filter((unit) => unit.role === "queen");
  game.items = [];
  game.attackTimer = Number.POSITIVE_INFINITY;
  return game;
}
export function addUnit(game: Game, role: Role = "worker", cell: Cell = HOME, faction: Faction = "colony") {
  const unit = createUnit(game.nextUnitId++, role, faction, cell);
  game.units.push(unit);
  return unit;
}
export function egg(game: Game, cell: Cell) {
  const item = { id: game.nextItemId++, kind: "egg" as const, location: { kind: "cell" as const, cell } };
  game.items.push(item);
  return item;
}
export function advance(game: Game, seconds: number, random = () => 0.5) {
  return Array.from({ length: Math.round(seconds / 0.05) }, () => stepGame(game, 0.05, random)).flat();
}
