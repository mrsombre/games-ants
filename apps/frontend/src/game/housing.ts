import type { Game } from "./model";

// Each nest cell houses one ant; the queen lives in her own seat and never takes a bed.
export const nestCapacity = (game: Game) => Object.values(game.colony).filter((tile) => tile === "nest").length;
export const nestPopulation = (game: Game) =>
  game.units.filter((unit) => unit.faction === "colony" && unit.role !== "queen" && unit.hp > 0).length +
  game.spawns.length;
export const nestFree = (game: Game) => nestCapacity(game) - nestPopulation(game);
export const hasNestRoom = (game: Game) => nestFree(game) > 0;
