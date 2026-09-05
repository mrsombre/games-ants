import { type BuildTool, type Colony, connected, key, neighbors, type Point, placementError, point } from "./colony";
import { buildSeconds, type Game, type Worker } from "./model";
import { routeTo } from "./navigation";

export function plannedColony(game: Game): Colony {
  return { ...game.colony, ...Object.fromEntries(Object.entries(game.blueprints).map(([id, b]) => [id, b.tile])) };
}
export function planBuild(game: Game, x: number, y: number, tile: BuildTool) {
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

function workRoute(game: Game, ant: Worker) {
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

export function assignWorker(game: Game, ant: Worker, random: () => number) {
  const job = workRoute(game, ant);
  ant.target = job?.id ?? null;
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
}

export function advanceConstruction(game: Game, seconds: number) {
  for (const [id, blueprint] of Object.entries(game.blueprints)) {
    blueprint.progress += (seconds * blueprint.workers) / buildSeconds[blueprint.tile];
    if (blueprint.progress >= 1 - 1e-9) {
      game.colony = { ...game.colony, [id]: blueprint.tile };
      delete game.blueprints[id];
      game.revision++;
    }
  }
}
