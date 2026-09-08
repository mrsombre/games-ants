import { type Cell, COLS, cellKey, ENTRANCE, neighbors, sameCell } from "./cells";
import { type Colony, connected } from "./colony";
import { EPSILON } from "./model";
import type { Unit } from "./units";

type Tree = Map<string, Cell | null>;
export class Navigation {
  private readonly trees = new Map<string, Tree>();
  constructor(
    private readonly colony: Colony,
    private readonly flooded: ReadonlySet<string> = new Set(),
  ) {}

  private walkable(cell: Cell) {
    const id = cellKey(cell);
    return cell.y === 0
      ? Number.isInteger(cell.x) && cell.x >= -1 && cell.x <= COLS
      : !!this.colony[id] && !this.flooded.has(id);
  }
  private adjacent(from: Cell, to: Cell) {
    if (!this.walkable(to)) return false;
    if (from.y === 0 || to.y === 0) {
      return from.y === to.y || from.x === ENTRANCE.x;
    }
    return connected(this.colony[cellKey(from)], this.colony[cellKey(to)], from.y === to.y);
  }
  private tree(from: Cell) {
    const start = cellKey(from);
    const cached = this.trees.get(start);
    if (cached) return cached;
    const previous: Tree = new Map([[start, null]]);
    const queue = [from];
    for (const current of queue) {
      for (const next of neighbors(current)) {
        const id = cellKey(next);
        if (!previous.has(id) && this.adjacent(current, next)) {
          previous.set(id, current);
          queue.push(next);
        }
      }
    }
    this.trees.set(start, previous);
    return previous;
  }
  route(from: Cell, to: Cell): Cell[] | null {
    if (!this.walkable(from) || !this.walkable(to)) return null;
    const previous = this.tree(from);
    if (!previous.has(cellKey(to))) return null;
    const route: Cell[] = [];
    let cursor = to;
    for (let parent = previous.get(cellKey(cursor)); parent; parent = previous.get(cellKey(cursor))) {
      route.push(cursor);
      cursor = parent;
    }
    return route.reverse();
  }
  from(unit: Unit, target: Cell) {
    const next = unit.travel > 0 ? unit.route[0] : undefined;
    const route = this.route(next ?? unit.cell, target);
    return route && (next ? [next, ...route] : route);
  }
}
export function setRoute(unit: Unit, route: Cell[]) {
  if (!unit.route[0] || !route[0] || !sameCell(unit.route[0], route[0])) unit.travel = 0;
  unit.route = route;
}
export function move(unit: Unit, seconds: number, stop: (unit: Unit) => boolean = () => false) {
  let distance = seconds * unit.speed;
  while (unit.route[0] && distance > EPSILON && !stop(unit)) {
    const next = unit.route[0];
    const remaining = 1 - unit.travel;
    unit.heading = Math.atan2(next.y - unit.cell.y, next.x - unit.cell.x);
    if (distance + EPSILON < remaining) {
      unit.travel += distance;
      return;
    }
    unit.cell = next;
    unit.route.shift();
    unit.travel = 0;
    distance -= remaining;
  }
}
export type Position = Readonly<{ x: number; y: number }>;
export function position(unit: Unit): Position {
  const next = unit.route[0];
  return next
    ? {
        x: unit.cell.x + (next.x - unit.cell.x) * unit.travel,
        y: unit.cell.y + (next.y - unit.cell.y) * unit.travel,
      }
    : unit.cell;
}
