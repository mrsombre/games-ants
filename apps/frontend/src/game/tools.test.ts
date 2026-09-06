import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "./cells";
import { planBuild } from "./construction";
import { createGame } from "./simulation";
import { applyTool, type Tool, toolError } from "./tools";

const tools: Tool[] = ["corridor", "nest", "storage", "demolish"];

function scene() {
  const game = createGame(() => 0.5);
  game.items = [];
  planBuild(game, 8, 6, "corridor");
  return game;
}

describe("tools", () => {
  it("answers the question exactly where the action succeeds", () => {
    for (const tool of tools) {
      for (let x = -1; x <= COLS; x++) {
        for (let y = -1; y <= ROWS; y++) {
          const game = scene();
          const question = toolError(game, tool, x, y);
          const action = applyTool(scene(), tool, x, y);
          expect({ tool, x, y, question: question === null }).toEqual({ tool, x, y, question: action === null });
          expect(question).toBe(action);
        }
      }
    }
  });
  it("leaves the game untouched when it refuses", () => {
    for (const tool of tools) {
      for (let x = -1; x <= COLS; x++) {
        for (let y = -1; y <= ROWS; y++) {
          const game = scene();
          const before = structuredClone(game);
          if (applyTool(game, tool, x, y)) expect(game).toEqual(before);
        }
      }
    }
  });
});
