import { describe, expect, it } from "vitest";
import { COLS } from "./colony";
import { advanceAttack, fight } from "./combat";
import { type Enemy, type Game, type GameEvent, HOME, roles, SURFACE_EXIT } from "./model";
import { createGame, stepGame } from "./simulation";
import { spawnableEggs, startSpawn } from "./spawning";

function enemy(game: Game, x = 8, y = 2, hp = 3): Enemy {
  const result: Enemy = {
    id: game.nextId++,
    role: "enemy",
    targetEggId: null,
    x,
    y,
    hp,
    attackWait: 0,
    healWait: 0,
    route: [],
    heading: 0,
    wandering: false,
    wanderWait: 0,
  };
  game.enemies.push(result);
  return result;
}
function advance(game: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) stepGame(game, 0.05, () => 0.5);
}

describe("raids and combat", () => {
  it.each([0, 0.999999])("schedules random raids and spawns 1–N enemies beyond either edge (%s)", (rng) => {
    const game = createGame(() => rng);
    expect(game.attackTimer).toBeCloseTo(120 + rng * 480);
    game.maxEnemies = 7;
    game.attackTimer = 0.05;
    const events: GameEvent[] = [];
    advanceAttack(game, 0.05, () => rng, events);
    const count = rng === 0 ? 1 : 2;
    expect(game.enemies).toHaveLength(count);
    expect(game.enemies.every((ant) => ant.x < 0 || ant.x >= COLS)).toBe(true);
    expect(events).toEqual([{ kind: "attack-started", count }]);
    expect(game.attackTimer).toBeCloseTo(120 + rng * 480);
    expect(game.raidsStarted).toBe(1);
    game.enemies = [];
    game.attackTimer = 0;
    advanceAttack(game, 0.05, () => rng, events);
    expect(game.enemies).toHaveLength(rng === 0 ? 1 : 7);
    expect(game.raidsStarted).toBe(2);
  });

  it.each(["worker", "scout", "warrior"] as const)(
    "exchanges simultaneous 1 HP hits every 500 ms with a %s",
    (role) => {
      const game = createGame();
      game.ants = game.ants.filter((ant) => ant.role === role).slice(0, 1);
      const ant = game.ants[0];
      if (!ant) throw new Error("missing ant");
      Object.assign(ant, { x: 8, y: 2 });
      const attacker = enemy(game);
      const events: GameEvent[] = [];
      for (let i = 0; i < 9; i++) stepGame(game, 0.05);
      expect(ant.hp).toBe(roles[role].hp);
      expect(attacker.hp).toBe(3);
      stepGame(game, 0.05);
      expect(ant.hp).toBe(roles[role].hp - 1);
      expect(attacker.hp).toBe(2);
      for (let i = 0; i < (roles[role].hp - 1) * 10; i++) events.push(...stepGame(game, 0.05));
      expect(game.ants).toHaveLength(0);
      expect(attacker.hp).toBe(3 - roles[role].hp);
      if (role === "warrior") {
        expect(game.enemies).toHaveLength(0);
        expect(events).toContainEqual({ kind: "attack-ended" });
      }
    },
  );

  it("strikes only one opponent per creature and excludes away scouts", () => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "scout");
    const scout = game.ants[0];
    if (scout?.role !== "scout") throw new Error("missing scout");
    Object.assign(scout, { x: 8, y: 2, phase: "away" });
    const first = enemy(game);
    const second = enemy(game);
    fight(game, 0.5, []);
    expect(scout.hp).toBe(2);
    scout.phase = "home";
    fight(game, 0.5, []);
    expect(first.hp).toBe(2);
    expect(second.hp).toBe(3);
    expect(game.ants).toHaveLength(0);
  });

  it("sends warriors out to intercept enemies before they enter the nest", () => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "warrior");
    const warrior = game.ants[0];
    if (!warrior) throw new Error("missing warrior");
    Object.assign(warrior, HOME);
    const attacker = enemy(game, -1, SURFACE_EXIT.y);
    advance(game, 5);
    expect(warrior.y).toBeLessThan(0);
    advance(game, 5);
    expect(attacker.hp).toBeLessThan(3);
    expect(attacker.y).toBeLessThan(0);
  });

  it("posts workers along the queen's approach, suspends work, then resumes it", () => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "worker");
    for (const ant of game.ants) Object.assign(ant, HOME);
    game.blueprints["8,5"] = { tile: "corridor", progress: 0, workers: 0 };
    const attacker = enemy(game, -100, SURFACE_EXIT.y);
    advance(game, 6);
    expect(game.ants.map((ant) => [ant.x, ant.y])).toEqual([
      [8, 2],
      [8, 1],
      [8, 0],
    ]);
    advance(game, 2);
    expect(game.ants.every((ant) => ant.route.length === 0)).toBe(true);
    expect(game.blueprints["8,5"]?.progress).toBe(0);
    attacker.hp = 0;
    fight(game, 0.05, []);
    advance(game, 6);
    expect(game.blueprints["8,5"]?.progress).toBeGreaterThan(0);
  });

  it("enemies stop at defenders and cannot pass them alive", () => {
    const game = createGame();
    game.ants = game.ants.filter((ant) => ant.role === "worker").slice(0, 1);
    const worker = game.ants[0];
    if (!worker) throw new Error("missing worker");
    Object.assign(worker, { x: 8, y: 2 });
    const attacker = enemy(game, 8, 1);
    advance(game, 0.7);
    expect(worker.hp).toBe(1);
    expect(attacker.y).toBeLessThan(2);
    advance(game, 0.2);
    expect(game.ants).toHaveLength(0);
    expect(attacker.hp).toBe(2);
  });

  it("resumes egg delivery after defending and keeps the carrier linked during the raid", () => {
    const game = createGame();
    const worker = game.ants.find((ant) => ant.role === "worker");
    if (!worker) throw new Error("missing worker");
    game.ants = [worker];
    Object.assign(worker, HOME);
    worker.task = { kind: "carry-egg", eggId: 1, destination: "6,1", phase: "delivery" };
    game.eggs = [{ id: 1, location: { carrier: worker.id } }];
    const attacker = enemy(game, -100, SURFACE_EXIT.y);
    advance(game, 4);
    expect([worker.x, worker.y]).toEqual([8, 2]);
    expect(game.eggs[0]?.location).toEqual({ carrier: worker.id });
    attacker.hp = 0;
    fight(game, 0.05, []);
    advance(game, 4);
    expect(game.eggs).toContainEqual({ id: 1, location: { cell: "6,1" } });
  });

  it("drops eggs carried by killed workers", () => {
    const game = createGame();
    const worker = game.ants.find((ant) => ant.role === "worker");
    if (!worker) throw new Error("missing worker");
    game.ants = [worker];
    game.eggs = [{ id: 1, location: { carrier: worker.id } }];
    enemy(game, worker.x, worker.y);
    advance(game, 0.5);
    expect(game.eggs).toContainEqual({ id: 1, location: { cell: `${worker.x},${worker.y}` } });
  });
});

