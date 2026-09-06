import { expect, it } from "vitest";
import { HOME } from "./cells";
import type { GameEvent } from "./model";
import { Navigation, setRoute } from "./navigation";
import { foodStock } from "./storage";
import { addUnit, advance, egg, food, world } from "./test-support";
import { interruptJob, performJob, prepareJobs } from "./work";

it.each(["pickup", "delivery"] as const)(
  "releases a stale %s assignment without stealing another carrier's item",
  (phase) => {
    const game = world();
    const worker = addUnit(game),
      other = addUnit(game);
    const item = egg(game, { x: 9, y: 3 });
    worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase };
    game.items = [{ ...item, location: { kind: "carried", unitId: other.id } }];
    prepareJobs(game, 0.05, new Navigation(game.colony));
    expect(worker.job).toBeNull();
    expect(game.items[0]?.location).toEqual({ kind: "carried", unitId: other.id });
    worker.job = { kind: "haul", itemId: 999, destination: { x: 6, y: 4 }, phase: "pickup" };
    prepareJobs(game, 0.05, new Navigation(game.colony));
    expect(worker.job).toBeNull();
  },
);
it("retargets moving opponents along passages and releases unreachable or dead targets", () => {
  const game = world();
  const fighter = addUnit(game, "warrior", { x: 8, y: 5 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  fighter.job = { kind: "attack", targetId: enemy.id };
  fighter.route = [
    { x: 8, y: 4 },
    { x: 8, y: 3 },
    { x: 8, y: 2 },
    { x: 8, y: 1 },
  ];
  fighter.travel = 0.25;
  enemy.cell = { x: 8, y: 3 };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(fighter.route).toEqual([
    { x: 8, y: 4 },
    { x: 8, y: 3 },
  ]);
  expect(fighter.travel).toBe(0.25);
  enemy.cell = { x: 1, y: 9 };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(fighter.job).toBeNull();
  expect(fighter.route).toEqual([]);
  fighter.job = { kind: "attack", targetId: enemy.id };
  enemy.hp = 0;
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(fighter.job).toBeNull();
});
it("keeps a guard on duty while enemies remain and releases it after the raid", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  const enemy = addUnit(game, "warrior", { x: 1, y: 0 }, "raiders");
  worker.job = { kind: "guard", destination: worker.cell };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(worker.job?.kind).toBe("guard");
  enemy.hp = 0;
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(worker.job).toBeNull();
});
it.each([
  [0, 5],
  [0.999999, 29.999975],
])("waits after a completed wander but allows real work to interrupt the wait (%s)", (roll, seconds) => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 5 });
  worker.job = { kind: "wander", destination: worker.cell };
  performJob(game, worker, 0.05, new Navigation(game.colony), () => roll, []);
  expect(worker.idleWait).toBeCloseTo(seconds ?? 0, 8);
  advance(game, 4.95, () => roll ?? 0);
  expect(worker.route).toEqual([]);
  expect(worker.job).toBeNull();
  expect(worker.working).toBe(false);
  game.blueprints["8,6"] = { tile: "corridor", workers: 0, progress: 0 };
  advance(game, 0.05);
  expect(worker.job?.kind).toBe("build");
  expect(worker.idleWait).toBe(0);
  expect(worker.working).toBe(true);
  expect(worker.heading).toBeCloseTo(Math.PI / 2, 8);
});
it("interrupts an active wander at the current edge and resumes its remaining distance toward work", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  worker.job = { kind: "wander", destination: { x: 8, y: 1 } };
  setRoute(worker, [
    { x: 8, y: 2 },
    { x: 8, y: 1 },
  ]);
  worker.travel = 0.5;
  game.blueprints["8,6"] = { tile: "corridor", progress: 0, workers: 0 };
  advance(game, 0.05);
  expect(worker.job?.kind).toBe("build");
  expect(worker.route[0]).toEqual({ x: 8, y: 2 });
  expect(worker.travel).toBeCloseTo(0.55, 8);
});
it("stores delivered food in the storage cell and reports it once, ignoring its own reservation", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 7, y: 2 });
  const retained = egg(game, { x: 9, y: 3 });
  food(game, scout.cell);
  const cargo = food(game, scout.cell, "caterpillar");
  cargo.location = { kind: "carried", unitId: scout.id };
  scout.job = { kind: "haul", itemId: cargo.id, destination: scout.cell, phase: "delivery" };
  const events: GameEvent[] = [];
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, events);
  expect(cargo.location).toEqual({ kind: "cell", cell: { x: 7, y: 2 } });
  expect(game.items).toContain(retained);
  expect(game.units).toHaveLength(2);
  expect(foodStock(game)).toBe(3);
  expect(game.deliveries).toBe(1);
  expect(events).toEqual([{ kind: "scout-delivered", scoutId: scout.id, cargo: "caterpillar", food: 2 }]);
  expect(scout.job).toBeNull();
});
it("loses the part of a caterpillar that does not fit into the last free slot", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 7, y: 2 });
  food(game, scout.cell);
  food(game, scout.cell);
  const cargo = food(game, scout.cell, "caterpillar");
  cargo.location = { kind: "carried", unitId: scout.id };
  scout.job = { kind: "haul", itemId: cargo.id, destination: scout.cell, phase: "delivery" };
  const events: GameEvent[] = [];
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, events);
  expect(cargo.portions).toBe(1);
  expect(foodStock(game)).toBe(3);
  expect(events).toEqual([{ kind: "scout-delivered", scoutId: scout.id, cargo: "caterpillar", food: 1 }]);
});
it("throws food away at a storage cell that filled up on the way", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 7, y: 2 });
  for (let i = 0; i < 3; i++) food(game, scout.cell);
  const cargo = food(game, scout.cell, "mushroom");
  cargo.location = { kind: "carried", unitId: scout.id };
  scout.job = { kind: "haul", itemId: cargo.id, destination: scout.cell, phase: "delivery" };
  const events: GameEvent[] = [];
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, events);
  expect(game.items).not.toContain(cargo);
  expect(foodStock(game)).toBe(3);
  expect(game.deliveries).toBe(0);
  expect(events).toEqual([{ kind: "food-discarded", scoutId: scout.id, cargo: "mushroom" }]);
  expect(scout.job).toBeNull();
});
it("drops cargo at the actual cell on an explicit interruption and clears work and travel", () => {
  const game = world();
  const worker = addUnit(game);
  const item = egg(game, worker.cell);
  game.items = [{ ...item, location: { kind: "carried", unitId: worker.id } }];
  worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase: "delivery" };
  worker.route = [{ x: 9, y: 3 }];
  worker.travel = 0.5;
  worker.working = true;
  interruptJob(game, worker);
  expect(game.items[0]?.location).toEqual({ kind: "cell", cell: HOME });
  expect([worker.job, worker.travel, worker.working]).toEqual([null, 0, false]);
  expect(worker.route).toEqual([]);
});

