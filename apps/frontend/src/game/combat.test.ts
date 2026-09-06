import { expect, it } from "vitest";
import { contacts, fight } from "./combat";
import { createUnit } from "./units";

it("uses factions independently of roles, targets one opponent and applies lethal damage simultaneously", () => {
  const ours = createUnit(8, "worker", "colony", { x: 2, y: 0 });
  const first = createUnit(2, "worker", "raiders", ours.cell);
  const second = createUnit(3, "worker", "raiders", ours.cell);
  const units = [second, ours, first];
  fight(units, 0.45);
  expect(units.map((u) => u.hp)).toEqual([1, 1, 1]);
  fight(units, 0.05);
  expect([ours.hp, first.hp, second.hp]).toEqual([0, 0, 1]);
});
it("uses individual bite strength and does not attack a different cell or friendly role", () => {
  const warrior = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  warrior.bite = 2;
  const scout = createUnit(2, "scout", "colony", warrior.cell);
  const enemy = createUnit(3, "warrior", "raiders", { x: 8, y: 3 });
  fight([warrior, scout, enemy], 0.5);
  expect([warrior.hp, scout.hp, enemy.hp]).toEqual([3, 2, 3]);
  enemy.cell = warrior.cell;
  fight([warrior, enemy], 0.5);
  expect([warrior.hp, enemy.hp]).toEqual([2, 1]);
});
it("includes the queen in contact and excludes dead units and scouts away on expeditions", () => {
  const queen = createUnit(0, "queen", "colony", { x: 10, y: 3 });
  const enemy = createUnit(1, "warrior", "raiders", queen.cell);
  const scout = createUnit(2, "scout", "colony", queen.cell);
  scout.job = { kind: "forage", phase: "away", exit: { x: -1, y: 0 }, remaining: 5 };
  expect(contacts([queen, enemy, scout]).has(scout.id)).toBe(false);
  fight([queen, enemy, scout], 0.5);
  expect([queen.hp, enemy.hp, scout.hp]).toEqual([9, 2, 2]);
  queen.hp = 0;
  expect(contacts([queen, enemy, scout]).size).toBe(0);
  fight([queen, enemy, scout], 10);
  expect(queen.hp).toBe(0);
});
it("heals by one after ten peaceful seconds, caps at maximum and resets both clocks on contact changes", () => {
  const ours = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "warrior", "raiders", { x: 8, y: 3 });
  ours.hp = 1;
  for (let i = 0; i < 199; i++) fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(1);
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(2);
  fight([ours, enemy], 9.95);
  enemy.cell = ours.cell;
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(2);
  expect(ours.healWait).toBe(0);
  enemy.cell = { x: 8, y: 3 };
  fight([ours, enemy], 9.95);
  expect(ours.hp).toBe(2);
  expect(ours.attackWait).toBe(0);
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(3);
  fight([ours, enemy], 20);
  expect(ours.hp).toBe(3);
  expect(ours.healWait).toBe(0);
});

it("keeps consecutive attack cadence and healed progress between hits without favoring array order", () => {
  const ours = createUnit(10, "queen", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "queen", "raiders", ours.cell);
  const friend = createUnit(1, "queen", "colony", ours.cell);
  const units = [ours, enemy, friend];
  for (let i = 0; i < 19; i++) fight(units, 0.05);
  expect([ours.hp, friend.hp, enemy.hp]).toEqual([10, 9, 8]);
  fight(units, 0.05);
  expect([ours.hp, friend.hp, enemy.hp]).toEqual([10, 8, 6]);
  expect(enemy.attackWait).toBeCloseTo(0, 8);
});

it("retains fractional time across repeated hits and heals for short steps that do not divide the period", () => {
  const ours = createUnit(1, "queen", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "queen", "raiders", ours.cell);
  for (let i = 0; i < 50; i++) fight([ours, enemy], 0.03);
  expect([ours.hp, enemy.hp]).toEqual([7, 7]);
  const wounded = createUnit(3, "warrior", "colony", { x: 8, y: 3 });
  wounded.hp = 1;
  for (let i = 0; i < 666; i++) fight([wounded], 0.03);
  expect(wounded.hp).toBe(2);
  fight([wounded], 0.03);
  expect(wounded.hp).toBe(3);
});
it("does not bank healing while full, including after returning to maximum health", () => {
  const unit = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  fight([unit], 9);
  expect(unit.healWait).toBe(0);
  unit.hp = 2;
  fight([unit], 9.95);
  expect(unit.hp).toBe(2);
  fight([unit], 0.1);
  expect(unit.hp).toBe(3);
  expect(unit.healWait).toBe(0);
});
