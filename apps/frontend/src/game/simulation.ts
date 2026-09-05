import { COLS, initialColony, key, type Point, point } from "./colony";
import { advanceAttack, attackDelay, engaged, fight, updateDefense } from "./combat";
import { advanceConstruction } from "./construction";
import { advanceEggs } from "./eggs";
import {
  type Ant,
  ENTRANCE,
  type Game,
  type GameEvent,
  HOME,
  MAX_ENEMIES,
  QUEEN_HP,
  type Role,
  roles,
  type Scout,
  type ScoutCargo,
  SURFACE_EXIT,
  scoutCargoFood,
  WANDER_MAX_SECONDS,
  WANDER_MIN_SECONDS,
} from "./model";
import { move, routeTo } from "./navigation";
import { advanceSpawns } from "./spawning";
import { assignTasks, updateWorker } from "./tasks";

function createAnt(id: number, role: Role, position: Point = HOME): Ant {
  const body = {
    hp: roles[role].hp,
    attackWait: 0,
    healWait: 0,
    ...position,
    id,
    route: [],
    heading: 0,
    wandering: false,
    wanderWait: 0,
  };
  switch (role) {
    case "worker":
      return { ...body, role, task: null, working: false };
    case "scout":
      return { ...body, role, phase: "home", away: 0, cargo: null };
    case "warrior":
      return { ...body, role, phase: "home" };
  }
}
export function createGame(random: () => number = Math.random): Game {
  const initialRoles: Role[] = ["worker", "worker", "worker", "scout", "warrior"];
  const startingCells = Object.entries(initialColony)
    .filter(([, tile]) => tile !== "queen")
    .map(([cell]) => point(cell));
  const ants = initialRoles.map((role, i) => {
    const cellIndex = Math.min(startingCells.length - 1, Math.floor(random() * startingCells.length));
    const [position] = startingCells.splice(cellIndex, 1);
    if (!position) throw new Error("not enough starting cells for ants");
    return createAnt(i + 1, role, position);
  });
  const eggCell = key(random() < 0.5 ? HOME.x - 1 : HOME.x + 1, HOME.y);
  return {
    queen: { ...HOME, role: "queen", hp: QUEEN_HP, attackWait: 0, healWait: 0, heading: 0 },
    colony: { ...initialColony },
    blueprints: {},
    ants,
    enemies: [],
    attackTimer: attackDelay(random),
    maxEnemies: MAX_ENEMIES,
    raidsStarted: 0,
    eggs: [{ id: 1, location: { cell: eggCell } }],
    eggTimer: 0,
    nextEggId: 2,
    spawns: [],
    food: 2,
    nextId: initialRoles.length + 1,
    revision: 0,
    deliveries: 0,
  };
}
function updateScout(game: Game, ant: Scout, seconds: number, random: () => number): GameEvent | undefined {
  if (ant.route.length) {
    move(ant, seconds);
    return;
  }
  switch (ant.phase) {
    case "home":
      return;
    case "outbound":
      if (ant.x >= 0 && ant.x < COLS) {
        ant.route = [{ x: random() < 0.5 ? -1 : COLS, y: SURFACE_EXIT.y }];
      } else {
        ant.phase = "away";
        ant.away = 5 + random() * 55;
      }
      return;
    case "away":
      ant.away -= seconds;
      if (ant.away <= 0) {
        const route = routeTo(game.colony, ENTRANCE, HOME);
        if (!route) return;
        ant.cargo = scoutCargo(random());
        ant.phase = "returning";
        ant.route = [SURFACE_EXIT, ENTRANCE, ...route];
      }
      return;
    case "returning": {
      if (!ant.cargo) {
        ant.phase = "home";
        return;
      }
      const cargo = ant.cargo;
      const food = scoutCargoFood[cargo];
      game.food += food;
      game.deliveries++;
      ant.cargo = null;
      ant.phase = "home";
      return { kind: "scout-delivered", scoutId: ant.id, cargo, food };
    }
  }
}

function scoutCargo(roll: number): ScoutCargo {
  if (roll < 0.4) return "apple";
  if (roll < 0.8) return "mushroom";
  return "caterpillar";
}
// Call with fixed short steps. Travel time never contributes to construction.
export function stepGame(game: Game, seconds: number, random: () => number = Math.random) {
  const events: GameEvent[] = [];
  advanceAttack(game, seconds, random, events);
  advanceEggs(game, seconds);
  for (const ant of game.ants) {
    if (!ant.wandering && !ant.route.length && ant.wanderWait > 0) {
      ant.wanderWait = Math.max(0, ant.wanderWait - seconds);
      if (ant.wanderWait < 1e-9) ant.wanderWait = 0;
    }
  }
  assignTasks(game, random);
  for (const blueprint of Object.values(game.blueprints)) blueprint.workers = 0;
  for (const ant of game.ants) {
    if (engaged(game, ant)) continue;
    if (game.enemies.length && (ant.role !== "scout" || ant.phase === "home" || ant.phase === "outbound")) {
      updateDefense(game, ant, seconds);
      continue;
    }
    const wasWandering = ant.wandering;
    switch (ant.role) {
      case "scout":
        {
          const event = updateScout(game, ant, seconds, random);
          if (event) events.push(event);
        }
        break;
      case "worker":
        updateWorker(game, ant, seconds);
        break;
      case "warrior":
        if (ant.route.length) move(ant, seconds);
        break;
    }
    if (wasWandering && !ant.route.length) {
      ant.wandering = false;
      ant.wanderWait = WANDER_MIN_SECONDS + random() * (WANDER_MAX_SECONDS - WANDER_MIN_SECONDS);
    }
  }
  fight(game, seconds, events);
  advanceConstruction(game, seconds);
  advanceSpawns(game, seconds, createAnt);
  return events;
}
