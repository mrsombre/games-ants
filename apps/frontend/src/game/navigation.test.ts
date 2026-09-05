import { expect, it } from "vitest";
import { initialColony } from "./colony";
import type { Worker } from "./model";
import { move, routeTo } from "./navigation";

it("routes through the shaft instead of crossing a vertical room wall", () => {
  expect(routeTo(initialColony, { x: 6, y: 1 }, { x: 10, y: 2 })).toEqual([
    { x: 7, y: 1 },
    { x: 8, y: 1 },
    { x: 8, y: 2 },
    { x: 9, y: 2 },
    { x: 10, y: 2 },
  ]);
  expect(routeTo(initialColony, { x: 8, y: 0 }, { x: 8, y: 0 })).toEqual([]);
  expect(routeTo(initialColony, { x: 8, y: 0 }, { x: 8, y: 5 })).toBeNull();
});

it("spends movement distance along waypoints without cutting corners or overshooting", () => {
  const ant: Worker = {
    id: 1,
    role: "worker",
    x: 8,
    y: 1,
    heading: 0,
    target: null,
    working: false,
    route: [
      { x: 8, y: 2 },
      { x: 9, y: 2 },
    ],
  };
  move(ant, 1);
  expect([ant.x, ant.y]).toEqual([8.5, 2]);
  expect(ant.route).toEqual([{ x: 9, y: 2 }]);
  move(ant, 10);
  expect([ant.x, ant.y]).toEqual([9, 2]);
  expect(ant.route).toEqual([]);
});
