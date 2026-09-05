import { useEffect, useRef, useState } from "react";
import type { Tool } from "../game/colony";
import { planBuild } from "../game/construction";
import { demolish } from "../game/demolition";
import { type Role, roles, type ScoutCargo, SIMULATION_STEP, scoutCargoFood } from "../game/model";
import { createScene } from "../game/scene";
import { createGame, stepGame } from "../game/simulation";
import { startSpawn } from "../game/spawning";
import { GAMEPLAY_TIP_INTERVAL, gameplayTips } from "./gameplay-tips";

export function useGame() {
  const host = useRef<HTMLDivElement>(null);
  const [game] = useState(createGame);
  const [, refresh] = useState(0);
  const [tool, setTool] = useState<Tool>("corridor");
  const currentTool = useRef(tool);
  currentTool.current = tool;
  const [message, setMessage] = useState("Поставь чертёж — рабочие сами начнут строить!");
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof createScene>> | undefined;
    let frame = 0;
    void createScene(host.current, (x, y) => {
      const selected = currentTool.current;
      const reason = selected === "demolish" ? demolish(game, x, y) : planBuild(game, x, y, selected);
      setMessage(
        reason ??
          (selected === "demolish" ? "Элемент сломан" : "Чертёж поставлен. Рабочие строят, когда к нему готов проход."),
      );
      refresh((n) => n + 1);
    })
      .then((result) => {
        instance = result;
        if (disposed) {
          result.destroy();
          return;
        }
        setReady(true);
        let last = performance.now(),
          accumulator = 0,
          uiTime = 0;
        const tick = (now: number) => {
          // Pause in background; do not simulate hours on return to the tab.
          accumulator += Math.min((now - last) / 1000, 0.1);
          last = now;
          while (accumulator >= SIMULATION_STEP) {
            for (const event of stepGame(game, SIMULATION_STEP)) {
              if (event.kind === "attack-started") setMessage(`Атака! Врагов: ${event.count}. Воины идут на перехват.`);
              if (event.kind === "attack-ended") setMessage("Набег окончен. Муравьи возвращаются к делам.");
              if (event.kind === "queen-died") setMessage("Королева погибла. Новых яиц больше не будет.");
              if (event.kind === "scout-delivered") setMessage(scoutDeliveryMessage(event.cargo));
            }
            accumulator -= SIMULATION_STEP;
            uiTime += SIMULATION_STEP;
          }
          result.update(game, currentTool.current, now / 1000);
          if (uiTime >= 0.2) {
            refresh((n) => n + 1);
            uiTime = 0;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      instance?.destroy();
    };
  }, [game]);
  useEffect(() => {
    const interval = window.setInterval(
      () => setTipIndex((index) => (index + 1) % gameplayTips.length),
      GAMEPLAY_TIP_INTERVAL,
    );
    return () => window.clearInterval(interval);
  }, []);
  function spawnAnt(role: Role) {
    const started = startSpawn(game, role);
    setMessage(
      started
        ? `${roles[role].label}: яйцо выбрано, вылупление через 10 секунд`
        : game.food < roles[role].cost
          ? "Не хватает еды — дождись разведчика"
          : "Нет свободной кладки — дождись яйца или завершения переноса",
    );
    refresh((n) => n + 1);
  }
  return { host, game, tool, setTool, message, tip: gameplayTips[tipIndex], error, ready, spawnAnt };
}

function scoutDeliveryMessage(cargo: ScoutCargo) {
  const labels: Record<ScoutCargo, string> = {
    apple: "зелёное яблоко",
    mushroom: "грибочек",
    caterpillar: "гусеницу",
  };
  const food = scoutCargoFood[cargo];
  return `Разведчик принёс ${labels[cargo]} · +${food} ${food === 1 ? "еда" : "еды"}`;
}
