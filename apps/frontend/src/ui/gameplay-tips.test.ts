import { describe, expect, it } from "vitest";
import { GAMEPLAY_TIP_INTERVAL, gameplayTips } from "./gameplay-tips";

describe("gameplay tips", () => {
  it("rotates through ten distinct messages", () => {
    expect(gameplayTips).toHaveLength(10);
    expect(new Set(gameplayTips).size).toBe(10);
    expect(GAMEPLAY_TIP_INTERVAL).toBe(30_000);
  });
});
