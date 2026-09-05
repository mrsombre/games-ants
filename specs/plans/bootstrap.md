# Bootstrap games-ants

## Объём

Минимальное браузерное приложение по структуре tma-template-cf. Создаём инфраструктуру и стартовую страницу, без игровой логики и без публикации в Cloudflare. Telegram, D1 и KV сейчас не нужны. Однофайловая offline-сборка остаётся задачей игрового этапа.

## Шаги

1. **Workspace и API.** Адаптировать корневые package.json, pnpm-workspace.yaml, wrangler.jsonc и AGENTS.md; создать apps/backend с Hono и GET /api/health, packages/common с контрактом API без barrel exports. Убрать Telegram-секреты и привязки ресурсов шаблона. Сохранить Node 24+, pnpm 11+, семидневную задержку версий и strictDepBuilds. Приёмка: install, types, check, type-check и HTTP-тесты проходят. Коммит scope scaffold.
2. **Единый frontend/dev server.** Создать apps/frontend с React, TypeScript, Vite и @cloudflare/vite-plugin. React сохраняет основу UI шаблона; router, Telegram SDK, Tailwind и игровой renderer пока не подключаем. Корневой Wrangler config передаётся через configPath. Статика обслуживается первой, /api и /api/* всегда идут в Worker. pnpm dev запускает оба слоя на одном origin, pnpm build собирает client и Worker, pnpm preview проверяет сборку. Приёмка: сборка, обязательные проверки, локальные HTTP-запросы, браузер и HMR. Коммит scope frontend.
3. **Документация и итог.** Добавить README и docs/development.md с командами и архитектурой; привести docs к индексу и frontmatter OKF 0.2, обновить статус игрового плана, не меняя концепцию. Проверить frozen lockfile и локальный production preview. Записать результат и отличия в этом плане и архивировать его. Коммит scope docs.

## Ограничения

- Не выполнять deploy, не создавать удалённые ресурсы и не менять исходный репозиторий шаблона.
- Локальные временные файлы хранить в ./tmp, результаты сборки и типы Worker не коммитить.
- Коммиты делать по завершённым шагам с явными путями staging.
