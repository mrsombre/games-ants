import type { BuildTool } from "./colony";
import { placementError } from "./colony";
import { planBuild, plannedColony } from "./construction";
import { demolish, demolitionError } from "./demolition";
import type { Game } from "./model";

export type Tool = BuildTool | "demolish";

export function toolError(game: Game, tool: Tool, x: number, y: number): string | null {
  return tool === "demolish" ? demolitionError(game, x, y) : placementError(plannedColony(game), x, y, tool);
}

export function applyTool(game: Game, tool: Tool, x: number, y: number): string | null {
  return tool === "demolish" ? demolish(game, x, y) : planBuild(game, x, y, tool);
}
