import { expect, it } from "vitest";
import { nestCapacity, nestFree, nestPopulation, spawnableEggs, spawnBlock, startSpawn } from "./spawning";
import { foodStock } from "./storage";
import { addUnit, advance, egg, food, world } from "./test-support";

it("requires stored food and an unreserved egg in a nest, charges once and reserves the selected egg", () => {
  const game = world();
  expect(spawnBlock(game, "worker")).toBe("egg");
  expect(startSpawn(game, "worker")).toBe("egg");
  const first = egg(game, { x: 6, y: 4 }),
    second = egg(game, { x: 7, y: 4 });
  egg(game, { x: 8, y: 2 });
  food(game, { x: 6, y: 2 });
  expect(startSpawn(game, "scout")).toBe("food");
  expect(foodStock(game)).toBe(1);
  food(game, { x: 6, y: 2 });
  expect(startSpawn(game, "scout", () => 0.999)).toBeNull();
  expect(foodStock(game)).toBe(0);
  expect(game.items.filter((item) => item.kind === "food")).toEqual([]);
  expect(game.spawns).toEqual([{ eggId: second.id, role: "scout", progress: 0 }]);
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([first.id]);
  const worker = addUnit(game);
  worker.job = { kind: "haul", itemId: first.id, destination: { x: 11, y: 3 }, phase: "pickup" };
  expect(spawnableEggs(game)).toEqual([]);
});
it("keeps food when no egg is available and ignores food lying outside a storage", () => {
  const game = world();
  food(game, { x: 7, y: 2 }, "caterpillar");
  food(game, { x: 9, y: 3 });
  expect(foodStock(game)).toBe(2);
  expect(startSpawn(game, "worker")).toBe("egg");
  expect(foodStock(game)).toBe(2);
  egg(game, { x: 6, y: 4 });
  expect(startSpawn(game, "warrior")).toBe("food");
  expect(game.items).toHaveLength(3);
});
it("eats portions across stored items, leaving a half-eaten caterpillar behind", () => {
  const game = world();
  egg(game, { x: 6, y: 4 });
  egg(game, { x: 7, y: 4 });
  const apple = food(game, { x: 6, y: 2 });
  const caterpillar = food(game, { x: 7, y: 2 }, "caterpillar");
  expect(startSpawn(game, "scout", () => 0)).toBeNull();
  expect(game.items).not.toContain(apple);
  expect(caterpillar.portions).toBe(1);
  expect(foodStock(game)).toBe(1);
  expect(startSpawn(game, "worker", () => 0)).toBeNull();
  expect(game.items.filter((item) => item.kind === "food")).toEqual([]);
  expect(game.spawns).toHaveLength(2);
});
it("hatches exactly once after ten seconds and consumes the reserved egg at its actual cell", () => {
  const game = world();
  egg(game, { x: 6, y: 4 });
  for (let i = 0; i < 3; i++) food(game, { x: 6, y: 2 });
  expect(startSpawn(game, "warrior")).toBeNull();
  advance(game, 9.95);
  expect(game.units).toHaveLength(1);
  expect(game.spawns[0]?.progress).toBeCloseTo(0.995, 8);
  advance(game, 0.05);
  expect(game.items).toEqual([]);
  expect(game.spawns).toEqual([]);
  expect(game.units[1]).toMatchObject({
    role: "warrior",
    faction: "colony",
    cell: { x: 6, y: 4 },
    hp: 24,
    speed: 2,
    bite: 4,
  });
});

it("hatches separate orders from their own eggs, retains other items and allocates unique ids", () => {
  const game = world();
  egg(game, { x: 6, y: 4 });
  const second = egg(game, { x: 7, y: 4 });
  const loose = food(game, { x: 11, y: 3 });
  for (let i = 0; i < 3; i++) food(game, { x: 7, y: 2 });
  expect(startSpawn(game, "worker", () => 0)).toBeNull();
  advance(game, 0.05);
  expect(startSpawn(game, "scout", () => 0)).toBeNull();
  advance(game, 9.95);
  expect(game.items).toContainEqual(second);
  expect(game.units.filter((unit) => unit.role === "worker")).toHaveLength(1);
  advance(game, 0.05);
  expect(game.units.map((unit) => unit.id)).toEqual([0, 6, 7]);
  expect(game.units[2]?.cell).toEqual({ x: 7, y: 4 });
  expect(game.items).toContainEqual(loose);
});

