import { type Colony, initialColony, key, placementError, type Tool } from "./colony";

export type Role = "worker" | "scout" | "warrior";
export const roles = {
  worker: { label: "Рабочий", cost: 1, color: 0xdca34e, size: 0.75 },
  scout: { label: "Разведчик", cost: 2, color: 0x87cbbb, size: 0.65 },
  warrior: { label: "Воин", cost: 3, color: 0xd47662, size: 1 },
};
export type Point = { x: number; y: number };
export type Ant = Point & {
  id: number;
  role: Role;
  route: Point[];
  phase: "home" | "outbound" | "away" | "returning" | "patrol";
  away: number;
  cargo: number;
  target?: string;
  working: boolean;
  heading: number;
};
export type Blueprint = { tile: Tool; progress: number; workers: number };
export type Game = {
  colony: Colony;
  blueprints: Record<string, Blueprint>;
  ants: Ant[];
  food: number;
  nextId: number;
  revision: number;
  deliveries: number;
};
export const buildSeconds = { corridor: 20, room: 30 };
const home = { x: 10, y: 2 };
const entrance = { x: 8, y: 0 };
export const surfaceY = -0.7;
const point = (position: string): Point => {
  const [x = 0, y = 0] = position.split(",").map(Number);
  return { x, y };
};
const neighbors = ({ x, y }: Point) => [
  { x: x - 1, y },
  { x: x + 1, y },
  { x, y: y - 1 },
  { x, y: y + 1 },
];
function connected(a: string | undefined, b: string | undefined, horizontal: boolean) {
  return !!a && !!b && (a === "corridor" || b === "corridor" || horizontal);
}
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
      while (previous.get(key(cursor.x, cursor.y))) {
        result.unshift(cursor);
        cursor = previous.get(key(cursor.x, cursor.y)) as Point;
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
export function plannedColony(game: Game): Colony {
  return { ...game.colony, ...Object.fromEntries(Object.entries(game.blueprints).map(([id, b]) => [id, b.tile])) };
}
export function planBuild(game: Game, x: number, y: number, tile: Tool) {
  const error = placementError(plannedColony(game), x, y, tile);
  if (error) return error;
  game.blueprints[key(x, y)] = { tile, progress: 0, workers: 0 };
  for (const ant of game.ants) if (ant.role === "worker") ant.route = ant.route.slice(0, 1);
  game.revision++;
  return null;
}
export function cancelLastBlueprint(game: Game) {
  const id = Object.keys(game.blueprints).at(-1);
  if (!id) return;
  delete game.blueprints[id];
  game.revision++;
}
export function recruit(game: Game, role: Role) {
  if (game.food < roles[role].cost) return false;
  game.food -= roles[role].cost;
  game.ants.push({
    ...home,
    id: game.nextId++,
    role,
    route: [],
    phase: "home",
    away: 0,
    cargo: 0,
    working: false,
    heading: 0,
  });
  return true;
}
export function createGame(): Game {
  const game: Game = {
    colony: { ...initialColony },
    blueprints: {},
    ants: [],
    food: 13,
    nextId: 1,
    revision: 0,
    deliveries: 0,
  };
  for (const role of ["worker", "worker", "worker", "scout", "warrior"] as const) recruit(game, role);
  return game;
}
function move(ant: Ant, seconds: number) {
  let distance = seconds * (ant.role === "scout" ? 2.4 : 1.5);
  while (ant.route.length && distance > 0) {
    const next = ant.route[0] as Point;
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
function workRoute(game: Game, ant: Ant) {
  let best: { id: string; route: Point[] } | undefined;
  for (const [id, blueprint] of Object.entries(game.blueprints)) {
    const target = point(id);
    for (const neighbor of neighbors(target)) {
      const tile = game.colony[key(neighbor.x, neighbor.y)];
      if (blueprint.tile === "corridor" ? tile !== "corridor" : !connected(tile, "room", neighbor.y === target.y))
        continue;
      const route = routeTo(game.colony, ant, neighbor);
      if (route && (!best || route.length < best.route.length)) best = { id, route };
    }
  }
  return best;
}
// Fixed, short simulation steps keep travel separate from actual worker-seconds on site.
export function stepGame(game: Game, seconds: number, random: () => number = Math.random) {
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  for (const ant of game.ants) {
    ant.working = false;
    if (ant.phase === "away") {
      ant.away -= seconds;
      if (ant.away <= 0) {
        ant.cargo = 1 + Math.floor(random() * 3);
        ant.phase = "returning";
        ant.route = [{ x: 8, y: surfaceY }, entrance, ...(routeTo(game.colony, entrance, home) ?? [])];
      }
      continue;
    }
    if (ant.route.length) {
      move(ant, seconds);
      continue;
    }
    if (ant.role === "worker") {
      const job = workRoute(game, ant);
      ant.target = job?.id;
      if (job) {
        ant.route = job.route;
        if (!job.route.length) {
          ant.working = true;
          const target = point(job.id);
          ant.heading = Math.atan2(target.y - ant.y, target.x - ant.x);
          const blueprint = game.blueprints[job.id];
          if (blueprint) blueprint.workers++;
        }
      } else {
        const destinations = Object.keys(game.colony);
        const destination = destinations[Math.floor(random() * destinations.length)];
        if (destination) ant.route = routeTo(game.colony, ant, point(destination)) ?? [];
      }
    } else if (ant.phase === "home") {
      ant.route = [...(routeTo(game.colony, ant, entrance) ?? []), { x: 8, y: surfaceY }];
      ant.phase = ant.role === "warrior" ? "patrol" : "outbound";
    } else if (ant.phase === "patrol") {
      ant.route = [{ x: 5 + random() * 6, y: surfaceY }];
    } else if (ant.phase === "outbound") {
      if (ant.x >= 0 && ant.x <= 17) ant.route = [{ x: random() < 0.5 ? -1 : 18, y: surfaceY }];
      else {
        ant.phase = "away";
        ant.away = 5 + random() * 55;
      }
    } else if (ant.phase === "returning") {
      game.food += ant.cargo;
      game.deliveries++;
      ant.cargo = 0;
      ant.phase = "home";
    }
  }
  for (const [id, blueprint] of Object.entries(game.blueprints)) {
    blueprint.progress += (seconds * blueprint.workers) / buildSeconds[blueprint.tile];
    if (blueprint.progress >= 1 - 1e-9) {
      game.colony = { ...game.colony, [id]: blueprint.tile };
      delete game.blueprints[id];
      game.revision++;
    }
  }
}
