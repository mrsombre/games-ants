import { cellKey, neighbors, point, sameCell } from "./cells";
import { isFlooded } from "./flood";
import { EPSILON, type Game, queenOf } from "./model";
import type { Navigation } from "./navigation";
import { logItemSpawned } from "./simulation-log";

export const EGG_SECONDS = 30;
export function roomCellOccupied(game: Game, id: string) {
  return (
    game.items.some((item) => item.location.kind === "cell" && cellKey(item.location.cell) === id) ||
    game.units.some((unit) => unit.hp > 0 && unit.job?.kind === "haul" && cellKey(unit.job.destination) === id)
  );
}
export function queenCells(game: Game) {
  const queen = queenOf(game);
  return queen
    ? neighbors(queen.cell).filter(
        (cell) => cell.y === queen.cell.y && game.colony[cellKey(cell)] === "nest" && !isFlooded(game, cellKey(cell)),
      )
    : [];
}
function freeQueenCells(game: Game) {
  return queenCells(game).filter((cell) => !roomCellOccupied(game, cellKey(cell)));
}
export function settled(game: Game) {
  const queen = queenOf(game);
  return !!queen && queen.hp > 0 && !queen.job && !queen.route.length && game.colony[cellKey(queen.cell)] === "nest";
}
export function layingInProgress(game: Game) {
  return game.eggTimer > EPSILON && settled(game) && freeQueenCells(game).length > 0;
}
export function advanceEggs(game: Game, seconds: number) {
  if (!settled(game)) return;
  const available = freeQueenCells(game);
  if (!available.length) return;
  game.eggTimer += seconds;
  for (const cell of available) {
    if (game.eggTimer + EPSILON < EGG_SECONDS) break;
    const item = { id: game.nextItemId++, kind: "egg" as const, location: { kind: "cell" as const, cell } };
    game.items.push(item);
    logItemSpawned(game, item);
    game.eggTimer = Math.max(0, game.eggTimer - EGG_SECONDS);
  }
  game.eggTimer = Math.min(game.eggTimer, EGG_SECONDS);
}
export function eggStorageCells(game: Game, navigation: Navigation) {
  const queen = queenOf(game);
  if (!queen) return [];
  const queenSeats = queenCells(game);
  return Object.entries(game.colony).flatMap(([id, tile]) => {
    const cell = point(id);
    if (
      tile !== "nest" ||
      isFlooded(game, id) ||
      sameCell(cell, queen.cell) ||
      queenSeats.some((other) => sameCell(cell, other)) ||
      roomCellOccupied(game, id)
    )
      return [];
    const route = navigation.route(queen.cell, cell);
    return route ? [{ cell, distance: route.length }] : [];
  });
}
