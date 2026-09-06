import { cellKey, ENTRANCE, isCell, key, neighbors, sameCell } from "./cells";
import { type Colony, connected, isRoom, roomSpan } from "./colony";
import { plannedColony } from "./construction";
import { roomCellOccupied } from "./eggs";
import { type Game, queenOf } from "./model";
import { interruptJob } from "./work";

function staysConnected(colony: Colony, removed: string) {
  const start = key(ENTRANCE.x, ENTRANCE.y);
  const visited = new Set<string>([start]);
  const queue = [ENTRANCE];
  for (const current of queue) {
    for (const next of neighbors(current)) {
      const id = key(next.x, next.y);
      if (id === removed || visited.has(id)) continue;
      if (!connected(colony[key(current.x, current.y)], colony[id], next.y === current.y)) continue;
      visited.add(id);
      queue.push(next);
    }
  }
  return Object.keys(colony).every((id) => id === removed || visited.has(id));
}

export function demolitionError(game: Game, x: number, y: number): string | null {
  if (!isCell(x, y)) return "Выбери клетку внутри муравейника";
  const colony = plannedColony(game);
  const id = key(x, y);
  const tile = colony[id];
  if (!tile) return "Здесь нечего ломать";
  if (y <= 1) return "Вход в муравейник нельзя сломать";
  if (roomCellOccupied(game, id)) return "Сначала освободи клетку от яиц или дождись доставки";
  const queen = queenOf(game);
  if (queen && sameCell(queen.cell, { x, y })) return "Клетку с маткой нельзя сломать";
  if (isRoom(tile)) {
    const span = roomSpan(colony, x, y);
    if (x !== span.left && x !== span.right) return "Комнату можно ломать только с края";
  } else if (neighbors({ x, y }).filter((p) => colony[key(p.x, p.y)] === "corridor").length > 1) {
    return "Коридор можно ломать только с конца";
  }
  if (!staysConnected(game.colony, id) || !staysConnected(colony, id)) {
    return "Нельзя отрезать комнату, коридор или чертёж от входа";
  }
  return null;
}

export function demolish(game: Game, x: number, y: number) {
  const error = demolitionError(game, x, y);
  if (error) return error;
  const id = key(x, y);
  const tile = game.colony[id];
  const retreat = neighbors({ x, y }).find((p) => connected(tile, game.colony[key(p.x, p.y)], p.y === y));
  delete game.colony[id];
  delete game.blueprints[id];
  for (const unit of game.units) {
    if (retreat && cellKey(unit.cell) === id) {
      unit.cell = retreat;
      interruptJob(game, unit);
    } else if (unit.route.some((cell) => cellKey(cell) === id)) {
      interruptJob(game, unit);
    }
  }
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  game.revision++;
  return null;
}
