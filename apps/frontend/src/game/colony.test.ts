import { describe, expect, it } from "vitest";
import { COLS } from "./cells";
import { initialColony, placementError } from "./colony";

describe("construction", () => {
  it("extends corridors from corridors or sideways from rooms, never above or below a room", () => {
    expect(placementError(initialColony, 8, 6, "corridor")).toBeNull();
    expect(placementError(initialColony, 5, 2, "corridor")).toBeNull();
    expect(placementError(initialColony, 12, 3, "corridor")).toBeNull();
    expect(placementError(initialColony, 6, 3, "corridor")).toMatch(/Коридор/);
    expect(placementError(initialColony, 10, 2, "corridor")).toBeTruthy();
  });
  it("extends a room horizontally up to four cells", () => {
    expect(placementError(initialColony, 5, 2, "room")).toBeNull();
    const expanded = { ...initialColony, "5,2": "room" as const };
    expect(placementError(expanded, 4, 2, "room")).toBeNull();
    expect(placementError({ ...expanded, "4,2": "room" }, 3, 2, "room")).toBeTruthy();
    expect(placementError(initialColony, 12, 3, "room")).toBeNull();
    expect(placementError({ ...initialColony, "12,3": "room" }, 13, 3, "room")).toBeTruthy();
  });
  it("does not start rooms above or below corridors and does not extend rooms vertically or diagonally", () => {
    expect(placementError(initialColony, 8, 6, "room")).toMatch(/комнату/);
    expect(placementError(initialColony, 6, 3, "room")).toBeTruthy();
    expect(placementError(initialColony, 5, 3, "room")).toBeTruthy();
    expect(placementError(initialColony, 7, 4, "room")).toBeNull();
  });
  it("rejects merging rooms into a span wider than four but lets a corridor split them", () => {
    const rooms = { ...initialColony, "3,2": "room", "4,2": "room" } as const;
    expect(placementError(rooms, 5, 2, "room")).toBeTruthy();
    expect(placementError(rooms, 5, 2, "corridor")).toBeNull();
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
