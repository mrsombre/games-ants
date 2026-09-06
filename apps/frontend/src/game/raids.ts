import { COLS } from "./cells";
import type { Game } from "./model";
import { createUnit, type SpawnRole } from "./units";

export function spawnWave(game: Game, roles: readonly SpawnRole[], roll: number) {
  const cell = { x: roll < 0.5 ? -1 : COLS, y: 0 };
  return roles.map((role) => {
    const unit = createUnit(game.nextUnitId++, role, "raiders", cell);
    game.units.push(unit);
    return unit;
  });
}
