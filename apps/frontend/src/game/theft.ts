import { COLS, key, point } from "./colony";
import { type Enemy, type Game, SURFACE_EXIT } from "./model";
import { path } from "./navigation";

function carriedEgg(game: Game, enemy: Enemy) {
  return game.eggs.find((egg) => "carrier" in egg.location && egg.location.carrier === enemy.id);
}

export function stealing(game: Game, enemy: Enemy) {
  return enemy.targetEggId !== null || !!carriedEgg(game, enemy);
}

export function chooseLoot(game: Game, enemy: Enemy) {
  if (carriedEgg(game, enemy)) return { x: -1, y: SURFACE_EXIT.y };
  const origin = enemy.route[0] ?? (enemy.y < 0 ? enemy : { x: Math.round(enemy.x), y: Math.round(enemy.y) });
  const candidates = game.eggs
    .flatMap((egg) => {
      if (!("cell" in egg.location)) return [];
      if (game.enemies.some((other) => other.id !== enemy.id && other.hp > 0 && other.targetEggId === egg.id))
        return [];
      if (game.ants.some((ant) => ant.role === "worker" && ant.task?.kind === "carry-egg" && ant.task.eggId === egg.id))
        return [];
      const target = point(egg.location.cell);
      if (target.y < 0) target.y = SURFACE_EXIT.y;
      const route = path(game, origin, target);
      return route
        ? [
            {
              egg,
              target,
              distance: route.reduce(
                (distance, p, i) =>
                  distance + Math.hypot(p.x - (route[i - 1] ?? origin).x, p.y - (route[i - 1] ?? origin).y),
                0,
              ),
            },
          ]
        : [];
    })
    .sort((a, b) => a.distance - b.distance);
  const choice = candidates.find(({ egg }) => egg.id === enemy.targetEggId) ?? candidates[0];
  enemy.targetEggId = choice?.egg.id ?? null;
  return choice?.target;
}

export function collectLoot(game: Game, enemy: Enemy) {
  const egg = game.eggs.find((entry) => entry.id === enemy.targetEggId);
  if (!egg || !("cell" in egg.location)) return;
  const target = point(egg.location.cell);
  if (target.y < 0) target.y = SURFACE_EXIT.y;
  if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > 1e-9) return;
  egg.location = { carrier: enemy.id };
  game.spawns = game.spawns.filter((spawn) => spawn.eggId !== egg.id);
}

export function dropLoot(game: Game, enemy: Enemy) {
  const egg = carriedEgg(game, enemy);
  if (egg) egg.location = { cell: key(Math.round(enemy.x), Math.round(enemy.y)) };
  enemy.targetEggId = null;
}

export function escapeWithLoot(game: Game, enemy: Enemy) {
  const egg = carriedEgg(game, enemy);
  if (enemy.y !== SURFACE_EXIT.y || (enemy.x >= -0.5 && enemy.x < COLS - 0.5)) return false;
  if (!egg) return game.queen.hp <= 0 && !enemy.route.length;
  game.eggs = game.eggs.filter((entry) => entry.id !== egg.id);
  return true;
}
