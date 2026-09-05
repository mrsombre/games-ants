import { COLS, key, type Point, point } from "./colony";
import {
  type Ant,
  ATTACK_MAX_SECONDS,
  ATTACK_MIN_SECONDS,
  type Creature,
  ENTRANCE,
  type Enemy,
  enemyTraits,
  FIRST_RAID_MAX_ENEMIES,
  type Game,
  type GameEvent,
  HEAL_SECONDS,
  HIT_SECONDS,
  HOME,
  QUEEN_HP,
  type Queen,
  roles,
  SURFACE_EXIT,
} from "./model";
import { move, path, redirect, routeTo } from "./navigation";
import { chooseLoot, collectLoot, dropLoot, escapeWithLoot, stealing } from "./theft";

export function attackDelay(random: () => number) {
  return ATTACK_MIN_SECONDS + random() * (ATTACK_MAX_SECONDS - ATTACK_MIN_SECONDS);
}

function cell(p: Point) {
  return key(Math.round(p.x), Math.round(p.y));
}

function present(ant: Ant) {
  return !(ant.role === "scout" && ant.phase === "away");
}

export function engaged(game: Game, creature: Creature) {
  if (creature.role === "scout" && !present(creature)) return false;
  const opponents = creature.role === "enemy" ? game.ants.filter(present) : game.enemies;
  return opponents.some((other) => cell(other) === cell(creature));
}

export function advanceAttack(game: Game, seconds: number, random: () => number, events: GameEvent[]) {
  game.attackTimer -= seconds;
  if (game.attackTimer <= 0) {
    const maximum = game.raidsStarted === 0 ? Math.min(FIRST_RAID_MAX_ENEMIES, game.maxEnemies) : game.maxEnemies;
    const count = 1 + Math.min(maximum - 1, Math.floor(random() * maximum));
    game.raidsStarted++;
    const left = random() < 0.5;
    for (let i = 0; i < count; i++) {
      game.enemies.push({
        id: game.nextId++,
        role: "enemy",
        targetEggId: null,
        x: left ? -1 - i * 0.7 : COLS + 1 + i * 0.7,
        y: SURFACE_EXIT.y,
        hp: enemyTraits.hp,
        attackWait: 0,
        healWait: 0,
        heading: left ? 0 : Math.PI,
        wandering: false,
        wanderWait: 0,
        route: [],
      });
    }
    game.attackTimer = attackDelay(random);
    events.push({ kind: "attack-started", count });
  }
  for (const enemy of game.enemies) {
    if (engaged(game, enemy)) {
      dropLoot(game, enemy);
      continue;
    }
    const target = chooseLoot(game, enemy);
    if (!target && queenOpponent(game, enemy)) continue;
    redirect(game, enemy, target ?? (game.queen.hp > 0 ? HOME : { x: -1, y: SURFACE_EXIT.y }));
    move(enemy, seconds);
    if (!engaged(game, enemy)) collectLoot(game, enemy);
  }
}

export function updateDefense(game: Game, ant: Ant, seconds: number) {
  ant.wandering = false;
  ant.wanderWait = 0;
  if (ant.role === "worker") {
    ant.working = false;
    if (ant.task?.kind === "build") ant.task = null;
    const corridors = [ENTRANCE, ...(routeTo(game.colony, ENTRANCE, HOME) ?? [])]
      .filter((p) => game.colony[key(p.x, p.y)] === "corridor")
      .reverse();
    const workers = game.ants.filter((entry) => entry.role === "worker");
    const target = corridors[workers.indexOf(ant) % corridors.length];
    if (target) redirect(game, ant, target, true);
    else ant.route = ant.route.slice(0, 1);
  } else if (ant.role === "warrior" || ant.role === "scout") {
    if (ant.role === "scout") ant.phase = "home";
    const targets = game.enemies
      .flatMap((enemy) => {
        const target =
          enemy.y < 0 ? { x: enemy.x, y: SURFACE_EXIT.y } : { x: Math.round(enemy.x), y: Math.round(enemy.y) };
        const origin = ant.route[0] ?? ant;
        const route = path(game, origin, target);
        return route
          ? [
              {
                target,
                cost: route.reduce(
                  (sum, p, i) => sum + Math.hypot(p.x - (route[i - 1] ?? origin).x, p.y - (route[i - 1] ?? origin).y),
                  0,
                ),
              },
            ]
          : [];
      })
      .sort((a, b) => a.cost - b.cost);
    if (targets[0]) redirect(game, ant, targets[0].target);
  }
  move(ant, seconds);
}

