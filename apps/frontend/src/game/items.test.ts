import { expect, it } from "vitest";
import { carriedItem, dropCargo, pickUp } from "./items";
import { addUnit, egg, food, world } from "./test-support";

it("enforces role, physical pickup, one item per carrier and one carrier per item", () => {
  const game = world();
  const worker = addUnit(game),
    other = addUnit(game),
    scout = addUnit(game, "scout");
  const item = egg(game, { x: 9, y: 3 });
  expect(pickUp(game, worker, item)).toBe(false);
  worker.cell = { x: 9, y: 3 };
  scout.cell = worker.cell;
  expect(pickUp(game, scout, item)).toBe(false);
  expect(pickUp(game, worker, item)).toBe(true);
  other.cell = worker.cell;
  expect(pickUp(game, other, item)).toBe(false);
  const another = egg(game, worker.cell);
  expect(pickUp(game, worker, another)).toBe(false);
  worker.cell = { x: 8, y: 3 };
  dropCargo(game, worker);
  expect(item.location).toEqual({ kind: "cell", cell: { x: 8, y: 3 } });
  expect(carriedItem(game, worker)).toBeUndefined();
  expect(pickUp(game, worker, another)).toBe(false);
});
it("protects reservations and cancels hatching only when a raider physically picks up the egg", () => {
  const game = world();
  const worker = addUnit(game),
    thief = addUnit(game, "worker", worker.cell, "raiders");
  const item = egg(game, worker.cell);
  worker.job = { kind: "haul", itemId: item.id, destination: { x: 6, y: 4 }, phase: "pickup" };
  expect(pickUp(game, thief, item)).toBe(false);
  worker.job = null;
  game.spawns = [{ eggId: item.id, role: "worker", progress: 0.5 }];
  expect(pickUp(game, worker, item)).toBe(false);
  expect(game.spawns).toHaveLength(1);
  expect(pickUp(game, thief, item)).toBe(true);
  expect(game.spawns).toEqual([]);
});

it("keeps other hatches and carriers intact when a scout picks up food or a thief takes one egg", () => {
  const game = world();
  const worker = addUnit(game),
    scout = addUnit(game, "scout");
  const item = egg(game, worker.cell),
    retained = egg(game, { x: 6, y: 4 });
  game.spawns = [
    { eggId: item.id, role: "worker", progress: 0 },
    { eggId: retained.id, role: "scout", progress: 0.2 },
  ];
  const apple = food(game, scout.cell);
  expect(pickUp(game, worker, apple)).toBe(false);
  expect(pickUp(game, scout, apple)).toBe(true);
  expect(carriedItem(game, worker)).toBeUndefined();
  const thief = addUnit(game, "worker", worker.cell, "raiders");
  expect(pickUp(game, thief, item)).toBe(true);
  expect(carriedItem(game, thief)?.id).toBe(item.id);
  expect(game.spawns).toEqual([{ eggId: retained.id, role: "scout", progress: 0.2 }]);
});
