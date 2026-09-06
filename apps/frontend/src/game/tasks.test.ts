import { expect, it } from "vitest";
import { planBuild } from "./construction";
import { Navigation } from "./navigation";
import { assignTasks } from "./tasks";
import { addUnit, egg, food, world } from "./test-support";

function auction(game: ReturnType<typeof world>, faction: "colony" | "raiders" = "colony", random = () => 0.5) {
  assignTasks(game, faction, new Navigation(game.colony), new Set(), random);
}
it("awards hauling by path time and stable id, independent of unit array order", () => {
  const game = world();
  game.colony["9,2"] = "nest";
  const wall = addUnit(game, "worker", { x: 9, y: 2 });
  const near = addUnit(game, "worker", { x: 11, y: 3 });
  const tie = addUnit(game, "worker", { x: 11, y: 3 });
  game.units.reverse();
  egg(game, { x: 9, y: 3 });
  auction(game);
  expect(near.job).toMatchObject({ kind: "haul", destination: { x: 6, y: 4 } });
  expect(wall.job?.kind).toBe("wander");
  expect(tie.job?.kind).toBe("wander");
});
it("accounts for individual speed when choosing a free worker", () => {
  const game = world();
  const slow = addUnit(game, "worker", { x: 9, y: 3 });
  const fast = addUnit(game, "worker", { x: 11, y: 3 });
  fast.speed = 10;
  egg(game, { x: 9, y: 3 });
  auction(game);
  expect(fast.job?.kind).toBe("haul");
  expect(slow.job?.kind).toBe("wander");
});
it("reserves each item and destination once across repeated faction auctions", () => {
  const game = world();
  for (let i = 0; i < 3; i++) addUnit(game);
  egg(game, { x: 9, y: 3 });
  egg(game, { x: 11, y: 3 });
  auction(game);
  const jobs = game.units.flatMap((unit) => (unit.job?.kind === "haul" ? [unit.job] : []));
  expect(jobs).toHaveLength(2);
  auction(game);
  expect(game.units.flatMap((unit) => (unit.job?.kind === "haul" ? [unit.job] : []))).toEqual(jobs);
  expect(new Set(jobs.map((job) => job.itemId)).size).toBe(2);
  expect(new Set(jobs.map((job) => `${job.destination.x},${job.destination.y}`))).toEqual(new Set(["6,4", "7,4"]));
  const thief = addUnit(game, "worker", { x: 8, y: 3 }, "raiders");
  auction(game, "raiders");
  expect(thief.job?.kind).toBe("attack");
});
it("shares construction among free workers but never preempts a carrier with a higher priority", () => {
  const game = world();
  const carrier = addUnit(game);
  egg(game, { x: 9, y: 3 });
  auction(game);
  const builders = [addUnit(game), addUnit(game)];
  planBuild(game, 8, 6, "corridor");
  auction(game);
  expect(carrier.job?.kind).toBe("haul");
  expect(builders.map((unit) => unit.job?.kind)).toEqual(["build", "build"]);
});
it("skips unreachable work and eggs reserved for hatching", () => {
  const game = world();
  const worker = addUnit(game);
  const item = egg(game, { x: 9, y: 3 });
  game.spawns = [{ eggId: item.id, role: "worker", progress: 0 }];
  game.blueprints["0,10"] = { tile: "nest", progress: 0, workers: 0 };
  auction(game);
  expect(worker.job?.kind).toBe("wander");
});
it("uses the same auction for raider workers stealing different eggs and warriors attacking", () => {
  const game = world();
  const thieves = [
    addUnit(game, "worker", { x: 8, y: 3 }, "raiders"),
    addUnit(game, "worker", { x: 8, y: 3 }, "raiders"),
  ];
  const warrior = addUnit(game, "warrior", { x: 8, y: 3 }, "raiders");
  egg(game, { x: 9, y: 3 });
  egg(game, { x: 11, y: 3 });
  auction(game, "raiders");
  expect(thieves.map((unit) => unit.job?.kind)).toEqual(["haul", "haul"]);
  expect(warrior.job).toEqual({ kind: "attack", targetId: 0 });
});
it("routes free scouts to intercept, workers to guard and respects combat exclusion", () => {
  const game = world();
  const worker = addUnit(game),
    scout = addUnit(game, "scout"),
    fighter = addUnit(game, "warrior");
  addUnit(game, "warrior", { x: 0, y: 0 }, "raiders");
  assignTasks(game, "colony", new Navigation(game.colony), new Set([fighter.id]), () => 0.5);
  expect(worker.job).toEqual({ kind: "guard", destination: { x: 8, y: 3 } });
  expect(scout.job?.kind).toBe("attack");
  expect(fighter.job).toBeNull();
});
it.each([
  [0.749999, 0],
  [0.75, 1],
])("chooses surface patrol below the probability boundary (%s)", (roll, minY) => {
  const game = world();
  const warrior = addUnit(game, "warrior");
  auction(game, "colony", () => roll);
  expect(warrior.job?.kind).toBe("wander");
  const target = warrior.route.at(-1);
  expect(target).toBeDefined();
  if (minY === 0) {
    expect(target?.y).toBe(0);
    expect(target?.x).toBeGreaterThanOrEqual(5);
    expect(target?.x).toBeLessThanOrEqual(11);
  } else expect(target?.y).toBeGreaterThanOrEqual(1);
});

