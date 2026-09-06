import { type FoodKind, foodValue } from "../game/items";
import type { GameEvent } from "../game/model";
import type { IncidentKind } from "../game/narrator";

export function eventMessage(event: GameEvent): string {
  switch (event.kind) {
    case "incident-warned":
      return incidentWarning(event.incident, event.seconds);
    case "incident-started":
      return incidentStart(event.incident, event.size);
    case "incident-ended":
      return incidentEnd[event.incident];
    case "queen-died":
      return "Королева погибла. Новых яиц больше не будет.";
    case "scout-delivered":
      return scoutDeliveryMessage(event.cargo);
    case "food-discarded":
      return `Склад полон — разведчик выбросил ${foodLabel[event.cargo]}. Построй склад.`;
  }
}

const incidentEnd: Record<IncidentKind, string> = {
  raid: "Набег окончен. Муравьи возвращаются к делам.",
  thieves: "Воры ушли. Расплод снова под присмотром.",
  boss: "Жук повержен. Колония выстояла.",
  flood: "Вода ушла. Затопленные клетки снова свободны, но пусты.",
  predator: "Паук ушёл с поляны. Разведчики снова ходят за едой без охраны.",
  "rich-forage": "Богатый участок опустел.",
  "food-nearby": "Еда рядом с гнездом закончилась.",
};
export function incidentWarning(incident: IncidentKind, seconds: number) {
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
