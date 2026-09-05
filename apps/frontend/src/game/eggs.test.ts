import { describe, expect, it } from "vitest";
import { planBuild } from "./construction";
import { demolish } from "./demolition";
import type { Game } from "./model";
import { createGame, stepGame } from "./simulation";

function advance(game: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) stepGame(game, 0.05, () => 0.5);
}

function workerGame() {
  const game = createGame();
  game.ants = game.ants.filter((ant) => ant.role === "worker");
  return game;
}

describe("egg lifecycle", () => {
  it("starts empty and lays the first clutch after 30 seconds", () => {
    const game = createGame();
    game.ants = [];
    expect(game.eggs).toEqual([]);
    advance(game, 29.95);
    expect(game.eggs).toEqual([]);
    advance(game, 0.05);
    expect(game.eggs).toEqual([{ id: 1, location: { cell: "9,2" } }]);
    expect(game.eggTimer).toBeCloseTo(0);
  });
  it("pauses the timer when both adjacent cells are occupied and preserves elapsed time", () => {
    const game = createGame();
    game.ants = [];
    advance(game, 12);
    game.eggs = [
      { id: 1, location: { cell: "9,2" } },
      { id: 2, location: { cell: "11,2" } },
    ];
    game.nextEggId = 3;
    advance(game, 100);
    expect(game.eggTimer).toBeCloseTo(12);
    expect(game.eggs).toHaveLength(2);
    game.eggs[0] = { id: 1, location: { cell: "6,1" } };
    advance(game, 17.95);
    expect(game.eggs).toHaveLength(2);
    advance(game, 0.05);
    expect(game.eggs).toHaveLength(3);
    expect(game.eggs[2]?.location).toEqual({ cell: "9,2" });
  });
  it("only lays in completed room cells beside the queen", () => {
    const game = createGame();
    game.ants = [];
    delete game.colony["9,2"];
    delete game.colony["11,2"];
    game.blueprints["11,2"] = { tile: "room", workers: 0, progress: 0 };
    advance(game, 60);
    expect(game.eggs).toEqual([]);
    expect(game.eggTimer).toBe(0);
  });
  it("carries a clutch visibly before storing it in the farthest reachable room cell", () => {
    const game = workerGame();
    advance(game, 30);
    expect(game.eggs).toHaveLength(1);
    for (let i = 0; i < 200 && game.eggs[0] && "cell" in game.eggs[0].location; i++) {
      stepGame(game, 0.05, () => 0.5);
    }
    expect(game.eggs[0]?.location).toHaveProperty("carrier");
    advance(game, 5);
    expect(game.eggs[0]?.location).toEqual({ cell: "6,1" });
    expect(game.ants.every((ant) => ant.role !== "worker" || ant.task === null)).toBe(true);
  });
  it("fills rooms without duplication or hatching and resumes when storage is extended", () => {
    const game = workerGame();
    advance(game, 180);
    expect(game.eggs).toHaveLength(4);
    expect(new Set(game.eggs.map((egg) => ("cell" in egg.location ? egg.location.cell : "carried"))).size).toBe(4);
    expect(game.ants).toHaveLength(3);
    expect(game.eggTimer).toBeCloseTo(0);
    expect(planBuild(game, 5, 1, "room")).toBeNull();
    advance(game, 60);
    expect(game.eggs).toHaveLength(5);
    expect(game.eggs.some((egg) => "cell" in egg.location && egg.location.cell === "5,1")).toBe(true);
  });
  it("protects stored eggs and reserved destinations from demolition", () => {
    const game = workerGame();
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    game.nextEggId = 2;
    stepGame(game, 0.05);
    expect(demolish(game, 6, 1)).toBeTruthy();
    expect(demolish(game, 9, 2)).toBeTruthy();
    advance(game, 6);
    expect(demolish(game, 6, 1)).toBeTruthy();
    expect(game.eggs[0]?.location).toEqual({ cell: "6,1" });
  });
  it("does not use unreachable or vertical neighboring rooms for storage", () => {
    const game = workerGame();
    delete game.colony["6,1"];
    delete game.colony["7,1"];
    game.colony["10,3"] = "room";
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    game.nextEggId = 2;
    advance(game, 10);
    expect(game.eggs[0]?.location).toEqual({ cell: "9,2" });
    expect(game.ants.every((ant) => ant.role !== "worker" || ant.task?.kind !== "carry-egg")).toBe(true);
  });
});
