import { cellKey, HOME, key, point } from "./cells";
import { initialColony } from "./colony";
import { contacts, fight, retreat, stanceOf } from "./combat";
import { advanceConstruction } from "./construction";
import { advanceEggs } from "./eggs";
import { dropCargo } from "./items";
import { type Game, type GameEvent, queenOf, SIMULATION_STEP } from "./model";
import { advanceNarrator, createNarrator, settleIncidents } from "./narrator";
import { move, Navigation } from "./navigation";
import { advanceNesting } from "./nesting";
import { advanceSpawns } from "./spawning";
import { assignTasks } from "./tasks";
import { createUnit, present, type SpawnRole, type Unit } from "./units";
import { interruptJob, performJob, prepareJobs } from "./work";

export function createGame(random: () => number = Math.random, seed = Math.floor(random() * 4294967296)): Game {
  const initialRoles: SpawnRole[] = ["worker", "worker", "worker", "scout", "warrior"];
  const cells = Object.keys(initialColony)
    .filter((id) => id !== cellKey(HOME))
    .map(point);
  const units = [
    createUnit(0, "queen", "colony", HOME),
    ...initialRoles.map((role, index) => {
      const [cell] = cells.splice(Math.floor(random() * cells.length), 1);
      if (!cell) throw new Error("Not enough starting cells");
      return createUnit(index + 1, role, "colony", cell);
    }),
  ];
  return {
    elapsedSeconds: 0,
    colony: { ...initialColony },
    blueprints: {},
    units,
    items: [
      {
        id: 1,
        kind: "egg",
        location: { kind: "cell", cell: point(key(random() < 0.5 ? HOME.x - 1 : HOME.x + 1, HOME.y)) },
      },
      { id: 2, kind: "food", food: "apple", portions: 1, location: { kind: "cell", cell: { x: 6, y: 2 } } },
      { id: 3, kind: "food", food: "apple", portions: 1, location: { kind: "cell", cell: { x: 7, y: 2 } } },
    ],
    spawns: [],
    narrator: createNarrator(seed),
    eggTimer: 0,
    nestTimer: 0,
    nextItemId: 4,
    nextUnitId: 6,
    revision: 0,
    deliveries: 0,
  };
}
function moveUnits(units: Unit[], seconds: number) {
  const occupied = new Map<string, { colony: number; raiders: number }>();
  const moved = new Set<number>();
  const counts = (id: string) => {
    let value = occupied.get(id);
    if (!value) {
      value = { colony: 0, raiders: 0 };
      occupied.set(id, value);
    }
    return value;
  };
  for (const unit of units) if (present(unit)) counts(cellKey(unit.cell))[unit.faction]++;
  for (const unit of [...units].sort((a, b) => a.id - b.id)) {
    if (!present(unit) || !unit.route.length) continue;
    moved.add(unit.id);
    let previous = cellKey(unit.cell);
    const sync = () => {
      const id = cellKey(unit.cell);
      if (id !== previous) {
        counts(previous)[unit.faction]--;
        counts(id)[unit.faction]++;
        previous = id;
      }
      return stanceOf(unit) === "fight" && counts(id)[unit.faction === "colony" ? "raiders" : "colony"] > 0;
    };
    move(unit, seconds, sync);
    sync();
  }
  return moved;
}
export function stepGame(game: Game, seconds = SIMULATION_STEP, random: () => number = Math.random): GameEvent[] {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > SIMULATION_STEP)
    throw new RangeError("Use a positive simulation step of at most 0.05 seconds");
  const events: GameEvent[] = [];
  game.elapsedSeconds += seconds;
  const queenWasAlive = (queenOf(game)?.hp ?? 0) > 0;
  advanceNarrator(game, seconds, events);
  advanceEggs(game, seconds);
  const navigation = new Navigation(game.colony);
  prepareJobs(game, seconds, navigation);
  const engaged = contacts(game.units).blocked;
  advanceNesting(game, seconds, navigation, engaged);
  assignTasks(game, "colony", navigation, engaged, random);
  assignTasks(game, "raiders", navigation, engaged, random);
  const moved = moveUnits(game.units, seconds);
  const contact = contacts(game.units);
  for (const unit of game.units) if (contact.blocked.has(unit.id)) interruptJob(game, unit);
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  for (const unit of [...game.units]) {
    if (unit.hp > 0 && !contact.blocked.has(unit.id) && !moved.has(unit.id))
      performJob(game, unit, seconds, navigation, random, events);
  }
  fight(game.units, seconds, contact);
  retreat(game, navigation);
  if (queenWasAlive && queenOf(game)?.hp === 0) events.push({ kind: "queen-died" });
  for (const unit of game.units) if (unit.hp <= 0) dropCargo(game, unit);
  game.units = game.units.filter((unit) => unit.hp > 0 || unit.role === "queen");
  advanceConstruction(game, seconds);
  advanceSpawns(game, seconds);
  settleIncidents(game, events);
  return events;
}
