import type { Game } from "../game/model";
import { queenOf } from "../game/model";
import { type IncidentKind, incidentOf } from "../game/narrator";
import { incidentWarning } from "./event-message";

export type AlertTone = "siren" | "threat" | "boon" | "lost";
export type Alert = { tone: AlertTone; text: string };

// Threat texts describe the ongoing state rather than the moment of arrival.
const ongoing: Record<IncidentKind, string> = {
  raid: "Набег! Воины идут на перехват.",
  thieves: "Воры в гнезде охотятся за кладками.",
  boss: "Жук у входа. Панцирь толстый — держите фронт.",
  flood: "Нижняя камера затоплена. Еда и кладки в ней недоступны.",
  predator: "Паук на поляне. Разведчики выходят только с воином.",
  "rich-forage": "Богатый участок: гусеницы попадаются чаще.",
  "food-nearby": "Еда рядом с гнездом: походы короткие.",
};

export function gameAlert(game: Game): Alert | null {
  const { narrator } = game;
  if ((queenOf(game)?.hp ?? 0) <= 0) return { tone: "lost", text: "Королева погибла. Новых яиц больше не будет." };
  if (narrator.active) {
    const tone = incidentOf(narrator.active).class === "threat" ? "threat" : "boon";
    return { tone, text: ongoing[narrator.active] };
  }
  if (narrator.pending) {
    const seconds = Math.max(0, narrator.pending.at - game.elapsedSeconds);
    return { tone: "siren", text: incidentWarning(narrator.pending.incident, seconds) };
  }
  if (narrator.boon) return { tone: "boon", text: ongoing[narrator.boon.kind] };
  return null;
}
