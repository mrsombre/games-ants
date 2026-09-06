import { expect, it } from "vitest";
import { spawnWave } from "./raids";
import { world } from "./test-support";

it.each([
  [0, -1],
  [0.5, 18],
])("spawns the requested composition at the edge chosen by the roll (%s)", (roll, x) => {
  const game = world();
  const wave = spawnWave(game, ["worker", "warrior", "scout"], roll);
  expect(wave.map((unit) => unit.role)).toEqual(["worker", "warrior", "scout"]);
  expect(wave.every((unit) => unit.faction === "raiders" && unit.cell.y === 0 && unit.cell.x === x)).toBe(true);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual(wave);
  expect(new Set(wave.map((unit) => unit.id)).size).toBe(3);
  expect(game.nextUnitId).toBeGreaterThan(Math.max(...wave.map((unit) => unit.id)));
});
it("spawns nothing for an empty composition", () => {
  const game = world();
  const before = game.nextUnitId;
  expect(spawnWave(game, [], 0.5)).toEqual([]);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual([]);
  expect(game.nextUnitId).toBe(before);
});
