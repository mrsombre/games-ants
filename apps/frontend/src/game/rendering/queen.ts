import type { Graphics } from "pixi.js";

export function drawQueen(g: Graphics, px: number, py: number) {
  // Three jointed legs on each side of the thorax, visible in a slight top view.
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg++) {
      g.moveTo(px + 26 + leg * 2, py + 28)
        .lineTo(px + 22 + leg * 6, py + 28 + side * 6)
        .lineTo(px + 19 + leg * 9, py + 28 + side * 11)
        .stroke({ color: 0x3c3026, width: 1.6, cap: "round", join: "round" });
    }
  }
  g.ellipse(px + 17, py + 28, 8, 5.5)
    .fill(0x3c3026)
    .ellipse(px + 28, py + 28, 5, 3.5)
    .fill(0x3c3026)
    .circle(px + 37, py + 28, 4.5)
    .fill(0x3c3026);
  g.moveTo(px + 39, py + 25)
    .lineTo(px + 42, py + 21)
    .lineTo(px + 46, py + 20)
    .moveTo(px + 40, py + 29)
    .lineTo(px + 44, py + 30)
    .lineTo(px + 46, py + 33)
    .stroke({ color: 0x3c3026, width: 1.4, cap: "round", join: "round" });
  g.circle(px + 38, py + 26, 1).fill(0xf1d98c);
  g.poly([px + 10, py + 11, px + 12, py + 17, px + 22, py + 17, px + 24, py + 11, px + 17, py + 14]).fill(0xf1d98c);
}
