import { expect, it } from "vitest";
import { EXIT } from "./cells";
import { planBuild } from "./construction";
import { dropCargo, pickUp } from "./items";
import type { Job } from "./jobs";
import { Navigation, setRoute } from "./navigation";
import { stepGame } from "./simulation";
import {
  attachSimulationLog,
  getSimulationLog,
  logItemSpawned,
  logTaskEnded,
  logTaskPhase,
  logTaskStarted,
  logUnitSpawned,
  runLoggedCommand,
  snapshot,
} from "./simulation-log";
import { addUnit, advance, egg, food, world } from "./test-support";

function loggedWorld() {
  const game = world();
  const lines: string[] = [];
  attachSimulationLog(game, (line) => lines.push(line));
  return { game, lines };
}

function sequences(lines: readonly string[]) {
  return lines.map((line) => Number(/^seq=(\d+)/.exec(line)?.[1]));
}

it("logs the initial party and deduplicates repeated unit and item announcements", () => {
  const { game, lines } = loggedWorld();
  const scout = addUnit(game, "scout", EXIT);
  const cargo = food(game, EXIT, "caterpillar");
  logUnitSpawned(game, scout);
  logItemSpawned(game, cargo);
  logUnitSpawned(game, scout);
  logItemSpawned(game, cargo);

  expect(lines[0]).toBe("seq=1 t=0 game event=started");
  expect(lines[2]).toContain(`unit id=${scout.id} role=scout faction=colony event=spawned cell=-1,0 on_map=false`);
  expect(lines[3]).toContain(
    `item id=${cargo.id} kind=food food=caterpillar amount=2 event=spawned location=cell cell=-1,0`,
  );
  expect(lines).toHaveLength(4);
  expect(sequences(lines)).toEqual([1, 2, 3, 4]);
});

it("wraps consequences in a command request and result with escaped single-line parameters", () => {
  const { game, lines } = loggedWorld();
  const result = runLoggedCommand(game, "ui", "build", { x: 8, y: 6, tile: "corridor" }, () =>
    planBuild(game, 8, 6, "corridor"),
  );
  expect(result).toBeNull();
  expect(lines[2]).toBe(
    'seq=3 t=0 command source=ui name=build command_id=1 event=requested params={"x":8,"y":6,"tile":"corridor"}',
  );
  expect(lines[3]).toBe("seq=4 t=0 construction cell=8,6 tile=corridor event=build_ordered");
  expect(lines[4]).toBe("seq=5 t=0 command source=ui name=build command_id=1 event=result result=success ok=true");

  const value = 'a b"\n';
  const reason = "reason with spaces";
  runLoggedCommand(game, "dev", "probe", { value }, () => reason);
  expect(lines[5]).toBe(
    `seq=6 t=0 command source=dev name=probe command_id=2 event=requested params=${JSON.stringify({ value })}`,
  );
  expect(lines[6]).toBe(
    `seq=7 t=0 command source=dev name=probe command_id=2 event=result result=rejected ok=false reason=${JSON.stringify(reason)}`,
  );
  expect(lines.every((line) => !line.includes("\n"))).toBe(true);
});

it("logs pickup, phase changes, drops, arrival and forage departure without per-cell noise", () => {
  const { game, lines } = loggedWorld();
  const worker = addUnit(game, "worker", { x: 9, y: 3 });
  const item = egg(game, worker.cell);
  logUnitSpawned(game, worker);
  logItemSpawned(game, item);
  const haul: Job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase: "pickup" };
  worker.job = haul;
  logTaskStarted(game, worker, haul);
  expect(pickUp(game, worker, item)).toBe(true);
  haul.phase = "delivery";
  logTaskPhase(game, worker, haul, "delivery");
  dropCargo(game, worker, "flee");
  logTaskEnded(game, worker, haul, "cancelled", "fleeing");

  const scout = addUnit(game, "scout", { x: 8, y: 5 });
  const forage = { kind: "forage" as const, phase: "outbound" as const, exit: EXIT, remaining: 0 };
  scout.job = forage;
  logUnitSpawned(game, scout);
  logTaskStarted(game, scout, forage);
  setRoute(scout, new Navigation(game.colony).route(scout.cell, EXIT) ?? []);
  advance(game, 5, () => 0.5);

  expect(lines.some((line) => line.includes(`unit id=${worker.id}`) && line.includes("event=task_started"))).toBe(true);
  expect(lines.some((line) => line.includes(`item id=${item.id}`) && line.includes("event=picked_up"))).toBe(true);
  expect(
    lines.some(
      (line) =>
        line.includes(`unit id=${worker.id}`) && line.includes("event=task_phase") && line.includes("phase=delivery"),
    ),
  ).toBe(true);
  expect(
    lines.some(
      (line) => line.includes(`item id=${item.id}`) && line.includes("event=dropped") && line.includes("reason=flee"),
    ),
  ).toBe(true);
  expect(lines.some((line) => line.includes(`unit id=${scout.id}`) && line.includes("event=arrived cell=-1,0"))).toBe(
    true,
  );
  expect(
    lines.some((line) => line.includes(`unit id=${scout.id}`) && line.includes("event=forage_left exit=-1,0")),
  ).toBe(true);
  expect(lines.filter((line) => line.includes(`unit id=${scout.id}`) && line.includes("event=arrived")).length).toBe(1);
});

