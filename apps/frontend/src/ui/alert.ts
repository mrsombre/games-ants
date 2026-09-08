import { type Game, queenOf } from "@app/game/model";

export type Alert = { tone: "lost"; text: string };

export function gameAlert(game: Game): Alert | null {
  if ((queenOf(game)?.hp ?? 0) <= 0) return { tone: "lost", text: "Королева погибла. Новых яиц больше не будет." };
  return null;
}
