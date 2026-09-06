import { expect, it } from "vitest";
import { hasNestRoom, nestCapacity, nestFree, nestPopulation } from "./housing";
import { startSpawn } from "./spawning";
import { addUnit, egg, food, world } from "./test-support";

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
  expect(hasNestRoom(game)).toBe(true);
  expect(startSpawn(game, "worker", () => 0)).toBe(true);
  expect(nestPopulation(game)).toBe(5);
  expect(hasNestRoom(game)).toBe(false);
  expect(startSpawn(game, "worker", () => 0)).toBe(false);
  expect(game.spawns).toHaveLength(1);
  expect(game.items.filter((item) => item.kind === "food")).toHaveLength(2);
});
