import type { SpawnBlock } from "@app/game/spawning";

export const spawnBlockLabel: Record<SpawnBlock, string> = {
  nest: "В гнезде нет свободного места — построй или расширь гнездо",
  egg: "Нет свободной кладки — дождись яйца или завершения переноса",
  food: "Не хватает еды — дождись разведчика",
};
