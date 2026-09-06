import type { Role } from "../units";

export const roles: Record<Exclude<Role, "queen">, { label: string; color: number; size: number }> = {
  worker: { label: "Рабочий", color: 0xdca34e, size: 0.75 },
  scout: { label: "Разведчик", color: 0x87cbbb, size: 0.65 },
  warrior: { label: "Воин", color: 0xd47662, size: 1 },
  beetle: { label: "Жук", color: 0x6b4bb0, size: 1.9 },
};
