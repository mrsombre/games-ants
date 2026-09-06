import { expect, it } from "vitest";
import { cellKey } from "./cells";
import { planBuild } from "./construction";
import { queenOf } from "./model";
import { createGame, stepGame } from "./simulation";
import { startSpawn } from "./spawning";
import { foodStock } from "./storage";
import { SURFACE_POST } from "./tasks";
import { addUnit, advance, egg, food, world } from "./test-support";

it("creates independent games with unique unit ids and valid initial positions", () => {
  const first = createGame(() => 0),
    second = createGame(() => 0.5);
  expect(new Set(first.units.map((unit) => unit.id)).size).toBe(6);
  expect(new Set(first.units.map((unit) => cellKey(unit.cell))).size).toBe(6);
  expect(first.items[0]?.location).toEqual({ kind: "cell", cell: { x: 9, y: 3 } });
  expect(foodStock(first)).toBe(2);
  expect(first.units.slice(1).map((unit) => unit.cell)).not.toEqual(second.units.slice(1).map((unit) => unit.cell));
  expect(second.items[0]?.location).toEqual({ kind: "cell", cell: { x: 11, y: 3 } });
  const firstQueen = queenOf(first);
  if (!firstQueen) throw new Error("queen");
  firstQueen.hp = 0;
  expect(queenOf(second)?.hp).toBe(24);
});
it.each([0, -1, 0.1, NaN, Infinity])("rejects an invalid simulation step without mutating the game (%s)", (seconds) => {
  const game = world(),
    before = structuredClone(game);
  expect(() => stepGame(game, seconds)).toThrow(RangeError);
  expect(game).toEqual(before);
});
it.each([1, 3])("builds a corridor using %s workers, then opens the queued next segment", (count) => {
  const game = world();
  for (let i = 0; i < count; i++) addUnit(game, "worker", { x: 8, y: 5 });
  expect(planBuild(game, 8, 6, "corridor")).toBeNull();
  expect(planBuild(game, 8, 7, "corridor")).toBeNull();
  advance(game, 6);
  expect(game.blueprints["8,6"]?.progress).toBeCloseTo(count === 1 ? 0.3 : 0.9, 8);
  expect(game.blueprints["8,7"]?.progress).toBe(0);
  advance(game, count === 1 ? 14 : 0.7);
  expect(game.colony["8,6"]).toBe("corridor");
  advance(game, 0.5);
  expect(game.blueprints["8,7"]?.progress).toBe(0);
  advance(game, 21);
  expect(game.colony["8,7"]).toBe("corridor");
});
it("counts work only after arrival and frees a worker after cancellation", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 4 });
  planBuild(game, 8, 6, "corridor");
  advance(game, 0.95);
  expect(game.blueprints["8,6"]?.progress).toBe(0);
  advance(game, 0.1);
  expect(game.blueprints["8,6"]?.progress).toBeCloseTo(0.0025, 8);
  delete game.blueprints["8,6"];
  advance(game, 1);
  expect(worker.job?.kind).toBe("wander");
  expect(game.colony["8,6"]).toBeUndefined();
});
it.each(["nest", "storage"] as const)("waits for workers and completes a %s after thirty working seconds", (tile) => {
  const game = world();
  planBuild(game, 7, 5, tile);
  advance(game, 10);
  expect(game.blueprints["7,5"]?.progress).toBe(0);
  const worker = addUnit(game, "worker", { x: 8, y: 5 });
  advance(game, 29.95);
  expect(worker.heading).toBeCloseTo(Math.PI, 8);
  expect(game.colony["7,5"]).toBeUndefined();
  advance(game, 0.05);
  expect(game.colony["7,5"]).toBe(tile);
});
it.each([
  [0, "apple", 1, -1, 5],
  [0.4, "mushroom", 1, -1, 27],
  [0.8, "caterpillar", 2, 18, 49],
] as const)(
  "completes a scout expedition with %s roll, physical cargo and one delivery",
  (roll, cargo, food, exitX, awaySeconds) => {
    const game = world();
    const scout = addUnit(game, "scout");
    for (let i = 0; i < 1000 && !(scout.job?.kind === "forage" && scout.job.phase === "away"); i++)
      stepGame(game, 0.05, () => roll);
    expect(scout.job).toMatchObject({ kind: "forage", phase: "away", remaining: awaySeconds });
    expect(scout.cell.y).toBe(0);
    expect(scout.cell.x).toBe(exitX);
    advance(game, 4.95, () => roll);
    expect(scout.job).toMatchObject({ phase: "away" });
    for (let i = 0; i < 1200 && scout.job?.kind !== "haul"; i++) stepGame(game, 0.05, () => roll);
    expect(game.items).toContainEqual(
      expect.objectContaining({
        kind: "food",
        food: cargo,
        portions: food,
        location: { kind: "carried", unitId: scout.id },
      }),
    );
    expect(scout.job).toMatchObject({ kind: "haul", destination: { x: 7, y: 2 }, phase: "delivery" });
    const events = [];
    for (let i = 0; i < 1000 && game.deliveries === 0; i++) events.push(...stepGame(game, 0.05, () => roll));
    expect(events).toContainEqual({ kind: "scout-delivered", scoutId: scout.id, cargo, food });
    expect(foodStock(game)).toBe(food);
    expect(game.deliveries).toBe(1);
    expect(scout.cell).toEqual({ x: 7, y: 2 });
    expect(game.items.filter((item) => item.kind === "food").map((item) => item.location)).toEqual([
      { kind: "cell", cell: { x: 7, y: 2 } },
    ]);
  },
);
it("keeps an evading hauler's cargo until death and only then leaves it in the cell", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  const item = egg(game, worker.cell);
  game.items = [{ ...item, location: { kind: "carried", unitId: worker.id } }];
  worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase: "delivery" };
  addUnit(game, "warrior", worker.cell, "raiders");
  stepGame(game);
  expect(game.items.map((entry) => entry.location)).toEqual([{ kind: "carried", unitId: worker.id }]);
  expect(worker.job).toMatchObject({ kind: "haul" });
  advance(game, 2);
  expect(worker.hp).toBe(0);
  expect(game.units).not.toContain(worker);
  expect(game.items.map((entry) => entry.location)).toEqual([{ kind: "cell", cell: { x: 8, y: 3 } }]);
});
it("recovers dropped food through the scout auction and credits it once", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  const caterpillar = food(game, scout.cell, "caterpillar");
  const events = advance(game, 3);
  expect(foodStock(game)).toBe(2);
  expect(game.deliveries).toBe(1);
  expect(caterpillar.location).toEqual({ kind: "cell", cell: { x: 7, y: 2 } });
  expect(events.filter((event) => event.kind === "scout-delivered")).toHaveLength(1);
});
it("halts invaders at a soldier and cannot cross occupied cells alive", () => {
  const game = world();
  const soldier = addUnit(game, "warrior", { x: 8, y: 2 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  soldier.job = { kind: "guard", destination: soldier.cell };
  advance(game, 0.7);
  expect(enemy.cell).toEqual(soldier.cell);
  expect(soldier.hp).toBe(24);
  advance(game, 1);
  expect([soldier.hp, enemy.hp]).toEqual([20, 20]);
  advance(game, 1);
  expect([soldier.hp, enemy.hp]).toEqual([16, 16]);
  expect(enemy.cell).toEqual({ x: 8, y: 2 });
});
it("steals a reachable egg, escapes through the entrance, cancels hatching and ends the raid", () => {
  const game = world();
  const item = egg(game, { x: 9, y: 3 });
  game.spawns = [{ eggId: item.id, role: "worker", progress: 0.5 }];
  const thief = addUnit(game, "worker", { x: 9, y: 3 }, "raiders");
  game.narrator.active = "thieves";
  stepGame(game);
  expect(item.location).toEqual({ kind: "carried", unitId: thief.id });
  expect(game.spawns).toEqual([]);
  const events = advance(game, 20);
  expect(game.units).not.toContain(thief);
  expect(game.items.some((entry) => entry.id === item.id)).toBe(false);
  expect(events).toContainEqual({ kind: "incident-ended", incident: "thieves" });
});
it("fights at the queen even while stealing, emits death once and stops egg laying", () => {
  const game = world();
  const queen = queenOf(game);
  if (!queen) throw new Error("queen");
  queen.hp = 1;
  const enemy = addUnit(game, "warrior", queen.cell, "raiders");
  game.narrator.active = "raid";
  const events = advance(game, 1);
  expect(queen.hp).toBe(0);
  expect(queenOf(game)).toBe(queen);
  expect(enemy.hp).toBe(20);
  events.push(...advance(game, 35));
  expect(game.items).toEqual([]);
  expect(events.filter((event) => event.kind === "queen-died")).toHaveLength(1);
  expect(events.filter((event) => event.kind === "incident-ended")).toEqual([
    { kind: "incident-ended", incident: "raid" },
  ]);
});

it("rejects invalid blueprints without changing state and increments visual revision on valid changes", () => {
  const game = world();
  for (const [x, y] of [
    [8, 0],
    [8, 1],
    [8, 5],
    [0, 8],
    [8, 11],
  ]) {
    const before = structuredClone(game);
    expect(planBuild(game, x ?? 0, y ?? 0, "corridor")).toBeTruthy();
    expect(game).toEqual(before);
  }
  expect(game.revision).toBe(0);
  expect(planBuild(game, 8, 6, "corridor")).toBeNull();
  expect(game.revision).toBe(1);
  delete game.blueprints["8,6"];
  addUnit(game, "worker", { x: 8, y: 5 });
  planBuild(game, 8, 6, "corridor");
  advance(game, 20);
  expect(game.revision).toBe(3);
});
it("lets an evading hauler walk through an enemy cell without dropping its item or its job", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  const enemy = addUnit(game, "worker", { x: 8, y: 2 }, "raiders");
  worker.job = { kind: "haul", itemId: 99, destination: { x: 6, y: 4 }, phase: "delivery" };
  worker.route = [
    { x: 8, y: 2 },
    { x: 7, y: 4 },
    { x: 6, y: 4 },
  ];
  worker.travel = 0.95;
  game.items.push({ id: 99, kind: "egg", location: { kind: "carried", unitId: worker.id } });
  enemy.job = { kind: "attack", targetId: worker.id };
  stepGame(game);
  expect(worker.cell).toEqual({ x: 8, y: 2 });
  expect(game.items[0]?.location).toEqual({ kind: "carried", unitId: worker.id });
  expect(worker.route).not.toEqual([]);
  expect(worker.hp).toBe(8);
});
it("emits only the scheduled incident events and gives subsequent waves fresh identifiers", () => {
  const game = createGame(() => 0.5, 7);
  expect(stepGame(game, 0.05, () => 0.5)).toEqual([]);
  game.narrator.pending = { incident: "raid", size: 2, at: 0 };
  expect(stepGame(game, 0.05, () => 0.5)).toEqual([{ kind: "incident-started", incident: "raid", size: 2 }]);
  const firstIds = game.units.map((unit) => unit.id);
  game.narrator.pending = { incident: "thieves", size: 2, at: 0 };
  stepGame(game, 0.05, () => 0.5);
  expect(new Set(game.units.map((unit) => unit.id)).size).toBe(game.units.length);
  expect(Math.min(...game.units.slice(firstIds.length).map((unit) => unit.id))).toBeGreaterThan(Math.max(...firstIds));
});

it.each([1, 17, 73])(
  "preserves world invariants and food accounting across jobs, raids and hatch orders (seed %s)",
  (seed) => {
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const game = createGame(random);
    const initialPositions = game.units.map((unit) => cellKey(unit.cell));
    expect(new Set(initialPositions).size).toBe(6);
    expect(game.units.filter((unit) => unit.faction === "colony")).toHaveLength(6);
    expect(game.items[0]?.kind).toBe("egg");
    game.narrator.nextIncidentAt = 1;
    let balance = 2,
      maxUnitId = Math.max(...game.units.map((unit) => unit.id)),
      maxItemId = 1;
    const unitIds = new Set(game.units.map((unit) => unit.id)),
      itemIds = new Set([1]);
    let lastUnitIds = new Set(unitIds),
      lastItemIds = new Set(itemIds);
    planBuild(game, 8, 6, "corridor");
    planBuild(game, 7, 6, "nest");
    planBuild(game, 9, 6, "storage");
    for (let tick = 0; tick < 1000; tick++) {
      if (tick % 100 === 0 && !startSpawn(game, "worker", random)) balance--;
      for (const event of stepGame(game, 0.05, random)) {
        if (event.kind === "scout-delivered") balance += event.food;
        expect([
          "scout-delivered",
          "food-discarded",
          "incident-warned",
          "incident-started",
          "incident-ended",
          "queen-died",
        ]).toContain(event.kind);
      }
      for (const unit of game.units) {
        if (!lastUnitIds.has(unit.id)) {
          expect(unitIds.has(unit.id)).toBe(false);
          expect(unit.id).toBeGreaterThan(maxUnitId);
          maxUnitId = unit.id;
          unitIds.add(unit.id);
        }
      }
      for (const item of game.items) {
        if (!lastItemIds.has(item.id)) {
          expect(itemIds.has(item.id)).toBe(false);
          expect(item.id).toBeGreaterThan(maxItemId);
          maxItemId = item.id;
          itemIds.add(item.id);
        }
      }
      lastUnitIds = new Set(game.units.map((unit) => unit.id));
      lastItemIds = new Set(game.items.map((item) => item.id));
      if (tick % 20) continue;
      expect(foodStock(game)).toBe(balance);
      expect(foodStock(game)).toBeGreaterThanOrEqual(0);
      expect(queenOf(game)).toBeDefined();
      expect(new Set(game.units.map((unit) => unit.id)).size).toBe(game.units.length);
      expect(new Set(game.items.map((item) => item.id)).size).toBe(game.items.length);
      for (const unit of game.units) {
        expect(Number.isInteger(unit.cell.x) && Number.isInteger(unit.cell.y)).toBe(true);
        expect(unit.travel).toBeGreaterThanOrEqual(0);
        expect(unit.travel).toBeLessThan(1);
        expect(unit.hp).toBeGreaterThanOrEqual(unit.role === "queen" ? 0 : 1);
        let previous = unit.cell;
        for (const cell of unit.route) {
          expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
          expect(cell.y === 0 || !!game.colony[cellKey(cell)]).toBe(true);
          previous = cell;
        }
      }
      const carriers = game.items.flatMap((item) => (item.location.kind === "carried" ? [item.location.unitId] : []));
      expect(new Set(carriers).size).toBe(carriers.length);
      for (const id of carriers) expect(game.units.some((unit) => unit.id === id && unit.hp > 0)).toBe(true);
    }
  },
);

it("resolves head-on movement in stable id order without letting opponents swap cells", () => {
  const game = world();
  const ours = addUnit(game, "warrior", { x: 8, y: 2 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 3 }, "raiders");
  ours.job = { kind: "attack", targetId: enemy.id };
  enemy.job = { kind: "attack", targetId: ours.id };
  ours.route = [{ x: 8, y: 3 }];
  enemy.route = [{ x: 8, y: 2 }];
  ours.travel = enemy.travel = 0.95;
  game.units.reverse();
  stepGame(game);
  expect(ours.cell).toEqual({ x: 8, y: 3 });
  expect(enemy.cell).toEqual(ours.cell);
  expect(ours.travel).toBe(0);
  expect(enemy.travel).toBe(0);
});
it("stops an individually fast fighter at an opponent instead of spending remaining distance past it", () => {
  const game = world();
  const ours = addUnit(game, "warrior", { x: 8, y: 2 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 3 }, "raiders");
  ours.speed = 60;
  ours.job = { kind: "build", target: "8,6", stand: { x: 8, y: 5 } };
  game.blueprints["8,6"] = { tile: "corridor", workers: 0, progress: 0 };
  ours.route = [
    { x: 8, y: 3 },
    { x: 8, y: 4 },
    { x: 8, y: 5 },
  ];
  stepGame(game);
  expect(ours.cell).toEqual({ x: 8, y: 3 });
  expect(enemy.cell).toEqual(ours.cell);
  expect(ours.route).toEqual([]);
  expect(game.blueprints["8,6"]?.progress).toBe(0);
});
it("removes departed occupancy so a following opponent can traverse the vacated cell", () => {
  const game = world();
  const ours = addUnit(game, "worker", { x: 8, y: 2 });
  const enemy = addUnit(game, "worker", { x: 8, y: 3 }, "raiders");
  ours.job = { kind: "guard", destination: { x: 8, y: 1 } };
  ours.route = [{ x: 8, y: 1 }];
  ours.travel = 0.95;
  enemy.speed = 30;
  enemy.job = { kind: "haul", itemId: 99, destination: { x: -1, y: 0 }, phase: "delivery" };
  enemy.route = [
    { x: 8, y: 2 },
    { x: 8, y: 1 },
    { x: 8, y: 0 },
  ];
  game.items.push({ id: 99, kind: "egg", location: { kind: "carried", unitId: enemy.id } });
  stepGame(game);
  expect(enemy.cell).toEqual({ x: 8, y: 2 });
  expect(enemy.travel).toBeCloseTo(0.5, 8);
  expect(ours.cell).toEqual({ x: 8, y: 1 });
});
it("cleans up an already dead carrier without losing its item or reviving the queen", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  worker.hp = 0;
  game.items.push({ id: 99, kind: "egg", location: { kind: "carried", unitId: worker.id } });
  stepGame(game);
  expect(game.units).not.toContain(worker);
  expect(game.items[0]?.location).toEqual({ kind: "cell", cell: { x: 8, y: 3 } });
});

