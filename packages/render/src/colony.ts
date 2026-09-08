import { COLS, ENTRANCE, key, point, ROWS } from "@app/game/cells";
import { type Colony, connected, placementError, type RoomTile, roomSpan } from "@app/game/colony";
import { STORAGE_SLOTS } from "@app/game/storage";
import type { Tool } from "@app/game/tools";
import type { Graphics } from "pixi.js";
import { CELL, SURFACE } from "./layout";

const passages = [
  { dx: 1, dy: 0, corridor: [18, 18, 34, 16], room: [48, 18, 4, 16] },
  { dx: -1, dy: 0, corridor: [0, 18, 34, 16], room: [0, 18, 4, 16] },
  { dx: 0, dy: 1, corridor: [18, 18, 16, 34], room: null },
  { dx: 0, dy: -1, corridor: [18, 0, 16, 34], room: null },
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
      else drawRoom(g, colony, x, y, tile);
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
const roomPalette: Record<RoomTile, { shell: number; floor: number; edge: number }> = {
  nest: { shell: 0x987546, floor: 0xac8c57, edge: 0xc2a36d },
  storage: { shell: 0x6f6a55, floor: 0x86816a, edge: 0xa8a389 },
};
export const foodSlotX = (slot: number) => CELL / 2 + (Math.min(slot, STORAGE_SLOTS - 1) - 1) * 15;
function drawRoom(g: Graphics, colony: Colony, x: number, y: number, tile: RoomTile) {
  const px = x * CELL,
    py = SURFACE + y * CELL;
  const { shell, floor, edge } = roomPalette[tile];
  const span = roomSpan(colony, x, y);
  if (x === span.left) {
    const width = span.width * CELL;
    g.roundRect(px + 4, py + 4, width - 8, CELL - 8, 9).fill(shell);
    g.roundRect(px + 8, py + 8, width - 16, 33, 6).fill(floor);
    g.moveTo(px + 10, py + 43)
      .lineTo(px + width - 10, py + 43)
      .stroke({ color: edge, width: 2 });
  }
  g.moveTo(px + 10, py + 43)
    .lineTo(px + 42, py + 43)
    .stroke({ color: edge, width: 2 });
  if (tile === "storage")
    for (let slot = 0; slot < STORAGE_SLOTS; slot++)
      g.circle(px + foodSlotX(slot), py + CELL / 2, 6).stroke({ color: edge, alpha: 0.5, width: 1 });
}
function drawPassages(g: Graphics, colony: Colony, x: number, y: number) {
  const tile = colony[key(x, y)];
  for (const passage of passages) {
    const neighbor = colony[key(x + passage.dx, y + passage.dy)];
    const entrance = x === ENTRANCE.x && y === ENTRANCE.y && passage.dy === -1;
    if (!entrance && !connected(tile, neighbor, passage.dy === 0)) continue;
    const rect = tile === "corridor" ? passage.corridor : passage.room;
    if (!rect) continue;
    const [left, top, width, height] = rect;
    g.rect(x * CELL + left, SURFACE + y * CELL + top, width, height).fill(0x796246);
  }
}

export function drawWater(g: Graphics, flood: readonly string[], time: number) {
  g.clear();
  for (const id of flood) {
    const { x, y } = point(id);
    const px = x * CELL,
      py = SURFACE + y * CELL;
    g.roundRect(px + 4, py + 4, CELL - 8, CELL - 8, 9).fill({ color: 0x2f6f9e, alpha: 0.62 });
    for (let line = 0; line < 3; line++) {
      const wave = Math.sin(time * 1.6 + line + x) * 3;
      g.moveTo(px + 9, py + 16 + line * 12 + wave)
        .lineTo(px + CELL - 9, py + 16 + line * 12 - wave)
        .stroke({ color: 0x9fd3ee, alpha: 0.45, width: 2 });
    }
  }
}