it("reserves food for scouts and eggs for workers before execution, with food recovery ahead of expeditions", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 9, y: 3 });
  const scout = addUnit(game, "scout", { x: 11, y: 3 });
  const item = egg(game, { x: 11, y: 3 });
  const apple = food(game, { x: 9, y: 3 });
  auction(game);
  expect(worker.job).toMatchObject({ kind: "haul", itemId: item.id });
  expect(scout.job).toMatchObject({ kind: "haul", itemId: apple.id, destination: { x: 7, y: 2 } });
});
it("awards build sites only through horizontal room passages or corridor-to-corridor links", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 6, y: 4 });
  game.colony["7,3"] = "corridor";
  game.blueprints["6,3"] = { tile: "corridor", progress: 0, workers: 0 };
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "6,3", stand: { x: 7, y: 3 } });
  worker.job = null;
  worker.route = [];
  game.blueprints = { "7,5": { tile: "nest", progress: 0, workers: 0 } };
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "7,5", stand: { x: 8, y: 5 } });
  worker.job = null;
  worker.route = [];
  game.blueprints = { "5,4": { tile: "corridor", progress: 0, workers: 0 } };
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "5,4", stand: { x: 6, y: 4 } });
});
it("keeps raider loot delivery outside the map and does not send a healthy colony scout to patrol", () => {
  const game = world();
  const thief = addUnit(game, "worker", { x: 6, y: 4 }, "raiders");
  const scout = addUnit(game, "scout");
  egg(game, thief.cell);
  auction(game, "raiders");
  expect(thief.job).toMatchObject({ kind: "haul", destination: { x: -1, y: 0 } });
  game.units = game.units.filter((unit) => unit.id !== thief.id);
  auction(game, "colony", () => 0.5);
  expect(scout.job).toMatchObject({ kind: "forage", exit: { x: 18, y: 0 } });
  expect(scout.route.at(-1)).toEqual({ x: 18, y: 0 });
});