it("allocates distinct increasing item ids when egg laying and two expeditions finish in the same step", () => {
  const game = world();
  game.eggTimer = 29.95;
  for (const x of [-1, 18]) {
    const scout = addUnit(game, "scout", { x, y: 0 });
    scout.job = { kind: "forage", phase: "away", remaining: 0, exit: scout.cell };
  }
  stepGame(game, 0.05, () => 0.5);
  expect(game.items.map((item) => item.id)).toEqual([4, 5, 6]);
  expect(game.nextItemId).toBe(7);
  expect(foodStock(game)).toBe(0);
});

it("skips a dead builder and safely advances a world without a queen", () => {
  const game = world();
  game.units = [];
  const worker = addUnit(game, "worker", { x: 8, y: 5 });
  worker.hp = 0;
  planBuild(game, 8, 6, "corridor");
  worker.job = { kind: "build", target: "8,6", stand: worker.cell };
  expect(stepGame(game)).toEqual([]);
  expect(game.blueprints["8,6"]?.progress).toBe(0);
  expect(game.units).toEqual([]);
  expect(game.items).toEqual([]);
});

it("leaves a unit already in contact out of the auction", () => {
  const game = world();
  const item = egg(game, { x: 9, y: 3 });
  const engaged = addUnit(game, "warrior", { x: 8, y: 3 }, "raiders");
  const free = addUnit(game, "worker", { x: 8, y: 5 }, "raiders");
  addUnit(game, "warrior", engaged.cell);
  stepGame(game);
  expect(free.job).toMatchObject({ kind: "haul", itemId: item.id });
});

