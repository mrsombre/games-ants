import { cellKey, neighbors, point, sameCell } from "./cells";
import { EPSILON, type Game, queenOf } from "./model";
import type { Navigation } from "./navigation";

export const EGG_SECONDS = 30;
export function roomCellOccupied(game: Game, id: string) {
  return (
    game.items.some((item) => item.location.kind === "cell" && cellKey(item.location.cell) === id) ||
    game.units.some((unit) => unit.hp > 0 && unit.job?.kind === "haul" && cellKey(unit.job.destination) === id)
  );
}
export function nurseryCells(game: Game) {
  const queen = queenOf(game);
  return queen
    ? neighbors(queen.cell).filter((cell) => cell.y === queen.cell.y && game.colony[cellKey(cell)] === "room")
    : [];
}
function freeNursery(game: Game) {
  return nurseryCells(game).filter((cell) => !roomCellOccupied(game, cellKey(cell)));
}
export function settled(game: Game) {
  const queen = queenOf(game);
  return !!queen && queen.hp > 0 && !queen.job && !queen.route.length && game.colony[cellKey(queen.cell)] === "room";
}
export function layingInProgress(game: Game) {
  return game.eggTimer > EPSILON && settled(game) && freeNursery(game).length > 0;
}
export function advanceEggs(game: Game, seconds: number) {
  if (!settled(game)) return;
  const available = freeNursery(game);
  if (!available.length) return;
  game.eggTimer += seconds;
  for (const cell of available) {
    if (game.eggTimer + EPSILON < EGG_SECONDS) break;
    game.items.push({ id: game.nextItemId++, kind: "egg", location: { kind: "cell", cell } });
    game.eggTimer = Math.max(0, game.eggTimer - EGG_SECONDS);
  }
  game.eggTimer = Math.min(game.eggTimer, EGG_SECONDS);
}
export function storageCells(game: Game, navigation: Navigation) {
  const queen = queenOf(game);
  if (!queen) return [];
  const nursery = nurseryCells(game);
  return Object.entries(game.colony).flatMap(([id, tile]) => {
    const cell = point(id);
    if (
      tile !== "room" ||
      sameCell(cell, queen.cell) ||
      nursery.some((other) => sameCell(cell, other)) ||
      roomCellOccupied(game, id)
    )
      return [];
    const route = navigation.route(queen.cell, cell);
    return route ? [{ cell, distance: route.length }] : [];
  });
}
