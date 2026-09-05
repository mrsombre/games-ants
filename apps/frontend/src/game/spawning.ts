import { point } from "./colony";
import { type Ant, type Egg, type Game, type Role, roles, SPAWN_SECONDS } from "./model";

export function spawnableEggs(game: Game) {
  const carried = new Set(
    game.ants.flatMap((ant) => (ant.role === "worker" && ant.task?.kind === "carry-egg" ? [ant.task.eggId] : [])),
  );
  const reserved = new Set(game.spawns.map((spawn) => spawn.eggId));
  return game.eggs.filter(
    (egg): egg is Egg & { location: { cell: string } } =>
      "cell" in egg.location &&
      !!game.colony[egg.location.cell] &&
      !carried.has(egg.id) &&
      !reserved.has(egg.id) &&
      !game.enemies.some((enemy) => enemy.targetEggId === egg.id),
  );
}

export function startSpawn(game: Game, role: Role, random: () => number = Math.random) {
  if (game.food < roles[role].cost) return false;
  const eggs = spawnableEggs(game);
  if (!eggs.length) return false;
  const egg = eggs[Math.min(eggs.length - 1, Math.floor(random() * eggs.length))];
  if (!egg) return false;
  game.food -= roles[role].cost;
  game.spawns.push({ eggId: egg.id, cell: egg.location.cell, role, progress: 0 });
  return true;
}

export function advanceSpawns(game: Game, seconds: number, createAnt: (id: number, role: Role) => Ant) {
  for (const spawn of game.spawns) {
    const egg = game.eggs.find((entry) => entry.id === spawn.eggId);
    if (!egg || !("cell" in egg.location)) continue;
    spawn.cell = egg.location.cell;
    spawn.progress = Math.min(1, spawn.progress + seconds / SPAWN_SECONDS);
    if (spawn.progress < 1 - 1e-9) continue;
    const eggIndex = game.eggs.findIndex((egg) => egg.id === spawn.eggId);
    if (eggIndex < 0) continue;
    game.eggs.splice(eggIndex, 1);
    game.ants.push({ ...createAnt(game.nextId++, spawn.role), ...point(spawn.cell) });
  }
  game.spawns = game.spawns.filter((spawn) => spawn.progress < 1 - 1e-9);
}
