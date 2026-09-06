import { useEffect, useRef, useState } from "react";
import { type FoodKind, foodValue } from "../game/items";
import { SIMULATION_STEP } from "../game/model";
import type { IncidentKind } from "../game/narrator";
import { roles } from "../game/rendering/appearance";
import { createScene } from "../game/scene";
import { createGame, stepGame } from "../game/simulation";
import { SPAWN_SECONDS, startSpawn } from "../game/spawning";
import { applyTool, type Tool } from "../game/tools";
import type { SpawnRole } from "../game/units";
import { GAMEPLAY_TIP_INTERVAL, gameplayTips } from "./gameplay-tips";
import { spawnBlockLabel } from "./spawn-block";

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
  const [landscapeName, setLandscapeName] = useState("");
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof createScene>> | undefined;
    let frame = 0;
    void createScene(host.current, (x, y) => {
      const selected = currentTool.current;
      const reason = applyTool(game, selected, x, y);
      setMessage(reason ?? toolSuccess[selected]);
      refresh((n) => n + 1);
    })
      .then((result) => {
        instance = result;
        if (disposed) {
          result.destroy();
          return;
        }
        setLandscapeName(result.landscapeName);
        setReady(true);
        let last = performance.now(),
          accumulator = 0,
          uiTime = 0;
        const tick = (now: number) => {
          accumulator += Math.min((now - last) / 1000, 0.1);
          last = now;
          while (accumulator >= SIMULATION_STEP) {
            for (const event of stepGame(game, SIMULATION_STEP)) {
              if (event.kind === "incident-warned") setMessage(incidentWarning(event.incident, event.seconds));
              if (event.kind === "incident-started") setMessage(incidentStart(event.incident, event.size));
              if (event.kind === "incident-ended") setMessage(incidentEnd[event.incident]);
              if (event.kind === "queen-died") setMessage("Королева погибла. Новых яиц больше не будет.");
              if (event.kind === "scout-delivered") setMessage(scoutDeliveryMessage(event.cargo));
              if (event.kind === "food-discarded")
                setMessage(`Склад полон — разведчик выбросил ${foodLabel[event.cargo]}. Построй склад.`);
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
  function spawnAnt(role: SpawnRole) {
    const block = startSpawn(game, role);
    setMessage(
      block ? spawnBlockLabel[block] : `${roles[role].label}: яйцо выбрано, вылупление через ${SPAWN_SECONDS} секунд`,
    );
    refresh((n) => n + 1);
  }
  return { host, game, tool, setTool, message, tip: gameplayTips[tipIndex], error, ready, landscapeName, spawnAnt };
}

const toolSuccess: Record<Tool, string> = {
  corridor: "Чертёж поставлен. Рабочие строят, когда к нему готов проход.",
  nest: "Чертёж поставлен. Рабочие строят, когда к нему готов проход.",
  storage: "Чертёж поставлен. Рабочие строят, когда к нему готов проход.",
  demolish: "Элемент сломан",
};

const incidentEnd: Record<IncidentKind, string> = {
  raid: "Набег окончен. Муравьи возвращаются к делам.",
  thieves: "Воры ушли. Расплод снова под присмотром.",
  boss: "Жук повержен. Колония выстояла.",
  flood: "Вода ушла. Затопленные клетки снова свободны, но пусты.",
  predator: "Паук ушёл с поляны. Разведчики снова ходят за едой без охраны.",
  "rich-forage": "Богатый участок опустел.",
  "food-nearby": "Еда рядом с гнездом закончилась.",
};
function incidentWarning(incident: IncidentKind, seconds: number) {
  const when = `через ${Math.round(seconds)} с`;
  if (incident === "thieves") return `Разведка заметила воров ${when}. Прикрой расплод!`;
  if (incident === "boss") return `Из леса ползёт жук ${when}. Собирай всех воинов!`;
  if (incident === "flood") return `Снизу подступает вода ${when}. Выноси еду и кладки из нижней камеры!`;
  if (incident === "predator")
    return `На поляну выходит паук ${when}. Отправь воина наверх — без охраны походов не будет!`;
  return `Враги подходят ${when}. Готовь воинов!`;
}
function incidentStart(incident: IncidentKind, size: number) {
  switch (incident) {
    case "raid":
      return `Атака! Врагов: ${size}. Воины идут на перехват.`;
    case "thieves":
      return `Воры в гнезде! Их ${size}, они охотятся за кладками.`;
    case "boss":
      return size > 1
        ? `Жук у входа! С ним воинов: ${size - 1}. Бейте по очереди.`
        : "Жук у входа! Панцирь толстый — держите фронт.";
    case "flood":
      return size > 0
        ? `Нижняя камера затоплена! Клеток под водой: ${size}. Еда и кладки в них погибли.`
        : "Вода поднялась и тут же ушла: топить было нечего.";
    case "predator":
      return size > 1
        ? `Пауки на поляне! Их ${size}. Разведчики выходят только с воином.`
        : "Паук на поляне! Разведчики выходят только с воином, походы стали дольше.";
    case "rich-forage":
      return "Разведчики нашли богатый участок: гусеницы попадаются чаще.";
    case "food-nearby":
      return "Еда прямо у гнезда: походы стали короткими.";
  }
}

const foodLabel: Record<FoodKind, string> = {
  apple: "зелёное яблоко",
  mushroom: "грибочек",
  caterpillar: "гусеницу",
};
function scoutDeliveryMessage(cargo: FoodKind) {
  const food = foodValue[cargo];
  return `Разведчик принёс ${foodLabel[cargo]} на склад · +${food} ${food === 1 ? "еда" : "еды"}`;
}