it("never performs building or delivery remotely, and switches a successful pickup to delivery", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 4 });
  game.blueprints["8,6"] = { tile: "corridor", progress: 0, workers: 0 };
  worker.job = { kind: "build", target: "8,6", stand: { x: 8, y: 5 } };
  const navigation = new Navigation(game.colony);
  performJob(game, worker, 0.05, navigation, () => 0.5, []);
  expect(game.blueprints["8,6"]?.workers).toBe(0);
  expect(worker.working).toBe(false);
  const item = egg(game, worker.cell);
  worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase: "pickup" };
  performJob(game, worker, 0.05, navigation, () => 0.5, []);
  expect(worker.job).toMatchObject({ kind: "haul", phase: "delivery" });
  worker.route = [];
  performJob(game, worker, 0.05, navigation, () => 0.5, []);
  expect(item.location).toEqual({ kind: "carried", unitId: worker.id });
});
it("only removes a thief and its own loot on escape, preserving the queen and other eggs", () => {
  const game = world();
  const thief = addUnit(game, "worker", { x: -1, y: 0 }, "raiders");
  const retained = egg(game, { x: 6, y: 4 });
  game.items.push({ id: 99, kind: "egg", location: { kind: "carried", unitId: thief.id } });
  thief.job = { kind: "haul", itemId: 99, destination: thief.cell, phase: "delivery" };
  performJob(game, thief, 0.05, new Navigation(game.colony), () => 0.5, []);
  expect(game.items).toEqual([retained]);
  expect(game.units.map((unit) => unit.id)).toEqual([0]);
});
it("turns a finished expedition into a delivery to the nearest free storage cell and survives losing the cargo", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: -1, y: 0 });
  scout.job = { kind: "forage", phase: "away", exit: scout.cell, remaining: 0 };
  food(game, { x: 7, y: 2 });
  food(game, { x: 7, y: 2 });
  food(game, { x: 7, y: 2 });
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.9, []);
  const cargo = game.items.find((item) => item.location.kind === "carried");
  expect(cargo).toMatchObject({ kind: "food", food: "caterpillar", portions: 2 });
  expect(scout.job).toEqual({ kind: "haul", itemId: cargo?.id, destination: { x: 6, y: 2 }, phase: "delivery" });
  expect(scout.route.at(-1)).toEqual({ x: 6, y: 2 });
  expect(foodStock(game)).toBe(3);
  scout.cell = { x: 6, y: 2 };
  scout.route = [];
  game.items = game.items.filter((item) => item !== cargo);
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, []);
  expect(foodStock(game)).toBe(3);
  expect(scout.job).toBeNull();
});
it("discards the catch at the map edge when no storage slot is free and frees the scout", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 18, y: 0 });
  scout.job = { kind: "forage", phase: "away", exit: scout.cell, remaining: 0.04 };
  for (const x of [6, 7]) for (let i = 0; i < 3; i++) food(game, { x, y: 2 });
  const events: GameEvent[] = [];
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, events);
  expect(game.items).toHaveLength(6);
  expect(scout.job).toBeNull();
  expect(scout.route).toEqual([]);
  expect(events).toEqual([{ kind: "food-discarded", scoutId: scout.id, cargo: "mushroom" }]);
  expect(game.nextItemId).toBe(11);
});
it("keeps a departing raider until the exit and leaves allied units in the world", () => {
  const game = world();
  const thief = addUnit(game, "worker", { x: 0, y: 0 }, "raiders");
  thief.job = { kind: "leave", destination: { x: -1, y: 0 } };
  performJob(game, thief, 0.05, new Navigation(game.colony), () => 0.5, []);
  expect(game.units).toHaveLength(2);
  thief.cell = { x: -1, y: 0 };
  performJob(game, thief, 0.05, new Navigation(game.colony), () => 0.5, []);
  expect(game.units.map((unit) => unit.id)).toEqual([0]);
});
it("retains active surface patrols and reassigns them when their destination disappears", () => {
  const game = world();
  const warrior = addUnit(game, "warrior", { x: 8, y: 0 });
  warrior.job = { kind: "wander", destination: { x: 5, y: 0 } };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(warrior.job?.kind).toBe("wander");
  warrior.job = { kind: "wander", destination: { x: 0, y: 9 } };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(warrior.job).toBeNull();
});

