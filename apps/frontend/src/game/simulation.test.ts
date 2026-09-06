import { expect, it } from "vitest";
import { cancelLastBlueprint, planBuild } from "./construction";
import { queenOf } from "./model";
import { createGame, stepGame } from "./simulation";
import { startSpawn } from "./spawning";
import { addUnit, advance, egg, world } from "./test-support";

it("creates independent games with unique unit ids and valid initial positions", () => {
  const first = createGame(() => 0),
    second = createGame(() => 0.5);
  expect(new Set(first.units.map((unit) => unit.id)).size).toBe(6);
  expect(new Set(first.units.map((unit) => `${unit.cell.x},${unit.cell.y}`)).size).toBe(6);
  expect(first.items[0]?.location).toEqual({ kind: "cell", cell: { x: 9, y: 3 } });
  expect(first.units.slice(1).map((unit) => unit.cell)).not.toEqual(second.units.slice(1).map((unit) => unit.cell));
  expect(second.items[0]?.location).toEqual({ kind: "cell", cell: { x: 11, y: 3 } });
  const firstQueen = queenOf(first);
  if (!firstQueen) throw new Error("queen");
  firstQueen.hp = 0;
  expect(queenOf(second)?.hp).toBe(10);
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
  advance(game, 0.65);
  expect(game.blueprints["8,6"]?.progress).toBe(0);
  advance(game, 0.1);
  expect(game.blueprints["8,6"]?.progress).toBeCloseTo(0.0025, 8);
  cancelLastBlueprint(game);
  advance(game, 1);
  expect(worker.job?.kind).toBe("wander");
  expect(game.colony["8,6"]).toBeUndefined();
});
it("waits for workers and completes a room after thirty working seconds", () => {
  const game = world();
  planBuild(game, 7, 5, "room");
  advance(game, 10);
  expect(game.blueprints["7,5"]?.progress).toBe(0);
  const worker = addUnit(game, "worker", { x: 8, y: 5 });
  advance(game, 29.95);
  expect(worker.heading).toBeCloseTo(Math.PI, 8);
  expect(game.colony["7,5"]).toBeUndefined();
  advance(game, 0.05);
  expect(game.colony["7,5"]).toBe("room");
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
    for (let i = 0; i < 1200 && !(scout.job?.kind === "forage" && scout.job.phase === "returning"); i++)
      stepGame(game, 0.05, () => roll);
    expect(game.items).toContainEqual(
      expect.objectContaining({ kind: "food", food: cargo, location: { kind: "carried", unitId: scout.id } }),
    );
    const events = [];
    for (let i = 0; i < 1000 && game.deliveries === 0; i++) events.push(...stepGame(game, 0.05, () => roll));
    expect(events).toContainEqual({ kind: "scout-delivered", scoutId: scout.id, cargo, food });
    expect(game.food).toBe(2 + food);
    expect(game.deliveries).toBe(1);
    expect(scout.cell).toEqual({ x: 10, y: 3 });
  },
);
it("drops food and eggs immediately on combat contact, before damage, and releases reservations", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  const item = egg(game, worker.cell);
  game.items = [
    { ...item, location: { kind: "carried", unitId: worker.id } },
    { id: game.nextItemId++, kind: "food", food: "apple", location: { kind: "carried", unitId: scout.id } },
  ];
  worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 2 }, phase: "delivery" };
  scout.job = { kind: "forage", phase: "returning", exit: { x: -1, y: 0 }, remaining: 0 };
  addUnit(game, "warrior", worker.cell, "raiders");
  stepGame(game);
  expect(game.items.map((item) => item.location)).toEqual([
    { kind: "cell", cell: { x: 8, y: 3 } },
    { kind: "cell", cell: { x: 8, y: 3 } },
  ]);
  expect([worker.job, scout.job]).toEqual([null, null]);
  expect([worker.hp, scout.hp, game.food]).toEqual([1, 2, 2]);
  advance(game, 0.45);
  expect(game.units).not.toContain(worker);
});
it("recovers dropped food through the scout auction and credits it once", () => {
  const game = world();
  addUnit(game, "scout", { x: 8, y: 3 });
  game.items.push({
    id: game.nextItemId++,
    kind: "food",
    food: "caterpillar",
    location: { kind: "cell", cell: { x: 8, y: 3 } },
  });
  const events = advance(game, 3);
  expect(game.food).toBe(4);
  expect(game.deliveries).toBe(1);
  expect(events.filter((event) => event.kind === "scout-delivered")).toHaveLength(1);
});
it("halts invaders at defenders and cannot cross occupied cells alive", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 2 });
  const enemy = addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  worker.job = { kind: "guard", destination: worker.cell };
  advance(game, 0.7);
  expect(enemy.cell).toEqual(worker.cell);
  expect(worker.hp).toBe(1);
  advance(game, 0.45);
  expect(worker.hp).toBe(0);
  expect(enemy.hp).toBe(2);
  expect(enemy.cell).toEqual({ x: 8, y: 2 });
});
it("steals a reachable egg, escapes through the entrance, cancels hatching and ends the raid", () => {
  const game = world();
  const item = egg(game, { x: 9, y: 3 });
  game.spawns = [{ eggId: item.id, role: "worker", progress: 0.5 }];
  const thief = addUnit(game, "worker", { x: 9, y: 3 }, "raiders");
  stepGame(game);
  expect(item.location).toEqual({ kind: "carried", unitId: thief.id });
  expect(game.spawns).toEqual([]);
  const events = advance(game, 12);
  expect(game.units).not.toContain(thief);
  expect(game.items.some((entry) => entry.id === item.id)).toBe(false);
  expect(events).toContainEqual({ kind: "attack-ended" });
});
it("fights at the queen even while stealing, emits death once and stops egg laying", () => {
  const game = world();
  const queen = queenOf(game);
  if (!queen) throw new Error("queen");
  queen.hp = 1;
  const enemy = addUnit(game, "warrior", queen.cell, "raiders");
  const events = advance(game, 1);
  expect(queen.hp).toBe(0);
  expect(queenOf(game)).toBe(queen);
  expect(enemy.hp).toBe(2);
  events.push(...advance(game, 35));
  expect(game.items).toEqual([]);
  expect(events.filter((event) => event.kind === "queen-died")).toHaveLength(1);
  expect(events.filter((event) => event.kind === "attack-ended")).toHaveLength(1);
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
  cancelLastBlueprint(game);
  expect(game.revision).toBe(0);
  expect(planBuild(game, 8, 6, "corridor")).toBeNull();
  expect(game.revision).toBe(1);
  cancelLastBlueprint(game);
  expect(game.revision).toBe(2);
  addUnit(game, "worker", { x: 8, y: 5 });
  planBuild(game, 8, 6, "corridor");
  advance(game, 20);
  expect(game.revision).toBe(4);
});
it("stops on contact reached during movement, preserves a carried item there and does not credit travel as work", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 8, y: 3 });
  const enemy = addUnit(game, "worker", { x: 8, y: 2 }, "raiders");
  worker.job = { kind: "haul", itemId: 99, destination: { x: 6, y: 2 }, phase: "delivery" };
  worker.route = [
    { x: 8, y: 2 },
    { x: 7, y: 2 },
    { x: 6, y: 2 },
  ];
  worker.travel = 0.95;
  game.items.push({ id: 99, kind: "egg", location: { kind: "carried", unitId: worker.id } });
  enemy.job = { kind: "attack", targetId: worker.id };
  stepGame(game);
  expect(worker.cell).toEqual({ x: 8, y: 2 });
  expect(enemy.cell).toEqual(worker.cell);
  expect(game.items[0]?.location).toEqual({ kind: "cell", cell: { x: 8, y: 2 } });
  expect(worker.route).toEqual([]);
  expect(worker.hp).toBe(1);
});
it("emits only the scheduled raid event and gives subsequent waves fresh identifiers", () => {
  const game = createGame(() => 0.5);
  expect(stepGame(game, 0.05, () => 0.5)).toEqual([]);
  game.attackTimer = 0;
  expect(stepGame(game, 0.05, () => 0.5)).toEqual([{ kind: "attack-started", count: 2 }]);
  const firstIds = game.units.map((unit) => unit.id);
  game.attackTimer = 0;
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
    const initialPositions = game.units.map((unit) => `${unit.cell.x},${unit.cell.y}`);
    expect(new Set(initialPositions).size).toBe(6);
    expect(game.units.filter((unit) => unit.faction === "colony")).toHaveLength(6);
    expect(game.items[0]?.kind).toBe("egg");
    game.attackTimer = 5;
    let balance = 2,
      maxUnitId = Math.max(...game.units.map((unit) => unit.id)),
      maxItemId = 1;
    const unitIds = new Set(game.units.map((unit) => unit.id)),
      itemIds = new Set([1]);
    let lastUnitIds = new Set(unitIds),
      lastItemIds = new Set(itemIds);
    planBuild(game, 8, 6, "corridor");
    planBuild(game, 7, 6, "room");
    for (let tick = 0; tick < 1000; tick++) {
      if (tick % 100 === 0 && startSpawn(game, "worker", random)) balance--;
      for (const event of stepGame(game, 0.05, random)) {
        if (event.kind === "scout-delivered") balance += event.food;
        expect(["scout-delivered", "attack-started", "attack-ended", "queen-died"]).toContain(event.kind);
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
      expect(game.food).toBe(balance);
      expect(game.food).toBeGreaterThanOrEqual(0);
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
          expect(cell.y === 0 || !!game.colony[`${cell.x},${cell.y}`]).toBe(true);
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
it("stops an individually fast unit at an opponent instead of spending remaining distance past it", () => {
  const game = world();
  const ours = addUnit(game, "worker", { x: 8, y: 2 });
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
  expect(game.items.map((item) => item.id)).toEqual([2, 3, 4]);
  expect(game.nextItemId).toBe(5);
  expect(game.food).toBe(2);
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
