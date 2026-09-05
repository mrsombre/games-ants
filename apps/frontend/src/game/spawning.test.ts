import { describe, expect, it } from "vitest";
import type { Game, Worker } from "./model";
import { createGame, stepGame } from "./simulation";
import { spawnableEggs, startSpawn } from "./spawning";

function advance(game: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) stepGame(game, 0.05, () => 0.5);
}

describe("ant spawning", () => {
  it("requires both food and an egg that is not being transported", () => {
    const game = createGame();
    game.eggs = [];
    expect(startSpawn(game, "worker")).toBe(false);
    expect(game.food).toBe(2);
    game.eggs = [{ id: 1, location: { carrier: 1 } }];
    expect(startSpawn(game, "worker")).toBe(false);
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    const worker = game.ants.find((ant): ant is Worker => ant.role === "worker");
    if (!worker) throw new Error("missing worker");
    worker.task = { kind: "carry-egg", eggId: 1, destination: "6,1", phase: "pickup" };
    expect(startSpawn(game, "worker")).toBe(false);
    worker.task = null;
    game.food = 0;
    expect(startSpawn(game, "worker")).toBe(false);
    expect(game.spawns).toEqual([]);
  });

  it("charges food and reserves a random available egg", () => {
    const game = createGame();
    game.ants = [];
    game.eggs = [
      { id: 1, location: { cell: "6,1" } },
      { id: 2, location: { cell: "7,1" } },
    ];
    expect(startSpawn(game, "scout", () => 0.999999)).toBe(true);
    expect(game.food).toBe(0);
    expect(game.spawns).toEqual([{ eggId: 2, cell: "7,1", role: "scout", progress: 0 }]);
    expect(spawnableEggs(game).map((egg) => egg.id)).toEqual([1]);
    expect(game.ants).toEqual([]);
  });

  it("hatches after ten seconds on the reserved cell and consumes the egg", () => {
    const game = createGame();
    game.ants = [];
    game.eggs = [{ id: 1, location: { cell: "6,1" } }];
    game.food = 3;
    expect(startSpawn(game, "warrior")).toBe(true);
    advance(game, 9.95);
    expect(game.ants).toEqual([]);
    expect(game.eggs).toHaveLength(1);
    expect(game.spawns[0]?.progress).toBeCloseTo(0.995);
    advance(game, 0.05);
    expect(game.eggs).toEqual([]);
    expect(game.spawns).toEqual([]);
    expect(game.ants).toMatchObject([{ id: 6, role: "warrior", x: 6, y: 1, phase: "home" }]);
  });
});