function queenOpponent(game: Game, enemy: Enemy) {
  return game.queen.hp > 0 && !stealing(game, enemy) && cell(enemy) === cell(game.queen);
}

export function fight(game: Game, seconds: number, events: GameEvent[]) {
  for (const enemy of game.enemies) if (engaged(game, enemy)) dropLoot(game, enemy);
  type Fighter = Creature | Queen;
  const creatures: Fighter[] = [
    ...game.ants.filter((ant) => ant.hp > 0),
    ...game.enemies.filter((enemy) => enemy.hp > 0),
    ...(game.queen.hp > 0 ? [game.queen] : []),
  ];
  const queenWasAlive = game.queen.hp > 0;
  const damage = new Map<Fighter, number>();
  for (const creature of creatures) {
    const opponents: Fighter[] =
      creature.role === "enemy"
        ? [...game.ants.filter(present), ...(queenOpponent(game, creature) ? [game.queen] : [])]
        : creature.role === "queen"
          ? game.enemies.filter((enemy) => queenOpponent(game, enemy))
          : game.enemies;
    const target =
      creature.role === "scout" && !present(creature)
        ? undefined
        : opponents.find((other) => other.hp > 0 && cell(other) === cell(creature));
    if (!target) {
      creature.attackWait = 0;
      const maxHp =
        creature.role === "queen" ? QUEEN_HP : creature.role === "enemy" ? enemyTraits.hp : roles[creature.role].hp;
      if (creature.hp >= maxHp) creature.healWait = 0;
      else {
        creature.healWait += seconds;
        if (creature.healWait >= HEAL_SECONDS - 1e-9) {
          creature.hp = Math.min(maxHp, creature.hp + 1);
          creature.healWait = creature.hp === maxHp ? 0 : Math.max(0, creature.healWait - HEAL_SECONDS);
        }
      }
      continue;
    }
    creature.healWait = 0;
    if (creature.role === "scout") {
      creature.cargo = null;
      creature.phase = "home";
      creature.wandering = false;
    }
    creature.heading = Math.atan2(target.y - creature.y, target.x - creature.x);
    creature.attackWait += seconds;
    if (creature.attackWait < HIT_SECONDS - 1e-9) continue;
    creature.attackWait = Math.max(0, creature.attackWait - HIT_SECONDS);
    damage.set(target, (damage.get(target) ?? 0) + 1);
  }
  for (const [target, amount] of damage) target.hp = Math.max(0, target.hp - amount);
  if (queenWasAlive && game.queen.hp <= 0) events.push({ kind: "queen-died" });
  const dead = new Map([...game.ants, ...game.enemies].filter((ant) => ant.hp <= 0).map((ant) => [ant.id, ant]));
  for (const egg of game.eggs) {
    const carrier = "carrier" in egg.location ? dead.get(egg.location.carrier) : undefined;
    if (carrier) egg.location = { cell: cell(carrier) };
  }
  game.ants = game.ants.filter((ant) => ant.hp > 0);
  const wasAttack = game.enemies.length > 0;
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0 && !escapeWithLoot(game, enemy));
  if (wasAttack && !game.enemies.length) {
    events.push({ kind: "attack-ended" });
    for (const ant of game.ants) {
      if (ant.role === "scout") {
        if (ant.phase === "home") {
          ant.phase = "returning";
          redirect(game, ant, HOME);
        }
        continue;
      }
      ant.wandering = true;
      ant.route = ant.route.slice(0, 1);
      if (ant.role === "worker" && ant.task?.kind === "carry-egg") {
        const task = ant.task;
        const carried = game.eggs.find((entry) => entry.id === task.eggId);
        const destination =
          task.phase === "delivery"
            ? task.destination
            : carried && "cell" in carried.location
              ? carried.location.cell
              : undefined;
        if (destination) redirect(game, ant, point(destination));
      }
    }
  }
}