it("never hatches food or a carried egg and uses the randomly reserved egg even if it is not first", () => {
  const game = world();
  const worker = addUnit(game);
  food(game, { x: 6, y: 4 });
  game.items.push({ id: 101, kind: "egg", location: { kind: "carried", unitId: worker.id } });
  food(game, { x: 6, y: 2 });
  food(game, { x: 6, y: 2 });
  expect(startSpawn(game, "worker")).toBe("egg");
  expect(foodStock(game)).toBe(2);
  game.units = game.units.filter((unit) => unit.role === "queen");
  game.items = game.items.filter((item) => item.kind === "food");
  const first = egg(game, { x: 6, y: 4 });
  egg(game, { x: 7, y: 4 });
  expect(startSpawn(game, "scout", () => 0.999)).toBeNull();
  advance(game, 10);
  expect(game.items.filter((item) => item.kind === "egg")).toEqual([first]);
  expect(game.units[1]?.cell).toEqual({ x: 7, y: 4 });
});

it("cancels an orphaned hatch order rather than keeping a permanently stuck reservation", () => {
  const game = world();
  game.spawns = [{ eggId: 999, role: "scout", progress: 0.2 }];
  advance(game, 0.05);
  expect(game.spawns).toEqual([]);
  expect(game.units).toHaveLength(1);
});

it("drops the order of an egg a raider carried off and keeps the other order running", () => {
  const game = world();
  const stolen = egg(game, { x: 6, y: 4 }),
    retained = egg(game, { x: 7, y: 4 });
  game.spawns = [
    { eggId: stolen.id, role: "worker", progress: 0 },
    { eggId: retained.id, role: "scout", progress: 0.2 },
  ];
  const thief = addUnit(game, "worker", { x: 6, y: 4 }, "raiders");
  advance(game, 0.05);
  expect(stolen.location).toEqual({ kind: "carried", unitId: thief.id });
  expect(game.spawns.map((spawn) => spawn.eggId)).toEqual([retained.id]);
});

it("does not let one transport reserve unrelated eggs, and ignores dead holders", () => {
  const game = world();
  const worker = addUnit(game);
  const first = egg(game, { x: 9, y: 3 }),
    second = egg(game, { x: 11, y: 3 });
  worker.job = { kind: "haul", itemId: first.id, destination: { x: 6, y: 4 }, phase: "pickup" };
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([second.id]);
  worker.hp = 0;
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([first.id, second.id]);
});
it("counts nest cells as beds and every colony ant except the queen as an occupant", () => {
  const game = world();
  expect(nestCapacity(game)).toBe(5);
  expect(nestPopulation(game)).toBe(0);
  addUnit(game, "worker");
  addUnit(game, "scout");
  addUnit(game, "warrior", { x: 9, y: 3 }, "raiders");
  const dead = addUnit(game, "worker");
  dead.hp = 0;
  expect(nestPopulation(game)).toBe(2);
  expect(nestFree(game)).toBe(3);
  game.colony["7,4"] = "storage";
  expect(nestFree(game)).toBe(2);
});
it("reserves a bed for a pending hatch order and blocks spawning without a free bed", () => {
  const game = world();
  for (let i = 0; i < 4; i++) addUnit(game);
  egg(game, { x: 6, y: 4 });
  egg(game, { x: 7, y: 4 });
  for (let i = 0; i < 3; i++) food(game, { x: 6, y: 2 });
  expect(nestFree(game)).toBe(1);
  expect(startSpawn(game, "worker", () => 0)).toBeNull();
  expect(nestPopulation(game)).toBe(5);
  expect(nestFree(game)).toBe(0);
  expect(startSpawn(game, "worker", () => 0)).toBe("nest");
  expect(game.spawns).toHaveLength(1);
  expect(game.items.filter((item) => item.kind === "food")).toHaveLength(2);
});
