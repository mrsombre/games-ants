import type { Graphics } from "pixi.js";
import { roles } from "./appearance";
import { queenAppearance } from "./queen";

export type CargoAppearance = "apple" | "mushroom" | "caterpillar";
export type CreatureAppearance = {
  role: keyof typeof roles | "queen";
  faction: "colony" | "raiders";
  walking: boolean;
  working: boolean;
  health: number;
};

const ANT_LEGS = [
  [
    [2, -1.6],
    [3, -4],
    [4.56, -6.08],
  ],
  [
    [0.4, -1.6],
    [0.4, -4.2],
    [-0.6, -6.6],
  ],
  [
    [-1.2, -1.6],
    [-2.2, -4],
    [-3.76, -6.08],
  ],
] as const;

export function drawAnt(
  sprite: Graphics,
  ant: CreatureAppearance,
  time: number,
  carryingEgg: boolean,
  cargo?: CargoAppearance,
) {
  sprite.clear();
  const appearance = ant.role === "queen" ? queenAppearance : roles[ant.role];
  const { size } = appearance;
  const beetle = ant.role === "beetle";
  const spider = ant.role === "spider";
  const bodyOutline = { color: 0x493b30, width: 0.6, alpha: 0.65 };
  const color = beetle || spider || ant.role === "queen" || ant.faction === "colony" ? appearance.color : 0xe7954f;
  const moving = ant.walking || (ant.role === "worker" && ant.working);
  if (beetle)
    for (const side of [-1, 1])
      for (let leg = 0; leg < 3; leg++) {
        const swing = moving ? Math.sin(time * 15 + leg * 2 + side * 2) * 0.8 : 0;
        const x = 2 - leg * 5;
        const reach = 2 - leg * 2;
        sprite
          .moveTo(x, side * 4)
          .lineTo(x + reach + swing, side * 7.2)
          .lineTo(x + reach * 1.5 + swing, side * 9)
          .stroke({ color: 0x594b3d, width: 1.3, cap: "round", join: "round" });
        sprite
          .moveTo(x - 0.4, side * 4)
          .lineTo(x + reach + swing - 0.4, side * 7.2)
          .lineTo(x + reach * 1.5 + swing - 0.4, side * 9)
          .stroke({ color: bodyOutline.color, width: 0.35, alpha: 0.55, cap: "round", join: "round" });
      }
  else if (spider)
    for (const side of [-1, 1])
      for (let leg = 0; leg < (spider ? 4 : 3); leg++) {
        const swing = moving ? Math.sin(time * 15 + leg * 2 + side * 2) * 2 : 0;
        sprite
          .moveTo(-3 + leg * 3, 0)
          .lineTo(-7 + leg * 6 + swing, side * 5)
          .lineTo(-10 + leg * 9 + swing, side * 9)
          .stroke({ color, width: 1.5, cap: "round" });
      }
  else
    for (const side of [-1, 1])
      for (const [leg, [hip, knee, foot]] of ANT_LEGS.entries()) {
        const walking = ant.walking;
        const phase = time * Math.PI * 2 + ((leg % 2 === 0) === (side === 1) ? 0 : Math.PI);
        const lift = walking ? Math.max(0, -Math.sin(phase)) : 0;
        const swing = moving ? Math.sin(time * 15 + leg * 2 + side * 2) * 1.2 : 0;
        let kneeX = knee[0] + swing;
        let kneeY = knee[1];
        let footX = foot[0] + swing;
        let footY = foot[1];
        if (walking) {
          const angle = 0.35 - leg * 0.45 + Math.cos(phase) * 0.75;
          const reach = 5.05 - lift * 0.3;
          const bend = Math.acos(reach / (2 * 2.6));
          const kneeAngle = angle + (leg === 0 ? -bend : bend);
          kneeX = hip[0] + Math.sin(kneeAngle) * 2.6;
          kneeY = hip[1] - Math.cos(kneeAngle) * 2.6;
          footX = hip[0] + Math.sin(angle) * reach;
          footY = hip[1] - Math.cos(angle) * reach;
        }
        sprite
          .moveTo(hip[0], side * hip[1])
          .lineTo(kneeX, side * kneeY)
          .lineTo(footX, side * footY)
          .stroke({ color, width: 1.4, cap: "round", join: "round" });
        sprite
          .moveTo(hip[0] - 0.45, side * hip[1])
          .lineTo(kneeX - 0.45, side * kneeY)
          .lineTo(footX - 0.45, side * footY)
          .stroke({ color: bodyOutline.color, width: 0.35, alpha: 0.55, cap: "round", join: "round" });
      }
  if (spider) {
    sprite
      .ellipse(-9, 0, 9, 7)
      .fill(color)
      .stroke({ color: 0x211c2b, width: 1 })
      .circle(4, 0, 5)
      .fill(color)
      .stroke({ color: 0x211c2b, width: 1 });
    for (const eye of [-2, 2]) sprite.circle(7, eye, 1).fill(0xf0d38a);
    sprite.moveTo(8, -2).lineTo(13, -5).moveTo(8, 2).lineTo(13, 5).stroke({ color: 0x211c2b, width: 1.5 });
  } else if (!beetle) {
    sprite
      .moveTo(-3.4, 0)
      .bezierCurveTo(-4.4, -3.5, -8.4, -3.9, -10.8, -1.8)
      .bezierCurveTo(-12.2, -0.6, -12.2, 0.6, -10.8, 1.8)
      .bezierCurveTo(-8.4, 3.9, -4.4, 3.5, -3.4, 0)
      .closePath()
      .fill(color)
      .stroke(bodyOutline);
    sprite
      .moveTo(-8.8, -2.6)
      .quadraticCurveTo(-7.7, 0, -8.8, 2.6)
      .stroke({ color: bodyOutline.color, width: 0.5, alpha: 0.3 });
    sprite
      .moveTo(-10.3, -1.5)
      .quadraticCurveTo(-8.2, -3.2, -5.7, -1.9)
      .stroke({ color: 0xf0d9b5, width: 0.65, alpha: 0.45, cap: "round" });
    sprite
      .moveTo(-10.2, 1.6)
      .quadraticCurveTo(-7.5, 3.2, -5.1, 1.6)
      .stroke({ color: bodyOutline.color, width: 0.7, alpha: 0.18, cap: "round" });
    sprite
      .moveTo(-3.5, -0.9)
      .bezierCurveTo(-1.7, -0.8, -0.9, -1.5, 0.4, -2.3)
      .bezierCurveTo(3.2, -3.6, 5.4, -2.1, 5.2, 0)
      .bezierCurveTo(5.4, 2.1, 3.2, 3.6, 0.4, 2.3)
      .bezierCurveTo(-0.9, 1.5, -1.7, 0.8, -3.5, 0.9)
      .closePath()
      .fill(color)
      .stroke(bodyOutline);
    sprite
      .moveTo(0.3, -1.5)
      .quadraticCurveTo(2.3, -2.5, 3.8, -1.3)
      .stroke({ color: 0xf0d9b5, width: 0.6, alpha: 0.4, cap: "round" });
  }
  if (beetle) {
    const dark = 0x514438;
    sprite
      .moveTo(4.5, -3)
      .bezierCurveTo(10, -4.1, 11, -2.4, 10.7, 0)
      .bezierCurveTo(11, 2.4, 10, 4.1, 4.5, 3)
      .closePath()
      .fill(dark)
      .stroke(bodyOutline);
    sprite.roundRect(1.5, -4.9, 6, 9.8, 3).fill(dark).stroke(bodyOutline);
    for (const side of [-1, 1]) {
      sprite.ellipse(5.1, side * 3.3, 1.4, 0.85).fill(0xe2cda5);
      sprite
        .moveTo(9.6, side * 1.9)
        .quadraticCurveTo(11.6, side * 2.8, 12.6, side * 4.1)
        .stroke({ color: dark, width: 0.9, cap: "round" });
      sprite.circle(9.2, side * 1.7, 0.55).fill(0xe2cda5);
    }
    sprite
      .moveTo(3.8, 0)
      .bezierCurveTo(4.3, -5.9, -1.3, -8.1, -6.4, -6.8)
      .bezierCurveTo(-15.7, -4.9, -15.7, 4.9, -6.4, 6.8)
      .bezierCurveTo(-1.3, 8.1, 4.3, 5.9, 3.8, 0)
      .closePath()
      .fill(color)
      .stroke(bodyOutline);
    sprite.moveTo(-13.2, 0).lineTo(3.8, 0).stroke({ color: dark, width: 0.65, alpha: 0.8 });
    for (const side of [-1, 1]) {
      sprite.ellipse(-8.6, side * 2.7, 1.5, 1.25).fill(dark);
      sprite.ellipse(-3.5, side * 4.1, 1.6, 1.35).fill(dark);
      sprite.ellipse(0.3, side * 2.5, 1.15, 1).fill(dark);
    }
    sprite
      .moveTo(-10.2, -3.1)
      .quadraticCurveTo(-7.3, -6.1, -3.8, -5.9)
      .stroke({ color: 0xf0c1a1, width: 0.65, alpha: 0.4, cap: "round" });
  } else if (!spider) {
    const headSway = ant.walking && !carryingEgg && !cargo ? Math.sin(time * Math.PI * 2) * 0.07 : 0;
    sprite.save().translateTransform(5.1, 0).rotateTransform(headSway).translateTransform(-5.1, 0);
    const warrior = ant.role === "warrior";
    const cheek = warrior ? 4.2 : ant.role === "scout" ? 2.6 : 3.1;
    const brow = warrior ? 3.7 : ant.role === "scout" ? 1.7 : 2.5;
    const face = ant.role === "scout" ? 11.5 : 11;
    sprite
      .moveTo(5.1, 0)
      .bezierCurveTo(4.9, -cheek, 7, -cheek, 9.6, -brow)
      .quadraticCurveTo(face + 0.5, -brow, face, -0.7)
      .quadraticCurveTo(face - 0.4, 0, face, 0.7)
      .quadraticCurveTo(face + 0.5, brow, 9.6, brow)
      .bezierCurveTo(7, cheek, 4.9, cheek, 5.1, 0)
      .closePath()
      .fill(color)
      .stroke(bodyOutline);
    sprite
      .moveTo(6.3, -cheek * 0.45)
      .quadraticCurveTo(7.1, -cheek * 0.8, 8.4, -cheek * 0.65)
      .stroke({ color: 0xf0d9b5, width: 0.6, alpha: 0.4, cap: "round" });
    for (const side of [-1, 1]) {
      sprite
        .moveTo(9.4, side * (brow - 0.5))
        .quadraticCurveTo(10.8, side * 3.2, 12.4, side * 3.7)
        .quadraticCurveTo(13.5, side * 4, 14.2, side * 3.8)
        .stroke({ color, width: 1.1, cap: "round", join: "round" });
      sprite.circle(9.1, side * (cheek - 1), 0.65).fill(ant.role === "queen" ? 0xf1d98c : 0x241f1c);
      sprite
        .moveTo(face - 0.2, side * (warrior ? 2.1 : 1.1))
        .quadraticCurveTo(
          face + (warrior ? 3.6 : 1.9),
          side * (warrior ? 2.5 : 1.4),
          face + (warrior ? 3.1 : 1.6),
          side * 0.35,
        )
        .quadraticCurveTo(
          face + (warrior ? 1.7 : 0.8),
          side * (warrior ? 1.3 : 0.8),
          face - 0.2,
          side * (warrior ? 1.1 : 0.5),
        )
        .closePath()
        .fill(warrior ? 0xe8b08a : 0x957047)
        .stroke({ color: bodyOutline.color, width: 0.4, alpha: 0.7 });
    }
    sprite.restore();
  }
  if (ant.role === "worker") sprite.roundRect(1.3, -1.3, 2.5, 2.6, 1).fill({ color: 0xe5c792, alpha: 0.75 });
  if (carryingEgg) {
    for (const offset of [-4, 0, 4])
      sprite.ellipse(18, offset, 5, 3).fill(0xf5e8bc).stroke({ color: 0xc5ad75, width: 0.7 });
  }
  if (cargo) drawScoutCargo(sprite, cargo);
  if (ant.role !== "queen" && ant.health < 1) {
    sprite.roundRect(-7, -15, 14, 2.5, 1).fill(0x56382d);
    sprite.roundRect(-7, -15, 14 * ant.health, 2.5, 1).fill(0xa9df79);
  }
  sprite.scale.set(size);
}

