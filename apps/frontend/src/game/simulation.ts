import { cellKey, HOME, key, point } from "./cells";
import { initialColony } from "./colony";
import { contacts, fight } from "./combat";
import { advanceConstruction } from "./construction";
import { advanceEggs } from "./eggs";
import { dropCargo } from "./items";
import { type Game, type GameEvent, queenOf, SIMULATION_STEP } from "./model";
import { move, Navigation } from "./navigation";
import { advanceNesting } from "./nesting";
import { advanceAttack, attackDelay, MAX_ENEMIES } from "./raids";
import { advanceSpawns } from "./spawning";
import { assignTasks } from "./tasks";
import { createUnit, present, type SpawnRole, type Unit } from "./units";
import { interruptJob, performJob, prepareJobs } from "./work";

export function createGame(random: () => number = Math.random): Game {
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
    attackTimer: attackDelay(random),
    maxEnemies: MAX_ENEMIES,
    raidsStarted: 0,
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
      return counts(id)[unit.faction === "colony" ? "raiders" : "colony"] > 0;
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
  const queenWasAlive = (queenOf(game)?.hp ?? 0) > 0;
  advanceAttack(game, seconds, random, events);
  const wasAttack = game.units.some((unit) => unit.faction === "raiders");
  advanceEggs(game, seconds);
  const navigation = new Navigation(game.colony);
  prepareJobs(game, seconds, navigation);
  const before = contacts(game.units);
  const engaged = new Set(before.keys());
  advanceNesting(game, seconds, navigation, engaged);
  assignTasks(game, "colony", navigation, engaged, random);
  assignTasks(game, "raiders", navigation, engaged, random);
  const moved = moveUnits(game.units, seconds);
  const targets = contacts(game.units);
  for (const unit of game.units) if (targets.has(unit.id)) interruptJob(game, unit);
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  for (const unit of [...game.units]) {
    if (unit.hp > 0 && !targets.has(unit.id) && !moved.has(unit.id))
      performJob(game, unit, seconds, navigation, random, events);
  }
  fight(game.units, seconds, targets);
  if (queenWasAlive && queenOf(game)?.hp === 0) events.push({ kind: "queen-died" });
  for (const unit of game.units) if (unit.hp <= 0) dropCargo(game, unit);
  game.units = game.units.filter((unit) => unit.hp > 0 || unit.role === "queen");
  advanceConstruction(game, seconds);
  advanceSpawns(game, seconds);
  if (wasAttack && !game.units.some((unit) => unit.faction === "raiders")) events.push({ kind: "attack-ended" });
  return events;
}
