# Agents Rules

## Project

Browser game games-ants, inspired by Fallout Shelter, with a static frontend and a small Cloudflare
Worker API. Documentation is split into development, system design and game mechanics sections.
This scaffold has no Telegram integration.

## Interactions

- Answer the user in Russian, whatever language the question is asked in. Commands, code,
  identifiers and technology names stay in English.

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
- Verify small visual adjustments in the running dev server.
- Run pnpm check, pnpm type-check, pnpm test and pnpm build only before an explicitly requested
  commit containing significant source-code changes (behavior, contracts, architecture or build configuration).
- Keep frontend and Worker development on one origin through @cloudflare/vite-plugin.
- Deploy only when explicitly requested. Local development and preview are allowed.

## Documentation

- Follow docs/index.md when writing docs: use Russian, update the relevant section index.
