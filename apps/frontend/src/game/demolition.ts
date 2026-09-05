import { type Colony, connected, isCell, isRoom, key, neighbors, roomSpan } from "./colony";
import { plannedColony } from "./construction";
import { roomCellOccupied } from "./eggs";
import { ENTRANCE, type Game } from "./model";

function staysConnected(colony: Colony, removed: string) {
  const start = key(ENTRANCE.x, ENTRANCE.y);
  const visited = new Set([start]);
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
  if (y === 0) return "Вход в муравейник нельзя сломать";
  if (roomCellOccupied(game, id)) return "Сначала освободи клетку от яиц или дождись доставки";
  if (tile === "queen") return "Клетку с маткой нельзя сломать";
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
  for (const ant of [...game.ants, ...game.enemies]) {
    const next = ant.route[0];
    const occupiesCell = key(Math.round(ant.x), Math.round(ant.y)) === id;
    const leavesCell = next && key(next.x - Math.sign(next.x - ant.x), next.y - Math.sign(next.y - ant.y)) === id;
    if (retreat && (occupiesCell || leavesCell || (next && key(next.x, next.y) === id))) {
      ant.x = retreat.x;
      ant.y = retreat.y;
      ant.route = [];
    } else {
      const index = ant.route.findIndex((p) => key(p.x, p.y) === id);
      if (index >= 0) ant.route = ant.route.slice(0, index);
    }
    if (ant.role === "worker") {
      if (ant.task?.kind === "build") {
        ant.task = null;
        ant.route = ant.route.slice(0, 1);
      }
      ant.working = false;
    }
  }
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  game.revision++;
  return null;
}
