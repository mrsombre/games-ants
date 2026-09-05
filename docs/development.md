---
type: Development Guide
title: Локальная разработка games-ants
description: Единый запуск frontend и Worker, проверка проекта и локальная production-сборка.
tags: [pnpm, vite, cloudflare-workers, react, hono]
---

# Локальная разработка

Production: [games-ants.warmvibes.workers.dev](https://games-ants.warmvibes.workers.dev/).
Первый успешный деплой подтверждён пользователем 5 сентября 2026 года.

## Основа

Каркас адаптирован из пользовательского `tma-template-cf/docs/scaffold`: pnpm workspace,
строгие настройки TypeScript, Biome, Hono, общие API-контракты, Vitest и генерация типов Wrangler.
Взята основа шагов 01-07 и React/Vite из шага 12. Инструкции шаблона по Telegram и публикации
не являются частью bootstrap этой игры.

Вместо двух процессов frontend/backend используется официальный `@cloudflare/vite-plugin`.
В конфигурации frontend указан абсолютный `configPath`, вычисленный относительно `vite.config.ts`,
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
Временные файлы размещаются в корневом `tmp/`. При необходимости туда можно направить логи CLI:
`WRANGLER_LOG_PATH="$PWD/tmp/wrangler" pnpm dev`.

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
Игровые тесты проверяют правила размещения, маршруты, время строительства, найм и вылазки.
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

Записи `dist/`, `.wrangler/`, `worker-configuration.d.ts` и `tmp/` игнорируются Git.
Для публикации предусмотрена команда `pnpm run deploy`: сначала она выполняет сборку,
затем `wrangler deploy --config apps/frontend/dist/games_ants/wrangler.json`.
Используется выходная конфигурация с собранным Worker и static assets.
Для проверки без публикации: `pnpm run deploy --dry-run`. Реальный deploy требует авторизации
Cloudflare; автоматическая публикация не настроена.
Автономная сборка в один HTML и localStorage-сохранения остаются в игровом плане;
обычный результат `pnpm build` пока предназначен для HTTP, а не `file://`.

## Модули игровой версии

Все пути ниже относительно `apps/frontend/src/`. Импорты прямые, без barrel-файлов
и переходных экспортов со старых путей.

| Модуль | Ответственность |
| --- | --- |
| `game/colony.ts` | Сетка, координаты, соседство, правила комнат и размещения |
| `game/model.ts` | Состояние игры, типы рабочих/разведчиков/воинов, баланс и стартовые точки |
| `game/navigation.ts` | Поиск пути по готовым клеткам и движение по маршруту |
| `game/construction.ts` | Чертежи, выбор ближайшей доступной стройки, вклад рабочих |
| `game/simulation.ts` | Создание колонии, найм и шаг автономного поведения по ролям |
| `game/scene.ts` | Владение Pixi Application, мышь и обновление слоёв |
| `game/rendering/` | Лес, комнаты/проходы, матка, муравьи и прогресс стройки |
| `ui/use-game.ts` | Единственный игровой цикл, React-состояние и очистка асинхронной сцены |
| `ui/command-panel.tsx` | Строительство и найм; получает данные и обработчики действий |
| `app.tsx` | Компоновка экрана и счётчики |

Модель изменяется на месте внутри игрового цикла. `stepGame` получает фиксированный
шаг 50 мс и источник случайности (в тестах — детерминированный). По завершении шага
сцена получает `update(game, tool, time)`, React обновляет счётчики раз в 200 мс.
Изменение топологии увеличивает `revision`: сцена перестраивает клетки только при
новой ревизии или смене инструмента, динамические слои обновляет каждый кадр.

`Ant` — объединение по `role`: строительная цель и работа есть только у рабочего,
груз и таймер вылазки — только у разведчика, патруль — только у воина.
Стартовые муравьи создаются напрямую, без фиктивной оплаты найма.

Чтобы добавить роль, начать с `model.ts`, затем описать её поведение в `simulation.ts`
и внешний вид в `rendering/creatures.ts`. Новые правила строительства меняются в
`colony.ts` и `construction.ts`; DOM и Pixi для их тестов не требуются.
Старые интерфейсы, сохранения и миграции не поддерживаются.
