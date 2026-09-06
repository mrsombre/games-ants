import { type Cell, cellKey } from "./cells";
import { hasNestRoom } from "./housing";
import { type Item, itemReserved } from "./items";
import { EPSILON, type Game } from "./model";
import { consumeFood } from "./storage";
import { createUnit, type HatchRole, hatchCost } from "./units";

export type Spawn = { eggId: number; role: HatchRole; progress: number };
export const SPAWN_SECONDS = 10;
export function spawnableEggs(game: Game) {
  const reserved = new Set(game.spawns.map((spawn) => spawn.eggId));
  return game.items.filter(
    (item): item is Item & { kind: "egg"; location: { kind: "cell"; cell: Cell } } =>
      item.kind === "egg" &&
      item.location.kind === "cell" &&
      game.colony[cellKey(item.location.cell)] === "nest" &&
      !itemReserved(game, item.id) &&
      !reserved.has(item.id),
  );
}
export function startSpawn(game: Game, role: HatchRole, random: () => number = Math.random) {
  if (!hasNestRoom(game)) return false;
  const eggs = spawnableEggs(game);
  const egg = eggs[Math.floor(random() * eggs.length)];
  if (!egg || !consumeFood(game, hatchCost[role])) return false;
  game.spawns.push({ eggId: egg.id, role, progress: 0 });
  return true;
}
export function advanceSpawns(game: Game, seconds: number) {
  game.spawns = game.spawns.filter((spawn) => {
    const egg = game.items.find((item) => item.id === spawn.eggId && item.kind === "egg");
    if (egg?.location.kind !== "cell") return false;
    spawn.progress = Math.min(1, spawn.progress + seconds / SPAWN_SECONDS);
    if (spawn.progress + EPSILON < 1) return true;
    game.items = game.items.filter((item) => item.id !== egg.id);
    game.units.push(createUnit(game.nextUnitId++, spawn.role, "colony", egg.location.cell));
    return false;
  });
}
