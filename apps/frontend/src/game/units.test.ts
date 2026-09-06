import { expect, it } from "vitest";
import { createUnit, spawnCost, traits } from "./units";

it("describes every role by its combat parameters, stance, flee threshold and allowed jobs", () => {
  expect(Object.keys(traits)).toEqual(["worker", "scout", "warrior", "queen", "beetle", "spider"]);
  expect(Object.keys(spawnCost)).toEqual(["worker", "scout", "warrior"]);
  expect(traits.beetle).toEqual({
    hp: 80,
    bite: 6,
    speed: 1,
    stance: "fight",
    flee: 0,
    surface: false,
    jobs: ["attack"],
  });
  expect(traits.spider).toEqual({
    hp: 40,
    bite: 5,
    speed: 1,
    stance: "fight",
    flee: 0,
    surface: true,
    jobs: ["attack", "guard", "leave"],
  });
  expect(Object.values(traits).filter((role) => role.surface)).toEqual([traits.spider]);
  expect(traits.queen.jobs).toEqual(["nest"]);
  expect(traits.warrior.hp).toBe(24);
  expect(traits.beetle.hp).toBeGreaterThan(traits.warrior.hp);
  expect(traits.beetle.bite).toBeGreaterThan(traits.warrior.bite);
  expect(traits.beetle.speed).toBeLessThan(traits.warrior.speed);
});
it("copies the role parameters into a new unit", () => {
  const beetle = createUnit(7, "beetle", "raiders", { x: 1, y: 0 });
  expect([beetle.hp, beetle.maxHp, beetle.bite, beetle.speed]).toEqual([80, 80, 6, 1]);
  expect([beetle.faction, beetle.role, beetle.fleeing, beetle.job]).toEqual(["raiders", "beetle", false, null]);
  const spider = createUnit(8, "spider", "raiders", { x: 1, y: 0 });
  expect([spider.hp, spider.maxHp, spider.bite, spider.speed]).toEqual([40, 40, 5, 1]);
  expect([spider.faction, spider.role, spider.fleeing, spider.job]).toEqual(["raiders", "spider", false, null]);
});