it("logs actual simultaneous attacks and the resulting death", () => {
  const { game, lines } = loggedWorld();
  const attacker = addUnit(game, "warrior", { x: 8, y: 3 });
  const target = addUnit(game, "warrior", attacker.cell, "raiders");
  target.hp = 1;
  attacker.attackWait = 0.95;
  target.attackWait = 0.95;
  logUnitSpawned(game, attacker);
  logUnitSpawned(game, target);
  stepGame(game, 0.05, () => 0.5);

  expect(
    lines.some(
      (line) => line.includes(`unit id=${attacker.id}`) && line.includes(`event=attack target=${target.id} damage=4`),
    ),
  ).toBe(true);
  expect(
    lines.some(
      (line) => line.includes(`unit id=${target.id}`) && line.includes(`event=attack target=${attacker.id} damage=4`),
    ),
  ).toBe(true);
  expect(lines.some((line) => line.includes(`unit id=${target.id}`) && line.includes("event=died"))).toBe(true);
  expect(game.units.some((unit) => unit.id === target.id)).toBe(false);
});

it("prints a fixed snapshot with all requested context and no game mutation", () => {
  const { game, lines } = loggedWorld();
  game.elapsedSeconds = 12.5;
  game.blueprints["8,6"] = { tile: "corridor", progress: 0.4, workers: 1 };
  const scout = addUnit(game, "scout", EXIT);
  scout.job = { kind: "forage", phase: "away", exit: EXIT, remaining: 4 };
  const cargo = food(game, EXIT, "caterpillar");
  cargo.location = { kind: "carried", unitId: scout.id };
  const hatch = egg(game, { x: 6, y: 4 });
  game.spawns = [{ eggId: hatch.id, role: "worker", progress: 0.4 }];
  game.flood = ["8,5"];
  const before = JSON.stringify(game);

  const printed = snapshot(game);
  const copy = [...printed];

  expect(printed[0]).toBe("seq=3 t=12.5 snapshot event=started");
  expect(printed.at(-1)).toBe(`seq=${2 + printed.length} t=12.5 snapshot event=finished`);
  expect(printed).toEqual(lines.slice(-printed.length));
  expect(printed.some((line) => line.includes(`snapshot event=resources elapsed=12.5`))).toBe(true);
  expect(
    printed.some((line) => line.includes(`snapshot event=blueprint cell=8,6 tile=corridor progress=0.4 workers=1`)),
  ).toBe(true);
  expect(
    printed.some(
      (line) =>
        line.includes(`snapshot event=unit id=${scout.id}`) &&
        line.includes("on_map=false") &&
        line.includes("present=false"),
    ),
  ).toBe(true);
  expect(
    printed.some(
      (line) =>
        line.includes(`snapshot event=item id=${cargo.id}`) &&
        line.includes("location=carried") &&
        line.includes(`unit=${scout.id}`),
    ),
  ).toBe(true);
  expect(printed.some((line) => line.includes(`snapshot event=spawn egg=${hatch.id} role=worker progress=0.4`))).toBe(
    true,
  );
  expect(printed.some((line) => line.includes('snapshot event=flood cells=["8,5"]'))).toBe(true);
  expect(JSON.stringify(game)).toBe(before);

  game.elapsedSeconds = 99;
  scout.cell = { x: 8, y: 5 };
  cargo.portions = 1;
  expect(printed).toEqual(copy);
});

it("keeps the logger opt-in until the development wiring attaches it", () => {
  const game = world();
  expect(getSimulationLog(game)).toBeUndefined();
  attachSimulationLog(game, () => undefined);
  expect(getSimulationLog(game)).toBeDefined();
});

it("reattaches the sink without replaying the party or duplicating later records", () => {
  const game = world();
  const first: string[] = [];
  attachSimulationLog(game, (line) => first.push(line));
  const second: string[] = [];
  attachSimulationLog(game, (line) => second.push(line));

  const worker = addUnit(game);
  logUnitSpawned(game, worker);

  expect(first).toHaveLength(2);
  expect(second).toEqual([
    `seq=3 t=0 unit id=${worker.id} role=worker faction=colony event=spawned cell=${worker.cell.x},${worker.cell.y} on_map=true`,
  ]);
});
