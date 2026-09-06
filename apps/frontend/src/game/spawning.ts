import { type Cell, cellKey } from "./cells";
import { type Item, itemReserved } from "./items";
import { EPSILON, type Game } from "./model";
import { consumeFood, foodStock } from "./storage";
import { createUnit, type SpawnRole, spawnCost } from "./units";

export type Spawn = { eggId: number; role: SpawnRole; progress: number };
export type SpawnBlock = "nest" | "egg" | "food";
export const SPAWN_SECONDS = 10;

// Each nest cell houses one ant; the queen lives in her own seat and never takes a bed.
export const nestCapacity = (game: Game) => Object.values(game.colony).filter((tile) => tile === "nest").length;
export const nestPopulation = (game: Game) =>
  game.units.filter((unit) => unit.faction === "colony" && unit.role !== "queen" && unit.hp > 0).length +
  game.spawns.length;
export const nestFree = (game: Game) => nestCapacity(game) - nestPopulation(game);

export const spawnClaimed = (game: Game, itemId: number) => game.spawns.some((spawn) => spawn.eggId === itemId);
export function spawnableEggs(game: Game) {
  return game.items.filter(
    (item): item is Item & { kind: "egg"; location: { kind: "cell"; cell: Cell } } =>
      item.kind === "egg" &&
      item.location.kind === "cell" &&
      game.colony[cellKey(item.location.cell)] === "nest" &&
      !itemReserved(game, item.id) &&
      !spawnClaimed(game, item.id),
  );
}
export function spawnBlock(game: Game, role: SpawnRole): SpawnBlock | null {
  if (nestFree(game) <= 0) return "nest";
  if (!spawnableEggs(game).length) return "egg";
  if (foodStock(game) < spawnCost[role]) return "food";
  return null;
}
export function startSpawn(game: Game, role: SpawnRole, random: () => number = Math.random): SpawnBlock | null {
  const block = spawnBlock(game, role);
  if (block) return block;
  const eggs = spawnableEggs(game);
  const egg = eggs[Math.floor(random() * eggs.length)] as (typeof eggs)[number];
  consumeFood(game, spawnCost[role]);
  game.spawns.push({ eggId: egg.id, role, progress: 0 });
  return null;
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