it("releases an obsolete target even while another enemy remains alive", () => {
  const game = world();
  const warrior = addUnit(game, "warrior", { x: 8, y: 3 });
  const gone = addUnit(game, "warrior", { x: 1, y: 0 }, "raiders");
  addUnit(game, "warrior", { x: 16, y: 0 }, "raiders");
  warrior.job = { kind: "attack", targetId: gone.id };
  game.units = game.units.filter((unit) => unit.id !== gone.id);
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(warrior.job).toBeNull();
});

it("resumes patrol exactly when its five second wait expires", () => {
  const game = world();
  const worker = addUnit(game);
  worker.idleWait = 5;
  advance(game, 4.95);
  expect(worker.job).toBeNull();
  advance(game, 0.05);
  expect(worker.job?.kind).toBe("wander");
  expect(worker.route.length).toBeGreaterThan(0);
});
it("continues pursuit when a target departs after the pursuer exhausted its route", () => {
  const game = world();
  const fighter = addUnit(game, "warrior", { x: 8, y: 3 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 2 }, "raiders");
  fighter.job = { kind: "attack", targetId: enemy.id };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(fighter.route).toEqual([{ x: 8, y: 2 }]);
  enemy.cell = { x: 8, y: 1 };
  prepareJobs(game, 0.05, new Navigation(game.colony));
  expect(fighter.route).toEqual([
    { x: 8, y: 2 },
    { x: 8, y: 1 },
  ]);
});
