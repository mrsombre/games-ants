# Локальная разработка

Этот раздел предназначен для разработчиков: как запустить, проверить, собрать и опубликовать
проект. Устройство игровой симуляции описано отдельно в разделе
[«Проектирование системы»](../system-design/index.md), а правила игры — в разделе
[«Игровые механики»](../game-mechanics/index.md).

Production: [games-ants.warmvibes.workers.dev](https://games-ants.warmvibes.workers.dev/).
Первый успешный деплой подтверждён пользователем 5 сентября 2026 года.

## Основа

Каркас адаптирован из пользовательского `tma-template-cf/docs/scaffold`: pnpm workspace,
строгие настройки TypeScript, Biome, Hono, общие API-контракты, Vitest и генерация типов Wrangler.
Взята основа шагов 01-07 и React/Vite из шага 12. Инструкции шаблона по Telegram и публикации
не являются частью bootstrap этой игры.

Вместо двух процессов frontend/backend используется официальный `@cloudflare/vite-plugin`.
В конфигурации frontend указан абсолютный `configPath`, вычисленный относительно `vite.config.js`,
на корневой `wrangler.jsonc`. Worker выполняется локально в workerd, а не в Node.js mock-сервере.
Плагин поддерживает dev, build и preview для общего приложения.
[Cloudflare: Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/).

React оставлен как основа будущего UI из шаблона. Router, Telegram SDK, Tailwind, авторизация,
D1 и KV сейчас не подключены. PixiJS рисует лес, муравейник и автономных муравьёв; React отвечает за панель и счётчики. В API пока только `GET /api/health`.

## Первый запуск

```sh
pnpm install --frozen-lockfile
pnpm types
pnpm dev
```

- Приложение: `http://127.0.0.1:5173/`.
- API: `http://127.0.0.1:5173/api/health`, ответ `{"status":"ok","app":"games-ants"}`.
- `pnpm dev` запускает оба слоя; frontend получает HMR, Worker обновляется после изменения кода.
- Порт закреплён через `strictPort`: если он занят, процесс завершится с ошибкой, а не выберет другой.
- Локальные секреты сейчас не нужны. `.dev.vars.example` оставлен как место для будущих настроек.
  Новые имена переменных и привязки сначала объявляются в `wrangler.jsonc`, затем обновляются типы.

`worker-configuration.d.ts` генерируется и не хранится в Git. `pnpm type-check` обновляет его
автоматически. Для sandbox-среды генерации нужен доступ к локальному loopback-порту workerd.
Временные файлы размещаются в корневом `.tmp/`. При необходимости туда можно направить логи CLI:
`WRANGLER_LOG_PATH="$PWD/.tmp/wrangler" pnpm dev`.

## Маршрутизация

Статические файлы обслуживаются перед Worker. Навигация на клиентские пути использует
SPA fallback к `index.html`. Исключения `/api` и `/api/*` в `assets.run_worker_first` всегда
вызывают Worker, включая открытие API в адресной строке. Неизвестный API-путь возвращает JSON 404,
а не HTML приложения.

Контракты находятся в `packages/common/src/api/`, маршруты - в группах
`apps/backend/src/<group>/routes.ts`. Общую HTTP-free логику добавлять в
`apps/backend/src/service/<domain>/`, когда она понадобится. Frontend сейчас не зависит от
доступности API; при появлении запросов он должен импортировать общий контракт и проверять
ответы на runtime-границе.

## Проверки

```sh
pnpm check       # Biome с исправлениями, включая корневые конфиги
pnpm check:ci    # Biome без записи
pnpm type-check # Генерация типов Worker + TypeScript во всех пакетах
pnpm test       # Игровая логика и HTTP-тесты Hono через Vitest
pnpm build      # Production-сборка frontend и Worker
```

Тесты API проходят через Hono routing в Node.js: публичный health, JSON 404 и неподдерживаемый POST.
Реальную маршрутизацию static assets/workerd дополнительно проверяем через `pnpm dev` и `pnpm preview`.
Игровые тесты проверяют правила размещения, маршруты, время строительства, выведение и вылазки.
Рисование PixiJS и жизненный цикл React дополнительно проверяем в браузере.

У зависимостей сохранена семидневная задержка `minimumReleaseAge` и явный allowlist build-скриптов.
Точные версии находятся в `pnpm-lock.yaml`. Wrangler compatibility date `2026-07-08` сохранена
из шаблона; при её обновлении нужно повторно сгенерировать типы и проверить runtime.

## Production preview

```sh
pnpm build
pnpm preview
```

Открыть `http://127.0.0.1:4173/`. Preview исполняет собранный Worker локально и отдаёт
собранные статические файлы. Это не публикация в Cloudflare.

Vite создаёт `apps/frontend/dist/client/` и `apps/frontend/dist/games_ants/`, включая
сгенерированный `wrangler.json` для Worker. `assets.directory` плагин задаёт в выходной конфигурации;
в исходном `wrangler.jsonc` путь к сборке не дублируется.
[Cloudflare: Static Assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/).

Записи `dist/`, `.wrangler/`, `worker-configuration.d.ts` и `.tmp/` игнорируются Git.
Для публикации предусмотрена команда `pnpm run deploy`: сначала она выполняет сборку,
затем `wrangler deploy --config apps/frontend/dist/games_ants/wrangler.json`.
Используется выходная конфигурация с собранным Worker и static assets.
Для проверки без публикации: `pnpm run deploy --dry-run`. Реальный deploy требует авторизации
Cloudflare; автоматическая публикация не настроена.
Автономная сборка в один HTML и localStorage-сохранения пока не реализованы;
обычный результат `pnpm build` предназначен для HTTP, а не `file://`.

## Workspace

`packages/game` содержит симуляцию и её тесты, `packages/assets` — независимые рисунки,
`packages/render` — сцену и проекцию. Frontend соединяет пакеты и содержит лабораторию.
Пакеты перечислены явно в `pnpm-workspace.yaml`; экспортируются отдельные модули.

## Устройство движка

Консоль разработчика для проверки механик описана в [отдельной странице](./dev-console.md).

Карта модулей, типы, порядок шага и правила расширения находятся в разделе
[«Проектирование системы»](../system-design/index.md). Результаты ревизии тестов и мутаций —
в [тестовом аудите](./testing.md). Проверка мутациями: `pnpm test:mutation`.
