import { expect, it } from "vitest";
import { contacts, fight } from "./combat";
import { createUnit } from "./units";

it("uses factions independently of roles, targets one opponent and applies lethal damage simultaneously", () => {
  const ours = createUnit(8, "worker", "colony", { x: 2, y: 0 });
  const first = createUnit(2, "worker", "raiders", ours.cell);
  const second = createUnit(3, "worker", "raiders", ours.cell);
  ours.hp = 2;
  first.hp = 1;
  const units = [second, ours, first];
  fight(units, 0.95);
  expect(units.map((u) => u.hp)).toEqual([8, 2, 1]);
  fight(units, 0.05);
  expect([ours.hp, first.hp, second.hp]).toEqual([0, 0, 8]);
});
it("uses individual bite strength and does not attack a different cell or friendly role", () => {
  const warrior = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  warrior.bite = 2;
  const scout = createUnit(2, "scout", "colony", warrior.cell);
  const enemy = createUnit(3, "warrior", "raiders", { x: 8, y: 3 });
  fight([warrior, scout, enemy], 1);
  expect([warrior.hp, scout.hp, enemy.hp]).toEqual([24, 10, 24]);
  enemy.cell = warrior.cell;
  fight([warrior, enemy], 1);
  expect([warrior.hp, enemy.hp]).toEqual([20, 22]);
});
it("includes the queen in contact and excludes dead units and scouts away on expeditions", () => {
  const queen = createUnit(0, "queen", "colony", { x: 10, y: 3 });
  const enemy = createUnit(1, "warrior", "raiders", queen.cell);
  const scout = createUnit(2, "scout", "colony", queen.cell);
  scout.job = { kind: "forage", phase: "away", exit: { x: -1, y: 0 }, remaining: 5 };
  expect(contacts([queen, enemy, scout]).has(scout.id)).toBe(false);
  fight([queen, enemy, scout], 1);
  expect([queen.hp, enemy.hp, scout.hp]).toEqual([20, 20, 10]);
  queen.hp = 0;
  expect(contacts([queen, enemy, scout]).size).toBe(0);
  fight([queen, enemy, scout], 10);
  expect(queen.hp).toBe(0);
});
it("heals by one after two peaceful seconds, caps at maximum and resets both clocks on contact changes", () => {
  const ours = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "warrior", "raiders", { x: 8, y: 3 });
  ours.hp = 22;
  for (let i = 0; i < 39; i++) fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(22);
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(23);
  fight([ours, enemy], 1.95);
  enemy.cell = ours.cell;
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(23);
  expect(ours.healWait).toBe(0);
  enemy.cell = { x: 8, y: 3 };
  fight([ours, enemy], 1.95);
  expect(ours.hp).toBe(23);
  expect(ours.attackWait).toBe(0);
  fight([ours, enemy], 0.05);
  expect(ours.hp).toBe(24);
  fight([ours, enemy], 20);
  expect(ours.hp).toBe(24);
  expect(ours.healWait).toBe(0);
});

it("keeps consecutive attack cadence and healed progress between hits without favoring array order", () => {
  const ours = createUnit(10, "queen", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "queen", "raiders", ours.cell);
  const friend = createUnit(1, "queen", "colony", ours.cell);
  const units = [ours, enemy, friend];
  for (let i = 0; i < 39; i++) fight(units, 0.05);
  expect([ours.hp, friend.hp, enemy.hp]).toEqual([24, 20, 16]);
  fight(units, 0.05);
  expect([ours.hp, friend.hp, enemy.hp]).toEqual([24, 16, 8]);
  expect(enemy.attackWait).toBeCloseTo(0, 8);
});

it("retains fractional time across repeated hits and heals for short steps that do not divide the period", () => {
  const ours = createUnit(1, "queen", "colony", { x: 8, y: 2 });
  const enemy = createUnit(2, "queen", "raiders", ours.cell);
  for (let i = 0; i < 100; i++) fight([ours, enemy], 0.03);
  expect([ours.hp, enemy.hp]).toEqual([12, 12]);
  const wounded = createUnit(3, "warrior", "colony", { x: 8, y: 3 });
  wounded.hp = 1;
  for (let i = 0; i < 66; i++) fight([wounded], 0.03);
  expect(wounded.hp).toBe(1);
  fight([wounded], 0.03);
  expect(wounded.hp).toBe(2);
  for (let i = 0; i < 66; i++) fight([wounded], 0.03);
  expect(wounded.hp).toBe(2);
  fight([wounded], 0.03);
  expect(wounded.hp).toBe(3);
});
it("does not bank healing while full, including after returning to maximum health", () => {
  const unit = createUnit(1, "warrior", "colony", { x: 8, y: 2 });
  fight([unit], 9);
  expect(unit.healWait).toBe(0);
  unit.hp = 23;
  fight([unit], 1.95);
  expect(unit.hp).toBe(23);
  fight([unit], 0.1);
  expect(unit.hp).toBe(24);
  expect(unit.healWait).toBe(0);
});
