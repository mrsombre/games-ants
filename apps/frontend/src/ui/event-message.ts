import { type FoodKind, foodValue } from "@app/game/items";
import type { GameEvent } from "@app/game/model";

export function eventMessage(event: GameEvent): string {
  switch (event.kind) {
    case "queen-died":
      return "Королева погибла. Новых яиц больше не будет.";
    case "scout-delivered":
      return scoutDeliveryMessage(event.cargo);
    case "food-discarded":
      return `Склад полон — разведчик выбросил ${foodLabel[event.cargo]}. Построй склад.`;
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
