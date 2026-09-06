import { pauseNarrator, setDifficulty } from "../game/debug";
import type { Game } from "../game/model";

type Command = { readonly signature: string; readonly about: string; readonly run: (...args: never[]) => unknown };

// Kept on `window` and never removed, so the object outlives a hot module replacement.
export function installDevConsole(game: Game, refresh: () => void) {
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
  };
  const api = Object.fromEntries(Object.entries(commands).map(([name, command]) => [name, command.run]));
  Object.assign(globalThis, { dev: api });
  console.log("dev console: dev.help()");
}
