import { expect, it } from "vitest";
import { key } from "./cells";
import { demolish } from "./demolition";
import { queenOf } from "./model";
import { Navigation, position } from "./navigation";
import { addUnit, advance, world } from "./test-support";
import { performJob } from "./work";

function dig(game: ReturnType<typeof world>, cells: readonly (readonly [number, number])[], tile: "corridor" | "room") {
  for (const [x, y] of cells) game.colony[key(x, y)] = tile;
}
const shaft = [
  [8, 6],
  [8, 7],
  [8, 8],
  [8, 9],
  [8, 10],
] as const;
const midRoom = [
  [9, 5],
  [10, 5],
  [11, 5],
] as const;
function queen(game: ReturnType<typeof world>) {
  const unit = queenOf(game);
  if (!unit) throw new Error("queen");
  return unit;
}

it("moves to the room nearest the middle depth after the first three minutes, at a quarter cell per second", () => {
  const game = world();
  dig(game, shaft, "corridor");
  dig(game, midRoom, "room");
  advance(game, 179.95);
  expect(queen(game).job).toBeNull();
  expect(queen(game).cell).toEqual({ x: 10, y: 3 });
  advance(game, 0.05);
  expect(queen(game).job).toEqual({ kind: "nest", destination: { x: 10, y: 5 } });
  advance(game, 1.95);
  expect(position(queen(game))).toEqual({ x: 9.5, y: 3 });
  expect(demolish(game, 11, 5)).toMatch(/матки/);
  advance(game, 22);
  expect(queen(game).cell).toEqual({ x: 10, y: 5 });
  expect(queen(game).job?.kind).toBe("nest");
  advance(game, 0.05);
  expect(queen(game).job).toBeNull();
  expect(game.nestTimer).toBe(0);
  advance(game, 180);
  expect(queen(game).cell).toEqual({ x: 10, y: 5 });
});
it("stays put for rooms narrower than three cells or equally far from the middle, and moves as soon as a better one appears", () => {
  const game = world();
  dig(game, shaft, "corridor");
  dig(
    game,
    [
      [9, 6],
      [10, 6],
      [11, 6],
    ],
    "room",
  );
  dig(
    game,
    [
      [9, 5],
      [10, 5],
    ],
    "room",
  );
  advance(game, 200);
  expect(queen(game).job).toBeNull();
  expect(queen(game).cell).toEqual({ x: 10, y: 3 });
  game.colony["11,5"] = "room";
  advance(game, 0.05);
  expect(queen(game).job).toEqual({ kind: "nest", destination: { x: 10, y: 5 } });
});
it("resumes the move after a fight interrupts it and receives food at the new seat", () => {
  const game = world();
  dig(game, shaft, "corridor");
  dig(game, midRoom, "room");
  advance(game, 180);
  expect(queen(game).job?.kind).toBe("nest");
  game.items = [];
  const raider = addUnit(game, "worker", { x: 9, y: 3 }, "raiders");
  advance(game, 1.05);
  expect(queen(game).cell).toEqual({ x: 10, y: 3 });
  expect([queen(game).job, queen(game).route]).toEqual([null, []]);
  advance(game, 3);
  expect(game.units).not.toContain(raider);
  expect([queen(game).job, game.items]).toEqual([null, []]);
  advance(game, 27.05);
  expect(game.items).toHaveLength(1);
  expect(queen(game).job).toEqual({ kind: "nest", destination: { x: 10, y: 5 } });
  advance(game, 24);
  expect(queen(game).cell).toEqual({ x: 10, y: 5 });
  const scout = addUnit(game, "scout", { x: 8, y: 3 });
  scout.job = { kind: "forage", phase: "returning", exit: { x: -1, y: 0 }, remaining: 0 };
  game.items.push({ id: 99, kind: "food", food: "apple", location: { kind: "carried", unitId: scout.id } });
  performJob(game, scout, 0.05, new Navigation(game.colony), () => 0.5, []);
  expect(scout.route.at(-1)).toEqual({ x: 10, y: 5 });
});
it("finishes a running egg cycle before leaving, lays nothing on the way and restarts the cycle at the new seat", () => {
  const game = world();
  dig(game, shaft, "corridor");
  dig(game, midRoom, "room");
  advance(game, 170);
  game.items = [];
  advance(game, 10);
  expect(game.items).toEqual([]);
  expect(queen(game).job).toBeNull();
  expect(game.eggTimer).toBeCloseTo(10, 8);
  advance(game, 19.95);
  expect(queen(game).job).toBeNull();
  advance(game, 0.05);
  expect(game.items.map((item) => item.location)).toEqual([{ kind: "cell", cell: { x: 9, y: 3 } }]);
  expect(queen(game).job?.kind).toBe("nest");
  expect(game.eggTimer).toBe(0);
  game.items = [];
  advance(game, 24.05);
  expect(queen(game).cell).toEqual({ x: 10, y: 5 });
  expect([queen(game).job, game.items]).toEqual([null, []]);
  expect(game.eggTimer).toBeCloseTo(0.05, 8);
  advance(game, 30);
  expect(game.items.map((item) => item.location)).toEqual([{ kind: "cell", cell: { x: 9, y: 5 } }]);
});
