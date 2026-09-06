import { describe, expect, it } from "vitest";
import { key } from "./cells";
import { planBuild } from "./construction";
import { demolish, demolitionError } from "./demolition";
import { createGame, stepGame } from "./simulation";

describe("demolition", () => {
  it("removes room edges and corridor ends", () => {
    const game = createGame();
    game.items = [];
    for (const [x, y] of [
      [6, 2],
      [7, 2],
      [11, 3],
      [8, 5],
      [8, 4],
    ] as const) {
      expect(demolish(game, x, y)).toBeNull();
      expect(game.colony[key(x, y)]).toBeUndefined();
    }
    expect(game.revision).toBe(5);
  });
  it("protects the entrance, queen, room interiors and corridor junctions", () => {
    const game = createGame();
    game.colony["5,2"] = "room";
    for (const [x, y] of [
      [8, 1],
      [10, 3],
      [6, 2],
      [8, 3],
      [-1, 2],
      [1, 2],
    ] as const) {
      const before = structuredClone(game);
      expect(demolish(game, x, y)).toBeTruthy();
      expect(game).toEqual(before);
    }
  });
  it("rejects room edges and corridor ends that would isolate another cell", () => {
    const game = createGame();
    expect(demolitionError(game, 7, 2)).toBeTruthy();
    game.colony["7,5"] = "room";
    expect(demolitionError(game, 8, 5)).toBeTruthy();
    game.colony["6,3"] = "room";
    game.colony["6,4"] = "corridor";
    game.colony["7,4"] = "corridor";
    expect(demolitionError(game, 7, 2)).toMatch(/отрезать/);
  });
  it("does not treat a loop as a corridor end", () => {
    const game = createGame();
    game.colony["9,4"] = "corridor";
    game.colony["9,5"] = "corridor";
    expect(demolitionError(game, 9, 5)).toBeTruthy();
  });
  it("removes blueprints from the end without orphaning queued construction", () => {
    const game = createGame();
    planBuild(game, 8, 6, "corridor");
    planBuild(game, 8, 7, "corridor");
    expect(demolish(game, 8, 5)).toBeTruthy();
    expect(demolish(game, 8, 6)).toBeTruthy();
    expect(demolish(game, 8, 7)).toBeNull();
    expect(demolish(game, 8, 6)).toBeNull();
    expect(game.blueprints).toEqual({});
  });
  it("does not rely on an unfinished corridor loop to preserve completed-room access", () => {
    const game = createGame(() => 0.5);
    game.items = [];
    game.colony = { "8,1": "corridor", "8,2": "corridor", "8,3": "corridor", "7,3": "room", "6,3": "room" };
    expect(planBuild(game, 7, 2, "corridor")).toBeNull();
    expect(planBuild(game, 6, 2, "corridor")).toBeNull();
    expect(demolish(game, 7, 3)).toMatch(/отрезать/);
  });
  it("interrupts movement along a demolished segment and relocates to a connected cell", () => {
    const game = createGame(() => 0.5);
    const unit = game.units.find((unit) => unit.role === "worker");
    if (!unit) throw new Error("worker");
    unit.cell = { x: 8, y: 5 };
    unit.route = [{ x: 8, y: 4 }];
    unit.travel = 0.8;
    expect(demolish(game, 8, 5)).toBeNull();
    expect(unit.cell).toEqual({ x: 8, y: 4 });
    expect(unit.route).toEqual([]);
    expect(unit.travel).toBe(0);
    stepGame(game);
    expect(unit.route).not.toContainEqual({ x: 8, y: 5 });
  });
});

it("protects cargo and destination reservations even on an otherwise removable room edge", () => {
  const game = createGame(() => 0.5);
  game.items = [{ id: 1, kind: "egg", location: { kind: "cell", cell: { x: 6, y: 2 } } }];
  expect(demolish(game, 6, 2)).toMatch(/яиц/);
  game.items = [];
  const worker = game.units.find((unit) => unit.role === "worker");
  if (!worker) throw new Error("worker");
  worker.job = { kind: "haul", itemId: 1, destination: { x: 6, y: 2 }, phase: "pickup" };
  expect(demolish(game, 6, 2)).toMatch(/яиц/);
  worker.hp = 0;
  expect(demolish(game, 6, 2)).toBeNull();
});
it("protects the queen when her cell is a removable room edge", () => {
  const game = createGame(() => 0.5);
  game.items = [];
  delete game.colony["11,3"];
  expect(demolish(game, 10, 3)).toMatch(/маткой/);
});
it("rejects an interior room cell even when a second corridor keeps both sides reachable", () => {
  const game = createGame(() => 0.5);
  game.items = [];
  game.colony["6,3"] = "corridor";
  game.colony["7,3"] = "corridor";
  expect(demolish(game, 10, 3)).toBeTruthy();
  game.colony["5,2"] = "room";
  expect(demolish(game, 6, 2)).toMatch(/с края/);
});
it("invalidates future routes through a removed cell without moving unrelated units", () => {
  const game = createGame(() => 0.5);
  const [first, second] = game.units.filter((unit) => unit.role === "worker");
  if (!first || !second) throw new Error("workers");
  first.cell = { x: 8, y: 3 };
  first.route = [
    { x: 8, y: 4 },
    { x: 8, y: 5 },
  ];
  first.job = { kind: "wander", destination: { x: 8, y: 5 } };
  second.cell = { x: 8, y: 2 };
  second.route = [{ x: 7, y: 2 }];
  second.job = { kind: "wander", destination: { x: 7, y: 2 } };
  expect(demolish(game, 8, 5)).toBeNull();
  expect(first.cell).toEqual({ x: 8, y: 3 });
  expect(first.route).toEqual([]);
  expect(first.job).toBeNull();
  expect(second.route).toEqual([{ x: 7, y: 2 }]);
});
it("relocates a unit partway into a demolished cell and preserves items at the surviving end", () => {
  const game = createGame(() => 0.5);
  const worker = game.units.find((unit) => unit.role === "worker");
  if (!worker) throw new Error("worker");
  worker.cell = { x: 8, y: 4 };
  worker.route = [{ x: 8, y: 5 }];
  worker.travel = 0.2;
  game.items = [{ id: 1, kind: "egg", location: { kind: "carried", unitId: worker.id } }];
  expect(demolish(game, 8, 5)).toBeNull();
  expect(worker.cell).toEqual({ x: 8, y: 4 });
  expect(worker.route).toEqual([]);
  expect(worker.travel).toBe(0);
  expect(game.items[0]?.location).toEqual({ kind: "cell", cell: { x: 8, y: 4 } });
});

it("evacuates a removed room through a real passage rather than across a vertical room wall", () => {
  const game = createGame(() => 0.5);
  game.items = [];
  game.colony["6,3"] = "room";
  game.colony["6,4"] = "corridor";
  game.colony["7,4"] = "corridor";
  const worker = game.units.find((unit) => unit.role === "worker");
  if (!worker) throw new Error("worker");
  worker.cell = { x: 6, y: 3 };
  expect(demolish(game, 6, 3)).toBeNull();
  expect(worker.cell).toEqual({ x: 6, y: 4 });
  worker.cell = { x: 6, y: 2 };
  expect(demolish(game, 6, 2)).toBeNull();
  expect(worker.cell).toEqual({ x: 7, y: 2 });
});
