import { type Colony, connected, key, neighbors, type Point } from "./colony";
import { type Creature, ENTRANCE, enemyTraits, type Game, roles, SURFACE_EXIT } from "./model";

// Only completed cells are traversable; rooms connect to rooms horizontally.
export function routeTo(colony: Colony, from: Point, to: Point): Point[] | null {
  const start = key(from.x, from.y),
    end = key(to.x, to.y);
  if (!colony[start] || !colony[end]) return null;
  const queue = [from];
  const previous = new Map<string, Point | null>([[start, null]]);
  for (const current of queue) {
    if (key(current.x, current.y) === end) {
      const result: Point[] = [];
      let cursor = current;
      let parent = previous.get(key(cursor.x, cursor.y));
      while (parent) {
        result.unshift(cursor);
        cursor = parent;
        parent = previous.get(key(cursor.x, cursor.y));
      }
      return result;
    }
    for (const next of neighbors(current)) {
      const id = key(next.x, next.y);
      if (!previous.has(id) && connected(colony[key(current.x, current.y)], colony[id], next.y === current.y)) {
        previous.set(id, current);
        queue.push(next);
      }
    }
  }
  return null;
}
export function move(ant: Creature, seconds: number) {
  let distance = seconds * (ant.role === "enemy" ? enemyTraits : roles[ant.role]).speed;
  for (let next = ant.route[0]; next && distance > 0; next = ant.route[0]) {
    const dx = next.x - ant.x,
      dy = next.y - ant.y;
    const length = Math.hypot(dx, dy);
    ant.heading = Math.atan2(dy, dx);
    if (length <= distance) {
      ant.x = next.x;
      ant.y = next.y;
      ant.route.shift();
      distance -= length;
    } else {
      ant.x += (dx / length) * distance;
      ant.y += (dy / length) * distance;
      distance = 0;
    }
  }
}

export function path(game: Game, from: Point, to: Point, avoidEnemies = false) {
  const surfaceFrom = from.y < 0;
  const surfaceTo = to.y < 0;
  if (surfaceFrom && surfaceTo) return [to];
  const colony = avoidEnemies
    ? Object.fromEntries(
        Object.entries(game.colony).filter(
          ([id]) => !game.enemies.some((enemy) => key(Math.round(enemy.x), Math.round(enemy.y)) === id),
        ),
      )
    : game.colony;
  const route = routeTo(colony, surfaceFrom ? ENTRANCE : from, surfaceTo ? ENTRANCE : to);
  return (
    route && [...(surfaceFrom ? [SURFACE_EXIT, ENTRANCE] : []), ...route, ...(surfaceTo ? [SURFACE_EXIT, to] : [])]
  );
}

export function redirect(game: Game, creature: Creature, target: Point, avoidEnemies = false) {
  const next = creature.route[0];
  const inTransit =
    next &&
    (creature.x !== Math.round(creature.x) || creature.y !== Math.round(creature.y)) &&
    creature.y !== SURFACE_EXIT.y;
  const origin = inTransit
    ? next
    : creature.y < 0
      ? creature
      : { x: Math.round(creature.x), y: Math.round(creature.y) };
  const route = path(game, origin, target, avoidEnemies);
  creature.route = route ? [...(inTransit ? [next] : []), ...route] : inTransit ? [next] : [];
}