it("scouts at home intercept enemies instead of starting an expedition", () => {
  const game = createGame();
  const scout = game.ants.find((ant) => ant.role === "scout");
  if (!scout) throw new Error("missing scout");
  game.ants = [scout];
  Object.assign(scout, HOME);
  const attacker = enemy(game, -1, SURFACE_EXIT.y);
  advance(game, 4);
  expect(scout.phase).toBe("home");
  expect(scout.y).toBeLessThan(0);
  advance(game, 3);
  expect(attacker.hp).toBeLessThan(3);
});

it("a returning scout loses cargo on contact before the first hit and resumes foraging after victory", () => {
  const game = createGame();
  const scout = game.ants.find((ant) => ant.role === "scout");
  if (!scout) throw new Error("missing scout");
  game.ants = [scout];
  Object.assign(scout, {
    x: 8,
    y: -0.7,
    phase: "returning",
    cargo: "caterpillar",
    route: [{ x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 9, y: 2 }, HOME],
  });
  enemy(game, 8, -0.7, 1);
  const food = game.food;
  stepGame(game, 0.05);
  expect(scout.cargo).toBeNull();
  expect(scout.hp).toBe(2);
  expect(scout.phase).toBe("home");
  advance(game, 0.45);
  expect(game.enemies).toHaveLength(0);
  expect(scout.hp).toBe(1);
  expect(game.food).toBe(food);
  advance(game, 5);
  expect(scout.phase).toBe("outbound");
  expect(game.deliveries).toBe(0);
});