it("lets thieves slip past a single soldier and reach the brood", () => {
  const game = world();
  const item = egg(game, { x: 9, y: 3 });
  addUnit(game, "warrior", { x: 8, y: 2 }).job = { kind: "guard", destination: { x: 8, y: 2 } };
  const thieves = [
    addUnit(game, "worker", { x: 8, y: 1 }, "raiders"),
    addUnit(game, "worker", { x: 8, y: 1 }, "raiders"),
  ];
  advance(game, 7);
  expect(item.location).toEqual({ kind: "carried", unitId: thieves[0]?.id });
  expect(thieves[0]?.cell).toEqual({ x: 8, y: 1 });
  expect(thieves[0]?.hp).toBe(6);
});
it("walks a wounded raider off the map and a wounded ant back home", () => {
  const game = world();
  const raider = addUnit(game, "scout", { x: 8, y: 2 }, "raiders");
  raider.hp = 3;
  const ant = addUnit(game, "worker", { x: 8, y: 5 });
  ant.hp = 3;
  stepGame(game);
  expect(raider.job).toMatchObject({ kind: "flee" });
  expect(ant.job).toMatchObject({ kind: "flee", destination: { x: 10, y: 3 } });
  advance(game, 6);
  expect(game.units).not.toContain(raider);
  expect(ant.cell).toEqual({ x: 10, y: 3 });
  expect(ant.job).toMatchObject({ kind: "flee" });
  advance(game, 10);
  expect(ant.hp).toBe(8);
  expect(ant.fleeing).toBe(false);
});

