import { type CellId, cellKey, key, neighbors, point } from "./cells";
import { connected, roomSpan } from "./colony";
import type { Game } from "./model";
import { nestCells } from "./nesting";
import { logItemDestroyed, logSpawnCancelled } from "./simulation-log";
import { interruptJob } from "./work";

export const isFlooded = (game: Game, id: string) => game.flood.some((cell) => cell === id);
export const floodedCells = (game: Game): ReadonlySet<string> => new Set<string>(game.flood);

export function floodTargets(game: Game, size: number, roll: number): CellId[] {
  const spared = new Set<string>(nestCells(game).map(cellKey));
  const candidates = Object.keys(game.colony).filter((id) => point(id).y > 1 && !spared.has(id));
  const deepest = candidates.reduce((low, id) => Math.max(low, point(id).y), 0);
  const row = candidates.filter((id) => point(id).y === deepest).sort();
  const start = row[Math.min(row.length - 1, Math.floor(roll * row.length))];
  if (!start) return [];
  const { x, y } = point(start);
  const span = roomSpan(game.colony, x, y);
  return Array.from({ length: span.width }, (_, index) => key(span.left + index, y))
    .filter((id) => !spared.has(id))
    .sort((a, b) => Math.abs(point(a).x - x) - Math.abs(point(b).x - x))
    .slice(0, size)
    .sort();
}

export function startFlood(game: Game, size: number, roll: number) {
  const cells = floodTargets(game, size, roll);
  if (!cells.length) return 0;
  game.flood = cells;
  const drowned = new Set(
    game.items
      .filter((item) => item.location.kind === "cell" && isFlooded(game, cellKey(item.location.cell)))
      .map((item) => item.id),
  );
  for (const item of game.items)
    if (drowned.has(item.id))
      logItemDestroyed(game, item, "flood", item.location.kind === "cell" ? cellKey(item.location.cell) : undefined);
  for (const spawn of game.spawns)
    if (drowned.has(spawn.eggId)) logSpawnCancelled(game, spawn.eggId, spawn.role, "flood");
  game.items = game.items.filter((item) => !drowned.has(item.id));
  game.spawns = game.spawns.filter((spawn) => !drowned.has(spawn.eggId));
  for (const unit of game.units) {
    if (isFlooded(game, cellKey(unit.cell))) {
      const tile = game.colony[cellKey(unit.cell)];
      const dry = neighbors(unit.cell).find(
        (cell) =>
          connected(tile, game.colony[key(cell.x, cell.y)], cell.y === unit.cell.y) && !isFlooded(game, cellKey(cell)),
      );
      if (dry) unit.cell = dry;
      interruptJob(game, unit, "flood");
    } else if (
      unit.route.some((cell) => isFlooded(game, cellKey(cell))) ||
      (unit.job?.kind === "haul" && drowned.has(unit.job.itemId))
    ) {
      interruptJob(game, unit, "flood");
    }
  }
  return cells.length;
}

export function recedeFlood(game: Game) {
  game.flood = [];
}
