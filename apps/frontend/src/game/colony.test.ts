import { describe, expect, it } from "vitest";
import { initialColony, placementError } from "./colony";

describe("colony construction", () => {
  it("allows extending the entrance and rooms in four directions", () => {
    for (const [x = NaN, y = NaN] of [
      [7, 0],
      [9, 0],
      [8, 3],
      [6, 3],
    ])
      expect(placementError(initialColony, x, y)).toBeNull();
  });
  it("rejects isolated and diagonal rooms", () => {
    expect(placementError(initialColony, 0, 0)).toBeTruthy();
    expect(placementError(initialColony, 5, 3)).toBeTruthy();
  });
  it("protects occupied cells and the world boundary", () => {
    for (const [x = NaN, y = NaN] of [
      [8, 0],
      [7, 2],
      [-1, 0],
      [18, 0],
      [8, -1],
      [8, 10],
    ])
      expect(placementError(initialColony, x, y)).toBeTruthy();
  });
});
