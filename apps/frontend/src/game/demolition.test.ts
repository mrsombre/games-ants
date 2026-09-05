import { describe, expect, it } from "vitest";
import { key } from "./colony";
import { planBuild } from "./construction";
import { demolish, demolitionError } from "./demolition";
import { createGame, stepGame } from "./simulation";

describe("demolition", () => {
  it("removes room edges and corridor ends", () => {
    const game = createGame();
    for (const [x, y] of [
      [6, 1],
      [7, 1],
      [11, 2],
      [8, 4],
      [8, 3],
    ] as const) {
      expect(demolish(game, x, y)).toBeNull();
      expect(game.colony[key(x, y)]).toBeUndefined();
    }
    expect(game.revision).toBe(5);
  });
  it("protects the entrance, queen, room interiors and corridor junctions", () => {
    const game = createGame();
    game.colony["5,1"] = "room";
    for (const [x, y] of [
      [8, 0],
      [10, 2],
      [6, 1],
      [8, 2],
      [-1, 1],
      [1, 1],
    ] as const) {
      const before = structuredClone(game);
      expect(demolish(game, x, y)).toBeTruthy();
      expect(game).toEqual(before);
    }
  });
  it("rejects room edges and corridor ends that would isolate another cell", () => {
    const game = createGame();
    expect(demolitionError(game, 7, 1)).toBeTruthy();
    game.colony["7,4"] = "room";
    expect(demolitionError(game, 8, 4)).toBeTruthy();
  });
  it("does not treat a loop as a corridor end", () => {
    const game = createGame();
    game.colony["9,3"] = "corridor";
    game.colony["9,4"] = "corridor";
    expect(demolitionError(game, 9, 4)).toBeTruthy();
  });
  it("removes blueprints from the end without orphaning queued construction", () => {
    const game = createGame();
    planBuild(game, 8, 5, "corridor");
    planBuild(game, 8, 6, "corridor");
    expect(demolish(game, 8, 4)).toBeTruthy();
    expect(demolish(game, 8, 5)).toBeTruthy();
    expect(demolish(game, 8, 6)).toBeNull();
    expect(demolish(game, 8, 5)).toBeNull();
    expect(game.blueprints).toEqual({});
  });
  it("does not rely on unfinished rooms to preserve access", () => {
    const game = createGame();
    game.colony["7,4"] = "room";
    planBuild(game, 7, 3, "room");
    expect(demolitionError(game, 8, 4)).toBeTruthy();
  });
  it.each([4, 3.8, 3.2])("moves an ant on a removed segment to safety (y=%s)", (y) => {
    const game = createGame();
    const ant = game.ants[0];
    if (!ant) throw new Error("missing ant");
    ant.x = 8;
    ant.y = y;
    ant.route = [{ x: 8, y: 3 }];
    expect(demolish(game, 8, 4)).toBeNull();
    expect([ant.x, ant.y]).toEqual([8, 3]);
    for (let i = 0; i < 100; i++) stepGame(game, 0.05, () => 0.5);
    expect(game.colony[key(Math.round(ant.x), Math.round(ant.y))]).toBeDefined();
    expect(ant.route).not.toContainEqual({ x: 8, y: 4 });
  });
});
