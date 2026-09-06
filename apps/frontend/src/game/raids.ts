import { COLS } from "./cells";
import type { Game, GameEvent } from "./model";
import { createUnit } from "./units";

export const ATTACK_MIN_SECONDS = 120;
export const ATTACK_MAX_SECONDS = 600;
export const MAX_ENEMIES = 5;
export const FIRST_RAID_MAX_ENEMIES = 2;
export function attackDelay(random: () => number) {
  return ATTACK_MIN_SECONDS + random() * (ATTACK_MAX_SECONDS - ATTACK_MIN_SECONDS);
}
export function advanceAttack(game: Game, seconds: number, random: () => number, events: GameEvent[]) {
  game.attackTimer -= seconds;
  if (game.attackTimer > 0) return;
  const maximum = game.raidsStarted === 0 ? Math.min(FIRST_RAID_MAX_ENEMIES, game.maxEnemies) : game.maxEnemies;
  game.attackTimer = attackDelay(random);
  if (maximum <= 0) return;
  const count = 1 + Math.floor(random() * maximum);
  const cell = { x: random() < 0.5 ? -1 : COLS, y: 0 };
  for (let i = 0; i < count; i++)
    game.units.push(createUnit(game.nextUnitId++, i % 2 === 0 ? "worker" : "warrior", "raiders", cell));
  game.raidsStarted++;
  events.push({ kind: "attack-started", count });
}