function drawScoutCargo(g: Graphics, cargo: CargoAppearance) {
  if (cargo === "apple") {
    g.circle(21, 0, 8).fill(0x7da54c).stroke({ color: 0x4f6e31, width: 1.2 });
    g.circle(18, -3, 2).fill({ color: 0xd8e6a3, alpha: 0.65 });
    g.moveTo(21, -7).lineTo(19, -12).stroke({ color: 0x6f4c2c, width: 2, cap: "round" });
    g.ellipse(23, -10, 5, 2.5).fill(0x587d3d);
    return;
  }
  if (cargo === "mushroom") {
    g.roundRect(18, -1, 7, 12, 3).fill(0xe4c998).stroke({ color: 0x9d744f, width: 1 });
    g.ellipse(21.5, -4, 11, 7).fill(0xc77852).stroke({ color: 0x8f5038, width: 1.2 });
    for (const [x, y] of [
      [17, -5],
      [22, -7],
      [26, -3],
    ] as const)
      g.circle(x, y, 1.2).fill(0xf2d8a9);
    return;
  }
  const segments = [
    [17, 1],
    [22, -1],
    [27, 1],
    [32, -1],
  ] as const;
  for (const [x, y] of segments) {
    g.circle(x, y, 4.5).fill(0x8eae4e).stroke({ color: 0x587431, width: 1 });
    g.moveTo(x - 1, y + 4)
      .lineTo(x - 2, y + 7)
      .stroke({ color: 0x587431, width: 1 });
  }
  g.circle(36, 0, 5).fill(0xa8c75e).stroke({ color: 0x587431, width: 1 });
  g.circle(38, -1.5, 0.8).fill(0x302a26);
}
