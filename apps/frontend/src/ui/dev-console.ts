import type { BuildTool } from "@app/game/colony";
import type { DayPhaseId } from "@app/game/day-cycle";
import { type BuildOptions, buildCell, clearBuilt, jumpToPhase, setFood, skipTime, spawnUnit } from "@app/game/debug";
import type { Game, GameEvent } from "@app/game/model";
import { attachSimulationLog, getSimulationLog, runLoggedCommand, snapshot } from "@app/game/simulation-log";
import type { Faction, Role } from "@app/game/units";
import { eventMessage } from "./event-message";

type Command = { readonly signature: string; readonly about: string; readonly run: (...args: never[]) => unknown };

// Kept on `window` and never removed, so the object outlives a hot module replacement.
export function installDevConsole(game: Game, refresh: () => void, showMessage: (text: string) => void) {
  const alreadyConnected = !!getSimulationLog(game);
  attachSimulationLog(game, (line) => console.log(line));
  const commanded =
    <A extends unknown[]>(
      name: string,
      params: (...args: A) => Record<string, unknown>,
      run: (...args: A) => string | null,
    ) =>
    (...args: A) => {
      const reason = runLoggedCommand(game, "dev", name, params(...args), () => run(...args));
      refresh();
      if (reason) console.warn(reason);
      return reason;
    };
  const commands: Record<string, Command> = {
    help: {
      signature: "dev.help()",
      about: "Напечатать список команд",
      run: commanded(
        "help",
        () => ({}),
        () => {
          for (const command of Object.values(commands)) console.log(`${command.signature} — ${command.about}`);
          return null;
        },
      ),
    },
    day: {
      signature: "dev.day(n, phase)",
      about: "Телепортировать в начало фазы morning | noon | evening | night дня n, только вперёд",
      run: commanded(
        "day",
        (day: number, phase: DayPhaseId) => ({ day, phase }),
        (day: number, phase: DayPhaseId) => jumpToPhase(game, day, phase),
      ),
    },
    skip: {
      signature: "dev.skip(seconds)",
      about: "Прокрутить симуляцию на seconds секунд (не больше 600), события печатаются в консоль",
      run: commanded(
        "skip",
        (seconds: number) => ({ seconds }),
        (seconds: number) => {
          const events: GameEvent[] = [];
          const reason = skipTime(game, seconds, events);
          const last = events.at(-1);
          const message = last ? eventMessage(last) : undefined;
          if (message) showMessage(message);
          return reason;
        },
      ),
    },
    spawn: {
      signature: "dev.spawn(role, x, y, faction?)",
      about: "Поставить юнита в клетку карты или служебную; фракция по умолчанию — raiders для beetle и spider",
      run: commanded(
        "spawn",
        (role: Role, x: number, y: number, faction?: Faction) => ({ role, x, y, faction }),
        (role: Role, x: number, y: number, faction?: Faction) => spawnUnit(game, role, x, y, faction),
      ),
    },
    food: {
      signature: "dev.food(n)",
      about: "Привести запас еды на складе к n порциям: целое неотрицательное число",
      run: commanded(
        "food",
        (amount: number) => ({ amount }),
        (amount: number) => setFood(game, amount),
      ),
    },
    build: {
      signature: "dev.build(x, y, tile, { force })",
      about: "Поставить готовый corridor | nest | storage мгновенно; force снимает правила размещения",
      run: commanded(
        "build",
        (x: number, y: number, tile: BuildTool, options?: BuildOptions) => ({ x, y, tile, options }),
        (x: number, y: number, tile: BuildTool, options?: BuildOptions) => buildCell(game, x, y, tile, options),
      ),
    },
    clear: {
      signature: "dev.clear(x, y, { force })",
      about: "Снести клетку мгновенно; force снимает правила сноса",
      run: commanded(
        "clear",
        (x: number, y: number, options?: BuildOptions) => ({ x, y, options }),
        (x: number, y: number, options?: BuildOptions) => clearBuilt(game, x, y, options),
      ),
    },
    snapshot: {
      signature: "dev.snapshot()",
      about: "Напечатать неизменяемый снимок текущей партии",
      run: commanded(
        "snapshot",
        () => ({}),
        () => {
          snapshot(game);
          return null;
        },
      ),
    },
  };
  const api = Object.fromEntries(Object.entries(commands).map(([name, command]) => [name, command.run]));
  Object.assign(globalThis, { dev: api });
  if (!alreadyConnected) console.log("dev console: dev.help()");
}
