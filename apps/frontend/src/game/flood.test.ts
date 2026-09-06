import { expect, it } from "vitest";
import { cellKey } from "./cells";
import { demolitionError } from "./demolition";
import { eggStorageCells, queenCells } from "./eggs";
import { FLOOD_SECONDS, floodedCells, floodTargets, isFlooded, recedeFlood, startFlood } from "./flood";
import { pickUp } from "./items";
import type { GameEvent } from "./model";
import { settleIncidents } from "./narrator";
import { Navigation } from "./navigation";
import { nestFree, spawnableEggs } from "./spawning";
import { foodStock, foodStorageCells, storageCapacity } from "./storage";
import { assignTasks, jobValid } from "./tasks";
import { addUnit, egg, food, world } from "./test-support";

// A cellar under the queen: the corridor reaches row 7, where a three-cell storage waits.
function cellar(game: ReturnType<typeof world>, tile: "storage" | "nest" = "storage") {
  Object.assign(game.colony, { "8,6": "corridor", "8,7": "corridor", "5,7": tile, "6,7": tile, "7,7": tile });
  return game;
}

it("floods a room span in the deepest built row and caps it at the incident size", () => {
  const game = cellar(world());
  expect(floodTargets(game, 2, 0.5)).toEqual(["6,7", "7,7"]);
  expect(floodTargets(game, 1, 0)).toEqual(["5,7"]);
  expect(floodTargets(game, 1, 1)).toEqual(["8,7"]);
  expect(floodTargets(game, 3, 0.5)).toEqual(["5,7", "6,7", "7,7"]);
  expect(floodTargets(game, 3, 0.9)).toEqual(["8,7"]);
  expect(floodTargets(game, 3, 0)).toEqual(["5,7", "6,7", "7,7"]);
});
it("spares the entrance rows and the queen room, and finds nothing in a shallow nest", () => {
  const game = world();
  const queen = game.units[0];
  if (!queen) throw new Error("no queen");
  expect(floodTargets(game, 3, 0.5)).toEqual(["8,5"]);
  Object.assign(game.colony, { "8,6": "corridor", "9,6": "nest", "10,6": "nest", "11,6": "nest" });
  queen.cell = { x: 10, y: 6 };
  expect(floodTargets(game, 3, 0)).toEqual(["8,6"]);
  cellar(game);
  queen.cell = { x: 6, y: 7 };
  expect(floodTargets(game, 3, 0)).toEqual(["5,7", "7,7"]);
  game.colony = { "8,1": "corridor" };
  expect(floodTargets(game, 3, 0.5)).toEqual([]);
  expect(startFlood(game, 3, 0.5)).toBe(0);
  expect(game.flood).toEqual([]);
  expect(game.narrator.effect).toBeNull();
});
it("drowns the food and the eggs of the flooded cells and cancels their hatch orders", () => {
  const game = cellar(world(), "nest");
  const drowned = egg(game, { x: 6, y: 7 });
  const spoiled = food(game, { x: 5, y: 7 });
  const kept = egg(game, { x: 6, y: 4 });
  game.spawns.push({ eggId: drowned.id, role: "worker", progress: 0.5 });
  game.spawns.push({ eggId: kept.id, role: "scout", progress: 0.5 });
  const free = nestFree(game);
  expect(startFlood(game, 3, 0)).toBe(3);
  expect(game.items.map((item) => item.id)).toEqual([kept.id]);
  expect(game.spawns).toEqual([{ eggId: kept.id, role: "scout", progress: 0.5 }]);
  expect(nestFree(game)).toBe(free + 1);
  expect(spoiled.portions).toBe(1);
});
it("interrupts a job that reserved a drowned item and a route that crosses the water", () => {
  const game = cellar(world(), "nest");
  const sunk = egg(game, { x: 6, y: 7 });
  const carrier = addUnit(game, "worker", { x: 8, y: 5 });
  carrier.job = { kind: "haul", itemId: sunk.id, destination: { x: 6, y: 4 }, phase: "pickup" };
  carrier.route = [{ x: 8, y: 6 }];
  const walker = addUnit(game, "worker", { x: 8, y: 5 });
  walker.job = { kind: "wander", destination: { x: 6, y: 7 } };
  walker.route = [
    { x: 8, y: 6 },
    { x: 8, y: 7 },
    { x: 7, y: 7 },
  ];
  const bystander = addUnit(game, "worker", { x: 6, y: 4 });
  bystander.job = { kind: "wander", destination: { x: 7, y: 4 } };
  bystander.route = [{ x: 7, y: 4 }];
  startFlood(game, 3, 0);
  expect(carrier.job).toBeNull();
  expect(walker.job).toBeNull();
  expect(walker.route).toEqual([]);
  expect(bystander.job).toEqual({ kind: "wander", destination: { x: 7, y: 4 } });
});
it("moves a unit out of the water to a dry connected neighbour without hurting it", () => {
  const game = cellar(world(), "nest");
  const carried = egg(game, { x: 7, y: 7 });
  const swimmer = addUnit(game, "worker", { x: 7, y: 7 });
  expect(pickUp(game, swimmer, carried)).toBe(true);
  swimmer.job = { kind: "haul", itemId: carried.id, destination: { x: 6, y: 4 }, phase: "delivery" };
  // The corridor above the nest is not a way out: rooms connect sideways only.
  game.colony["6,6"] = "corridor";
  const trapped = addUnit(game, "worker", { x: 6, y: 7 });
  startFlood(game, 3, 0);
  expect(game.flood).toEqual(["5,7", "6,7", "7,7"]);
  expect(swimmer.cell).toEqual({ x: 8, y: 7 });
  expect(swimmer.hp).toBe(swimmer.maxHp);
  expect(swimmer.job).toBeNull();
  expect(carried.location).toEqual({ kind: "cell", cell: { x: 8, y: 7 } });
  expect(trapped.cell).toEqual({ x: 6, y: 7 });
  expect(trapped.job).toBeNull();
});
it("closes the water to routes, storage, laying and hatching while it stands", () => {
  const game = cellar(world());
  food(game, { x: 6, y: 7 });
  food(game, { x: 6, y: 2 });
  egg(game, { x: 9, y: 3 });
  expect(foodStock(game)).toBe(2);
  game.flood = ["5,7", "6,7", "7,7", "9,3"];
  expect(isFlooded(game, "6,7")).toBe(true);
  expect(isFlooded(game, "8,7")).toBe(false);
  const navigation = new Navigation(game.colony, floodedCells(game));
  expect(navigation.route({ x: 8, y: 7 }, { x: 6, y: 7 })).toBeNull();
  expect(navigation.route({ x: 8, y: 2 }, { x: 8, y: 7 })).toHaveLength(5);
  expect(foodStock(game)).toBe(1);
  expect(foodStorageCells(game)).not.toContainEqual({ x: 6, y: 7 });
  expect(storageCapacity(game)).toBe(5);
  expect(queenCells(game)).toEqual([{ x: 11, y: 3 }]);
  expect(spawnableEggs(game)).toEqual([]);
  expect(eggStorageCells(game, navigation).map(({ cell }) => cellKey(cell))).not.toContain("9,3");
  expect(demolitionError(game, 6, 7)).toBe("Клетка затоплена");
  expect(demolitionError(game, 8, 7)).not.toBe("Клетка затоплена");
});
it("rejects building, wandering and nesting on water and keeps guards off it", () => {
  const game = cellar(world());
  game.blueprints["4,7"] = { tile: "storage", progress: 0, workers: 0 };
  const unit = addUnit(game, "worker", { x: 8, y: 7 });
  unit.job = { kind: "build", target: "4,7", stand: { x: 5, y: 7 } };
  expect(jobValid(game, unit)).toBe(true);
  game.flood = ["5,7", "6,7", "7,7", "8,4"];
  expect(jobValid(game, unit)).toBe(false);
  unit.job = { kind: "wander", destination: { x: 6, y: 7 } };
  expect(jobValid(game, unit)).toBe(false);
  const queen = game.units[0];
  if (!queen) throw new Error("no queen");
  queen.job = { kind: "nest", destination: { x: 6, y: 7 } };
  expect(jobValid(game, queen)).toBe(false);
  const warrior = addUnit(game, "warrior", { x: 8, y: 2 });
  addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  assignTasks(game, "colony", new Navigation(game.colony, new Set(game.flood)), new Set(), () => 0.5);
  expect(warrior.job?.kind === "guard" && cellKey(warrior.job.destination)).not.toBe("8,4");
});
it("recedes after two minutes and leaves the cells usable but empty", () => {
  const game = cellar(world());
  food(game, { x: 6, y: 7 });
  game.narrator.active = "flood";
  expect(startFlood(game, 3, 0)).toBe(3);
  expect(game.narrator.effect).toEqual({ kind: "flood", until: FLOOD_SECONDS });
  const early: GameEvent[] = [];
  game.elapsedSeconds = FLOOD_SECONDS - 0.05;
  settleIncidents(game, early);
  expect(early).toEqual([]);
  expect(game.flood).toHaveLength(3);
  const events: GameEvent[] = [];
  game.elapsedSeconds = FLOOD_SECONDS;
  settleIncidents(game, events);
  expect(events).toEqual([{ kind: "incident-ended", incident: "flood" }]);
  expect(game.narrator.effect).toBeNull();
  expect(game.narrator.active).toBeNull();
  expect(game.flood).toEqual([]);
  expect(game.colony["6,7"]).toBe("storage");
  expect(foodStock(game)).toBe(0);
  expect(storageCapacity(game)).toBe(15);
  recedeFlood(game);
  expect(game.flood).toEqual([]);
});
