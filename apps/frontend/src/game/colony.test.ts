import { describe, expect, it } from "vitest";
import { COLS } from "./cells";
import { initialColony, placementError } from "./colony";

describe("construction", () => {
  it("only extends corridors from corridors", () => {
    expect(placementError(initialColony, 8, 6, "corridor")).toBeNull();
    expect(placementError(initialColony, 5, 2, "corridor")).toBeTruthy();
    expect(placementError(initialColony, 12, 3, "corridor")).toBeTruthy();
  });
  it("extends a room horizontally up to four cells", () => {
    expect(placementError(initialColony, 5, 2, "room")).toBeNull();
    const expanded = { ...initialColony, "5,2": "room" as const };
    expect(placementError(expanded, 4, 2, "room")).toBeNull();
    expect(placementError({ ...expanded, "4,2": "room" }, 3, 2, "room")).toBeTruthy();
    expect(placementError(initialColony, 12, 3, "room")).toBeNull();
    expect(placementError({ ...initialColony, "12,3": "room" }, 13, 3, "room")).toBeTruthy();
  });
  it("does not extend rooms vertically or diagonally", () => {
    expect(placementError(initialColony, 6, 3, "room")).toBeTruthy();
    expect(placementError(initialColony, 5, 3, "room")).toBeTruthy();
    expect(placementError(initialColony, 7, 4, "room")).toBeNull();
  });
  it("rejects merging rooms into a span wider than four", () => {
    expect(placementError({ ...initialColony, "3,2": "room", "4,2": "room" }, 5, 2, "room")).toBeTruthy();
  });
  it("protects the surface, occupied cells and world boundaries", () => {
    expect(placementError({ ...initialColony, "17,3": "corridor" }, 18, 3, "corridor")).toBeTruthy();
    for (let x = 0; x < COLS; x++)
      for (const tool of ["room", "corridor"] as const) expect(placementError(initialColony, x, 1, tool)).toBeTruthy();
    for (const [x, y] of [
      [8, 3],
      [-1, 3],
      [18, 3],
      [8, 11],
    ] as const)
      expect(placementError(initialColony, x, y, "room")).toBeTruthy();
  });
});
