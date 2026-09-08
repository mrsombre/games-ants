import { type CargoAppearance, type CreatureAppearance, drawAnt } from "@app/assets/creatures";
import { Application, Container, Graphics, Text, type TextStyleOptions } from "pixi.js";

type Pose = { label: string; moving: boolean; hurt?: boolean; egg?: boolean; cargo?: CargoAppearance };
type Row = { label: string; role: CreatureAppearance["role"]; faction: CreatureAppearance["faction"] };

const poses: Pose[] = [
  { label: "стоит", moving: false },
  { label: "идёт", moving: true },
  { label: "ранен", moving: false, hurt: true },
  { label: "яйцо", moving: true, egg: true },
  { label: "яблоко", moving: true, cargo: "apple" },
  { label: "гриб", moving: true, cargo: "mushroom" },
  { label: "гусеница", moving: true, cargo: "caterpillar" },
];

const rows: Row[] = [
  { label: "Рабочий", role: "worker", faction: "colony" },
  { label: "Разведчик", role: "scout", faction: "colony" },
  { label: "Воин", role: "warrior", faction: "colony" },
  { label: "Рабочий · налёт", role: "worker", faction: "raiders" },
  { label: "Разведчик · налёт", role: "scout", faction: "raiders" },
  { label: "Воин · налёт", role: "warrior", faction: "raiders" },
  { label: "Божья коровка", role: "beetle", faction: "raiders" },
  { label: "Паук", role: "spider", faction: "raiders" },
  { label: "Матка", role: "queen", faction: "colony" },
];

const CELL_W = 104;
const CELL_H = 76;
const GUTTER_X = 104;
const GUTTER_Y = 26;
const carries = (role: CreatureAppearance["role"]) => role === "worker" || role === "scout";

const host = document.getElementById("stage");
if (!host) throw new Error("Missing lab stage");

const app = new Application();
await app.init({ antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) });
host.appendChild(app.canvas);

const world = new Container();
const grid = new Graphics();
const labels = new Container();
const figures = new Container();
world.addChild(grid, labels, figures);
app.stage.addChild(world);

const labelStyle: TextStyleOptions = { fontFamily: "system-ui, sans-serif", fontSize: 10 };
const texts: Text[] = [];
function label(value: string, x: number, y: number, anchorX: number) {
  const text = new Text({ text: value, style: labelStyle });
  text.anchor.set(anchorX, 0.5);
  text.position.set(x, y);
  texts.push(text);
  labels.addChild(text);
  return text;
}

type Sample = { row: Row; pose: Pose; unit: CreatureAppearance; figure: Graphics; overlay: Graphics };
const samples: Sample[] = [];
for (const [r, row] of rows.entries()) {
  label(row.label, GUTTER_X - 10, GUTTER_Y + r * CELL_H + CELL_H / 2, 1);
  for (const [c, pose] of poses.entries()) {
    if (r === 0) label(pose.label, GUTTER_X + c * CELL_W + CELL_W / 2, GUTTER_Y / 2, 0.5);
    if ((pose.egg || pose.cargo) && !carries(row.role)) continue;
    const unit: CreatureAppearance = { ...row, walking: pose.moving, working: false, health: pose.hurt ? 0.35 : 1 };
    const figure = new Graphics();
    const overlay = new Graphics();
    figure.position.set(GUTTER_X + c * CELL_W + CELL_W / 2, GUTTER_Y + r * CELL_H + CELL_H / 2);
    overlay.position.copyFrom(figure.position);
    figures.addChild(figure, overlay);
    samples.push({ row, pose, unit, figure, overlay });
  }
}

const control = <T extends HTMLElement>(name: string) => {
  const element = document.getElementById(name);
  if (!element) throw new Error(`Missing control ${name}`);
  return element as T;
};
const toggle = control<HTMLButtonElement>("toggle");
const phase = control<HTMLInputElement>("phase");
const phaseValue = control<HTMLOutputElement>("phase-value");
const speed = control<HTMLInputElement>("speed");
const speedValue = control<HTMLOutputElement>("speed-value");
const zoom = control<HTMLInputElement>("zoom");
const zoomValue = control<HTMLOutputElement>("zoom-value");
const headings = [...document.querySelectorAll<HTMLButtonElement>("[data-heading]")];
const background = control<HTMLSelectElement>("background");
const showCells = control<HTMLInputElement>("cells");

let time = 0;
let playing = true;
let heading = 0;

function applyZoom() {
  const scale = Number(zoom.value);
  world.scale.set(scale);
  zoomValue.textContent = `${scale.toFixed(1)}×`;
  app.renderer.resize((GUTTER_X + poses.length * CELL_W) * scale, (GUTTER_Y + rows.length * CELL_H) * scale);
}

function applyBackground() {
  const color = Number(background.value);
  app.renderer.background.color = color;
  // Relative luminance of the swatch decides whether captions stay dark or flip to light.
  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  for (const text of texts) text.style.fill = light ? 0x2f2a24 : 0xf0ece2;
  drawGrid(light);
}

function drawGrid(light: boolean) {
  grid.clear();
  if (!showCells.checked) return;
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < poses.length; c++)
      grid
        .rect(GUTTER_X + c * CELL_W, GUTTER_Y + r * CELL_H, CELL_W, CELL_H)
        .stroke({ color: light ? 0x2f2a24 : 0xf0ece2, width: 0.5, alpha: 0.25 });
}

function render() {
  const angle = (heading * Math.PI) / 180;
  for (const { row, pose, unit, figure, overlay } of samples) {
    figure.clear();
    overlay.clear();
    drawAnt(figure, unit, time, pose.egg === true, pose.cargo);
    if (row.role === "queen") {
      if (pose.hurt) {
        overlay.roundRect(-20, -18, 40, 3, 1).fill(0x56382d);
        overlay.roundRect(-20, -18, 40 * 0.35, 3, 1).fill(0xa9df79);
      }
    }
    figure.rotation = angle;
    overlay.rotation = 0;
  }
}

app.ticker.add((ticker) => {
  if (playing) time = (time + (ticker.deltaMS / 1000) * Number(speed.value)) % 1000;
  phase.value = (time % 1).toFixed(3);
  phaseValue.textContent = phase.value;
  render();
});

toggle.addEventListener("click", () => {
  playing = !playing;
  toggle.textContent = playing ? "Пауза" : "Пуск";
});
phase.addEventListener("input", () => {
  playing = false;
  toggle.textContent = "Пуск";
  time = Math.floor(time) + Number(phase.value);
  phaseValue.textContent = phase.value;
  render();
});
speed.addEventListener("input", () => {
  speedValue.textContent = `${Number(speed.value).toFixed(2)}×`;
});
zoom.addEventListener("input", applyZoom);
for (const button of headings)
  button.addEventListener("click", () => {
    heading = Number(button.dataset.heading);
    for (const other of headings) other.ariaPressed = String(other === button);
    render();
  });
background.addEventListener("change", applyBackground);
showCells.addEventListener("change", applyBackground);

applyZoom();
applyBackground();
render();
