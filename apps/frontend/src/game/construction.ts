import { key } from "./cells";
import { type BuildTool, type Colony, placementError } from "./colony";
import { EPSILON, type Game } from "./model";

export type Blueprint = { tile: BuildTool; progress: number; workers: number };
export const buildSeconds: Record<BuildTool, number> = { corridor: 20, nest: 30, storage: 30 };
export const MAX_BUILDERS = 3;

export function plannedColony(game: Game): Colony {
  return { ...game.colony, ...Object.fromEntries(Object.entries(game.blueprints).map(([id, b]) => [id, b.tile])) };
}
function bumpRevision(game: Game) {
  (game as { revision: number }).revision++;
}

export function placeBlueprint(game: Game, id: string, tile: BuildTool) {
  game.blueprints[id] = { tile, progress: 0, workers: 0 };
  bumpRevision(game);
}

export function finishBlueprint(game: Game, id: string) {
  const blueprint = game.blueprints[id];
  if (!blueprint) return;
  game.colony[id] = blueprint.tile;
  delete game.blueprints[id];
  bumpRevision(game);
}

export function clearCell(game: Game, id: string) {
  delete game.colony[id];
  delete game.blueprints[id];
  bumpRevision(game);
}

export function planBuild(game: Game, x: number, y: number, tile: BuildTool) {
  const error = placementError(plannedColony(game), x, y, tile);
  if (error) return error;
  placeBlueprint(game, key(x, y), tile);
  return null;
}

export function advanceConstruction(game: Game, seconds: number) {
  for (const [id, blueprint] of Object.entries(game.blueprints)) {
    blueprint.progress += (seconds * blueprint.workers) / buildSeconds[blueprint.tile];
    if (blueprint.progress >= 1 - EPSILON) {
      finishBlueprint(game, id);
    }
  }
}
