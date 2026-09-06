import { expect, it } from "vitest";
import { screenCell } from "./layout";

it("maps the forest, protected entrance and square cell edges to their logical coordinates", () => {
  expect(screenCell(442, 259)).toEqual({ x: 8, y: 0 });
  expect(screenCell(442, 260)).toEqual({ x: 8, y: 1 });
  expect(screenCell(467, 311)).toEqual({ x: 8, y: 1 });
  expect(screenCell(468, 312)).toEqual({ x: 9, y: 2 });
});
