import { type Colony, connected, key, neighbors, type Point } from "./colony";
import { type Ant, roles } from "./model";

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
export function move(ant: Ant, seconds: number) {
  let distance = seconds * roles[ant.role].speed;
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
