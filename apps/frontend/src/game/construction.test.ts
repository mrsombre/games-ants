import { describe, expect, it } from "vitest";
import { clearCell, finishBlueprint, placeBlueprint } from "./construction";
import { createGame } from "./simulation";

describe("construction mutators", () => {
  it("places a blueprint and bumps the revision once", () => {
    const game = createGame();
    placeBlueprint(game, "3,5", "nest");
    expect(game.blueprints["3,5"]).toEqual({ tile: "nest", progress: 0, workers: 0 });
    expect(game.colony["3,5"]).toBeUndefined();
    expect(game.revision).toBe(1);
  });
  it("finishes a blueprint into the colony and bumps the revision once", () => {
    const game = createGame();
    game.blueprints["3,5"] = { tile: "storage", progress: 1, workers: 2 };
    finishBlueprint(game, "3,5");
    expect(game.colony["3,5"]).toBe("storage");
    expect(game.blueprints["3,5"]).toBeUndefined();
    expect(game.revision).toBe(1);
  });
  it("clears a cell of both the tile and the blueprint and bumps the revision once", () => {
    const game = createGame();
    game.colony["3,5"] = "corridor";
    game.blueprints["3,6"] = { tile: "nest", progress: 0.5, workers: 1 };
    clearCell(game, "3,5");
    clearCell(game, "3,6");
    expect(game.colony["3,5"]).toBeUndefined();
    expect(game.blueprints["3,6"]).toBeUndefined();
    expect(game.revision).toBe(2);
  });
  it("carries a placed blueprint into the colony when finished", () => {
    const game = createGame();
    placeBlueprint(game, "3,5", "nest");
    finishBlueprint(game, "3,5");
    expect(game.colony["3,5"]).toBe("nest");
    expect(game.blueprints["3,5"]).toBeUndefined();
    expect(game.revision).toBe(2);
  });
});
