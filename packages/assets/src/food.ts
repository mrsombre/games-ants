import type { Graphics } from "pixi.js";

export function drawFoodPile(g: Graphics, positions: readonly number[], y: number, portions: number) {
  const ax = positions[0] ?? 0;
  g.ellipse(ax + 2, y + 8, 8, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  g.circle(ax, y + 1, 8)
    .fill(0x7da54c)
    .stroke({ color: 0x4f6e31, width: 1.2 });
  g.circle(ax - 3, y - 2, 2).fill({ color: 0xd8e6a3, alpha: 0.65 });
  g.moveTo(ax, y - 6)
    .lineTo(ax - 2, y - 11)
    .stroke({ color: 0x6f4c2c, width: 2, cap: "round" });
  g.ellipse(ax + 2, y - 9, 5, 2.5).fill(0x587d3d);
  if (portions < 2) return;
  const mx = positions[1] ?? 0;
  g.ellipse(mx, y + 9, 8, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  g.roundRect(mx - 3.5, y - 2, 7, 12, 3)
    .fill(0xe4c998)
    .stroke({ color: 0x9d744f, width: 1 });
  g.ellipse(mx, y - 4, 11, 7)
    .fill(0xc77852)
    .stroke({ color: 0x8f5038, width: 1.2 });
  for (const [dx, dy] of [
    [-5, -5],
    [1, -7],
    [5, -3],
  ] as const)
    g.circle(mx + dx, y + dy, 1.2).fill(0xf2d8a9);
  if (portions < 3) return;
  const cx = positions[2] ?? 0;
  g.ellipse(cx, y + 8, 12, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  for (const [dx, dy] of [
    [-9, 2],
    [-3, 0],
    [3, 2],
  ] as const) {
    g.circle(cx + dx, y + dy, 4.5)
      .fill(0x8eae4e)
      .stroke({ color: 0x587431, width: 1 });
    g.moveTo(cx + dx - 1, y + dy + 4)
      .lineTo(cx + dx - 2, y + dy + 7)
      .stroke({ color: 0x587431, width: 1 });
  }
  g.circle(cx + 9, y, 5)
    .fill(0xa8c75e)
    .stroke({ color: 0x587431, width: 1 });
  g.circle(cx + 11, y - 1, 1).fill(0x2f3d1c);
}
