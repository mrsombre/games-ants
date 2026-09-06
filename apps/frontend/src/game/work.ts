import { type Cell, cellKey, point, sameCell } from "./cells";
import { dropCargo, type FoodKind, foodValue, forage, type Item, pickUp } from "./items";
import { EPSILON, type Game, type GameEvent } from "./model";
import { type Navigation, setRoute } from "./navigation";
import { foodStorageCells, freeSlots } from "./storage";
import { jobValid, WANDER_MAX_SECONDS, WANDER_MIN_SECONDS } from "./tasks";
import type { Unit } from "./units";

export function interruptJob(game: Game, unit: Unit) {
  dropCargo(game, unit);
  unit.job = null;
  unit.working = false;
  unit.route = [];
  unit.travel = 0;
}
export function prepareJobs(game: Game, seconds: number, navigation: Navigation) {
  for (const unit of game.units) {
    unit.working = false;
    unit.idleWait = Math.max(0, unit.idleWait - seconds);
    if (unit.idleWait < EPSILON) unit.idleWait = 0;
    if (!jobValid(game, unit)) interruptJob(game, unit);
    const job = unit.job;
    if (job?.kind === "attack") {
      const target = game.units.find((other) => other.id === job.targetId);
      if (target && (!unit.route.at(-1) || !sameCell(unit.route.at(-1) ?? unit.cell, target.cell))) {
        const route = navigation.from(unit, target.cell);
        if (route) setRoute(unit, route);
        else interruptJob(game, unit);
      }
    }
  }
}
function discardFood(game: Game, unit: Unit, cargo: FoodKind, events: GameEvent[]) {
  game.items = game.items.filter((item) => item.location.kind !== "carried" || item.location.unitId !== unit.id);
  unit.job = null;
  events.push({ kind: "food-discarded", scoutId: unit.id, cargo });
}
function storeFood(game: Game, unit: Unit, item: Item & { kind: "food" }, events: GameEvent[]) {
  const free = freeSlots(game, cellKey(unit.cell), unit.id);
  if (free <= 0) return discardFood(game, unit, item.food, events);
  item.portions = Math.min(item.portions, free);
  dropCargo(game, unit);
  game.deliveries++;
  unit.job = null;
  events.push({ kind: "scout-delivered", scoutId: unit.id, cargo: item.food, food: item.portions });
}
function nearestStorage(game: Game, unit: Unit, navigation: Navigation) {
  let best: { cell: Cell; route: Cell[] } | undefined;
  for (const cell of foodStorageCells(game)) {
    const route = navigation.from(unit, cell);
    if (route && (!best || route.length < best.route.length)) best = { cell, route };
  }
  return best;
}
export function performJob(
  game: Game,
  unit: Unit,
  seconds: number,
  navigation: Navigation,
  random: () => number,
  events: GameEvent[],
) {
  const job = unit.job;
  if (!job || unit.route.length) return;
  switch (job.kind) {
    case "build": {
      const blueprint = game.blueprints[job.target];
      if (!blueprint || !sameCell(unit.cell, job.stand)) return;
      unit.working = true;
      const target = point(job.target);
      unit.heading = Math.atan2(target.y - unit.cell.y, target.x - unit.cell.x);
      blueprint.workers++;
      return;
    }
    case "haul": {
      const item = game.items.find((item) => item.id === job.itemId);
      if (!item) return interruptJob(game, unit);
      if (job.phase === "pickup") {
        const route = navigation.from(unit, job.destination);
        if (!route || !pickUp(game, unit, item)) return interruptJob(game, unit);
        job.phase = "delivery";
        setRoute(unit, route);
      } else if (sameCell(unit.cell, job.destination)) {
        if (unit.faction === "raiders") {
          game.items = game.items.filter((entry) => entry.id !== item.id);
          game.units = game.units.filter((entry) => entry.id !== unit.id);
        } else if (item.kind === "food") return storeFood(game, unit, item, events);
        else dropCargo(game, unit);
        unit.job = null;
      }
      return;
    }
    case "forage": {
      if (job.phase === "outbound") {
        job.phase = "away";
        job.remaining = 5 + random() * 55;
        return;
      }
      job.remaining = Math.max(0, job.remaining - seconds);
      if (job.remaining > EPSILON) return;
      const cargo = forage(random());
      const id = game.nextItemId++;
      game.items.push({
        id,
        kind: "food",
        food: cargo,
        portions: foodValue[cargo],
        location: { kind: "carried", unitId: unit.id },
      });
      const storage = nearestStorage(game, unit, navigation);
      if (!storage) return discardFood(game, unit, cargo, events);
      unit.job = { kind: "haul", itemId: id, destination: storage.cell, phase: "delivery" };
      setRoute(unit, storage.route);
      return;
    }
    case "wander":
      unit.job = null;
      unit.idleWait = WANDER_MIN_SECONDS + random() * (WANDER_MAX_SECONDS - WANDER_MIN_SECONDS);
      return;
    case "leave":
      if (sameCell(unit.cell, job.destination)) game.units = game.units.filter((entry) => entry.id !== unit.id);
      return;
    case "nest":
      if (!sameCell(unit.cell, job.destination)) return;
      unit.job = null;
      game.nestTimer = 0;
      return;
    case "guard":
    case "attack":
      return;
  }
}
