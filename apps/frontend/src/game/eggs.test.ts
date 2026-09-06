import { expect, it } from "vitest";
import { advanceEggs, nurseryCells, storageCells } from "./eggs";
import { queenOf } from "./model";
import { Navigation } from "./navigation";
import { addUnit, advance, egg, world } from "./test-support";

it("lays every thirty seconds, pauses with both nursery cells occupied and preserves elapsed time", () => {
  const game = world();
  advance(game, 12);
  const first = egg(game, { x: 9, y: 3 });
  egg(game, { x: 11, y: 3 });
  advance(game, 60);
  expect(game.eggTimer).toBeCloseTo(12, 8);
  expect(game.items).toHaveLength(2);
  first.location.cell = { x: 6, y: 2 };
  advance(game, 17.95);
  expect(game.items).toHaveLength(2);
  advance(game, 0.05);
  expect(game.items).toHaveLength(3);
  expect(game.items[2]?.location).toEqual({ kind: "cell", cell: { x: 9, y: 3 } });
  expect(game.eggTimer).toBeCloseTo(0, 8);
});
it("requires a living queen and completed nursery rooms, including delivery reservations", () => {
  const game = world();
  const worker = addUnit(game);
  worker.job = { kind: "haul", itemId: 99, destination: { x: 9, y: 3 }, phase: "delivery" };
  delete game.colony["11,3"];
  game.blueprints["11,3"] = { tile: "room", workers: 0, progress: 0 };
  advanceEggs(game, 30);
  expect(game.items).toEqual([]);
  expect(game.eggTimer).toBe(0);
  worker.job = null;
  const queen = queenOf(game);
  if (!queen) throw new Error("queen");
  queen.hp = 0;
  advanceEggs(game, 30);
  expect(game.items).toEqual([]);
});
it("carries clutches visibly to remote storage, fills rooms and recovers a dropped corridor egg", () => {
  const game = world();
  addUnit(game);
  const item = egg(game, { x: 9, y: 3 });
  for (let i = 0; i < 100 && item.location.kind === "cell"; i++) advance(game, 0.05);
  expect(item.location).toHaveProperty("unitId");
  advance(game, 5);
  expect(item.location).toEqual({ kind: "cell", cell: { x: 6, y: 2 } });
  const dropped = egg(game, { x: 8, y: 4 });
  advance(game, 10);
  expect(dropped.location).toEqual({ kind: "cell", cell: { x: 7, y: 2 } });
  advance(game, 100);
  expect(game.items.filter((item) => item.kind === "egg")).toHaveLength(4);
});

it("keeps eggs beside the queen when no remote storage exists and ignores vertical rooms for laying", () => {
  const game = world();
  delete game.colony["6,2"];
  delete game.colony["7,2"];
  const worker = addUnit(game);
  const item = egg(game, { x: 9, y: 3 });
  advance(game, 5);
  expect(item.location).toEqual({ kind: "cell", cell: { x: 9, y: 3 } });
  expect(worker.job?.kind).not.toBe("haul");
  egg(game, { x: 11, y: 3 });
  game.colony["9,4"] = "corridor";
  game.colony["10,4"] = "room";
  advanceEggs(game, 30);
  expect(game.items).toHaveLength(2);
  expect(game.eggTimer).toBeCloseTo(5, 8);
});

it("finds only the colony queen and safely handles her absence", () => {
  const game = world();
  const enemyQueen = addUnit(game, "queen", { x: 6, y: 2 }, "raiders");
  game.units.reverse();
  expect(queenOf(game)?.id).toBe(0);
  game.units = [enemyQueen];
  advanceEggs(game, 30);
  expect(game.items).toEqual([]);
  expect(queenOf(game)).toBeUndefined();
  expect(nurseryCells(game)).toEqual([]);
  expect(storageCells(game, new Navigation(game.colony))).toEqual([]);
});

it("preserves excess laying time and excludes disconnected rooms from storage", () => {
  const game = world();
  game.eggTimer = 29.99;
  advanceEggs(game, 0.03);
  expect(game.items).toHaveLength(1);
  expect(game.eggTimer).toBeCloseTo(0.02, 8);
  game.colony["0,9"] = "room";
  expect(storageCells(game, new Navigation(game.colony)).map(({ cell }) => cell)).toEqual([
    { x: 6, y: 2 },
    { x: 7, y: 2 },
  ]);
});
