import { describe, expect, it } from "vitest";
import { cancelLastBlueprint, planBuild } from "./construction";
import { createGame, stepGame } from "./simulation";
import { assignTasks } from "./tasks";

function workers() {
  const game = createGame();
  return { ...game, ants: game.ants.filter((ant) => ant.role === "worker") };
}

describe("colony task auction", () => {
  it("awards an egg to the nearest free worker independently of array order", () => {
    const game = workers();
    const near = game.ants[2];
    if (!near) throw new Error("missing worker");
    near.x = 9;
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    assignTasks(game);
    expect(near.task).toMatchObject({ kind: "carry-egg", eggId: 1, destination: "6,1" });
    expect(game.ants.filter((ant) => ant.task)).toHaveLength(1);
  });
  it("uses walking distance instead of straight-line distance", () => {
    const game = workers();
    const [behindWall, near, far] = game.ants;
    if (!behindWall || !near || !far) throw new Error("missing workers");
    game.colony["9,1"] = "room";
    behindWall.x = 9;
    behindWall.y = 1;
    near.x = 11;
    near.y = 2;
    far.x = 8;
    far.y = 4;
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    assignTasks(game);
    expect(near.task?.kind).toBe("carry-egg");
    expect(behindWall.task).toBeNull();
  });
  it("gives construction priority over hauling and allows builders to cooperate", () => {
    const game = workers();
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    planBuild(game, 8, 5, "corridor");
    assignTasks(game);
    expect(game.ants.every((ant) => ant.task?.kind === "build")).toBe(true);
  });
  it("reserves each clutch and destination once", () => {
    const game = workers();
    game.eggs = [
      { id: 1, location: { cell: "9,2" } },
      { id: 2, location: { cell: "11,2" } },
    ];
    assignTasks(game);
    const tasks = game.ants.flatMap((ant) => (ant.task?.kind === "carry-egg" ? [ant.task] : []));
    expect(tasks).toHaveLength(2);
    expect(new Set(tasks.map((task) => task.eggId)).size).toBe(2);
    expect(new Set(tasks.map((task) => task.destination))).toEqual(new Set(["6,1", "7,1"]));
    assignTasks(game);
    expect(game.ants.filter((ant) => ant.task)).toHaveLength(2);
  });
  it("does not transport an egg reserved for spawning", () => {
    const game = workers();
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    game.spawns = [{ eggId: 1, cell: "9,2", role: "worker", progress: 0 }];
    assignTasks(game);
    expect(game.ants.every((ant) => ant.task === null)).toBe(true);
  });
  it("keeps a carrier on its task when a higher-priority blueprint appears", () => {
    const game = workers();
    game.eggs = [{ id: 1, location: { cell: "9,2" } }];
    assignTasks(game);
    const carrier = game.ants.find((ant) => ant.task?.kind === "carry-egg");
    expect(carrier).toBeDefined();
    planBuild(game, 8, 5, "corridor");
    assignTasks(game);
    expect(carrier?.task?.kind).toBe("carry-egg");
    expect(game.ants.filter((ant) => ant.task?.kind === "build")).toHaveLength(2);
  });
  it("releases canceled construction and skips unreachable blueprints", () => {
    const game = workers();
    planBuild(game, 8, 5, "corridor");
    assignTasks(game);
    cancelLastBlueprint(game);
    for (let i = 0; i < 100; i++) stepGame(game, 0.05);
    expect(game.ants.every((ant) => ant.task === null)).toBe(true);
    game.blueprints["0,9"] = { tile: "corridor", progress: 0, workers: 0 };
    assignTasks(game);
    expect(game.ants.every((ant) => ant.task === null)).toBe(true);
  });
  it("assigns foraging and patrol only to the matching roles", () => {
    const game = createGame();
    assignTasks(game);
    expect(game.ants.find((ant) => ant.role === "scout")?.phase).toBe("outbound");
    expect(game.ants.find((ant) => ant.role === "warrior")?.phase).toBe("patrol");
    expect(game.ants.filter((ant) => ant.role === "worker").every((ant) => ant.task === null)).toBe(true);
  });
});
