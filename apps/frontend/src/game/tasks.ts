import { connected, key, neighbors, type Point, point } from "./colony";
import { eggDestination, nurseryCells } from "./eggs";
import { type Ant, ENTRANCE, type Game, roles, SURFACE_EXIT, type Worker, type WorkerTask } from "./model";
import { move, routeTo } from "./navigation";

type Task =
  | { kind: "build"; target: string }
  | { kind: "carry-egg"; eggId: number; source: string; destination: string }
  | { kind: "forage" }
  | { kind: "patrol" };
type Bid = { ant: Ant; task: Task; route: Point[]; stand: Point; priority: number; cost: number };

function free(ant: Ant) {
  return !ant.route.length && (ant.role === "worker" ? !ant.task : ant.phase === "home");
}

function availableTasks(game: Game): Task[] {
  const tasks: Task[] = Object.keys(game.blueprints).map((target) => ({ kind: "build", target }));
  const destination = eggDestination(game);
  if (destination) {
    const nursery = new Set(nurseryCells(game).map((p) => key(p.x, p.y)));
    for (const egg of game.eggs) {
      if (!("cell" in egg.location) || !nursery.has(egg.location.cell)) continue;
      if (game.spawns.some((spawn) => spawn.eggId === egg.id)) continue;
      if (game.ants.some((ant) => ant.role === "worker" && ant.task?.kind === "carry-egg" && ant.task.eggId === egg.id))
        continue;
      tasks.push({ kind: "carry-egg", eggId: egg.id, source: egg.location.cell, destination });
    }
  }
  tasks.push({ kind: "forage" }, { kind: "patrol" });
  return tasks;
}

function bid(game: Game, ant: Ant, task: Task): Bid | undefined {
  const role = task.kind === "forage" ? "scout" : task.kind === "patrol" ? "warrior" : "worker";
  if (ant.role !== role) return;
  const priority =
    task.kind === "build"
      ? 100
      : task.kind === "carry-egg"
        ? 60
        : task.kind === "forage"
          ? game.food < 3
            ? 120
            : 80
          : 10;
  let destinations: Point[];
  if (task.kind === "build") {
    const target = point(task.target);
    const blueprint = game.blueprints[task.target];
    if (!blueprint) return;
    destinations = neighbors(target).filter((p) => {
      const tile = game.colony[key(p.x, p.y)];
      return blueprint.tile === "corridor" ? tile === "corridor" : connected(tile, "room", p.y === target.y);
    });
  } else destinations = [task.kind === "carry-egg" ? point(task.source) : ENTRANCE];
  let best: Bid | undefined;
  for (const stand of destinations) {
    const route = routeTo(game.colony, ant, stand);
    if (!route) continue;
    const delivery = task.kind === "carry-egg" ? routeTo(game.colony, stand, point(task.destination)) : [];
    if (!delivery) continue;
    const cost = (route.length + delivery.length) / roles[ant.role].speed;
    if (!best || cost < best.cost) best = { ant, task, route, stand, priority, cost };
  }
  return best;
}

function taskValid(game: Game, task: WorkerTask) {
  if (task.kind === "build") return !!game.blueprints[task.target];
  return game.eggs.some((egg) => egg.id === task.eggId);
}

export function assignTasks(game: Game) {
  for (const ant of game.ants) {
    if (ant.role === "worker" && ant.task && !taskValid(game, ant.task)) {
      ant.task = null;
      ant.route = ant.route.slice(0, 1);
    }
  }
  const ants = game.ants.filter(free).sort((a, b) => a.id - b.id);
  while (ants.length) {
    const tasks = availableTasks(game);
    let winner: Bid | undefined;
    for (const ant of ants) {
      for (const task of tasks) {
        const candidate = bid(game, ant, task);
        if (
          candidate &&
          (!winner ||
            candidate.priority > winner.priority ||
            (candidate.priority === winner.priority && candidate.cost < winner.cost))
        )
          winner = candidate;
      }
    }
    if (!winner) return;
    const { ant, task, route, stand } = winner;
    ant.route = route;
    if (ant.role === "worker") {
      if (task.kind === "build") ant.task = { kind: "build", target: task.target, stand };
      if (task.kind === "carry-egg")
        ant.task = { kind: "carry-egg", eggId: task.eggId, destination: task.destination, phase: "pickup" };
    } else {
      ant.route = [...route, SURFACE_EXIT];
      if (ant.role === "scout") ant.phase = "outbound";
      else ant.phase = "patrol";
    }
    ants.splice(ants.indexOf(ant), 1);
  }
}

export function updateWorker(game: Game, ant: Worker, seconds: number) {
  ant.working = false;
  if (ant.route.length) {
    move(ant, seconds);
    return;
  }
  const task = ant.task;
  if (!task) return;
  if (task.kind === "build") {
    const blueprint = game.blueprints[task.target];
    if (!blueprint) {
      ant.task = null;
      return;
    }
    if (ant.x !== task.stand.x || ant.y !== task.stand.y) {
      ant.route = routeTo(game.colony, ant, task.stand) ?? [];
      return;
    }
    ant.working = true;
    const target = point(task.target);
    ant.heading = Math.atan2(target.y - ant.y, target.x - ant.x);
    blueprint.workers++;
    return;
  }
  const egg = game.eggs.find((entry) => entry.id === task.eggId);
  if (!egg) {
    ant.task = null;
    return;
  }
  if (task.phase === "pickup") {
    if (!("cell" in egg.location) || egg.location.cell !== key(ant.x, ant.y)) {
      ant.task = null;
      return;
    }
    const route = routeTo(game.colony, ant, point(task.destination));
    if (!route) {
      ant.task = null;
      return;
    }
    egg.location = { carrier: ant.id };
    task.phase = "delivery";
    ant.route = route;
  } else if (key(ant.x, ant.y) === task.destination) {
    egg.location = { cell: task.destination };
    ant.task = null;
  } else ant.route = routeTo(game.colony, ant, point(task.destination)) ?? [];
}