it("walks the predator off the map once its term is over and closes the incident there", () => {
  const game = world();
  const spider = addUnit(game, "spider", { x: 3, y: 0 }, "raiders");
  game.narrator.active = "predator";
  game.narrator.effect = { kind: "predator", until: game.elapsedSeconds + 1 };
  advance(game, 0.5);
  expect(spider.job).toEqual({ kind: "guard", destination: SURFACE_POST });
  const events = advance(game, 30);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual([]);
  expect(events.at(-1)).toEqual({ kind: "incident-ended", incident: "predator" });
  expect(game.narrator.active).toBeNull();
});
it("lets a raid wave pass the posted predator and enter the nest", () => {
  const game = world();
  const spider = addUnit(game, "spider", { x: 8, y: 0 }, "raiders");
  game.narrator.effect = { kind: "predator", until: 1000 };
  const raider = addUnit(game, "warrior", { x: 14, y: 0 }, "raiders");
  advance(game, 5);
  // The raider crossed the post at (8,0) on its way down: an ally never blocks the front.
  expect(raider.cell.y).toBeGreaterThan(0);
  expect(raider.job).toMatchObject({ kind: "attack" });
  expect(spider.cell).toEqual(SURFACE_POST);
  expect(spider.hp).toBe(spider.maxHp);
});