it("gives free workers construction priority over eggs and scouts interception priority over dropped food", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 9, y: 3 });
  egg(game, worker.cell);
  planBuild(game, 8, 6, "corridor");
  auction(game);
  expect(worker.job?.kind).toBe("build");
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  addUnit(game, "warrior", { x: 1, y: 0 }, "raiders");
  food(game, scout.cell);
  auction(game);
  expect(scout.job?.kind).toBe("attack");
});
it.each(["worker", "scout", "warrior"] as const)(
  "assigns departure to a %s raider when no opponents remain",
  (role) => {
    const game = world();
    game.units = [];
    const raider = addUnit(game, role, { x: 3, y: 0 }, "raiders");
    auction(game, "raiders");
    expect(raider.job).toEqual({ kind: "leave", destination: { x: -1, y: 0 } });
    expect(raider.route.at(-1)).toEqual({ x: -1, y: 0 });
  },
);

it("assigns a newly available egg and room while other carriers retain their individual reservations", () => {
  const game = world();
  for (let i = 0; i < 3; i++) addUnit(game);
  egg(game, { x: 9, y: 3 });
  egg(game, { x: 11, y: 3 });
  auction(game);
  game.colony["5,4"] = "nest";
  const extra = egg(game, { x: 8, y: 3 });
  auction(game);
  expect(game.units.flatMap((unit) => (unit.job?.kind === "haul" ? [unit.job] : []))).toContainEqual({
    kind: "haul",
    itemId: extra.id,
    destination: { x: 5, y: 4 },
    phase: "pickup",
  });
});
it("keeps deterministic random assignments when the unit array is reordered", () => {
  const game = world();
  addUnit(game);
  addUnit(game);
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  const reordered = structuredClone(game);
  reordered.units.reverse();
  const random = () => {
    let state = 3;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };
  auction(game, "colony", random());
  auction(reordered, "colony", random());
  const jobs = (g: typeof game) => [...g.units].sort((a, b) => a.id - b.id).map((unit) => unit.job);
  expect(jobs(reordered)).toEqual(jobs(game));
});
it.each([0, 0.85, 0.999])(
  "gives idle workers a nonempty underground route, varying the choice with random input (%s)",
  (roll) => {
    const game = world();
    const worker = addUnit(game);
    auction(game, "colony", () => roll);
    expect(worker.route.length).toBeGreaterThan(0);
    expect(worker.route.at(-1)?.y).toBeGreaterThan(0);
    if (roll === 0) expect(worker.route.at(-1)).toEqual({ x: 8, y: 1 });
    if (roll === 0.999) expect(worker.route.at(-1)).toEqual({ x: 7, y: 4 });
  },
);

