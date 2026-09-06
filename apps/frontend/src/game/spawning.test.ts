import { expect, it } from "vitest";
import { spawnableEggs, startSpawn } from "./spawning";
import { addUnit, advance, egg, world } from "./test-support";

it("requires food and an unreserved egg in a room, charges once and reserves the selected egg", () => {
  const game = world();
  expect(startSpawn(game, "worker")).toBe(false);
  const first = egg(game, { x: 6, y: 2 }),
    second = egg(game, { x: 7, y: 2 });
  egg(game, { x: 8, y: 2 });
  game.food = 1;
  expect(startSpawn(game, "scout")).toBe(false);
  expect(game.food).toBe(1);
  game.food = 2;
  expect(startSpawn(game, "scout", () => 0.999)).toBe(true);
  expect(game.food).toBe(0);
  expect(game.spawns).toEqual([{ eggId: second.id, role: "scout", progress: 0 }]);
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([first.id]);
  const worker = addUnit(game);
  worker.job = { kind: "haul", itemId: first.id, destination: { x: 11, y: 3 }, phase: "pickup" };
  expect(spawnableEggs(game)).toEqual([]);
});
it("hatches exactly once after ten seconds and consumes the reserved egg at its actual cell", () => {
  const game = world();
  egg(game, { x: 6, y: 2 });
  game.food = 3;
  expect(startSpawn(game, "warrior")).toBe(true);
  advance(game, 9.95);
  expect(game.units).toHaveLength(1);
  expect(game.spawns[0]?.progress).toBeCloseTo(0.995, 8);
  advance(game, 0.05);
  expect(game.items).toEqual([]);
  expect(game.spawns).toEqual([]);
  expect(game.units[1]).toMatchObject({
    role: "warrior",
    faction: "colony",
    cell: { x: 6, y: 2 },
    hp: 3,
    speed: 1.5,
    bite: 1,
  });
});

it("hatches separate orders from their own eggs, retains other items and allocates unique ids", () => {
  const game = world();
  egg(game, { x: 6, y: 2 });
  const second = egg(game, { x: 7, y: 2 });
  const food = {
    id: 100,
    kind: "food" as const,
    food: "apple" as const,
    location: { kind: "cell" as const, cell: { x: 11, y: 3 } },
  };
  game.items.push(food);
  game.food = 3;
  expect(startSpawn(game, "worker", () => 0)).toBe(true);
  advance(game, 0.05);
  expect(startSpawn(game, "scout", () => 0)).toBe(true);
  advance(game, 9.95);
  expect(game.items).toContainEqual(second);
  expect(game.units.filter((unit) => unit.role === "worker")).toHaveLength(1);
  advance(game, 0.05);
  expect(game.units.map((unit) => unit.id)).toEqual([0, 6, 7]);
  expect(game.units[2]?.cell).toEqual({ x: 7, y: 2 });
  expect(game.items).toContainEqual(food);
});

it("never hatches food or a carried egg and uses the randomly reserved egg even if it is not first", () => {
  const game = world();
  const worker = addUnit(game);
  game.items = [
    { id: 100, kind: "food", food: "apple", location: { kind: "cell", cell: { x: 6, y: 2 } } },
    { id: 101, kind: "egg", location: { kind: "carried", unitId: worker.id } },
  ];
  expect(startSpawn(game, "worker")).toBe(false);
  expect(game.food).toBe(2);
  game.units = game.units.filter((unit) => unit.role === "queen");
  game.items = [];
  const first = egg(game, { x: 6, y: 2 });
  egg(game, { x: 7, y: 2 });
  expect(startSpawn(game, "scout", () => 0.999)).toBe(true);
  advance(game, 10);
  expect(game.items).toEqual([first]);
  expect(game.units[1]?.cell).toEqual({ x: 7, y: 2 });
});

it("cancels an orphaned hatch order rather than keeping a permanently stuck reservation", () => {
  const game = world();
  game.spawns = [{ eggId: 999, role: "scout", progress: 0.2 }];
  advance(game, 0.05);
  expect(game.spawns).toEqual([]);
  expect(game.units).toHaveLength(1);
});

it("does not let one transport reserve unrelated eggs, and ignores dead holders", () => {
  const game = world();
  const worker = addUnit(game);
  const first = egg(game, { x: 9, y: 3 }),
    second = egg(game, { x: 11, y: 3 });
  worker.job = { kind: "haul", itemId: first.id, destination: { x: 6, y: 2 }, phase: "pickup" };
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([second.id]);
  worker.hp = 0;
  expect(spawnableEggs(game).map((item) => item.id)).toEqual([first.id, second.id]);
});
