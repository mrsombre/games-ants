import type { Graphics } from "pixi.js";

const BODY = 0x3c3026;
const GOLD = 0xf1d98c;
export function drawQueen(g: Graphics, time: number, moving: boolean) {
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg++) {
      const swing = moving ? Math.sin(time * 8 + leg * 2 + side * 2) * 2 : 0;
      g.moveTo(-2 + leg * 2, 0)
        .lineTo(-6 + leg * 6 + swing, side * 6)
        .lineTo(-9 + leg * 9 + swing, side * 11)
        .stroke({ color: BODY, width: 1.6, cap: "round", join: "round" });
    }
  }
  g.ellipse(-11, 0, 8, 5.5).fill(BODY).ellipse(0, 0, 5, 3.5).fill(BODY).circle(9, 0, 4.5).fill(BODY);
  g.moveTo(11, -3)
    .lineTo(14, -7)
    .lineTo(18, -8)
    .moveTo(12, 1)
    .lineTo(16, 2)
    .lineTo(18, 5)
    .stroke({ color: BODY, width: 1.4, cap: "round", join: "round" });
  g.circle(10, -2, 1).fill(GOLD);
}
export function drawCrown(g: Graphics, cx: number, cy: number) {
  g.poly([cx - 7, cy - 3, cx - 5, cy + 3, cx + 5, cy + 3, cx + 7, cy - 3, cx, cy]).fill(GOLD);
}