it("builds a horizontal room extension from a room but requires a corridor for vertical access", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 6, y: 4 });
  game.blueprints["5,4"] = { tile: "nest", progress: 0, workers: 0 };
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "5,4", stand: { x: 6, y: 4 } });
  worker.job = null;
  game.colony["7,3"] = "corridor";
  game.blueprints = { "6,3": { tile: "nest", progress: 0, workers: 0 } };
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "6,3", stand: { x: 7, y: 3 } });
});
it("sends concurrent food deliveries to different storage cells, nearest first", () => {
  const game = world();
  const first = addUnit(game, "scout", { x: 9, y: 3 });
  const second = addUnit(game, "scout", { x: 11, y: 3 });
  const [near, far] = [first, second].map((scout) => food(game, scout.cell));
  auction(game);
  expect([first.job, second.job]).toEqual([
    { kind: "haul", itemId: near?.id, destination: { x: 7, y: 2 }, phase: "pickup" },
    { kind: "haul", itemId: far?.id, destination: { x: 6, y: 2 }, phase: "pickup" },
  ]);
});
it("offers expeditions only while a storage slot is free, counting reserved deliveries", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  for (let i = 0; i < 3; i++) food(game, { x: 6, y: 2 });
  food(game, { x: 7, y: 2 });
  const carrier = addUnit(game, "scout", { x: 8, y: 2 });
  const carried = food(game, carrier.cell, "caterpillar");
  carried.location = { kind: "carried", unitId: carrier.id };
  carrier.job = { kind: "haul", itemId: carried.id, destination: { x: 7, y: 2 }, phase: "delivery" };
  auction(game);
  expect(scout.job?.kind).toBe("wander");
  carrier.hp = 0;
  auction(game);
  expect(scout.job?.kind).toBe("forage");
});
it("hauls food out of a nest into a storage but leaves stored food and takes stray eggs back to a nest", () => {
  const game = world();
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  const stray = food(game, { x: 9, y: 3 });
  auction(game);
  expect(scout.job).toMatchObject({ kind: "haul", itemId: stray.id, destination: { x: 7, y: 2 } });
  scout.job = null;
  scout.route = [];
  stray.location = { kind: "cell", cell: { x: 7, y: 2 } };
  auction(game);
  expect(scout.job).toMatchObject({ kind: "forage" });
  const worker = addUnit(game, "worker", { x: 6, y: 2 });
  const lost = egg(game, worker.cell);
  auction(game);
  expect(worker.job).toMatchObject({ kind: "haul", itemId: lost.id, destination: { x: 6, y: 4 } });
});
it("reserves only the egg being hatched and assigns other eggs to mobile workers", () => {
  const game = world();
  const immobile = addUnit(game, "worker", { x: 9, y: 3 });
  immobile.speed = 0;
  const worker = addUnit(game);
  const reserved = egg(game, { x: 11, y: 3 });
  const available = egg(game, { x: 9, y: 3 });
  game.spawns = [{ eggId: reserved.id, role: "worker", progress: 0 }];
  auction(game);
  expect(worker.job).toMatchObject({ kind: "haul", itemId: available.id });
  expect(immobile.job).toBeNull();
});
it("subtracts distance already traveled when a wanderer bids for an egg", () => {
  const game = world();
  const stationary = addUnit(game, "worker", { x: 8, y: 3 });
  const moving = addUnit(game, "worker", { x: 8, y: 3 });
  moving.job = { kind: "wander", destination: { x: 9, y: 3 } };
  moving.route = [{ x: 9, y: 3 }];
  moving.travel = 0.5;
  egg(game, { x: 9, y: 3 });
  auction(game);
  expect(moving.job?.kind).toBe("haul");
  expect(stationary.job?.kind).toBe("wander");
});
it("does not award unreachable construction or delivery to an isolated worker", () => {
  const game = world();
  game.colony["1,9"] = "corridor";
  const isolated = addUnit(game, "worker", { x: 1, y: 9 });
  egg(game, isolated.cell);
  game.blueprints["8,6"] = { tile: "corridor", progress: 0, workers: 0 };
  auction(game);
  expect(isolated.job).toBeNull();
  expect(isolated.route).toEqual([]);
});

it("resolves equal pickup-plus-delivery costs by target key for one worker", () => {
  const game = world();
  const worker = addUnit(game, "worker", { x: 11, y: 3 });
  egg(game, { x: 9, y: 3 });
  const right = egg(game, { x: 11, y: 3 });
  auction(game);
  expect(worker.job).toEqual({ kind: "haul", itemId: right.id, destination: { x: 6, y: 4 }, phase: "pickup" });
});
it("lets a worker build a corridor sideways from the room it stands in", () => {
  const game = world();
  game.colony["6,3"] = "nest";
  const worker = addUnit(game, "worker", { x: 6, y: 3 });
  expect(planBuild(game, 7, 3, "corridor")).toBeNull();
  auction(game);
  expect(worker.job).toEqual({ kind: "build", target: "7,3", stand: { x: 6, y: 3 } });
});
it("keeps a raider waiting for an unreachable opponent instead of leaving or starting colony patrol", () => {
  const game = world();
  game.units = [];
  game.colony["1,9"] = "nest";
  addUnit(game, "worker", { x: 1, y: 9 });
  const raider = addUnit(game, "warrior", { x: 0, y: 0 }, "raiders");
  auction(game, "raiders");
  expect(raider.job).toBeNull();
  expect(raider.route).toEqual([]);
});
