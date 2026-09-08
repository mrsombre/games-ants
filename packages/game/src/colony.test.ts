import { describe, expect, it } from "vitest";
import { COLS } from "./cells";
import { initialColony, placementError, roomSpan } from "./colony";

describe("construction", () => {
  it("extends corridors from corridors or sideways from rooms, never above or below a room", () => {
    expect(placementError(initialColony, 8, 6, "corridor")).toBeNull();
    expect(placementError(initialColony, 5, 2, "corridor")).toBeNull();
    expect(placementError(initialColony, 7, 4, "corridor")).toBeNull();
    expect(placementError(initialColony, 12, 3, "corridor")).toBeNull();
    expect(placementError(initialColony, 6, 3, "corridor")).toMatch(/Коридор/);
    expect(placementError(initialColony, 10, 2, "corridor")).toBeTruthy();
    expect(placementError(initialColony, 6, 5, "corridor")).toBeTruthy();
  });
  it("extends a storage or a nest horizontally up to four cells of the same kind", () => {
    expect(placementError(initialColony, 5, 2, "storage")).toBeNull();
    const expanded = { ...initialColony, "5,2": "storage" as const };
    expect(placementError(expanded, 4, 2, "storage")).toBeNull();
    expect(placementError({ ...expanded, "4,2": "storage" }, 3, 2, "storage")).toMatch(/4 клеток/);
    expect(placementError(initialColony, 12, 3, "nest")).toBeNull();
    expect(placementError({ ...initialColony, "12,3": "nest" }, 13, 3, "nest")).toMatch(/4 клеток/);
  });
  it("separates a nest from a storage with a corridor", () => {
    expect(placementError(initialColony, 5, 2, "nest")).toMatch(/коридор/);
    expect(placementError(initialColony, 12, 3, "storage")).toMatch(/коридор/);
    expect(placementError(initialColony, 12, 3, "nest")).toBeNull();
    const split = { ...initialColony, "5,2": "corridor" as const };
    expect(placementError(split, 4, 2, "nest")).toBeNull();
    expect(placementError({ ...split, "4,2": "nest" }, 3, 2, "storage")).toMatch(/коридор/);
  });
  it("measures a span only across cells of one room kind", () => {
    expect(roomSpan(initialColony, 6, 2)).toEqual({ left: 6, right: 7, width: 2 });
    expect(roomSpan(initialColony, 10, 3)).toEqual({ left: 9, right: 11, width: 3 });
    expect(roomSpan(initialColony, 8, 3)).toEqual({ left: 8, right: 8, width: 1 });
    expect(roomSpan({ "1,5": "nest", "2,5": "storage", "3,5": "storage" }, 1, 5).width).toBe(1);
    expect(roomSpan({ "1,5": "nest", "2,5": "storage", "3,5": "storage" }, 3, 5)).toEqual({
      left: 2,
      right: 3,
      width: 2,
    });
    expect(roomSpan(initialColony, 12, 3, "nest").width).toBe(4);
    expect(roomSpan(initialColony, 12, 3, "storage").width).toBe(1);
    expect(roomSpan(initialColony, 5, 2, "storage").width).toBe(3);
    expect(roomSpan(initialColony, 5, 2, "nest").width).toBe(1);
  });
  it("does not start rooms above or below corridors and does not extend rooms vertically or diagonally", () => {
    expect(placementError(initialColony, 8, 6, "nest")).toMatch(/комнату/);
    expect(placementError(initialColony, 8, 6, "storage")).toMatch(/комнату/);
    expect(placementError(initialColony, 6, 3, "nest")).toBeTruthy();
    expect(placementError(initialColony, 5, 3, "nest")).toBeTruthy();
    expect(placementError(initialColony, 7, 5, "nest")).toBeNull();
    expect(placementError(initialColony, 7, 5, "storage")).toBeNull();
  });
  it("rejects merging rooms into a span wider than four but lets a corridor split them", () => {
    const rooms = { ...initialColony, "3,2": "storage", "4,2": "storage" } as const;
    expect(placementError(rooms, 5, 2, "storage")).toMatch(/4 клеток/);
    expect(placementError(rooms, 5, 2, "corridor")).toBeNull();
  });
  it("protects the surface, occupied cells and world boundaries", () => {
    expect(placementError({ ...initialColony, "17,3": "corridor" }, 18, 3, "corridor")).toBeTruthy();
    for (let x = 0; x < COLS; x++)
      for (const tool of ["nest", "storage", "corridor"] as const)
        expect(placementError(initialColony, x, 1, tool)).toBeTruthy();
    for (const [x, y] of [
      [8, 3],
      [6, 2],
      [-1, 3],
      [18, 3],
      [8, 11],
    ] as const)
      expect(placementError(initialColony, x, y, "nest")).toBeTruthy();
  });
});
