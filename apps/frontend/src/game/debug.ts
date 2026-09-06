import { COLS, isCell } from "./cells";
import { DAY_PHASE_IDS, DAY_PHASE_SECONDS, type DayPhaseId } from "./day-cycle";
import { type Game, type GameEvent, SIMULATION_STEP } from "./model";
import { DAY_SECONDS, type IncidentKind, incidents, startIncident } from "./narrator";
import { stepGame } from "./simulation";
import { createUnit, type Faction, type Role, traits } from "./units";

export function setDifficulty(game: Game, value: number): string | null {
  // Number.isFinite also rejects the non-numbers the console can pass around the type.
  if (!Number.isFinite(value) || value < 0) return "Темп нарратора: нужно конечное неотрицательное число";
  game.narrator.difficulty = value;
  return null;
}

export function pauseNarrator(game: Game): string | null {
  return setDifficulty(game, 0);
}

export function jumpToPhase(game: Game, day: number, phase: DayPhaseId): string | null {
  if (!Number.isInteger(day) || day < 1) return "Телепорт времени: день — целое число от 1";
  const index = DAY_PHASE_IDS.indexOf(phase);
  if (index < 0) return `Телепорт времени: неизвестная фаза, нужна одна из ${DAY_PHASE_IDS.join(", ")}`;
  const target = ((day - 1) * DAY_PHASE_IDS.length + index) * DAY_PHASE_SECONDS;
  const delta = target - game.elapsedSeconds;
  if (delta <= 0) return "Телепорт времени: только вперёд, назад и на месте нельзя";
  game.elapsedSeconds = target;
  // Absolute narrator deadlines move with the clock; relative timers keep their remaining time.
  const narrator = game.narrator;
  narrator.nextIncidentAt += delta;
  narrator.lastPeakAt += delta;
  if (narrator.pending) narrator.pending.at += delta;
  if (narrator.boon) narrator.boon.until += delta;
  if (narrator.effect) narrator.effect.until += delta;
  return null;
}

export function skipTime(game: Game, seconds: number, events: GameEvent[]): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Перемотка: нужно положительное число секунд";
  if (seconds > DAY_SECONDS) return `Перемотка: не больше ${DAY_SECONDS} с за вызов`;
  for (let step = 0; step < Math.round(seconds / SIMULATION_STEP); step++)
    events.push(...stepGame(game, SIMULATION_STEP));
  return null;
}

export function startIncidentNow(game: Game, kind: IncidentKind, events: GameEvent[], size?: number): string | null {
  const incident = incidents.find((entry) => entry.kind === kind);
  if (!incident) return `Инцидент: неизвестный вид, нужен один из ${incidents.map((entry) => entry.kind).join(", ")}`;
  const wanted = size ?? incident.size(game);
  if (!Number.isInteger(wanted) || wanted < 1) return "Инцидент: размер — целое число от 1";
  startIncident(game, kind, wanted, events);
  return null;
}

const FACTIONS: readonly Faction[] = ["colony", "raiders"];
// Roles that never belong to the colony, so the console needs no faction for them.
const RAID_ONLY: readonly Role[] = ["beetle", "spider"];
const isServiceCell = (x: number, y: number) => y === 0 && (x === -1 || x === COLS);

export function spawnUnit(game: Game, role: Role, x: number, y: number, faction?: Faction): string | null {
  const roles = Object.keys(traits) as Role[];
  if (!roles.includes(role)) return `Спавн: неизвестная роль, нужна одна из ${roles.join(", ")}`;
  if (!isCell(x, y) && !isServiceCell(x, y))
    return `Спавн: клетка вне карты, нужна клетка сетки или служебная (-1,0) / (${COLS},0)`;
  if (faction !== undefined && !FACTIONS.includes(faction))
    return `Спавн: неизвестная фракция, нужна одна из ${FACTIONS.join(", ")}`;
  if (role === "queen" && game.units.some((unit) => unit.role === "queen" && unit.hp > 0))
    return "Спавн: матка в колонии одна, вторую поставить нельзя";
  const side = faction ?? (RAID_ONLY.includes(role) ? "raiders" : "colony");
  game.units.push(createUnit(game.nextUnitId++, role, side, { x, y }));
  return null;
}
