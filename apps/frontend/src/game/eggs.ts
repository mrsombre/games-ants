import { key, neighbors, point } from "./colony";
import { EGG_SECONDS, type Game, HOME } from "./model";
import { routeTo } from "./navigation";

export function roomCellOccupied(game: Game, cell: string) {
  return (
    game.eggs.some((egg) => "cell" in egg.location && egg.location.cell === cell) ||
    game.ants.some((ant) => ant.role === "worker" && ant.task?.kind === "carry-egg" && ant.task.destination === cell)
  );
}

export function nurseryCells(game: Game) {
  return neighbors(HOME).filter((p) => p.y === HOME.y && game.colony[key(p.x, p.y)] === "room");
}

export function advanceEggs(game: Game, seconds: number) {
  const available = nurseryCells(game).filter((p) => !roomCellOccupied(game, key(p.x, p.y)));
  if (!available.length) return;
  game.eggTimer += seconds;
  for (const cell of available) {
    if (game.eggTimer < EGG_SECONDS - 1e-9) break;
    game.eggs.push({ id: game.nextEggId++, location: { cell: key(cell.x, cell.y) } });
    game.eggTimer = Math.max(0, game.eggTimer - EGG_SECONDS);
  }
  game.eggTimer = Math.min(game.eggTimer, EGG_SECONDS);
}

export function eggDestination(game: Game) {
  const nursery = new Set(nurseryCells(game).map((p) => key(p.x, p.y)));
  let best: { cell: string; distance: number } | undefined;
  for (const [cell, tile] of Object.entries(game.colony)) {
    if (tile !== "room" || nursery.has(cell) || roomCellOccupied(game, cell)) continue;
    const route = routeTo(game.colony, HOME, point(cell));
    if (route && (!best || route.length > best.distance)) best = { cell, distance: route.length };
  }
  return best?.cell;
}
