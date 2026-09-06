import { key } from "./cells";
import { type BuildTool, type Colony, placementError } from "./colony";
import { EPSILON, type Game } from "./model";

export type Blueprint = { tile: BuildTool; progress: number; workers: number };
export const buildSeconds: Record<BuildTool, number> = { corridor: 20, nest: 30, storage: 30 };

export function plannedColony(game: Game): Colony {
  return { ...game.colony, ...Object.fromEntries(Object.entries(game.blueprints).map(([id, b]) => [id, b.tile])) };
}
export function planBuild(game: Game, x: number, y: number, tile: BuildTool) {
  const error = placementError(plannedColony(game), x, y, tile);
  if (error) return error;
  game.blueprints[key(x, y)] = { tile, progress: 0, workers: 0 };
  game.revision++;
  return null;
}

export function advanceConstruction(game: Game, seconds: number) {
  for (const [id, blueprint] of Object.entries(game.blueprints)) {
    blueprint.progress += (seconds * blueprint.workers) / buildSeconds[blueprint.tile];
    if (blueprint.progress >= 1 - EPSILON) {
      game.colony = { ...game.colony, [id]: blueprint.tile };
      delete game.blueprints[id];
      game.revision++;
    }
  }
}
