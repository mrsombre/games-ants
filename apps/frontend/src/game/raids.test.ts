import { expect, it } from "vitest";
import type { GameEvent } from "./model";
import { advanceAttack } from "./raids";
import { world } from "./test-support";

it.each([0, 0.999])(
  "schedules bounded raids, limits the first wave and stages both factions' unit roles (%s)",
  (roll) => {
    const game = world();
    game.maxEnemies = 7;
    game.attackTimer = 0.1;
    const events: GameEvent[] = [];
    advanceAttack(game, 0.05, () => roll, events);
    expect(events).toEqual([]);
    advanceAttack(game, 0.05, () => roll, events);
    const enemies = game.units.filter((unit) => unit.faction === "raiders");
    expect(enemies).toHaveLength(roll === 0 ? 1 : 2);
    expect(enemies.every((unit) => unit.cell.y === 0 && unit.cell.x === (roll === 0 ? -1 : 18))).toBe(true);
    expect(enemies[0]?.role).toBe("worker");
    expect(game.attackTimer).toBeCloseTo(120 + 480 * roll, 8);
    expect(events).toEqual([{ kind: "attack-started", count: roll === 0 ? 1 : 2 }]);
    game.attackTimer = 0;
    advanceAttack(game, 0.05, () => roll, events);
    expect(game.units.filter((unit) => unit.faction === "raiders")).toHaveLength(roll === 0 ? 2 : 9);
    expect(game.raidsStarted).toBe(2);
    if (roll > 0)
      expect(
        game.units
          .filter((unit) => unit.faction === "raiders")
          .slice(2)
          .map((unit) => unit.role),
      ).toEqual(["worker", "warrior", "worker", "warrior", "worker", "warrior", "worker"]);
  },
);
it("does not create phantom enemies when raids are disabled", () => {
  const game = world();
  game.maxEnemies = 0;
  game.attackTimer = 0;
  const events: GameEvent[] = [];
  advanceAttack(game, 0.05, () => 0.5, events);
  expect(game.units).toHaveLength(1);
  expect(events).toEqual([]);
  expect(game.raidsStarted).toBe(0);
});

it("includes both workers and warriors and uses the right edge at the exact random boundary", () => {
  const game = world();
  game.attackTimer = 0;
  const events: GameEvent[] = [];
  advanceAttack(game, 0.05, () => 0.5, events);
  const enemies = game.units.filter((unit) => unit.faction === "raiders");
  expect(enemies.map((unit) => unit.role)).toEqual(["worker", "warrior"]);
  expect(enemies.map((unit) => unit.cell)).toEqual([
    { x: 18, y: 0 },
    { x: 18, y: 0 },
  ]);
});
