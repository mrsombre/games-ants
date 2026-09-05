# Agents Rules

## Project

Browser game games-ants, inspired by Fallout Shelter, with a static frontend and a small Cloudflare
Worker API. Game mechanics are planned in docs/plan.md. This scaffold has no Telegram integration.

## Boundaries

- apps/frontend owns browser UI and the Vite configuration; apps/backend owns Hono HTTP routes.
- Route groups in apps/backend/src/<group>/ contain HTTP wiring and their own middleware/helpers.
  Put reusable HTTP-free logic in apps/backend/src/service/<domain>/ when it appears.
- Declare wire contracts in packages/common/src/api/ and import them in producers and consumers.
  Shared types do not replace validation of untrusted input.
- packages/common imports no workspace package. Export one subpath per module, mirroring src/.
  Do not add root exports or index.ts barrel exports to workspace packages.

## Development

- Use pnpm. Keep the workspace package list explicit and retain the dependency release-age policy.
- Run pnpm types after changes to Wrangler variables, secrets or bindings; declare local variables
  in wrangler.jsonc as well. Generated worker-configuration.d.ts stays ignored.
- Finish changes with pnpm check, pnpm type-check and pnpm test. Check pnpm build after build or UI changes.
- Keep frontend and Worker development on one origin through @cloudflare/vite-plugin.
- Deploy only when explicitly requested. Local development and preview are allowed.

## Documentation and plans

- Follow docs/index.md when writing docs: Russian, OKF 0.2 frontmatter and an updated section index.
- Implementation plans live in specs/plans/ and are free-form. Each step records files, decisions
  and acceptance criteria so work can continue from a cold start.
- On completion, add a verified Результат section including deviations and move the plan with
  git mv into specs/plans/archive/ before opening a PR.