it("returning scouts keep cargo until contact and away scouts continue their expedition", () => {
  const game = createGame();
  const scout = game.ants.find((ant) => ant.role === "scout");
  if (!scout) throw new Error("missing scout");
  game.ants = [scout];
  Object.assign(scout, { x: -10, y: -0.7, phase: "away", away: 1 });
  enemy(game, -10, -0.7);
  advance(game, 0.5);
  expect(scout.hp).toBe(2);
  expect(scout.away).toBeCloseTo(0.5);
  Object.assign(scout, { ...HOME, phase: "returning", cargo: "apple", route: [] });
  stepGame(game, 0.05);
  expect(game.food).toBe(3);
  expect(game.deliveries).toBe(1);
});

it("reserves different reachable eggs before attacking the queen", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [
    { id: 1, location: { cell: "9,2" } },
    { id: 2, location: { cell: "11,2" } },
  ];
  const first = enemy(game);
  const second = enemy(game);
  const third = enemy(game);
  stepGame(game, 0.05);
  expect(new Set([first.targetEggId, second.targetEggId])).toEqual(new Set([1, 2]));
  expect(third.targetEggId).toBeNull();
  expect(third.route.at(-1)).toEqual(HOME);
});

it("steals an egg, carries it out and ends the raid without hurting the queen", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [{ id: 1, location: { cell: "9,2" } }];
  const thief = enemy(game, 9, 2);
  stepGame(game, 0.05);
  expect(game.eggs[0]?.location).toEqual({ carrier: thief.id });
  const events: GameEvent[] = [];
  for (let i = 0; i < 240; i++) events.push(...stepGame(game, 0.05));
  expect(game.enemies).toHaveLength(0);
  expect(game.eggs).toHaveLength(0);
  expect(game.queen.hp).toBe(10);
  expect(events).toContainEqual({ kind: "attack-ended" });
});

it("drops stolen eggs immediately on contact and fights instead of escaping", () => {
  const game = createGame();
  const warrior = game.ants.find((ant) => ant.role === "warrior");
  if (!warrior) throw new Error("missing warrior");
  game.ants = [warrior];
  Object.assign(warrior, { x: 8, y: -0.7 });
  const thief = enemy(game, 8, -0.7);
  thief.targetEggId = 1;
  game.eggs = [{ id: 1, location: { carrier: thief.id } }];
  stepGame(game, 0.05);
  expect(game.eggs[0]?.location).toEqual({ cell: "8,-1" });
  expect(thief.targetEggId).toBeNull();
  expect(thief.hp).toBe(3);
  advance(game, 0.45);
  expect(thief.hp).toBe(2);
  expect(warrior.hp).toBe(2);
  expect(thief.x).toBe(8);
});

it("releases stale egg reservations and chooses another egg", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [
    { id: 1, location: { cell: "9,2" } },
    { id: 2, location: { cell: "11,2" } },
  ];
  const thief = enemy(game);
  stepGame(game, 0.05);
  expect(thief.targetEggId).toBe(1);
  game.eggs = game.eggs.filter((egg) => egg.id !== 1);
  stepGame(game, 0.05);
  expect(thief.targetEggId).toBe(2);
});

it("ignores unreachable eggs and exchanges simultaneous hits with the queen", () => {
  const game = createGame();
  game.ants = [];
  game.colony["1,8"] = "room";
  game.eggs = [{ id: 1, location: { cell: "1,8" } }];
  const attacker = enemy(game, HOME.x, HOME.y);
  advance(game, 0.45);
  expect(game.queen.hp).toBe(10);
  expect(attacker.targetEggId).toBeNull();
  advance(game, 0.05);
  expect(game.queen.hp).toBe(9);
  expect(attacker.hp).toBe(2);
  advance(game, 1);
  expect(game.queen.hp).toBe(7);
  expect(game.enemies).toHaveLength(0);
});

it("steals an egg beyond the queen without stopping to fight her", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [{ id: 1, location: { cell: "11,2" } }];
  const thief = enemy(game, HOME.x, HOME.y);
  advance(game, 1);
  expect(game.eggs[0]?.location).toEqual({ carrier: thief.id });
  expect(game.queen.hp).toBe(10);
  expect(thief.hp).toBe(3);
});

