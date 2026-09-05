import { describe, expect, it } from "vitest";
import { cancelLastBlueprint, createGame, type Game, planBuild, recruit, routeTo, stepGame } from "./simulation";

function advance(game: Game, seconds: number, random = () => 0.5) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) stepGame(game, 0.05, random);
}
function builders(count: number) {
  const game = createGame();
  game.ants = game.ants.filter((ant) => ant.role === "worker").slice(0, count);
  for (const ant of game.ants) {
    ant.x = 8;
    ant.y = 4;
  }
  return game;
}
describe("living colony", () => {
  it("starts with all roles and charges exact recruitment costs without going into debt", () => {
    const game = createGame();
    expect(game.food).toBe(5);
    expect(game.ants.map((ant) => ant.role)).toEqual(["worker", "worker", "worker", "scout", "warrior"]);
    expect(recruit(game, "scout")).toBe(true);
    expect(game.food).toBe(3);
    expect(recruit(game, "warrior")).toBe(true);
    expect(game.food).toBe(0);
    expect(recruit(game, "worker")).toBe(false);
    game.food = 1;
    expect(recruit(game, "worker")).toBe(true);
    expect(game.food).toBe(0);
  });
  it("marks blueprints, validates their topology and keeps them unwalkable", () => {
    const game = builders(1);
    expect(planBuild(game, 8, 5, "corridor")).toBeNull();
    expect(planBuild(game, 8, 6, "corridor")).toBeNull();
    expect(game.colony["8,5"]).toBeUndefined();
    expect(routeTo(game.colony, { x: 8, y: 4 }, { x: 8, y: 5 })).toBeNull();
    expect(planBuild(game, 5, 1, "room")).toBeNull();
    expect(planBuild(game, 4, 1, "room")).toBeNull();
    expect(planBuild(game, 3, 1, "room")).toBeTruthy();
    expect(planBuild(game, 4, 2, "corridor")).toBeTruthy();
    expect(planBuild(game, 7, 0, "corridor")).toBeTruthy();
    expect(planBuild(game, 8, 5, "corridor")).toBeTruthy();
  });
  it.each([1, 2, 3])("finishes a corridor after 20 worker-seconds with %i workers", (count) => {
    const game = builders(count);
    planBuild(game, 8, 5, "corridor");
    advance(game, 6);
    expect(game.blueprints["8,5"]?.progress).toBeCloseTo((6 * count) / 20);
    expect(game.blueprints["8,5"]?.workers).toBe(count);
    advance(game, 20 / count - 6 + 0.05);
    expect(game.colony["8,5"]).toBe("corridor");
  });
  it("requires 30 worker-seconds for a room", () => {
    const game = builders(1);
    planBuild(game, 7, 4, "room");
    advance(game, 29.95);
    expect(game.colony["7,4"]).toBeUndefined();
    advance(game, 0.05);
    expect(game.colony["7,4"]).toBe("room");
  });
  it("walks to the closest reachable site and only works after arrival", () => {
    const game = builders(1);
    planBuild(game, 8, 7, "corridor"); // invalid, isolated
    planBuild(game, 7, 3, "room");
    planBuild(game, 8, 5, "corridor");
    advance(game, 1);
    expect(game.blueprints["8,5"]?.progress).toBeCloseTo(0.05);
    expect(game.blueprints["7,3"]?.progress).toBe(0);
    cancelLastBlueprint(game);
    stepGame(game, 0.05);
    expect(game.ants[0]?.target).toBe("7,3");
    expect(game.blueprints["7,3"]?.progress).toBe(0);
    advance(game, 1);
    expect(game.blueprints["7,3"]?.progress).toBeGreaterThan(0);
  });
  it("builds a queued shaft sequentially without walking through soil", () => {
    const game = builders(1);
    planBuild(game, 8, 5, "corridor");
    planBuild(game, 8, 6, "corridor");
    advance(game, 20);
    expect(game.colony["8,5"]).toBe("corridor");
    expect(game.blueprints["8,6"]?.progress).toBe(0);
    advance(game, 0.5);
    expect(game.blueprints["8,6"]?.progress).toBe(0);
    advance(game, 21);
    expect(game.colony["8,6"]).toBe("corridor");
  });
  it("leaves blueprints waiting without workers and can cancel work in progress", () => {
    const game = builders(0);
    planBuild(game, 8, 5, "corridor");
    advance(game, 60);
    expect(game.blueprints["8,5"]?.progress).toBe(0);
    recruit(game, "worker");
    advance(game, 10);
    expect(game.blueprints["8,5"]?.progress).toBeGreaterThan(0);
    cancelLastBlueprint(game);
    advance(game, 30);
    expect(game.colony["8,5"]).toBeUndefined();
    expect(game.blueprints).toEqual({});
  });
  it("never connects rooms through vertical walls", () => {
    expect(routeTo({ "1,1": "room", "1,2": "room" }, { x: 1, y: 1 }, { x: 1, y: 2 })).toBeNull();
  });
  it.each([0, 0.999999])("scouts leave the map, wait 5–60 seconds and deliver food at home (rng %s)", (rng) => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "scout");
    const ant = game.ants[0];
    if (!ant) throw new Error("missing scout");
    for (let i = 0; i < 1000 && ant.phase !== "away"; i++) stepGame(game, 0.05, () => rng);
    expect(ant.phase).toBe("away");
    expect(ant.x < 0 || ant.x > 17).toBe(true);
    expect(ant.away).toBeCloseTo(5 + rng * 55);
    expect(game.food).toBe(5);
    advance(game, 4.9, () => rng);
    expect(ant.phase).toBe("away");
    for (let i = 0; i < 1600 && game.deliveries === 0; i++) stepGame(game, 0.05, () => rng);
    expect(game.deliveries).toBe(1);
    expect(game.food).toBe(6 + Math.floor(rng * 3));
    expect([ant.x, ant.y]).toEqual([10, 2]);
    expect(ant.cargo).toBe(0);
    for (let i = 0; i < 1000 && ant.phase !== "away"; i++) stepGame(game, 0.05, () => rng);
    expect(ant.phase).toBe("away");
  });
  it("warriors climb out then patrol around the anthill", () => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "warrior");
    advance(game, 10);
    const ant = game.ants[0];
    expect(ant?.phase).toBe("patrol");
    for (let i = 0; i < 100; i++) {
      stepGame(game, 0.05);
      expect(ant?.y).toBe(-0.7);
      expect(ant?.x).toBeGreaterThanOrEqual(5);
      expect(ant?.x).toBeLessThanOrEqual(11);
    }
  });
});
