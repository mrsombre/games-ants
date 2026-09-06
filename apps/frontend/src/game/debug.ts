import type { Game } from "./model";

export function setDifficulty(game: Game, value: number): string | null {
  // Number.isFinite also rejects the non-numbers the console can pass around the type.
  if (!Number.isFinite(value) || value < 0) return "Темп нарратора: нужно конечное неотрицательное число";
  game.narrator.difficulty = value;
  return null;
}

export function pauseNarrator(game: Game): string | null {
  return setDifficulty(game, 0);
}
