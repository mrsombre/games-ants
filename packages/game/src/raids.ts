import { COLS } from "./cells";
import type { Game } from "./model";
import { logUnitSpawned } from "./simulation-log";
import { createUnit, type RaidRole } from "./units";

export function spawnWave(game: Game, roles: readonly RaidRole[], roll: number) {
  const cell = { x: roll < 0.5 ? -1 : COLS, y: 0 };
  return roles.map((role) => {
    const unit = createUnit(game.nextUnitId++, role, "raiders", cell);
    game.units.push(unit);
    logUnitSpawned(game, unit);
    return unit;
  });
}
