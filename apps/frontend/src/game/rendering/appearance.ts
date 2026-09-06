import type { HatchRole } from "../units";

export const roles: Record<HatchRole, { label: string; color: number; size: number }> = {
  worker: { label: "Рабочий", color: 0xdca34e, size: 0.75 },
  scout: { label: "Разведчик", color: 0x87cbbb, size: 0.65 },
  warrior: { label: "Воин", color: 0xd47662, size: 1 },
};
