import type { Graphics } from "pixi.js";
import { COLS, ENTRANCE, key, ROWS } from "../cells";
import { type Colony, placementError, roomSpan, type Tool } from "../colony";
import { CELL, SURFACE } from "./layout";

const passages = [
  { dx: 1, dy: 0, corridor: [18, 18, 34, 16], room: [48, 18, 4, 16] },
  { dx: -1, dy: 0, corridor: [0, 18, 34, 16], room: [0, 18, 4, 16] },
  { dx: 0, dy: 1, corridor: [18, 18, 16, 34], room: [18, 48, 16, 4] },
  { dx: 0, dy: -1, corridor: [18, 0, 16, 34], room: [18, 0, 16, 4] },
] as const;

export function drawColony(g: Graphics, colony: Colony, planned: Colony, tool: Tool) {
  g.clear();
  for (let y = 1; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const tile = colony[key(x, y)];
      const px = x * CELL,
        py = SURFACE + y * CELL;
      if (!tile) {
        drawVacantCell(g, planned, tool, x, y);
        continue;
      }
      if (tile === "corridor") g.roundRect(px + 18, py + 18, 16, 16, 5).fill(0x796246);
      else drawRoom(g, colony, x, y);
      drawPassages(g, colony, x, y);
    }
}
function drawVacantCell(g: Graphics, planned: Colony, tool: Tool, x: number, y: number) {
  if (y <= 1) return;
  const px = x * CELL,
    py = SURFACE + y * CELL;
  g.rect(px + 1, py + 1, CELL - 2, CELL - 2).stroke({ color: 0xa09170, alpha: 0.1, width: 1 });
  if (tool === "demolish" || placementError(planned, x, y, tool)) return;
  g.roundRect(px + 5, py + 5, CELL - 10, CELL - 10, 7).fill({ color: 0xcac08e, alpha: 0.045 });
  g.moveTo(px + 23, py + 26)
    .lineTo(px + 29, py + 26)
    .moveTo(px + 26, py + 23)
    .lineTo(px + 26, py + 29)
    .stroke({ color: 0xc1b78c, alpha: 0.45, width: 1 });
}
function drawRoom(g: Graphics, colony: Colony, x: number, y: number) {
  const px = x * CELL,
    py = SURFACE + y * CELL;
  const span = roomSpan(colony, x, y);
  if (x === span.left) {
    const width = span.width * CELL;
    g.roundRect(px + 4, py + 4, width - 8, CELL - 8, 9).fill(0x987546);
    g.roundRect(px + 8, py + 8, width - 16, 33, 6).fill(0xac8c57);
    g.moveTo(px + 10, py + 43)
      .lineTo(px + width - 10, py + 43)
      .stroke({ color: 0xc2a36d, width: 2 });
  }
  g.moveTo(px + 10, py + 43)
    .lineTo(px + 42, py + 43)
    .stroke({ color: 0xc2a36d, width: 2 });
}
function drawPassages(g: Graphics, colony: Colony, x: number, y: number) {
  const corridor = colony[key(x, y)] === "corridor";
  for (const passage of passages) {
    const neighbor = colony[key(x + passage.dx, y + passage.dy)];
    const entrance = x === ENTRANCE.x && y === ENTRANCE.y && passage.dy === -1;
    const connected = neighbor && (corridor || neighbor === "corridor");
    if (!entrance && !connected) continue;
    const [left, top, width, height] = corridor ? passage.corridor : passage.room;
    g.rect(x * CELL + left, SURFACE + y * CELL + top, width, height).fill(0x796246);
  }
}
