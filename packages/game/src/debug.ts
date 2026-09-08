import { COLS, cellKey, isCell, key } from "./cells";
import { type BuildTool, placementError } from "./colony";
import { finishBlueprint, placeBlueprint, plannedColony } from "./construction";
import { DAY_PHASE_IDS, DAY_PHASE_SECONDS, DAY_SECONDS, type DayPhaseId } from "./day-cycle";
import { demolitionError, razeCell } from "./demolition";
import { type Game, type GameEvent, SIMULATION_STEP } from "./model";
import { stepGame } from "./simulation";
import { logItemSpawned, logUnitSpawned } from "./simulation-log";
import { consumeFood, foodStock, foodStorageCells, freeSlots, storageCapacity } from "./storage";
import { createUnit, type Faction, type Role, traits } from "./units";

export function jumpToPhase(game: Game, day: number, phase: DayPhaseId): string | null {
  if (!Number.isInteger(day) || day < 1) return "Телепорт времени: день — целое число от 1";
  const index = DAY_PHASE_IDS.indexOf(phase);
  if (index < 0) return `Телепорт времени: неизвестная фаза, нужна одна из ${DAY_PHASE_IDS.join(", ")}`;
  const target = ((day - 1) * DAY_PHASE_IDS.length + index) * DAY_PHASE_SECONDS;
  const delta = target - game.elapsedSeconds;
  if (delta <= 0) return "Телепорт времени: только вперёд, назад и на месте нельзя";
  game.elapsedSeconds = target;
  return null;
}

export function skipTime(game: Game, seconds: number, events: GameEvent[]): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Перемотка: нужно положительное число секунд";
  if (seconds > DAY_SECONDS) return `Перемотка: не больше ${DAY_SECONDS} с за вызов`;
  for (let step = 0; step < Math.round(seconds / SIMULATION_STEP); step++)
    events.push(...stepGame(game, SIMULATION_STEP));
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
  const unit = createUnit(game.nextUnitId++, role, side, { x, y });
  game.units.push(unit);
  logUnitSpawned(game, unit);
  return null;
}

export function setFood(game: Game, amount: number): string | null {
  if (!Number.isInteger(amount) || amount < 0) return "Еда: нужно целое неотрицательное число";
  const stock = foodStock(game);
  // Free slots hold one portion each, so the reachable maximum is the stock plus them.
  const limit = stock + storageCapacity(game);
  if (amount > limit) return `Еда: на складе помещается не больше ${limit}`;
  if (amount < stock) consumeFood(game, stock - amount, "dev_food");
  const slots = foodStorageCells(game).flatMap((cell) =>
    Array.from({ length: freeSlots(game, cellKey(cell)) }, () => cell),
  );
  for (const cell of slots.slice(0, amount - foodStock(game))) {
    const item = {
      id: game.nextItemId++,
      kind: "food",
      food: "apple",
      portions: 1,
      location: { kind: "cell", cell },
    } as const;
    game.items.push(item);
    logItemSpawned(game, item);
  }
  return null;
}

const BUILD_TOOLS: readonly BuildTool[] = ["corridor", "nest", "storage"];
// Guard kept even under `force`: the top two rows are the entrance and the grid ends at the map.
function groundError(x: number, y: number, what: string): string | null {
  if (!isCell(x, y)) return `${what}: клетка вне карты`;
  if (y <= 1) return `${what}: ряды 0 и 1 закрыты`;
  return null;
}

export type BuildOptions = { force?: boolean };

export function buildCell(
  game: Game,
  x: number,
  y: number,
  tile: BuildTool,
  options: BuildOptions = {},
): string | null {
  if (!BUILD_TOOLS.includes(tile)) return `Постройка: неизвестный тип, нужен один из ${BUILD_TOOLS.join(", ")}`;
  const error = options.force ? groundError(x, y, "Постройка") : placementError(plannedColony(game), x, y, tile);
  if (error) return error;
  const id = key(x, y);
  placeBlueprint(game, id, tile);
  finishBlueprint(game, id);
  return null;
}

export function clearBuilt(game: Game, x: number, y: number, options: BuildOptions = {}): string | null {
  const error = options.force ? groundError(x, y, "Снос") : demolitionError(game, x, y);
  if (error) return error;
  razeCell(game, x, y);
  return null;
}