it("stops laying eggs after the queen dies and emits her death once", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [];
  game.queen.hp = 1;
  const attacker = enemy(game, HOME.x, HOME.y);
  const events: GameEvent[] = [];
  for (let i = 0; i < 10; i++) events.push(...stepGame(game, 0.05));
  expect(game.queen.hp).toBe(0);
  expect(attacker.hp).toBe(2);
  for (let i = 0; i < 700; i++) events.push(...stepGame(game, 0.05));
  expect(game.eggs).toHaveLength(0);
  expect(events.filter((event) => event.kind === "queen-died")).toHaveLength(1);
});

it("prevents new hatch orders for reserved eggs and cancels hatching when stolen", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [{ id: 1, location: { cell: "9,2" } }];
  expect(startSpawn(game, "worker")).toBe(true);
  const thief = enemy(game, 9, 2);
  stepGame(game, 0.05);
  expect(game.eggs[0]?.location).toEqual({ carrier: thief.id });
  expect(game.spawns).toHaveLength(0);
  advance(game, 10);
  expect(game.ants).toHaveLength(0);
  game.eggs = [{ id: 2, location: { cell: "11,2" } }];
  const nextThief = enemy(game);
  nextThief.targetEggId = 2;
  expect(spawnableEggs(game)).toHaveLength(0);
  nextThief.targetEggId = null;
  expect(spawnableEggs(game)).toHaveLength(1);
});

it("lets another thief reserve an egg dropped on the surface", () => {
  const game = createGame();
  game.ants = [];
  game.eggs = [{ id: 1, location: { cell: "8,-1" } }];
  const thief = enemy(game, 8, -0.7);
  expect(spawnableEggs(game)).toHaveLength(0);
  stepGame(game, 0.05);
  expect(game.eggs[0]?.location).toEqual({ carrier: thief.id });
});

it("heals wounded units and the queen by 1 HP per ten seconds without exceeding maximum HP", () => {
  const game = createGame();
  const warrior = game.ants.find((ant) => ant.role === "warrior");
  const scout = game.ants.find((ant) => ant.role === "scout");
  if (!warrior || !scout) throw new Error("missing ants");
  game.ants = [warrior, scout];
  warrior.hp = 1;
  Object.assign(scout, { hp: 1, phase: "away", x: -100, y: -0.7 });
  game.queen.hp = 8;
  const attacker = enemy(game, -100, -0.7, 1);
  for (let i = 0; i < 199; i++) fight(game, 0.05, []);
  expect([warrior.hp, scout.hp, attacker.hp, game.queen.hp]).toEqual([1, 1, 1, 8]);
  fight(game, 0.05, []);
  expect([warrior.hp, scout.hp, attacker.hp, game.queen.hp]).toEqual([2, 2, 2, 9]);
  for (let i = 0; i < 400; i++) fight(game, 0.05, []);
  expect([warrior.hp, scout.hp, attacker.hp, game.queen.hp]).toEqual([3, 2, 3, 10]);
});

it("resets healing on contact, including before the first hit, and requires ten fresh seconds", () => {
  const game = createGame();
  const warrior = game.ants.find((ant) => ant.role === "warrior");
  if (!warrior) throw new Error("missing warrior");
  game.ants = [warrior];
  warrior.hp = 2;
  for (let i = 0; i < 199; i++) fight(game, 0.05, []);
  const attacker = enemy(game, warrior.x, warrior.y);
  fight(game, 0.05, []);
  expect(warrior.hp).toBe(2);
  expect(warrior.healWait).toBe(0);
  attacker.x = -100;
  attacker.y = -0.7;
  for (let i = 0; i < 199; i++) fight(game, 0.05, []);
  expect(warrior.hp).toBe(2);
  fight(game, 0.05, []);
  expect(warrior.hp).toBe(3);
});

it("never revives the dead queen through healing", () => {
  const game = createGame();
  game.queen.hp = 0;
  for (let i = 0; i < 400; i++) fight(game, 0.05, []);
  expect(game.queen.hp).toBe(0);
});
