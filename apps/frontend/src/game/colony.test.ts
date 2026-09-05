import { describe, expect, it } from "vitest";
import { COLS, initialColony, placementError, roomCount, roomSpan } from "./colony";

describe("construction", () => {
  it("starts with four underground shaft levels and two wide rooms", () => {
    for (let y = 0; y <= 4; y++) expect(initialColony[`8,${y}`]).toBe("corridor");
    expect(roomCount(initialColony)).toBe(2);
    expect(roomSpan(initialColony, 6, 1).width).toBe(2);
    expect(roomSpan(initialColony, 10, 2).width).toBe(3);
    expect(initialColony["10,2"]).toBe("queen");
  });
  it("only extends corridors from corridors", () => {
    expect(placementError(initialColony, 8, 5)).toBeNull();
    expect(placementError(initialColony, 5, 1)).toBeTruthy();
    expect(placementError(initialColony, 12, 2)).toBeTruthy();
  });
  it("extends a room horizontally up to four cells", () => {
    expect(placementError(initialColony, 5, 1, "room")).toBeNull();
    const expanded = { ...initialColony, "5,1": "room" as const };
    expect(placementError(expanded, 4, 1, "room")).toBeNull();
    expect(placementError({ ...expanded, "4,1": "room" }, 3, 1, "room")).toBeTruthy();
    expect(placementError(initialColony, 12, 2, "room")).toBeNull();
    expect(placementError({ ...initialColony, "12,2": "room" }, 13, 2, "room")).toBeTruthy();
  });
  it("does not extend rooms vertically or diagonally", () => {
    expect(placementError(initialColony, 6, 2, "room")).toBeTruthy();
    expect(placementError(initialColony, 5, 2, "room")).toBeTruthy();
    expect(placementError(initialColony, 7, 3, "room")).toBeNull();
  });
  it("rejects merging rooms into a span wider than four", () => {
    expect(placementError({ ...initialColony, "3,1": "room", "4,1": "room" }, 5, 1, "room")).toBeTruthy();
  });
  it("protects the surface, occupied cells and world boundaries", () => {
    for (let x = 0; x < COLS; x++)
      for (const tool of ["room", "corridor"] as const) expect(placementError(initialColony, x, 0, tool)).toBeTruthy();
    for (const [x, y] of [
      [8, 2],
      [-1, 2],
      [18, 2],
      [8, 10],
    ] as const)
      expect(placementError(initialColony, x, y, "room")).toBeTruthy();
  });
});
