# games-ants

Браузерная игра про муравейник, вдохновлённая механиками Fallout Shelter.
Сейчас готов только минимальный каркас: React-страница и Hono API на Cloudflare Workers.

Production: [games-ants.warmvibes.workers.dev](https://games-ants.warmvibes.workers.dev/).

## Локальный запуск

Нужны Node.js 24+ и pnpm 11+. Версия pnpm зафиксирована в `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm types
pnpm dev
```

Открыть [127.0.0.1:5173](http://127.0.0.1:5173/).
Одна команда запускает Vite frontend и локальный Worker; API доступен на том же origin:
[`/api/health`](http://127.0.0.1:5173/api/health).
Cloudflare-аккаунт, Telegram-токены и `.dev.vars` для этого не нужны.

## Проверки и сборка

```sh
pnpm check
pnpm type-check
pnpm test
pnpm build
pnpm preview
```

Production preview: [127.0.0.1:4173](http://127.0.0.1:4173/).
`pnpm check:ci` запускает Biome без изменений файлов.
`pnpm type-check` сначала генерирует типы Worker.

## Структура

```text
apps/
├─ frontend/   # React + TypeScript + Vite + @cloudflare/vite-plugin
└─ backend/    # Hono Worker, пока только GET /api/health
packages/
└─ common/     # Общие API-контракты без зависимостей от приложений
docs/          # Концепция, сравнение движков и разработка
specs/plans/   # Планы реализации и архив завершённых работ
```

Подробнее: [разработка](./docs/development.md), [концепция игры](./docs/plan.md),
[сравнение движков](./docs/engine-comparison.md).

## Публикация

```sh
pnpm run deploy
```

Команда собирает frontend и Worker, затем запускает Wrangler с конфигурацией из сборки.
Требуется авторизация Cloudflare. Проверка без публикации: `pnpm run deploy --dry-run`.

Игровые механики, сохранения и автономный HTML ещё не реализованы.
Первый деплой в Cloudflare успешно выполнен пользователем 5 сентября 2026 года.
