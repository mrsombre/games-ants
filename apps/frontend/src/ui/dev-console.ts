import type { DayPhaseId } from "../game/day-cycle";
import { jumpToPhase, pauseNarrator, setDifficulty, skipTime } from "../game/debug";
import type { Game, GameEvent } from "../game/model";
import { eventMessage } from "./event-message";

type Command = { readonly signature: string; readonly about: string; readonly run: (...args: never[]) => unknown };

// Kept on `window` and never removed, so the object outlives a hot module replacement.
export function installDevConsole(game: Game, refresh: () => void, showMessage: (text: string) => void) {
  const commanded =
    <A extends unknown[]>(run: (...args: A) => string | null) =>
    (...args: A) => {
      const reason = run(...args);
      refresh();
      if (reason) console.warn(reason);
      return reason;
    };
  const commands: Record<string, Command> = {
    help: {
      signature: "dev.help()",
      about: "Напечатать список команд",
      run: () => {
        for (const command of Object.values(commands)) console.log(`${command.signature} — ${command.about}`);
        return null;
      },
    },
    pause: {
      signature: "dev.pause()",
      about: "Заглушить нарратора (темп 0)",
      run: commanded(() => pauseNarrator(game)),
    },
    difficulty: {
      signature: "dev.difficulty(n)",
      about: "Задать множитель темпа нарратора: конечное неотрицательное число",
      run: commanded((value: number) => setDifficulty(game, value)),
    },
    day: {
      signature: "dev.day(n, phase)",
      about: "Телепортировать в начало фазы morning | noon | evening | night дня n, только вперёд",
      run: commanded((day: number, phase: DayPhaseId) => jumpToPhase(game, day, phase)),
    },
    skip: {
      signature: "dev.skip(seconds)",
      about: "Прокрутить симуляцию на seconds секунд (не больше 600), события печатаются в консоль",
      run: commanded((seconds: number) => {
        const events: GameEvent[] = [];
        const reason = skipTime(game, seconds, events);
        const messages = events.map(eventMessage);
        for (const message of messages) console.log(message);
        const last = messages.at(-1);
        if (last) showMessage(last);
        return reason;
      }),
    },
  };
  const api = Object.fromEntries(Object.entries(commands).map(([name, command]) => [name, command.run]));
  Object.assign(globalThis, { dev: api });
  console.log("dev console: dev.help()");
}
