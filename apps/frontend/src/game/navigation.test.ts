import { expect, it } from "vitest";
import { ENTRANCE, HOME, isCell, point } from "./cells";
import { initialColony } from "./colony";
import { move, Navigation, position, setRoute } from "./navigation";
import { createUnit } from "./units";

it("routes between surface and nest through the protected entrance and respects room walls", () => {
  const nav = new Navigation(initialColony);
  expect(nav.route({ x: 7, y: 0 }, { x: 7, y: 2 })).toEqual([
    { x: 8, y: 0 },
    { x: 8, y: 1 },
    { x: 8, y: 2 },
    { x: 7, y: 2 },
  ]);
  expect(nav.route({ x: 6, y: 2 }, HOME)).toEqual([
    { x: 7, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 3 },
    { x: 9, y: 3 },
    { x: 10, y: 3 },
  ]);
  expect(new Navigation({ "1,2": "room", "1,3": "room" }).route({ x: 1, y: 2 }, { x: 1, y: 3 })).toBeNull();
  expect(nav.route(ENTRANCE, ENTRANCE)).toEqual([]);
  expect(nav.route(HOME, { x: 8, y: 6 })).toBeNull();
  expect(nav.route({ x: 3, y: 3 }, HOME)).toBeNull();
  expect(nav.route({ x: -2, y: 0 }, HOME)).toBeNull();
  expect(nav.route({ x: 18, y: 0 }, { x: -1, y: 0 })).toHaveLength(19);
});
it("keeps cached routes independent", () => {
  const nav = new Navigation(initialColony);
  const route = nav.route(ENTRANCE, HOME);
  route?.pop();
  expect(nav.route(ENTRANCE, HOME)).toHaveLength(4);
});
it("keeps logical cell occupancy until arrival and spends speed along square-cell edges", () => {
  const unit = createUnit(1, "worker", "colony", { x: 8, y: 2 });
  setRoute(unit, [
    { x: 8, y: 3 },
    { x: 9, y: 3 },
  ]);
  unit.speed = 2;
  move(unit, 0.75);
  expect(unit.cell).toEqual({ x: 8, y: 3 });
  expect(unit.travel).toBeCloseTo(0.5, 8);
  expect(position(unit)).toEqual({ x: 8.5, y: 3 });
  move(unit, 0.25);
  expect(unit.cell).toEqual({ x: 9, y: 3 });
  expect(unit.route).toEqual([]);
  expect(unit.travel).toBe(0);
  expect(position(unit)).toEqual(unit.cell);
});
it("continues an in-flight edge when redirected, and stops at an occupied cell without overshooting", () => {
  const nav = new Navigation(initialColony);
  const unit = createUnit(1, "scout", "colony", { x: 8, y: 2 });
  setRoute(unit, [{ x: 8, y: 3 }]);
  move(unit, 0.25);
  expect(unit.travel).toBeCloseTo(0.6, 8);
  setRoute(unit, nav.from(unit, { x: 8, y: 1 }) ?? []);
  expect(unit.route).toEqual([
    { x: 8, y: 3 },
    { x: 8, y: 2 },
    { x: 8, y: 1 },
  ]);
  expect(unit.travel).toBeCloseTo(0.6, 8);
  move(unit, 10, (ant) => ant.cell.y === 3);
  expect(unit.cell).toEqual({ x: 8, y: 3 });
  expect(unit.travel).toBe(0);
});
it("validates integer cells including both bounds", () => {
  for (const [x, y] of [
    [0, 0],
    [17, 10],
  ])
    expect(isCell(x ?? -1, y ?? -1)).toBe(true);
  for (const [x, y] of [
    [-1, 0],
    [18, 0],
    [0, -1],
    [0, 11],
    [0.5, 2],
    [0, 1.5],
    [NaN, 0],
  ])
    expect(isCell(x ?? -1, y ?? -1)).toBe(false);
  expect(point("17,10")).toEqual({ x: 17, y: 10 });
  expect(() => point("broken")).toThrow();
});

it("walls a room off from a vertical corridor in both directions, but never opens a second surface entrance", () => {
  const nav = new Navigation({ "8,1": "corridor", "8,2": "room", "7,1": "corridor", "7,2": "corridor" });
  expect(nav.route({ x: 8, y: 1 }, { x: 8, y: 2 })).toEqual([
    { x: 7, y: 1 },
    { x: 7, y: 2 },
    { x: 8, y: 2 },
  ]);
  expect(nav.route({ x: 8, y: 2 }, { x: 8, y: 1 })).toEqual([
    { x: 7, y: 2 },
    { x: 7, y: 1 },
    { x: 8, y: 1 },
  ]);
  expect(nav.route({ x: 7, y: 0 }, { x: 7, y: 1 })).toEqual([
    { x: 8, y: 0 },
    { x: 8, y: 1 },
    { x: 7, y: 1 },
  ]);
});
it("interpolates vertical travel and resets partial travel when a route is explicitly cleared", () => {
  const unit = createUnit(1, "worker", "colony", { x: 8, y: 2 });
  setRoute(unit, [{ x: 8, y: 3 }]);
  move(unit, 0.2);
  expect(position(unit).y).toBeCloseTo(2.3, 8);
  expect(unit.heading).toBeCloseTo(Math.PI / 2, 8);
  setRoute(unit, []);
  expect(unit.travel).toBe(0);
  expect(position(unit)).toEqual({ x: 8, y: 2 });
  setRoute(unit, [{ x: 7, y: 2 }]);
  move(unit, 0);
  expect(unit.travel).toBe(0);
  move(unit, 0.2);
  expect(unit.heading).toBeCloseTo(Math.PI, 8);
});

it.each(["1.5,2", "1,1.5", "1", "bad,2", "1,bad"])("rejects malformed cell identifiers (%s)", (id) => {
  expect(() => point(id)).toThrow(/Invalid cell/);
});

it("rejects soil-to-itself paths and vertical room walls even on the entrance column", () => {
  expect(new Navigation(initialColony).route({ x: 0, y: 9 }, { x: 0, y: 9 })).toBeNull();
  expect(new Navigation({ "8,3": "room", "8,4": "room" }).route({ x: 8, y: 3 }, { x: 8, y: 4 })).toBeNull();
});
it("can replace a pending route before any distance is traveled", () => {
  const unit = createUnit(1, "worker", "colony", { x: 8, y: 2 });
  unit.route = [{ x: 8, y: 3 }];
  expect(new Navigation(initialColony).from(unit, { x: 8, y: 1 })).toEqual([{ x: 8, y: 1 }]);
});
