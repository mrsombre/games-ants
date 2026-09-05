import { COLS, initialColony } from "./colony";
import { advanceConstruction } from "./construction";
import { advanceEggs } from "./eggs";
import {
  type Ant,
  ENTRANCE,
  type Game,
  HOME,
  type Role,
  type Scout,
  SURFACE_EXIT,
  WANDER_MAX_SECONDS,
  WANDER_MIN_SECONDS,
} from "./model";
import { move, routeTo } from "./navigation";
import { advanceSpawns } from "./spawning";
import { assignTasks, updateWorker } from "./tasks";

function createAnt(id: number, role: Role): Ant {
  const body = { ...HOME, id, route: [], heading: 0, wandering: false, wanderWait: 0 };
  switch (role) {
    case "worker":
      return { ...body, role, task: null, working: false };
    case "scout":
      return { ...body, role, phase: "home", away: 0, cargo: 0 };
    case "warrior":
      return { ...body, role, phase: "home" };
  }
}
export function createGame(): Game {
  const initialRoles: Role[] = ["worker", "worker", "worker", "scout", "warrior"];
  return {
    colony: { ...initialColony },
    blueprints: {},
    ants: initialRoles.map((role, i) => createAnt(i + 1, role)),
    eggs: [],
    eggTimer: 0,
    nextEggId: 1,
    spawns: [],
    food: 5,
    nextId: initialRoles.length + 1,
    revision: 0,
    deliveries: 0,
  };
}
function updateScout(game: Game, ant: Scout, seconds: number, random: () => number) {
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
        ant.cargo = 1 + Math.floor(random() * 3);
        ant.phase = "returning";
        ant.route = [SURFACE_EXIT, ENTRANCE, ...route];
      }
      return;
    case "returning":
      game.food += ant.cargo;
      game.deliveries++;
      ant.cargo = 0;
      ant.phase = "home";
  }
}
// Call with fixed short steps. Travel time never contributes to construction.
export function stepGame(game: Game, seconds: number, random: () => number = Math.random) {
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
    const wasWandering = ant.wandering;
    switch (ant.role) {
      case "scout":
        updateScout(game, ant, seconds, random);
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
  advanceConstruction(game, seconds);
  advanceSpawns(game, seconds, createAnt);
}
